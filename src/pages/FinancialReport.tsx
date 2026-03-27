import { useState, useEffect, useMemo } from 'react';
import { getDailyFinancials } from '../services/caisseService';
import { getCommandesByStatus } from '../services/commandeService';
import { generateTimeSeriesData, calculateProfitMetrics } from '../services/financialService';
import { TrendingUp, TrendingDown, Compass, PieChart, Calendar, FileText, BarChart } from 'lucide-react';
import { generateAnalyticalReportPDF } from '../services/pdfService';
import { useToast } from '../contexts/ToastContext';
import { Commande, LigneCommande } from '../types';
import { startOfMonth, endOfMonth } from 'date-fns';

export const FinancialReport = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<{ retours: any[], commandes: (Commande & { lignes?: LigneCommande[] })[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (viewMode === 'daily') {
          const res = await getDailyFinancials(selectedDate);
          setData(res);
        } else {
          // Monthly view: fetch all successful commands for the month
          const start = startOfMonth(new Date(selectedDate)).toISOString();
          const end = endOfMonth(new Date(selectedDate)).toISOString();
          const cmds = await getCommandesByStatus(['terminee', 'livree']);
          // Filter by date locally for simplicity in this version, or refine service
          const monthlyCmds = cmds.filter(c => {
            const d = c.date_livraison_effective || c.date_creation;
            return d >= start && d <= end;
          });
          setData({ retours: [], commandes: monthlyCmds });
        }
      } catch (e) {
        console.error(e);
        showToast("Erreur de chargement", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedDate, viewMode]);

  // Calculations
  const stats = useMemo(() => {
    if (!data) return null;
    return calculateProfitMetrics(data.commandes, []);
  }, [data]);

  if (loading || !data) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Veuillez patienter pendant l'analyse...</div>;
  }

  const getFrais = (c: Commande) => {
    if (c.frais_livraison !== undefined && c.frais_livraison !== null) return Number(c.frais_livraison);
    return 1000; // default fallout
  };

  const succesCommandes = data.commandes.filter(c => {
    const s = c.statut_commande?.toLowerCase();
    return s === 'terminee' || s === 'livree';
  });

  const totalEncaisseBrut = viewMode === 'daily' 
    ? data.retours.reduce((acc, r) => acc + (r.montant_remis_par_livreur || 0), 0)
    : succesCommandes.reduce((acc, c) => acc + (c.montant_total || 0), 0);
    
  const totalFraisLivraison = succesCommandes.reduce((acc, c) => acc + getFrais(c), 0);
  const totalProduitsNet = totalEncaisseBrut - totalFraisLivraison;

  const successRate = data.commandes.length > 0 
    ? (succesCommandes.length / data.commandes.length) * 100 
    : 0;

  const timeSeries = generateTimeSeriesData(data.commandes, viewMode === 'monthly' ? 'monthly' : 'daily');

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
      generateAnalyticalReportPDF(data, selectedDate);
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
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem' }}>{viewMode === 'daily' ? 'Analyse Journalière' : 'Analyse Mensuelle'} - GomboSwift</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="btn-group" style={{ background: 'white', borderRadius: '12px', padding: '4px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <button 
              className={`btn ${viewMode === 'daily' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setViewMode('daily')}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >Jour</button>
            <button 
              className={`btn ${viewMode === 'monthly' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setViewMode('monthly')}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >Mois</button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <Calendar size={18} style={{ color: 'var(--primary)' }} />
            <input 
              type={viewMode === 'daily' ? "date" : "month"}
              value={selectedDate.slice(0, viewMode === 'daily' ? 10 : 7)} 
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ border: 'none', fontWeight: 800, outline: 'none', background: 'transparent' }} 
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
          <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase' }}>CA Produits (Net)</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, marginTop: '0.5rem' }}>{totalProduitsNet.toLocaleString()} F</div>
        </div>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase' }}>Frais Livraison</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, marginTop: '0.5rem' }}>{totalFraisLivraison.toLocaleString()} F</div>
        </div>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ color: '#d97706', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase' }}>Profit Estimé</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, marginTop: '0.5rem' }}>{(stats?.profit_net || 0).toLocaleString()} F</div>
        </div>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #6366f1' }}>
          <span style={{ color: '#4f46e5', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase' }}>Taux de Succès</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, marginTop: '0.5rem' }}>{successRate.toFixed(1)}%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2.5rem' }} className="responsive-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <BarChart size={20} style={{ color: 'var(--primary)' }} /> Tendances de la période
            </h3>
            <div style={{ height: '240px', display: 'flex', alignItems: 'flex-end', gap: '15px', paddingBottom: '2rem' }}>
              {timeSeries.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '100%', 
                    background: 'var(--primary)', 
                    height: `${(d.revenue / (Math.max(...timeSeries.map(x => x.revenue)) || 1)) * 100}%`,
                    borderRadius: '4px 4px 0 0',
                    minHeight: '4px',
                    opacity: 0.8
                  }}></div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.5rem' }}>
              <PieChart size={20} style={{ color: 'var(--primary)', marginRight: '8px' }} /> 
              Analyse Contextuelle
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               {insights.map((ins, i) => (
                <div key={i} style={{ 
                  display: 'flex', gap: '1rem', padding: '1rem', borderRadius: '12px',
                  background: ins.type === 'danger' ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${ins.type === 'danger' ? '#fee2e2' : '#dcfce7'}`
                }}>
                  {ins.icon}
                  <div>
                    <h5 style={{ margin: 0, fontWeight: 700 }}>{ins.title}</h5>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>{ins.text}</p>
                  </div>
                </div>
               ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card" style={{ padding: '2rem', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: 'white', borderRadius: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Compass size={18} color="var(--primary)" /> Orientation
            </h3>
            <p style={{ fontSize: '0.9rem', opacity: 0.8, lineHeight: 1.6 }}>
              {successRate > 80 
                ? "Excellente rétention. Concentrez-vous sur l'acquisition de nouveaux clients via des campagnes de parrainage." 
                : "Taux de retour préoccupant. Une vérification des adresses et des disponibilités clients avant expédition est conseillée."}
            </p>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', background: 'white', color: 'var(--primary)', fontWeight: 800 }} onClick={handleGeneratePDF}>
              <FileText size={18} style={{ marginRight: '8px' }} /> GÉNÉRER EXPORT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
