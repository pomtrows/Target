import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, X, Volume2, VolumeX, RefreshCcw } from 'lucide-react';
import { GOAL_TYPES } from '../../data/exercisesCatalog';

const STATES = {
  PREPARATION: 'preparation', // 5s before start
  EXERCISE: 'exercise',
  REST: 'rest',
  FINISHED: 'finished'
};

export default function WorkoutPlayer({ session, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentState, setCurrentState] = useState(STATES.PREPARATION);
  const [timeLeft, setTimeLeft] = useState(5); // 5s prep
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  
  const currentExercise = session.exercises[currentIndex];
  const nextExercise = session.exercises[currentIndex + 1];
  
  const totalExercises = session.exercises.length;
  const progress = ((currentIndex) / totalExercises) * 100;

  // Initialize Audio Context for beeps
  useEffect(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
    } catch (e) {
      console.warn("AudioContext not supported");
    }
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playBeep = useCallback((frequency = 800, duration = 0.1, type = 'sine') => {
    if (isMuted || !audioContextRef.current) return;
    
    try {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
      
      gainNode.gain.setValueAtTime(0.5, audioContextRef.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      oscillator.start();
      oscillator.stop(audioContextRef.current.currentTime + duration);
    } catch (e) {
      console.error("Error playing beep", e);
    }
  }, [isMuted]);

  const speak = useCallback((text) => {
    if (isMuted || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  const startExercise = useCallback(() => {
    // Assuming next exercise is now currentExercise since we incremented index before calling or it's the first one
    const ex = session.exercises[currentIndex];
    setCurrentState(STATES.EXERCISE);
    if (ex.goalType === GOAL_TYPES.TIME) {
      setTimeLeft(ex.targetValue);
      speak(`Début de l'exercice : ${ex.name} pour ${ex.targetValue} secondes`);
    } else {
      setTimeLeft(0); // Not a timer for reps
      speak(`Début de l'exercice : ${ex.name}, ${ex.targetValue} répétitions`);
    }
  }, [currentIndex, session.exercises, speak]);

  const handleNextState = useCallback(() => {
    clearInterval(timerRef.current);
    
    if (currentState === STATES.PREPARATION) {
      startExercise();
    } 
    else if (currentState === STATES.EXERCISE) {
      playBeep(400, 0.5, 'square'); // Gong final
      
      if (currentExercise?.restTime > 0 && currentIndex < totalExercises - 1) {
        // Go to rest
        setCurrentState(STATES.REST);
        setTimeLeft(currentExercise.restTime);
        if (nextExercise) {
          speak(`Récupération. Prochain exercice : ${nextExercise.name}`);
        }
      } else {
        // No rest or last exercise
        if (currentIndex < totalExercises - 1) {
          setCurrentIndex(prev => prev + 1);
          setCurrentState(STATES.PREPARATION);
          setTimeLeft(3); // Short prep between without rest
        } else {
          setCurrentState(STATES.FINISHED);
          speak('Séance terminée. Bravo !');
        }
      }
    } 
    else if (currentState === STATES.REST) {
      if (currentIndex < totalExercises - 1) {
        setCurrentIndex(prev => prev + 1);
        startExercise(); // Start next directly
      } else {
        setCurrentState(STATES.FINISHED);
      }
    }
  }, [currentState, currentIndex, currentExercise, nextExercise, totalExercises, playBeep, speak, startExercise]);

  // Handle State Transitions and Timer Logic
  useEffect(() => {
    if (isPaused || currentState === STATES.FINISHED) return;

    // Ne pas utiliser le chronomètre si on est sur un exercice à répétitions
    if (currentState === STATES.EXERCISE && currentExercise?.goalType === GOAL_TYPES.REPS) {
      return;
    }

    if (timeLeft <= 0) {
      handleNextState();
      return;
    }

    // --- Side Effects during countdown ---
    if (currentState === STATES.EXERCISE && currentExercise?.goalType === GOAL_TYPES.TIME) {
      // Bips de fin
      if (timeLeft <= 5 && timeLeft > 0) {
        playBeep(800, 0.1); // Bip court
      }
      
      // Rappel vocal toutes les 10s (si > 10s)
      if (timeLeft % 10 === 0 && timeLeft > 10) {
        speak(`${timeLeft} secondes`);
      }
    }
    
    if (currentState === STATES.REST && timeLeft <= 3 && timeLeft > 0) {
      playBeep(600, 0.1);
    }

    timerRef.current = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timerRef.current);
  }, [isPaused, currentState, timeLeft, handleNextState, currentExercise, playBeep, speak]);


  // Controls
  const handlePlayPause = () => {
    setIsPaused(!isPaused);
  };

  const handleNext = () => {
    handleNextState();
  };

  const handlePrev = () => {
    if (currentState === STATES.EXERCISE) {
      const ex = currentExercise;
      // If we are early in the exercise (< 3s elapsed), go to previous exercise
      const timeElapsed = ex.goalType === GOAL_TYPES.TIME ? ex.targetValue - timeLeft : 0;
      
      if (timeElapsed < 3 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        setCurrentState(STATES.PREPARATION);
        setTimeLeft(3);
      } else {
        // Reboot current
        startExercise();
      }
    } else if (currentState === STATES.REST) {
       // Restart current exercise
       startExercise();
    }
  };

  const handleReplaySession = () => {
    setCurrentIndex(0);
    setCurrentState(STATES.PREPARATION);
    setTimeLeft(5);
    setIsPaused(false);
  };

  // UI Helpers
  const formatTimeDisplay = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m > 0 ? m + ':' : ''}${s.toString().padStart(m > 0 ? 2 : 1, '0')}`;
  };

  const isTimerMode = currentState === STATES.EXERCISE && currentExercise?.goalType === GOAL_TYPES.TIME;
  const isRepsMode = currentState === STATES.EXERCISE && currentExercise?.goalType === GOAL_TYPES.REPS;

  return (
    <div className="fixed inset-0 z-[200] bg-dark-900 flex flex-col text-dark-100 font-sans">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 z-10 relative">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-3 bg-dark-800/80 rounded-full hover:bg-dark-700 transition-colors backdrop-blur-sm"
          >
            <X size={24} />
          </button>
          <div>
            <h3 className="font-bold text-lg leading-tight">{session.name}</h3>
            <div className="text-xs text-dark-400 font-medium tracking-wider uppercase">
              {currentIndex + 1} / {totalExercises}
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className="p-3 bg-dark-800/80 rounded-full hover:bg-dark-700 transition-colors backdrop-blur-sm"
        >
          {isMuted ? <VolumeX size={24} className="text-dark-400" /> : <Volume2 size={24} className="text-accent-cyan" />}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-dark-800 fixed top-0 left-0 z-20">
        <motion.div 
          className="h-full bg-gradient-to-r from-accent-cyan to-accent-violet"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-6 pb-32">
        
        <AnimatePresence mode="wait">
          {currentState === STATES.FINISHED ? (
            <motion.div 
              key="finished"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="text-center"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-accent-cyan to-accent-violet rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(34,211,238,0.4)]">
                <RefreshCcw size={40} className="text-dark-900" />
              </div>
              <h2 className="text-4xl font-black mb-4">Séance Terminée !</h2>
              <p className="text-dark-400 text-lg mb-10 max-w-sm mx-auto">Excellent travail. Prenez le temps de bien vous hydrater et vous étirer.</p>
              
              <div className="flex gap-4 justify-center">
                <button 
                  onClick={onClose}
                  className="px-8 py-4 bg-dark-800 text-dark-100 font-bold rounded-2xl hover:bg-dark-700 transition-colors"
                >
                  Fermer
                </button>
                <button 
                  onClick={handleReplaySession}
                  className="px-8 py-4 bg-gradient-to-r from-accent-cyan to-accent-violet text-white font-bold rounded-2xl shadow-lg shadow-accent-cyan/20 hover:scale-105 transition-transform"
                >
                  Recommencer
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key={currentState + currentIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-2xl flex flex-col items-center"
            >
              
              {currentState === STATES.PREPARATION && (
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-dark-400 mb-2">Préparez-vous</h2>
                  <h1 className="text-5xl font-black text-dark-100 mb-8">{currentExercise?.name}</h1>
                  <div className="text-9xl font-black text-accent-cyan font-mono leading-none tracking-tighter">
                    {timeLeft}
                  </div>
                </div>
              )}

              {currentState === STATES.REST && (
                <div className="text-center w-full">
                  <h2 className="text-3xl font-black text-accent-violet mb-8 tracking-wide">RÉCUPÉRATION</h2>
                  
                  <div className="text-[10rem] font-black text-dark-100 font-mono leading-none tracking-tighter mb-12 drop-shadow-2xl">
                    {formatTimeDisplay(timeLeft)}
                  </div>
                  
                  <div className="bg-dark-800/50 p-6 rounded-3xl border border-dark-600/30">
                    <p className="text-sm text-dark-400 font-bold uppercase tracking-wider mb-2">À suivre</p>
                    <p className="text-2xl font-bold text-dark-100">{nextExercise?.name}</p>
                  </div>
                </div>
              )}

              {currentState === STATES.EXERCISE && currentExercise && (
                <div className="w-full flex flex-col items-center">
                  <div className="w-full max-w-xs md:max-w-sm aspect-square bg-dark-800 rounded-3xl overflow-hidden mb-8 shadow-2xl relative border border-dark-600/50 mx-auto">
                    {currentExercise.mediaUrl && (
                      <img src={currentExercise.mediaUrl} alt={currentExercise.name} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute bottom-4 left-6">
                       <span className="px-3 py-1 bg-dark-900/80 backdrop-blur-md rounded-lg text-xs font-bold uppercase tracking-wider text-accent-cyan">
                         {currentExercise.category}
                       </span>
                    </div>
                  </div>
                  
                  <h2 className="text-4xl md:text-5xl font-black text-center mb-6 leading-tight">
                    {currentExercise.name}
                  </h2>
                  
                  {isTimerMode ? (
                    <div className={`text-8xl md:text-9xl font-black font-mono leading-none tracking-tighter ${timeLeft <= 5 ? 'text-accent-red animate-pulse' : 'text-dark-100'}`}>
                      {formatTimeDisplay(timeLeft)}
                    </div>
                  ) : isRepsMode ? (
                    <div className="flex flex-col items-center">
                      <div className="text-8xl md:text-9xl font-black font-mono leading-none tracking-tighter text-accent-cyan">
                        {currentExercise.targetValue}
                      </div>
                      <div className="text-2xl font-bold text-dark-400 uppercase tracking-widest mt-2">Répétitions</div>
                    </div>
                  ) : null}
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Controls Bar */}
      {currentState !== STATES.FINISHED && (
        <div className="fixed bottom-0 left-0 w-full p-6 md:p-8 bg-gradient-to-t from-dark-900 via-dark-900/95 to-transparent flex justify-center pb-safe">
          <div className="flex items-center gap-6">
            <button 
              onClick={handlePrev}
              className="w-14 h-14 rounded-full bg-dark-800 border border-dark-600 flex items-center justify-center text-dark-200 hover:bg-dark-700 transition-all hover:scale-105"
            >
              <SkipBack size={24} fill="currentColor" />
            </button>
            
            <button 
              onClick={handlePlayPause}
              className="w-20 h-20 rounded-full bg-dark-100 text-dark-900 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105 transition-all"
            >
              {isPaused ? <Play size={36} fill="currentColor" className="ml-2" /> : <Pause size={36} fill="currentColor" />}
            </button>
            
            <button 
              onClick={handleNext}
              className="w-14 h-14 rounded-full bg-dark-800 border border-dark-600 flex items-center justify-center text-dark-200 hover:bg-dark-700 transition-all hover:scale-105"
            >
              <SkipForward size={24} fill="currentColor" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
