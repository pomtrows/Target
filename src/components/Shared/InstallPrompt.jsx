import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState('other');

  useEffect(() => {
    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isStandalone) return;

    if (isIos) {
      setPlatform('ios');
      // Show iOS prompt after a short delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setPlatform('android');
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-6 right-6 z-[100] md:left-auto md:right-8 md:w-80"
      >
        <div className="bg-dark-800 border border-dark-600/50 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-cyan/5 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <button 
            onClick={() => setShowPrompt(false)}
            className="absolute top-3 right-3 p-1 text-dark-500 hover:text-dark-200 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-violet p-[2px] flex-shrink-0">
              <div className="w-full h-full rounded-[10px] bg-dark-800 flex items-center justify-center overflow-hidden">
                <img src="/pwa-icon.png" alt="Target" className="w-10 h-10 object-contain" />
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-sm font-bold text-dark-100">Installer Target</h3>
              <p className="text-xs text-dark-400 mt-1 leading-relaxed">
                {platform === 'ios' 
                  ? "Appuyez sur le bouton de partage et 'Sur l'écran d'accueil'" 
                  : "Ajoutez Target à votre écran d'accueil pour un accès rapide."}
              </p>
            </div>
          </div>

          <div className="mt-5">
            {platform === 'ios' ? (
              <div className="flex items-center justify-center gap-2 py-2 px-4 bg-dark-700/50 rounded-xl border border-dark-600/30 text-xs font-medium text-dark-200">
                <Share size={14} className="text-accent-cyan" />
                <span>Utilisez le menu de partage Safari</span>
              </div>
            ) : (
              <button
                onClick={handleInstall}
                className="w-full py-2.5 px-4 rounded-xl bg-accent-cyan text-dark-900 text-xs font-bold hover:bg-white transition-all flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Installer maintenant
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
