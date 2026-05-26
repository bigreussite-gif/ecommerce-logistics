import { useState, useEffect, useMemo } from 'react';
import { getRangeFinancials } from '../services/caisseService';
import { 
  generateTimeSeriesData, 
  calculateProfitMetrics, 
  calculateLogisticalStats, 
  calculateProductROI,
  addDepense,
  deleteDepense,
  EXTRACTION_LOGISTIQUE,
  EXTRACTION_ENTRETIEN
} from '../services/financialService';
import { TrendingUp, TrendingDown, Compass, PieChart, Calendar, BarChart2, Clock, Package, Trash2 } from 'lucide-react';
import { generateAnalyticalReportPDF } from '../services/pdfService';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Commande, LigneCommande } from '../types';
import { startOfMonth, endOfMonth, subDays, format } from 'date-fns';

export const FinancialReport = () => {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const [data, setData] = useState<{ retours: any[], commandes: (Commande & { lignes?: LigneCommande[] })[], depenses: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Prime Modal State
  const [showPrimeModal, setShowPrimeModal] = useState(false);
  const [primeAmount, setPrimeAmount] = useState('');
  const [primeDescription, setPrimeDescription] = useState('Prime Installation');
  const [primeDate, setPrimeDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [savingPrime, setSavingPrime] = useState(false);

  const refreshData = async () => {
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
    refreshData();
  }, [startDate, endDate]);

  const handleSavePrime = async () => {
    if (!primeAmount || isNaN(Number(primeAmount))) {
      showToast("Veuillez saisir un montant valide", "error");
      return;
    }

    setSavingPrime(true);
    try {
      await addDepense({
        date: primeDate,
        categorie: 'Personnel / Prime',
        montant: Number(primeAmount),
        description: primeDescription,
        mode_paiement: 'Espèces',
        paye_par_id: currentUser?.id
      });
      
      showToast("Prime enregistrée avec succès", "success");
      setShowPrimeModal(false);
      setPrimeAmount('');
      refreshData();
    } catch (e) {
      console.error(e);
      showToast("Erreur lors de l'enregistrement", "error");
    } finally {
      setSavingPrime(false);
    }
  };

  const handleDeleteDepense = async (id: string) => {
    if (!window.confirm("Supprimer cette dépense ?")) return;
    try {
      await deleteDepense(id);
      showToast("Dépense supprimée", "success");
      refreshData();
    } catch (e) {
      showToast("Erreur lors de la suppression", "error");
    }
  };

  // Calculations
  const stats = useMemo(() => {
    if (!data) return null;
    return calculateProfitMetrics(data.commandes, data.depenses || []);
  }, [data]);

  const diffDays = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
    return Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const logStats = useMemo(() => {
    if (!data) return null;
    return calculateLogisticalStats(data.commandes);
  }, [data]);

  const productROI = useMemo(() => {
    if (!data) return [];
    return calculateProductROI(data.commandes);
  }, [data]);

  if (loading || !data) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
      <p style={{ fontWeight: 600 }}>Analyse des flux financiers en cours...</p>
    </div>;
  }



  // Rapprochement physique (audit)
  const cashPhysiqueRecus = data.retours.reduce((acc, r) => acc + (r.montant_remis_par_livreur || 0), 0);
  const totalEcartCaisse = (stats?.surplus_caisse || 0) - (stats?.manquant_caisse || 0);


  const totalProduitsNet = stats?.ca_net_produits || 0;
  
  // Frais livraison payés (Success only for the top card to match CA Net)
  const totalFraisLivraisonSuccess = (data.commandes || [])
    .filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase()))
    .reduce((acc, c) => acc + (c.frais_livraison !== undefined && c.frais_livraison !== null ? Number(c.frais_livraison) : 1000), 0);

  // SOURCE DE VÉRITÉ POUR LA CAISSE (PHYSIQUE)
  const isCash = (c: Commande) => ['Cash à la livraison', 'Cash'].includes(c.mode_paiement || '');
  
  const totalMobileMoney = (data.commandes || [])
    .filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase()) && !isCash(c))
    .reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0);

  const successRate = logStats?.taux_succes || 0;

  const timeSeries = generateTimeSeriesData(data.commandes, data.depenses || [], diffDays > 31 ? 'monthly' : 'daily');

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
        <div className="mobile-stack">
          <h1 className="text-premium" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.2rem)', fontWeight: 800, margin: 0 }}>Rapport Analytique</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.4rem', fontWeight: 500 }}>
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

          <button 
            onClick={() => setShowPrimeModal(true)}
            className="btn btn-primary"
            style={{ 
              padding: '0.6rem 1.2rem', 
              borderRadius: '12px', 
              fontWeight: 800, 
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
            }}
          >
            <TrendingDown size={16} /> AJOUTER PRIME
          </button>
        </div>
      </div>

      {showPrimeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, animation: 'fadeIn 0.3s ease'
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '450px', padding: '2rem', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <TrendingDown size={24} style={{ color: 'var(--primary)' }} /> Enregistrer une Prime
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Utilisez ce formulaire pour enregistrer une prime d'installation oubliée.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Montant (CFA)</label>
                <input 
                  type="number"
                  value={primeAmount}
                  onChange={(e) => setPrimeAmount(e.target.value)}
                  placeholder="Ex: 2000"
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1.1rem', fontWeight: 700, outline: 'none' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Description / Agent</label>
                <input 
                  type="text"
                  value={primeDescription}
                  onChange={(e) => setPrimeDescription(e.target.value)}
                  placeholder="Ex: Prime d'installation - Livreur Alpha"
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Date de la Prime</label>
                <input 
                  type="date"
                  value={primeDate}
                  onChange={(e) => setPrimeDate(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  onClick={() => setShowPrimeModal(false)}
                  className="btn"
                  style={{ flex: 1, background: '#f1f5f9', color: '#64748b', fontWeight: 700, borderRadius: '12px' }}
                >
                  ANNULER
                </button>
                <button 
                  onClick={handleSavePrime}
                  className="btn btn-primary"
                  disabled={savingPrime}
                  style={{ flex: 2, fontWeight: 800, borderRadius: '12px' }}
                >
                  {savingPrime ? 'ENREGISTREMENT...' : 'ENREGISTRER LA PRIME'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Stats Grid - REORDERED */}
      <div className="res-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
          <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ESPÈCES ENCAISSÉES (CASH)</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {cashPhysiqueRecus.toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>CFA</span>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FRAIS DE LIVRAISON</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {totalFraisLivraisonSuccess.toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>CFA</span>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #f43f5e' }}>
          <span style={{ color: '#e11d48', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PRIMES D'INSTALLATION</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {(stats?.total_installation_primes || 0).toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>CFA</span>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
          <span style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CA NET PRODUITS</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {totalProduitsNet.toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>CFA</span>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #f97316' }}>
          <span style={{ color: '#ea580c', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EXTRACTION (COMMISSION)</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {((logStats?.livrees || 0) * EXTRACTION_LOGISTIQUE).toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>CFA</span>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #64748b' }}>
          <span style={{ color: '#475569', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EXTRACTION (ADMIN)</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            {((logStats?.livrees || 0) * EXTRACTION_ENTRETIEN).toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>CFA</span>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #8b5cf6', backgroundColor: '#fcfaff', boxShadow: '0 10px 15px -3px rgba(139, 92, 246, 0.1)' }}>
          <span style={{ color: '#6d28d9', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ARGENT ENVELOPPE</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '4px', color: '#4c1d95' }}>
            {(totalProduitsNet - ((logStats?.livrees || 0) * (EXTRACTION_LOGISTIQUE + EXTRACTION_ENTRETIEN))).toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>CFA</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
           Analyse Complémentaire
        </h3>
        <div className="res-grid" style={{ marginBottom: '1.5rem' }}>
          
          <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #3b82f6', background: 'rgba(59, 130, 246, 0.05)' }}>
            <span style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PAIEMENTS DIGITAUX</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              {(totalMobileMoney || 0).toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>CFA</span>
            </div>
          </div>

          <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: `4px solid ${totalEcartCaisse < 0 ? '#ef4444' : '#64748b'}` }}>
            <span style={{ color: totalEcartCaisse < 0 ? '#ef4444' : '#64748b', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ÉCART CONSTATÉ</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '4px', color: totalEcartCaisse < 0 ? '#ef4444' : 'inherit' }}>
              {totalEcartCaisse.toLocaleString()} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>CFA</span>
            </div>
          </div>

          <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #6366f1' }}>
            <span style={{ color: '#4f46e5', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TAUX DE SUCCESS</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: '0.5rem' }}>{successRate.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <div className="res-grid" style={{ gap: '2.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
                <BarChart2 size={20} style={{ color: 'var(--primary)' }} /> Tendances des Ventes
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
                      height: `${(d.revenue / (Math.max(...timeSeries.map(x => x.revenue), 1))) * 100}%`,
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
            <div className="res-grid-sm">
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

          <div className="card" style={{ padding: '2rem' }}>
             <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.5rem' }}>Charges de la Période</h3>
             <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(data?.depenses || []).length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '2rem 0' }}>Aucune charge enregistrée</p>
                ) : (
                  data.depenses.map((d: any) => (
                    <div key={d.id} style={{ padding: '1rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{d.categorie}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.description || 'Sans description'}</div>
                          <div style={{ fontSize: '0.7rem', marginTop: '0.2rem', color: 'var(--primary)', fontWeight: 700 }}>{safeFormat(d.date, 'dd/MM/yyyy')}</div>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ fontWeight: 900, color: '#f43f5e' }}>-{d.montant?.toLocaleString()}</div>
                          <button 
                            onClick={() => handleDeleteDepense(d.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '0.4rem', borderRadius: '8px', transition: 'all 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
                            onMouseOut={e => e.currentTarget.style.color = '#cbd5e1'}
                          >
                             <Trash2 size={16} />
                          </button>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Bilan par Produit */}
      <div style={{ marginTop: '2.5rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Package size={20} style={{ color: 'var(--primary)' }} /> Bilan par Produit
          </h3>
          <div className="table-container table-to-cards">
            <div className="table-container">
<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead className="mobile-hide">
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Produit</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Vendus</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Invendus/Échecs</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Chiffre d'Affaires</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Bénéfice Net</th>
                </tr>
              </thead>
              <tbody>
                {productROI.length === 0 ? (
                   <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune donnée</td></tr>
                ) : productROI.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s', cursor: 'default' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td data-label="Produit" style={{ padding: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{p.nom}</td>
                    <td data-label="Vendus" style={{ padding: '1rem', fontWeight: 900, color: '#10b981' }}>{p.ventes_reussies}</td>
                    <td data-label="Échecs" style={{ padding: '1rem', fontWeight: 800, color: '#ef4444' }}>{p.echecs}</td>
                    <td data-label="CA" style={{ padding: '1rem', fontWeight: 800 }}>{p.ca_produits.toLocaleString()} CFA</td>
                    <td data-label="Profit" style={{ padding: '1rem', fontWeight: 900, color: p.profit_net >= 0 ? '#10b981' : '#ef4444' }}>
                      {p.profit_net > 0 ? '+' : ''}{p.profit_net.toLocaleString()} CFA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          </div>
        </div>
      </div>
    </div>
  );
};
