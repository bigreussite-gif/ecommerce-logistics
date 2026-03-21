import { useState, useEffect } from 'react';
import { subscribeToCommandes, getTopSellingProducts } from '../services/commandeService';
import type { Commande } from '../types';
import { AlertCircle, Activity, Percent, DollarSign, MapPin, TrendingUp } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Tooltip
} from 'recharts';

export const Dashboard = () => {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [topProducts, setTopProducts] = useState<{ nom: string, nb_ventes: number, total_ca: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCommandes((data) => {
      setCommandes(data);
      setLoading(false);
    });
    
    getTopSellingProducts(5).then(setTopProducts);
    
    return () => unsubscribe();
  }, []);

  const getStats = () => {
    const today = new Date();
    today.setHours(0,0,0,0);

    const caGlobal = commandes.filter(c => c.statut_commande === 'livree' || c.statut_commande === 'terminee')
                              .reduce((acc, c) => acc + (c.montant_encaisse || c.montant_total), 0);
    
    const caPotentiel = commandes.filter(c => ['validee', 'en_cours_livraison'].includes(c.statut_commande))
                                 .reduce((acc, c) => acc + c.montant_total, 0);

    const pending = commandes.filter(c => ['en_attente_appel', 'a_rappeler'].includes(c.statut_commande));
    const succes = commandes.filter(c => c.statut_commande === 'livree' || c.statut_commande === 'terminee');
    const echecs = commandes.filter(c => c.statut_commande === 'echouee' || c.statut_commande === 'retour_stock');
    
    const totalTraitees = succes.length + echecs.length;
    const tauxLivraison = totalTraitees > 0 ? Math.round((succes.length / totalTraitees) * 100) : 0;
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

  const getStatusData = () => [
    { name: 'Attente', value: commandes.filter(c => c.statut_commande === 'en_attente_appel').length },
    { name: 'Appels', value: commandes.filter(c => c.statut_commande === 'validee' || c.statut_commande === 'a_rappeler').length },
    { name: 'Expédition', value: commandes.filter(c => c.statut_commande === 'en_cours_livraison').length },
    { name: 'Livrées', value: commandes.filter(c => c.statut_commande === 'livree' || c.statut_commande === 'terminee').length },
    { name: 'Echecs', value: commandes.filter(c => c.statut_commande === 'echouee' || c.statut_commande === 'retour_stock').length },
  ];

  const getRecentHistoryData = () => {
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
      CA: d.revenue
    }));
  };

  const getCommuneStats = () => {
    const counts: Record<string, number> = {};
    commandes.forEach(c => {
      if (c.commune_livraison) {
        counts[c.commune_livraison] = (counts[c.commune_livraison] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  if (loading) {
    return <div style={{ padding: '6rem', textAlign: 'center' }}>
      <div className="spinner" style={{ margin: '0 auto' }}></div>
      <p style={{ marginTop: '1rem', fontWeight: 600 }}>Génération des analyses Business 360...</p>
    </div>;
  }

  const stats = getStats();
  const statusData = getStatusData();
  const historyData = getRecentHistoryData();
  const communeData = getCommuneStats();
  const PIE_COLORS = ['#fbbf24', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444'];

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0 }}>Business 360°</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Intelligence Décisionnelle et Supervision de Performance.
          </p>
        </div>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem 1.5rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></div>
            <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.9rem' }}>SYSTÈME LIVE O.K</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div className="card glass-effect" style={{ border: '1px solid rgba(16, 185, 129, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p className="text-muted-premium">REVENU GLOBAL</p>
              <h3 style={{ fontSize: '2rem', fontWeight: 900, margin: '0.5rem 0', color: '#10b981' }}>
                {stats.caGlobal.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>CFA</span>
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={14} color="#10b981" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>+ {stats.caPotentiel.toLocaleString()} Potentiel</span>
              </div>
            </div>
            <div className="icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
              <DollarSign size={28} color="#10b981" />
            </div>
          </div>
        </div>

        <div className="card glass-effect" style={{ border: '1px solid rgba(59, 130, 246, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p className="text-muted-premium">TAUX DE SUCCÈS</p>
              <h3 style={{ fontSize: '2rem', fontWeight: 900, margin: '0.5rem 0' }}>{stats.tauxLivraison}%</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-info" style={{ borderRadius: '6px' }}>Performance</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{stats.succes} livrées</span>
              </div>
            </div>
            <div className="icon-box" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
              <Percent size={28} color="#3b82f6" />
            </div>
          </div>
        </div>

        <div className="card glass-effect" style={{ border: '1px solid rgba(245, 158, 11, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p className="text-muted-premium">A TRAITER (URGENT)</p>
              <h3 style={{ fontSize: '2rem', fontWeight: 900, margin: '0.5rem 0', color: '#f59e0b' }}>{stats.pending}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={14} color="#f59e0b" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Files Call-Center</span>
              </div>
            </div>
            <div className="icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
              <Activity size={28} color="#f59e0b" />
            </div>
          </div>
        </div>
      </div>

      {/* Primary Analytics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '3rem' }} className="responsive-flex">
        
        <div className="card glass-effect" style={{ minHeight: '450px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Tendance des Revenus (7j)</h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>MONTANT EN CFA</div>
          </div>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="jour" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)', fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)', fontWeight: 700 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}
                  formatter={(value: any) => [`${Number(value).toLocaleString()} CFA`, 'CA Encaissé']}
                />
                <Area type="monotone" dataKey="CA" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorCa)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card glass-effect" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '2rem' }}>Performance Régionale</h3>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={communeData} layout="vertical" margin={{ left: -10, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-main)' }} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar dataKey="value" fill="var(--primary)" radius={[0, 8, 8, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: '2rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '1rem' }}>TOP 5 COMMUNES</p>
              {communeData.map((c) => (
                <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={14} color="var(--primary)" />
                    <span style={{ fontWeight: 700 }}>{c.name}</span>
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--text-muted)' }}>{c.value} cmd</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Products & Status Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        
        <div className="card glass-effect">
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '2rem' }}>Meilleurs Produits (Best-Sellers)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {topProducts.map((p, i) => (
              <div key={p.nom} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 900 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{p.nom}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{p.nb_ventes} unités vendues</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, color: '#10b981', fontSize: '0.9rem' }}>{p.total_ca.toLocaleString()}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>VALEUR CFA</div>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Pas encore de données de vente.</p>}
          </div>
        </div>

        <div className="card glass-effect">
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '2rem' }}>État du Pipeline Opérationnel</h3>
          <div style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '2.5rem' }}>
            {statusData.map((entry, index) => (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                <span>{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
