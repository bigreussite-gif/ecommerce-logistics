import { useState, useEffect } from 'react';
import { getFinancialData } from '../services/commandeService';
import { getDepenses, addDepense, deleteDepense, calculateProfitMetrics, ProfitStats } from '../services/financialService';
import { Depense } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  DollarSign, Plus, Trash2, 
  AlertCircle, ArrowUpRight, X
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';

export const NetProfit = () => {
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [metrics, setMetrics] = useState<ProfitStats | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDepense, setNewDepense] = useState({
    categorie: 'Marketing',
    montant: 0,
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orderData, depenseData] = await Promise.all([
        getFinancialData(),
        getDepenses().catch(() => [])
      ]);
      setDepenses(depenseData || []);
      setMetrics(calculateProfitMetrics(orderData, depenseData || []));
    } catch (error) {
      console.error(error);
      showToast("Veuillez valider la migration SQL étape 4.", "info");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      showToast("Erreur. La table 'depenses' est-elle créée ?", "error");
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
        <p style={{ marginTop: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Calcul des indicateurs...</p>
      </div>
    );
  }

  const chartData = [
    { name: 'Jan', revenue: 0, profit: 0 },
    { name: 'Fév', revenue: 0, profit: 0 },
    { name: 'Mar', revenue: metrics.ca_brut, profit: metrics.profit_net },
  ];

  return (
    <>
      <div style={{ animation: 'pageEnter 0.6s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <DollarSign size={36} color="var(--primary)" strokeWidth={3} />
              Profit Net & Rentabilité
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.4rem', fontWeight: 600 }}>Pilotez vos marges réelles et vos dépenses opérationnelles.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ height: '54px', padding: '0 2rem', borderRadius: '16px', fontSize: '1rem' }}>
            <Plus size={20} /> Nouvelle Dépense
          </button>
        </div>

        <div className="stats-grid" style={{ marginBottom: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div className="card glass-effect" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: 'white', border: 'none' }}>
            <p style={{ opacity: 0.8, fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profit Net (Mensuel)</p>
            <h2 style={{ fontSize: '2.8rem', fontWeight: 900, margin: '0.75rem 0' }}>{metrics.profit_net.toLocaleString()} <span style={{ fontSize: '1rem' }}>CFA</span></h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '12px', width: 'fit-content' }}>
              <ArrowUpRight size={18} color="#10b981" /> 
              <span style={{ fontWeight: 800 }}>{metrics.marge_nette_percent}% Rentabilité</span>
            </div>
          </div>

          <div className="card glass-effect">
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Marge Brute (Ventes - COGS)</p>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 900, margin: '0.75rem 0', color: 'var(--text-main)' }}>
              {(metrics.ca_brut - metrics.cogs_total).toLocaleString()} <span style={{ fontSize: '0.9rem' }}>CFA</span>
            </h2>
            <p style={{ margin: 0, color: '#10b981', fontWeight: 700, fontSize: '0.9rem' }}>Efficiency: {metrics.marge_brute_percent}%</p>
          </div>

          <div className="card glass-effect">
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Dépenses Fixes</p>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 900, margin: '0.75rem 0', color: '#f43f5e' }}>
              {metrics.depenses_fixes_total.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>CFA</span>
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 600 }}>{depenses.length} écritures passées</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '2.5rem' }} className="responsive-grid">
          <div className="card" style={{ padding: '2.5rem' }}>
            <h3 style={{ marginBottom: '2.5rem', fontWeight: 800 }}>Évolution Financière</h3>
            <div style={{ height: '350px' }}>
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
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }} />
                  <Legend iconType="circle" />
                  <Area type="monotone" name="Chiffre d'Affaires" dataKey="revenue" stroke="#6366f1" strokeWidth={4} fill="url(#colorCA)" />
                  <Area type="monotone" name="Profit Net" dataKey="profit" stroke="#10b981" strokeWidth={4} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '2rem', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontWeight: 800 }}>Derniers Flux de Sortie</h3>
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto', padding: '1.5rem' }}>
              {depenses.length === 0 ? (
                 <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                   <AlertCircle size={48} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
                   <p style={{ fontWeight: 600 }}>Aucune donnée.</p>
                 </div>
              ) : (
                depenses.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderRadius: '16px', background: '#f8fafc', marginBottom: '1rem', border: '1px solid #f1f5f9' }}>
                     <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{d.categorie}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{d.description || 'N/A'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{format(new Date(d.date), 'dd/MM/yyyy')}</div>
                     </div>
                     <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontWeight: 900, fontSize: '1.2rem', color: '#f43f5e' }}>-{d.montant.toLocaleString()}</div>
                        <button onClick={() => handleDeleteDepense(d.id)} style={{ color: '#cbd5e1', background: 'transparent', border: 'none', cursor: 'pointer' }}>
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

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
               <h2 style={{ margin: 0, fontWeight: 900 }}>Nouvelle Dépense</h2>
               <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24}/></button>
            </div>
            <form onSubmit={handleAddDepense}>
              <div className="form-group">
                <label className="form-label">Type de Charge</label>
                <select className="form-select" value={newDepense.categorie} onChange={e => setNewDepense({...newDepense, categorie: e.target.value})}>
                  <option>Marketing / ADS</option>
                  <option>Salaires & Primes</option>
                  <option>Loyer & Charges</option>
                  <option>Transport & Logistique</option>
                  <option>Software & Outils</option>
                  <option>Divers</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Montant (CFA)</label>
                <input type="number" className="form-input" required value={newDepense.montant || ''} onChange={e => setNewDepense({...newDepense, montant: Number(e.target.value)})} />
              </div>
              <div className="form-group">
                <label className="form-label">Date de Paiement</label>
                <input type="date" className="form-input" required value={newDepense.date} onChange={e => setNewDepense({...newDepense, date: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={newDepense.description} onChange={e => setNewDepense({...newDepense, description: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Valider l'écriture</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
