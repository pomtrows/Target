import { createContext, useContext, useEffect, useState, useReducer, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useProfile } from './ProfileContext';
import { useToast } from './ToastContext';
import {
  saveLocalProjects,
  loadLocalProjects,
  enqueueProjectsSyncAction,
  processProjectsSyncQueue,
  getPendingProjectsQueueCount,
  generateUUID,
  isOfflineError,
  isTableMissingError
} from '../utils/offlineSync';

const ProjectsContext = createContext(null);

const initialState = {
  projects: [],
  loading: true,
};

function projectsReducer(state, action) {
  switch (action.type) {
    case 'INITIALIZE':
      return { ...state, projects: action.payload, loading: false };
    case 'ADD_PROJECT':
      return { ...state, projects: [action.payload, ...state.projects] };
    case 'UPDATE_PROJECT': {
      const idToUpdate = action.payload.oldId || action.payload.id;
      return {
        ...state,
        projects: state.projects.map(p => p.id === idToUpdate ? { ...p, ...action.payload, id: action.payload.id } : p)
      };
    }
    case 'DELETE_PROJECT':
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

export function ProjectsProvider({ children }) {
  const [state, dispatch] = useReducer(projectsReducer, initialState);
  const { user } = useAuth();
  const { currentProfile } = useProfile();
  const { showToast } = useToast();

  const [pendingProjectsCount, setPendingProjectsCount] = useState(0);
  const [isSyncingProjects, setIsSyncingProjects] = useState(false);
  const [isLocalFallback, setIsLocalFallback] = useState(false);

  const refreshPendingProjectsCount = useCallback(() => {
    if (user) {
      setPendingProjectsCount(getPendingProjectsQueueCount(user.id, currentProfile));
    }
  }, [user, currentProfile]);

  const syncProjectsNow = useCallback(async () => {
    if (!user || !navigator.onLine || isSyncingProjects) return;

    const count = getPendingProjectsQueueCount(user.id, currentProfile);
    if (count === 0) {
      setPendingProjectsCount(0);
      return;
    }

    setIsSyncingProjects(true);
    try {
      const result = await processProjectsSyncQueue(user.id, currentProfile, supabase);
      setPendingProjectsCount(result.pendingCount);

      if (result.processedCount > 0) {
        showToast(`✅ ${result.processedCount} projet(s) synchronisé(s) !`, 'success');
      }
    } catch (err) {
      console.warn('Projects sync queue error:', err);
    } finally {
      setIsSyncingProjects(false);
    }
  }, [user, currentProfile, isSyncingProjects, showToast]);

  // Online listener
  useEffect(() => {
    const handleOnline = () => {
      syncProjectsNow();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncProjectsNow]);

  // Save to local storage cache on update
  useEffect(() => {
    if (user && !state.loading) {
      saveLocalProjects(user.id, currentProfile, state.projects);
      refreshPendingProjectsCount();
    }
  }, [state.projects, state.loading, user, currentProfile, refreshPendingProjectsCount]);

  // Initial fetch & local cache
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    // 1. Instant loading from local cache
    const cached = loadLocalProjects(user.id, currentProfile);
    if (cached) {
      dispatch({
        type: 'INITIALIZE',
        payload: cached
      });
      refreshPendingProjectsCount();
    }

    const fetchProjects = async () => {
      if (!navigator.onLine) {
        if (!cached && isMounted) {
          dispatch({ type: 'INITIALIZE', payload: [] });
        }
        return;
      }

      try {
        if (getPendingProjectsQueueCount(user.id, currentProfile) > 0) {
          await processProjectsSyncQueue(user.id, currentProfile, supabase);
          if (isMounted) refreshPendingProjectsCount();
        }

        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .eq('profile', currentProfile)
          .order('created_at', { ascending: false });

        if (error) {
          if (isTableMissingError(error)) {
            console.info('Mode de secours actif : table projects non trouvée sur Supabase.');
            setIsLocalFallback(true);
          } else {
            console.warn('Supabase projects table query warning:', error.message);
          }
          if (!cached && isMounted) {
            dispatch({ type: 'INITIALIZE', payload: [] });
          }
          return;
        }

        setIsLocalFallback(false);
        if (!isMounted) return;

        const normalized = (data || []).map(p => ({
          ...p,
          categoryId: p.category_id,
          startDate: p.start_date,
          endDate: p.end_date,
          objectiveIds: p.objective_ids || [],
          attachments: p.attachments || []
        }));

        dispatch({ type: 'INITIALIZE', payload: normalized });
        saveLocalProjects(user.id, currentProfile, normalized);
      } catch (err) {
        console.warn('Failed to load projects from Supabase:', err);
        if (!cached && isMounted) {
          dispatch({ type: 'INITIALIZE', payload: [] });
        }
      }
    };

    fetchProjects();

    return () => {
      isMounted = false;
    };
  }, [user, currentProfile, refreshPendingProjectsCount]);

  const createProject = async (projectData) => {
    if (!user) return null;

    const newId = generateUUID();
    const newProject = {
      id: newId,
      user_id: user.id,
      profile: currentProfile,
      name: projectData.name?.trim() || 'Nouveau Projet',
      category_id: projectData.categoryId || projectData.category_id || 'autre',
      categoryId: projectData.categoryId || projectData.category_id || 'autre',
      description: projectData.description || '',
      priority: Number(projectData.priority) || 2, // 1: Haute, 2: Moyenne, 3: Basse
      status: projectData.status || '0-Non lancé',
      start_date: projectData.startDate || projectData.start_date || null,
      startDate: projectData.startDate || projectData.start_date || null,
      end_date: projectData.endDate || projectData.end_date || null,
      endDate: projectData.endDate || projectData.end_date || null,
      attachments: projectData.attachments || [],
      objective_ids: projectData.objectiveIds || projectData.objective_ids || [],
      objectiveIds: projectData.objectiveIds || projectData.objective_ids || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Optimistic UI
    dispatch({ type: 'ADD_PROJECT', payload: newProject });
    showToast('Projet créé avec succès !', 'success');

    if (!navigator.onLine || isLocalFallback) {
      enqueueProjectsSyncAction(user.id, currentProfile, 'ADD_PROJECT', newProject);
      refreshPendingProjectsCount();
      return newProject;
    }

    try {
      const { error } = await supabase.from('projects').insert({
        id: newProject.id,
        user_id: newProject.user_id,
        profile: newProject.profile,
        name: newProject.name,
        category_id: newProject.categoryId,
        description: newProject.description,
        priority: newProject.priority,
        status: newProject.status,
        start_date: newProject.startDate,
        end_date: newProject.endDate,
        attachments: newProject.attachments,
        objective_ids: newProject.objectiveIds,
        created_at: newProject.created_at,
        updated_at: newProject.updated_at
      });

      if (error) {
        if (isTableMissingError(error)) {
          setIsLocalFallback(true);
        }
        enqueueProjectsSyncAction(user.id, currentProfile, 'ADD_PROJECT', newProject);
        refreshPendingProjectsCount();
      }
    } catch (err) {
      console.warn('Network error saving project (saved locally):', err);
      enqueueProjectsSyncAction(user.id, currentProfile, 'ADD_PROJECT', newProject);
      refreshPendingProjectsCount();
    }

    return newProject;
  };

  const updateProject = async (id, updates) => {
    if (!user || !id) return null;

    const existing = state.projects.find(p => p.id === id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      categoryId: updates.categoryId || updates.category_id || existing.categoryId,
      category_id: updates.categoryId || updates.category_id || existing.category_id,
      startDate: updates.startDate !== undefined ? updates.startDate : (updates.start_date !== undefined ? updates.start_date : existing.startDate),
      start_date: updates.startDate !== undefined ? updates.startDate : (updates.start_date !== undefined ? updates.start_date : existing.start_date),
      endDate: updates.endDate !== undefined ? updates.endDate : (updates.end_date !== undefined ? updates.end_date : existing.endDate),
      end_date: updates.endDate !== undefined ? updates.endDate : (updates.end_date !== undefined ? updates.end_date : existing.end_date),
      objectiveIds: updates.objectiveIds || updates.objective_ids || existing.objectiveIds || [],
      objective_ids: updates.objectiveIds || updates.objective_ids || existing.objective_ids || [],
      updated_at: new Date().toISOString()
    };

    dispatch({ type: 'UPDATE_PROJECT', payload: updated });

    if (!navigator.onLine || isLocalFallback) {
      enqueueProjectsSyncAction(user.id, currentProfile, 'UPDATE_PROJECT', updated);
      refreshPendingProjectsCount();
      return updated;
    }

    try {
      const { error } = await supabase.from('projects').update({
        name: updated.name,
        category_id: updated.categoryId,
        description: updated.description,
        priority: Number(updated.priority) || 2,
        status: updated.status,
        start_date: updated.startDate,
        end_date: updated.endDate,
        attachments: updated.attachments,
        objective_ids: updated.objectiveIds,
        updated_at: updated.updated_at
      }).eq('id', id);

      if (error) {
        if (isTableMissingError(error)) {
          setIsLocalFallback(true);
        }
        enqueueProjectsSyncAction(user.id, currentProfile, 'UPDATE_PROJECT', updated);
        refreshPendingProjectsCount();
      }
    } catch (err) {
      console.warn('Network error updating project (saved locally):', err);
      enqueueProjectsSyncAction(user.id, currentProfile, 'UPDATE_PROJECT', updated);
      refreshPendingProjectsCount();
    }

    return updated;
  };

  const deleteProject = async (id) => {
    if (!user || !id) return;

    dispatch({ type: 'DELETE_PROJECT', payload: id });
    showToast('Projet supprimé', 'info');

    if (!navigator.onLine || isLocalFallback) {
      enqueueProjectsSyncAction(user.id, currentProfile, 'DELETE_PROJECT', { id });
      refreshPendingProjectsCount();
      return;
    }

    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) {
        if (isTableMissingError(error)) {
          setIsLocalFallback(true);
        }
        enqueueProjectsSyncAction(user.id, currentProfile, 'DELETE_PROJECT', { id });
        refreshPendingProjectsCount();
      }
    } catch (err) {
      console.warn('Network error deleting project (saved locally):', err);
      enqueueProjectsSyncAction(user.id, currentProfile, 'DELETE_PROJECT', { id });
      refreshPendingProjectsCount();
    }
  };

  const changeProjectStatus = async (id, newStatus) => {
    return updateProject(id, { status: newStatus });
  };

  return (
    <ProjectsContext.Provider
      value={{
        projects: state.projects,
        loading: state.loading,
        isSyncingProjects,
        pendingProjectsCount,
        isLocalFallback,
        syncProjectsNow,
        createProject,
        updateProject,
        deleteProject,
        changeProjectStatus,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
}
