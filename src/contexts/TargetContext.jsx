import { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const TargetContext = createContext(null);

// ===== Default Categories =====
const defaultCategories = [
  { id: 'sport', label: 'Sport', icon: '🏃', color: '#22d3ee' },
  { id: 'alimentation', label: 'Alimentation', icon: '🥗', color: '#4ade80' },
  { id: 'social', label: 'Social', icon: '👥', color: '#a78bfa' },
  { id: 'geek', label: 'Geek', icon: '🎮', color: '#f472b6' },
  { id: 'administratif', label: 'Administratif', icon: '📋', color: '#fb923c' },
  { id: 'achat', label: 'Achat', icon: '🛒', color: '#fbbf24' },
  { id: 'autre', label: 'Autre', icon: '📌', color: '#94a3b8' },
];

// ===== Initial State =====
const initialState = {
  objectives: [],
  progress: {}, 
  categories: defaultCategories,
  rewards: {}, 
  loading: true,
};

// ===== Reducer =====
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

    // ----- Objectives -----
    case 'ADD_OBJECTIVE': {
      const { user_id, title, target, categoryId, assignments } = action.payload;
      const newObj = {
        id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title,
        target: target || 1,
        categoryId: categoryId || 'autre',
        assignments: assignments || [],
        createdAt: new Date().toISOString().slice(0, 10),
      };
      
      // Sync to Supabase
      supabase.from('objectives').insert({
        id: newObj.id,
        user_id,
        title: newObj.title,
        target: newObj.target,
        category_id: newObj.categoryId,
        assignments: newObj.assignments,
        created_at: newObj.createdAt
      }).then();

      return { ...state, objectives: [...state.objectives, newObj] };
    }

    case 'UPDATE_OBJECTIVE': {
      const updated = action.payload;
      // Sync to Supabase
      supabase.from('objectives').update({
        title: updated.title,
        target: updated.target,
        category_id: updated.categoryId,
        assignments: updated.assignments
      }).eq('id', updated.id).then();

      return {
        ...state,
        objectives: state.objectives.map((obj) =>
          obj.id === updated.id ? { ...obj, ...updated } : obj
        ),
      };
    }

    case 'DELETE_OBJECTIVE': {
      supabase.from('objectives').delete().eq('id', action.payload).then();
      
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

    // ----- Progress -----
    case 'INCREMENT_PROGRESS':
    case 'DECREMENT_PROGRESS':
    case 'TOGGLE_PROGRESS': {
      let { weekId, objectiveId, user_id } = action.payload;
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

      // Sync to Supabase
      supabase.from('progress').upsert({
        week_id: weekId,
        objective_id: objectiveId,
        user_id,
        value: current
      }, { onConflict: 'week_id,objective_id' }).then();

      return {
        ...state,
        progress: {
          ...state.progress,
          [weekId]: {
            ...weekProgress,
            [objectiveId]: current,
          },
        },
      };
    }

    // ----- Rewards -----
    case 'SET_REWARD': {
      const { weekId, reward, user_id } = action.payload;
      // Sync to Supabase
      supabase.from('rewards').upsert({
        week_id: weekId,
        user_id,
        reward: reward
      }, { onConflict: 'week_id' }).then();

      return {
        ...state,
        rewards: {
          ...state.rewards,
          [weekId]: reward,
        },
      };
    }

    // ----- Categories -----
    case 'ADD_CATEGORY': {
      const { user_id, label, icon, color } = action.payload;
      const newCat = {
        id: `cat-${Date.now()}`,
        label, icon, color
      };
      // Sync to Supabase
      supabase.from('categories').insert({
        id: newCat.id,
        user_id,
        label: newCat.label,
        icon: newCat.icon,
        color: newCat.color
      }).then();

      return { ...state, categories: [...state.categories, newCat] };
    }

    case 'UPDATE_CATEGORY': {
      const updated = action.payload;
      supabase.from('categories').update({
        label: updated.label,
        icon: updated.icon,
        color: updated.color
      }).eq('id', updated.id).then();

      return {
        ...state,
        categories: state.categories.map((cat) =>
          cat.id === updated.id ? { ...cat, ...updated } : cat
        ),
      };
    }

    case 'DELETE_CATEGORY': {
      const hasObjectives = state.objectives.some(
        (obj) => obj.categoryId === action.payload
      );
      if (hasObjectives) return state;
      
      supabase.from('categories').delete().eq('id', action.payload).then();

      return {
        ...state,
        categories: state.categories.filter((cat) => cat.id !== action.payload),
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

  // Fetch from Supabase on mount or when user changes
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
          { data: rewards }
        ] = await Promise.all([
          supabase.from('categories').select('*').eq('user_id', user.id),
          supabase.from('objectives').select('*').eq('user_id', user.id),
          supabase.from('progress').select('*').eq('user_id', user.id),
          supabase.from('rewards').select('*').eq('user_id', user.id)
        ]);

        const transformedProgress = (progress || []).reduce((acc, p) => {
          if (!acc[p.week_id]) acc[p.week_id] = {};
          acc[p.week_id][p.objective_id] = p.value;
          return acc;
        }, {});

        const transformedRewards = (rewards || []).reduce((acc, r) => {
          acc[r.week_id] = r.reward;
          return acc;
        }, {});

        const transformedObjectives = (objectives || []).map(o => ({
          ...o,
          categoryId: o.category_id,
          createdAt: o.created_at
        }));

        dispatch({
          type: 'INITIALIZE',
          payload: {
            categories: categories && categories.length > 0 ? categories : defaultCategories,
            objectives: transformedObjectives,
            progress: transformedProgress,
            rewards: transformedRewards,
          }
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
        dispatch({ type: 'INITIALIZE', payload: {} });
      }
    };

    fetchData();
  }, [user]);

  // Wrapper for dispatch to automatically inject user_id
  const userDispatch = (action) => {
    if (user) {
      dispatch({ 
        ...action, 
        payload: { ...action.payload, user_id: user.id } 
      });
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
