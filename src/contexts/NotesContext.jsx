import { createContext, useContext, useEffect, useState, useReducer } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

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
      // Collect all descendant folder IDs recursively (mirrors DB cascade delete)
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

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      const [{ data: folders }, { data: notes }] = await Promise.all([
        supabase.from('folders').select('*').eq('user_id', user.id).order('name'),
        supabase.from('notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
      ]);

      dispatch({
        type: 'INITIALIZE',
        payload: { folders: folders || [], notes: notes || [] }
      });
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
      supabase.removeChannel(folderChannel);
      supabase.removeChannel(noteChannel);
    };
  }, [user]);

  const createFolder = async (name, parentId = null) => {
    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const newFolder = { id: tempId, name, parent_id: parentId, user_id: user.id, created_at: new Date().toISOString() };
    dispatch({ type: 'ADD_FOLDER', payload: newFolder });

    try {
      const { data, error } = await supabase
        .from('folders')
        .insert({ name, parent_id: parentId, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      
      // Update the temp folder with real data
      dispatch({ type: 'UPDATE_FOLDER', payload: { ...data, oldId: tempId } });
      return data;
    } catch (error) {
      dispatch({ type: 'DELETE_FOLDER', payload: tempId });
      throw error;
    }
  };

  const createNote = async (title, folderId = null) => {
    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const newNote = { 
      id: tempId, 
      title, 
      folder_id: folderId, 
      user_id: user.id, 
      content: '', 
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    dispatch({ type: 'ADD_NOTE', payload: newNote });

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({ title, folder_id: folderId, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      
      dispatch({ type: 'UPDATE_NOTE', payload: { ...data, oldId: tempId } });
      return data;
    } catch (error) {
      dispatch({ type: 'DELETE_NOTE', payload: tempId });
      throw error;
    }
  };

  const updateFolder = async (id, updates) => {
    const { data, error } = await supabase
      .from('folders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const deleteFolder = async (id) => {
    dispatch({ type: 'DELETE_FOLDER', payload: id });
    try {
      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting folder:', error);
      fetchData(); // Refresh if failed
    }
  };

  const updateNote = async (id, updates) => {
    // Update local state immediately
    dispatch({ type: 'UPDATE_NOTE', payload: { id, ...updates } });
    
    const { data, error } = await supabase
      .from('notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    // Sync with server response
    dispatch({ type: 'UPDATE_NOTE', payload: data });
    return data;
  };

  const deleteNote = async (id) => {
    dispatch({ type: 'DELETE_NOTE', payload: id });
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting note:', error);
      fetchData(); // Refresh if failed
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
      deleteNote 
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
