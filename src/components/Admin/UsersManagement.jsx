import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, TrendingUp, CheckCircle2, Clock, User, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchUsersStats(true);

    // Subscribe to real-time changes across all users' data
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'objectives' }, () => fetchUsersStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'progress' }, () => fetchUsersStats())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUsersStats = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      // 1. Fetch ALL users via RPC
      const { data: allUsers, error: usersError } = await supabase.rpc('get_all_users_admin');
      if (usersError) throw usersError;

      // 2. Fetch objectives and progress for stats
      const [{ data: objectives }, { data: progress }] = await Promise.all([
        supabase.from('objectives').select('*'),
        supabase.from('progress').select('*')
      ]);

      const now = new Date();
      const periods = {
        '1d': new Date(now.getTime() - 24 * 60 * 60 * 1000),
        '1w': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        '1m': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        '1y': new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      };

      // Initialize stats for ALL users
      const userStats = (allUsers || []).reduce((acc, user) => {
        acc[user.id] = {
          ...user,
          stats: {
            created: { '1d': 0, '1w': 0, '1m': 0, '1y': 0, total: 0 },
            achieved: { '1d': 0, '1w': 0, '1m': 0, '1y': 0, total: 0 }
          }
        };
        return acc;
      }, {});

      // Process objectives
      (objectives || []).forEach(obj => {
        const uid = obj.user_id;
        if (!userStats[uid]) return;
        
        userStats[uid].stats.created.total++;
        const createdAt = new Date(obj.created_at);
        
        Object.entries(periods).forEach(([key, date]) => {
          if (createdAt >= date) userStats[uid].stats.created[key]++;
        });
      });

      // Process progress to find achieved objectives
      (progress || []).forEach(prog => {
        const uid = prog.user_id;
        if (!userStats[uid]) return;

        const obj = objectives.find(o => o.id === prog.objective_id);
        if (!obj) return;

        if (prog.value >= obj.target) {
          userStats[uid].stats.achieved.total++;
          const updatedAt = new Date(prog.updated_at || prog.created_at);
          
          Object.entries(periods).forEach(([key, date]) => {
            if (updatedAt >= date) userStats[uid].stats.achieved[key]++;
          });
        }
      });

      setUsers(Object.values(userStats).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (error) {
      console.error('Error fetching users stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT ce compte et toutes ses données ? Cette action est irréversible.')) {
      return;
    }

    setDeletingId(userId);
    try {
      const { error } = await supabase.rpc('delete_user_complete', { target_user_id: userId });
      if (error) throw error;
      
      setUsers(users.filter(u => u.id !== userId));
      alert('Utilisateur supprimé avec succès.');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Erreur lors de la suppression : ' + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-accent-cyan" size={40} />
        <p className="text-dark-400 font-medium">Analyse des données utilisateurs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {users.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center border border-dark-600/30">
            <User className="mx-auto text-dark-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-dark-200">Aucun utilisateur trouvé</h3>
            <p className="text-dark-400 mt-2">Les utilisateurs apparaîtront ici dès qu'ils créeront leur premier objectif.</p>
          </div>
        ) : (
          users.map((user) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-[32px] border border-dark-600/30 overflow-hidden shadow-xl"
            >
              <div className="p-6 md:p-8">
                {/* Header User */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-cyan/20 to-accent-violet/20 flex items-center justify-center text-accent-cyan border border-accent-cyan/20">
                      <User size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-dark-100 flex items-center gap-2">
                        {user.email}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <p className="text-[10px] text-dark-500 flex items-center gap-1">
                          <Clock size={10} />
                          Inscrit le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(user.created_at))}
                        </p>
                        {user.last_sign_in_at && (
                          <p className="text-[10px] text-accent-cyan flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            Dernière connexion : {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(user.last_sign_in_at))}
                          </p>
                        )}
                        <p className="text-[10px] bg-dark-600 px-2 py-0.5 rounded text-dark-400 font-mono">
                          ID: {user.id.substring(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={deletingId === user.id}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-red/10 text-accent-red hover:bg-accent-red hover:text-white transition-all font-bold text-sm disabled:opacity-50"
                  >
                    {deletingId === user.id ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                    Supprimer le compte
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <StatCard 
                    label="Dernières 24h" 
                    created={user.stats.created['1d']} 
                    achieved={user.stats.achieved['1d']} 
                    icon={<Clock size={16} />}
                  />
                  <StatCard 
                    label="7 derniers jours" 
                    created={user.stats.created['1w']} 
                    achieved={user.stats.achieved['1w']} 
                    icon={<TrendingUp size={16} />}
                  />
                  <StatCard 
                    label="30 derniers jours" 
                    created={user.stats.created['1m']} 
                    achieved={user.stats.achieved['1m']} 
                    icon={<TrendingUp size={16} />}
                  />
                  <StatCard 
                    label="Total (1 an)" 
                    created={user.stats.created['1y']} 
                    achieved={user.stats.achieved['1y']} 
                    icon={<CheckCircle2 size={16} />}
                  />
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="bg-accent-violet/5 border border-accent-violet/20 rounded-2xl p-6 flex items-start gap-4">
        <AlertTriangle className="text-accent-violet flex-shrink-0 mt-1" size={20} />
        <div className="text-sm">
          <p className="text-dark-200 font-bold mb-1">Note de sécurité</p>
          <p className="text-dark-400 leading-relaxed">
            La suppression supprime toutes les données (objectifs, progrès, catégories) ainsi que l'entrée d'authentification de l'utilisateur grâce à la fonction <code>delete_user_complete</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, created, achieved, icon }) {
  const percentage = created > 0 ? Math.round((achieved / created) * 100) : 0;
  
  return (
    <div className="bg-dark-800/50 border border-dark-600/20 rounded-2xl p-5 hover:border-dark-500/30 transition-all">
      <div className="flex items-center gap-2 text-dark-400 text-xs font-bold uppercase tracking-wider mb-4">
        {icon}
        {label}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-2xl font-black text-dark-100">{created}</div>
          <div className="text-[10px] text-dark-500 uppercase font-bold">Créés</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-accent-green">{achieved}</div>
          <div className="text-[10px] text-dark-500 uppercase font-bold">Atteints</div>
        </div>
      </div>
      
      {/* Mini Progress Bar */}
      <div className="mt-4 h-1.5 w-full bg-dark-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-accent-green rounded-full transition-all duration-1000"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-2 text-[10px] font-bold text-dark-500 text-right">
        {percentage}% de réussite
      </div>
    </div>
  );
}
