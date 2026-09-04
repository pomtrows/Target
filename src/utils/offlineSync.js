/**
 * Offline-First Synchronization Service for Target
 * Handles local state persistence and offline action queues with automatic online sync replay.
 */

const CACHE_KEY_PREFIX = 'target_offline_state_';
const QUEUE_KEY_PREFIX = 'target_sync_queue_';

const NOTES_CACHE_KEY_PREFIX = 'target_offline_notes_';
const NOTES_QUEUE_KEY_PREFIX = 'target_notes_sync_queue_';

const SPORT_CACHE_KEY_PREFIX = 'target_offline_sport_';
const SPORT_QUEUE_KEY_PREFIX = 'target_sport_sync_queue_';

const PROJECTS_CACHE_KEY_PREFIX = 'target_offline_projects_';
const PROJECTS_QUEUE_KEY_PREFIX = 'target_projects_sync_queue_';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

/**
 * Generate a standard RFC4122 UUID v4
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get cache key for a specific user and profile
 */
const getCacheKey = (userId, profile) => `${CACHE_KEY_PREFIX}${userId}_${profile || 'perso'}`;

/**
 * Get sync queue key for a specific user and profile
 */
const getQueueKey = (userId, profile) => `${QUEUE_KEY_PREFIX}${userId}_${profile || 'perso'}`;

/**
 * Get notes cache key for a specific user and profile
 */
const getNotesCacheKey = (userId, profile) => `${NOTES_CACHE_KEY_PREFIX}${userId}_${profile || 'perso'}`;

/**
 * Get notes sync queue key for a specific user and profile
 */
const getNotesQueueKey = (userId, profile) => `${NOTES_QUEUE_KEY_PREFIX}${userId}_${profile || 'perso'}`;

/**
 * Get sport cache key for a specific user
 */
const getSportCacheKey = (userId) => `${SPORT_CACHE_KEY_PREFIX}${userId}`;

/**
 * Get sport sync queue key for a specific user
 */
const getSportQueueKey = (userId) => `${SPORT_QUEUE_KEY_PREFIX}${userId}`;

/**
 * Get projects cache key for a specific user and profile
 */
const getProjectsCacheKey = (userId, profile) => `${PROJECTS_CACHE_KEY_PREFIX}${userId}_${profile || 'perso'}`;

/**
 * Get projects sync queue key for a specific user and profile
 */
const getProjectsQueueKey = (userId, profile) => `${PROJECTS_QUEUE_KEY_PREFIX}${userId}_${profile || 'perso'}`;

/**
 * Save complete target state to local storage for instant offline loading
 */
export function saveLocalState(userId, profile, state) {
  if (!userId) return;
  try {
    const key = getCacheKey(userId, profile);
    const dataToSave = {
      objectives: state.objectives || [],
      progress: state.progress || {},
      progressTimestamps: state.progressTimestamps || {},
      categories: state.categories || [],
      rewards: state.rewards || {},
      rewardItems: state.rewardItems || [],
      rewardThresholds: state.rewardThresholds || { P1: 100, P2: 100, P3: 100 },
      contacts: state.contacts || [],
      notifications: state.notifications || [],
      cachedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(dataToSave));
  } catch (error) {
    console.warn('Failed to save local state to localStorage:', error);
  }
}

/**
 * Load target state from local storage
 */
export function loadLocalState(userId, profile) {
  if (!userId) return null;
  try {
    const key = getCacheKey(userId, profile);
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (error) {
    console.warn('Failed to load local state from localStorage:', error);
    return null;
  }
}

/**
 * Get all queued sync actions
 */
export function getSyncQueue(userId, profile) {
  if (!userId) return [];
  try {
    const key = getQueueKey(userId, profile);
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.warn('Failed to read sync queue:', error);
    return [];
  }
}

/**
 * Save sync queue
 */
function saveSyncQueue(userId, profile, queue) {
  if (!userId) return;
  try {
    const key = getQueueKey(userId, profile);
    localStorage.setItem(key, JSON.stringify(queue));
  } catch (error) {
    console.warn('Failed to save sync queue:', error);
  }
}

/**
 * Add an action to the offline sync queue
 */
export function enqueueSyncAction(userId, profile, actionType, payload) {
  if (!userId) return;
  const queue = getSyncQueue(userId, profile);
  const actionItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type: actionType,
    payload,
    timestamp: new Date().toISOString()
  };
  
  queue.push(actionItem);
  saveSyncQueue(userId, profile, queue);
  return actionItem;
}

