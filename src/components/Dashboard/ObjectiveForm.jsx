import { useState, useRef, useEffect } from 'react';
import { useTarget } from '../../contexts/TargetContext';
import Modal from '../Shared/Modal';
import { getCurrentWeekId, getSelectableWeeks, formatWeekLabel } from '../../utils/weekUtils';

export default function ObjectiveForm({ isOpen, onClose, weekId = null, editObjective = null }) {
  const { state, dispatch } = useTarget();

  const [title, setTitle] = useState(editObjective?.title || '');
  const [target, setTarget] = useState(editObjective?.target || 1);
  const [categoryId, setCategoryId] = useState(editObjective?.categoryId || 'autre');
  const [assignType, setAssignType] = useState(
    editObjective
      ? (editObjective.assignments?.length > 0 ? 'week' : 'backlog')
      : (weekId ? 'week' : 'backlog')
  );
  
  const [assignWeeks, setAssignWeeks] = useState(
    editObjective?.assignments?.length > 0 
      ? editObjective.assignments 
      : (weekId ? [weekId] : [getCurrentWeekId()])
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync state when editObjective or isOpen changes
  useEffect(() => {
    if (isOpen) {
      setTitle(editObjective?.title || '');
      setTarget(editObjective?.target || 1);
      setCategoryId(editObjective?.categoryId || 'autre');
      setAssignType(
        editObjective
          ? (editObjective.assignments?.length > 0 ? 'week' : 'backlog')
          : (weekId ? 'week' : 'backlog')
      );
      setAssignWeeks(
        editObjective?.assignments?.length > 0 
          ? editObjective.assignments 
          : (weekId ? [weekId] : [getCurrentWeekId()])
      );
    }
  }, [isOpen, editObjective, weekId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const assignments = [];
    if (assignType === 'week' && assignWeeks.length > 0) {
      assignments.push(...assignWeeks);
    }

    if (editObjective) {
      dispatch({
        type: 'UPDATE_OBJECTIVE',
        payload: {
          id: editObjective.id,
          title: title.trim(),
          target: Number(target),
          categoryId,
          assignments,
        },
      });
    } else {
      dispatch({
        type: 'ADD_OBJECTIVE',
        payload: {
          title: title.trim(),
          target: Number(target),
          categoryId,
          assignments,
        },
      });
    }

    onClose();
    // Reset
    setTitle('');
    setTarget(0);
    setCategoryId('autre');
    setAssignType(weekId ? 'week' : 'backlog');
    setAssignWeeks(weekId ? [weekId] : [getCurrentWeekId()]);
    setIsDropdownOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editObjective ? 'Modifier l\'objectif' : 'Nouvel objectif'}
    >
      <form 
        onSubmit={handleSubmit} 
        style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
      >
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-3">
            Titre de l'objectif
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Courir, Lire, Méditer..."
            autoFocus
            className="w-full bg-dark-700/50 border border-dark-600/50 rounded-xl py-2.5 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-cyan/50 transition-colors"
            style={{ paddingLeft: '16px', paddingRight: '16px' }}
          />
        </div>

        {/* Target quantity */}
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-3">
            Cible quantitative
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-24 bg-dark-700/50 border border-dark-600/50 rounded-xl py-2.5 text-sm text-dark-100 focus:outline-none focus:border-accent-cyan/50 transition-colors"
            style={{ paddingLeft: '16px', paddingRight: '16px' }}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-3">
            Catégorie
          </label>
          <div className="grid grid-cols-2 gap-3">
            {state.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={`flex items-center gap-2 rounded-xl text-sm transition-all ${
                  categoryId === cat.id
                    ? 'border-2'
                    : 'border border-dark-600/30 hover:border-dark-500/50'
                }`}
                style={
                  categoryId === cat.id
                    ? {
                        borderColor: cat.color,
                        backgroundColor: `${cat.color}15`,
                        color: cat.color,
                        padding: '8px 16px',
                      }
                    : { color: 'var(--color-dark-200)', padding: '8px 16px' }
                }
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="text-base font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Assignment */}
        <div>
          <label className="block text-sm font-medium text-dark-200 mb-3">
            Assignation
          </label>
          <div className="flex gap-3 mb-4">
            <button
              type="button"
              onClick={() => setAssignType('week')}
              className={`rounded-xl text-sm font-medium transition-all ${
                assignType === 'week'
                  ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
                  : 'bg-dark-700/50 text-dark-400 border border-dark-600/30 hover:text-dark-300'
              }`}
              style={{ padding: '6px 12px' }}
            >
              📅 Semaine
            </button>
            <button
              type="button"
              onClick={() => setAssignType('backlog')}
              className={`rounded-xl text-sm font-medium transition-all ${
                assignType === 'backlog'
                  ? 'bg-accent-violet/20 text-accent-violet border border-accent-violet/30'
                  : 'bg-dark-700/50 text-dark-400 border border-dark-600/30 hover:text-dark-300'
              }`}
              style={{ padding: '6px 12px' }}
            >
              📋 Backlog
            </button>
          </div>

          {assignType === 'week' && (
            <div className="relative mt-4" style={{ marginTop: '16px' }} ref={dropdownRef}>
              <button 
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between bg-dark-700/50 border border-dark-600/50 rounded-xl py-2.5 text-sm text-dark-100 focus:outline-none focus:border-accent-cyan/50 transition-colors"
                style={{ paddingLeft: '16px', paddingRight: '16px' }}
              >
                <span className="truncate">
                  {assignWeeks.length === 0 
                    ? "Sélectionner des semaines..." 
                    : assignWeeks.length === 1 
                      ? formatWeekLabel(assignWeeks[0]) 
                      : `${assignWeeks.length} semaines sélectionnées`}
                </span>
                <span className="text-dark-400 text-xs">▼</span>
              </button>

              {isDropdownOpen && (
                <div className="absolute z-10 top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-dark-800 border border-dark-600/50 rounded-xl shadow-xl p-2 space-y-1">
                  {getSelectableWeeks(4, 12).map(week => (
                    <label key={week} className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-700/50 cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={assignWeeks.includes(week)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignWeeks([...assignWeeks, week]);
                          } else {
                            setAssignWeeks(assignWeeks.filter(w => w !== week));
                          }
                        }}
                        className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-accent-cyan focus:ring-accent-cyan/50 focus:ring-offset-dark-800"
                      />
                      <span className={`text-sm ${assignWeeks.includes(week) ? 'text-accent-cyan font-medium' : 'text-dark-200'}`}>
                        {formatWeekLabel(week)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-dark-400 bg-dark-700/50 border border-dark-600/30 hover:text-dark-200 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-accent-cyan to-accent-violet hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {editObjective ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
