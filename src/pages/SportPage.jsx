import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Play, Edit2, Trash2, Clock, Activity, Dumbbell } from 'lucide-react';
import { useSport } from '../contexts/SportContext';
import SessionForm from '../components/Sport/SessionForm';
import WorkoutPlayer from '../components/Sport/WorkoutPlayer';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

export default function SportPage() {
  const { sessions, deleteSession } = useSport();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState(null);
  const [sessionToPlay, setSessionToPlay] = useState(null);
  const [sessionToDelete, setSessionToDelete] = useState(null);

  const handleEdit = (session) => {
    setSessionToEdit(session);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSessionToEdit(null);
    setIsFormOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete.id);
      setSessionToDelete(null);
    }
  };

  if (sessionToPlay) {
    return <WorkoutPlayer session={sessionToPlay} onClose={() => setSessionToPlay(null)} />;
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none flex flex-col items-center text-center" style={{ marginBottom: '56px' }}>
        <h1 className="text-3xl font-black text-dark-100 flex items-center justify-center gap-3">
          <div className="p-3 bg-gradient-to-br from-accent-cyan/20 to-accent-violet/20 rounded-2xl">
            <Dumbbell className="text-accent-cyan" size={28} />
          </div>
          Sport & Fitness
        </h1>
        <p className="text-dark-400 mt-2 font-medium max-w-md">Mes séances</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-24">
        {sessions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-dark-800/50 rounded-3xl border border-dark-600/30">
            <div className="w-20 h-20 bg-dark-700 rounded-full flex items-center justify-center mb-6">
              <Activity className="text-dark-400" size={40} />
            </div>
            <h2 className="text-xl font-bold text-dark-100 mb-2">Aucune séance pour le moment</h2>
            <p className="text-dark-400 max-w-md" style={{ marginBottom: '40px' }}>Commencez par créer votre première séance personnalisée en sélectionnant des exercices de notre catalogue.</p>
            <button
              onClick={handleCreate}
              style={{ padding: '8px 20px', width: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              className="bg-gradient-to-r from-accent-cyan to-accent-violet text-white font-bold rounded-2xl hover:opacity-90 transition-opacity shadow-lg shadow-accent-cyan/20"
            >
              <Plus size={22} className="flex-shrink-0" />
              <span>Créer ma première séance</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <motion.div
                key={session.id}
                layoutId={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ padding: '16px 20px 12px 20px' }}
                className="bg-dark-700/40 rounded-[24px] border border-dark-600 flex flex-col hover:bg-dark-700/60 shadow-xl hover:shadow-2xl transition-all duration-300 relative group"
              >
                <div className="flex justify-between items-start mb-4 px-2">
                  <h3 className="text-lg font-bold text-dark-100 line-clamp-1">{session.name}</h3>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleEdit(session)}
                      className="p-2.5 text-dark-400 hover:text-accent-cyan bg-dark-700/50 hover:bg-dark-700 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => setSessionToDelete(session)}
                      className="p-2.5 text-dark-400 hover:text-accent-red bg-dark-700/50 hover:bg-dark-700 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-dark-400 px-2" style={{ marginBottom: '10px' }}>
                  <div className="flex items-center gap-1.5">
                    <Clock size={16} className="text-accent-cyan" />
                    {formatTime(session.totalTime)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity size={16} className="text-accent-violet" />
                    {session.exercises?.length || 0} exercices
                  </div>
                </div>

                <div className="mt-auto">
                  <button
                    onClick={() => {
                      if ('speechSynthesis' in window) {
                        const unlockUtterance = new SpeechSynthesisUtterance('');
                        unlockUtterance.volume = 0;
                        window.speechSynthesis.speak(unlockUtterance);
                      }
                      setSessionToPlay(session);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-accent-cyan/10 text-accent-cyan font-bold rounded-xl hover:bg-accent-cyan/20 transition-colors"
                  >
                    <Play size={18} fill="currentColor" />
                    Lancer la séance
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button (if not empty) */}
      {sessions.length > 0 && (
        <button
          onClick={handleCreate}
          className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-accent-cyan to-accent-violet text-white rounded-full flex items-center justify-center shadow-lg shadow-accent-cyan/20 hover:scale-105 transition-transform z-10"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <SessionForm
            session={sessionToEdit}
            onClose={() => setIsFormOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {sessionToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSessionToDelete(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-800 rounded-3xl border border-dark-600/30 p-6 w-full max-w-sm relative z-10 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-accent-red/10 flex items-center justify-center mb-4 text-accent-red">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-dark-100 mb-2">Supprimer la séance ?</h3>
              <p className="text-dark-400 mb-6 text-sm">
                Êtes-vous sûr de vouloir supprimer la séance "{sessionToDelete.name}" ? Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSessionToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl text-dark-200 font-medium hover:bg-dark-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-2.5 bg-accent-red text-white font-bold rounded-xl hover:bg-red-500 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
