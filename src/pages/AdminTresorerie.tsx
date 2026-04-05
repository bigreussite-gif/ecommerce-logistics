import { useState, useEffect, useMemo } from 'react';
import { getFinancialData } from '../services/commandeService';
import { 
  getDepenses, 
  calculateProfitMetrics, 
  calculateProductROI, 
  ProductROI,
  analyzeGeographicalProfit,
  projectCashFlow,
  calculateMarketingROI,
  generateTimeSeriesData,
  GeoProfit
} from '../services/financialService';
import { getRangeFinancials } from '../services/caisseService';
import { Commande, LigneCommande, Depense, CaisseRetour } from '../types';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { 
  Download, 
  Filter, 
  Wallet,
  TrendingUp,
  History,
  ShieldCheck,
  Package,
  AlertCircle,
  CheckCircle,
  BarChart2,
  Zap,
  Globe,
  Activity,
  Target
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface Transaction {
  date: Date;
  type: 'Entrée' | 'Sortie';
  categorie: string;
  description: string;
  montant: number;
}

export const AdminTresorerie = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [adsSpend, setAdsSpend] = useState(150000); // Default example ads spend
  
  const [data, setData] = useState<{
    orders: (Commande & { lignes: LigneCommande[] })[];
    expenses: Depense[];
    retours: CaisseRetour[];
  }>({ orders: [], expenses: [], retours: [] });

  const loadData = async () => {
    setLoading(true);
    try {
      const start = startOfDay(new Date(startDate)).toISOString();
      const end = endOfDay(new Date(endDate)).toISOString();
      
      const [orders, expenses, caisseData] = await Promise.all([
        getFinancialData(start, end),
        getDepenses(),
        getRangeFinancials(start, end)
      ]);
      
      const filteredExpenses = expenses.filter(d => {
        const dDate = new Date(d.date);
        return dDate >= new Date(start) && dDate <= new Date(end);
      });

      setData({ 
        orders, 
        expenses: filteredExpenses, 
        retours: caisseData.retours || [] 
      });
    } catch (error) {
      showToast("Erreur lors de la récupération des données", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  // Comprehensive Profit Metrics
  const metrics = useMemo(() => calculateProfitMetrics(data.orders, data.expenses), [data]);

  // Calculations for Private Dashboard
  const activeOrders = data.orders || [];
  const netRevenue = metrics.ca_brut - metrics.frais_livraison_total; // Revenue from items
  
  // Extraction Logic
  const livreesCount = activeOrders.filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase() || '')).length;
  const extractionVentes = livreesCount * 250;
  const extractionLogistique = livreesCount * 500;
  const extractionInternet = livreesCount * 300;
  const totalExtractions = extractionVentes + extractionLogistique + extractionInternet;
  
  // Final Profit after COGS and Extractions
  const realProfit = metrics.profit_net - totalExtractions;

  // Current Balance (Estimated from Cash received & available)
  const currentCashInAccount = 540000; // Mock current balance

  // Marketing Analysis (Idea 1)
  const mkt = useMemo(() => calculateMarketingROI(metrics.ca_brut, adsSpend, data.orders.length), [metrics.ca_brut, adsSpend, data.orders.length]);

  // Predictive Projection (Idea 2)
  const history = useMemo(() => generateTimeSeriesData(data.orders), [data.orders]);
  const projections = useMemo(() => projectCashFlow(history, currentCashInAccount), [history, currentCashInAccount]);

  // Geographical Analysis (Idea 5)
  const geoProfit: GeoProfit[] = useMemo(() => analyzeGeographicalProfit(data.orders), [data.orders]);

  // Product ROI Analysis
  const productROI: ProductROI[] = useMemo(() => calculateProductROI(data.orders), [data.orders]);

  // Cash Reconciliation Logic
  const cashStats = useMemo(() => {
    const totalEcart = data.retours.reduce((acc, r) => acc + (r.ecart || 0), 0);
    const totalRemis = data.retours.reduce((acc, r) => acc + (r.montant_remis_par_livreur || 0), 0);
    const totalAttendu = data.retours.reduce((acc, r) => acc + (r.montant_attendu || 0), 0);
    return { totalEcart, totalRemis, totalAttendu };
  }, [data.retours]);

  // AI Health Score Calculation
  const healthScore = useMemo(() => {
    if (!metrics.ca_brut) return 0;
    
    // Components (0-100 each)
    const marginScore = Math.min(100, (metrics.marge_nette_percent / 25) * 100); // 25% is goal
    const successScore = metrics.taux_succes * 1.25; // 80% is 100
    const liquidityScore = cashStats.totalEcart >= 0 ? 100 : Math.max(0, 100 - (Math.abs(cashStats.totalEcart) / (metrics.profit_net || 1) * 100));

    const total = (marginScore * 0.4) + (successScore * 0.4) + (liquidityScore * 0.2);
    return Math.round(Math.min(100, Math.max(0, total)));
  }, [metrics, cashStats]);

  // Cash Flow Logic
  const transactions: Transaction[] = useMemo(() => [
    ...data.orders.map(o => ({
      date: new Date(o.date_livraison_effective || o.date_creation),
      type: 'Entrée' as const,
      categorie: 'Vente',
      description: `Commande #${(o.id || '').substring(0, 8).toUpperCase() || '...'} - ${o.nom_client}`,
      montant: (Number(o.montant_total) || 0) - (Number(o.frais_livraison) || 0)
    })),
    ...data.expenses.map(e => ({
      date: new Date(e.date),
      type: 'Sortie' as const,
      categorie: e.categorie,
      description: e.description || 'Dépense diverse',
      montant: -Math.abs(Number(e.montant) || 0)
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime()), [data]);

  const totalInflow = useMemo(() => transactions
    .filter(t => t.type === 'Entrée')
    .reduce((acc, t) => acc + t.montant, 0), [transactions]);

  const totalOutflow = useMemo(() => Math.abs(
    transactions
      .filter(t => t.type === 'Sortie')
      .reduce((acc, t) => acc + t.montant, 0)
  ), [transactions]);

  const currentBalance = totalInflow - totalOutflow - totalExtractions;

  const exportToExcel = () => {
    const headers = ["Date", "Type", "Catégorie", "Description", "Montant (CFA)"];
    const rows = transactions.map(t => [
      format(t.date, 'yyyy-MM-dd HH:mm'),
      t.type,
      t.categorie,
      t.description,
      t.montant
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Tresorerie_GomboSwift_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exportation réussie", "success");
  };

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      {/* Header & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>
            Trésorerie & Dashboard Privé
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem' }}>
            Analyse confidentielle des flux, COGS et rentabilité nette.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'white', padding: '0.75rem 1.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={18} color="var(--primary)" />
            <input type="date" className="form-input" style={{ width: '130px', padding: '0.4rem' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span style={{ color: 'var(--text-muted)' }}>au</span>
            <input type="date" className="form-input" style={{ width: '130px', padding: '0.4rem' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button className="btn btn-outline" onClick={exportToExcel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={18} /> Excel
          </button>
        </div>
      </div>

      {/* Stats Grid - PRIVATE DASHBOARD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Ventes Nettes</p>
          <h2 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 800 }}>{netRevenue.toLocaleString()} F</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Excluant {metrics.frais_livraison_total.toLocaleString()} F de livraison</p>
        </div>

        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Coût Achat (COGS)</p>
          <h2 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 800, color: '#d97706' }}>{metrics.cogs_total.toLocaleString()} F</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Valeur stock vendu</p>
        </div>

        <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #ef4444' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Extractions & Frais</p>
          <h2 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 800, color: '#ef4444' }}>{(totalExtractions + metrics.depenses_fixes_total).toLocaleString()} F</h2>
          <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem' }}>Extractions: {totalExtractions.toLocaleString()} F</p>
        </div>

        <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none' }}>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Profit Réel Net</p>
          <h2 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 800 }}>{realProfit.toLocaleString()} F</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <TrendingUp size={14} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{metrics.marge_nette_percent}% de marge</span>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 1fr', gap: '2rem' }} className="responsive-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Cash Flow Table */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700 }}>
                <Wallet size={20} color="var(--primary)" /> Journal des Flux
              </h3>
              <div style={{ display: 'flex', gap: '0.50rem' }}>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>+{totalInflow.toLocaleString()}</span>
                <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>-{totalOutflow.toLocaleString()}</span>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '3rem' }}>Chargement...</td></tr>
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '3rem' }}>Aucune donnée</td></tr>
                  ) : transactions.map((t, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{format(t.date, 'dd/MM HH:mm')}</td>
                      <td>
                        <span className={`badge ${t.type === 'Entrée' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                          {t.type}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.description}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.categorie}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: t.type === 'Entrée' ? 'var(--success)' : '#ef4444' }}>
                        {t.montant > 0 ? '+' : ''}{t.montant.toLocaleString()} F
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary Card */}
          <div className="card" style={{ padding: '1.5rem', background: '#1e293b', color: 'white' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7, color: 'white' }}>Balance de Période</h4>
            <h2 style={{ fontSize: '2rem', margin: '0.5rem 0', fontWeight: 800 }}>{currentBalance.toLocaleString()} F</h2>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '1rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ opacity: 0.7 }}>Volume Ventes</span>
              <span style={{ fontWeight: 700 }}>{activeOrders.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              <span style={{ opacity: 0.7 }}>Dépenses Fixes</span>
              <span style={{ fontWeight: 700 }}>{metrics.depenses_fixes_total.toLocaleString()} F</span>
            </div>
          </div>

          {/* Business Rules Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ margin: 0, marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={16} /> Barème d'Extractions
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Frais Admin</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>250 F / v</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Frais Logistique</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>500 F / v</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Frais Internet</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>300 F / v</span>
              </div>
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              * Les extractions sont appliquées par colis livré et déduites de la balance.
            </p>
          </div>
        </div>
      </div>

      {/* NEW: SECTION RAPPROCHEMENT CAISSE (IDEA 2) */}
      <div style={{ marginTop: '3rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', fontWeight: 900 }}>
          <ShieldCheck size={24} color="#10b981" /> Rapprochement Caisse & Contrôle de Fraude
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '1.5rem', border: '2px solid' + (cashStats.totalEcart < 0 ? '#fecaca' : '#d1fae5') }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>ÉCART TOTAL DE PÉRIODE</span>
              <AlertCircle size={20} color={cashStats.totalEcart < 0 ? '#ef4444' : '#10b981'} />
            </div>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 950, color: cashStats.totalEcart < 0 ? '#ef4444' : '#10b981' }}>
              {cashStats.totalEcart.toLocaleString()} F
            </h2>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>
              {cashStats.totalEcart < 0 ? "⚠️ Fuite de trésorerie détectée" : "✅ Caisse équilibrée"}
            </p>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CASH ATTENDU (LIVRISONS)</span>
              <span style={{ fontWeight: 800 }}>{cashStats.totalAttendu.toLocaleString()} F</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CASH REÇU (PHYSIQUE)</span>
              <span style={{ fontWeight: 800 }}>{cashStats.totalRemis.toLocaleString()} F</span>
            </div>
            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (cashStats.totalRemis / (cashStats.totalAttendu || 1)) * 100)}%`, height: '100%', background: '#6366f1' }}></div>
            </div>
          </div>
        </div>

        {/* AI HEALTH SCORE BANNER */}
        <div className="card glass-effect" style={{ 
          background: 'linear-gradient(90deg, #1e293b 0%, #334155 100%)', 
          border: 'none', 
          padding: '1.5rem 2.5rem', 
          marginBottom: '2.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'white',
          borderRadius: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', border: '6px solid rgba(255,255,255,0.1)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
            }}>
              <div style={{ 
                position: 'absolute', inset: '-6px', borderRadius: '50%', 
                border: '6px solid #10b981', 
                clipPath: `inset(0 ${100 - healthScore}% 0 0)`,
                transition: 'clip-path 1.5s ease-out'
              }} />
              <span style={{ fontSize: '1.8rem', fontWeight: 950 }}>{healthScore}</span>
            </div>
            <div>
               <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 Score de Santé Financière <Zap size={20} color="#fbbf24" fill="#fbbf24" />
               </h3>
               <p style={{ margin: '0.2rem 0 0', opacity: 0.7, fontWeight: 600 }}>
                 {healthScore > 80 ? "🚀 Performance excellente. Capacité d'investissement élevée." : 
                  healthScore > 50 ? "📈 Santé stable. Surveillez vos marges opérationnelles." : 
                  "⚠️ Vigilance requise. Vérifiez vos écarts de caisse et frais logistiques."}
               </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '3rem' }}>
             <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>{metrics.taux_succes}%</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 800, textTransform: 'uppercase' }}>Efficacité</div>
             </div>
             <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fbbf24' }}>{metrics.marge_nette_percent}%</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 800, textTransform: 'uppercase' }}>Rentabilité</div>
             </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'white', padding: '0.8rem 1.2rem', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-premium)' }}>
             <Target size={18} color="#6366f1" />
             <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8' }}>Dépenses Ads Facebook (F CFA)</span>
                <input 
                  type="number" 
                  value={adsSpend} 
                  onChange={e => setAdsSpend(Number(e.target.value))} 
                  style={{ border: 'none', fontWeight: 900, outline: 'none', fontSize: '1rem', color: 'var(--text-main)', width: '150px' }}
                />
             </div>
          </div>
        </div>

        {/* AI HEALTH & MARKETING ROI (IDEA 1) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div className="card glass-effect" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', border: 'none', color: 'white', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
               <div>
                  <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Score de Santé <Zap size={20} color="#fbbf24" fill="#fbbf24" />
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', opacity: 0.7, fontWeight: 600, fontSize: '0.85rem' }}>
                    Analyse multicritère (Profit, Efficacité, Cash)
                  </p>
               </div>
               <div style={{ fontSize: '2.5rem', fontWeight: 950 }}>{healthScore}</div>
            </div>
            
            <div style={{ display: 'flex', gap: '1.5rem' }}>
               <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '14px' }}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', marginBottom: '0.3rem' }}>ROAS Marketing</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: mkt.roas > 3 ? '#10b981' : '#fbbf24' }}>x{mkt.roas}</div>
               </div>
               <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '14px' }}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', marginBottom: '0.3rem' }}>Coût/Client (CAC)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{mkt.cac.toLocaleString()} F</div>
               </div>
            </div>
          </div>

          <div className="card" style={{ padding: '2rem', border: 'none', background: '#f8fafc', position: 'relative' }}>
             <h3 style={{ margin: '0 0 1.5rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Activity size={20} color="#6366f1" /> Prédiction Cash-Flow (IA)
             </h3>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Provision attendue à 30 jours :</span>
                <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)' }}>{projections.day30.toLocaleString()} F</span>
             </div>
             <div style={{ height: '50px', display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '1.5rem' }}>
                {[...Array(20)].map((_, i) => (
                  <div key={i} style={{ flex: 1, background: '#e2e8f0', borderRadius: '2px', height: `${20 + Math.random() * 80}%` }} />
                ))}
                <div style={{ width: '40px', background: 'var(--primary)', height: '100%', borderRadius: '2px' }} />
             </div>
             <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
               Vitesse de croisière : <span style={{ color: '#10b981' }}>+{(projections.avg_velocity || 0).toLocaleString()} F / jour</span>
             </p>
          </div>
        </div>

        {/* GEOGRAPHICAL PROFITABILITY & DISCREPANCY */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 1fr', gap: '1.5rem', marginBottom: '4rem' }}>
           <div className="card" style={{ padding: '0' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Globe size={18} color="var(--primary)" />
                    <h4 style={{ margin: 0, fontWeight: 900 }}>Rentabilité Géographique</h4>
                 </div>
              </div>
              <div className="table-container">
                 <table>
                    <thead>
                       <tr>
                          <th>Commune</th>
                          <th>Succès</th>
                          <th>CA Net</th>
                          <th style={{ textAlign: 'right' }}>Profit Net</th>
                       </tr>
                    </thead>
                    <tbody>
                       {geoProfit.map(g => (
                         <tr key={g.commune}>
                            <td style={{ fontWeight: 800 }}>{g.commune}</td>
                            <td>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ width: '40px', height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                                     <div style={{ width: `${g.taux_succes}%`, height: '100%', background: g.taux_succes > 70 ? '#10b981' : '#fbbf24' }} />
                                  </div>
                                  <span style={{ fontSize: '0.7rem' }}>{g.taux_succes}%</span>
                               </div>
                            </td>
                            <td>{g.ca_net.toLocaleString()} F</td>
                            <td style={{ textAlign: 'right', fontWeight: 900, color: g.profit_net > 0 ? '#10b981' : '#ef4444' }}>
                               {g.profit_net.toLocaleString()} F
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>

           <div className="card" style={{ padding: '1.5rem', border: '2px solid' + (cashStats.totalEcart < 0 ? '#fecaca' : '#d1fae5') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>AUDIT CAISSE PHYSIQUE</span>
                <AlertCircle size={20} color={cashStats.totalEcart < 0 ? '#ef4444' : '#10b981'} />
              </div>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 950, color: cashStats.totalEcart < 0 ? '#ef4444' : '#10b981' }}>
                {cashStats.totalEcart.toLocaleString()} F
              </h2>
              <div style={{ marginTop: '1.5rem', background: 'white', padding: '1rem', borderRadius: '12px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                    <span>Attendu</span>
                    <span style={{ fontWeight: 800 }}>{cashStats.totalAttendu.toLocaleString()} F</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span>Encours</span>
                    <span style={{ fontWeight: 800 }}>{cashStats.totalRemis.toLocaleString()} F</span>
                 </div>
              </div>
            </div>
        </div>

        <div className="grid" style={{ marginBottom: '2.5rem' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} color="#10b981" />
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>Détails des Rapports de Caisse</h4>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Livreur</th>
                  <th>Remis</th>
                  <th>Attendu</th>
                  <th style={{ textAlign: 'right' }}>Écart</th>
                </tr>
              </thead>
              <tbody>
                {data.retours.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun retour de caisse enregistré.</td></tr>
                ) : (data.retours || []).map(r => (
                  <tr key={r?.id || Math.random()}>
                    <td style={{ fontSize: '0.8rem' }}>{r.date ? format(new Date(r.date), 'dd/MM HH:mm') : '...'}</td>
                    <td style={{ fontWeight: 700 }}>{(r.livreur_id || '').slice(0, 8) || '...'}</td>
                    <td style={{ fontWeight: 600 }}>{r.montant_remis_par_livreur.toLocaleString()} F</td>
                    <td>{r.montant_attendu.toLocaleString()} F</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: r.ecart < 0 ? '#ef4444' : '#10b981' }}>
                      {r.ecart > 0 ? '+' : ''}{r.ecart.toLocaleString()} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* NEW: SECTION PRODUCT ROI (IDEA 6) */}
      <div style={{ marginTop: '4rem', marginBottom: '4rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', fontWeight: 900 }}>
          <BarChart2 size={24} color="var(--primary)" /> Deep ROI par Produit (Rentabilité Nette)
        </h3>

        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {productROI.map(p => (
            <div key={p.id} className="card glass-effect" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
               <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.5rem 1rem', background: p.roi_percent > 100 ? '#d1fae5' : '#f1f5f9', color: p.roi_percent > 100 ? '#065f46' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 900, borderBottomLeftRadius: '12px' }}>
                 ROI: {p.roi_percent}%
               </div>
               
               <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                 <div style={{ background: 'var(--primary-light)', padding: '0.75rem', borderRadius: '12px', color: 'var(--primary)' }}>
                    <Package size={24} />
                 </div>
                 <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>{p.nom}</h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ID: {(p.id || '').slice(0,8) || '...'}</p>
                 </div>
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Ventes Réussies</span>
                    <span style={{ fontWeight: 800, color: '#10b981' }}>{p.ventes_reussies} unités</span>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#fef2f2', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Échecs Livraison</span>
                    <span style={{ fontWeight: 800, color: '#ef4444' }}>{p.echecs} colis</span>
                  </div>
               </div>

               <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Revenue Articles</span>
                    <span style={{ fontWeight: 700 }}>{p.ca_produits.toLocaleString()} F</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Coût d'Achat</span>
                    <span style={{ fontWeight: 700, color: '#64748b' }}>-{p.cogs.toLocaleString()} F</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Perte sur Échecs</span>
                    <span style={{ fontWeight: 700, color: '#ef4444' }}>-{p.frais_perte_livraison.toLocaleString()} F</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--primary)', color: 'white', borderRadius: '14px' }}>
                    <span style={{ fontWeight: 700 }}>Profit Net Réel</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 950 }}>{p.profit_net.toLocaleString()} F</span>
                  </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
