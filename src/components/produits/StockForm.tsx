import { useState } from 'react';
import { Produit, MouvementStock } from '../../types';
import { addMouvementStock } from '../../services/produitService';
import { X, ArrowDownRight, ArrowUpRight, RefreshCcw } from 'lucide-react';

interface StockFormProps {
  produit: Produit;
  onClose: () => void;
  onSave: () => void;
}

export const StockForm = ({ produit, onClose, onSave }: StockFormProps) => {
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
    setLoading(true);
    try {
      await addMouvementStock(formData as any);
      onSave();
    } catch (error) {
      console.error("Error adding stock movement", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="card" style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <X size={20} />
        </button>
        
        <h2 style={{ marginBottom: '0.5rem' }}>Mouvement de stock</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Produit : <strong style={{ color: 'var(--text-primary)' }}>{produit.nom}</strong> 
          <br/>Stock actuel : <span className={`badge ${produit.stock_actuel <= produit.stock_minimum ? 'badge-danger' : 'badge-success'}`} style={{ marginLeft: '0.5rem' }}>{produit.stock_actuel}</span>
        </p>
        
        <form onSubmit={handleSubmit}>
          
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <label 
              style={{ 
                border: `1px solid ${formData.type_mouvement === 'entree' ? 'var(--success-color)' : 'var(--border-color)'}`, 
                borderRadius: 'var(--radius-md)', padding: '0.75rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                backgroundColor: formData.type_mouvement === 'entree' ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
              }}
            >
              <input type="radio" name="type" checked={formData.type_mouvement === 'entree'} onChange={() => setFormData({...formData, type_mouvement: 'entree'})} style={{ display: 'none' }} />
              <ArrowDownRight size={24} color="var(--success-color)" />
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Entrée</span>
            </label>
            
            <label 
              style={{ 
                border: `1px solid ${formData.type_mouvement === 'sortie' ? 'var(--danger-color)' : 'var(--border-color)'}`, 
                borderRadius: 'var(--radius-md)', padding: '0.75rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                backgroundColor: formData.type_mouvement === 'sortie' ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
              }}
            >
              <input type="radio" name="type" checked={formData.type_mouvement === 'sortie'} onChange={() => setFormData({...formData, type_mouvement: 'sortie'})} style={{ display: 'none' }} />
              <ArrowUpRight size={24} color="var(--danger-color)" />
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Sortie</span>
            </label>

            <label 
              style={{ 
                border: `1px solid ${formData.type_mouvement === 'retour' ? 'var(--warning-color)' : 'var(--border-color)'}`, 
                borderRadius: 'var(--radius-md)', padding: '0.75rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                backgroundColor: formData.type_mouvement === 'retour' ? 'rgba(245, 158, 11, 0.05)' : 'transparent'
              }}
            >
              <input type="radio" name="type" checked={formData.type_mouvement === 'retour'} onChange={() => setFormData({...formData, type_mouvement: 'retour'})} style={{ display: 'none' }} />
              <RefreshCcw size={24} color="var(--warning-color)" />
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Retour</span>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Quantité *</label>
            <input 
              type="number" 
              className="form-input" 
              required min="1"
              value={formData.quantite}
              onChange={e => setFormData({...formData, quantite: Number(e.target.value)})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Référence (ex: Numéro BL, Facture...)</label>
            <input 
              type="text" 
              className="form-input" 
              value={formData.reference}
              onChange={e => setFormData({...formData, reference: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Commentaire</label>
            <textarea 
              className="form-input" 
              rows={2}
              value={formData.commentaire}
              onChange={e => setFormData({...formData, commentaire: e.target.value})}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Confirmer le mouvement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
