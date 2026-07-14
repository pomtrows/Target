import { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useProfile } from './ProfileContext';
import { toggleBit } from '../utils/progressUtils';

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
  progressTimestamps: {}, // New: Stores "weekId-objId" -> ISO timestamp
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

    default:
      return state;
  }
}

// ===== Provider =====
export function TargetProvider({ children }) {
  const [state, dispatch] = useReducer(targetReducer, initialState);
  const { user } = useAuth();
  const { currentProfile } = useProfile();

  // Fetch from Supabase on mount, when user changes, or when profile changes
  useEffect(() => {
    if (!user) {
      dispatch({ type: 'RESET' });
      return;
    }

    const fetchData = async () => {
      try {
        const [
          { data: categories },
          { data: objectives },
          { data: progress },
          { data: rewards },
          { data: rewardItems }
        ] = await Promise.all([
          supabase.from('categories').select('*').eq('user_id', user.id).eq('profile', currentProfile),
          supabase.from('objectives').select('*').eq('user_id', user.id).eq('profile', currentProfile),
          supabase.from('progress').select('*').eq('user_id', user.id), // Fetch all progress, objectives are filtered
          supabase.from('rewards').select('*').eq('user_id', user.id),
          supabase.from('reward_items').select('*').eq('user_id', user.id)
        ]);

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
          createdAt: o.created_at
        }));

        let fetchedCategories = categories && categories.length > 0 ? categories : (currentProfile === 'pro' ? [] : defaultCategories);
        const savedOrder = JSON.parse(localStorage.getItem(`target_categories_order_${user.id}_${currentProfile}`)) || {};
        fetchedCategories.sort((a, b) => {
          const orderA = a.order_index !== undefined && a.order_index !== null ? a.order_index : (savedOrder[a.id] !== undefined ? savedOrder[a.id] : 999);
          const orderB = b.order_index !== undefined && b.order_index !== null ? b.order_index : (savedOrder[b.id] !== undefined ? savedOrder[b.id] : 999);
          return orderA - orderB;
        });

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
      } catch (error) {
        console.error('Error fetching user data:', error);
        dispatch({ type: 'INITIALIZE', payload: {} });
      }
    };

    fetchData();
  }, [user, currentProfile]);

  // Wrapper for dispatch to handle async side effects and local updates
  const userDispatch = async (action) => {
    if (!user) return;

    switch (action.type) {
      case 'ADD_OBJECTIVE': {
        const newObj = {
          id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: action.payload.title,
          target: action.payload.target || 1,
          categoryId: action.payload.categoryId || 'autre',
          sportSessionId: action.payload.sportSessionId || null,
          assignments: action.payload.assignments || [],
          subObjectives: action.payload.subObjectives || [],
          attachments: action.payload.attachments || [],
          createdAt: new Date().toISOString().slice(0, 10),
          user_id: user.id
        };
        
        // Optimistic update
        dispatch({ type: 'ADD_OBJECTIVE', payload: { objective: newObj } });
        
        // DB sync
        await supabase.from('objectives').insert({
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
          created_at: newObj.createdAt
        });
        break;
      }

      case 'UPDATE_OBJECTIVE': {
        const updated = { ...action.payload };
        dispatch({ type: 'UPDATE_OBJECTIVE', payload: updated });
        await supabase.from('objectives').update({
          title: updated.title,
          target: updated.target,
          category_id: updated.categoryId,
          sport_session_id: updated.sportSessionId || null,
          assignments: updated.assignments,
          sub_objectives: updated.subObjectives || [],
          attachments: updated.attachments || []
        }).eq('id', updated.id);
        break;
      }

      case 'DELETE_OBJECTIVE': {
        dispatch({ type: 'DELETE_OBJECTIVE', payload: action.payload });
        await supabase.from('objectives').delete().eq('id', action.payload);
        break;
      }

      case 'INCREMENT_PROGRESS':
      case 'DECREMENT_PROGRESS':
      case 'TOGGLE_PROGRESS': {
        const { weekId, objectiveId } = action.payload;
        const weekProgress = state.progress[weekId] || {};
        let current = weekProgress[objectiveId] || 0;
        
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
        await supabase.from('progress').upsert({
          week_id: weekId,
          objective_id: objectiveId,
          user_id: user.id,
          value: current,
          updated_at: new Date().toISOString()
        }, { onConflict: 'week_id,objective_id' });
        break;
      }
      
      case 'TOGGLE_SUB_OBJECTIVE': {
        const { weekId, objectiveId, subIndex } = action.payload;
        const weekProgress = state.progress[weekId] || {};
        const current = weekProgress[objectiveId] || 0;
        const nextValue = toggleBit(current, subIndex);

        dispatch({ type: 'TOGGLE_SUB_OBJECTIVE', payload: { weekId, objectiveId, value: nextValue } });
        await supabase.from('progress').upsert({
          week_id: weekId,
          objective_id: objectiveId,
          user_id: user.id,
          value: nextValue,
          updated_at: new Date().toISOString()
        }, { onConflict: 'week_id,objective_id' });
        break;
      }

      case 'SET_REWARD': {
        const { weekId, reward } = action.payload;
        dispatch({ type: 'SET_REWARD', payload: action.payload });
        await supabase.from('rewards').upsert({
          week_id: weekId,
          user_id: user.id,
          reward: reward
        }, { onConflict: 'week_id' });
        break;
      }

      case 'ADD_CATEGORY': {
        const newCat = {
          id: `cat-${Date.now()}`,
          ...action.payload,
          user_id: user.id
        };
        dispatch({ type: 'ADD_CATEGORY', payload: { category: newCat } });
        await supabase.from('categories').insert({
          id: newCat.id,
          user_id: user.id,
          profile: currentProfile,
          label: newCat.label,
          icon: newCat.icon,
          color: newCat.color
        });
        break;
      }

      case 'UPDATE_CATEGORY': {
        const updated = action.payload;
        dispatch({ type: 'UPDATE_CATEGORY', payload: updated });
        await supabase.from('categories').update({
          label: updated.label,
          icon: updated.icon,
          color: updated.color
        }).eq('id', updated.id);
        break;
      }

      case 'REORDER_CATEGORIES': {
        const newCategories = action.payload;
        dispatch({ type: 'REORDER_CATEGORIES', payload: newCategories });
        
        const orderMap = {};
        newCategories.forEach((cat, index) => {
          orderMap[cat.id] = index;
        });
        localStorage.setItem(`target_categories_order_${user.id}`, JSON.stringify(orderMap));

        for (let i = 0; i < newCategories.length; i++) {
          const cat = newCategories[i];
          const { error } = await supabase.from('categories').update({ order_index: i }).eq('id', cat.id);
          if (error) {
            console.warn(`Supabase order_index update error for ${cat.id}:`, error.message);
          }
        }
        break;
      }

      case 'DELETE_CATEGORY': {
        const catId = action.payload;
        if (catId === 'autre') return; // Protect default category

        // 1. Update objectives in Supabase
        await supabase
          .from('objectives')
          .update({ category_id: 'autre' })
          .eq('category_id', catId);

        // 2. Delete category in Supabase
        await supabase.from('categories').delete().eq('id', catId);

        // 3. Update local state
        dispatch({ type: 'DELETE_CATEGORY', payload: catId });
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
        await supabase.from('reward_items').insert(newItem);
        break;
      }

      case 'UPDATE_REWARD_ITEM': {
        const updated = action.payload;
        dispatch({ type: 'UPDATE_REWARD_ITEM', payload: updated });
        
        const updateData = {};
        if (updated.title !== undefined) updateData.title = updated.title;
        if (updated.status !== undefined) updateData.status = updated.status;
        if (updated.assigned_week !== undefined) {
          updateData.assigned_week = updated.assigned_week;
        }

        await supabase.from('reward_items').update(updateData).eq('id', updated.id);
        break;
      }

      case 'DELETE_REWARD_ITEM': {
        const itemId = action.payload;
        dispatch({ type: 'DELETE_REWARD_ITEM', payload: itemId });
        await supabase.from('reward_items').delete().eq('id', itemId);
        break;
      }

      default:
        dispatch(action);
    }
  };

  return (
    <TargetContext.Provider value={{ state, dispatch: userDispatch }}>
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
