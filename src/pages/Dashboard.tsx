import { useState, useEffect, useMemo, useCallback } from 'react';
import { subscribeToCommandes, getTopSellingProducts, getCategoryPerformance } from '../services/commandeService';
import { calculateLogisticalStats, getDepenses, calculateProfitMetrics, calculateStockValue } from '../services/financialService';
import { getProduits } from '../services/produitService';
import type { Commande } from '../types';
import { globalEventBus, EVENTS } from '../utils/events';
import { Activity, Percent, DollarSign, TrendingUp, Truck, AlertCircle, ShoppingBag, BarChart2, Calendar, MapPin, Tag, Clock, ArrowUp, ArrowDown, Wallet, TrendingDown } from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
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
  const [categoryStats, setCategoryStats] = useState<any[]>([]);
  const [stockVal, setStockVal] = useState(0);
  const [expenses, setExpenses] = useState<any[]>([]);

  const fetchTop = useCallback(async (p: Period, start?: string, end?: string) => {
    try {
      const days = p === 'today' ? 1 : p === '7d' ? 7 : p === '30d' ? 30 : 0;
      const top = await getTopSellingProducts(null, days, start, end);
      const catStats = await getCategoryPerformance(days, start, end);
      setTopProducts(top);
      setCategoryStats(catStats);
    } catch (e) { console.error(e); }
  }, []);

  const fetchGlobalData = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const [allExpenses, allProds] = await Promise.all([
        getDepenses(),
        getProduits()
      ]);
      setExpenses(allExpenses);
      const sVal = calculateStockValue(allProds);
      setStockVal(sVal);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToCommandes((data) => {
      setCommandes(data);
      setLoading(false);
    });
    
    // Auto-refresh stats when events happen
    globalEventBus.on(EVENTS.COMMANDES_UPDATED, fetchGlobalData);
    globalEventBus.on(EVENTS.STOCK_UPDATED, fetchGlobalData);
    
    return () => {
      unsubscribe();
      globalEventBus.off(EVENTS.COMMANDES_UPDATED, fetchGlobalData);
      globalEventBus.off(EVENTS.STOCK_UPDATED, fetchGlobalData);
    };
  }, [fetchGlobalData]);

  useEffect(() => {
    fetchGlobalData();
    const interval = setInterval(fetchGlobalData, 60000);
    return () => clearInterval(interval);
  }, [fetchGlobalData, commandes.length]);

  useEffect(() => {
    const fetchTopData = () => {
      if (period === 'custom') {
        fetchTop('custom', new Date(startDate).toISOString(), new Date(endDate + 'T23:59:59').toISOString());
      } else {
        fetchTop(period);
      }
    };
    
    fetchTopData();
    const interval = setInterval(fetchTopData, 60000);
    return () => clearInterval(interval);
  }, [period, fetchTop, startDate, endDate]);

  const filteredData = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (period === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (period === '7d') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (period === '30d') {
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'custom') {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      // 'all'
      start = new Date(0);
    }

    const filteredCmds = commandes.filter(c => {
      const d = new Date(c.date_creation);
      const dDelivered = c.date_livraison_effective ? new Date(c.date_livraison_effective) : null;
      
      // We count it if either created or delivered in range
      const inCreated = d >= start && d <= end;
      const inDelivered = dDelivered && dDelivered >= start && dDelivered <= end;
      return inCreated || inDelivered;
    });

    const filteredExps = expenses.filter(exp => {
      const d = new Date(exp.date);
      return d >= start && d <= end;
    });

    // Centralized metrics from financialService
    const metrics = calculateProfitMetrics(filteredCmds, filteredExps);
    const logStats = calculateLogisticalStats(filteredCmds);

    // Calculate Previous Period for Croissance
    let startPrev = new Date(start);
    let endPrev = new Date(start.getTime() - 1);
    
    if (period === 'today') {
      startPrev.setDate(startPrev.getDate() - 1);
    } else if (period === '7d') {
      startPrev.setDate(startPrev.getDate() - 7);
    } else if (period === '30d') {
      startPrev.setDate(startPrev.getDate() - 30);
    } else if (period === 'custom') {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      startPrev.setDate(startPrev.getDate() - diffDays);
    } else {
      startPrev = new Date(0);
      endPrev = new Date(0);
    }

    const filteredCmdsPrev = commandes.filter(c => {
      const d = new Date(c.date_creation);
      const dDelivered = c.date_livraison_effective ? new Date(c.date_livraison_effective) : null;
      const inCreated = d >= startPrev && d <= endPrev;
      const inDelivered = dDelivered && dDelivered >= startPrev && dDelivered <= endPrev;
      return inCreated || inDelivered;
    });

    const filteredExpsPrev = expenses.filter(exp => {
      const d = new Date(exp.date);
      return d >= startPrev && d <= endPrev;
    });

    const previousMetrics = calculateProfitMetrics(filteredCmdsPrev, filteredExpsPrev);
    
    let croissanceCA = 0;
    if (previousMetrics.ca_net_produits > 0) {
      croissanceCA = ((metrics.ca_net_produits - previousMetrics.ca_net_produits) / previousMetrics.ca_net_produits) * 100;
    } else if (metrics.ca_net_produits > 0) {
      croissanceCA = 100;
    }

    // Status Distribution
    const statusCounts: Record<string, number> = {};
    filteredCmds.forEach(c => {
      const s = c.statut_commande || 'Inconnu';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    // Zone Heatmap & Best Zones
    const zoneMetrics: Record<string, { total: number, delivered: number, failed: number, ca: number }> = {};
    filteredCmds.forEach(c => {
      const z = c.commune_livraison || 'Hors Zone';
      if (!zoneMetrics[z]) zoneMetrics[z] = { total: 0, delivered: 0, failed: 0, ca: 0 };
      
      zoneMetrics[z].total++;
      const s = c.statut_commande?.toLowerCase();
      if (['livree', 'terminee'].includes(s)) {
        zoneMetrics[z].delivered++;
        const shipping = c.frais_livraison !== undefined && c.frais_livraison !== null ? Number(c.frais_livraison) : 1000;
        zoneMetrics[z].ca += (Number(c.montant_encaisse || c.montant_total) || 0) - shipping;
      } else if (['echouee', 'retour_livreur', 'retour_stock', 'retour_client'].includes(s)) {
        zoneMetrics[z].failed++;
      }
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

    const bestZonesData = Object.entries(zoneMetrics).map(([name, m]) => ({
      name,
      colis: m.total,
      ca: m.ca,
      taux_reussite: m.total > 0 ? Math.round((m.delivered / m.total) * 100) : 0,
      delivered: m.delivered
    })).sort((a, b) => b.ca - a.ca);

    // History Data for Chart
    const dayCount = period === 'today' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 15;
    const historyPoints = Array.from({length: dayCount}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (dayCount - 1 - i));
      return { date: d.toISOString().split('T')[0], revenue: 0, count: 0, gross: 0 };
    });

    filteredCmds.forEach(c => {
      const s = c.statut_commande?.toLowerCase();
      const isSuccess = ['livree', 'terminee'].includes(s);
      const dString = new Date(isSuccess && c.date_livraison_effective ? c.date_livraison_effective : c.date_creation).toISOString().split('T')[0];
      const match = historyPoints.find(d => d.date === dString);
      if (match) {
        match.count++;
        match.gross += Number(c.montant_total) || 0;
        if (isSuccess) {
          const shipping = c.frais_livraison !== undefined && c.frais_livraison !== null ? Number(c.frais_livraison) : 1000;
          match.revenue += (Number(c.montant_encaisse || c.montant_total) || 0) - shipping;
        }
      }
    });

    const historyData = historyPoints.map(d => ({
      jour: d.date.slice(-5).replace('-', '/'),
      Commandes: d.count,
      CA: d.revenue,
      CABrut: d.gross
    }));

    return {
      metrics,
      logStats,
      croissanceCA,
      statusData,
      heatmapData,
      bestZonesData,
      historyData,
      pendingCount: filteredCmds.filter(c => ['en_attente_appel', 'a_rappeler', 'nouvelle'].includes(c.statut_commande)).length
    };
  }, [commandes, expenses, period, startDate, endDate]);

  const { metrics, logStats, croissanceCA, statusData, heatmapData, bestZonesData, historyData, pendingCount } = filteredData;


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

      {/* Nouveaux KPIs Principaux Demandés */}
      <div className="res-grid" style={{ marginBottom: '1.5rem' }}>
        
        {/* 1. Chiffre d'affaires (CA) */}
        <div className="card glass-effect" style={{ padding: '1.75rem', borderLeft: '5px solid var(--primary)', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Chiffre d’affaires (CA)</span>
            <div style={{ padding: '0.4rem', background: 'var(--primary-glow)', borderRadius: '8px', display: 'flex' }}>
               <DollarSign size={20} color="var(--primary)" />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-main)' }}>{metrics.ca_net_produits.toLocaleString()} <span style={{ fontSize: '1rem' }}>CFA</span></div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>CA Net (Ventes réussies hors livraison)</p>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>
            <span>CA Brut : {metrics.ca_brut.toLocaleString()} CFA</span>
          </div>
        </div>

        {/* 2. Croissance (%) */}
        <div className="card glass-effect" style={{ padding: '1.75rem', borderLeft: `5px solid ${croissanceCA >= 0 ? '#10b981' : '#ef4444'}`, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Croissance (%)</span>
            <div style={{ padding: '0.4rem', background: croissanceCA >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', display: 'flex' }}>
               {croissanceCA >= 0 ? <TrendingUp size={20} color="#10b981" /> : <TrendingDown size={20} color="#ef4444" />}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {croissanceCA >= 0 ? <ArrowUp size={32} color="#10b981" strokeWidth={3} /> : <ArrowDown size={32} color="#ef4444" strokeWidth={3} />}
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: croissanceCA >= 0 ? '#10b981' : '#ef4444' }}>{Math.abs(croissanceCA).toFixed(1)}%</div>
          </div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Par rapport à la période précédente {period === 'today' ? '(Hier)' : period === '7d' ? '(7j précédents)' : period === '30d' ? '(30j précédents)' : ''}
          </p>
        </div>

        {/* 3. Résultat (bénéfice ou perte) */}
        <div className="card glass-effect" style={{ padding: '1.75rem', borderLeft: `5px solid ${metrics.benefice_caisse >= 0 ? '#10b981' : '#ef4444'}`, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Résultat</span>
            <div style={{ padding: '0.4rem', background: metrics.benefice_caisse >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', display: 'flex' }}>
               <Activity size={20} color={metrics.benefice_caisse >= 0 ? '#10b981' : '#ef4444'} />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: metrics.benefice_caisse >= 0 ? '#10b981' : '#ef4444' }}>
            {metrics.benefice_caisse >= 0 ? '+' : ''}{metrics.benefice_caisse.toLocaleString()} <span style={{ fontSize: '1rem' }}>CFA</span>
          </div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {metrics.benefice_caisse >= 0 ? 'Bénéfice net estimé' : 'Perte nette estimée'} (après charges)
          </p>
        </div>

        {/* 4. Cash disponible (trésorerie) */}
        <div className="card glass-effect" style={{ padding: '1.75rem', borderLeft: `5px solid ${metrics.flux_tresorerie >= 0 ? '#6366f1' : '#ef4444'}`, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Cash disponible</span>
            <div style={{ padding: '0.4rem', background: 'rgba(99, 102, 255, 0.1)', borderRadius: '8px', display: 'flex' }}>
               <Wallet size={20} color="#6366f1" />
            </div>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: metrics.flux_tresorerie >= 0 ? '#6366f1' : '#ef4444' }}>
            {metrics.flux_tresorerie.toLocaleString()} <span style={{ fontSize: '1rem' }}>CFA</span>
          </div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Trésorerie réelle (Entrées - Sorties globales)
          </p>
        </div>
      </div>

      {/* Secondary Metrics / Logistique */}
      <div className="res-grid-sm" style={{ marginBottom: '2.5rem' }}>
        <div className="card glass-effect" style={{ padding: '1.25rem', background: 'white' }}>
           <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Sorties / Charges Totales</p>
           <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444' }}>{metrics?.total_sorties?.toLocaleString() || 0} <span style={{ fontSize: '0.8rem' }}>CFA</span></div>
        </div>
        <div className="card glass-effect" style={{ padding: '1.25rem', background: 'white' }}>
           <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Payé Fournisseurs (COGS)</p>
           <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)' }}>{metrics?.cout_achat_total?.toLocaleString() || 0} <span style={{ fontSize: '0.8rem' }}>CFA</span></div>
        </div>
        <div className="card glass-effect" style={{ padding: '1.25rem', background: 'white' }}>
           <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Valeur du Stock</p>
           <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f59e0b' }}>{stockVal.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span></div>
        </div>
        <div className="card glass-effect" style={{ padding: '1.25rem', background: 'white' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
             <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Taux de Succès Logistique</p>
           </div>
           <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)' }}>{logStats.taux_succes}%</div>
        </div>
        <div className="card glass-effect" style={{ padding: '1.25rem', background: 'white' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
             <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Livraison Encaissée</p>
           </div>
           <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#6366f1' }}>{metrics.frais_livraison_total.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span></div>
        </div>
        <div className="card glass-effect" style={{ padding: '1.25rem', background: 'white' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
             <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Commandes À Traiter</p>
           </div>
           <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444' }}>{pendingCount}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', marginBottom: '2.5rem' }}>
        {/* Revenue Trend */}
        <div className="card glass-effect" style={{ padding: '2.5rem', gridColumn: '1 / -1', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.6rem', background: 'var(--primary-glow)', borderRadius: '12px', display: 'flex' }}>
                <Calendar size={22} color="var(--primary)" />
              </div>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem' }}>Tendance des Revenus <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '1rem' }}>({period === 'all' ? '15j' : period === 'today' ? '24h' : period})</span></h3>
            </div>
          </div>
          <div style={{ height: '380px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCABrut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="jour" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700, fill: '#64748b'}} dy={15} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 800, padding: '1rem' }}
                  formatter={(v, name) => [`${Number(v).toLocaleString()} CFA`, name === 'CA' ? 'Revenu Net' : 'Revenu Brut']}
                />
                <Area type="monotone" dataKey="CABrut" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCABrut)" activeDot={{ r: 6, fill: '#3b82f6', stroke: 'white', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="CA" stroke="#10b981" strokeWidth={5} fillOpacity={1} fill="url(#colorCA)" activeDot={{ r: 8, fill: '#10b981', stroke: 'white', strokeWidth: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="res-grid-2col" style={{ alignItems: 'start', gap: '2.5rem' }}>
          {/* Status Distribution (Pie Chart) */}
        <div className="card glass-effect" style={{ padding: '2.5rem', border: '1px solid rgba(255,255,255,0.6)' }}>
          <h3 style={{ marginBottom: '2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1.25rem' }}>
            <div style={{ padding: '0.6rem', background: 'var(--primary-glow)', borderRadius: '12px', display: 'flex' }}>
              <Activity size={22} color="var(--primary)" />
            </div>
            Répartition des Flux
          </h3>
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
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
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 700 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            {(statusData || []).map((s, i) => (
               <div key={s?.name || i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700 }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: [
                        '#10b981', '#6366f1', '#f59e0b', '#ef4444', 
                        '#8b5cf6', '#ec4899', '#06b6d4', '#475569'
                      ][i % 8], boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}></div>
                  <span style={{ color: 'var(--text-main)' }}>{s.name} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({s.value})</span></span>
               </div>
            ))}
          </div>
        </div>
          {/* Zone Risk Heatmap */}
        <div className="card glass-effect" style={{ padding: '2.5rem', border: '1px solid rgba(255,255,255,0.6)' }}>
          <h3 style={{ marginBottom: '2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1.25rem' }}>
            <div style={{ padding: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', display: 'flex' }}>
              <AlertCircle size={22} color="#ef4444" />
            </div>
            Heatmap de Risque Logistique
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {heatmapData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '16px' }}>Aucune donnée d'échec disponible</div>
            ) : heatmapData.slice(0, 10).map((z) => (
              <div key={z.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>{z.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>Vol: {z.volume}</span>
                    <span style={{ fontWeight: 900, color: z.color, fontSize: '0.95rem' }}>{z.risk}%</span>
                  </div>
                </div>
                <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', position: 'relative', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div 
                    style={{ 
                      width: `${z.risk}%`, 
                      height: '100%', 
                      background: z.color, 
                      borderRadius: '6px',
                      transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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

        <div className="res-grid-2col" style={{ alignItems: 'start', gap: '2.5rem' }}>
          {/* Best Sellers Section */}
        <div className="card glass-effect" style={{ padding: '2.5rem', border: '1px solid rgba(255,255,255,0.6)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
             <div style={{ padding: '0.6rem', background: 'rgba(99, 102, 255, 0.1)', borderRadius: '12px', display: 'flex' }}>
               <BarChart2 size={22} color="#6366f1" />
             </div>
             <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem' }}>Meilleurs Produits</h3>
           </div>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {topProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '16px' }}>
                  <ShoppingBag size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <p>Aucune donnée sur cette période.</p>
                </div>
              ) : (topProducts || []).slice(0, 10).map((p, i) => (
                <div key={p?.nom || i} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', transition: 'transform 0.2s ease', cursor: 'default' }} className="hover-lift">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text-muted)', width: '24px', background: '#f1f5f9', borderRadius: '8px', textAlign: 'center', padding: '0.2rem' }}>{i+1}</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</span>
                    </div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 900, color: p.taux_succes >= 70 ? '#10b981' : p.taux_succes >= 40 ? '#f59e0b' : '#ef4444' }}>
                      {p.taux_succes}%
                    </span>
                  </div>
                  <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    <span>Sortis: {p.total_sorties}</span>
                    <span>Livrées: {p.nb_ventes}</span>
                  </div>
                </div>
              ))}
           </div>
        </div>
          {/* Category Performance Section */}
        <div className="card glass-effect" style={{ padding: '2.5rem', border: '1px solid rgba(255,255,255,0.6)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
             <div style={{ padding: '0.6rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', display: 'flex' }}>
               <Tag size={22} color="#8b5cf6" />
             </div>
             <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem' }}>Performance Catégorie</h3>
           </div>
           
           <div style={{ height: '350px' }}>
              {(!categoryStats || categoryStats.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '16px' }}>
                  <Tag size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <p>Aucune donnée sur cette période.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryStats} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCatCA" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="nom" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700, fill: '#64748b'}} width={100} />
                    <Tooltip 
                      cursor={{fill: 'rgba(139, 92, 246, 0.05)'}}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 800, padding: '1rem' }}
                      formatter={(v, name) => [name === 'ca' ? `${Number(v).toLocaleString()} CFA` : `${v} Unités`, name === 'ca' ? 'Revenu' : 'Articles']}
                    />
                    <Bar dataKey="ca" fill="url(#colorCatCA)" radius={[0, 6, 6, 0]} barSize={16}>
                      {categoryStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill="url(#colorCatCA)" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
           </div>
        </div>
        </div>

        {/* Meilleures Zones Section */}
        <div className="card glass-effect" style={{ padding: '2.5rem', border: '1px solid rgba(255,255,255,0.6)', gridColumn: '1 / -1' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
             <div style={{ padding: '0.6rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', display: 'flex' }}>
               <MapPin size={22} color="#f59e0b" />
             </div>
             <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem' }}>Meilleures Zones de Livraison</h3>
           </div>
           
           <div className="res-grid-sm" style={{ gap: '1.5rem' }}>
              {(!bestZonesData || bestZonesData.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '16px', gridColumn: '1 / -1' }}>
                  <MapPin size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <p>Aucune donnée sur cette période.</p>
                </div>
              ) : bestZonesData.slice(0, 10).map((z, i) => (
                <div key={z.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }} className="hover-lift">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 900, color: '#f59e0b', width: '28px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', textAlign: 'center', padding: '0.3rem' }}>{i+1}</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{z.name}</span>
                    </div>
                    <span style={{ fontSize: '1rem', fontWeight: 900, color: z.taux_reussite >= 70 ? '#10b981' : z.taux_reussite >= 40 ? '#f59e0b' : '#ef4444' }}>
                      {z.taux_reussite}%
                    </span>
                  </div>
                  <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${z.taux_reussite}%`, 
                        height: '100%', 
                        background: z.taux_reussite >= 70 ? '#10b981' : z.taux_reussite >= 40 ? '#f59e0b' : '#ef4444', 
                        borderRadius: '6px',
                        transition: 'width 1s ease-out'
                      }}
                    ></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    <span>Colis: <strong style={{ color: 'var(--text-main)' }}>{z.colis}</strong></span>
                    <span>CA: <strong style={{ color: 'var(--text-main)' }}>{z.ca.toLocaleString()} CFA</strong></span>
                  </div>
                </div>
              ))}
           </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="card glass-effect" style={{ padding: '2.5rem', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
          <div style={{ padding: '0.6rem', background: 'rgba(14, 165, 233, 0.1)', borderRadius: '12px', display: 'flex' }}>
            <Clock size={22} color="#0ea5e9" />
          </div>
          <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem' }}>Dernières Activités</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {commandes.slice(0, 10).map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', transition: 'transform 0.2s, box-shadow 0.2s' }} className="hover-lift-shadow">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>{c.nom_client} <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', marginLeft: '0.5rem' }}>#{c.id.slice(-6).toUpperCase()}</span></div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.2rem' }}>{new Date(c.date_creation).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-main)' }}>{Number(c.montant_total).toLocaleString()} CFA</div>
                <span className={`badge badge-${c.statut_commande === 'livree' ? 'success' : c.statut_commande === 'en_cours_livraison' ? 'info' : c.statut_commande === 'echouee' ? 'danger' : 'warning'}`} style={{ borderRadius: '10px', minWidth: '110px', textAlign: 'center', padding: '0.5rem 1rem' }}>
                  {c.statut_commande.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
          {commandes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '16px' }}>
              Aucune activité récente.
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
};