/**
 * Count pending operations in the sync queue
 */
export function getPendingQueueCount(userId, profile) {
  return getSyncQueue(userId, profile).length;
}

/**
 * Clear the entire sync queue
 */
export function clearSyncQueue(userId, profile) {
  if (!userId) return;
  const key = getQueueKey(userId, profile);
  localStorage.removeItem(key);
}

// ================= NOTES OFFLINE CACHE & QUEUE =================

/**
 * Save notes state (folders and notes) to local cache
 */
export function saveLocalNotes(userId, profile, notesState) {
  if (!userId) return;
  try {
    const key = getNotesCacheKey(userId, profile);
    const dataToSave = {
      folders: notesState.folders || [],
      notes: notesState.notes || [],
      cachedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(dataToSave));
  } catch (error) {
    console.warn('Failed to save local notes to localStorage:', error);
  }
}

/**
 * Load notes state from local cache
 */
export function loadLocalNotes(userId, profile) {
  if (!userId) return null;
  try {
    const key = getNotesCacheKey(userId, profile);
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (error) {
    console.warn('Failed to load local notes from localStorage:', error);
    return null;
  }
}

/**
 * Get all queued notes sync actions
 */
export function getNotesSyncQueue(userId, profile) {
  if (!userId) return [];
  try {
    const key = getNotesQueueKey(userId, profile);
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.warn('Failed to read notes sync queue:', error);
    return [];
  }
}

/**
 * Save notes sync queue
 */
function saveNotesSyncQueue(userId, profile, queue) {
  if (!userId) return;
  try {
    const key = getNotesQueueKey(userId, profile);
    localStorage.setItem(key, JSON.stringify(queue));
  } catch (error) {
    console.warn('Failed to save notes sync queue:', error);
  }
}

/**
 * Add a note action to the offline sync queue
 */
export function enqueueNotesSyncAction(userId, profile, actionType, payload) {
  if (!userId) return;
  const queue = getNotesSyncQueue(userId, profile);
  const actionItem = {
    id: `sync_note_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type: actionType,
    payload,
    timestamp: new Date().toISOString()
  };
  
  queue.push(actionItem);
  saveNotesSyncQueue(userId, profile, queue);
  return actionItem;
}

/**
 * Count pending operations in the notes sync queue
 */
export function getPendingNotesQueueCount(userId, profile) {
  return getNotesSyncQueue(userId, profile).length;
}

// ================= SPORT OFFLINE CACHE & QUEUE =================

/**
 * Save sport sessions to local cache
 */
export function saveLocalSport(userId, sessions) {
  if (!userId) return;
  try {
    const key = getSportCacheKey(userId);
    const dataToSave = {
      sessions: sessions || [],
      cachedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(dataToSave));
  } catch (error) {
    console.warn('Failed to save local sport to localStorage:', error);
  }
}

/**
 * Load sport sessions from local cache
 */
export function loadLocalSport(userId) {
  if (!userId) return null;
  try {
    const key = getSportCacheKey(userId);
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (error) {
    console.warn('Failed to load local sport from localStorage:', error);
    return null;
  }
}

/**
 * Get all queued sport sync actions
 */
export function getSportSyncQueue(userId) {
  if (!userId) return [];
  try {
    const key = getSportQueueKey(userId);
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.warn('Failed to read sport sync queue:', error);
    return [];
  }
}

/**
 * Save sport sync queue
 */
function saveSportSyncQueue(userId, queue) {
  if (!userId) return;
  try {
    const key = getSportQueueKey(userId);
    localStorage.setItem(key, JSON.stringify(queue));
  } catch (error) {
    console.warn('Failed to save sport sync queue:', error);
  }
}

/**
 * Add a sport action to the offline sync queue
 */
export function enqueueSportSyncAction(userId, actionType, payload) {
  if (!userId) return;
  const queue = getSportSyncQueue(userId);
  const actionItem = {
    id: `sync_sport_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type: actionType,
    payload,
    timestamp: new Date().toISOString()
  };
  
  queue.push(actionItem);
  saveSportSyncQueue(userId, queue);
  return actionItem;
}

/**
 * Count pending operations in the sport sync queue
 */
export function getPendingSportQueueCount(userId) {
  return getSportSyncQueue(userId).length;
}

/**
 * Check if a network error represents an offline/unreachable condition
 */
export function isOfflineError(error) {
  if (!navigator.onLine) return true;
  if (!error) return false;
  
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('connection refused') ||
    msg.includes('timeout') ||
    error.status === 0 ||
    error.status === 504 ||
    error.status === 503
  );
}

