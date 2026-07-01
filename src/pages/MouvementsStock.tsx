import { useState, useEffect, useMemo } from 'react';
import { Package, Search, Download, ArrowRight, ArrowLeft, Filter, Calendar } from 'lucide-react';
import { getAllMouvementsStock } from '../services/produitService';
import { MouvementStock } from '../types';

type ExtendedMouvement = MouvementStock & { produits?: { nom: string } };

export const MouvementsStock = () => {
  const [mouvements, setMouvements] = useState<ExtendedMouvement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

  useEffect(() => {
    const fetchMouvements = async () => {
      try {
        const data = await getAllMouvementsStock();
        setMouvements(data);
      } catch (error) {
        console.error('Erreur lors du chargement des mouvements de stock', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMouvements();
  }, []);

  const filteredMouvements = useMemo(() => {
    return mouvements.filter((m) => {
      const matchSearch = (m.produits?.nom || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (m.reference || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter ? m.type_mouvement === typeFilter : true;
      const matchDate = dateFilter ? m.date.startsWith(dateFilter) : true;
      return matchSearch && matchType && matchDate;
    });
  }, [mouvements, searchTerm, typeFilter, dateFilter]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Produit', 'Type', 'Quantité', 'Ancien Stock', 'Nouveau Stock', 'Référence', 'Commentaire'];
    const rows = filteredMouvements.map(m => [
      new Date(m.date).toLocaleString('fr-FR'),
      m.produits?.nom || 'Inconnu',
      m.type_mouvement,
      m.quantite.toString(),
      (m.ancien_stock ?? '').toString(),
      (m.nouveau_stock ?? '').toString(),
      m.reference || '',
      m.commentaire || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(';') + '\n' 
      + rows.map(e => e.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `historique_stock_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', padding: '1rem', background: '#f8fafc' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', animation: 'pageEnter 0.6s ease' }}>
        
        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.5rem' }}>
                <div style={{ padding: '0.8rem', background: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)', borderRadius: '18px', color: 'white', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                  <Package size={28} />
                </div>
                <h1 style={{ fontSize: '2.2rem', fontWeight: 950, margin: 0, color: '#1e293b' }}>
                  Historique des Mouvements
                </h1>
              </div>
              <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
                Traçabilité complète de toutes les entrées et sorties de stock.
              </p>
            </div>
            
            <button
              onClick={handleExportCSV}
              className="btn btn-outline"
              style={{ height: '48px', borderRadius: '16px', fontWeight: 800, padding: '0 1.5rem' }}
            >
              <Download size={18} /> Exporter CSV
            </button>
          </div>
        </section>

        <section style={{ marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.25rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              
              <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Rechercher un produit, référence..."
                  style={{ width: '100%', paddingLeft: '3.5rem', height: '48px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 600 }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Filter size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    style={{ paddingLeft: '3.5rem', height: '48px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 600, minWidth: '180px', appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Tous les types</option>
                    <option value="entree">Entrées (Achats/Ajustements)</option>
                    <option value="sortie">Sorties (Ventes/Ajustements)</option>
                    <option value="retour">Retours Clients</option>
                  </select>
                </div>
                
                <div style={{ position: 'relative' }}>
                  <Calendar size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    style={{ paddingLeft: '3.5rem', height: '48px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 600, cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="card" style={{ padding: '0', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Date & Heure</th>
                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Produit</th>
                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Type</th>
                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Qté</th>
                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Stock Avant/Après</th>
                    <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Référence / Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '4rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
                        <p style={{ color: '#64748b', fontWeight: 600 }}>Chargement de l'historique...</p>
                      </td>
                    </tr>
                  ) : filteredMouvements.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '4rem', color: '#64748b', fontWeight: 600 }}>
                        Aucun mouvement trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredMouvements.map(m => {
                      const isEntree = m.type_mouvement === 'entree' || m.type_mouvement === 'retour';
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-lift-shadow">
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                            {new Date(m.date).toLocaleString('fr-FR', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 800, color: '#1e293b' }}>
                            {m.produits?.nom || 'Produit Inconnu'}
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                              padding: '0.4rem 0.8rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800,
                              background: isEntree ? '#dcfce7' : '#fee2e2',
                              color: isEntree ? '#16a34a' : '#ef4444'
                            }}>
                              {isEntree ? <ArrowRight size={14} style={{ transform: 'rotate(90deg)' }} /> : <ArrowLeft size={14} style={{ transform: 'rotate(90deg)' }} />}
                              {m.type_mouvement.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 900, fontSize: '1.1rem', color: isEntree ? '#16a34a' : '#ef4444' }}>
                            {isEntree ? '+' : '-'}{m.quantite}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#64748b' }}>
                            {m.ancien_stock} &rarr; <strong style={{ color: '#1e293b' }}>{m.nouveau_stock}</strong>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                            {m.reference && <div style={{ fontWeight: 800, color: '#1e293b' }}>{m.reference}</div>}
                            {m.commentaire && <div style={{ color: '#64748b', marginTop: '0.2rem' }}>{m.commentaire}</div>}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
