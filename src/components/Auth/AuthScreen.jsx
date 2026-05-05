import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Loader2, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { login, signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!isLogin) {
        if (password !== confirmPassword) {
          throw new Error('Les mots de passe ne correspondent pas');
        }
        await signup(email, password);
        setSuccess(true);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-cyan/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-violet/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center" style={{ marginBottom: '50px' }}>

          <h1 className="text-4xl font-black tracking-tighter text-dark-100 mb-3">TARGET</h1>
          <p className="text-dark-400 text-sm uppercase tracking-[0.2em] font-bold">Performance Tracking System</p>
        </div>

        <div className="glass border border-dark-600/30 rounded-[32px] shadow-2xl relative overflow-hidden" style={{ padding: '32px' }}>
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="w-16 h-16 bg-accent-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={32} className="text-accent-green" />
                </div>
                <h2 className="text-2xl font-bold text-dark-100 mb-2">Vérifiez vos emails</h2>
                <p className="text-dark-400 mb-6">Un lien de confirmation vous a été envoyé à {email}.</p>
                <button
                  onClick={() => { setSuccess(false); setIsLogin(true); }}
                  className="w-full py-4 rounded-xl bg-dark-700 text-dark-200 font-bold hover:bg-dark-600 transition-all"
                >
                  Retour à la connexion
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={isLogin ? 'login' : 'signup'}
                initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
              >
                <h2 className="text-2xl font-bold text-dark-100 text-center" style={{ marginBottom: '30px' }}>
                  {isLogin ? 'Bon retour parmi nous' : 'Créer votre compte'}
                </h2>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  <div>
                    <label className="block text-xs font-bold text-dark-400 uppercase tracking-wider mb-3 ml-1">
                      Adresse Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-dark-800/50 border border-dark-600/30 rounded-xl text-dark-100 placeholder-dark-600 focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/50 transition-all"
                        style={{ padding: '12px 16px 12px 56px' }}
                        placeholder="nom@exemple.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-dark-400 uppercase tracking-wider mb-3 ml-1">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-dark-800/50 border border-dark-600/30 rounded-xl text-dark-100 placeholder-dark-600 focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/50 transition-all"
                        style={{ padding: '12px 16px 12px 56px' }}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {!isLogin && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <label className="block text-xs font-bold text-dark-400 uppercase tracking-wider mb-3 ml-1">
                        Confirmer le mot de passe
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500" size={18} />
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-dark-800/50 border border-dark-600/30 rounded-xl text-dark-100 placeholder-dark-600 focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/50 transition-all"
                          style={{ padding: '16px 16px 16px 56px' }}
                          placeholder="••••••••"
                        />
                      </div>
                    </motion.div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red text-xs animate-shake">
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 mt-4 rounded-xl bg-gradient-to-r from-accent-cyan to-accent-violet text-dark-900 font-black flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        {isLogin ? 'Se connecter' : "S'inscrire"}
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-10 pt-8 border-t border-dark-600/30 text-center">
                  <p className="text-dark-400 text-sm">
                    {isLogin ? "Vous n'avez pas de compte ?" : "Vous avez déjà un compte ?"}
                    <button
                      onClick={() => { setIsLogin(!isLogin); setError(null); }}
                      className="ml-2 font-bold text-accent-cyan hover:text-white transition-colors"
                    >
                      {isLogin ? "Créer un compte" : "Se connecter"}
                    </button>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
