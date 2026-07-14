// Instance globale du contexte audio, partagée par toute l'application
export let sharedAudioContext = null;

export const unlockAudioAndTTS = () => {
  // 1. Initialiser et débloquer le contexte Audio Web global
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioContext = new AudioContextClass();
    }
  }

  if (sharedAudioContext) {
    try {
      // Jouer un son très court et silencieux pour forcer le déverrouillage
      const oscillator = sharedAudioContext.createOscillator();
      const gainNode = sharedAudioContext.createGain();
      gainNode.gain.value = 0;
      oscillator.connect(gainNode);
      gainNode.connect(sharedAudioContext.destination);
      oscillator.start(0);
      oscillator.stop(0.01);
      
      // Résumer le contexte s'il est suspendu
      if (sharedAudioContext.state === 'suspended') {
        sharedAudioContext.resume();
      }
    } catch (e) {
      console.warn("AudioContext unlock failed:", e);
    }
  }

  // 2. Débloquer l'audio HTML5 classique
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    audio.volume = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  } catch (e) {
    console.warn("HTML5 Audio unlock failed:", e);
  }
};