/**
 * Process all pending actions in the sync queue sequentially towards Supabase
 */
export async function processSyncQueue(userId, profile, supabase) {
  if (!userId || !navigator.onLine) {
    return { success: false, processedCount: 0, pendingCount: getPendingQueueCount(userId, profile) };
  }

  const queue = getSyncQueue(userId, profile);
  if (queue.length === 0) {
    return { success: true, processedCount: 0, pendingCount: 0 };
  }

  let processedCount = 0;
  const remainingQueue = [...queue];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      let reqError = null;

      switch (item.type) {
        case 'ADD_OBJECTIVE': {
          const { error } = await supabase.from('objectives').upsert({
            id: item.payload.id,
            user_id: userId,
            profile: profile || 'perso',
            title: item.payload.title,
            target: item.payload.target,
            category_id: item.payload.categoryId,
            sport_session_id: item.payload.sportSessionId || null,
            assignments: item.payload.assignments || [],
            sub_objectives: item.payload.subObjectives || [],
            attachments: item.payload.attachments || [],
            priority: item.payload.priority || 'P3',
            created_at: item.payload.createdAt || new Date().toISOString().slice(0, 10)
          }, { onConflict: 'id' });
          reqError = error;
          break;
        }

        case 'UPDATE_OBJECTIVE': {
          const { error } = await supabase.from('objectives').update({
            title: item.payload.title,
            target: item.payload.target,
            category_id: item.payload.categoryId,
            sport_session_id: item.payload.sportSessionId || null,
            assignments: item.payload.assignments || [],
            sub_objectives: item.payload.subObjectives || [],
            attachments: item.payload.attachments || [],
            priority: item.payload.priority || 'P3'
          }).eq('id', item.payload.id);
          reqError = error;
          break;
        }

        case 'DELETE_OBJECTIVE': {
          if (item.payload.isAssigned) {
            const { error } = await supabase.from('objectives').update({
              assignment_status: 'REJECTED'
            }).eq('id', item.payload.id);
            reqError = error;
          } else {
            const { error } = await supabase.from('objectives').delete().eq('id', item.payload.id);
            reqError = error;
          }
          break;
        }

        case 'PROGRESS_UPDATE': {
          const { error } = await supabase.from('progress').upsert({
            week_id: item.payload.weekId,
            objective_id: item.payload.objectiveId,
            user_id: userId,
            value: item.payload.value,
            updated_at: item.payload.updatedAt || new Date().toISOString()
          }, { onConflict: 'week_id,objective_id' });
          reqError = error;
          break;
        }

        case 'SET_REWARD': {
          const { error } = await supabase.from('rewards').upsert({
            week_id: item.payload.weekId,
            user_id: userId,
            reward: item.payload.reward
          }, { onConflict: 'week_id' });
          reqError = error;
          break;
        }

        case 'ADD_CATEGORY': {
          const { error } = await supabase.from('categories').insert({
            id: item.payload.id,
            user_id: userId,
            profile: profile || 'perso',
            label: item.payload.label,
            icon: item.payload.icon,
            color: item.payload.color,
            auto_rollover: item.payload.auto_rollover || false
          });
          reqError = error;
          break;
        }

        case 'UPDATE_CATEGORY': {
          const { error } = await supabase.from('categories').update({
            label: item.payload.label,
            icon: item.payload.icon,
            color: item.payload.color,
            auto_rollover: item.payload.auto_rollover || false
          }).eq('id', item.payload.id);
          reqError = error;
          break;
        }

        case 'DELETE_CATEGORY': {
          await supabase.from('objectives').update({ category_id: 'autre' }).eq('category_id', item.payload.id);
          const { error } = await supabase.from('categories').delete().eq('id', item.payload.id);
          reqError = error;
          break;
        }

        case 'ADD_REWARD_ITEM': {
          const { error } = await supabase.from('reward_items').insert({
            id: item.payload.id,
            title: item.payload.title,
            status: item.payload.status || 'locked',
            assigned_week: item.payload.assigned_week || null,
            user_id: userId
          });
          reqError = error;
          break;
        }

        case 'UPDATE_REWARD_ITEM': {
          const updateData = {};
          if (item.payload.title !== undefined) updateData.title = item.payload.title;
          if (item.payload.status !== undefined) updateData.status = item.payload.status;
          if (item.payload.assigned_week !== undefined) updateData.assigned_week = item.payload.assigned_week;

          const { error } = await supabase.from('reward_items').update(updateData).eq('id', item.payload.id);
          reqError = error;
          break;
        }

        case 'DELETE_REWARD_ITEM': {
          const { error } = await supabase.from('reward_items').delete().eq('id', item.payload.id);
          reqError = error;
          break;
        }

        case 'SET_REWARD_THRESHOLDS': {
          const { error } = await supabase.from('settings').upsert({
            user_id: userId,
            profile: profile || 'perso',
            reward_thresholds: item.payload
          }, { onConflict: 'user_id,profile' });
          reqError = error;
          break;
        }

        default:
          break;
      }

      if (reqError) {
        if (isOfflineError(reqError)) {
          break;
        } else {
          console.warn(`Sync item failed permanently (${item.type}):`, reqError.message);
          remainingQueue.shift();
          saveSyncQueue(userId, profile, remainingQueue);
          processedCount++;
          continue;
        }
      }

      // Success
      remainingQueue.shift();
      saveSyncQueue(userId, profile, remainingQueue);
      processedCount++;
    } catch (err) {
      if (isOfflineError(err)) {
        break;
      }
      remainingQueue.shift();
      saveSyncQueue(userId, profile, remainingQueue);
      processedCount++;
    }
  }

  return {
    success: remainingQueue.length === 0,
    processedCount,
    pendingCount: remainingQueue.length
  };
}

