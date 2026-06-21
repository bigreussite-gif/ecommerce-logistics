import { useState, useEffect } from 'react';
import { getFinancialData } from '../services/commandeService';
import { getDepenses } from '../services/financialService';
import { getProduits } from '../services/produitService';
import { analyzeBusinessHealth, BusinessHealth } from '../services/businessIntelligenceService';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle, Info, Lightbulb, Target, Calendar as CalendarIcon, ArrowRight, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { Link } from 'react-router-dom';

export const BusinessIntelligence = () => {
  const { hasPermission } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<BusinessHealth | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);

  const [period, setPeriod] = useState<'month' | '30days' | 'custom'>('month');
  const [customRange, setCustomRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchData = async () => {
    setLoading(true);
    let start, end;
    if (period === 'month') {
      start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      end = format(endOfMonth(new Date()), 'yyyy-MM-dd');
    } else if (period === '30days') {
      start = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      end = format(new Date(), 'yyyy-MM-dd');
    } else {
      start = customRange.start;
      end = customRange.end;
    }

    try {
      const [orderData, depenseData, productData] = await Promise.all([
        getFinancialData(start, end),
        getDepenses().catch(() => []),
        getProduits().catch(() => [])
      ]);
      
      const filteredExpenses = (depenseData || []).filter(d => {
        const dDate = new Date(d.date);
        const rangeStart = new Date(start);
        rangeStart.setHours(0,0,0,0);
        const rangeEnd = new Date(end);
        rangeEnd.setHours(23,59,59,999);
        return dDate >= rangeStart && dDate <= rangeEnd;
      });

      const analysis = analyzeBusinessHealth(orderData || [], filteredExpenses, productData || []);
      setHealthData(analysis);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, customRange]);

  if (!hasPermission('ADMIN')) {
    return <Navigate to="/" replace />;
  }

  if (loading || !healthData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Analyse de la santé de l'entreprise en cours...</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Excellent': return '#10b981';
      case 'Stable': return '#3b82f6';
      case 'Fragile': return '#f59e0b';
      case 'Critique': return '#ef4444';
      default: return '#64748b';
    }
  };

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Activity size={36} color="var(--primary)" strokeWidth={3} />
            Lecture du Business
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.4rem', fontWeight: 600 }}>Diagnostic IA et état de santé réel de votre entreprise.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', background: 'white', padding: '0.4rem', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <button 
              onClick={() => setPeriod('month')}
              style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', border: 'none', background: period === 'month' ? 'var(--primary)' : 'transparent', color: period === 'month' ? 'white' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
            >Ce Mois</button>
            <button 
              onClick={() => setPeriod('30days')}
              style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', border: 'none', background: period === '30days' ? 'var(--primary)' : 'transparent', color: period === '30days' ? 'white' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
            >30 Jours</button>
            <button 
              onClick={() => setPeriod('custom')}
              style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', border: 'none', background: period === 'custom' ? 'var(--primary)' : 'transparent', color: period === 'custom' ? 'white' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
            >Custom</button>
          </div>
        </div>
      </div>

      {period === 'custom' && (
         <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', background: 'white', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0', width: 'fit-content', animation: 'slideDown 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <CalendarIcon size={18} color="var(--primary)" />
              <input type="date" className="filter-input" value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} />
              <span style={{ fontWeight: 800, color: 'var(--text-muted)' }}>→</span>
              <input type="date" className="filter-input" value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} />
            </div>
         </div>
      )}

      <div className="stats-grid" style={{ marginBottom: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Health Score Card */}
        <div className="card glass-effect" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: 'white', border: 'none', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <p style={{ opacity: 0.8, fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Score de Santé Global</p>
          <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '1rem 0' }}>
             <svg width="120" height="120" viewBox="0 0 120 120">
               <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
               <circle cx="60" cy="60" r="54" fill="none" stroke={getStatusColor(healthData.status)} strokeWidth="12" strokeDasharray="339" strokeDashoffset={339 - (339 * healthData.score) / 100} strokeLinecap="round" transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
             </svg>
             <h2 style={{ position: 'absolute', fontSize: '2.5rem', fontWeight: 900, margin: 0 }}>{healthData.score}</h2>
          </div>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', padding: '0.4rem 1.2rem', borderRadius: '20px', fontWeight: 800, color: getStatusColor(healthData.status) }}>
            Statut : {healthData.status}
          </div>
        </div>

        {/* Quick KPI: Margin */}
        <div className="card glass-effect" style={{ padding: '2rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 1rem 0' }}>Marge Nette (Rentabilité)</p>
          <h2 style={{ fontSize: '2.8rem', fontWeight: 900, margin: '0 0 1rem 0', color: healthData.financials.marge_nette_percent >= 20 ? '#10b981' : (healthData.financials.marge_nette_percent > 10 ? '#f59e0b' : '#ef4444') }}>
            {healthData.financials.marge_nette_percent}%
          </h2>
          <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
             <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, healthData.financials.marge_nette_percent))}%`, background: healthData.financials.marge_nette_percent >= 20 ? '#10b981' : '#f59e0b' }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>Cible saine : &gt; 20%</p>
            <Link to="/net-profit" className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              Détails financiers <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Quick KPI: Logistics */}
        <div className="card glass-effect" style={{ padding: '2rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 1rem 0' }}>Efficacité Logistique</p>
          <h2 style={{ fontSize: '2.8rem', fontWeight: 900, margin: '0 0 1rem 0', color: healthData.logistics.taux_succes >= 80 ? '#10b981' : '#ef4444' }}>
            {healthData.logistics.taux_succes}%
          </h2>
          <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
             <div style={{ height: '100%', width: `${healthData.logistics.taux_succes}%`, background: healthData.logistics.taux_succes >= 80 ? '#10b981' : '#ef4444' }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>Cible : &gt; 80% (Livraisons)</p>
            <Link to="/logistique" className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              Suivi logistique <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2.5rem' }} className="responsive-grid">
        {/* Alerts & Trous section */}
        <div className="card" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <Target size={28} color="#ef4444" />
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.4rem' }}>Trous & Alertes</h3>
          </div>
          
          {healthData.alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '20px' }}>
               <CheckCircle size={48} color="#10b981" style={{ marginBottom: '1rem' }} />
               <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 800 }}>Aucune alerte critique</h4>
               <p style={{ color: 'var(--text-muted)', margin: 0 }}>Votre activité ne présente pas de trous majeurs actuellement.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {healthData.alerts.map((alert, idx) => {
                const isDanger = alert.type === 'danger';
                const isWarning = alert.type === 'warning';
                
                const bg = isDanger ? '#fef2f2' : (isWarning ? '#fffbeb' : '#f0fdf4');
                const border = isDanger ? '#fecaca' : (isWarning ? '#fde68a' : '#bbf7d0');
                const iconColor = isDanger ? '#ef4444' : (isWarning ? '#f59e0b' : '#10b981');
                
                return (
                  <div key={idx} style={{ background: bg, border: `1px solid ${border}`, padding: '1.5rem', borderRadius: '16px', display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                    <div style={{ marginTop: '0.2rem' }}>
                      {isDanger ? <AlertTriangle size={24} color={iconColor} /> : (isWarning ? <Info size={24} color={iconColor} /> : <CheckCircle size={24} color={iconColor} />)}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, color: '#0f172a', fontSize: '1.1rem' }}>{alert.title}</h4>
                      <p style={{ margin: '0 0 0.75rem 0', color: '#334155', lineHeight: 1.5 }}>{alert.message}</p>
                      {alert.action && (
                        <button onClick={() => setSelectedAlert(alert)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, color: iconColor, border: `1px solid ${border}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                          <Lightbulb size={16} /> Voir l'orientation détaillée
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Worst Products Section */}
          {healthData.worstProducts && healthData.worstProducts.length > 0 && (
            <div style={{ marginTop: '2rem', borderTop: '2px dashed #e2e8f0', paddingTop: '2rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontWeight: 800, fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} color="#ef4444" /> Articles tuant la rentabilité
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {healthData.worstProducts.map((product, idx) => (
                  <div key={idx} style={{ background: '#fff1f2', border: '1px solid #fecaca', padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <span style={{ fontWeight: 800, color: '#9f1239', fontSize: '1.1rem' }}>{product.nom}</span>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#be123c', fontWeight: 600 }}>
                        {product.total_commandes} expéditions • {product.taux_succes_percent}% livrées
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', fontWeight: 900, color: '#e11d48', fontSize: '1.2rem' }}>ROI : {product.roi_percent}%</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f43f5e', textTransform: 'uppercase' }}>À surveiller de près</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Advice & Recommendations */}
        <div className="card" style={{ padding: '2.5rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <Lightbulb size={28} color="#f59e0b" />
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.4rem' }}>Orientations & Conseils</h3>
          </div>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {healthData.advice.map((adv, idx) => (
              <li key={idx} style={{ background: 'white', padding: '1.25rem', borderRadius: '14px', display: 'flex', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 900, fontSize: '1.2rem' }}>{idx + 1}.</span>
                <span style={{ color: 'var(--text-main)', fontWeight: 600, lineHeight: 1.5 }}>{adv}</span>
              </li>
            ))}
            {healthData.advice.length === 0 && (
              <li style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontStyle: 'italic' }}>
                Continuez sur cette lancée, pas de conseil urgent pour le moment.
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Modal Popup for Alerts */}
      {selectedAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s' }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', maxWidth: '500px', width: '100%', position: 'relative', animation: 'slideUp 0.3s' }}>
            <button onClick={() => setSelectedAlert(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <X size={24} color="var(--text-muted)" />
            </button>
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: selectedAlert.type === 'danger' ? '#ef4444' : (selectedAlert.type === 'warning' ? '#f59e0b' : '#10b981') }}>
              {selectedAlert.type === 'danger' ? <AlertTriangle size={24}/> : <Info size={24} />}
              {selectedAlert.title}
            </h3>
            <p style={{ lineHeight: 1.6, color: '#334155', fontSize: '1.1rem' }}>{selectedAlert.message}</p>
            {selectedAlert.action && (
              <div style={{ marginTop: '1.5rem', padding: '1.2rem', background: '#f8fafc', borderRadius: '12px', borderLeft: '4px solid var(--primary)', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: 'var(--primary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎯 Orientation Stratégique :</strong><br/>
                <span style={{ display: 'inline-block', marginTop: '0.5rem', fontWeight: 600, color: '#0f172a' }}>{selectedAlert.action}</span>
              </div>
            )}
            <div style={{ marginTop: '2rem', textAlign: 'right' }}>
              <button onClick={() => setSelectedAlert(null)} className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', borderRadius: '10px' }}>Compris</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
