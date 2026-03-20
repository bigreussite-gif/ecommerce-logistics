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
            <th style={{ width: '48px' }}>Image</th>
            <th>SKU</th>
            <th>Article</th>
            <th>Vente (Achat)</th>
            <th>Stock</th>
            <th>Statut</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {produits.map((produit) => (
            <tr key={produit.id} style={{ opacity: produit.actif ? 1 : 0.6 }}>
              <td>
                {produit.image_url ? (
                  <img src={produit.image_url} alt={produit.nom} style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '4px', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ImageIcon size={16} color="var(--text-secondary)" />
                  </div>
                )}
              </td>
              <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{produit.sku}</td>
              <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{produit.nom}</td>
              <td>
                {getPrixActif(produit)}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Achat: {produit.prix_achat?.toLocaleString()}</div>
              </td>
              <td>
                <span className={`badge ${produit.stock_actuel <= produit.stock_minimum ? 'badge-danger' : 'badge-success'}`}>
                  {produit.stock_actuel} en stock
                </span>
              </td>
              <td>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}>
                  <input type="checkbox" checked={produit.actif} onChange={() => toggleActive(produit)} />
                  <span style={{ fontSize: '0.875rem' }}>{produit.actif ? 'Actif' : 'Caché'}</span>
                </label>
              </td>
              <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button 
                  className="btn btn-outline" 
                  style={{ padding: '0.25rem 0.5rem', color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
                  onClick={() => onStock(produit)}
                  title="Mouvement de stock"
                >
                  <PackagePlus size={16} />
                </button>
                <button 
                  className="btn btn-outline" 
                  style={{ padding: '0.25rem 0.5rem' }}
                  onClick={() => onEdit(produit)}
                  title="Modifier"
                >
                  <Edit size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
