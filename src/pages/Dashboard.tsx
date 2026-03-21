import { useState, useEffect, useMemo } from 'react';
import { subscribeToCommandes, getTopSellingProducts } from '../services/commandeService';
import type { Commande } from '../types';
import { Activity, Percent, DollarSign, TrendingUp, Truck, AlertCircle, ShoppingBag, BarChart2 } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip
} from 'recharts';

export const Dashboard = () => {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToCommandes((data) => {
      setCommandes(data);
      setLoading(false);
    });
    
    // Fetch top products initially and periodically
    const fetchTop = async () => {
      try {
        const top = await getTopSellingProducts();
        setTopProducts(top);
      } catch (e) { console.error(e); }
    };
    fetchTop();
    const topInterval = setInterval(fetchTop, 30000);
    
    return () => {
      unsubscribe();
      clearInterval(topInterval);
    };
  }, []);

  const memoizedAnalytics = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    const getFrais = (c: Commande) => {
       if (c.frais_livraison !== undefined && c.frais_livraison !== null) return Number(c.frais_livraison);
       if (c.statut_commande === 'livree' || c.statut_commande === 'terminee') return 1000; 
       return 0;
    };

    const succes = commandes.filter(c => c.statut_commande === 'livree' || c.statut_commande === 'terminee');
    const echecsLivraison = commandes.filter(c => ['echouee', 'retour_stock', 'retour_livreur'].includes(c.statut_commande));
    
    // CA Calculations
    const totalEncaisse = succes.reduce((acc, c) => acc + (c.montant_encaisse || c.montant_total), 0);
    const totalFraisLivraison = succes.reduce((acc, c) => acc + getFrais(c), 0);
    const caNetProduits = totalEncaisse - totalFraisLivraison;

    const caPotentiel = commandes.filter(c => ['validee', 'en_cours_livraison'].includes(c.statut_commande))
                                 .reduce((acc, c) => acc + (c.montant_total - getFrais(c)), 0);
    
    const pending = commandes.filter(c => ['en_attente_appel', 'a_rappeler'].includes(c.statut_commande));
    
    // Taux de Succès Livraison (Livrées / (Livrées + Échecs))
    const totalTentatives = succes.length + echecsLivraison.length;
    const tauxSuccesLivraison = totalTentatives > 0 ? Math.round((succes.length / totalTentatives) * 100) : 0;
    
    const cmdJour = commandes.filter(c => new Date(c.date_creation).getTime() >= today.getTime());

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
          const montant = c.montant_encaisse || c.montant_total;
          const frais = getFrais(c);
          match.revenue += (montant - frais);
        }
      }
    });

    const historyData = last7Days.map(d => ({
      jour: d.date.slice(-5).replace('-', '/'),
      Commandes: d.count,
      CA: d.revenue
    }));

    return { 
      stats: { 
        total: commandes.length, 
        pending: pending.length, 
        succes: succes.length, 
        tauxSuccesLivraison, 
        caNetProduits, 
        totalFraisLivraison, 
        caPotentiel, 
        cmdJour: cmdJour.length, 
        totalEncaisse 
      }, 
      historyData 
    };
  }, [commandes]);

  const { stats, historyData } = memoizedAnalytics;

  if (loading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
           <h1 className="text-premium" style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0 }}>Tableau de Bord 360°</h1>
           <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.4rem', fontWeight: 600 }}>Intelligence Décisionnelle & Flux de Trésorerie</p>
        </div>
        <div style={{ background: '#f0fdf4', padding: '0.75rem 1.25rem', borderRadius: '14px', border: '1px solid #dcfce7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#166534' }}>SYSTÈME LIVE O.K</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card glass-effect" style={{ padding: '1.75rem', borderLeft: '5px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>CA Net Produits</span>
            <DollarSign size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)' }}>{stats.caNetProduits.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>CFA</span></div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total encaissé: {stats.totalEncaisse.toLocaleString()} CFA</p>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.85rem', fontWeight: 700 }}>
            <TrendingUp size={14} /> <span>Potentiel : {stats.caPotentiel.toLocaleString()} CFA</span>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.75rem', borderLeft: '5px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Frais Livraison Encaissés</span>
            <Truck size={20} color="#6366f1" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#6366f1' }}>{stats.totalFraisLivraison.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>CFA</span></div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Part destinée aux prestataires</p>
        </div>

        <div className="card glass-effect" style={{ padding: '1.75rem', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Taux de Succès (Tournées)</span>
            <Percent size={20} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)' }}>{stats.tauxSuccesLivraison}%</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.8rem' }}>
             <div className="badge badge-success" style={{ borderRadius: '6px' }}>PERFORMANCE</div>
             <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>{stats.succes} livraisons réussies</span>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.75rem', borderLeft: '5px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Commandes à Traiter</span>
            <Activity size={20} color="#ef4444" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444' }}>{stats.pending}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.8rem', color: '#f59e0b' }}>
             <AlertCircle size={14} />
             <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Files Call-Center</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) 1fr', gap: '2rem' }} className="responsive-grid">
        {/* Revenue Trend */}
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <h3 style={{ margin: 0, fontWeight: 800 }}>Évolution du Revenu Net (7j)</h3>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Montant en CFA</span>
          </div>
          <div style={{ height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="jour" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 800 }}
                  formatter={(v) => [`${Number(v).toLocaleString()} CFA`, 'Net Produits']}
                />
                <Area type="monotone" dataKey="CA" stroke="#10b981" strokeWidth={5} fillOpacity={1} fill="url(#colorCA)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Best Sellers Section */}
        <div className="card" style={{ padding: '2rem' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
             <BarChart2 size={24} color="var(--primary)" />
             <h3 style={{ margin: 0, fontWeight: 800 }}>Meilleurs Produits (Best-Sellers)</h3>
           </div>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {topProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <ShoppingBag size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <p>Aucune donnée de vente disponible.</p>
                </div>
              ) : topProducts.map((p, i) => (
                <div key={p.nom} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-muted)', width: '20px' }}>{i+1}.</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>{p.nom}</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 900, color: p.taux_succes >= 70 ? '#10b981' : p.taux_succes >= 40 ? '#f59e0b' : '#ef4444' }}>
                      {p.taux_succes}% Succès
                    </span>
                  </div>
                  <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden', position: 'relative' }}>
                    <div 
                      style={{ 
                        width: `${p.taux_succes}%`, 
                        height: '100%', 
                        background: p.taux_succes >= 70 ? '#10b981' : p.taux_succes >= 40 ? '#f59e0b' : '#ef4444', 
                        borderRadius: '5px',
                        transition: 'width 1s ease-out'
                      }}
                    ></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    <span>Sorties: {p.total_sorties}</span>
                    <span>Livrées: {p.nb_ventes}</span>
                  </div>
                </div>
              ))}
           </div>
           
           {topProducts.length > 0 && (
             <p style={{ marginTop: '2rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
               Analyse basée sur le ratio Sorties / Livrées par article.
             </p>
           )}
        </div>
      </div>
    </div>
  );
};
