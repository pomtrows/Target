import { useState, useEffect, useRef, useCallback } from 'react';
import { useNotes } from '../../contexts/NotesContext';
import { 
  Loader2, Check, CloudOff,
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Link2, Minus,
  Clock, Type, AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2
} from 'lucide-react';

const ToolbarButton = ({ icon: Icon, action, title, shortcut, isActive, onClick }) => (
  <button
    onMouseDown={(e) => {
      e.preventDefault(); // Prevent losing focus/selection
      onClick(action);
    }}
    className={`p-1.5 rounded-lg transition-all active:scale-90 ${
      isActive
        ? 'bg-accent-cyan/20 text-accent-cyan'
        : 'text-dark-400 hover:text-dark-100 hover:bg-dark-600/40'
    }`}
    title={shortcut ? `${title} (${shortcut})` : title}
  >
    <Icon size={16} />
  </button>
);

const Separator = () => <div className="w-px h-5 bg-dark-600/40 mx-1" />;

export default function NoteEditor({ noteId }) {
  const { state, updateNote } = useNotes();
  const note = state.notes.find(n => n.id === noteId);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [activeFormats, setActiveFormats] = useState({});
  const saveTimeoutRef = useRef(null);
  const editorRef = useRef(null);
  const isInitializing = useRef(false);

  // Initialize content when note changes
  useEffect(() => {
    if (note && editorRef.current) {
      isInitializing.current = true;
      setTitle(note.title || '');
      editorRef.current.innerHTML = note.content || '';
      setLastSaved(null);
      isInitializing.current = false;
    }
  }, [noteId]);

  const getEditorContent = () => {
    return editorRef.current ? editorRef.current.innerHTML : '';
  };

  const handleSave = async (newTitle, newContent) => {
    if (!noteId || noteId.startsWith('temp-')) return;
    setSaving(true);
    try {
      await updateNote(noteId, { title: newTitle, content: newContent });
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setSaving(false);
    }
  };

  const scheduleSave = useCallback((newTitle) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(newTitle ?? title, getEditorContent());
    }, 1000);
  }, [title, noteId]);

  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    scheduleSave(e.target.value);
  };

  const handleContentInput = () => {
    if (isInitializing.current) return;
    scheduleSave(title);
    checkActiveFormats();
  };

  // Check which formats are active at cursor
  const checkActiveFormats = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
    });
  };

  // Execute formatting command
  const execFormat = useCallback((action) => {
    switch (action) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikeThrough':
      case 'insertUnorderedList':
      case 'insertOrderedList':
      case 'justifyLeft':
      case 'justifyCenter':
      case 'justifyRight':
      case 'undo':
      case 'redo':
        document.execCommand(action, false, null);
        break;
      case 'h1':
        document.execCommand('formatBlock', false, '<h1>');
        break;
      case 'h2':
        document.execCommand('formatBlock', false, '<h2>');
        break;
      case 'h3':
        document.execCommand('formatBlock', false, '<h3>');
        break;
      case 'quote':
        document.execCommand('formatBlock', false, '<blockquote>');
        break;
      case 'code':
        // Wrap selection in <code>
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const code = document.createElement('code');
          range.surroundContents(code);
        }
        break;
      case 'hr':
        document.execCommand('insertHorizontalRule', false, null);
        break;
      case 'link': {
        const url = window.prompt('URL du lien :');
        if (url) document.execCommand('createLink', false, url);
        break;
      }
      case 'removeFormat':
        document.execCommand('removeFormat', false, null);
        document.execCommand('formatBlock', false, '<div>');
        break;
    }
    checkActiveFormats();
    scheduleSave(title);
  }, [title, scheduleSave]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          execFormat('bold');
          break;
        case 'i':
          e.preventDefault();
          execFormat('italic');
          break;
        case 'u':
          e.preventDefault();
          execFormat('underline');
          break;
        case 's':
          e.preventDefault();
          handleSave(title, getEditorContent());
          break;
        case 'z':
          e.preventDefault();
          execFormat(e.shiftKey ? 'redo' : 'undo');
          break;
      }
    }
  }, [execFormat, title]);

  if (!note) return null;

  const plainText = editorRef.current?.innerText || '';
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const charCount = plainText.length;
  const lineCount = plainText.split('\n').length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="h-full flex flex-col bg-dark-800/20">
      {/* Top bar: save status */}
      <div className="border-b border-dark-600/30 bg-dark-800/40">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest">
            {saving ? (
              <div className="flex items-center gap-2 text-accent-cyan">
                <Loader2 size={12} className="animate-spin" />
                Sauvegarde...
              </div>
            ) : lastSaved ? (
              <div className="flex items-center gap-2 text-accent-green">
                <Check size={12} />
                Enregistré à {lastSaved.toLocaleTimeString()}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-dark-500">
                <CloudOff size={12} />
                Non sauvegardé
              </div>
            )}
          </div>
        </div>

        {/* Formatting toolbar */}
        <div className="flex items-center gap-0.5 px-6 pb-3 overflow-x-auto flex-wrap">
          {/* Undo / Redo */}
          <ToolbarButton icon={Undo2} action="undo" title="Annuler" shortcut="Ctrl+Z" onClick={execFormat} />
          <ToolbarButton icon={Redo2} action="redo" title="Rétablir" shortcut="Ctrl+Shift+Z" onClick={execFormat} />
          
          <Separator />

          {/* Headings */}
          <ToolbarButton icon={Heading1} action="h1" title="Titre 1" onClick={execFormat} />
          <ToolbarButton icon={Heading2} action="h2" title="Titre 2" onClick={execFormat} />
          <ToolbarButton icon={Heading3} action="h3" title="Titre 3" onClick={execFormat} />

          <Separator />

          {/* Text style */}
          <ToolbarButton icon={Bold} action="bold" title="Gras" shortcut="Ctrl+B" isActive={activeFormats.bold} onClick={execFormat} />
          <ToolbarButton icon={Italic} action="italic" title="Italique" shortcut="Ctrl+I" isActive={activeFormats.italic} onClick={execFormat} />
          <ToolbarButton icon={Underline} action="underline" title="Souligné" shortcut="Ctrl+U" isActive={activeFormats.underline} onClick={execFormat} />
          <ToolbarButton icon={Strikethrough} action="strikeThrough" title="Barré" isActive={activeFormats.strikeThrough} onClick={execFormat} />

          <Separator />

          {/* Lists & blocks */}
          <ToolbarButton icon={List} action="insertUnorderedList" title="Liste à puces" isActive={activeFormats.insertUnorderedList} onClick={execFormat} />
          <ToolbarButton icon={ListOrdered} action="insertOrderedList" title="Liste numérotée" isActive={activeFormats.insertOrderedList} onClick={execFormat} />
          <ToolbarButton icon={Quote} action="quote" title="Citation" onClick={execFormat} />
          <ToolbarButton icon={Code} action="code" title="Code" onClick={execFormat} />

          <Separator />

          {/* Alignment */}
          <ToolbarButton icon={AlignLeft} action="justifyLeft" title="Aligner à gauche" isActive={activeFormats.justifyLeft} onClick={execFormat} />
          <ToolbarButton icon={AlignCenter} action="justifyCenter" title="Centrer" isActive={activeFormats.justifyCenter} onClick={execFormat} />
          <ToolbarButton icon={AlignRight} action="justifyRight" title="Aligner à droite" isActive={activeFormats.justifyRight} onClick={execFormat} />

          <Separator />

          {/* Insert */}
          <ToolbarButton icon={Minus} action="hr" title="Séparateur" onClick={execFormat} />
          <ToolbarButton icon={Link2} action="link" title="Lien" onClick={execFormat} />
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Titre de la note"
            className="w-full bg-transparent text-4xl font-black text-dark-100 placeholder-dark-600 focus:outline-none tracking-tight border-none p-0"
          />

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-accent-cyan/20 via-dark-600/30 to-transparent" />

          {/* Rich text editor */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleContentInput}
            onKeyDown={handleKeyDown}
            onMouseUp={checkActiveFormats}
            onKeyUp={checkActiveFormats}
            data-placeholder="Commencez à écrire... Utilisez la barre d'outils ou Ctrl+B, Ctrl+I, Ctrl+U"
            className="note-editor-content min-h-[calc(100vh-450px)] focus:outline-none text-dark-200 leading-relaxed"
            style={{
              fontSize: '1.1rem',
              lineHeight: '1.8',
            }}
          />
        </div>
      </div>

      {/* Stats Footer */}
      <div className="px-6 py-3 border-t border-dark-600/30 bg-dark-800/30">
        <div className="flex items-center justify-between text-[10px] text-dark-500 font-bold uppercase tracking-widest">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <Type size={10} />
              {charCount} car.
            </span>
            <span className="flex items-center gap-1.5">
              <AlignLeft size={10} />
              {wordCount} mots
            </span>
            <span>{lineCount} lignes</span>
            <span className="flex items-center gap-1.5">
              <Clock size={10} />
              ~{readingTime} min de lecture
            </span>
          </div>
          <div>
            {note.updated_at 
              ? `Modifié le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(note.updated_at))}`
              : 'Jamais modifié'
            }
          </div>
        </div>
      </div>
    </div>
  );
}
