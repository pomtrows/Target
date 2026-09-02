import { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useProfile } from './ProfileContext';
import { useToast } from './ToastContext';
import { toggleBit, getObjectiveProgress } from '../utils/progressUtils';
import { getCurrentWeekId } from '../utils/weekUtils';
import {
  saveLocalState,
  loadLocalState,
  enqueueSyncAction,
  processSyncQueue,
  getPendingQueueCount,
  isOfflineError
} from '../utils/offlineSync';

const TargetContext = createContext(null);

// ===== Default Categories =====
const defaultCategories = [
  { id: 'alimentation', label: 'Alimentation', icon: '🥗', color: '#22c55e' },
  { id: 'sport', label: 'Sport', icon: '🏃', color: '#0891b2' },
  { id: 'kids', label: 'Kids', icon: '🧘', color: '#0ea5e9' },
  { id: 'administratif', label: 'Administratifs', icon: '📋', color: '#4f46e5' },
  { id: 'vacances', label: 'Vacances', icon: '✈️', color: '#ef4444' },
  { id: 'maison', label: 'Maison', icon: '🏠', color: '#991b1b' },
  { id: 'shopping', label: 'Shopping', icon: '🛒', color: '#ea580c' },
  { id: 'culture', label: 'Culture', icon: '🏛️', color: '#0284c7' },
  { id: 'autre', label: 'Autre', icon: '📌', color: '#94a3b8' },
];

// ===== Initial State =====
const initialState = {
  objectives: [],
  progress: {}, 
  categories: defaultCategories,
  rewards: {}, 
  rewardItems: [],
  progressTimestamps: {},
  rewardThresholds: { P1: 100, P2: 100, P3: 100 },
  contacts: [],
  notifications: [],
  profiles: {},
  loading: true,
};

// ===== Reducer (PURE) =====
function targetReducer(state, action) {
  switch (action.type) {
    case 'INITIALIZE':
      return {
        ...state,
        ...action.payload,
        loading: false,
      };

    case 'RESET':
      return initialState;

    case 'ADD_OBJECTIVE':
      return { ...state, objectives: [...state.objectives, action.payload.objective] };

    case 'UPDATE_OBJECTIVE':
      return {
        ...state,
        objectives: state.objectives.map((obj) =>
          obj.id === action.payload.id ? { ...obj, ...action.payload } : obj
        ),
      };

    case 'DELETE_OBJECTIVE': {
      const newProgress = { ...state.progress };
      for (const weekId in newProgress) {
        if (newProgress[weekId][action.payload]) {
          const weekProg = { ...newProgress[weekId] };
          delete weekProg[action.payload];
          newProgress[weekId] = weekProg;
        }
      }
      return {
        ...state,
        objectives: state.objectives.filter((obj) => obj.id !== action.payload),
        progress: newProgress,
      };
    }

    case 'INCREMENT_PROGRESS':
    case 'DECREMENT_PROGRESS':
    case 'TOGGLE_PROGRESS': {
      const { weekId, objectiveId, value } = action.payload;
      const weekProgress = state.progress[weekId] || {};

      return {
        ...state,
        progress: {
          ...state.progress,
          [weekId]: {
            ...weekProgress,
            [objectiveId]: value,
          },
        },
        progressTimestamps: {
          ...state.progressTimestamps,
          [`${weekId}-${objectiveId}`]: new Date().toISOString()
        }
      };
    }

    case 'SET_REWARD': {
      const { weekId, reward } = action.payload;
      return {
        ...state,
        rewards: {
          ...state.rewards,
          [weekId]: reward,
        },
      };
    }

    case 'ADD_REWARD_ITEM':
      return { ...state, rewardItems: [...state.rewardItems, action.payload] };

    case 'UPDATE_REWARD_ITEM':
      return {
        ...state,
        rewardItems: state.rewardItems.map((item) =>
          item.id === action.payload.id ? { ...item, ...action.payload } : item
        ),
      };

    case 'DELETE_REWARD_ITEM':
      return {
        ...state,
        rewardItems: state.rewardItems.filter((item) => item.id !== action.payload),
      };

    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, action.payload.category] };

    case 'UPDATE_CATEGORY':
      return {
        ...state,
        categories: state.categories.map((cat) =>
          cat.id === action.payload.id ? { ...cat, ...action.payload } : cat
        ),
      };

    case 'REORDER_CATEGORIES':
      return { ...state, categories: action.payload };

    case 'DELETE_CATEGORY':
      return {
        ...state,
        categories: state.categories.filter((cat) => cat.id !== action.payload),
        objectives: state.objectives.map((obj) =>
          obj.categoryId === action.payload ? { ...obj, categoryId: 'autre' } : obj
        ),
      };

    case 'TOGGLE_SUB_OBJECTIVE': {
      const { weekId, objectiveId, value } = action.payload;
      return {
        ...state,
        progress: {
          ...state.progress,
          [weekId]: {
            ...(state.progress[weekId] || {}),
            [objectiveId]: value,
          },
        },
        progressTimestamps: {
          ...state.progressTimestamps,
          [`${weekId}-${objectiveId}`]: new Date().toISOString()
        }
      };
    }

    case 'SET_REWARD_THRESHOLDS': {
      return {
        ...state,
        rewardThresholds: action.payload
      };
    }

    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.payload] };

    case 'UPDATE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      };

    case 'DELETE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.filter((c) => c.id !== action.payload),
      };

    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications] };

    case 'UPDATE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.payload.id ? { ...n, ...action.payload } : n
        ),
      };

    case 'SET_PROFILES':
      return { ...state, profiles: action.payload };

    case 'UPDATE_PROFILE':
      return {
        ...state,
        profiles: { ...state.profiles, [action.payload.id]: action.payload },
      };

    default:
      return state;
  }
}

