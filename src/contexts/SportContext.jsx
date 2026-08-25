import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { GOAL_TYPES } from '../data/exercisesCatalog';
import {
  saveLocalSport,
  loadLocalSport,
  enqueueSportSyncAction,
  processSportSyncQueue,
  getPendingSportQueueCount,
  generateUUID,
  isOfflineError
} from '../utils/offlineSync';

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
  const [pendingSportCount, setPendingSportCount] = useState(0);
  const [isSyncingSport, setIsSyncingSport] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();

  const refreshPendingSportCount = useCallback(() => {
    if (user) {
      setPendingSportCount(getPendingSportQueueCount(user.id));
    }
  }, [user]);

  const syncSportNow = useCallback(async () => {
    if (!user || !navigator.onLine || isSyncingSport) return;

    const count = getPendingSportQueueCount(user.id);
    if (count === 0) {
      setPendingSportCount(0);
      return;
    }

    setIsSyncingSport(true);
    try {
      const result = await processSportSyncQueue(user.id, supabase);
      setPendingSportCount(result.pendingCount);

      if (result.processedCount > 0) {
        showToast(`✅ ${result.processedCount} séance(s) de sport synchronisée(s) !`, 'success');
      }
    } catch (err) {
      console.warn('Sport sync queue error:', err);
    } finally {
      setIsSyncingSport(false);
    }
  }, [user, isSyncingSport, showToast]);

  // Online listener
  useEffect(() => {
    const handleOnline = () => {
      syncSportNow();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncSportNow]);

  // Save sessions to local cache whenever they update
  useEffect(() => {
    if (user && !loading) {
      saveLocalSport(user.id, sessions);
      refreshPendingSportCount();
    }
  }, [sessions, user, loading, refreshPendingSportCount]);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Instant loading from local cache
    const cached = loadLocalSport(user.id);
    if (cached && cached.sessions) {
      setSessions(cached.sessions);
      setLoading(false);
      refreshPendingSportCount();
    }

    const fetchSessions = async () => {
      if (!navigator.onLine) {
        if (!cached && isMounted) {
          setSessions([]);
          setLoading(false);
        }
        return;
      }

      try {
        if (getPendingSportQueueCount(user.id) > 0) {
          await processSportSyncQueue(user.id, supabase);
          if (isMounted) refreshPendingSportCount();
        }

        const { data, error } = await supabase
          .from('sport_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (!isMounted) return;

        if (!error && data) {
          const transformed = data.map(session => ({
            id: session.id,
            name: session.name,
            exercises: session.exercises,
            totalTime: session.total_time,
            createdAt: session.created_at,
            updatedAt: session.updated_at
          }));
          setSessions(transformed);
          saveLocalSport(user.id, transformed);
        } else if (error) {
          console.warn("Error fetching sport sessions from server (using local cache):", error.message);
        }
      } catch (err) {
        console.warn("Network error fetching sport sessions:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSessions();

    const channel = supabase
      .channel('sport_sessions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sport_sessions', filter: `user_id=eq.${user.id}` }, 
        () => fetchSessions())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user, refreshPendingSportCount]);

  const createSession = async (name, exercises) => {
    if (!user) return null;

    const totalTime = calculateTotalTime(exercises);
    const sessionId = generateUUID();
    
    const newSession = {
      id: sessionId,
      name,
      exercises,
      totalTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setSessions(prev => [...prev, newSession]);

    if (!navigator.onLine) {
      enqueueSportSyncAction(user.id, 'ADD_SPORT_SESSION', newSession);
      refreshPendingSportCount();
      return newSession;
    }

    try {
      const { data, error } = await supabase
        .from('sport_sessions')
        .insert({
          id: sessionId,
          user_id: user.id,
          name,
          exercises,
          total_time: totalTime
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      if (isOfflineError(error)) {
        enqueueSportSyncAction(user.id, 'ADD_SPORT_SESSION', newSession);
        refreshPendingSportCount();
        return newSession;
      } else {
        console.error("Error creating session:", error);
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        showToast(`Erreur création séance : ${error.message}`, 'error');
        throw error;
      }
    }
  };

  const updateSession = async (id, name, exercises) => {
    if (!user) return;

    const totalTime = calculateTotalTime(exercises);
    const updatedData = {
      id,
      name,
      exercises,
      totalTime,
      updatedAt: new Date().toISOString()
    };
    
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, ...updatedData };
      }
      return s;
    }));

    if (!navigator.onLine) {
      enqueueSportSyncAction(user.id, 'UPDATE_SPORT_SESSION', updatedData);
      refreshPendingSportCount();
      return updatedData;
    }

    try {
      const { error } = await supabase
        .from('sport_sessions')
        .update({
          name,
          exercises,
          total_time: totalTime,
          updated_at: updatedData.updatedAt
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      if (isOfflineError(error)) {
        enqueueSportSyncAction(user.id, 'UPDATE_SPORT_SESSION', updatedData);
        refreshPendingSportCount();
      } else {
        console.error("Error updating session:", error);
        showToast('Erreur de modification de la séance', 'error');
      }
    }
  };

  const deleteSession = async (id) => {
    if (!user) return;

    setSessions(prev => prev.filter(s => s.id !== id));

    if (!navigator.onLine) {
      enqueueSportSyncAction(user.id, 'DELETE_SPORT_SESSION', { id });
      refreshPendingSportCount();
      return;
    }

    try {
      const { error } = await supabase
        .from('sport_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      if (isOfflineError(error)) {
        enqueueSportSyncAction(user.id, 'DELETE_SPORT_SESSION', { id });
        refreshPendingSportCount();
      } else {
        console.error("Error deleting session:", error);
        showToast('Erreur de suppression de la séance', 'error');
      }
    }
  };

  return (
    <SportContext.Provider value={{
      sessions,
      createSession,
      updateSession,
      deleteSession,
      pendingSportCount,
      isSyncingSport,
      syncSportNow,
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
