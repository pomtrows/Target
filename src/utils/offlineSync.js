/**
 * Offline-First Synchronization Service for Target
 * Handles local state persistence and offline action queues with automatic online sync replay.
 */

const CACHE_KEY_PREFIX = 'target_offline_state_';
const QUEUE_KEY_PREFIX = 'target_sync_queue_';

/**
 * Get cache key for a specific user and profile
 */
const getCacheKey = (userId, profile) => `${CACHE_KEY_PREFIX}${userId}_${profile || 'perso'}`;

/**
 * Get sync queue key for a specific user and profile
 */
const getQueueKey = (userId, profile) => `${QUEUE_KEY_PREFIX}${userId}_${profile || 'perso'}`;

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
          const { error } = await supabase.from('objectives').delete().eq('id', item.payload.id);
          reqError = error;
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
          // Break loop and retry later if network failed during queue replay
          break;
        } else {
          console.warn(`Sync item failed permanently (${item.type}):`, reqError.message);
          // Remove problematic item to avoid blocking the queue
          remainingQueue.shift();
          saveSyncQueue(userId, profile, remainingQueue);
          processedCount++;
          continue;
        }
      }

      // Success: Remove item from remaining queue
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
