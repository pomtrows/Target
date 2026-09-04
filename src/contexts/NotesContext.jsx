import { createContext, useContext, useEffect, useState, useReducer, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useProfile } from './ProfileContext';
import { useToast } from './ToastContext';
import {
  saveLocalNotes,
  loadLocalNotes,
  enqueueNotesSyncAction,
  processNotesSyncQueue,
  getPendingNotesQueueCount,
  generateUUID,
  isOfflineError
} from '../utils/offlineSync';

const NotesContext = createContext(null);

const initialState = {
  folders: [],
  notes: [],
  loading: true,
};

function notesReducer(state, action) {
  switch (action.type) {
    case 'INITIALIZE':
      return { ...state, ...action.payload, loading: false };
    case 'ADD_FOLDER':
      return { ...state, folders: [...state.folders, action.payload] };
    case 'UPDATE_FOLDER':
      const folderIdToUpdate = action.payload.oldId || action.payload.id;
      return {
        ...state,
        folders: state.folders.map(f => f.id === folderIdToUpdate ? { ...f, ...action.payload, id: action.payload.id } : f)
      };
    case 'DELETE_FOLDER': {
      const getAllDescendantIds = (folderId, allFolders) => {
        const children = allFolders.filter(f => f.parent_id === folderId);
        return children.reduce(
          (acc, child) => [...acc, child.id, ...getAllDescendantIds(child.id, allFolders)],
          []
        );
      };
      const deletedId = action.payload;
      const descendantIds = getAllDescendantIds(deletedId, state.folders);
      const allDeletedIds = new Set([deletedId, ...descendantIds]);
      return {
        ...state,
        folders: state.folders.filter(f => !allDeletedIds.has(f.id)),
        notes: state.notes.filter(n => !allDeletedIds.has(n.folder_id))
      };
    }
    case 'ADD_NOTE':
      return { ...state, notes: [...state.notes, action.payload] };
    case 'UPDATE_NOTE':
      const noteIdToUpdate = action.payload.oldId || action.payload.id;
      return {
        ...state,
        notes: state.notes.map(n => n.id === noteIdToUpdate ? { ...n, ...action.payload, id: action.payload.id } : n)
      };
    case 'DELETE_NOTE':
      return { ...state, notes: state.notes.filter(n => n.id !== action.payload) };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

export function NotesProvider({ children }) {
  const [state, dispatch] = useReducer(notesReducer, initialState);
  const { user } = useAuth();
  const { currentProfile } = useProfile();
  const { showToast } = useToast();

  const [pendingNotesCount, setPendingNotesCount] = useState(0);
  const [isSyncingNotes, setIsSyncingNotes] = useState(false);

  const refreshPendingNotesCount = useCallback(() => {
    if (user) {
      setPendingNotesCount(getPendingNotesQueueCount(user.id, currentProfile));
    }
  }, [user, currentProfile]);

  const syncNotesNow = useCallback(async () => {
    if (!user || !navigator.onLine || isSyncingNotes) return;

    const count = getPendingNotesQueueCount(user.id, currentProfile);
    if (count === 0) {
      setPendingNotesCount(0);
      return;
    }

    setIsSyncingNotes(true);
    try {
      const result = await processNotesSyncQueue(user.id, currentProfile, supabase);
      setPendingNotesCount(result.pendingCount);

      if (result.processedCount > 0) {
        showToast(`✅ ${result.processedCount} note(s) synchronisée(s) !`, 'success');
      }
    } catch (err) {
      console.warn('Notes sync queue error:', err);
    } finally {
      setIsSyncingNotes(false);
    }
  }, [user, currentProfile, isSyncingNotes, showToast]);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => {
      syncNotesNow();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncNotesNow]);

  // Save notes state to local cache whenever it updates
  useEffect(() => {
    if (user && !state.loading) {
      saveLocalNotes(user.id, currentProfile, state);
      refreshPendingNotesCount();
    }
  }, [state, user, currentProfile, refreshPendingNotesCount]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    // 1. Instant loading from local cache
    const cached = loadLocalNotes(user.id, currentProfile);
    if (cached) {
      dispatch({
        type: 'INITIALIZE',
        payload: { folders: cached.folders || [], notes: cached.notes || [] }
      });
      refreshPendingNotesCount();
    }

    const fetchData = async () => {
      if (!navigator.onLine) {
        if (!cached && isMounted) {
          dispatch({ type: 'INITIALIZE', payload: { folders: [], notes: [] } });
        }
        return;
      }

      try {
        // Sync pending notes queue before fetching
        if (getPendingNotesQueueCount(user.id, currentProfile) > 0) {
          await processNotesSyncQueue(user.id, currentProfile, supabase);
          if (isMounted) refreshPendingNotesCount();
        }

        const [{ data: allFolders }, { data: allNotes }] = await Promise.all([
          supabase.from('folders').select('*').order('name'),
          supabase.from('notes').select('*').order('updated_at', { ascending: false })
        ]);

        if (!isMounted) return;

        // On garde nos propres dossiers/notes (filtrés par profile) ET les dossiers/notes partagés (ceux où user_id !== user.id)
        const folders = (allFolders || []).filter(f => (f.user_id === user.id && f.profile === currentProfile) || f.user_id !== user.id);
        const notes = (allNotes || []).filter(n => (n.user_id === user.id && n.profile === currentProfile) || n.user_id !== user.id);

        const payload = { folders: folders || [], notes: notes || [] };
        dispatch({
          type: 'INITIALIZE',
          payload
        });

        saveLocalNotes(user.id, currentProfile, payload);
      } catch (error) {
        console.warn('Error fetching notes from server (using local cache):', error);
        if (isMounted && !cached) {
          dispatch({ type: 'INITIALIZE', payload: { folders: [], notes: [] } });
        }
      }
    };

    fetchData();

    // Real-time subscriptions
    const folderChannel = supabase
      .channel('folders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folders', filter: `user_id=eq.${user.id}` }, 
        () => fetchData())
      .subscribe();

    const noteChannel = supabase
      .channel('notes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` }, 
        () => fetchData())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(folderChannel);
      supabase.removeChannel(noteChannel);
    };
  }, [user, currentProfile, refreshPendingNotesCount]);

  const createFolder = async (name, parentId = null) => {
    const folderId = generateUUID();
    const newFolder = { id: folderId, name, parent_id: parentId, user_id: user.id, created_at: new Date().toISOString() };
    dispatch({ type: 'ADD_FOLDER', payload: newFolder });

    if (!navigator.onLine) {
      enqueueNotesSyncAction(user.id, currentProfile, 'ADD_FOLDER', newFolder);
      refreshPendingNotesCount();
      return newFolder;
    }

    try {
      const { data, error } = await supabase
        .from('folders')
        .insert({ id: folderId, name, parent_id: parentId, user_id: user.id, profile: currentProfile })
        .select()
        .single();
      if (error) throw error;
      
      return data;
    } catch (error) {
      if (isOfflineError(error)) {
        enqueueNotesSyncAction(user.id, currentProfile, 'ADD_FOLDER', newFolder);
        refreshPendingNotesCount();
        return newFolder;
      } else {
        dispatch({ type: 'DELETE_FOLDER', payload: folderId });
        showToast(`Erreur création dossier : ${error.message}`, 'error');
        throw error;
      }
    }
  };

  const createNote = async (title, folderId = null, content = '') => {
    const noteId = generateUUID();
    const newNote = { 
      id: noteId, 
      title, 
      folder_id: folderId, 
      user_id: user.id, 
      content: content || '', 
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    dispatch({ type: 'ADD_NOTE', payload: newNote });

    if (!navigator.onLine) {
      enqueueNotesSyncAction(user.id, currentProfile, 'ADD_NOTE', newNote);
      refreshPendingNotesCount();
      return newNote;
    }

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({ 
          id: noteId, 
          title, 
          folder_id: folderId, 
          user_id: user.id, 
          profile: currentProfile,
          content: content || ''
        })
        .select()
        .single();
      if (error) throw error;
      
      return data;
    } catch (error) {
      if (isOfflineError(error)) {
        enqueueNotesSyncAction(user.id, currentProfile, 'ADD_NOTE', newNote);
        refreshPendingNotesCount();
        return newNote;
      } else {
        dispatch({ type: 'DELETE_NOTE', payload: noteId });
        showToast(`Erreur création note : ${error.message}`, 'error');
        throw error;
      }
    }
  };

  const updateFolder = async (id, updates) => {
    dispatch({ type: 'UPDATE_FOLDER', payload: { id, ...updates } });

    if (!navigator.onLine) {
      enqueueNotesSyncAction(user.id, currentProfile, 'UPDATE_FOLDER', { id, ...updates });
      refreshPendingNotesCount();
      return { id, ...updates };
    }

    try {
      const { data, error } = await supabase
        .from('folders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      if (isOfflineError(error)) {
        enqueueNotesSyncAction(user.id, currentProfile, 'UPDATE_FOLDER', { id, ...updates });
        refreshPendingNotesCount();
      } else {
        console.error('Error updating folder:', error);
        showToast('Erreur de modification du dossier', 'error');
      }
    }
  };

  const deleteFolder = async (id) => {
    dispatch({ type: 'DELETE_FOLDER', payload: id });

    if (!navigator.onLine) {
      enqueueNotesSyncAction(user.id, currentProfile, 'DELETE_FOLDER', { id });
      refreshPendingNotesCount();
      return;
    }

    try {
      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      if (isOfflineError(error)) {
        enqueueNotesSyncAction(user.id, currentProfile, 'DELETE_FOLDER', { id });
        refreshPendingNotesCount();
      } else {
        console.error('Error deleting folder:', error);
        showToast('Erreur de suppression du dossier', 'error');
      }
    }
  };

  const updateNote = async (id, updates) => {
    dispatch({ type: 'UPDATE_NOTE', payload: { id, ...updates, updated_at: new Date().toISOString() } });
    
    if (!navigator.onLine) {
      enqueueNotesSyncAction(user.id, currentProfile, 'UPDATE_NOTE', { id, ...updates });
      refreshPendingNotesCount();
      return { id, ...updates };
    }

    try {
      const { data, error } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      dispatch({ type: 'UPDATE_NOTE', payload: data });
      return data;
    } catch (error) {
      if (isOfflineError(error)) {
        enqueueNotesSyncAction(user.id, currentProfile, 'UPDATE_NOTE', { id, ...updates });
        refreshPendingNotesCount();
      } else {
        console.error('Error updating note:', error);
        showToast('Erreur d\'enregistrement de la note', 'error');
      }
    }
  };

  const deleteNote = async (id) => {
    dispatch({ type: 'DELETE_NOTE', payload: id });

    if (!navigator.onLine) {
      enqueueNotesSyncAction(user.id, currentProfile, 'DELETE_NOTE', { id });
      refreshPendingNotesCount();
      return;
    }

    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      if (isOfflineError(error)) {
        enqueueNotesSyncAction(user.id, currentProfile, 'DELETE_NOTE', { id });
        refreshPendingNotesCount();
      } else {
        console.error('Error deleting note:', error);
        showToast('Erreur de suppression de la note', 'error');
      }
    }
  };

  return (
    <NotesContext.Provider value={{ 
      state, 
      createFolder, 
      updateFolder, 
      deleteFolder, 
      createNote, 
      updateNote, 
      deleteNote,
      pendingNotesCount,
      isSyncingNotes,
      syncNotesNow
    }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) throw new Error('useNotes must be used within a NotesProvider');
  return context;
}
