import { useState, useEffect, useMemo, useCallback } from 'react';
import { subscribeToCommandes, getTopSellingProducts } from '../services/commandeService';
import { calculateLogisticalStats } from '../services/financialService';
import type { Commande } from '../types';
import { Activity, Percent, DollarSign, TrendingUp, Truck, AlertCircle, ShoppingBag, BarChart2, Calendar } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, PieChart, Pie, Cell
} from 'recharts';

type Period = 'today' | '7d' | '30d' | 'all' | 'custom';

export const Dashboard = () => {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('7d');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  const fetchTop = useCallback(async (p: Period, start?: string, end?: string) => {
    try {
      const days = p === 'today' ? 1 : p === '7d' ? 7 : p === '30d' ? 30 : 0;
      const top = await getTopSellingProducts(10, days, start, end);
      setTopProducts(top);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToCommandes((data) => {
      setCommandes(data);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (period === 'custom') {
      fetchTop('custom', new Date(startDate).toISOString(), new Date(endDate + 'T23:59:59').toISOString());
    } else {
      fetchTop(period);
    }
    const interval = setInterval(() => {
      if (period === 'custom') fetchTop('custom', new Date(startDate).toISOString(), new Date(endDate + 'T23:59:59').toISOString());
      else fetchTop(period);
    }, 60000);
    return () => clearInterval(interval);
  }, [period, fetchTop, startDate, endDate]);

  const filteredCommandes = useMemo(() => {
    const now = new Date();
    if (period === 'all') return commandes;

    if (period === 'custom') {
      const start = new Date(startDate);
      start.setHours(0,0,0,0);
      const end = new Date(endDate);
      end.setHours(23,59,59,999);
      
      return commandes.filter(c => {
        const dCreated = new Date(c.date_creation);
        const dDelivered = c.date_livraison_effective ? new Date(c.date_livraison_effective) : null;
        
        const createdInRange = dCreated >= start && dCreated <= end;
        const deliveredInRange = dDelivered && dDelivered >= start && dDelivered <= end;
        
        return createdInRange || deliveredInRange;
      });
    }

    const start = new Date();
    if (period === 'today') start.setHours(0, 0, 0, 0);
    else if (period === '7d') start.setDate(now.getDate() - 7);
    else if (period === '30d') start.setDate(now.getDate() - 30);

    return commandes.filter(c => {
      const dCreated = new Date(c.date_creation);
      const dDelivered = c.date_livraison_effective ? new Date(c.date_livraison_effective) : null;
      
      const createdInRange = dCreated.getTime() >= start.getTime();
      const deliveredInRange = dDelivered && dDelivered.getTime() >= start.getTime();
      
      return createdInRange || deliveredInRange;
    });
  }, [commandes, period, startDate, endDate]);

  const memoizedAnalytics = useMemo(() => {
    const getFrais = (c: Commande) => {
       if (c.frais_livraison !== undefined && c.frais_livraison !== null) return Number(c.frais_livraison);
       if (c.statut_commande === 'livree' || c.statut_commande === 'terminee') return 1000; 
       return 0;
    };

    const pending = filteredCommandes.filter(c => ['en_attente_appel', 'a_rappeler', 'nouvelle'].includes(c.statut_commande));
    const succes = filteredCommandes.filter(c => ['livree', 'terminee'].includes(c.statut_commande || ''));
    
    const totalEncaisse = succes.reduce((acc, c) => acc + (c.montant_encaisse || c.montant_total), 0);
    const totalFraisLivraison = succes.reduce((acc, c) => acc + getFrais(c), 0);
    const caNetProduits = totalEncaisse - totalFraisLivraison;

    const caPotentiel = filteredCommandes.filter(c => ['validee', 'en_cours_livraison'].includes(c.statut_commande || ''))
                                         .reduce((acc, c) => acc + (c.montant_total - getFrais(c)), 0);
    
    const logStats = calculateLogisticalStats(filteredCommandes);
    const tauxSuccesLivraison = logStats.taux_succes;
    
    // Status Distribution Data
    const statusCounts: Record<string, number> = {};
    filteredCommandes.forEach(c => {
      const s = c.statut_commande || 'Inconnu';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    // Zone Performance Data (Heatmap)
    const zoneMetrics: Record<string, { total: number, delivered: number, failed: number, cancelled: number, risk: number }> = {};
    filteredCommandes.forEach(c => {
      const z = c.commune_livraison || 'Hors Zone';
      if (!zoneMetrics[z]) zoneMetrics[z] = { total: 0, delivered: 0, failed: 0, cancelled: 0, risk: 0 };
      
      zoneMetrics[z].total++;
      if (['livree', 'terminee'].includes(c.statut_commande)) zoneMetrics[z].delivered++;
      else if (['echouee', 'retour_livreur', 'retour_stock'].includes(c.statut_commande)) zoneMetrics[z].failed++;
      else if (c.statut_commande === 'annulee') zoneMetrics[z].cancelled++;
    });

    const heatmapData = Object.entries(zoneMetrics).map(([name, m]) => {
      const attempts = m.delivered + m.failed;
      const risk = attempts > 0 ? (m.failed / attempts) * 100 : 0;
      return { 
        name, 
        volume: m.total, 
        risk: Math.round(risk),
        color: risk > 40 ? '#ef4444' : risk > 20 ? '#f59e0b' : '#10b981'
      };
    }).sort((a, b) => b.risk - a.risk);

    // Comparative Analytics
    const getPeriodDays = () => {
      if (period === 'today') return 1;
      if (period === '7d') return 7;
      if (period === '30d') return 30;
      if (period === 'custom') {
        const diffTime = Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
      return 0;
    };

    const days = getPeriodDays();
    const prevPeriodData = days > 0 ? commandes.filter(c => {
      const d = new Date(c.date_creation);
      const now = new Date();
      const endPrev = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      const startPrev = new Date(now.getTime() - (2 * days * 24 * 60 * 60 * 1000));
      return d >= startPrev && d < endPrev;
    }) : [];

    const succesPrev = prevPeriodData.filter(c => c.statut_commande === 'livree' || c.statut_commande === 'terminee');
    const totalEncaissePrev = succesPrev.reduce((acc, c) => acc + (c.montant_encaisse || c.montant_total), 0);
    const totalFraisPrev = succesPrev.reduce((acc, c) => acc + getFrais(c), 0);
    const caNetPrev = totalEncaissePrev - totalFraisPrev;
    const logStatsPrev = calculateLogisticalStats(prevPeriodData);
    const tauxSuccesPrev = logStatsPrev.taux_succes;

    const diffCA = caNetPrev > 0 ? Math.round(((caNetProduits - caNetPrev) / caNetPrev) * 100) : 0;
    const diffTaux = tauxSuccesPrev > 0 ? Math.round((tauxSuccesLivraison - tauxSuccesPrev)) : 0;

    // Prepare history data based on current period
    const dayCount = period === 'today' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 15;
    const historyPoints = Array.from({length: dayCount}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (dayCount - 1 - i));
      return { date: d.toISOString().split('T')[0], revenue: 0, count: 0 };
    });

    filteredCommandes.forEach(c => {
      const isSucces = c.statut_commande === 'livree' || c.statut_commande === 'terminee';
      const dString = new Date((isSucces && c.date_livraison_effective) ? c.date_livraison_effective : c.date_creation).toISOString().split('T')[0];
      const match = historyPoints.find(d => d.date === dString);
      if (match) {
        match.count++;
        if(isSucces) {
          const montant = c.montant_encaisse || c.montant_total;
          const frais = getFrais(c);
          match.revenue += (montant - frais);
        }
      }
    });

    const historyData = historyPoints.map(d => ({
      jour: d.date.slice(-5).replace('-', '/'),
      Commandes: d.count,
      CA: d.revenue
    }));

    return { 
      stats: { 
        total: filteredCommandes.length, 
        pending: pending.length, 
        succes: succes.length, 
        tauxSuccesLivraison, 
        caNetProduits, 
        totalFraisLivraison, 
        caPotentiel, 
        totalEncaisse,
        diffCA,
        diffTaux,
        logStats
      }, 
      historyData,
      statusData,
      zoneData: [], // Replaced by heatmap below
      heatmapData
    };
  }, [filteredCommandes, period, commandes, startDate, endDate]);

  const { stats, historyData, statusData, heatmapData } = memoizedAnalytics;
  const { logStats, tauxSuccesLivraison } = stats;

  if (loading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="mobile-stack">
           <h1 className="text-premium" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: 900, margin: 0 }}>Tableau de Bord 360°</h1>
           <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.4rem', fontWeight: 600 }}>Performance Analytique & Temps Réel</p>
        </div>
        
        {/* Period Selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(99, 102, 255, 0.05)', padding: '0.4rem', borderRadius: '16px', border: '1px solid #e2e8f0', gap: '0.5rem' }}>
          {(['today', '7d', '30d', 'all', 'custom'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`btn btn-sm ${period === p ? 'btn-primary' : ''}`}
              style={{ 
                borderRadius: '12px', 
                border: 'none',
                background: period === p ? 'var(--primary)' : 'transparent',
                color: period === p ? 'white' : 'var(--text-muted)',
                padding: '0.5rem 1rem',
                fontWeight: 800,
                fontSize: '0.75rem',
                textTransform: 'uppercase'
              }}
            >
              {p === 'today' ? "Aujourd'hui" : p === '7d' ? '7 Jours' : p === '30d' ? '30 Jours' : p === 'custom' ? 'Personnalisé' : 'Tout'}
            </button>
          ))}
          
          {period === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem', borderLeft: '1px solid #e2e8f0', paddingLeft: '0.8rem' }}>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>à</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card glass-effect" style={{ padding: '1.75rem', borderLeft: '5px solid var(--primary)', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>CA Net Produits</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               {stats.diffCA !== 0 && (
                 <span style={{ fontSize: '0.75rem', fontWeight: 900, color: stats.diffCA > 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center' }}>
                   {stats.diffCA > 0 ? '+' : ''}{stats.diffCA}%
                 </span>
               )}
               <DollarSign size={20} color="var(--primary)" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)' }}>{stats.caNetProduits.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>CFA</span></div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total encaissé: {stats.totalEncaisse.toLocaleString()} CFA</p>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.85rem', fontWeight: 700 }}>
            <TrendingUp size={14} /> <span>Potentiel : {stats.caPotentiel.toLocaleString()} CFA</span>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.75rem', borderLeft: '5px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Livraison Encaissé</span>
            <Truck size={20} color="#6366f1" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#6366f1' }}>{stats.totalFraisLivraison.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>CFA</span></div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Part destinataires finaux</p>
        </div>

        <div className="card glass-effect" style={{ padding: '1.75rem', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Taux de Succès</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               {stats.diffTaux !== 0 && (
                 <span style={{ fontSize: '0.75rem', fontWeight: 900, color: stats.diffTaux >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center' }}>
                   {stats.diffTaux >= 0 ? '+' : ''}{stats.diffTaux}%
                 </span>
               )}
               <Percent size={20} color="#f59e0b" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)' }}>{tauxSuccesLivraison}%</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginTop: '0.8rem' }}>
             <div className="badge badge-success" style={{ borderRadius: '6px', fontSize: '0.7rem' }}>{logStats.livrees} L</div>
             <div className="badge badge-info" style={{ borderRadius: '6px', fontSize: '0.7rem' }}>{logStats.retours} R</div>
             <div className="badge badge-warning" style={{ borderRadius: '6px', fontSize: '0.7rem' }}>{logStats.reportees} P</div>
          </div>
        </div>


        <div className="card glass-effect" style={{ padding: '1.75rem', borderLeft: '5px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>À Traiter</span>
            <Activity size={stats.pending > 0 ? 20 : 18} color="#ef4444" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444' }}>{stats.pending}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.8rem', color: '#f59e0b' }}>
             <AlertCircle size={14} />
             <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Action requise</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
        {/* Status Distribution (Pie Chart) */}
        <div className="card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Activity size={20} color="var(--primary)" /> Répartition des Flux
          </h3>
          <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(statusData || []).map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={[
                        '#10b981', '#6366f1', '#f59e0b', '#ef4444', 
                        '#8b5cf6', '#ec4899', '#06b6d4', '#475569'
                      ][index % 8]} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: 'var(--shadow-premium)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
            {(statusData || []).map((s, i) => (
               <div key={s?.name || i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: [
                        '#10b981', '#6366f1', '#f59e0b', '#ef4444', 
                        '#8b5cf6', '#ec4899', '#06b6d4', '#475569'
                      ][i % 8] }}></div>
                  <span style={{ color: 'var(--text-muted)' }}>{s.name} ({s.value})</span>
               </div>
            ))}
          </div>
        </div>

        {/* Zone Risk Heatmap */}
        <div className="card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} color="#ef4444" /> Heatmap de Risque Logistique
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {heatmapData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucune donnée</div>
            ) : heatmapData.slice(0, 6).map((z) => (
              <div key={z.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{z.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vol: {z.volume}</span>
                    <span style={{ fontWeight: 900, color: z.color, fontSize: '0.9rem' }}>{z.risk}% Risque</span>
                  </div>
                </div>
                <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden', position: 'relative' }}>
                  <div 
                    style={{ 
                      width: `${z.risk}%`, 
                      height: '100%', 
                      background: z.color, 
                      borderRadius: '5px',
                      transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                  {z.risk > 15 && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)`, animation: 'shimmer 2s infinite' }} />
                  )}
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
            Analyse IA des zones à taux d'échec élevé nécessitant une attention logistique.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '2rem' }}>
        {/* Revenue Trend */}
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Calendar size={20} color="var(--primary)" />
              <h3 style={{ margin: 0, fontWeight: 800 }}>Tendance des Revenus ({period === 'all' ? '15j' : period === 'today' ? '24h' : period})</h3>
            </div>
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
                <XAxis dataKey="jour" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 800 }}
                  formatter={(v) => [`${Number(v).toLocaleString()} CFA`, 'Revenu Net']}
                />
                <Area type="monotone" dataKey="CA" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorCA)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Best Sellers Section */}
        <div className="card" style={{ padding: '2rem' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
             <BarChart2 size={24} color="var(--primary)" />
             <h3 style={{ margin: 0, fontWeight: 800 }}>Meilleurs Produits</h3>
           </div>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {topProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <ShoppingBag size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <p>Aucune donnée sur cette période.</p>
                </div>
              ) : (topProducts || []).map((p, i) => (
                <div key={p?.nom || i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-muted)', width: '20px' }}>{i+1}.</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 900, color: p.taux_succes >= 70 ? '#10b981' : p.taux_succes >= 40 ? '#f59e0b' : '#ef4444' }}>
                      {p.taux_succes}%
                    </span>
                  </div>
                  <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${p.taux_succes}%`, 
                        height: '100%', 
                        background: p.taux_succes >= 70 ? '#10b981' : p.taux_succes >= 40 ? '#f59e0b' : '#ef4444', 
                        borderRadius: '4px',
                        transition: 'width 1s ease-out'
                      }}
                    ></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    <span>Sortis: {p.total_sorties}</span>
                    <span>Livrées: {p.nb_ventes}</span>
                  </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};
