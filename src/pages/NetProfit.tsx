import { useState, useEffect } from 'react';
import { getFinancialData } from '../services/commandeService';
import { getDepenses, addDepense, deleteDepense, calculateProfitMetrics, ProfitStats } from '../services/financialService';
import { Depense } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  DollarSign, Plus, Trash2, 
  AlertCircle, ArrowUpRight
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const NetProfit = () => {
  const { showToast } = useToast();
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
        getDepenses()
      ]);
      setDepenses(depenseData);
      setMetrics(calculateProfitMetrics(orderData, depenseData));
    } catch (error) {
      console.error(error);
      showToast("Erreur de chargement financier.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddDepense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDepense(newDepense);
      showToast("Dépense enregistrée !", "success");
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      showToast("Erreur lors de l'ajout.", "error");
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
        <p style={{ marginTop: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Calcul du Profit Net en temps réel...</p>
      </div>
    );
  }

  // Chart data: Monthly aggregation (simplified for current data)
  const chartData = [
    { name: 'Jan', revenue: 0, profit: 0 },
    { name: 'Fév', revenue: 0, profit: 0 },
    { name: 'Mar', revenue: metrics.ca_brut, profit: metrics.profit_net },
  ];

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <DollarSign size={36} color="var(--primary)" strokeWidth={2.5} />
            Profit Net & Rentabilité
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>Suivi exhaustif de vos marges après COGS et dépenses opérationnelles.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ padding: '0.8rem 1.5rem', borderRadius: '14px', fontWeight: 700 }}>
          <Plus size={20} /> Nouvelle Dépense
        </button>
      </div>

      {/* Financial Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="card glass-effect" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: 'white', border: 'none' }}>
          <p style={{ opacity: 0.9, fontSize: '0.9rem', fontWeight: 600 }}>Profit Net (Mars)</p>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: '0.5rem 0' }}>{metrics.profit_net.toLocaleString()} CFA</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}>
            <ArrowUpRight size={16} /> Marge Nette : {metrics.marge_nette_percent}%
          </div>
        </div>

        <div className="card glass-effect">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Marge Brute (Ventes - COGS)</p>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: '0.5rem 0', color: 'var(--text-main)' }}>
            {(metrics.ca_brut - metrics.cogs_total).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span>
          </h2>
          <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>
             Marge sur coût d'achat : {metrics.marge_brute_percent}%
          </div>
        </div>

        <div className="card glass-effect">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Total Dépenses Fixes</p>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: '0.5rem 0', color: '#f43f5e' }}>
            {metrics.depenses_fixes_total.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span>
          </h2>
          <div style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>
            {depenses.length} écritures passées
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }} className="responsive-grid">
        {/* Main Chart */}
        <div className="card glass-effect" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '2rem', fontSize: '1.2rem', fontWeight: 800 }}>Évolution CA vs Profit</h3>
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-premium)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" name="Chiffre d'Affaires" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" name="Profit Net" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProf)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses List */}
        <div className="card glass-effect" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Dernières Dépenses</h3>
          </div>
          <div style={{ maxHeight: '450px', overflowY: 'auto', padding: '1rem' }}>
            {depenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <AlertCircle size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>Aucune dépense enregistrée.</p>
              </div>
            ) : (
              depenses.map((d: Depense) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderRadius: '14px', background: '#f8fafc', marginBottom: '0.75rem', border: '1px solid #f1f5f9' }}>
                   <div>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{d.categorie}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{d.description || 'Sans description'}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{format(new Date(d.date), 'dd MMMM yyyy', { locale: fr })}</div>
                   </div>
                   <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#f43f5e' }}>-{d.montant.toLocaleString()}</div>
                      <button onClick={() => handleDeleteDepense(d.id)} style={{ color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                        <Trash2 size={16} />
                      </button>
                   </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Add Expense */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content card glass-effect" style={{ maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 800 }}>Ajouter une Dépense</h2>
            <form onSubmit={handleAddDepense}>
              <div className="form-group">
                <label className="form-label">Catégorie</label>
                <select 
                  className="form-select" 
                  value={newDepense.categorie} 
                  onChange={e => setNewDepense({...newDepense, categorie: e.target.value})}
                >
                  <option>Marketing</option>
                  <option>Salaire</option>
                  <option>Loyer</option>
                  <option>Logistique</option>
                  <option>Abonnement Software</option>
                  <option>Autre</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Montant (CFA)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  required 
                  value={newDepense.montant}
                  onChange={e => setNewDepense({...newDepense, montant: Number(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  required 
                  value={newDepense.date}
                  onChange={e => setNewDepense({...newDepense, date: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optionnel)</label>
                <textarea 
                  className="form-input" 
                  rows={3} 
                  value={newDepense.description}
                  onChange={e => setNewDepense({...newDepense, description: e.target.value})}
                ></textarea>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
