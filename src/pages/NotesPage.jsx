import { useState, useEffect } from 'react';
import { useNotes } from '../contexts/NotesContext';
import { FolderPlus, FilePlus, ChevronRight, ChevronDown, Folder, FileText, MoreVertical, Trash2, Edit2, Search, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NoteEditor from '../components/Notes/NoteEditor';

export default function NotesPage() {
  const { state, createFolder, deleteFolder, createNote, deleteNote } = useNotes();
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingFolderParentId, setCreatingFolderParentId] = useState(null); // null = not creating, 'root' = root, ID = subfolder
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  const toggleFolder = (id) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const handleRenameFolder = async (id, currentName) => {
    const name = window.prompt('Nouveau nom du dossier :', currentName);
    if (!name || name === currentName) return;
    try {
      await updateFolder(id, { name });
    } catch (err) {
      alert('Erreur lors du renommage : ' + err.message);
    }
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

  const handleCreateNote = () => {
    setIsCreatingNote(true);
  };

  const submitCreateNote = async (title) => {
    setIsCreatingNote(false);
    if (!title.trim()) return;
    
    try {
      const note = await createNote(title.trim(), selectedFolderId);
      setSelectedNoteId(note.id);
    } catch (err) {
      alert('Erreur lors de la création de la note : ' + err.message);
    }
  };

  const filteredNotes = state.notes.filter(n => {
    const title = n.title || '';
    const content = n.content || '';
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = selectedFolderId === null || n.folder_id === selectedFolderId;
    return matchesSearch && matchesFolder;
  });

  // If a note is selected, show full-screen editor
  if (selectedNoteId) {
    const selectedNote = state.notes.find(n => n.id === selectedNoteId);
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col gap-4 animate-in fade-in duration-300">
        {/* Back header */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedNoteId(null)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-dark-700/50 text-dark-400 hover:text-accent-cyan transition-all"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-bold">Retour</span>
          </button>
          <span className="text-dark-500 text-sm">•</span>
          <span className="text-dark-400 text-sm font-medium truncate">{selectedNote?.title || 'Sans titre'}</span>
        </div>

        {/* Full-screen editor */}
        <div className="flex-1 glass rounded-3xl border border-dark-600/30 overflow-hidden shadow-2xl">
          <NoteEditor noteId={selectedNoteId} />
        </div>
      </div>
    );
  }

  // Explorer view
  return (
    <div className="flex h-[calc(100vh-120px)] gap-6 animate-in fade-in duration-500">
      {/* Sidebar Explorer */}
      <div className="w-72 flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xl font-black text-dark-100">Explorateur</h2>
          <div className="flex gap-1">
            <button 
              onClick={() => handleCreateFolder(null)}
              className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-accent-cyan transition-all"
              title="Nouveau dossier"
            >
              <FolderPlus size={18} />
            </button>
            <button 
              onClick={() => handleCreateNote()}
              className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-accent-cyan transition-all"
              title="Nouvelle note"
            >
              <FilePlus size={18} />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" size={14} />
          <input 
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-800/50 border border-dark-600/30 rounded-xl py-2 pl-9 pr-4 text-xs text-dark-100 focus:outline-none focus:border-accent-cyan/50 transition-all"
          />
        </div>

        <div className="flex-1 overflow-y-auto glass rounded-2xl border border-dark-600/30 p-2 custom-scrollbar">
          <FolderItem 
            folder={null} 
            level={0} 
            selectedId={selectedFolderId}
            setSelectedId={setSelectedFolderId}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            folders={state.folders}
            onAddSub={handleCreateFolder}
            onRename={handleRenameFolder}
            onDelete={deleteFolder}
            creatingFolderParentId={creatingFolderParentId}
            onSubmitFolder={submitCreateFolder}
          />
          {state.folders.filter(f => !f.parent_id).map(folder => (
            <FolderItem 
              key={folder.id} 
              folder={folder} 
              level={0}
              selectedId={selectedFolderId}
              setSelectedId={setSelectedFolderId}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              folders={state.folders}
              onAddSub={handleCreateFolder}
              onRename={handleRenameFolder}
              onDelete={deleteFolder}
              creatingFolderParentId={creatingFolderParentId}
              onSubmitFolder={submitCreateFolder}
            />
          ))}
        </div>
      </div>

      {/* Note List */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="px-2">
          <h2 className="text-xl font-black text-dark-100">
            {selectedFolderId ? state.folders.find(f => f.id === selectedFolderId)?.name : 'Toutes les notes'}
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
          {isCreatingNote && (
            <div className="p-4 rounded-2xl bg-accent-cyan/5 border border-accent-cyan/30 animate-in slide-in-from-top-2">
              <input
                autoFocus
                type="text"
                placeholder="Titre de la note..."
                className="w-full bg-transparent text-sm font-bold text-dark-100 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreateNote(e.target.value);
                  if (e.key === 'Escape') setIsCreatingNote(false);
                }}
                onBlur={(e) => submitCreateNote(e.target.value)}
              />
            </div>
          )}
          
          <AnimatePresence mode="popLayout">
            {filteredNotes.map(note => (
              <motion.button
                layout
                key={note.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={() => setSelectedNoteId(note.id)}
                className="w-full text-left p-4 rounded-2xl border transition-all bg-dark-800/40 border-dark-600/30 hover:bg-dark-700/40 hover:border-dark-500"
              >
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h4 className="font-bold truncate text-dark-200">
                    {note.title || 'Sans titre'}
                  </h4>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (window.confirm('Supprimer cette note ?')) {
                        deleteNote(note.id);
                      }
                    }}
                    className="p-1 rounded hover:bg-accent-red/10 text-dark-500 hover:text-accent-red transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-dark-400 line-clamp-2 leading-relaxed">
                  {note.content || 'Aucun contenu...'}
                </p>
                <div className="mt-3 text-[10px] text-dark-500 font-medium">
                  {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(note.updated_at))}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
          
          {filteredNotes.length === 0 && !isCreatingNote && (
            <div className="py-12 text-center text-dark-500">
              <FileText className="mx-auto mb-3 opacity-20" size={32} />
              <p className="text-sm">Aucune note ici.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FolderItem({ folder, level, selectedId, setSelectedId, expandedFolders, toggleFolder, folders, onAddSub, onRename, onDelete, creatingFolderParentId, onSubmitFolder }) {
  const isRoot = folder === null;
  const id = isRoot ? 'root' : folder.id;
  const isExpanded = expandedFolders.has(id);
  const isSelected = selectedId === (isRoot ? null : id);
  const children = folders.filter(f => f.parent_id === id);
  const [newName, setNewName] = useState('');

  // Reset name when closing or switching creation
  useEffect(() => {
    if (creatingFolderParentId !== id) {
      setNewName('');
    }
  }, [creatingFolderParentId, id]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const name = newName;
      setNewName('');
      onSubmitFolder(name, id);
    }
    if (e.key === 'Escape') {
      setNewName('');
      onSubmitFolder('', id);
    }
  };

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-all ${
          isSelected ? 'bg-accent-cyan/10 text-accent-cyan' : 'hover:bg-dark-700/50 text-dark-400 hover:text-dark-200'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => setSelectedId(isRoot ? null : id)}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); toggleFolder(id); }}
          className={`p-0.5 rounded hover:bg-dark-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        >
          <ChevronRight size={14} />
        </button>
        {isRoot ? <Folder size={16} /> : <Folder size={16} />}
        <span className="text-sm font-bold truncate flex-1">
          {isRoot ? 'Toutes les notes' : folder.name}
        </span>
        {!isRoot && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onAddSub(id); }} className="p-1 hover:text-accent-cyan" title="Nouveau sous-dossier">
              <FolderPlus size={12} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRename(id, folder.name); }} className="p-1 hover:text-accent-cyan" title="Renommer">
              <Edit2 size={12} />
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
        )}
      </div>

      {/* Input for new subfolder */}
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
                const name = newName;
                setNewName('');
                onSubmitFolder(name, id);
              } else {
                onSubmitFolder('', id);
              }
            }}
            placeholder="Nom du dossier..."
            className="bg-dark-700 border border-accent-cyan/30 rounded px-2 py-0.5 text-xs text-dark-100 focus:outline-none focus:border-accent-cyan w-full"
          />
        </div>
      )}

      {isExpanded && children.map(child => (
        <FolderItem 
          key={child.id}
          folder={child}
          level={level + 1}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
          folders={folders}
          onAddSub={onAddSub}
          onRename={onRename}
          onDelete={onDelete}
          creatingFolderParentId={creatingFolderParentId}
          onSubmitFolder={onSubmitFolder}
        />
      ))}
    </div>
  );
}
