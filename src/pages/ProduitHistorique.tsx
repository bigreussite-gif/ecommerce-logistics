import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Calendar, TrendingUp, TrendingDown, Download, AlertCircle } from 'lucide-react';
import { getProduits, getHistoriqueStock } from '../services/produitService';
import { Produit, MouvementStock } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const ProduitHistorique = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [produit, setProduit] = useState<Produit | null>(null);
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allProds = await getProduits();
      const prod = allProds.find(p => p.id === id);
      if (prod) {
        setProduit(prod);
        const movs = await getHistoriqueStock(id as string);
        setMouvements(movs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalEntrees: mouvements.filter(m => m.type_mouvement === 'entree').reduce((acc, m) => acc + m.quantite, 0),
    totalSorties: mouvements.filter(m => m.type_mouvement === 'sortie').reduce((acc, m) => acc + m.quantite, 0),
    mouvementsCount: mouvements.length
  };

  const exportToCSV = () => {
    if (!produit) return;
    const headers = ['Date', 'Heure', 'Type', 'Quantite', 'Reference', 'Commentaire'];
    const rows = mouvements.map(m => {
      const d = new Date(m.date);
      return [
        format(d, 'dd/MM/yyyy'),
        format(d, 'HH:mm'),
        m.type_mouvement.toUpperCase(),
        m.quantite,
        `"${m.reference || ''}"`,
        `"${m.commentaire || ''}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historique_${produit.nom.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', background: '#f8fafc' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Chargement de l'historique...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!produit) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
        <h2>Produit introuvable</h2>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/produits')}>Retour au catalogue</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', background: '#f8fafc', minHeight: '100vh', animation: 'pageEnter 0.4s ease' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* EN-TÊTE */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <button
              onClick={() => navigate('/produits')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 700, marginBottom: '1rem', padding: 0 }}
            >
              <ArrowLeft size={18} /> Retour au catalogue
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', background: 'linear-gradient(135deg, var(--primary), #4f46e5)', borderRadius: '16px', color: 'white', boxShadow: '0 8px 16px rgba(99, 102, 255, 0.2)' }}>
                <Package size={28} />
              </div>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: '#1e293b', letterSpacing: '-0.02em' }}>
                  Historique: {produit.nom}
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>
                  SKU: {produit.sku || produit.id.substring(0,8).toUpperCase()} • Actuellement en stock : <strong style={{ color: produit.stock_actuel <= (produit.stock_minimum || 5) ? '#ef4444' : '#10b981' }}>{produit.stock_actuel}</strong>
                </p>
              </div>
            </div>
          </div>
          
          <button
            onClick={exportToCSV}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '12px', fontWeight: 700, background: 'white' }}
          >
            <Download size={18} /> Exporter CSV
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '16px', color: '#10b981' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b' }}>{stats.totalEntrees}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Entrées</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '16px', color: '#ef4444' }}>
              <TrendingDown size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b' }}>{stats.totalSorties}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Sorties</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '16px', color: '#64748b' }}>
              <Calendar size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b' }}>{stats.mouvementsCount}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Opérations</div>
            </div>
          </div>
        </div>

        {/* TABLEAU DES MOUVEMENTS */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date & Heure</th>
                  <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quantité</th>
                  <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Référence / Commande</th>
                  <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {mouvements.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                      Aucun mouvement de stock enregistré pour ce produit.
                    </td>
                  </tr>
                ) : (
                  mouvements.map((mov, index) => {
                    const isEntree = mov.type_mouvement === 'entree';
                    return (
                      <tr key={mov.id || index} style={{ borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                        <td style={{ padding: '1.25rem' }}>
                          <div style={{ fontWeight: 800, color: '#1e293b' }}>{format(new Date(mov.date), 'dd MMM yyyy', { locale: fr })}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{format(new Date(mov.date), 'HH:mm')}</div>
                        </td>
                        <td style={{ padding: '1.25rem' }}>
                          <span style={{
                            padding: '0.4rem 0.8rem',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            background: isEntree ? '#ecfdf5' : '#fef2f2',
                            color: isEntree ? '#10b981' : '#ef4444',
                            border: `1px solid ${isEntree ? '#a7f3d0' : '#fecaca'}`
                          }}>
                            {mov.type_mouvement}
                          </span>
                        </td>
                        <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                          <span style={{ fontWeight: 900, fontSize: '1.1rem', color: isEntree ? '#10b981' : '#ef4444' }}>
                            {isEntree ? '+' : '-'}{mov.quantite}
                          </span>
                        </td>
                        <td style={{ padding: '1.25rem', fontWeight: 600, color: '#334155' }}>
                          {mov.reference || '-'}
                        </td>
                        <td style={{ padding: '1.25rem', fontSize: '0.9rem', color: '#64748b' }}>
                          {mov.commentaire || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      <style>{`
        @keyframes pageEnter { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};
