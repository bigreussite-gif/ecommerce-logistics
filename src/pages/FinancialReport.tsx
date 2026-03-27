import { useState, useEffect } from 'react';
import { getDailyFinancials } from '../services/caisseService';
import { TrendingUp, TrendingDown, Target, Compass, PieChart, AlertTriangle, Lightbulb, Calendar, Truck, FileText } from 'lucide-react';
import { generateAnalyticalReportPDF } from '../services/pdfService';
import { useToast } from '../contexts/ToastContext';
import { Commande } from '../types';

export const FinancialReport = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<{ retours: any[], commandes: Commande[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getDailyFinancials(selectedDate);
        setData(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedDate]);

  if (loading || !data) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Veuillez patienter pendant l'analyse...</div>;
  }

  // Helper for historical delivery fee fallback
  const getFrais = (c: Commande) => {
    if (c.frais_livraison !== undefined && c.frais_livraison !== null) return Number(c.frais_livraison);
    if (c.statut_commande === 'terminee' || c.statut_commande === 'livree') return 1000;
    return 0;
  };

  // --- CALCUL STATS ---
  const totalEncaisseBrut = data.retours.reduce((acc, r) => acc + (r.montant_remis_par_livreur || 0), 0);
  
  // Decouplage: On calcule les frais de livraison encaissés avec fallback
  const succesCommandes = data.commandes.filter(c => {
    const s = c.statut_commande?.toLowerCase();
    return s === 'terminee' || s === 'livree';
  });
  const totalFraisLivraison = succesCommandes.reduce((acc, c) => acc + getFrais(c), 0);
  const totalProduitsNet = totalEncaisseBrut - totalFraisLivraison;

  const ecartTotal = data.retours.reduce((acc, r) => acc + (r.ecart || 0), 0);

  const totalNonEncaisse = data.commandes
    .filter(c => ['retour_stock', 'annulee', 'a_rappeler', 'echouee', 'retour_livreur'].includes(c.statut_commande))
    .reduce((acc, c) => acc + (c.montant_total || 0), 0);

  const successRate = data.commandes.length > 0 
    ? (succesCommandes.length / data.commandes.length) * 100 
    : 0;

  // --- ANALYSIS ENGINE ---
  const generateInsights = () => {
    const insights: any[] = [];
    
    if (successRate < 70) {
      insights.push({
        type: 'danger',
        icon: <TrendingDown size={20} />,
        title: "Efficacité Critique",
        text: `Seulement ${successRate.toFixed(1)}% des livraisons ont abouti aujourd'hui. Un taux de retour élevé impacte directement vos coûts logistiques.`
      });
    } else {
      insights.push({
        type: 'success',
        icon: <TrendingUp size={20} />,
        title: "Excellente Performance",
        text: `Avec ${successRate.toFixed(1)}% de succès, vos flux sont optimisés. Continuez sur cette lancée !`
      });
    }

    if (totalNonEncaisse > totalEncaisseBrut * 0.3) {
      insights.push({
        type: 'warning',
        icon: <AlertTriangle size={20} />,
        title: "Perte de Revenus Potentielle",
        text: `Le montant non-encaissé (${totalNonEncaisse.toLocaleString()} CFA) représente plus de 30% du flux. Vérifiez les motifs de retour clients.`
      });
    }

    return insights;
  };

  const generateOrientations = () => {
    const orientations: any[] = [];
    
    if (data.commandes.filter(c => c.statut_commande === 'a_rappeler').length > 5) {
      orientations.push({
        icon: <Compass size={20} />,
        title: "Orientation Call Center",
        text: "Augmentation des reports de livraison. Suggestion : Prévoyez un appel de courtoisie 2h avant le passage du livreur pour confirmer la présence."
      });
    }

    if (ecartTotal !== 0) {
      orientations.push({
        icon: <Target size={20} />,
        title: "Contrôle Financier",
        text: "Un écart de caisse a été détecté. Orientation : Auditez les feuilles de route des agents concernés et validez les bordereaux physiques."
      });
    }

    if (orientations.length === 0) {
      orientations.push({
        icon: <Lightbulb size={20} />,
        title: "Optimisation de Journée",
        text: "La journée est globalement saine. Orientez vos efforts sur la fidélisation des clients ayant commandé aujourd'hui via WhatsApp."
      });
    }

    return orientations;
  };

  const handleGeneratePDF = () => {
    try {
      console.log("Generating analytical report for:", selectedDate, data);
      generateAnalyticalReportPDF(data, selectedDate);
      showToast("Rapport analytique généré !", "success");
    } catch (e) {
      console.error("PDF Generation Error:", e);
      showToast("Échec de la génération du PDF. Vérifiez la console pour plus de détails.", "error");
    }
  };

  const insights = generateInsights();
  const orientations = generateOrientations();

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>Rapport Financier Journalier</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>Analyse & Orientation Stratégique - GomboSwift</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <Calendar size={18} style={{ color: 'var(--primary)' }} />
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ border: 'none', fontWeight: 800, color: 'var(--text-main)', outline: 'none', background: 'transparent' }} 
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card glass-effect" style={{ padding: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue Produits (Net)</span>
            <TrendingUp size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#059669' }}>{totalProduitsNet.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span></div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', border: '1px solid rgba(99, 102, 255, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Frais Livraison (Cash)</span>
            <Truck size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary)' }}>{totalFraisLivraison.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span></div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: '#dc2626', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manque à gagner</span>
            <TrendingDown size={16} color="#ef4444" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#dc2626' }}>{totalNonEncaisse.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span></div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Taux de Succès</span>
            <Target size={16} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)' }}>{successRate.toFixed(1)}%</div>
          <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px', marginTop: '0.5rem', overflow: 'hidden' }}>
            <div style={{ width: `${successRate}%`, height: '100%', background: 'var(--primary)' }}></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '2.5rem' }} className="responsive-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <PieChart size={22} style={{ color: 'var(--primary)' }} /> Analyse des Flux du Jour
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {insights.map((ins, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  gap: '1.25rem', 
                  padding: '1.5rem', 
                  borderRadius: '18px', 
                  background: ins.type === 'danger' ? '#fef2f2' : ins.type === 'warning' ? '#fffbeb' : '#f0fdf4',
                  border: `1px solid ${ins.type === 'danger' ? '#fee2e2' : ins.type === 'warning' ? '#fef3c7' : '#dcfce7'}`
                }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                    background: ins.type === 'danger' ? '#ef4444' : ins.type === 'warning' ? '#f59e0b' : '#22c55e',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {ins.icon}
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem', fontWeight: 800, color: '#1e293b' }}>{ins.title}</h4>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5' }}>{ins.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Récapitulatif des Retours de Caisse</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Livreur</th>
                    <th style={{ textAlign: 'right' }}>Physique Reçu</th>
                    <th style={{ textAlign: 'right' }}>Théorique</th>
                    <th style={{ textAlign: 'right' }}>Écart</th>
                  </tr>
                </thead>
                <tbody>
                   {data.retours.length === 0 ? (
                     <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucune clôture de caisse aujourd'hui.</td></tr>
                   ) : (
                     data.retours.map(r => (
                       <tr key={r.id}>
                         <td style={{ fontWeight: 700 }}>#{r.feuille_route_id.slice(0,8).toUpperCase()}</td>
                         <td style={{ textAlign: 'right', fontWeight: 800, color: '#059669' }}>{r.montant_remis_par_livreur?.toLocaleString()}</td>
                         <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.montant_attendu?.toLocaleString()}</td>
                         <td style={{ textAlign: 'right', fontWeight: 900, color: r.ecart !== 0 ? '#ef4444' : '#10b981' }}>{r.ecart?.toLocaleString()}</td>
                       </tr>
                     ))
                   )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ position: 'sticky', top: '2rem' }}>
           <div className="card glass-effect" style={{ padding: '2.5rem', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: 'white', border: 'none', borderRadius: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '15px', background: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
                  <Compass size={24} strokeWidth={2.5} />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Gombo Orientation</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                 {orientations.map((o, i) => (
                    <div key={i} style={{ borderLeft: '3px solid var(--primary)', paddingLeft: '1.5rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                         <span style={{ color: 'var(--primary)' }}>{o.icon}</span>
                         <h5 style={{ margin: 0, fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.1em' }}>{o.title}</h5>
                       </div>
                       <p style={{ margin: 0, fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', fontWeight: 500 }}>{o.text}</p>
                    </div>
                 ))}
              </div>
              <div style={{ marginTop: '3.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '24px', textAlign: 'center' }}>
                 <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Besoin d'un audit complet ?</p>
                 <button className="btn btn-primary" style={{ width: '100%', borderRadius: '14px', height: '50px', fontWeight: 900, background: 'white', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }} onClick={handleGeneratePDF}>
                    <FileText size={20} /> GÉNÉRER PDF ANALYTIQUE
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
