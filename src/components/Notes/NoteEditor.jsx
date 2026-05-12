import { useState, useEffect, useRef, useCallback } from 'react';
import { useNotes } from '../../contexts/NotesContext';
import { 
  Loader2, Check, CloudOff,
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Code, Link2, Minus, Star,
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
      // Small delay to ensure isInitializing is set back after DOM updates
      requestAnimationFrame(() => { isInitializing.current = false; });
    }
  }, [noteId]);

  const getEditorContent = () => {
    return editorRef.current ? editorRef.current.innerHTML : '';
  };

  const handleSave = useCallback(async (newTitle, newContent) => {
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
  }, [noteId, updateNote]);

  const scheduleSave = useCallback((newTitle) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(newTitle ?? title, getEditorContent());
    }, 1000);
  }, [title, noteId, handleSave]);

  // MutationObserver to catch ALL changes (including inside nested contentEditable spans)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    const observer = new MutationObserver(() => {
      if (isInitializing.current) return;
      scheduleSave(title);
    });
    
    observer.observe(editor, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['checked'],
    });
    
    return () => observer.disconnect();
  }, [noteId, title, scheduleSave]);

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
    // Check if cursor is inside a checklist or starred item
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      let node = sel.anchorNode;
      let inChecklist = false;
      let inStar = false;
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'UL' && node.classList.contains('checklist')) {
          inChecklist = true;
        }
        if (node.getAttribute?.('data-star') === 'true') {
          inStar = true;
        }
        node = node.parentNode;
      }
      setActiveFormats(prev => ({ ...prev, checklist: inChecklist, star: inStar }));
    }
  };

  // Execute formatting command
  const execFormat = useCallback((action) => {
    // Preserve star status across list toggles
    const selBefore = window.getSelection();
    let wasStarred = false;
    if (selBefore.rangeCount > 0 && ['insertUnorderedList', 'insertOrderedList', 'checklist'].includes(action)) {
      let node = selBefore.anchorNode;
      while (node && node !== editorRef.current && !['DIV', 'P', 'LI', 'H1', 'H2', 'H3'].includes(node.nodeName)) {
        node = node.parentNode;
      }
      wasStarred = node?.getAttribute?.('data-star') === 'true';
    }

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
      case 'checklist': {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
          let node = sel.anchorNode;
          let li = null;
          let ul = null;
          
          while (node && node !== editorRef.current) {
            if (node.nodeName === 'LI') li = node;
            if (node.nodeName === 'UL') ul = node;
            node = node.parentNode;
          }
          
          if (ul && ul.classList.contains('checklist')) {
            if (li && li.getAttribute('data-checked') === 'true') {
              // Appuie 3: Checked -> None (Supprimer et débarrer)
              li.removeAttribute('data-checked');
              document.execCommand('insertUnorderedList', false, null);
            } else if (li) {
              // Appuie 2: Unchecked -> Checked (Barrer)
              li.setAttribute('data-checked', 'true');
            }
          } else {
            // Appuie 1: None -> Unchecked (Créer)
            document.execCommand('insertUnorderedList', false, null);
            // Find the UL we just created or entered
            let checkNode = window.getSelection().anchorNode;
            while (checkNode && checkNode !== editorRef.current) {
              if (checkNode.nodeName === 'UL') {
                checkNode.classList.add('checklist');
                break;
              }
              checkNode = checkNode.parentNode;
            }
          }
        }
        break;
      }
      case 'star': {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
          let node = sel.anchorNode;
          // Go up until we hit a block element or the editor
          while (node && node !== editorRef.current && 
                 !['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE'].includes(node.nodeName)) {
            node = node.parentNode;
          }
          
          if (node === editorRef.current || (node && node.nodeType === 3)) {
            // Text is likely directly in the editor, wrap it in a div
            document.execCommand('formatBlock', false, 'div');
            // Re-find the block
            const newSel = window.getSelection();
            node = newSel.anchorNode;
            while (node && node.parentNode !== editorRef.current) node = node.parentNode;
          }

          if (node && node.nodeType === 1) {
            const isStarred = node.getAttribute('data-star') === 'true';
            if (isStarred) node.removeAttribute('data-star');
            else node.setAttribute('data-star', 'true');
          }
        }
        break;
      }
      case 'removeFormat':
        document.execCommand('removeFormat', false, null);
        document.execCommand('formatBlock', false, '<div>');
        break;
    }

    // Re-apply star if it was preserved
    if (wasStarred) {
      setTimeout(() => {
        const selAfter = window.getSelection();
        if (selAfter.rangeCount > 0) {
          let node = selAfter.anchorNode;
          // Find the block or LI
          while (node && node !== editorRef.current && 
                 !['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE'].includes(node.nodeName)) {
            node = node.parentNode;
          }
          if (node && node !== editorRef.current) {
            node.setAttribute('data-star', 'true');
            scheduleSave(title);
          }
        }
      }, 0);
    }

    checkActiveFormats();
    scheduleSave(title);
  }, [title, scheduleSave, checkActiveFormats]);

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
        case '&':
          e.preventDefault();
          execFormat('checklist');
          break;
        case 'é':
          e.preventDefault();
          execFormat('star');
          break;
      }
    }
  }, [execFormat, title, scheduleSave]);

  if (!note) return null;


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
          <ToolbarButton icon={CheckSquare} action="checklist" title="Case à cocher" shortcut="Ctrl+&" isActive={activeFormats.checklist} onClick={execFormat} />
          <ToolbarButton icon={Star} action="star" title="Étoile" shortcut="Ctrl+é" isActive={activeFormats.star} onClick={execFormat} />
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
            className="w-full bg-transparent text-4xl font-black text-dark-100 placeholder-dark-600 focus:outline-none tracking-tight border-none p-0 text-center"
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
            onClick={(e) => {
              // Toggle data-checked if clicking on the checkbox area (pseudo-element)
              const li = e.target.closest('li');
              if (li && li.parentNode.classList.contains('checklist')) {
                const rect = li.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                // If click is in the gutter area (where the checkbox is)
                if (clickX < 30) {
                  const isChecked = li.getAttribute('data-checked') === 'true';
                  li.setAttribute('data-checked', !isChecked);
                  scheduleSave(title);
                }
              }
            }}
            data-placeholder="Commencez à écrire... Utilisez la barre d'outils ou Ctrl+B, Ctrl+I, Ctrl+U"
            className="note-editor-content min-h-[calc(100vh-450px)] focus:outline-none text-dark-200 leading-relaxed"
            style={{
              fontSize: '1.1rem',
              lineHeight: '1.8',
            }}
          />
        </div>
      </div>


    </div>
  );
}
