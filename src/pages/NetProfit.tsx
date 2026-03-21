import { useState, useEffect, useMemo } from 'react';
import { getFinancialData } from '../services/commandeService';
import { getDepenses, addDepense, deleteDepense, calculateProfitMetrics, generateTimeSeriesData, ProfitStats } from '../services/financialService';
import { Depense } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  DollarSign, Plus, Trash2, 
  AlertCircle, ArrowUpRight, X, Calendar as CalendarIcon, Filter
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

export const NetProfit = () => {
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [metrics, setMetrics] = useState<ProfitStats | null>(null);
  const [allCommandes, setAllCommandes] = useState<any[]>([]);
  
  const [period, setPeriod] = useState<'month' | '30days' | 'custom'>('month');
  const [customRange, setCustomRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDepense, setNewDepense] = useState({
    categorie: 'Marketing',
    montant: 0,
    description: '',
    date: new Date().toISOString().split('T')[0]
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
      const [orderData, depenseData] = await Promise.all([
        getFinancialData(start, end),
        getDepenses().catch(() => [])
      ]);
      setAllCommandes(orderData || []);
      setDepenses(depenseData || []);
      setMetrics(calculateProfitMetrics(orderData, depenseData || []));
    } catch (error) {
      console.error(error);
      showToast("Erreur lors du chargement des données financières.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, customRange]);

  const chartData = useMemo(() => {
    return generateTimeSeriesData(allCommandes, 'daily');
  }, [allCommandes]);

  // Security: Only Admin can see this
  if (!hasPermission('ADMIN')) {
    return <Navigate to="/" replace />;
  }

  const handleAddDepense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newDepense.montant <= 0) return showToast("Montant invalide", "error");
    try {
      await addDepense(newDepense);
      showToast("Dépense enregistrée !", "success");
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      showToast("Erreur lors de l'enregistrement", "error");
    }
  };

  const handleDeleteDepense = async (id: string) => {
    if (!window.confirm("Supprimer cette dépense ?")) return;
    try {
      await deleteDepense(id);
      showToast("Dépense supprimée.", "success");
      fetchData();
    } catch (error) {
      showToast("Erreur suppression.", "error");
    }
  };

  if (loading || !metrics) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Analyse des flux financiers...</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ animation: 'pageEnter 0.6s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <DollarSign size={36} color="var(--primary)" strokeWidth={3} />
              Profit & Rentabilité
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.4rem', fontWeight: 600 }}>Analyse précise des marges et charges d'exploitation.</p>
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
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ height: '54px', padding: '0 2rem', borderRadius: '16px', fontSize: '1rem', fontWeight: 800 }}>
              <Plus size={20} /> Nouvelle Charge
            </button>
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
          <div className="card glass-effect" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: 'white', border: 'none', padding: '2rem' }}>
            <p style={{ opacity: 0.8, fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Profit Net Réel</p>
            <h2 style={{ fontSize: '3rem', fontWeight: 950, margin: '1rem 0', letterSpacing: '-0.02em' }}>{metrics.profit_net.toLocaleString()} <span style={{ fontSize: '1.2rem', opacity: 0.6 }}>CFA</span></h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(255,255,255,0.12)', padding: '0.6rem 1.2rem', borderRadius: '14px', width: 'fit-content', backdropFilter: 'blur(5px)' }}>
              <ArrowUpRight size={20} color="#34d399" /> 
              <span style={{ fontWeight: 800, color: '#34d399' }}>{metrics.marge_nette_percent}% Net</span>
            </div>
          </div>

          <div className="card glass-effect" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Marge sur Ventes (Articles)</p>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <Filter size={18} />
              </div>
            </div>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: '0.5rem 0', color: 'var(--text-main)' }}>
              {(metrics.ca_brut - metrics.frais_livraison_total - metrics.cogs_total).toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>CFA</span>
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ height: '6px', width: '60px', borderRadius: '3px', background: '#f1f5f9' }}>
                <div style={{ width: `${metrics.marge_brute_percent}%`, height: '100%', background: '#10b981', borderRadius: '3px' }}></div>
              </div>
              <p style={{ margin: 0, color: '#10b981', fontWeight: 800, fontSize: '0.95rem' }}>{metrics.marge_brute_percent}% Brute</p>
            </div>
          </div>

          <div className="card glass-effect" style={{ padding: '2rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Charges Opérationnelles</p>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
                <DollarSign size={18} />
              </div>
            </div>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: '0.5rem 0', color: '#f43f5e' }}>
              {metrics.depenses_fixes_total.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>CFA</span>
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 700 }}>{depenses.length} écritures comptables</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '2.5rem' }} className="responsive-grid">
          <div className="card" style={{ padding: '2.5rem' }}>
            <h3 style={{ marginBottom: '2.5rem', fontWeight: 900, fontSize: '1.4rem' }}>Évolution CA Produits vs Profit Articles</h3>
            <div style={{ height: '380px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#94a3b8', fontWeight: 700 }} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '1rem' }}
                    itemStyle={{ fontWeight: 700 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '2rem', fontWeight: 700 }} />
                  <Area type="monotone" name="Chiffre d'Affaires Net" dataKey="revenue" stroke="#6366f1" strokeWidth={5} fill="url(#colorCA)" />
                  <Area type="monotone" name="Marge Articles" dataKey="profit" stroke="#10b981" strokeWidth={5} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem' }}>Charges de la Période</h3>
              <span style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: 700, color: 'var(--text-muted)' }}>{depenses.length} écritures</span>
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto', padding: '1.5rem' }}>
              {depenses.length === 0 ? (
                 <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                   <AlertCircle size={48} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
                   <p style={{ fontWeight: 700 }}>Aucune charge sur cette période.</p>
                 </div>
              ) : (
                depenses.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderRadius: '18px', background: '#f8fafc', marginBottom: '1rem', border: '1px solid #f1f5f9', transition: 'transform 0.2s', cursor: 'default' }}>
                     <div>
                        <div style={{ fontWeight: 850, color: 'var(--text-main)', fontSize: '1rem' }}>{d.categorie}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.1rem' }}>{d.description || 'Sans description'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.4rem', fontWeight: 700 }}>{format(new Date(d.date), 'dd MMM yyyy', { locale: fr })}</div>
                     </div>
                     <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{ fontWeight: 950, fontSize: '1.3rem', color: '#f43f5e' }}>-{d.montant.toLocaleString()}</div>
                        <button onClick={() => handleDeleteDepense(d.id)} style={{ color: '#cbd5e1', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', transition: 'all 0.2s' }} className="hover-red">
                          <Trash2 size={18} />
                        </button>
                     </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px', borderRadius: '32px', padding: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
               <div>
                 <h2 style={{ margin: 0, fontWeight: 950, fontSize: '1.8rem', letterSpacing: '-0.03em' }}>Nouvelle Dépense</h2>
                 <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Enregistrement d'une charge d'exploitation</p>
               </div>
               <button onClick={() => setIsModalOpen(false)} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20}/></button>
            </div>
            <form onSubmit={handleAddDepense}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '0.6rem', display: 'block' }}>Type de Charge</label>
                <select className="form-select" style={{ height: '54px', borderRadius: '14px', fontWeight: 600 }} value={newDepense.categorie} onChange={e => setNewDepense({...newDepense, categorie: e.target.value})}>
                  <option>Marketing / ADS</option>
                  <option>Salaires & Primes</option>
                  <option>Loyer & Charges</option>
                  <option>Transport & Logistique</option>
                  <option>Software & Outils</option>
                  <option>Divers</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '0.6rem', display: 'block' }}>Montant (CFA)</label>
                <input type="number" className="form-input" style={{ height: '54px', borderRadius: '14px', fontWeight: 800, fontSize: '1.2rem', color: '#f43f5e' }} required value={newDepense.montant || ''} onChange={e => setNewDepense({...newDepense, montant: Number(e.target.value)})} placeholder="0" />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '0.6rem', display: 'block' }}>Date de Paiement</label>
                <input type="date" className="form-input" style={{ height: '54px', borderRadius: '14px', fontWeight: 600 }} required value={newDepense.date} onChange={e => setNewDepense({...newDepense, date: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '0.6rem', display: 'block' }}>Notes & Justification</label>
                <textarea className="form-input" style={{ borderRadius: '14px', padding: '1rem', fontWeight: 500 }} rows={2} value={newDepense.description} onChange={e => setNewDepense({...newDepense, description: e.target.value})} placeholder="Ex: Campagne Facebook Mars 2024" />
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '3rem' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1, height: '54px', borderRadius: '16px', fontWeight: 800 }} onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, height: '54px', borderRadius: '16px', fontWeight: 800 }}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
