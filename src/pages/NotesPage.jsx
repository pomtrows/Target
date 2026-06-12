import { useState, useEffect } from 'react';
import { useNotes } from '../contexts/NotesContext';
import { FolderPlus, FilePlus, ChevronRight, Folder, FileText, Trash2, Search, ArrowLeft } from 'lucide-react';
import NoteEditor from '../components/Notes/NoteEditor';
import Modal from '../components/Shared/Modal';

export default function NotesPage() {
  const { state, createFolder, deleteFolder, createNote, deleteNote, updateNote } = useNotes();
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [currentFolderId, setCurrentFolderId] = useState(null); // null (root), folderId, or 'all-notes'
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingFolderParentId, setCreatingFolderParentId] = useState(null);
  const [creatingNoteInFolderId, setCreatingNoteInFolderId] = useState(null);
  const [movingNoteId, setMovingNoteId] = useState(null);
  const [moveModalFolderId, setMoveModalFolderId] = useState(null);   // navigation inside move modal
  const [moveSelectedFolderId, setMoveSelectedFolderId] = useState(undefined); // undefined = not chosen yet
  const [searchOpen, setSearchOpen] = useState(false);

  // Auto-navigate to root if current folder is deleted by background sync or another client
  useEffect(() => {
    if (currentFolderId && currentFolderId !== 'all-notes') {
      const exists = state.folders.some(f => f.id === currentFolderId);
      if (!exists) {
        setCurrentFolderId(null);
      }
    }
  }, [state.folders, currentFolderId]);

  const isRegularNote = (note) => {
    const folder = state.folders.find(f => f.id === note.folder_id);
    return folder?.name !== 'Objectifs';
  };

  const getFolderPath = (folderId) => {
    if (!folderId) return 'Racine';
    const path = [];
    let current = state.folders.find(f => f.id === folderId);
    while (current) {
      path.unshift(current.name);
      current = state.folders.find(f => f.id === current.parent_id);
    }
    return path.join(' / ');
  };

  const getBreadcrumbs = () => {
    if (currentFolderId === 'all-notes') {
      return [
        { id: null, name: 'Racine' },
        { id: 'all-notes', name: 'Toutes les notes' }
      ];
    }
    const crumbs = [{ id: null, name: 'Racine' }];
    if (!currentFolderId) return crumbs;

    let path = [];
    let current = state.folders.find(f => f.id === currentFolderId);
    while (current) {
      path.unshift({ id: current.id, name: current.name });
      current = state.folders.find(f => f.id === current.parent_id);
    }
    return [...crumbs, ...path];
  };

  const renderMoveModal = () => {
    if (!movingNoteId) return null;

    // Folders visible at current navigation level (excluding Objectifs)
    const visibleFolders = state.folders.filter(
      f => f.parent_id === moveModalFolderId && f.name !== 'Objectifs'
    );

    // Breadcrumb path inside the modal
    const getModalBreadcrumbs = () => {
      const crumbs = [{ id: null, name: 'Racine' }];
      if (!moveModalFolderId) return crumbs;
      let path = [];
      let cur = state.folders.find(f => f.id === moveModalFolderId);
      while (cur) {
        path.unshift({ id: cur.id, name: cur.name });
        cur = state.folders.find(f => f.id === cur.parent_id);
      }
      return [...crumbs, ...path];
    };

    const handleConfirm = async () => {
      // moveSelectedFolderId: undefined = nothing selected, null = Racine, string = folderId
      if (moveSelectedFolderId === undefined) return;
      try {
        await updateNote(movingNoteId, { folder_id: moveSelectedFolderId });
        setMovingNoteId(null);
        setMoveModalFolderId(null);
        setMoveSelectedFolderId(undefined);
      } catch (err) {
        alert('Erreur : ' + err.message);
      }
    };

    const modalCrumbs = getModalBreadcrumbs();

    return (
      <Modal
        isOpen={!!movingNoteId}
        onClose={() => { setMovingNoteId(null); setMoveModalFolderId(null); setMoveSelectedFolderId(undefined); }}
        title="Déplacer la note"
        maxWidth="max-w-md"
      >
        <div className="space-y-3 p-2 select-none">

          {/* Navigation breadcrumb inside modal */}
          <div className="flex items-center gap-1 text-xs text-dark-400 flex-wrap">
            {modalCrumbs.map((crumb, idx, arr) => (
              <span key={crumb.id ?? 'root'} className="flex items-center gap-1">
                {idx > 0 && <ChevronRight size={11} className="text-dark-600" />}
                <button
                  onClick={() => setMoveModalFolderId(crumb.id)}
                  className={`hover:text-accent-cyan transition-colors ${
                    idx === arr.length - 1 ? 'text-dark-200 font-semibold' : 'text-dark-400'
                  }`}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>

          {/* Folder list */}
          <div className="max-h-[260px] overflow-y-auto border border-dark-600/30 rounded-xl bg-dark-800/40 custom-scrollbar divide-y divide-dark-600/20">

            {/* Racine — always selectable */}
            <div
              className={`flex items-center px-4 py-3.5 text-sm gap-3 transition-colors cursor-pointer ${
                moveSelectedFolderId === null
                  ? 'bg-accent-cyan/10 text-accent-cyan'
                  : 'hover:bg-dark-600/40 text-dark-300'
              }`}
              onClick={() => setMoveSelectedFolderId(null)}
            >
              <input
                type="radio"
                readOnly
                checked={moveSelectedFolderId === null}
                className="accent-cyan-400 w-3.5 h-3.5 flex-shrink-0"
              />
              <Folder size={15} className="flex-shrink-0 text-dark-400" />
              <span className="flex-1 font-semibold">Racine</span>
            </div>

            {/* Sub-folders: radio to select, chevron to navigate */}
            {visibleFolders.map(folder => {
              const hasChildren = state.folders.some(f => f.parent_id === folder.id && f.name !== 'Objectifs');
              return (
                <div
                  key={folder.id}
                  className={`flex items-center px-4 py-3.5 text-sm gap-3 transition-colors cursor-pointer ${
                    moveSelectedFolderId === folder.id
                      ? 'bg-accent-cyan/10 text-accent-cyan'
                      : 'hover:bg-dark-600/40 text-dark-200'
                  }`}
                  onClick={() => setMoveSelectedFolderId(folder.id)}
                >
                  <input
                    type="radio"
                    readOnly
                    checked={moveSelectedFolderId === folder.id}
                    className="accent-cyan-400 w-3.5 h-3.5 flex-shrink-0"
                  />
                  <Folder size={15} className="text-accent-cyan flex-shrink-0" />
                  <span className="flex-1">{folder.name}</span>
                  {hasChildren && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setMoveModalFolderId(folder.id); setMoveSelectedFolderId(undefined); }}
                      className="p-1 rounded hover:bg-dark-600/60 text-dark-400 hover:text-dark-100 transition-colors"
                      title="Explorer ce dossier"
                    >
                      <ChevronRight size={20} />
                    </button>
                  )}
                </div>
              );
            })}

            {visibleFolders.length === 0 && moveModalFolderId && (
              <div className="p-4 text-center text-xs text-dark-500">
                Aucun sous-dossier
              </div>
            )}

          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setMovingNoteId(null); setMoveModalFolderId(null); setMoveSelectedFolderId(undefined); }}
              className="px-4 py-2 rounded-xl text-sm text-dark-300 hover:bg-dark-600/40 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={moveSelectedFolderId === undefined}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Valider
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  const handleCreateFolder = (parentId = null) => {
    setCreatingFolderParentId(parentId === null ? 'root' : parentId);
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

  const matchesSearch = (note) => {
    if (!searchQuery) return true;
    const title = note.title || '';
    const content = note.content || '';
    return title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           content.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const currentFolders = currentFolderId === 'all-notes'
    ? []
    : state.folders.filter(f => f.parent_id === currentFolderId && f.name !== 'Objectifs');

  const currentNotes = currentFolderId === 'all-notes'
    ? state.notes.filter(n => isRegularNote(n) && matchesSearch(n))
    : state.notes.filter(n => n.folder_id === currentFolderId && isRegularNote(n) && matchesSearch(n));

  // If a note is selected, show full-screen editor
  if (selectedNoteId) {
    const selectedNote = state.notes.find(n => n.id === selectedNoteId);
    return (
      <div className="fixed inset-0 md:relative md:h-full flex flex-col animate-in fade-in duration-300 z-[60] bg-dark-900 md:bg-transparent">
        {/* Mobile/Desktop Header (Fixed at top) */}
        <div className="flex-none flex items-center justify-between px-4 h-14 md:h-auto md:static relative z-50" style={{ paddingLeft: '80px' }}>
          <div className="flex items-center gap-3">
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
          {selectedNote && isRegularNote(selectedNote) && (
            <button
              onClick={() => setMovingNoteId(selectedNoteId)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-800/60 border border-dark-700/50 hover:border-accent-cyan/50 text-dark-300 hover:text-accent-cyan transition-all text-xs font-bold cursor-pointer"
            >
              <Folder size={14} />
              <span>Déplacer</span>
            </button>
          )}
        </div>

        {/* Editor Container */}
        <div className="flex-1 flex flex-col md:glass md:rounded-3xl md:border border-dark-600/30 overflow-hidden md:shadow-2xl relative">
          <NoteEditor noteId={selectedNoteId} />
        </div>
        {renderMoveModal()}
      </div>
    );
  }

  // Explorer view — navigation-based
  return (
    <div className="flex flex-col h-full max-h-[100dvh] gap-4 animate-in fade-in duration-500 relative">
      {/* Header */}
      <div className="md:relative md:flex-none md:flex md:flex-col md:items-center md:mb-6 fixed top-3 left-0 w-full z-40 pointer-events-none md:pointer-events-auto">
        <div className="pointer-events-auto flex items-center justify-center relative w-full max-w-7xl mx-auto px-4 md:px-0">
          <h1 className="text-3xl font-black text-dark-100">
            Notes
          </h1>
          <div className="absolute right-4 md:right-0 top-1/2 -translate-y-1/2 flex gap-1 sm:gap-2">
            <button
              onClick={() => { setSearchOpen(o => !o); if (searchOpen) setSearchQuery(''); }}
              className={`p-2 rounded-xl transition-all ${searchOpen ? 'bg-accent-cyan/15 text-accent-cyan' : 'hover:bg-dark-700 text-dark-400 hover:text-accent-cyan'}`}
              title="Rechercher"
            >
              <Search size={22} />
            </button>
            <button
              onClick={() => handleCreateFolder(currentFolderId === 'all-notes' ? null : currentFolderId)}
              className="p-2 rounded-xl hover:bg-dark-700 text-dark-400 hover:text-accent-cyan transition-all cursor-pointer"
              title="Nouveau dossier"
            >
              <Folder size={22} fill="#fbbf24" stroke="#d97706" />
            </button>
            <button
              onClick={() => handleCreateNote(currentFolderId === 'all-notes' ? null : currentFolderId)}
              className="p-2 rounded-xl hover:bg-dark-700 text-dark-400 hover:text-accent-cyan transition-all cursor-pointer"
              title="Nouvelle note"
            >
              <FileText size={22} fill="#ddd6fe" stroke="#8b5cf6" />
            </button>
          </div>
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

      <div className="flex-1 overflow-y-auto glass rounded-2xl border border-dark-600/30 p-4 custom-scrollbar flex flex-col gap-2.5">
        {/* Breadcrumbs */}
        <div style={{ marginTop: '6px', marginLeft: '6px', paddingLeft: '8px', paddingTop: '6px', paddingRight: '6px', paddingBottom: '5px' }} className="flex items-center flex-wrap gap-1.5 border-b border-dark-600/20 mb-3 text-xs text-dark-400 select-none">
          {getBreadcrumbs().map((crumb, idx, arr) => (
            <div key={crumb.id ?? 'crumb-' + idx} className="flex items-center gap-1.5">
              {idx > 0 && <ChevronRight size={12} className="text-dark-500" />}
              <button
                onClick={() => {
                  setCurrentFolderId(crumb.id);
                  setCreatingFolderParentId(null);
                  setCreatingNoteInFolderId(null);
                }}
                className={`hover:text-accent-cyan transition-colors font-medium flex items-center gap-1 border-none bg-transparent cursor-pointer ${
                  idx === arr.length - 1 ? 'text-accent-cyan font-bold pointer-events-none' : ''
                }`}
              >
                {crumb.id === null && <Folder size={14} className="text-dark-400" />}
                <span>{crumb.name}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Back option (..) */}
        {currentFolderId && (
          <div
            onClick={() => {
              if (currentFolderId === 'all-notes') {
                setCurrentFolderId(null);
              } else {
                const folder = state.folders.find(f => f.id === currentFolderId);
                setCurrentFolderId(folder ? folder.parent_id : null);
              }
              setCreatingFolderParentId(null);
              setCreatingNoteInFolderId(null);
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-dark-700/40 text-dark-400 hover:text-accent-cyan transition-all select-none"
          >
            <ArrowLeft size={16} className="text-dark-500" />
            <span className="text-sm font-semibold">Dossier parent (..)</span>
          </div>
        )}

        {/* "Toutes les notes" row (only at root) */}
        {currentFolderId === null && (
          <div
            onClick={() => {
              setCurrentFolderId('all-notes');
              setCreatingFolderParentId(null);
              setCreatingNoteInFolderId(null);
            }}
            style={{ marginLeft: '6px' }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-dark-700/40 text-dark-400 hover:text-accent-cyan transition-all select-none"
          >
            <FileText size={16} className="text-accent-cyan flex-shrink-0" />
            <span className="text-sm font-bold flex-1">Toutes les notes</span>

          </div>
        )}

        {/* Folders */}
        {currentFolders.map(folder => {
          return (
            <div
              key={folder.id}
              onClick={() => {
                setCurrentFolderId(folder.id);
                setCreatingFolderParentId(null);
                setCreatingNoteInFolderId(null);
              }}
              style={{ marginLeft: '6px' }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group hover:bg-dark-700/40 text-dark-300 hover:text-dark-100 transition-all select-none"
            >
              <Folder size={16} className="text-accent-cyan flex-shrink-0" />
              <span className="text-sm font-bold flex-1 truncate">{folder.name}</span>
      <div style={{ marginRight: '6px' }} className="md:opacity-0 md:group-hover:opacity-100 flex items-center gap-2.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Supprimer le dossier "${folder.name}" et tout son contenu ?`)) {
                      deleteFolder(folder.id);
                    }
                  }}
                  className="p-1.5 hover:text-accent-red hover:bg-dark-600/40 rounded-lg transition-all"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}

        {/* Notes */}
        {currentNotes.map(note => (
          <NoteItem
            key={note.id}
            note={note}
            onSelect={setSelectedNoteId}
            onDelete={deleteNote}
            onMove={setMovingNoteId}
          />
        ))}

        {/* Empty state */}
        {currentFolders.length === 0 && currentNotes.length === 0 && currentFolderId !== null && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center select-none animate-in fade-in duration-300">
            <Folder size={48} className="text-dark-600 mb-3 opacity-40" />
            <p className="text-sm font-semibold text-dark-400">Ce dossier est vide</p>
            <p className="text-xs text-dark-500 mt-1 max-w-[200px]">
              Créez un sous-dossier ou une note pour commencer.
            </p>
          </div>
        )}

        {/* Inline Folder Creation */}
        {creatingFolderParentId && (
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Folder size={16} className="text-accent-cyan flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Nom du dossier..."
              className="bg-dark-800/80 border border-accent-cyan/30 rounded-xl px-3 py-1 text-xs text-dark-100 focus:outline-none focus:border-accent-cyan w-full"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreateFolder(e.target.value, creatingFolderParentId);
                if (e.key === 'Escape') setCreatingFolderParentId(null);
              }}
              onBlur={(e) => {
                if (e.target.value) submitCreateFolder(e.target.value, creatingFolderParentId);
                else setCreatingFolderParentId(null);
              }}
            />
          </div>
        )}

        {/* Inline Note Creation */}
        {creatingNoteInFolderId && (
          <div className="flex items-center gap-3 px-3 py-2.5">
            <FileText size={16} className="text-accent-violet flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Titre de la note..."
              className="bg-dark-800/80 border border-accent-cyan/30 rounded-xl px-3 py-1 text-xs text-dark-100 focus:outline-none focus:border-accent-cyan w-full"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreateNote(e.target.value, creatingNoteInFolderId);
                if (e.key === 'Escape') setCreatingNoteInFolderId(null);
              }}
              onBlur={(e) => {
                if (e.target.value) submitCreateNote(e.target.value, creatingNoteInFolderId);
                else setCreatingNoteInFolderId(null);
              }}
            />
          </div>
        )}
      </div>
      {renderMoveModal()}
    </div>
  );
}

// ─── NoteItem ────────────────────────────────────────────────
function NoteItem({ note, onSelect, onDelete, onMove }) {
  return (
    <div
      style={{ marginLeft: '6px' }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group hover:bg-dark-700/40 text-dark-300 hover:text-dark-100 transition-all select-none"
      onClick={() => onSelect(note.id)}
    >
      <FileText size={16} className="text-dark-500 group-hover:text-accent-cyan transition-colors flex-shrink-0" />
      <span className="text-sm font-semibold truncate flex-1">{note.title || 'Sans titre'}</span>
      <div style={{ marginRight: '6px' }} className="md:opacity-0 md:group-hover:opacity-100 flex items-center gap-2.5">
        {onMove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove(note.id);
            }}
            className="p-1.5 hover:text-accent-cyan hover:bg-dark-600/40 rounded-lg transition-all"
            title="Déplacer"
          >
            <Folder size={16} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Supprimer cette note ?')) {
              onDelete(note.id);
            }
          }}
          className="p-1.5 hover:text-accent-red hover:bg-dark-600/40 rounded-lg transition-all"
          title="Supprimer"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
