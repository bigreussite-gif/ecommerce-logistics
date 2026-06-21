import { useState, useEffect } from 'react';
import { getFinancialData } from '../services/commandeService';
import { getDepenses } from '../services/financialService';
import { getProduits } from '../services/produitService';
import { analyzeBusinessHealth, BusinessHealth } from '../services/businessIntelligenceService';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle, Info, Lightbulb, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export const BusinessIntelligence = () => {
  const { hasPermission } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<BusinessHealth | null>(null);

  const fetchData = async () => {
    setLoading(true);
    // Focus on current month for active monitoring
    const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');

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
  }, []);

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
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity size={36} color="var(--primary)" strokeWidth={3} />
          Lecture du Business
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.4rem', fontWeight: 600 }}>Diagnostic IA et état de santé réel de votre entreprise (Mois en cours).</p>
      </div>

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
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 600 }}>Cible saine : &gt; 20%</p>
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
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 600 }}>Cible saine : &gt; 80% (Livraisons réussies)</p>
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
                const isSuccess = alert.type === 'success';
                
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
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, color: iconColor, border: `1px solid ${border}` }}>
                          <Lightbulb size={16} /> Action requise : {alert.action}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
    </div>
  );
};
