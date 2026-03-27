import { useState, useEffect } from 'react';
import { getFinancialData } from '../services/commandeService';
import { getDepenses } from '../services/financialService';
import { Commande, LigneCommande, Depense } from '../types';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { 
  Download, 
  Filter, 
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Wallet
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
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [data, setData] = useState<{
    orders: (Commande & { lignes: LigneCommande[] })[];
    expenses: Depense[];
  }>({ orders: [], expenses: [] });

  const loadData = async () => {
    setLoading(true);
    try {
      const start = startOfDay(new Date(startDate)).toISOString();
      const end = endOfDay(new Date(endDate)).toISOString();
      
      const [orders, expenses] = await Promise.all([
        getFinancialData(start, end),
        getDepenses() // We'll filter expenses locally for better UX
      ]);
      
      const filteredExpenses = expenses.filter(d => {
        const dDate = new Date(d.date);
        return dDate >= new Date(start) && dDate <= new Date(end);
      });

      setData({ orders, expenses: filteredExpenses });
    } catch (error) {
      showToast("Erreur lors de la récupération des données", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  // Calculations for Private Dashboard
  const activeOrders = data.orders || [];
  const totalRevenue = activeOrders.reduce((acc, c) => acc + ((Number(c.montant_total) || 0) - (Number(c.frais_livraison) || 0)), 0);
  
  const extractionVentes = activeOrders.length * 250;
  const extractionLogistique = activeOrders.length * 500;
  const totalExtractions = extractionVentes + extractionLogistique;
  const caRestant = totalRevenue - totalExtractions;

  // Cash Flow Logic
  const transactions: Transaction[] = [
    ...data.orders.map(o => ({
      date: new Date(o.date_livraison_effective || o.date_creation),
      type: 'Entrée' as const,
      categorie: 'Vente',
      description: `Commande #${o.id.substring(0, 8).toUpperCase()} - ${o.nom_client}`,
      montant: (Number(o.montant_total) || 0) - (Number(o.frais_livraison) || 0)
    })),
    ...data.expenses.map(e => ({
      date: new Date(e.date),
      type: 'Sortie' as const,
      categorie: e.categorie,
      description: e.description || 'Dépense diverse',
      montant: -Math.abs(Number(e.montant) || 0)
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const totalInflow = transactions
    .filter(t => t.type.toLowerCase() === 'entrée' || t.type.toLowerCase() === 'entree')
    .reduce((acc, t) => acc + t.montant, 0);
  const totalOutflow = Math.abs(
    transactions
      .filter(t => t.type.toLowerCase() === 'sortie')
      .reduce((acc, t) => acc + t.montant, 0)
  );
  const currentBalance = totalInflow - totalOutflow;

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
            Trésorerie & Tableau de Bord Privé
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem' }}>
            Gestion confidentielle des flux et extractions de CA.
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '1.75rem', borderLeft: '5px solid var(--primary)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ opacity: 0.1, position: 'absolute', right: '-10px', top: '-10px' }}><BarChart3 size={100} /></div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>CA Produits (Net Livraison)</p>
          <h2 style={{ fontSize: '2.2rem', margin: '0.5rem 0', fontWeight: 800 }}>{totalRevenue.toLocaleString()} F</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700 }}>
            <ArrowUpRight size={16} /> {data.orders.length} ventes livrées
          </p>
        </div>

        <div className="card" style={{ padding: '1.75rem', borderLeft: '5px solid #ef4444' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Argent Extrait</p>
          <h2 style={{ fontSize: '2.2rem', margin: '0.5rem 0', fontWeight: 800, color: '#ef4444' }}>{totalExtractions.toLocaleString()} F</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>• Charges Internes (-250/v): <strong>{extractionVentes.toLocaleString()} F</strong></p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>• Frais Logistique (-500/v): <strong>{extractionLogistique.toLocaleString()} F</strong></p>
          </div>
        </div>

        <div className="card" style={{ padding: '1.75rem', borderLeft: '5px solid var(--success)', background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>CA Restant (GomboSwift)</p>
          <h2 style={{ fontSize: '2.2rem', margin: '0.5rem 0', fontWeight: 800, color: 'var(--success)' }}>{caRestant.toLocaleString()} F</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Après extractions automatiques
          </p>
        </div>
      </div>

      {/* Cash Flow Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700 }}>
              <Wallet size={20} color="var(--primary)" /> Flux de Trésorerie
            </h3>
            <span className="badge badge-info">{transactions.length} Opérations</span>
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
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '3rem' }}>Chargement des flux...</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '3rem' }}>Aucune opération sur cette période.</td></tr>
                ) : transactions.map((t, idx) => (
                  <tr key={idx}>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{format(t.date, 'dd/MM HH:mm')}</td>
                    <td>
                      <span className={`badge ${t.type.toLowerCase().includes('entr') ? 'badge-success' : 'badge-danger'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}>
                        {t.type === 'Entrée' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {t.type}
                      </span>
                    </td>
                    <td>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: '0.9rem' }}>{t.description}</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.categorie}</span>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', background: '#30413b', color: 'white' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', opacity: 0.8, color: 'white' }}>Solde de la période</h4>
            <h2 style={{ fontSize: '2rem', margin: '0.5rem 0', fontWeight: 800 }}>{currentBalance.toLocaleString()} F</h2>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '1rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ opacity: 0.8, fontSize: '0.9rem' }}>Total Entrées</span>
              <span style={{ fontWeight: 700 }}>+{totalInflow.toLocaleString()} F</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.8, fontSize: '0.9rem' }}>Total Sorties</span>
              <span style={{ fontWeight: 700 }}>-{totalOutflow.toLocaleString()} F</span>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ margin: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 700 }}>Notes Fiscales</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Charges Internes (Fixes)</p>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>250 F / Commande Livrée</p>
              </div>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Logistique Additionnelle</p>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>500 F / Livraison Livrée</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
