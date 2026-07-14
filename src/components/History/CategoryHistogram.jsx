import { useState, useMemo } from 'react';
import { getObjectiveProgress } from '../../utils/progressUtils';
import Modal from '../Shared/Modal';

export default function CategoryHistogram({ objectives, weekProgress, categories }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Compute category distribution for COMPLETED objectives
  const distribution = useMemo(() => {
    if (!objectives || !categories) return [];

    const counts = {};
    objectives.forEach(obj => {
      const prog = getObjectiveProgress(obj, weekProgress || {});
      if (prog >= 1) { // Completed
        counts[obj.categoryId] = (counts[obj.categoryId] || 0) + 1;
      }
    });

    const maxCount = Math.max(0, ...Object.values(counts));
    if (maxCount === 0) return []; // Nothing completed

    return categories
      .map(cat => ({
        ...cat,
        count: counts[cat.id] || 0,
        percent: maxCount > 0 ? ((counts[cat.id] || 0) / maxCount) * 100 : 0
      }))
      .filter(cat => cat.count > 0)
      .sort((a, b) => b.count - a.count); // Sort by most completed
  }, [objectives, weekProgress, categories]);

  if (distribution.length === 0) {
    return null; // Don't render if nothing is completed
  }

  const handleOpen = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsModalOpen(true);
  };

  return (
    <>
      {/* Miniature Sparkline Chart */}
      <div 
        onClick={handleOpen}
        className="flex items-end gap-1.5 h-10 px-2 rounded cursor-pointer group/chart"
        title="Voir la répartition par catégorie"
      >
        {distribution.map(cat => (
          <div 
            key={cat.id}
            className="w-3 rounded-t-md opacity-60 group-hover/chart:opacity-100 transition-opacity"
            style={{ 
              height: `${Math.max(20, cat.percent)}%`, // min height so it's visible
              backgroundColor: cat.color 
            }}
          />
        ))}
      </div>

      {/* Expanded Modal View */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Répartition par catégorie"
        maxWidth="max-w-md"
      >
        <div className="p-6">
          <p className="text-sm text-dark-400 mb-6 text-center">
            Objectifs complétés cette semaine
          </p>

          <div className="flex flex-col gap-4">
            {distribution.map(cat => (
              <div key={cat.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 font-medium" style={{ color: cat.color }}>
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </div>
                  <span className="font-bold text-dark-100">
                    {cat.count} objectif{cat.count > 1 ? 's' : ''}
                  </span>
                </div>
                
                {/* Bar */}
                <div className="h-4 w-full bg-dark-600/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ 
                      width: `${cat.percent}%`,
                      backgroundColor: cat.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