/**
 * Process all pending notes actions in the sync queue sequentially towards Supabase
 */
export async function processNotesSyncQueue(userId, profile, supabase) {
  if (!userId || !navigator.onLine) {
    return { success: false, processedCount: 0, pendingCount: getPendingNotesQueueCount(userId, profile) };
  }

  const queue = getNotesSyncQueue(userId, profile);
  if (queue.length === 0) {
    return { success: true, processedCount: 0, pendingCount: 0 };
  }

  let processedCount = 0;
  const remainingQueue = [...queue];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      let reqError = null;

      switch (item.type) {
        case 'ADD_FOLDER': {
          const folderId = isValidUUID(item.payload.id) ? item.payload.id : generateUUID();
          const parentId = isValidUUID(item.payload.parent_id) ? item.payload.parent_id : null;
          const { error } = await supabase.from('folders').upsert({
            id: folderId,
            name: item.payload.name,
            parent_id: parentId,
            user_id: userId,
            profile: profile || 'perso'
          }, { onConflict: 'id' });
          reqError = error;
          break;
        }

        case 'UPDATE_FOLDER': {
          if (!isValidUUID(item.payload.id)) break;
          const parentId = isValidUUID(item.payload.parent_id) ? item.payload.parent_id : null;
          const { error } = await supabase.from('folders').update({
            name: item.payload.name,
            parent_id: parentId
          }).eq('id', item.payload.id);
          reqError = error;
          break;
        }

        case 'DELETE_FOLDER': {
          if (!isValidUUID(item.payload.id)) break;
          const { error } = await supabase.from('folders').delete().eq('id', item.payload.id);
          reqError = error;
          break;
        }

        case 'ADD_NOTE': {
          const noteId = isValidUUID(item.payload.id) ? item.payload.id : generateUUID();
          const folderId = isValidUUID(item.payload.folder_id) ? item.payload.folder_id : null;
          const { error } = await supabase.from('notes').upsert({
            id: noteId,
            title: item.payload.title,
            folder_id: folderId,
            content: item.payload.content || '',
            user_id: userId,
            profile: profile || 'perso',
            created_at: item.payload.created_at || new Date().toISOString(),
            updated_at: item.payload.updated_at || new Date().toISOString()
          }, { onConflict: 'id' });
          reqError = error;
          break;
        }

        case 'UPDATE_NOTE': {
          if (!isValidUUID(item.payload.id)) break;
          const updateData = { updated_at: new Date().toISOString() };
          if (item.payload.title !== undefined) updateData.title = item.payload.title;
          if (item.payload.content !== undefined) updateData.content = item.payload.content;
          if (item.payload.folder_id !== undefined) {
            updateData.folder_id = isValidUUID(item.payload.folder_id) ? item.payload.folder_id : null;
          }

          const { error } = await supabase.from('notes').update(updateData).eq('id', item.payload.id);
          reqError = error;
          break;
        }

        case 'DELETE_NOTE': {
          if (!isValidUUID(item.payload.id)) break;
          const { error } = await supabase.from('notes').delete().eq('id', item.payload.id);
          reqError = error;
          break;
        }

        default:
          break;
      }

      if (reqError) {
        if (isOfflineError(reqError)) {
          break;
        } else {
          console.warn(`Notes sync item failed permanently (${item.type}):`, reqError.message);
          remainingQueue.shift();
          saveNotesSyncQueue(userId, profile, remainingQueue);
          processedCount++;
          continue;
        }
      }

      // Success
      remainingQueue.shift();
      saveNotesSyncQueue(userId, profile, remainingQueue);
      processedCount++;
    } catch (err) {
      if (isOfflineError(err)) {
        break;
      }
      remainingQueue.shift();
      saveNotesSyncQueue(userId, profile, remainingQueue);
      processedCount++;
    }
  }

  return {
    success: remainingQueue.length === 0,
    processedCount,
    pendingCount: remainingQueue.length
  };
}

