import { useState, useEffect } from 'react';
import { subscribeToCommandes } from '../services/commandeService';
import type { Commande } from '../types';
import { AlertCircle, Activity, Percent, DollarSign } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export const Dashboard = () => {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCommandes((data) => {
      setCommandes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getStats = () => {
    const today = new Date();
    today.setHours(0,0,0,0);

    const caGlobal = commandes.filter(c => c.statut_commande === 'livree' || c.statut_commande === 'terminee')
                              .reduce((acc, c) => acc + (c.montant_encaisse || c.montant_total), 0);
    
    // Potentiel (commandes validées non livrées)
    const caPotentiel = commandes.filter(c => ['validee', 'en_cours_livraison'].includes(c.statut_commande))
                                 .reduce((acc, c) => acc + c.montant_total, 0);

    const pending = commandes.filter(c => c.statut_commande === 'en_attente_appel' || c.statut_commande === 'a_rappeler');
    const succes = commandes.filter(c => c.statut_commande === 'livree' || c.statut_commande === 'terminee');
    const echecs = commandes.filter(c => c.statut_commande === 'echouee' || c.statut_commande === 'retour_stock');
    
    const totalTraitees = succes.length + echecs.length;
    const tauxLivraison = totalTraitees > 0 ? Math.round((succes.length / totalTraitees) * 100) : 0;
    
    // Commandes du jour
    const cmdJour = commandes.filter(c => new Date(c.date_creation).getTime() >= today.getTime());

    return { 
      total: commandes.length, 
      pending: pending.length, 
      succes: succes.length,
      echecs: echecs.length,
      tauxLivraison,
      caGlobal,
      caPotentiel,
      cmdJour: cmdJour.length
    };
  };

  const getChartData = () => {
    return [
      { name: 'En attente', value: commandes.filter(c => c.statut_commande === 'en_attente_appel').length },
      { name: 'Appel (Val / Rappel)', value: commandes.filter(c => c.statut_commande === 'validee' || c.statut_commande === 'a_rappeler').length },
      { name: 'En Expédition', value: commandes.filter(c => c.statut_commande === 'en_cours_livraison').length },
      { name: 'Livrées', value: commandes.filter(c => c.statut_commande === 'livree' || c.statut_commande === 'terminee').length },
      { name: 'Echecs', value: commandes.filter(c => c.statut_commande === 'echouee' || c.statut_commande === 'retour_stock').length },
    ];
  };

  const getRecentHistoryData = () => {
    // Basic aggregation by day for the last 7 days from the available data
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { date: d.toISOString().split('T')[0], revenue: 0, count: 0 };
    });

    commandes.forEach(c => {
      const dString = new Date(c.date_creation).toISOString().split('T')[0];
      const match = last7Days.find(d => d.date === dString);
      if (match) {
        match.count++;
        if(c.statut_commande === 'livree' || c.statut_commande === 'terminee') {
          match.revenue += (c.montant_encaisse || c.montant_total);
        }
      }
    });

    return last7Days.map(d => ({
      jour: d.date.slice(-5).replace('-', '/'),
      Commandes: d.count,
      CA_Livre: d.revenue
    }));
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>;
  }

  const stats = getStats();
  const statusData = getChartData();
  const historyData = getRecentHistoryData();
  const PIE_COLORS = ['#fbbf24', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Business 360°</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Supervision générale de la performance et des flux.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Chiffre d'Affaires Encaissé</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0', color: 'var(--success-color)' }}>
                {stats.caGlobal.toLocaleString()} CFA
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>+ {stats.caPotentiel.toLocaleString()} CA Pote.</span>
            </div>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-lg)' }}>
              <DollarSign size={24} color="var(--success-color)" />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Taux de Livraison Réussie</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>{stats.tauxLivraison} %</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sur {stats.succes + stats.echecs} traitées</span>
            </div>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-lg)' }}>
              <Percent size={24} color="var(--primary-color)" />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Commandes en Souffrance</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>{stats.pending}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Attendent validation call-center</span>
            </div>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-lg)' }}>
              <AlertCircle size={24} color="var(--warning-color)" />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Nouvelles d'Aujourd'hui</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0' }}>{stats.cmdJour}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total base: {stats.total} cmd</span>
            </div>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: 'var(--radius-lg)' }}>
              <Activity size={24} color="#8b5cf6" />
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 2fr) minmax(300px, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: 600 }}>Évolution sur 7 jours</h3>
          <div style={{ flex: 1, minHeight: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="jour" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  formatter={(value: any) => [`${Number(value).toLocaleString()} CFA`, 'CA Livré']}
                />
                <Area type="monotone" dataKey="CA_Livre" stroke="#10b981" fillOpacity={1} fill="url(#colorCa)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: 600 }}>Pipeline des Commandes</h3>
          <div style={{ flex: 1, minHeight: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
              {statusData.map((entry, index) => (
                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <span>{entry.name}: {entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <div className="card">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 600 }}>5 Dernières Commandes d'Aujourd'hui</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Source</th>
                <th>Montant</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {commandes.slice(0, 5).map(cmd => (
                <tr key={cmd.id}>
                  <td style={{ fontWeight: 500 }}>#{cmd.id.slice(0, 8)}</td>
                  <td>{cmd.source_commande}</td>
                  <td style={{ fontWeight: 600 }}>{cmd.montant_total.toLocaleString()} CFA</td>
                  <td>
                    <span className={`badge ${cmd.statut_commande === 'livree' ? 'badge-success' : cmd.statut_commande === 'en_attente_appel' ? 'badge-warning' : 'badge-info'}`}>
                      {cmd.statut_commande}
                    </span>
                  </td>
                </tr>
              ))}
              {commandes.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
                    Aucune commande pour l'instant
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
