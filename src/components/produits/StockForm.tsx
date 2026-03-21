import { useState } from 'react';
import { Produit, MouvementStock } from '../../types';
import { addMouvementStock } from '../../services/produitService';
import { X, ArrowDownRight, ArrowUpRight, RefreshCcw, Info } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface StockFormProps {
  produit: Produit;
  onClose: () => void;
  onSave: () => void;
}

export const StockForm = ({ produit, onClose, onSave }: StockFormProps) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<Partial<MouvementStock>>({
    produit_id: produit.id,
    type_mouvement: 'entree',
    quantite: 1,
    reference: '',
    commentaire: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation: Prevent exit greater than current stock
    if (formData.type_mouvement === 'sortie' && (formData.quantite || 0) > produit.stock_actuel) {
      showToast(`Impossible de sortir ${formData.quantite} unités. Stock insuffisant (${produit.stock_actuel} dispo).`, "error");
      return;
    }

    setLoading(true);
    try {
      await addMouvementStock(formData as any);
      showToast("Mouvement de stock enregistré avec succès !", "success");
      onSave();
    } catch (error) {
      showToast("Erreur lors de l'enregistrement du mouvement.", "error");
      console.error("Error adding stock movement", error);
    } finally {
      setLoading(false);
    }
  };

  const getAccentColor = () => {
    switch (formData.type_mouvement) {
      case 'entree': return '#10b981';
      case 'sortie': return '#ef4444';
      case 'retour': return '#f59e0b';
      default: return 'var(--primary)';
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content card glass-effect" style={{ maxWidth: '550px', padding: '2.5rem' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="btn-close-premium" style={{ 
          position: 'absolute', top: '1.5rem', right: '1.5rem', 
          background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', 
          width: '36px', height: '36px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', transition: 'all 0.2s'
        }}>
          <X size={20} />
        </button>
        
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="text-premium" style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem' }}>Mouvement de Stock</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Produit</p>
              <p style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.1rem' }}>{produit.nom}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stock Actuel</p>
              <span className={`badge ${produit.stock_actuel <= (produit.stock_minimum || 0) ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '1rem', padding: '0.4rem 0.8rem' }}>
                {produit.stock_actuel} unités
              </span>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          
          <div style={{ marginBottom: '2rem' }}>
            <label className="form-label" style={{ marginBottom: '1rem', display: 'block' }}>Type de mouvement</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div 
                onClick={() => setFormData({...formData, type_mouvement: 'entree'})}
                style={{ 
                  border: `2px solid ${formData.type_mouvement === 'entree' ? '#10b981' : 'rgba(255,255,255,0.05)'}`, 
                  borderRadius: '20px', padding: '1.25rem 0.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
                  backgroundColor: formData.type_mouvement === 'entree' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: formData.type_mouvement === 'entree' ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: formData.type_mouvement === 'entree' ? '0 10px 15px -3px rgba(16, 185, 129, 0.2)' : 'none'
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                   <ArrowDownRight size={24} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: formData.type_mouvement === 'entree' ? '#10b981' : 'var(--text-muted)' }}>Entrée</span>
              </div>
              
              <div 
                onClick={() => setFormData({...formData, type_mouvement: 'sortie'})}
                style={{ 
                  border: `2px solid ${formData.type_mouvement === 'sortie' ? '#ef4444' : 'rgba(255,255,255,0.05)'}`, 
                  borderRadius: '20px', padding: '1.25rem 0.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
                  backgroundColor: formData.type_mouvement === 'sortie' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: formData.type_mouvement === 'sortie' ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: formData.type_mouvement === 'sortie' ? '0 10px 15px -3px rgba(239, 68, 68, 0.2)' : 'none'
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                   <ArrowUpRight size={24} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: formData.type_mouvement === 'sortie' ? '#ef4444' : 'var(--text-muted)' }}>Sortie</span>
              </div>
              
              <div 
                onClick={() => setFormData({...formData, type_mouvement: 'retour'})}
                style={{ 
                  border: `2px solid ${formData.type_mouvement === 'retour' ? '#f59e0b' : 'rgba(255,255,255,0.05)'}`, 
                  borderRadius: '20px', padding: '1.25rem 0.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
                  backgroundColor: formData.type_mouvement === 'retour' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: formData.type_mouvement === 'retour' ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: formData.type_mouvement === 'retour' ? '0 10px 15px -3px rgba(245, 158, 11, 0.2)' : 'none'
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                   <RefreshCcw size={24} strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: formData.type_mouvement === 'retour' ? '#f59e0b' : 'var(--text-muted)' }}>Retour</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Quantité *</label>
              <input 
                type="number" 
                className="form-input" 
                required min="1"
                style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}
                value={formData.quantite}
                onChange={e => setFormData({...formData, quantite: Number(e.target.value)})}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Référence</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="ex: BL-2024-001"
                value={formData.reference}
                onChange={e => setFormData({...formData, reference: e.target.value})}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">Note / Commentaire</label>
            <textarea 
              className="form-input" 
              rows={2}
              placeholder="Détails additionnels sur ce mouvement..."
              style={{ resize: 'none' }}
              value={formData.commentaire}
              onChange={e => setFormData({...formData, commentaire: e.target.value})}
            />
          </div>

          {formData.type_mouvement === 'sortie' && (
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '0.75rem', 
              padding: '1rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)', 
              border: '1px solid rgba(239, 68, 68, 0.1)', marginBottom: '1.5rem'
            }}>
              <Info size={18} color="#ef4444" />
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#ef4444', fontWeight: 500 }}>
                Attention : Le stock final sera de <strong>{produit.stock_actuel - (formData.quantite || 0)}</strong> unités.
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading} style={{ border: 'none', background: 'rgba(255,255,255,0.05)' }}>
              Annuler
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ 
                background: getAccentColor(), 
                color: 'white', 
                fontWeight: 800,
                boxShadow: `0 10px 20px -5px ${getAccentColor()}40`
              }}
            >
              {loading ? 'Traitement...' : 'Confirmer le mouvement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