/**
 * Process all pending sport actions in the sync queue sequentially towards Supabase
 */
export async function processSportSyncQueue(userId, supabase) {
  if (!userId || !navigator.onLine) {
    return { success: false, processedCount: 0, pendingCount: getPendingSportQueueCount(userId) };
  }

  const queue = getSportSyncQueue(userId);
  if (queue.length === 0) {
    return { success: true, processedCount: 0, pendingCount: 0 };
  }

  let processedCount = 0;
  const remainingQueue = [...queue];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      let reqError = null;

      switch (item.type) {
        case 'ADD_SPORT_SESSION': {
          const sportId = isValidUUID(item.payload.id) ? item.payload.id : generateUUID();
          const { error } = await supabase.from('sport_sessions').upsert({
            id: sportId,
            user_id: userId,
            name: item.payload.name,
            exercises: item.payload.exercises || [],
            total_time: item.payload.totalTime || 0,
            created_at: item.payload.createdAt || new Date().toISOString(),
            updated_at: item.payload.updatedAt || new Date().toISOString()
          }, { onConflict: 'id' });
          reqError = error;
          break;
        }

        case 'UPDATE_SPORT_SESSION': {
          if (!isValidUUID(item.payload.id)) break;
          const { error } = await supabase.from('sport_sessions').update({
            name: item.payload.name,
            exercises: item.payload.exercises || [],
            total_time: item.payload.totalTime || 0,
            updated_at: new Date().toISOString()
          }).eq('id', item.payload.id);
          reqError = error;
          break;
        }

        case 'DELETE_SPORT_SESSION': {
          if (!isValidUUID(item.payload.id)) break;
          const { error } = await supabase.from('sport_sessions').delete().eq('id', item.payload.id);
          reqError = error;
          break;
        }

        default:
          break;
      }

      if (reqError) {
        if (isOfflineError(reqError)) {
          break;
        } else {
          console.warn(`Sport sync item failed permanently (${item.type}):`, reqError.message);
          remainingQueue.shift();
          saveSportSyncQueue(userId, remainingQueue);
          processedCount++;
          continue;
        }
      }

      // Success
      remainingQueue.shift();
      saveSportSyncQueue(userId, remainingQueue);
      processedCount++;
    } catch (err) {
      if (isOfflineError(err)) {
        break;
      }
      remainingQueue.shift();
      saveSportSyncQueue(userId, remainingQueue);
      processedCount++;
    }
  }

  return {
    success: remainingQueue.length === 0,
    processedCount,
    pendingCount: remainingQueue.length
  };
}

// ================= PROJECTS OFFLINE CACHE & QUEUE =================

/**
 * Save projects to local cache
 */
export function saveLocalProjects(userId, profile, projects) {
  if (!userId) return;
  try {
    const key = getProjectsCacheKey(userId, profile);
    const dataToSave = {
      projects: projects || [],
      cachedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(dataToSave));
  } catch (error) {
    console.warn('Failed to save local projects cache:', error);
  }
}

/**
 * Load projects from local cache
 */
export function loadLocalProjects(userId, profile) {
  if (!userId) return null;
  try {
    const key = getProjectsCacheKey(userId, profile);
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : (parsed.projects || []);
  } catch (error) {
    console.warn('Failed to load local projects cache:', error);
    return null;
  }
}

/**
 * Get projects sync queue
 */
export function getProjectsSyncQueue(userId, profile) {
  if (!userId) return [];
  try {
    const key = getProjectsQueueKey(userId, profile);
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.warn('Failed to read projects sync queue:', error);
    return [];
  }
}

