import { Produit } from '../../types';
import { Edit, PackagePlus, Image as ImageIcon } from 'lucide-react';
import { updateProduit } from '../../services/produitService';

interface ProduitListProps {
  produits: Produit[];
  onEdit: (produit: Produit) => void;
  onStock: (produit: Produit) => void;
}

export const ProduitList = ({ produits, onEdit, onStock }: ProduitListProps) => {
  const toggleActive = async (produit: Produit) => {
    try {
      await updateProduit(produit.id, { actif: !produit.actif });
    } catch (error) {
      console.error("Error updating status", error);
    }
  };

  const getPrixActif = (produit: Produit) => {
    if (produit.prix_promo) {
      const now = new Date().getTime();
      const debut = produit.promo_debut ? new Date(produit.promo_debut).getTime() : 0;
      const fin = produit.promo_fin ? new Date(produit.promo_fin).getTime() : Infinity;
      if (now >= debut && now <= fin) {
        return (
          <div>
            <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{produit.prix_promo.toLocaleString()} {produit.devise}</span>
            <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{produit.prix_vente.toLocaleString()}</span>
          </div>
        );
      }
    }
    return <span style={{ fontWeight: 600 }}>{produit.prix_vente?.toLocaleString()} {produit.devise}</span>;
  };

  if (produits.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
        <p>Aucun produit trouvé dans le catalogue.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th style={{ width: '80px' }}>Visuel</th>
            <th>ID / SKU</th>
            <th>Désignation Article</th>
            <th>Modèle Économique</th>
            <th>Niveau Stock</th>
            <th>Visibilité</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {produits.map((produit) => {
            // Robust image resolution
            const resolvedImage = produit.image_url || (Array.isArray(produit.images) && produit.images.length > 0 ? produit.images[0] : null);
            
            return (
              <tr key={produit.id} style={{ opacity: produit.actif ? 1 : 0.55, transition: 'all 0.3s ease' }} className="hover-card">
                <td>
                  <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', border: '2px solid white' }}>
                    {resolvedImage ? (
                      <img 
                        src={resolvedImage} 
                        alt={produit.nom} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => {
                          e.currentTarget.onerror = null; 
                          e.currentTarget.src = 'https://placehold.co/400x400?text=Format+Invalide';
                        }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ImageIcon size={20} color="#94a3b8" />
                      </div>
                    )}
                  </div>
                </td>
              <td>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary)' }}>#{produit.sku || produit.id.slice(0, 8).toUpperCase()}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>REF-IND-01</div>
              </td>
              <td>
                <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1.05rem' }}>{produit.nom}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Catégorie Générale</div>
              </td>
              <td>
                <div style={{ fontWeight: 900, color: 'var(--text-main)' }}>{getPrixActif(produit)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.2rem' }}>
                  Coût Achat: <span style={{ color: '#64748b' }}>{produit.prix_achat?.toLocaleString()} CFA</span>
                </div>
              </td>
              <td>
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '0.4rem 0.8rem', 
                  background: produit.stock_actuel <= (produit.stock_minimum || 5) ? '#fff1f2' : '#f0fdf4', 
                  borderRadius: '12px', 
                  border: `1px solid ${produit.stock_actuel <= (produit.stock_minimum || 5) ? '#fecaca' : '#bbf7d0'}`,
                  transition: 'all 0.2s ease' 
                }}>
                   <div style={{ 
                     width: '8px', 
                     height: '8px', 
                     borderRadius: '50%', 
                     background: produit.stock_actuel <= (produit.stock_minimum || 5) ? '#ef4444' : '#10b981',
                     animation: produit.stock_actuel <= (produit.stock_minimum || 5) ? 'pulse-red 2s infinite' : 'none'
                   }}></div>
                   <span style={{ fontWeight: 900, fontSize: '0.9rem', color: produit.stock_actuel <= (produit.stock_minimum || 5) ? '#991b1b' : '#15803d' }}>
                     {produit.stock_actuel} {produit.stock_actuel > 1 ? 'UNITÉS' : 'UNITÉ'}
                   </span>
                </div>
                {produit.stock_actuel <= (produit.stock_minimum || 5) && (
                   <div style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 800, marginTop: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                     ⚠️ STOCK CRITIQUE
                   </div>
                )}
              </td>
              <td>
                <div 
                  onClick={() => toggleActive(produit)}
                  style={{ 
                    width: '50px', 
                    height: '26px', 
                    background: produit.actif ? 'var(--primary)' : '#e2e8f0', 
                    borderRadius: '30px', 
                    padding: '3px', 
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative'
                  }}
                >
                  <div style={{ 
                    width: '20px', 
                    height: '20px', 
                    background: 'white', 
                    borderRadius: '50%', 
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transform: produit.actif ? 'translateX(24px)' : 'translateX(0)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}></div>
                </div>
              </td>
              <td style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn btn-outline" 
                    style={{ padding: '0.5rem', borderRadius: '12px', height: '42px', width: '42px', borderColor: '#e2e8f0' }}
                    onClick={() => onStock(produit)}
                    title="Mouvement de stock"
                  >
                    <PackagePlus size={18} strokeWidth={2.5} color="var(--primary)" />
                  </button>
                  <button 
                    className="btn btn-outline" 
                    style={{ padding: '0.5rem', borderRadius: '12px', height: '42px', width: '42px', borderColor: '#e2e8f0' }}
                    onClick={() => onEdit(produit)}
                    title="Modifier l'article"
                  >
                    <Edit size={18} strokeWidth={2.5} color="#64748b" />
                  </button>
                </div>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
};
