import { useState, useEffect } from 'react';
import { useNotes } from '../contexts/NotesContext';
import { FolderPlus, FilePlus, ChevronRight, Folder, FileText, Trash2, Edit2, Search, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import NoteEditor from '../components/Notes/NoteEditor';

export default function NotesPage() {
  const { state, createFolder, deleteFolder, createNote, deleteNote } = useNotes();
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingFolderParentId, setCreatingFolderParentId] = useState(null);
  const [creatingNoteInFolderId, setCreatingNoteInFolderId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const toggleFolder = (id) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const handleCreateFolder = (parentId = null) => {
    setCreatingFolderParentId(parentId === null ? 'root' : parentId);
    if (parentId !== null) {
      const next = new Set(expandedFolders);
      next.add(parentId);
      setExpandedFolders(next);
    }
  };

  const submitCreateFolder = async (name, parentId) => {
    const realParentId = parentId === 'root' ? null : parentId;
    setCreatingFolderParentId(null);
    if (!name.trim()) return;
    try {
      await createFolder(name.trim(), realParentId);
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  const handleCreateNote = (folderId = null) => {
    setCreatingNoteInFolderId(folderId === null ? 'root' : folderId);
    if (folderId !== null) {
      const next = new Set(expandedFolders);
      next.add(folderId);
      setExpandedFolders(next);
    }
  };

  const submitCreateNote = async (title, folderId) => {
    const realFolderId = folderId === 'root' ? null : folderId;
    setCreatingNoteInFolderId(null);
    if (!title.trim()) return;
    try {
      const note = await createNote(title.trim(), realFolderId);
      setSelectedNoteId(note.id);
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  // Filter notes by search
  const matchesSearch = (note) => {
    if (!searchQuery) return true;
    const title = note.title || '';
    const content = note.content || '';
    return title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           content.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // If a note is selected, show full-screen editor
  if (selectedNoteId) {
    const selectedNote = state.notes.find(n => n.id === selectedNoteId);
    return (
      <div className="fixed inset-0 md:relative md:h-full flex flex-col animate-in fade-in duration-300 z-[60] bg-dark-900 md:bg-transparent">
        {/* Mobile Header (Fixed at top) */}
        <div className="flex-none flex items-center gap-3 px-4 pl-14 h-14 md:h-auto md:static relative z-50">
          <button
            onClick={() => setSelectedNoteId(null)}
            className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-dark-700/50 text-dark-400 hover:text-accent-cyan transition-all"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-bold">Retour</span>
          </button>
          <span className="text-dark-500 text-sm">•</span>
          <span className="text-dark-400 text-sm font-medium truncate max-w-[150px]">{selectedNote?.title || 'Sans titre'}</span>
        </div>

        {/* Editor Container */}
        <div className="flex-1 flex flex-col md:glass md:rounded-3xl md:border border-dark-600/30 overflow-hidden md:shadow-2xl relative">
          <NoteEditor noteId={selectedNoteId} />
        </div>
      </div>
    );
  }

  // Explorer view — full width, notes inside tree
  return (
    <div className="flex flex-col h-full max-h-[100dvh] gap-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between pr-2 md:pl-12 pl-4" style={{ height: '48px' }}>
        <h2 className="text-xl font-black text-dark-100 uppercase tracking-tight">Explorateur</h2>
        <div className="flex gap-5">
          <button
            onClick={() => { setSearchOpen(o => !o); if (searchOpen) setSearchQuery(''); }}
            className={`p-2.5 rounded-xl transition-all ${searchOpen ? 'bg-accent-cyan/15 text-accent-cyan' : 'hover:bg-dark-700 text-dark-400 hover:text-accent-cyan'}`}
            title="Rechercher"
          >
            <Search size={22} />
          </button>
          <button
            onClick={() => handleCreateFolder(null)}
            className="p-2.5 rounded-xl hover:bg-dark-700 text-dark-400 hover:text-accent-cyan transition-all"
            title="Nouveau dossier"
          >
            <FolderPlus size={22} />
          </button>
          <button
            onClick={() => handleCreateNote(null)}
            className="p-2.5 rounded-xl hover:bg-dark-700 text-dark-400 hover:text-accent-cyan transition-all"
            title="Nouvelle note"
          >
            <FilePlus size={22} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="relative animate-in slide-in-from-top-2 duration-200">
          <input
            autoFocus
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-800/50 border border-dark-600/30 rounded-xl py-2 px-4 text-xs text-dark-100 focus:outline-none focus:border-accent-cyan/50 transition-all"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto glass rounded-2xl border border-dark-600/30 p-2 custom-scrollbar">
        {/* "Toutes les notes" — flat list of ALL notes, no folders */}
        <div className="select-none">
          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-all hover:bg-dark-700/50 text-dark-400 hover:text-dark-200"
            style={{ paddingLeft: '8px' }}
            onClick={() => toggleFolder('all-notes')}
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleFolder('all-notes'); }}
              className={`p-0.5 rounded hover:bg-dark-600 transition-transform ${expandedFolders.has('all-notes') ? 'rotate-90' : ''}`}
            >
              <ChevronRight size={14} />
            </button>
            <FileText size={16} />
            <span className="text-sm font-bold truncate flex-1">Toutes les notes</span>
            <span className="text-[10px] text-dark-500 font-medium opacity-60">
              {state.notes.filter(n => matchesSearch(n)).length}
            </span>
          </div>
          {expandedFolders.has('all-notes') && state.notes
            .filter(n => matchesSearch(n))
            .map(note => (
              <NoteItem
                key={note.id}
                note={note}
                level={1}
                onSelect={setSelectedNoteId}
                onDelete={deleteNote}
              />
            ))
          }
        </div>

        {/* Folder tree */}
        {state.folders.filter(f => !f.parent_id).map(folder => (
          <FolderItem
            key={folder.id}
            folder={folder}
            level={0}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            folders={state.folders}
            notes={state.notes}
            matchesSearch={matchesSearch}
            onAddSub={handleCreateFolder}
            onAddNote={handleCreateNote}
            onDelete={deleteFolder}
            onDeleteNote={deleteNote}
            onSelectNote={setSelectedNoteId}
            creatingFolderParentId={creatingFolderParentId}
            onSubmitFolder={submitCreateFolder}
            creatingNoteInFolderId={creatingNoteInFolderId}
            onSubmitNote={submitCreateNote}
          />
        ))}

        {/* Root-level folder creation */}
        {creatingFolderParentId === 'root' && (
          <div className="flex items-center gap-2 px-2 py-1.5" style={{ paddingLeft: '20px' }}>
            <Folder size={16} className="text-dark-500" />
            <input
              autoFocus
              type="text"
              placeholder="Nom du dossier..."
              className="bg-dark-700 border border-accent-cyan/30 rounded px-2 py-0.5 text-xs text-dark-100 focus:outline-none focus:border-accent-cyan w-full"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreateFolder(e.target.value, 'root');
                if (e.key === 'Escape') setCreatingFolderParentId(null);
              }}
              onBlur={(e) => {
                if (e.target.value) submitCreateFolder(e.target.value, 'root');
                else setCreatingFolderParentId(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NoteItem ────────────────────────────────────────────────
function NoteItem({ note, level, onSelect, onDelete }) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-all hover:bg-dark-700/50 text-dark-400 hover:text-dark-200"
      style={{ paddingLeft: `${level * 12 + 8}px` }}
      onClick={() => onSelect(note.id)}
    >
      <FileText size={15} className="text-dark-500 group-hover:text-accent-cyan transition-colors flex-shrink-0" />
      <span className="text-sm font-medium truncate flex-1">{note.title || 'Sans titre'}</span>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Supprimer cette note ?')) {
              onDelete(note.id);
            }
          }}
          className="p-1 hover:text-accent-red"
          title="Supprimer"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── NoteCreationInput ───────────────────────────────────────
function NoteCreationInput({ level, folderId, onSubmit }) {
  const [name, setName] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSubmit(name, folderId);
      setName('');
    }
    if (e.key === 'Escape') {
      onSubmit('', folderId);
      setName('');
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5" style={{ paddingLeft: `${level * 12 + 8}px` }}>
      <FileText size={15} className="text-accent-cyan flex-shrink-0" />
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (name) onSubmit(name, folderId);
          else onSubmit('', folderId);
        }}
        placeholder="Titre de la note..."
        className="bg-dark-700 border border-accent-cyan/30 rounded px-2 py-0.5 text-xs text-dark-100 focus:outline-none focus:border-accent-cyan w-full"
      />
    </div>
  );
}

// ─── FolderItem ──────────────────────────────────────────────
function FolderItem({
  folder, level, expandedFolders, toggleFolder, folders, notes, matchesSearch,
  onAddSub, onAddNote, onDelete, onDeleteNote, onSelectNote,
  creatingFolderParentId, onSubmitFolder,
  creatingNoteInFolderId, onSubmitNote,
}) {
  const id = folder.id;
  const isExpanded = expandedFolders.has(id);
  const childFolders = folders.filter(f => f.parent_id === id);
  const childNotes = notes.filter(n => n.folder_id === id && matchesSearch(n));
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (creatingFolderParentId !== id) setNewName('');
  }, [creatingFolderParentId, id]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const n = newName;
      setNewName('');
      onSubmitFolder(n, id);
    }
    if (e.key === 'Escape') {
      setNewName('');
      onSubmitFolder('', id);
    }
  };

  return (
    <div className="select-none">
      {/* Folder row */}
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-all hover:bg-dark-700/50 text-dark-400 hover:text-dark-200`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => toggleFolder(id)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); toggleFolder(id); }}
          className={`p-0.5 rounded hover:bg-dark-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        >
          <ChevronRight size={14} />
        </button>
        <Folder size={16} />
        <span className="text-sm font-bold truncate flex-1">
          {folder.name}
        </span>
        {/* Item count badge */}
        {(childNotes.length > 0 || childFolders.length > 0) && (
          <span className="text-[10px] text-dark-500 font-medium opacity-60">
            {childNotes.length}
          </span>
        )}
        {/* Action buttons */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onAddNote(id); }} className="p-1 hover:text-accent-cyan" title="Nouvelle note">
            <FilePlus size={12} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onAddSub(id); }} className="p-1 hover:text-accent-cyan" title="Nouveau sous-dossier">
            <FolderPlus size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Supprimer le dossier "${folder.name}" et tout son contenu ?`)) {
                onDelete(id);
              }
            }}
            className="p-1 hover:text-accent-red"
            title="Supprimer"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* New subfolder input */}
      {creatingFolderParentId === id && (
        <div className="flex items-center gap-2 px-2 py-1.5" style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}>
          <Folder size={16} className="text-dark-500" />
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (newName) {
                const n = newName;
                setNewName('');
                onSubmitFolder(n, id);
              } else {
                onSubmitFolder('', id);
              }
            }}
            placeholder="Nom du dossier..."
            className="bg-dark-700 border border-accent-cyan/30 rounded px-2 py-0.5 text-xs text-dark-100 focus:outline-none focus:border-accent-cyan w-full"
          />
        </div>
      )}

      {/* Expanded children: sub-folders then notes */}
      {isExpanded && (
        <>
          {childFolders.map(child => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              folders={folders}
              notes={notes}
              matchesSearch={matchesSearch}
              onAddSub={onAddSub}
              onAddNote={onAddNote}
              onDelete={onDelete}
              onDeleteNote={onDeleteNote}
              onSelectNote={onSelectNote}
              creatingFolderParentId={creatingFolderParentId}
              onSubmitFolder={onSubmitFolder}
              creatingNoteInFolderId={creatingNoteInFolderId}
              onSubmitNote={onSubmitNote}
            />
          ))}

          {/* Notes inside this folder */}
          {childNotes.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              level={level + 1}
              onSelect={onSelectNote}
              onDelete={onDeleteNote}
            />
          ))}

          {/* Note creation input inside this folder */}
          {creatingNoteInFolderId === id && (
            <NoteCreationInput level={level + 1} folderId={id} onSubmit={onSubmitNote} />
          )}
        </>
      )}
    </div>
  );
}