/**
 * Save projects sync queue
 */
function saveProjectsSyncQueue(userId, profile, queue) {
  if (!userId) return;
  try {
    const key = getProjectsQueueKey(userId, profile);
    localStorage.setItem(key, JSON.stringify(queue));
  } catch (error) {
    console.warn('Failed to save projects sync queue:', error);
  }
}

/**
 * Enqueue a project action
 */
export function enqueueProjectsSyncAction(userId, profile, actionType, payload) {
  if (!userId) return;
  const queue = getProjectsSyncQueue(userId, profile);
  const actionItem = {
    id: `sync_proj_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    type: actionType,
    payload,
    timestamp: new Date().toISOString()
  };
  queue.push(actionItem);
  saveProjectsSyncQueue(userId, profile, queue);
  return actionItem;
}

/**
 * Count pending projects sync operations
 */
export function getPendingProjectsQueueCount(userId, profile) {
  return getProjectsSyncQueue(userId, profile).length;
}

/**
 * Clear projects sync queue
 */
export function clearProjectsSyncQueue(userId, profile) {
  if (!userId) return;
  const key = getProjectsQueueKey(userId, profile);
  localStorage.removeItem(key);
}

/**
 * Process projects sync queue
 */
export async function processProjectsSyncQueue(userId, profile, supabase) {
  if (!userId || !navigator.onLine) {
    return { success: false, processedCount: 0, pendingCount: getPendingProjectsQueueCount(userId, profile) };
  }

  const queue = getProjectsSyncQueue(userId, profile);
  if (queue.length === 0) {
    return { success: true, processedCount: 0, pendingCount: 0 };
  }

  let processedCount = 0;
  const remainingQueue = [...queue];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      let reqError = null;

      switch (item.type) {
        case 'ADD_PROJECT': {
          const projId = isValidUUID(item.payload.id) ? item.payload.id : generateUUID();
          const { error } = await supabase.from('projects').upsert({
            id: projId,
            user_id: userId,
            profile: profile || 'perso',
            name: item.payload.name,
            category_id: item.payload.category_id || item.payload.categoryId || 'autre',
            description: item.payload.description || '',
            priority: Number(item.payload.priority) || 2,
            status: item.payload.status || '0-Non lancé',
            start_date: item.payload.start_date || item.payload.startDate || null,
            end_date: item.payload.end_date || item.payload.endDate || null,
            attachments: item.payload.attachments || [],
            objective_ids: item.payload.objective_ids || item.payload.objectiveIds || [],
            created_at: item.payload.created_at || item.payload.createdAt || new Date().toISOString(),
            updated_at: item.payload.updated_at || item.payload.updatedAt || new Date().toISOString()
          }, { onConflict: 'id' });
          reqError = error;
          break;
        }

        case 'UPDATE_PROJECT': {
          if (!isValidUUID(item.payload.id)) break;
          const { error } = await supabase.from('projects').update({
            name: item.payload.name,
            category_id: item.payload.category_id || item.payload.categoryId,
            description: item.payload.description,
            priority: Number(item.payload.priority) || 2,
            status: item.payload.status,
            start_date: item.payload.start_date || item.payload.startDate || null,
            end_date: item.payload.end_date || item.payload.endDate || null,
            attachments: item.payload.attachments || [],
            objective_ids: item.payload.objective_ids || item.payload.objectiveIds || [],
            updated_at: new Date().toISOString()
          }).eq('id', item.payload.id);
          reqError = error;
          break;
        }

        case 'DELETE_PROJECT': {
          if (!isValidUUID(item.payload.id)) break;
          const { error } = await supabase.from('projects').delete().eq('id', item.payload.id);
          reqError = error;
          break;
        }

        default:
          break;
      }

      if (reqError) {
        if (isOfflineError(reqError)) {
          break;
        } else {
          console.warn(`Project sync item failed permanently (${item.type}):`, reqError.message);
          remainingQueue.shift();
          saveProjectsSyncQueue(userId, profile, remainingQueue);
          processedCount++;
          continue;
        }
      }

      remainingQueue.shift();
      saveProjectsSyncQueue(userId, profile, remainingQueue);
      processedCount++;
    } catch (err) {
      if (isOfflineError(err)) {
        break;
      }
      remainingQueue.shift();
      saveProjectsSyncQueue(userId, profile, remainingQueue);
      processedCount++;
    }
  }

  return {
    success: remainingQueue.length === 0,
    processedCount,
    pendingCount: remainingQueue.length
  };
}
