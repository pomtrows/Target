import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { GOAL_TYPES } from '../data/exercisesCatalog';

const SportContext = createContext(null);

// Règle de gestion — Calcul du temps total de la séance :
// Temps Total = ∑(Durée des exos à temps) + ∑(Temps de récupération) + [∑(Exos à réps) × 3 secondes]
export const calculateTotalTime = (exercises) => {
  if (!exercises || exercises.length === 0) return 0;
  
  let totalTimeSeconds = 0;
  exercises.forEach(ex => {
    if (ex.goalType === GOAL_TYPES.TIME) {
      totalTimeSeconds += (ex.targetValue || 0);
    } else if (ex.goalType === GOAL_TYPES.REPS) {
      totalTimeSeconds += (ex.targetValue || 0) * 3; // 3 seconds per rep
    }
    totalTimeSeconds += (ex.restTime || 0);
  });
  
  return totalTimeSeconds;
};

export function SportProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const fetchSessions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('sport_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setSessions(data.map(session => ({
          id: session.id,
          name: session.name,
          exercises: session.exercises,
          totalTime: session.total_time,
          createdAt: session.created_at,
          updatedAt: session.updated_at
        })));
      } else if (error) {
        console.error("Error fetching sport sessions:", error);
      }
      setLoading(false);
    };

    fetchSessions();

    const channel = supabase
      .channel('sport_sessions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sport_sessions', filter: `user_id=eq.${user.id}` }, 
        () => fetchSessions())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const createSession = async (name, exercises) => {
    if (!user) return null;

    const totalTime = calculateTotalTime(exercises);
    const tempId = `temp_${Date.now()}`;
    
    const optimisticSession = {
      id: tempId,
      name,
      exercises,
      totalTime,
      createdAt: new Date().toISOString()
    };
    
    setSessions(prev => [...prev, optimisticSession]);

    try {
      const { data, error } = await supabase
        .from('sport_sessions')
        .insert({
          user_id: user.id,
          name,
          exercises,
          total_time: totalTime
        })
        .select()
        .single();

      if (error) throw error;

      setSessions(prev => prev.map(s => s.id === tempId ? {
        id: data.id,
        name: data.name,
        exercises: data.exercises,
        totalTime: data.total_time,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      } : s));

      return data;
    } catch (error) {
      console.error("Error creating session:", error);
      setSessions(prev => prev.filter(s => s.id !== tempId));
      throw error;
    }
  };

  const updateSession = async (id, name, exercises) => {
    if (!user) return;

    const totalTime = calculateTotalTime(exercises);
    
    // Optimistic update
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, name, exercises, totalTime, updatedAt: new Date().toISOString() };
      }
      return s;
    }));

    try {
      const { error } = await supabase
        .from('sport_sessions')
        .update({
          name,
          exercises,
          total_time: totalTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating session:", error);
      // Silently fail for optimistic updates, or we could refetch on error
    }
  };

  const deleteSession = async (id) => {
    if (!user) return;

    setSessions(prev => prev.filter(s => s.id !== id));

    try {
      const { error } = await supabase
        .from('sport_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  return (
    <SportContext.Provider value={{
      sessions,
      createSession,
      updateSession,
      deleteSession,
      loading
    }}>
      {children}
    </SportContext.Provider>
  );
}

export function useSport() {
  const context = useContext(SportContext);
  if (!context) {
    throw new Error('useSport must be used within a SportProvider');
  }
  return context;
}
