import { useState, useEffect } from 'react';
import { Produit } from '../../types';
import { createProduit, updateProduit } from '../../services/produitService';
import { X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

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
  const { showToast } = useToast();

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
        // Sanitize timestamps to avoid empty string errors in DB
        dataToSave.promo_debut = dataToSave.promo_debut ? new Date(dataToSave.promo_debut).toISOString() : null;
        dataToSave.promo_fin = dataToSave.promo_fin ? new Date(dataToSave.promo_fin).toISOString() : null;
      }

      // Ensure image is also in the images array for compatibility
      if (dataToSave.image_url) {
        dataToSave.image_url = dataToSave.image_url.trim();
        dataToSave.images = [dataToSave.image_url];
      }

      if (produit?.id) {
        await updateProduit(produit.id, dataToSave);
        showToast("Configuration article mise à jour avec succès !", "success");
      } else {
        await createProduit(dataToSave as Omit<Produit, 'id'>);
        showToast("Nouvel article référencé avec succès !", "success");
      }
      onSave();
      onClose();
    } catch (error: any) {
      console.error("Error saving product", error);
      const errorMsg = error.message || "Impossible d'enregistrer la fiche technique.";
      showToast(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content card glass-effect" style={{ maxWidth: '750px', padding: '3rem' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }} className="hover-card">
          <X size={22} strokeWidth={2.5} />
        </button>
        
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
            {produit ? 'Configuration Article' : 'Référencement Produit'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.4rem' }}>
            {produit ? `Édition de la fiche technique pour #${produit.sku || produit.id.slice(0, 8)}` : 'Enregistrez un nouvel article dans le catalogue universel.'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* SECTION 1: IDENTITE */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }}></div>
              Identité de l'article
            </h3>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Désignation commerciale *</label>
              <input type="text" className="form-input" required placeholder="Ex: iPhone 15 Pro Max - 256GB" style={{ height: '52px', borderRadius: '14px', fontSize: '1.05rem', fontWeight: 600 }} value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', marginTop: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Référence SKU (Unique) *</label>
                <input type="text" className="form-input" required placeholder="PROD-001" style={{ height: '52px', borderRadius: '14px', fontWeight: 700, letterSpacing: '0.05em' }} value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Lien Image Haute Définition</label>
                <div style={{ position: 'relative' }}>
                  <input type="url" className="form-input" placeholder="https://cdn.example.com/photo.jpg" style={{ height: '52px', borderRadius: '14px', paddingRight: '120px' }} value={formData.image_url || ''} onChange={e => setFormData({...formData, image_url: e.target.value})} />
                  {formData.image_url && (
                    <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '100px', height: '40px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <img 
                        src={formData.image_url} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {formData.image_url && (
              <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '16px', background: 'rgba(99, 102, 255, 0.05)', border: '1px dashed var(--primary)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                 <div style={{ width: '60px', height: '60px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}>
                    <img src={formData.image_url} alt="Large Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => (e.currentTarget.src = 'https://placehold.co/100x100?text=Format+Invalide')} />
                 </div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '2px' }}>Aperçu du visuel</div>
                    L'image sera affichée sur le catalogue et les factures.
                 </div>
              </div>
            )}
          </div>

          {/* SECTION 2: ECONOMIE */}
          <div style={{ marginBottom: '2.5rem', padding: '2rem', background: 'rgba(99, 102, 255, 0.03)', borderRadius: '24px', border: '1px solid rgba(99, 102, 255, 0.1)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }}></div>
              Modèle Économique & Prix
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Coût d'Achat (Unit.) *</label>
                <input type="number" className="form-input" required min="0" style={{ height: '52px', borderRadius: '14px', fontWeight: 700 }} value={formData.prix_achat} onChange={e => setFormData({...formData, prix_achat: Number(e.target.value)})} />
              </div>
              
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Prix de Vente Public *</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input type="number" className="form-input" required min="0" style={{ height: '52px', borderRadius: '14px', fontWeight: 900, color: 'var(--primary)', fontSize: '1.2rem' }} value={formData.prix_vente} onChange={e => setFormData({...formData, prix_vente: Number(e.target.value)})} />
                  <select className="form-select" style={{ width: '100px', height: '52px', borderRadius: '14px', fontWeight: 800 }} value={formData.devise} onChange={e => setFormData({...formData, devise: e.target.value})}>
                    <option value="CFA">CFA</option>
                    <option value="EUR">€</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1rem', padding: '1.25rem', background: hasPromo ? '#f0fdf4' : 'white', borderRadius: '18px', border: `2px solid ${hasPromo ? '#22c55e' : '#f1f5f9'}`, transition: 'all 0.3s ease' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 800, color: hasPromo ? '#166534' : 'var(--text-muted)' }}>
                <input type="checkbox" style={{ width: '20px', height: '20px', accentColor: '#22c55e' }} checked={hasPromo} onChange={e => setHasPromo(e.target.checked)} />
                Appliquer un tarif promotionnel temporaire
              </label>
              
              {hasPromo && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem', marginTop: '1.5rem', animation: 'pageEnter 0.3s ease' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#166534' }}>Prix Promo *</label>
                    <input type="number" className="form-input" required min="0" style={{ height: '48px', borderRadius: '12px', borderColor: '#bbf7d0', fontWeight: 900, color: '#16a34a' }} value={formData.prix_promo || ''} onChange={e => setFormData({...formData, prix_promo: Number(e.target.value)})} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, color: '#166534' }}>Début</label>
                      <input type="datetime-local" className="form-input" style={{ height: '48px', borderRadius: '12px', borderColor: '#bbf7d0', fontSize: '0.8rem' }} value={formData.promo_debut || ''} onChange={e => setFormData({...formData, promo_debut: e.target.value})} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, color: '#166534' }}>Fin</label>
                      <input type="datetime-local" className="form-input" style={{ height: '48px', borderRadius: '12px', borderColor: '#bbf7d0', fontSize: '0.8rem' }} value={formData.promo_fin || ''} onChange={e => setFormData({...formData, promo_fin: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: STOCK & LOGISTIQUE */}
          <div style={{ marginBottom: '3rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }}></div>
              Stock & Logistique
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Inventaire initial {produit && '(Scellé)'}</label>
                <input type="number" className="form-input" min="0" style={{ height: '52px', borderRadius: '14px', fontWeight: 800, background: produit ? '#f8fafc' : 'white' }} value={formData.stock_actuel} disabled={!!produit} onChange={e => setFormData({...formData, stock_actuel: Number(e.target.value)})} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Seuil d'alerte critique *</label>
                <input type="number" className="form-input" required min="1" style={{ height: '52px', borderRadius: '14px', fontWeight: 800, color: '#ef4444', borderColor: '#fee2e2' }} value={formData.stock_minimum} onChange={e => setFormData({...formData, stock_minimum: Number(e.target.value)})} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', marginTop: '1rem', padding: '1.25rem', borderRadius: '18px', background: formData.actif ? 'rgba(16, 185, 129, 0.05)' : '#f8fafc', border: `1px solid ${formData.actif ? '#10b981' : '#e2e8f0'}`, transition: 'all 0.3s ease' }}>
              <input type="checkbox" style={{ width: '22px', height: '22px', accentColor: '#10b981' }} checked={formData.actif} onChange={e => setFormData({...formData, actif: e.target.checked})} />
              <div>
                <div style={{ fontWeight: 900, color: formData.actif ? '#059669' : 'var(--text-muted)' }}>Produit Actif / En Vente</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Si décoché, l'article sera masqué des formulaires de commande.</div>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', borderTop: '2px solid #f1f5f9', paddingTop: '2rem' }}>
            <button type="button" className="btn btn-outline" style={{ height: '56px', padding: '0 2rem', borderRadius: '16px', fontWeight: 800 }} onClick={onClose} disabled={loading}>Annuler</button>
            <button type="submit" className="btn btn-primary" style={{ height: '56px', padding: '0 3rem', borderRadius: '16px', fontWeight: 900, fontSize: '1.1rem', boxShadow: '0 10px 15px -3px rgba(99, 102, 255, 0.4)' }} disabled={loading}>
              {loading ? 'SYNCHRONISATION...' : 'VALIDER LA FICHE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
