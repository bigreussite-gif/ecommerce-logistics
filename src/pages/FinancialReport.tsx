import { useState, useEffect, useMemo } from 'react';
import { getRangeFinancials } from '../services/caisseService';
import { generateTimeSeriesData, calculateProfitMetrics } from '../services/financialService';
import { TrendingUp, TrendingDown, Compass, PieChart, Calendar, BarChart, Clock } from 'lucide-react';
import { generateAnalyticalReportPDF } from '../services/pdfService';
import { useToast } from '../contexts/ToastContext';
import { Commande, LigneCommande } from '../types';
import { startOfMonth, endOfMonth, subDays, format } from 'date-fns';

export const FinancialReport = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<{ retours: any[], commandes: (Commande & { lignes?: LigneCommande[] })[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const safeFormat = (dateStr: string, formatStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '...';
      return format(d, formatStr);
    } catch (e) {
      return '...';
    }
  };

  const setRange = (preset: 'today' | 'yesterday' | '7d' | '30d' | 'month') => {
    let s = new Date();
    let e = new Date();

    if (preset === 'yesterday') {
      s = subDays(new Date(), 1);
      e = subDays(new Date(), 1);
    } else if (preset === '7d') {
      s = subDays(new Date(), 7);
    } else if (preset === '30d') {
      s = subDays(new Date(), 30);
    } else if (preset === 'month') {
      s = startOfMonth(new Date());
      e = endOfMonth(new Date());
    }

    setStartDate(format(s, 'yyyy-MM-dd'));
    setEndDate(format(e, 'yyyy-MM-dd'));
  };

  useEffect(() => {
    const load = async () => {
      if (!startDate || !endDate) return;
      setLoading(true);
      try {
        const res = await getRangeFinancials(startDate, endDate);
        setData(res);
      } catch (e) {
        console.error(e);
        showToast("Erreur de chargement", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [startDate, endDate]);

  // Calculations
  const stats = useMemo(() => {
    if (!data) return null;
    return calculateProfitMetrics(data.commandes, []);
  }, [data]);

  if (loading || !data) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
      <p style={{ fontWeight: 600 }}>Analyse des flux financiers en cours...</p>
    </div>;
  }

  const getFrais = (c: Commande) => {
    if (c.frais_livraison !== undefined && c.frais_livraison !== null) return Number(c.frais_livraison);
    return 1000;
  };

  const succesCommandes = data.commandes.filter(c => {
    const s = c.statut_commande?.toLowerCase();
    return s === 'terminee' || s === 'livree';
  });

  const isSingleDay = startDate === endDate;
  const totalEncaisseBrut = isSingleDay && data.retours && data.retours.length > 0
    ? data.retours.reduce((acc, r) => acc + (r.montant_remis_par_livreur || 0), 0)
    : succesCommandes.reduce((acc, c) => acc + (c.montant_total || 0), 0);
    
  const totalFraisLivraison = succesCommandes.reduce((acc, c) => acc + getFrais(c), 0);
  const totalProduitsNet = totalEncaisseBrut - totalFraisLivraison;

  const successRate = data.commandes.length > 0 
    ? (succesCommandes.length / data.commandes.length) * 100 
    : 0;

  const diffDays = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
    return Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const timeSeries = generateTimeSeriesData(data.commandes, diffDays > 31 ? 'monthly' : 'daily');

  const generateInsights = () => {
    const insights: any[] = [];
    if (successRate < 70) {
      insights.push({
        type: 'danger',
        icon: <TrendingDown size={20} />,
        title: "Efficacité Critique",
        text: `Seulement ${successRate.toFixed(1)}% de succès. Un taux de retour élevé impacte directement vos coûts.`
      });
    } else {
      insights.push({
        type: 'success',
        icon: <TrendingUp size={20} />,
        title: "Performance Optimisée",
        text: `Taux de succès de ${successRate.toFixed(1)}%. Vos flux sont sains.`
      });
    }
    return insights;
  };

  const handleGeneratePDF = () => {
    try {
      generateAnalyticalReportPDF(data, startDate + ' to ' + endDate);
      showToast("Rapport généré !", "success");
    } catch (e) {
      showToast("Erreur PDF", "error");
    }
  };

  const insights = generateInsights();

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>Rapport Analytique</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>
             Période du {safeFormat(startDate, 'dd MMM')} au {safeFormat(endDate, 'dd MMM yyyy')}
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.4rem', background: '#f1f5f9', padding: '0.4rem', borderRadius: '14px' }}>
            {[
              { id: 'today', label: 'Aujourd\'hui' },
              { id: 'yesterday', label: 'Hier' },
              { id: '7d', label: '7j' },
              { id: '30d', label: '30j' },
              { id: 'month', label: 'Mois' }
            ].map(p => (
              <button 
                key={p.id}
                onClick={() => setRange(p.id as any)}
                style={{ 
                  padding: '0.5rem 0.8rem', 
                  borderRadius: '10px', 
                  border: 'none', 
                  background: 'transparent',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'white'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'white', padding: '0.6rem 1rem', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <Calendar size={18} style={{ color: 'var(--primary)' }} />
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              style={{ border: 'none', fontWeight: 700, outline: 'none', fontSize: '0.85rem' }} 
            />
            <span style={{ color: '#cbd5e1' }}>/</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              style={{ border: 'none', fontWeight: 700, outline: 'none', fontSize: '0.85rem' }} 
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
          <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CA NET PRODUITS</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {totalProduitsNet.toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>CFA</span>
          </div>
        </div>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FRAIS DE LIVRAISON</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {totalFraisLivraison.toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>CFA</span>
          </div>
        </div>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ color: '#d97706', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>MARGE ESTIMÉE</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {(stats?.profit_net || 0).toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>CFA</span>
          </div>
        </div>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #6366f1' }}>
          <span style={{ color: '#4f46e5', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TAUX DE SUCCESS</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem' }}>{successRate.toFixed(1)}%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2.5rem' }} className="responsive-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
                <BarChart size={20} style={{ color: 'var(--primary)' }} /> Tendances des Ventes
              </h3>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                Basé sur {data.commandes.length} commandes
              </div>
            </div>
            <div style={{ height: '280px', display: 'flex', alignItems: 'flex-end', gap: '12px', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
              {timeSeries.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                  <div 
                    title={`${d.revenue.toLocaleString()} CFA`}
                    style={{ 
                      width: '100%', 
                      background: 'linear-gradient(to top, var(--primary), #818cf8)', 
                      height: `${(d.revenue / (Math.max(...timeSeries.map(x => x.revenue)) || 1)) * 100}%`,
                      borderRadius: '6px 6px 0 0',
                      minHeight: '4px',
                      transition: 'height 0.3s ease',
                      cursor: 'help'
                    }}
                  ></div>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center', width: '100%', overflow: 'hidden', whiteSpace: 'nowrap' }}>{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <PieChart size={20} style={{ color: 'var(--primary)' }} /> 
              Analyse de Performance
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
               {insights.map((ins, i) => (
                <div key={i} style={{ 
                  display: 'flex', gap: '1rem', padding: '1.25rem', borderRadius: '16px',
                  background: ins.type === 'danger' ? '#fff1f2' : '#f0fdf4',
                  border: `1px solid ${ins.type === 'danger' ? '#fecaca' : '#bbf7d0'}`
                }}>
                  <div style={{ color: ins.type === 'danger' ? '#ef4444' : '#10b981' }}>{ins.icon}</div>
                  <div>
                    <h5 style={{ margin: 0, fontWeight: 800, color: ins.type === 'danger' ? '#991b1b' : '#166534' }}>{ins.title}</h5>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: ins.type === 'danger' ? '#ef4444' : '#15803d', lineHeight: 1.5 }}>{ins.text}</p>
                  </div>
                </div>
               ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card" style={{ padding: '2rem', background: '#0f172a', color: 'white', borderRadius: '28px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'var(--primary)', filter: 'blur(60px)', opacity: 0.4 }}></div>
            
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
              <Compass size={20} style={{ color: 'var(--primary)' }} /> Recommandations
            </h3>
            <p style={{ fontSize: '0.95rem', opacity: 0.9, lineHeight: 1.7, position: 'relative' }}>
              {successRate > 80 
                ? "Vos performances de livraison sont excellentes. Profitez de cette stabilité pour lancer des programmes de fidélité ou des offres de parrainage." 
                : "Attention : Le taux de retour impacte votre rentabilité. Nous conseillons de reconfirmer systématiquement les adresses par appel 1h avant la livraison."}
            </p>
            
            <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                 <Clock size={16} style={{ color: 'var(--primary)' }} />
                 <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exporter Rapport</span>
               </div>
               <button className="btn btn-primary" style={{ width: '100%', background: 'white', color: '#0f172a', fontWeight: 900, borderRadius: '12px' }} onClick={handleGeneratePDF}>
                TÉLÉCHARGER PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
