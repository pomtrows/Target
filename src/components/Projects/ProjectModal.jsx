import { useState, useEffect } from 'react';
import { Target, Calendar, AlertCircle, Check, Search, Plus, X } from 'lucide-react';
import { useTarget } from '../../contexts/TargetContext';
import { useProjects } from '../../contexts/ProjectsContext';
import { getObjectiveProjectProgress } from '../../utils/progressUtils';
import Modal from '../Shared/Modal';

export default function ProjectModal({ isOpen, onClose, projectToEdit = null }) {
  const { state: targetState } = useTarget();
  const { createProject, updateProject } = useProjects();

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('autre');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(2);
  const [status, setStatus] = useState('0-Non lancé');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState([]);
  const [objectiveSearch, setObjectiveSearch] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name || '');
      setCategoryId(projectToEdit.categoryId || projectToEdit.category_id || 'autre');
      setDescription(projectToEdit.description || '');
      setPriority(Number(projectToEdit.priority) || 2);
      setStatus(projectToEdit.status || '0-Non lancé');
      setStartDate(projectToEdit.startDate || projectToEdit.start_date || '');
      setEndDate(projectToEdit.endDate || projectToEdit.end_date || '');
      setSelectedObjectiveIds(projectToEdit.objectiveIds || projectToEdit.objective_ids || []);
    } else {
      setName('');
      setCategoryId(targetState.categories?.[0]?.id || 'autre');
      setDescription('');
      setPriority(2);
      setStatus('0-Non lancé');
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate('');
      setSelectedObjectiveIds([]);
    }
    setError('');
  }, [projectToEdit, isOpen, targetState.categories]);

  if (!isOpen) return null;

  const categories = targetState.categories || [];
  const allObjectives = targetState.objectives || [];

  const filteredObjectives = allObjectives.filter(obj => {
    if (!objectiveSearch.trim()) return true;
    return obj.title?.toLowerCase().includes(objectiveSearch.toLowerCase());
  });

  const toggleObjective = (objId) => {
    setSelectedObjectiveIds(prev => 
      prev.includes(objId) ? prev.filter(id => id !== objId) : [...prev, objId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom du projet est obligatoire.');
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      setError('La date de début ne peut pas être postérieure à la date de fin.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        categoryId,
        description: description.trim(),
        priority: Number(priority),
        status,
        startDate: startDate || null,
        endDate: endDate || null,
        objectiveIds: selectedObjectiveIds
      };

      if (projectToEdit) {
        await updateProject(projectToEdit.id, payload);
      } else {
        await createProject(payload);
      }

      onClose();
    } catch (err) {
      console.error('Error saving project:', err);
      setError("Erreur lors de l'enregistrement du projet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={projectToEdit ? 'Modifier le projet' : 'Nouveau projet 📁'}
      headerPadding="12px 16px"
      bodyPadding="14px 18px"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-dark-200">
        {error && (
          <div 
            className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-xs font-semibold"
            style={{ padding: '6px 10px' }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">
            Nom du projet <span className="text-accent-red">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Rénovation cuisine, Lancement produit..."
            className="w-full bg-dark-900/80 border border-dark-600/60 rounded-xl text-sm text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan transition-colors font-medium"
            style={{ padding: '6px 10px' }}
            required
            autoFocus
          />
        </div>

        {/* Category & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">
              Catégorie <span className="text-accent-red">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-dark-900/80 border border-dark-600/60 rounded-xl text-sm text-dark-100 focus:outline-none focus:border-accent-cyan transition-colors cursor-pointer"
              style={{ padding: '6px 10px' }}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-dark-800 text-dark-100">
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">
              Priorité <span className="text-accent-red">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 1, label: '1 - Haute', color: 'text-accent-red border-accent-red/40 bg-accent-red/10' },
                { val: 2, label: '2 - Moyenne', color: 'text-accent-orange border-accent-orange/40 bg-accent-orange/10' },
                { val: 3, label: '3 - Basse', color: 'text-accent-cyan border-accent-cyan/40 bg-accent-cyan/10' }
              ].map(p => (
                <button
                  type="button"
                  key={p.val}
                  onClick={() => setPriority(p.val)}
                  className={`text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    priority === p.val 
                      ? `${p.color} ring-1 ring-current shadow-sm` 
                      : 'border-dark-600/40 text-dark-400 hover:text-dark-200 hover:bg-dark-700/40'
                  }`}
                  style={{ padding: '5px 8px' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status & Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">
              Statut <span className="text-accent-red">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-dark-900/80 border border-dark-600/60 rounded-xl text-sm text-dark-100 focus:outline-none focus:border-accent-cyan transition-colors cursor-pointer"
              style={{ padding: '6px 10px' }}
            >
              <option value="0-Non lancé" className="bg-dark-800 text-dark-200">⚪ 0-Non lancé</option>
              <option value="1-En cours" className="bg-dark-800 text-accent-cyan">🔵 1-En cours</option>
              <option value="2-Terminé" className="bg-dark-800 text-accent-green">🟢 2-Terminé</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={13} className="text-dark-400" />
              Date de début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-dark-900/80 border border-dark-600/60 rounded-xl text-sm text-dark-100 focus:outline-none focus:border-accent-cyan transition-colors"
              style={{ padding: '6px 10px' }}
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={13} className="text-dark-400" />
              Date de fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-dark-900/80 border border-dark-600/60 rounded-xl text-sm text-dark-100 focus:outline-none focus:border-accent-cyan transition-colors"
              style={{ padding: '6px 10px' }}
            />
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Détaillez les grandes étapes, les enjeux et les livrables de ce projet..."
            className="w-full bg-dark-900/80 border border-dark-600/60 rounded-xl text-sm text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan transition-colors resize-none leading-relaxed"
            style={{ padding: '6px 10px', minHeight: '65px' }}
          />
        </div>

        {/* Linked Objectives Selection */}
        <div 
          className="flex flex-col gap-2 bg-dark-900/40 rounded-2xl border border-dark-600/30"
          style={{ padding: '8px 12px' }}
        >
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-dark-200 uppercase tracking-wider flex items-center gap-1.5">
              <Target size={15} className="text-accent-cyan" />
              Objectifs attribués à ce projet ({selectedObjectiveIds.length})
            </label>
            {selectedObjectiveIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedObjectiveIds([])}
                className="text-[11px] text-dark-400 hover:text-accent-red underline transition-colors cursor-pointer"
                style={{ padding: '2px 6px' }}
              >
                Tout désélectionner
              </button>
            )}
          </div>
          <p className="text-xs text-dark-400">
            Cochez les objectifs existants qui participent à la réalisation de ce projet.
          </p>

          {allObjectives.length > 5 && (
            <div className="relative mt-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
              <input
                type="text"
                value={objectiveSearch}
                onChange={(e) => setObjectiveSearch(e.target.value)}
                placeholder="Filtrer les objectifs..."
                className="w-full bg-dark-800/80 border border-dark-600/40 rounded-xl text-xs text-dark-100 placeholder:text-dark-400 focus:outline-none focus:border-accent-cyan"
                style={{ padding: '6px 10px 6px 28px' }}
              />
            </div>
          )}

          {/* Scrollable Objectives List */}
          <div className="max-h-44 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 mt-1.5 pr-1">
            {filteredObjectives.length === 0 ? (
              <div className="text-center py-3 text-xs text-dark-400">
                Aucun objectif trouvé.
              </div>
            ) : (
              filteredObjectives.map((obj) => {
                const isSelected = selectedObjectiveIds.includes(obj.id);
                const objCat = categories.find(c => c.id === obj.categoryId);
                const isDone = getObjectiveProjectProgress(obj, targetState.progress) >= 1;

                return (
                  <div
                    key={obj.id}
                    onClick={() => toggleObjective(obj.id)}
                    className={`flex items-center justify-between rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-accent-cyan/15 border-accent-cyan/50 text-dark-100 font-semibold'
                        : 'bg-dark-800/50 border-dark-600/30 text-dark-300 hover:bg-dark-700/40 hover:text-dark-100'
                    }`}
                    style={{ padding: '6px 10px' }}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div 
                        className={`rounded flex items-center justify-center border transition-all flex-shrink-0 ${
                          isSelected 
                            ? 'bg-accent-cyan border-accent-cyan text-dark-950 font-black' 
                            : 'border-dark-500 bg-dark-700/60'
                        }`}
                        style={{ width: '16px', height: '16px' }}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                      <span className="truncate">{obj.title}</span>
                      {isDone && (
                        <span 
                          className="text-[10px] font-bold rounded bg-accent-green/20 text-accent-green border border-accent-green/30 flex-shrink-0"
                          style={{ padding: '1px 5px' }}
                        >
                          ✓ Réalisé
                        </span>
                      )}
                    </div>

                    {objCat && (
                      <span 
                        className="flex-shrink-0 text-[10px] rounded font-medium flex items-center gap-1.5 ml-2"
                        style={{ padding: '2px 6px', backgroundColor: `${objCat.color}20`, color: objCat.color }}
                      >
                        {objCat.icon} {objCat.label}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2.5 border-t border-dark-600/30">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold text-dark-300 hover:text-dark-100 hover:bg-dark-700/50 transition-colors cursor-pointer"
            style={{ padding: '6px 14px' }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl text-xs font-bold bg-accent-cyan hover:bg-accent-cyan/90 text-dark-950 transition-all shadow-md shadow-accent-cyan/20 active:scale-95 disabled:opacity-50 cursor-pointer"
            style={{ padding: '6px 18px' }}
          >
            {isSubmitting 
              ? 'Enregistrement...' 
              : projectToEdit 
              ? 'Mettre à jour le projet' 
              : 'Créer le projet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
