import { useState, useEffect } from 'react';
import { getAvailableLivreurs } from '../services/logistiqueService';
import { getCommandes } from '../services/commandeService';
import { Commande, User } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell
} from 'recharts';
import { TrendingUp, Award, Target, Coins } from 'lucide-react';
import { startOfDay, subDays, isAfter } from 'date-fns';

import { calculateLogisticalStats } from '../services/financialService';

interface StaffStats {
  id: string;
  nom: string;
  total_cmds: number;
  livrees: number;
  retours: number;
  annulees: number;
  reportees: number;
  ca_livraison: number;
  taux_succes: number;
}

export const StaffPerformance = () => {
  const [stats, setStats] = useState<StaffStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('month');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [livreurs, allCmds] = await Promise.all([
          getAvailableLivreurs(),
          getCommandes()
        ]);

        const now = new Date();
        
        const ordersByLivreur: Record<string, Commande[]> = {};
        allCmds.forEach((c: Commande) => {
          if (!c.livreur_id) return;
          if (!ordersByLivreur[c.livreur_id]) ordersByLivreur[c.livreur_id] = [];
          ordersByLivreur[c.livreur_id].push(c);
        });

        const staffStats: StaffStats[] = livreurs.map((livreur: User) => {
          const livreurCmds = (ordersByLivreur[livreur.id] || []).filter((c: Commande) => {
            const dCreated = new Date(c.date_creation);
            const dDelivered = c.date_livraison_effective ? new Date(c.date_livraison_effective) : null;
            
            const isSucces = ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase());
            // Use delivery date for successful orders, creation date otherwise
            const activeDate = (isSucces && dDelivered) ? dDelivered : dCreated;
            
            if (timeFilter === 'today') return isAfter(activeDate, startOfDay(now));
            if (timeFilter === 'week') return isAfter(activeDate, subDays(now, 7));
            if (timeFilter === 'month') return isAfter(activeDate, subDays(now, 30));
            return true;
          });
          
          const logStats = calculateLogisticalStats(livreurCmds);
          
          const ca_livraison = livreurCmds.reduce((acc: number, c: Commande) => 
            acc + (['livree', 'terminee'].includes(c.statut_commande) ? (Number(c.frais_livraison) || 0) : 0)
          , 0);
          
          return {
            id: livreur.id,
            nom: livreur.nom_complet,
            total_cmds: logStats.total_sortis,
            livrees: logStats.livrees,
            retours: logStats.retours,
            annulees: logStats.annulees,
            reportees: logStats.reportees,
            ca_livraison,
            taux_succes: logStats.taux_succes
          };
        }).sort((a: StaffStats, b: StaffStats) => b.taux_succes - a.taux_succes);

        setStats(staffStats);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeFilter]);

  const totalGlobalCALivraison = stats.reduce((acc: number, s: StaffStats) => acc + s.ca_livraison, 0);
  const averageSuccessRate = stats.length > 0 ? Math.round(stats.reduce((acc: number, s: StaffStats) => acc + s.taux_succes, 0) / stats.length) : 0;
  const bestLivreur = stats[0];

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Analyse des performances en cours...</p>
      </div>
    );
  }

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Target size={36} color="var(--primary)" strokeWidth={2.5} />
            Hub Performance Livreurs
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Visualisez l'impact et l'efficacité de vos équipes sur le terrain.
          </p>
        </div>
        
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.5)', padding: '0.4rem', borderRadius: '14px', border: '1px solid #e2e8f0', backdropFilter: 'blur(10px)' }}>
          {(['month', 'week', 'today'] as const).map(f => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '10px',
                border: 'none',
                background: timeFilter === f ? 'var(--primary)' : 'transparent',
                color: timeFilter === f ? 'white' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                textTransform: 'capitalize'
              }}
            >
              {f === 'month' ? 'Ce mois' : f === 'week' ? '7 jours' : 'Aujourd\'hui'}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="card glass-effect" style={{ border: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ opacity: 0.9, fontSize: '0.9rem', fontWeight: 600 }}>Taux de Réussite Global</p>
              <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: '0.5rem 0' }}>{averageSuccessRate}%</h2>
              <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>Moyenne sur {stats.length} livreurs actifs</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.75rem', borderRadius: '12px' }}>
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="card glass-effect">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>CA Livraison Total</p>
              <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: '0.5rem 0', color: 'var(--text-main)' }}>
                {totalGlobalCALivraison.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span>
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>
                <Coins size={14} /> Gains de livraison
              </div>
            </div>
            <div style={{ background: 'rgba(99, 102, 255, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--primary)' }}>
              <Coins size={24} />
            </div>
          </div>
        </div>

        <div className="card glass-effect">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Meilleur Agent</p>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0.5rem 0', color: 'var(--text-main)' }}>
                {bestLivreur?.nom || 'N/A'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f59e0b', fontWeight: 700, fontSize: '0.85rem' }}>
                <Award size={14} /> {bestLivreur?.taux_succes}% succès
              </div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '12px', color: '#f59e0b' }}>
              <Award size={24} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem' }}>
        <div className="card glass-effect" style={{ padding: '2rem' }}>
          <h3 style={{ margin: '0 0 2rem 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>Comparaison des Taux de Succès</h3>
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="nom" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }} width={120} />
                <Tooltip 
                  cursor={{ fill: 'rgba(99, 102, 255, 0.05)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 700 }}
                />
                <Bar dataKey="taux_succes" radius={[0, 10, 10, 0]} barSize={25}>
                  {stats.map((entry: StaffStats, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.taux_succes > 80 ? '#10b981' : entry.taux_succes > 50 ? '#6366f1' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>Performance par Agent</h3>
          </div>
          <div className="table-container" style={{ margin: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Livreur</th>
                  <th style={{ textAlign: 'center' }}>Sorties</th>
                  <th style={{ textAlign: 'center' }}>Livrés</th>
                  <th style={{ textAlign: 'center' }}>Retours</th>
                  <th style={{ textAlign: 'center' }}>Annulés</th>
                  <th style={{ textAlign: 'center' }}>Reports</th>
                  <th style={{ textAlign: 'right' }}>Gains</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s: StaffStats) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                          {s.nom.charAt(0)}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{s.nom}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: s.taux_succes > 80 ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                            {s.taux_succes}% réussite
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.total_cmds}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-success" style={{ padding: '0.2rem 0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>{s.livrees}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-info" style={{ padding: '0.2rem 0.5rem', background: 'rgba(99, 102, 255, 0.1)', color: 'var(--primary)' }}>{s.retours}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-danger" style={{ padding: '0.2rem 0.5rem', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>{s.annulees}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-warning" style={{ padding: '0.2rem 0.5rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>{s.reportees}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      <div style={{ whiteSpace: 'nowrap' }}>{s.ca_livraison.toLocaleString()} <span style={{ fontSize: '0.65rem' }}>CFA</span></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
