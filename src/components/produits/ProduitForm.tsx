import { useState, useEffect } from 'react';
import { Produit } from '../../types';
import { createProduit, updateProduit } from '../../services/produitService';
import { X } from 'lucide-react';

interface ProduitFormProps {
  produit?: Produit | null;
  onClose: () => void;
  onSave: () => void;
}

export const ProduitForm = ({ produit, onClose, onSave }: ProduitFormProps) => {
  const [formData, setFormData] = useState<Partial<Produit>>({
    nom: '',
    description: '',
    prix_achat: 0,
    prix_vente: 0,
    prix_promo: undefined,
    promo_debut: '',
    promo_fin: '',
    devise: 'CFA',
    sku: '',
    stock_actuel: 0,
    stock_minimum: 5,
    actif: true,
    image_url: ''
  });
  const [loading, setLoading] = useState(false);
  const [hasPromo, setHasPromo] = useState(false);

  useEffect(() => {
    if (produit) {
      setFormData({
        ...produit,
        promo_debut: produit.promo_debut ? new Date(produit.promo_debut).toISOString().slice(0, 16) : '',
        promo_fin: produit.promo_fin ? new Date(produit.promo_fin).toISOString().slice(0, 16) : ''
      });
      if (produit.prix_promo) setHasPromo(true);
    }
  }, [produit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave = { ...formData };
      
      // Cleanup promo if disabled
      if (!hasPromo) {
        delete dataToSave.prix_promo;
        delete dataToSave.promo_debut;
        delete dataToSave.promo_fin;
      } else {
        if (dataToSave.promo_debut) dataToSave.promo_debut = new Date(dataToSave.promo_debut).getTime();
        if (dataToSave.promo_fin) dataToSave.promo_fin = new Date(dataToSave.promo_fin).getTime();
      }

      if (produit?.id) {
        await updateProduit(produit.id, dataToSave);
      } else {
        await createProduit(dataToSave as Omit<Produit, 'id'>);
      }
      onSave();
    } catch (error) {
      console.error("Error saving product", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <X size={20} />
        </button>
        
        <h2 style={{ marginBottom: '1.5rem' }}>{produit ? 'Modifier le produit' : 'Nouveau produit'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nom du produit *</label>
            <input type="text" className="form-input" required value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Référence (SKU) *</label>
              <input type="text" className="form-input" required value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Image URL</label>
              <input type="url" className="form-input" placeholder="https://..." value={formData.image_url || ''} onChange={e => setFormData({...formData, image_url: e.target.value})} />
            </div>
          </div>

          <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem' }}>
            <legend style={{ padding: '0 0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tarification</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Prix d'Achat *</label>
                <input type="number" className="form-input" required min="0" value={formData.prix_achat} onChange={e => setFormData({...formData, prix_achat: Number(e.target.value)})} />
              </div>
              
              <div className="form-group">
                <label className="form-label">Prix de Vente *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="number" className="form-input" required min="0" value={formData.prix_vente} onChange={e => setFormData({...formData, prix_vente: Number(e.target.value)})} />
                  <select className="form-select" style={{ width: '90px' }} value={formData.devise} onChange={e => setFormData({...formData, devise: e.target.value})}>
                    <option value="CFA">CFA</option>
                    <option value="EUR">€</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                <input type="checkbox" checked={hasPromo} onChange={e => setHasPromo(e.target.checked)} />
                Activer un prix promotionnel
              </label>
            </div>

            {hasPromo && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', backgroundColor: 'rgba(79, 70, 229, 0.05)', borderRadius: 'var(--radius-md)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Prix Spécial (Promo) *</label>
                  <input type="number" className="form-input" required min="0" value={formData.prix_promo || ''} onChange={e => setFormData({...formData, prix_promo: Number(e.target.value)})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Début</label>
                    <input type="datetime-local" className="form-input" value={formData.promo_debut || ''} onChange={e => setFormData({...formData, promo_debut: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Fin</label>
                    <input type="datetime-local" className="form-input" value={formData.promo_fin || ''} onChange={e => setFormData({...formData, promo_fin: e.target.value})} />
                  </div>
                </div>
              </div>
            )}
          </fieldset>

          <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem' }}>
            <legend style={{ padding: '0 0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Stock & Visibilité</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Stock initial {produit && '(Non modifiable)'}</label>
                <input type="number" className="form-input" min="0" value={formData.stock_actuel} disabled={!!produit} onChange={e => setFormData({...formData, stock_actuel: Number(e.target.value)})} />
              </div>
              <div className="form-group">
                <label className="form-label">Stock Minimum (Alerte) *</label>
                <input type="number" className="form-input" required min="0" value={formData.stock_minimum} onChange={e => setFormData({...formData, stock_minimum: Number(e.target.value)})} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" id="actif" checked={formData.actif} onChange={e => setFormData({...formData, actif: e.target.checked})} />
              <label htmlFor="actif">Produit actif (visible pour la vente)</label>
            </div>
          </fieldset>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
