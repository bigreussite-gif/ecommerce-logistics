import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAchatsStock } from '../services/achatService';
import { getFournisseurs } from '../services/fournisseurService';
import { Fournisseur } from '../services/fournisseurService';
import {
  ArrowLeft, Building2, Package, Calendar, Hash,
  ShoppingCart, TrendingUp, CreditCard, Banknote,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const FournisseurAchats = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [achats, setAchats] = useState<any[]>([]);
  const [fournisseur, setFournisseur] = useState<Fournisseur | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [allAchats, allFournisseurs] = await Promise.all([
          getAchatsStock(),
          getFournisseurs()
        ]);
        const f = allFournisseurs.find(f => f.id === id) || null;
        const fAchats = allAchats.filter(a => a.fournisseur_id === id);
        setFournisseur(f);
        setAchats(fAchats);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const filtered = achats.filter(a => {
    const nomProduit = a.produits?.nom || '';
    return nomProduit.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalCA = achats.reduce((acc, a) => acc + Number(a.montant_total || 0), 0);
  const totalQte = achats.reduce((acc, a) => acc + Number(a.quantite || 0), 0);
  const totalCash = achats.filter(a => a.statut_paiement === 'Payé').reduce((acc, a) => acc + Number(a.montant_total || 0), 0);
  const totalCredit = achats.filter(a => a.statut_paiement === 'En attente').reduce((acc, a) => acc + Number(a.montant_total || 0), 0);

  const handleExportCSV = () => {
    const headers = ['Date', 'Heure', 'Produit', 'Quantité', 'Prix Unitaire (F)', 'Montant Total (F)', 'Mode', 'Statut'];
    const rows = filtered.map(a => [
      format(new Date(a.date_achat), 'dd/MM/yyyy'),
      format(new Date(a.date_achat), 'HH:mm'),
      a.produits?.nom || '—',
      a.quantite,
      a.prix_achat_unitaire,
      a.montant_total,
      a.mode_paiement,
      a.statut_paiement
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `achats_${fournisseur?.nom || id}_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
        <div className="loading-spinner"></div>
        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Chargement de l'historique...</p>
      </div>
    );
  }

  return (
    <div style={{ animation: 'pageEnter 0.5s ease' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button
            onClick={() => navigate('/fournisseurs')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(99,102,255,0.08)', border: '1px solid rgba(99,102,255,0.2)',
              color: 'var(--primary)', borderRadius: '14px',
              padding: '0.65rem 1.25rem', cursor: 'pointer',
              fontWeight: 800, fontSize: '0.9rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,255,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,255,0.08)')}
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
            Retour Fournisseurs
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'linear-gradient(135deg, var(--primary), #4f46e5)', color: 'white', padding: '0.75rem', borderRadius: '14px' }}>
                <Building2 size={22} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  {fournisseur?.nom || 'Fournisseur'}
                </h1>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Historique complet des achats · {achats.length} transaction{achats.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: '#10b981', color: 'white', border: 'none',
            borderRadius: '14px', padding: '0.75rem 1.5rem',
            cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem',
            boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
          }}
        >
          <Download size={18} strokeWidth={2.5} />
          Exporter CSV
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Transactions', value: achats.length, icon: <Hash size={20} />, color: '#6366f1', bg: 'rgba(99,102,255,0.08)' },
          { label: 'Quantité Totale', value: `${totalQte.toLocaleString()} u.`, icon: <Package size={20} />, color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)' },
          { label: 'Volume Total', value: `${totalCA.toLocaleString()} F`, icon: <TrendingUp size={20} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
          { label: 'Cash Payé', value: `${totalCash.toLocaleString()} F`, icon: <Banknote size={20} />, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
          { label: 'En Crédit', value: `${totalCredit.toLocaleString()} F`, icon: <CreditCard size={20} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
        ].map((kpi, i) => (
          <div key={i} className="card glass-effect" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', background: kpi.bg, borderRadius: '12px', color: kpi.color, flexShrink: 0 }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: kpi.color, whiteSpace: 'nowrap' }}>{kpi.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card glass-effect" style={{ padding: '1rem', marginBottom: '1.5rem', borderRadius: '18px' }}>
        <input
          type="text"
          placeholder="Filtrer par produit..."
          className="form-input"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ height: '3rem', borderRadius: '12px', paddingLeft: '1.25rem' }}
        />
      </div>

      {/* Table */}
      <div className="card glass-effect" style={{ padding: 0, overflow: 'hidden', borderRadius: '22px' }}>
        <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={18} color="var(--primary)" />
            Détail de tous les achats
          </h3>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', background: '#f1f5f9', padding: '0.25rem 0.75rem', borderRadius: '20px' }}>
            {filtered.length} ligne{filtered.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="table-container" style={{ margin: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={14} /> Date & Heure
                </th>
                <th>Produit</th>
                <th style={{ textAlign: 'center' }}>Quantité</th>
                <th style={{ textAlign: 'right' }}>Prix Unitaire</th>
                <th style={{ textAlign: 'right' }}>Montant Total</th>
                <th style={{ textAlign: 'center' }}>Mode</th>
                <th style={{ textAlign: 'center' }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Aucun achat trouvé.
                  </td>
                </tr>
              ) : filtered.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {format(new Date(a.date_achat), 'dd MMM yyyy', { locale: fr })}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {format(new Date(a.date_achat), 'HH:mm')}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {a.produits?.nom || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      #{a.id?.substring(0, 8)}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      background: 'rgba(99,102,255,0.08)', color: 'var(--primary)',
                      fontWeight: 800, padding: '0.25rem 0.7rem', borderRadius: '8px'
                    }}>
                      {Number(a.quantite).toLocaleString()} u.
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    {Number(a.prix_achat_unitaire).toLocaleString()} F
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '1rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    {Number(a.montant_total).toLocaleString()} F
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                      background: a.mode_paiement === 'Cash' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                      color: a.mode_paiement === 'Cash' ? '#10b981' : '#f59e0b'
                    }}>
                      {a.mode_paiement}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                      background: a.statut_paiement === 'Payé' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: a.statut_paiement === 'Payé' ? '#10b981' : '#ef4444'
                    }}>
                      {a.statut_paiement}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer total */}
        {filtered.length > 0 && (
          <div style={{
            padding: '1rem 1.75rem', borderTop: '2px solid #f1f5f9',
            background: 'linear-gradient(to right, #fafafa, white)',
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '2rem'
          }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Total sélection
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--primary)' }}>
                {filtered.reduce((acc, a) => acc + Number(a.montant_total || 0), 0).toLocaleString()} F
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