// ===== Provider =====
export function TargetProvider({ children }) {
  const [state, dispatch] = useReducer(targetReducer, initialState);
  const { user } = useAuth();
  const { currentProfile } = useProfile();
  const { showToast } = useToast();

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Update pending queue count
  const refreshPendingCount = useCallback(() => {
    if (user) {
      setPendingSyncCount(getPendingQueueCount(user.id, currentProfile));
    }
  }, [user, currentProfile]);

  // Sync offline queue to Supabase
  const syncNow = useCallback(async () => {
    if (!user || !navigator.onLine || isSyncing) return;

    const count = getPendingQueueCount(user.id, currentProfile);
    if (count === 0) {
      setPendingSyncCount(0);
      return;
    }

    setIsSyncing(true);
    try {
      const result = await processSyncQueue(user.id, currentProfile, supabase);
      setPendingSyncCount(result.pendingCount);

      if (result.processedCount > 0) {
        showToast(`✅ ${result.processedCount} modification(s) synchronisée(s) avec succès !`, 'success');
      }
    } catch (err) {
      console.warn('Sync queue error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [user, currentProfile, isSyncing, showToast]);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Connexion rétablie. Synchronisation...', 'info', 2500);
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('Mode hors-ligne activé. Vos modifications seront enregistrées localement.', 'info', 4000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncNow, showToast]);

  // Save state to local cache whenever it updates
  useEffect(() => {
    if (user && !state.loading) {
      saveLocalState(user.id, currentProfile, state);
      refreshPendingCount();
    }
  }, [state, user, currentProfile, refreshPendingCount]);

  // Fetch from Supabase on mount, when user changes, or when profile changes
  useEffect(() => {
    if (!user) {
      dispatch({ type: 'RESET' });
      return;
    }

    let isMounted = true;

    // 1. Instant loading from local cache
    const cached = loadLocalState(user.id, currentProfile);
    if (cached) {
      dispatch({
        type: 'INITIALIZE',
        payload: {
          categories: cached.categories || defaultCategories,
          objectives: cached.objectives || [],
          progress: cached.progress || {},
          progressTimestamps: cached.progressTimestamps || {},
          rewards: cached.rewards || {},
          rewardItems: cached.rewardItems || [],
          rewardThresholds: cached.rewardThresholds || { P1: 100, P2: 100, P3: 100 },
          contacts: cached.contacts || [],
          notifications: cached.notifications || []
        }
      });
      refreshPendingCount();
    }

    const fetchData = async () => {
      if (!navigator.onLine) {
        if (!cached && isMounted) {
          dispatch({ type: 'INITIALIZE', payload: {} });
        }
        return;
      }

      try {
        // First sync any pending offline actions before fetching
        if (getPendingQueueCount(user.id, currentProfile) > 0) {
          await processSyncQueue(user.id, currentProfile, supabase);
          if (isMounted) refreshPendingCount();
        }

        // D'abord on récupère les objectifs
        const { data: objectives, error: objErr } = await supabase.from('objectives').select('*').or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`).eq('profile', currentProfile);
        
        const objectiveIds = (objectives || []).map(o => o.id).join(',');
        const progressQuery = objectiveIds.length > 0 
          ? `user_id.eq.${user.id},objective_id.in.(${objectiveIds})` 
          : `user_id.eq.${user.id}`;

        const [
          { data: categories, error: catErr },
          { data: progress, error: progErr },
          { data: rewards, error: rewErr },
          { data: rewardItems, error: rewItemErr },
          { data: settingsData, error: setErr },
          { data: contacts, error: contactsErr },
          { data: notifications, error: notifErr },
          profilesRes
        ] = await Promise.all([
          supabase.from('categories').select('*').eq('user_id', user.id).eq('profile', currentProfile),
          supabase.from('progress').select('*').or(progressQuery),
          supabase.from('rewards').select('*').eq('user_id', user.id),
          supabase.from('reward_items').select('*').eq('user_id', user.id),
          supabase.from('settings').select('*').eq('user_id', user.id).eq('profile', currentProfile).maybeSingle(),
          supabase.from('contacts').select('*').or(`user_id.eq.${user.id},contact_user_id.eq.${user.id},contact_email.ilike.${user.email}`),
          supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('profiles').select('*').then(r => r).catch(err => ({ data: [], error: err }))
        ]);

        const profilesMap = (profilesRes?.data || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});

        // Auto-upsert current user profile if available
        const currentDisplayName = user.user_metadata?.display_name || localStorage.getItem('target-user-display-name') || '';
        if (user.email) {
          try {
            supabase.from('profiles').upsert({
              id: user.id,
              email: user.email,
              display_name: currentDisplayName,
              updated_at: new Date().toISOString()
            }).then(() => {});
          } catch {}
        }

        // Auto-link contacts that have an email matching a profile if contact_user_id is missing
        (contacts || []).forEach(c => {
          if (!c.contact_user_id && (c.contact_email || c.contact_name?.includes('@'))) {
            const targetEmail = (c.contact_email || c.contact_name).toLowerCase().trim();
            const matchedProfile = Object.values(profilesMap).find(p => p.email && p.email.toLowerCase() === targetEmail);
            if (matchedProfile) {
              c.contact_user_id = matchedProfile.id;
              if (!c.contact_email) c.contact_email = matchedProfile.email;
              supabase.from('contacts').update({ 
                contact_user_id: matchedProfile.id,
                contact_email: matchedProfile.email 
              }).eq('id', c.id).then(() => {});
            }
          }
        });

        if (catErr) console.warn('Categories query notice:', catErr.message);
        if (objErr) console.warn('Objectives query notice:', objErr.message);

        const transformedProgress = (progress || []).reduce((acc, p) => {
          if (!acc[p.week_id]) acc[p.week_id] = {};
          acc[p.week_id][p.objective_id] = p.value;
          return acc;
        }, {});

        const transformedTimestamps = (progress || []).reduce((acc, p) => {
          acc[`${p.week_id}-${p.objective_id}`] = p.updated_at || p.created_at || null;
          return acc;
        }, {});

        const transformedRewards = (rewards || []).reduce((acc, r) => {
          acc[r.week_id] = r.reward;
          return acc;
        }, {});

        const transformedObjectives = (objectives || []).map(o => ({
          ...o,
          categoryId: o.category_id,
          sportSessionId: o.sport_session_id || null,
          subObjectives: o.sub_objectives || [],
          attachments: o.attachments || [],
          priority: o.priority || 'P3',
          createdAt: o.created_at
        }));

        let fetchedCategories = categories && categories.length > 0 ? categories : (currentProfile === 'pro' ? [] : defaultCategories);
        const savedOrder = JSON.parse(localStorage.getItem(`target_categories_order_${user.id}_${currentProfile}`)) || {};
        fetchedCategories.sort((a, b) => {
          const orderA = a.order_index !== undefined && a.order_index !== null ? a.order_index : (savedOrder[a.id] !== undefined ? savedOrder[a.id] : 999);
          const orderB = b.order_index !== undefined && b.order_index !== null ? b.order_index : (savedOrder[b.id] !== undefined ? savedOrder[b.id] : 999);
          return orderA - orderB;
        });

        let savedThresholds = { P1: 100, P2: 100, P3: 100 };
        if (settingsData && settingsData.reward_thresholds) {
          savedThresholds = settingsData.reward_thresholds;
        } else {
          savedThresholds = JSON.parse(localStorage.getItem(`target_reward_thresholds_${user.id}_${currentProfile}`)) || { P1: 100, P2: 100, P3: 100 };
        }

        if (!isMounted) return;

        const finalPayload = {
          categories: fetchedCategories,
          objectives: transformedObjectives,
          progress: transformedProgress,
          progressTimestamps: transformedTimestamps,
          rewards: transformedRewards,
          rewardItems: rewardItems || [],
          rewardThresholds: savedThresholds,
          contacts: contacts || [],
          notifications: notifications || [],
          profiles: profilesMap
        };

        dispatch({
          type: 'INITIALIZE',
          payload: finalPayload
        });

        saveLocalState(user.id, currentProfile, finalPayload);

        // Auto-Rollover logic
        const currentWeekId = getCurrentWeekId();
        let objectivesUpdated = false;
        
        const autoRolloverCategories = new Set(
          fetchedCategories.filter(cat => cat.auto_rollover).map(cat => cat.id)
        );

        for (const obj of transformedObjectives) {
          if (!autoRolloverCategories.has(obj.categoryId) || !obj.assignments || obj.assignments.length === 0) continue;
          
          const weekAssignments = obj.assignments.filter(a => typeof a === 'string' && a.match(/^\d{4}-S\d{2}$/)).sort();
          if (weekAssignments.length === 0) continue;
          
          const latestAssignedWeek = weekAssignments[weekAssignments.length - 1];
          
          if (latestAssignedWeek < currentWeekId) {
            const prog = getObjectiveProgress(obj, transformedProgress[latestAssignedWeek] || {});
            
            if (prog < 1 && !obj.assignments.includes(currentWeekId)) {
              obj.assignments.push(currentWeekId);
              objectivesUpdated = true;
              
              supabase.from('objectives').update({ assignments: obj.assignments }).eq('id', obj.id).then(({ error }) => {
                if (error) console.error('Error rolling over objective:', error);
              });
            }
          }
        }

        if (objectivesUpdated && isMounted) {
          dispatch({
            type: 'INITIALIZE',
            payload: {
              categories: fetchedCategories,
              objectives: transformedObjectives,
              progress: transformedProgress,
              progressTimestamps: transformedTimestamps,
              rewards: transformedRewards,
              rewardItems: rewardItems || [],
            }
          });
        }
      } catch (error) {
        console.warn('Error fetching user data from server (using local cache):', error);
        if (isMounted && !cached) {
          dispatch({ type: 'INITIALIZE', payload: {} });
        }
      }
    };

    fetchData();

    // Real-time subscriptions for multi-device sync
    const objChannel = supabase
      .channel('objectives-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'objectives' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'progress' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.new && payload.new.user_id === user.id && !payload.new.read) {
          showToast(payload.new.message, 'info');
        }
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(objChannel);
    };
  }, [user, currentProfile, refreshPendingCount]);

  // Wrapper for dispatch to handle async side effects, offline queuing, rollback and user feedback
  const userDispatch = async (action) => {
    if (!user) return;
    const myName = user.user_metadata?.display_name || localStorage.getItem('target-user-display-name') || user.email;

    switch (action.type) {
      case 'TRIGGER_ROLLOVER': {
        const currentWeekId = getCurrentWeekId();
        let objectivesUpdated = false;
        const newObjectives = [...state.objectives];
        
        const autoRolloverCategories = new Set(
          state.categories.filter(cat => cat.auto_rollover).map(cat => cat.id)
        );

        for (let i = 0; i < newObjectives.length; i++) {
          const obj = newObjectives[i];
          if (!autoRolloverCategories.has(obj.categoryId) || !obj.assignments || obj.assignments.length === 0) continue;
          
          const weekAssignments = obj.assignments.filter(a => typeof a === 'string' && a.match(/^\d{4}-S\d{2}$/)).sort();
          if (weekAssignments.length === 0) continue;
          
          const latestAssignedWeek = weekAssignments[weekAssignments.length - 1];
          
          if (latestAssignedWeek < currentWeekId) {
            const prog = getObjectiveProgress(obj, state.progress[latestAssignedWeek] || {});
            
            if (prog < 1 && !obj.assignments.includes(currentWeekId)) {
              const newAssignments = [...obj.assignments, currentWeekId];
              newObjectives[i] = { ...obj, assignments: newAssignments };
              objectivesUpdated = true;
              
              if (navigator.onLine) {
                supabase.from('objectives').update({ assignments: newAssignments }).eq('id', obj.id).then(({ error }) => {
                  if (error) console.error('Error rolling over objective:', error);
                });
              } else {
                enqueueSyncAction(user.id, currentProfile, 'UPDATE_OBJECTIVE', { id: obj.id, assignments: newAssignments });
              }
            }
          }
        }

        if (objectivesUpdated) {
          dispatch({ type: 'INITIALIZE', payload: { ...state, objectives: newObjectives } });
        }
        break;
      }

      case 'ADD_OBJECTIVE': {
        let objId = action.payload.id;
        if (!objId || state.objectives.some(o => o.id === objId)) {
          objId = `obj-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        }
        const newObj = {
          id: objId,
          title: action.payload.title,
          target: action.payload.target || 1,
          categoryId: action.payload.categoryId || 'autre',
          sportSessionId: action.payload.sportSessionId || null,
          assignments: action.payload.assignments || [],
          subObjectives: action.payload.subObjectives || [],
          attachments: action.payload.attachments || [],
          priority: action.payload.priority || 'P3',
          createdAt: new Date().toISOString().slice(0, 10),
          user_id: user.id,
          assigned_to: action.payload.assigned_to || null,
          assignment_status: action.payload.assignment_status || null
        };
        
        // Optimistic local update
        dispatch({ type: 'ADD_OBJECTIVE', payload: { objective: newObj } });
        
        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'ADD_OBJECTIVE', newObj);
          refreshPendingCount();
          showToast('Objectif enregistré hors-ligne. Synchronisation dès reconnexion.', 'info', 3000);
          return;
        }

        // Online DB sync
        try {
          const { error } = await supabase.from('objectives').insert({
            id: newObj.id,
            user_id: user.id,
            profile: currentProfile,
            title: newObj.title,
            target: newObj.target,
            category_id: newObj.categoryId,
            sport_session_id: newObj.sportSessionId,
            assignments: newObj.assignments,
            sub_objectives: newObj.subObjectives,
            attachments: newObj.attachments,
            priority: newObj.priority,
            created_at: newObj.createdAt,
            assigned_to: action.payload.assigned_to || null,
            assignment_status: action.payload.assignment_status || null
          });
          if (error) throw error;

          if (action.payload.assigned_to && action.payload.assigned_to !== user.id) {
            try {
              const { error: notifErr } = await supabase.from('notifications').insert({
                user_id: action.payload.assigned_to,
                type: 'TASK_ASSIGNED',
                message: `${myName} vous a assigné un nouvel objectif : ${newObj.title}`
              });
              if (notifErr) {
                console.error('Erreur Supabase notification TASK_ASSIGNED:', notifErr);
              }
            } catch (notifErr) {
              console.error('Exception notification TASK_ASSIGNED:', notifErr);
            }
          }
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'ADD_OBJECTIVE', newObj);
            refreshPendingCount();
            showToast('Connexion perdue : objectif enregistré hors-ligne.', 'info', 3000);
          } else {
            console.error('Error adding objective:', error);
            dispatch({ type: 'DELETE_OBJECTIVE', payload: newObj.id });
            showToast(`Erreur d'enregistrement : ${error.message || 'Échec de la synchronisation'}`, 'error');
          }
        }
        break;
      }

      case 'UPDATE_OBJECTIVE': {
        const updated = { ...action.payload };
        const previousObj = state.objectives.find(o => o.id === updated.id);
        dispatch({ type: 'UPDATE_OBJECTIVE', payload: updated });

        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'UPDATE_OBJECTIVE', updated);
          refreshPendingCount();
          return;
        }

        try {
          const { error } = await supabase.from('objectives').update({
            title: updated.title,
            target: updated.target,
            category_id: updated.categoryId,
            sport_session_id: updated.sportSessionId || null,
            assignments: updated.assignments,
            sub_objectives: updated.subObjectives || [],
            attachments: updated.attachments || [],
            priority: updated.priority || 'P3',
            ...(updated.assigned_to !== undefined && { assigned_to: updated.assigned_to }),
            ...(updated.assignment_status !== undefined && { assignment_status: updated.assignment_status })
          }).eq('id', updated.id);
          if (error) throw error;
          
          if (updated.assigned_to && previousObj?.assigned_to !== updated.assigned_to && updated.assigned_to !== user.id) {
            try {
              const { error: notifErr } = await supabase.from('notifications').insert({
                user_id: updated.assigned_to,
                type: 'TASK_ASSIGNED',
                message: `${myName} vous a assigné un objectif : ${updated.title}`
              });
              if (notifErr) {
                console.error('Erreur Supabase notification TASK_ASSIGNED on update:', notifErr);
              }
            } catch (notifErr) {
              console.error('Exception notification TASK_ASSIGNED on update:', notifErr);
            }
          }

          if (updated.assignment_status === 'REJECTED' && (previousObj?.assignment_status !== 'REJECTED' || updated.rejectReason)) {
            const assignerId = updated.user_id || previousObj?.user_id;
            if (assignerId && assignerId !== user.id) {
              const reasonText = updated.rejectReason ? ` Motif : ${updated.rejectReason}` : '';
              try {
                await supabase.from('notifications').insert({
                  user_id: assignerId,
                  type: 'TASK_REJECTED',
                  message: `${myName} a refusé votre objectif : ${updated.title}.${reasonText}`
                });
              } catch (nErr) {
                console.warn('Error inserting rejection notification:', nErr);
              }
            }
          } else if (updated.assignment_status === 'ACCEPTED' && previousObj?.assignment_status !== 'ACCEPTED') {
            const assignerId = updated.user_id || previousObj?.user_id;
            if (assignerId && assignerId !== user.id) {
              try {
                await supabase.from('notifications').insert({
                  user_id: assignerId,
                  type: 'TASK_ACCEPTED',
                  message: `${myName} a accepté votre objectif : ${updated.title}`
                });
              } catch (nErr) {
                console.warn('Error inserting acceptance notification:', nErr);
              }
            }
          }
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'UPDATE_OBJECTIVE', updated);
            refreshPendingCount();
          } else {
            console.error('Error updating objective:', error);
            if (previousObj) {
              dispatch({ type: 'UPDATE_OBJECTIVE', payload: previousObj });
            }
            showToast(`Erreur de modification : ${error.message || 'Échec'}`, 'error');
          }
        }
        break;
      }

      case 'DELETE_OBJECTIVE': {
        const previousObj = state.objectives.find(o => o.id === action.payload);
        dispatch({ type: 'DELETE_OBJECTIVE', payload: action.payload });

        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'DELETE_OBJECTIVE', { id: action.payload });
          refreshPendingCount();
          return;
        }

        try {
          const { error } = await supabase.from('objectives').delete().eq('id', action.payload);
          if (error) throw error;
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'DELETE_OBJECTIVE', { id: action.payload });
            refreshPendingCount();
          } else {
            console.error('Error deleting objective:', error);
            if (previousObj) {
              dispatch({ type: 'ADD_OBJECTIVE', payload: { objective: previousObj } });
            }
            showToast(`Erreur de suppression : ${error.message || 'Échec'}`, 'error');
          }
        }
        break;
      }

      case 'INCREMENT_PROGRESS':
      case 'DECREMENT_PROGRESS':
      case 'TOGGLE_PROGRESS': {
        const { weekId, objectiveId } = action.payload;
        const weekProgress = state.progress[weekId] || {};
        const previousValue = weekProgress[objectiveId] || 0;
        let current = previousValue;
        
        if (action.type === 'INCREMENT_PROGRESS') {
          const objective = state.objectives.find((o) => o.id === objectiveId);
          const max = objective?.target || 1;
          if (current < max) current++;
        } else if (action.type === 'DECREMENT_PROGRESS') {
          if (current > 0) current--;
        } else {
          current = current >= 1 ? 0 : 1;
        }

        dispatch({ type: action.type, payload: { ...action.payload, value: current } });

        const progressPayload = {
          weekId,
          objectiveId,
          value: current,
          updatedAt: new Date().toISOString()
        };

        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'PROGRESS_UPDATE', progressPayload);
          refreshPendingCount();
          return;
        }

        try {
          const { error } = await supabase.from('progress').upsert({
            week_id: weekId,
            objective_id: objectiveId,
            user_id: user.id,
            value: current,
            updated_at: progressPayload.updatedAt
          }, { onConflict: 'week_id,objective_id' });
          if (error) throw error;
          
          // Notification si la tâche est complétée et que c'est une tâche assignée
          const objective = state.objectives.find((o) => o.id === objectiveId);
          const max = objective?.target || 1;
          if (current >= max && previousValue < max && objective && objective.assigned_to === user.id && objective.user_id !== user.id) {
            try {
              await supabase.from('notifications').insert({
                user_id: objective.user_id, // Prévenir le créateur
                type: 'TASK_COMPLETED',
                message: `${myName} a accompli votre objectif : ${objective.title}`
              });
            } catch (nErr) {
              console.warn('Error inserting task completed notification:', nErr);
            }
          }
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'PROGRESS_UPDATE', progressPayload);
            refreshPendingCount();
          } else {
            console.error('Error updating progress:', error);
            dispatch({ type: action.type, payload: { ...action.payload, value: previousValue } });
            showToast('Erreur d\'enregistrement de la progression', 'error');
          }
        }
        break;
      }
      
      case 'TOGGLE_SUB_OBJECTIVE': {
        const { weekId, objectiveId, subIndex } = action.payload;
        const weekProgress = state.progress[weekId] || {};
        const current = weekProgress[objectiveId] || 0;
        const nextValue = toggleBit(current, subIndex);

        dispatch({ type: 'TOGGLE_SUB_OBJECTIVE', payload: { weekId, objectiveId, value: nextValue } });

        const progressPayload = {
          weekId,
          objectiveId,
          value: nextValue,
          updatedAt: new Date().toISOString()
        };

        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'PROGRESS_UPDATE', progressPayload);
          refreshPendingCount();
          return;
        }

        try {
          const { error } = await supabase.from('progress').upsert({
            week_id: weekId,
            objective_id: objectiveId,
            user_id: user.id,
            value: nextValue,
            updated_at: progressPayload.updatedAt
          }, { onConflict: 'week_id,objective_id' });
          if (error) throw error;
          
          const objective = state.objectives.find((o) => o.id === objectiveId);
          if (objective) {
            const prevProgress = getObjectiveProgress(objective, { [objectiveId]: current });
            const nextProgress = getObjectiveProgress(objective, { [objectiveId]: nextValue });
            
            if (nextProgress >= 1 && prevProgress < 1 && objective.assigned_to === user.id && objective.user_id !== user.id) {
              try {
                await supabase.from('notifications').insert({
                  user_id: objective.user_id,
                  type: 'TASK_COMPLETED',
                  message: `${myName} a accompli votre objectif : ${objective.title}`
                });
              } catch (nErr) {
                console.warn('Error inserting sub-task completed notification:', nErr);
              }
            }
          }
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'PROGRESS_UPDATE', progressPayload);
            refreshPendingCount();
          } else {
            console.error('Error toggling sub objective:', error);
            dispatch({ type: 'TOGGLE_SUB_OBJECTIVE', payload: { weekId, objectiveId, value: current } });
            showToast('Erreur de mise à jour des sous-tâches', 'error');
          }
        }
        break;
      }

      case 'SET_REWARD': {
        const { weekId, reward } = action.payload;
        dispatch({ type: 'SET_REWARD', payload: action.payload });

        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'SET_REWARD', { weekId, reward });
          refreshPendingCount();
          return;
        }

        try {
          const { error } = await supabase.from('rewards').upsert({
            week_id: weekId,
            user_id: user.id,
            reward: reward
          }, { onConflict: 'week_id' });
          if (error) throw error;
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'SET_REWARD', { weekId, reward });
            refreshPendingCount();
          } else {
            console.error('Error setting reward:', error);
            showToast('Erreur d\'enregistrement de la récompense', 'error');
          }
        }
        break;
      }

      case 'ADD_CATEGORY': {
        const newCat = {
          id: `cat-${Date.now()}`,
          ...action.payload,
          user_id: user.id
        };
        dispatch({ type: 'ADD_CATEGORY', payload: { category: newCat } });

        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'ADD_CATEGORY', newCat);
          refreshPendingCount();
          return;
        }

        try {
          const { error } = await supabase.from('categories').insert({
            id: newCat.id,
            user_id: user.id,
            profile: currentProfile,
            label: newCat.label,
            icon: newCat.icon,
            color: newCat.color,
            auto_rollover: newCat.auto_rollover || false
          });
          if (error) throw error;
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'ADD_CATEGORY', newCat);
            refreshPendingCount();
          } else {
            console.error('Error adding category:', error);
            dispatch({ type: 'DELETE_CATEGORY', payload: newCat.id });
            showToast(`Erreur d'ajout de la catégorie : ${error.message}`, 'error');
          }
        }
        break;
      }

      case 'UPDATE_CATEGORY': {
        const updated = action.payload;
        const previousCat = state.categories.find(c => c.id === updated.id);
        dispatch({ type: 'UPDATE_CATEGORY', payload: updated });

        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'UPDATE_CATEGORY', updated);
          refreshPendingCount();
          return;
        }

        try {
          const { error } = await supabase.from('categories').update({
            label: updated.label,
            icon: updated.icon,
            color: updated.color,
            auto_rollover: updated.auto_rollover || false
          }).eq('id', updated.id);
          if (error) throw error;
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'UPDATE_CATEGORY', updated);
            refreshPendingCount();
          } else {
            console.error('Error updating category:', error);
            if (previousCat) dispatch({ type: 'UPDATE_CATEGORY', payload: previousCat });
            showToast(`Erreur de mise à jour de la catégorie : ${error.message}`, 'error');
          }
        }
        break;
      }

      case 'REORDER_CATEGORIES': {
        const newCategories = action.payload;
        dispatch({ type: 'REORDER_CATEGORIES', payload: newCategories });
        
        const orderMap = {};
        newCategories.forEach((cat, index) => {
          orderMap[cat.id] = index;
        });
        localStorage.setItem(`target_categories_order_${user.id}_${currentProfile}`, JSON.stringify(orderMap));

        if (navigator.onLine) {
          for (let i = 0; i < newCategories.length; i++) {
            const cat = newCategories[i];
            supabase.from('categories').update({ order_index: i }).eq('id', cat.id).then(({ error }) => {
              if (error) console.error('Error updating category order:', error);
            });
          }
        }
        break;
      }

      case 'DELETE_CATEGORY': {
        const catId = action.payload;
        if (catId === 'autre') return; // Protect default category

        const previousCat = state.categories.find(c => c.id === catId);
        dispatch({ type: 'DELETE_CATEGORY', payload: catId });

        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'DELETE_CATEGORY', { id: catId });
          refreshPendingCount();
          return;
        }

        try {
          await supabase.from('objectives').update({ category_id: 'autre' }).eq('category_id', catId);
          const { error } = await supabase.from('categories').delete().eq('id', catId);
          if (error) throw error;
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'DELETE_CATEGORY', { id: catId });
            refreshPendingCount();
          } else {
            console.error('Error deleting category:', error);
            if (previousCat) dispatch({ type: 'ADD_CATEGORY', payload: { category: previousCat } });
            showToast(`Erreur de suppression de la catégorie : ${error.message}`, 'error');
          }
        }
        break;
      }

      case 'ADD_REWARD_ITEM': {
        const newItem = {
          id: action.payload.id || crypto.randomUUID(),
          title: action.payload.title,
          status: action.payload.status || 'locked',
          assigned_week: action.payload.assigned_week || null,
          user_id: user.id
        };
        dispatch({ type: 'ADD_REWARD_ITEM', payload: newItem });

        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'ADD_REWARD_ITEM', newItem);
          refreshPendingCount();
          return;
        }

        try {
          const { error } = await supabase.from('reward_items').insert(newItem);
          if (error) throw error;
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'ADD_REWARD_ITEM', newItem);
            refreshPendingCount();
          } else {
            console.error('Error adding reward item:', error);
            dispatch({ type: 'DELETE_REWARD_ITEM', payload: newItem.id });
            showToast('Erreur d\'ajout de la récompense', 'error');
          }
        }
        break;
      }

      case 'UPDATE_REWARD_ITEM': {
        const updated = action.payload;
        const previousItem = state.rewardItems.find(r => r.id === updated.id);
        dispatch({ type: 'UPDATE_REWARD_ITEM', payload: updated });

        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'UPDATE_REWARD_ITEM', updated);
          refreshPendingCount();
          return;
        }

        const updateData = {};
        if (updated.title !== undefined) updateData.title = updated.title;
        if (updated.status !== undefined) updateData.status = updated.status;
        if (updated.assigned_week !== undefined) updateData.assigned_week = updated.assigned_week;

        try {
          const { error } = await supabase.from('reward_items').update(updateData).eq('id', updated.id);
          if (error) throw error;
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'UPDATE_REWARD_ITEM', updated);
            refreshPendingCount();
          } else {
            console.error('Error updating reward item:', error);
            if (previousItem) dispatch({ type: 'UPDATE_REWARD_ITEM', payload: previousItem });
            showToast('Erreur de mise à jour de la récompense', 'error');
          }
        }
        break;
      }

      case 'DELETE_REWARD_ITEM': {
        const itemId = action.payload;
        const previousItem = state.rewardItems.find(r => r.id === itemId);
        dispatch({ type: 'DELETE_REWARD_ITEM', payload: itemId });

        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'DELETE_REWARD_ITEM', { id: itemId });
          refreshPendingCount();
          return;
        }

        try {
          const { error } = await supabase.from('reward_items').delete().eq('id', itemId);
          if (error) throw error;
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'DELETE_REWARD_ITEM', { id: itemId });
            refreshPendingCount();
          } else {
            console.error('Error deleting reward item:', error);
            if (previousItem) dispatch({ type: 'ADD_REWARD_ITEM', payload: previousItem });
            showToast('Erreur de suppression de la récompense', 'error');
          }
        }
        break;
      }

      case 'SET_REWARD_THRESHOLDS': {
        dispatch({ type: 'SET_REWARD_THRESHOLDS', payload: action.payload });

        if (!navigator.onLine) {
          enqueueSyncAction(user.id, currentProfile, 'SET_REWARD_THRESHOLDS', action.payload);
          refreshPendingCount();
          return;
        }

        try {
          const { error } = await supabase.from('settings').upsert({
            user_id: user.id,
            profile: currentProfile,
            reward_thresholds: action.payload
          }, { onConflict: 'user_id,profile' });

          if (error) throw error;
        } catch (error) {
          if (isOfflineError(error)) {
            enqueueSyncAction(user.id, currentProfile, 'SET_REWARD_THRESHOLDS', action.payload);
            refreshPendingCount();
          } else {
            console.error("Error saving thresholds to Supabase:", error);
            showToast('Erreur de sauvegarde des seuils', 'error');
          }
        }
        break;
      }

      default:
        dispatch(action);
    }
  };

  return (
    <TargetContext.Provider value={{ 
      state, 
      dispatch: userDispatch,
      isOnline,
      isSyncing,
      pendingSyncCount,
      syncNow
    }}>
      {state.loading ? (
        <div className="fixed inset-0 bg-dark-900 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin"></div>
            <p className="text-dark-400 font-medium animate-pulse">Chargement de vos objectifs...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </TargetContext.Provider>
  );
}

// ===== Hook =====
export function useTarget() {
  const context = useContext(TargetContext);
  if (!context) {
    throw new Error('useTarget must be used within a TargetProvider');
  }
  return context;
}

export default TargetContext;
