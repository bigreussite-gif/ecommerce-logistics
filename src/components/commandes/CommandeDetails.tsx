import { useState, useEffect } from 'react';
import { X, ShoppingBag, User, MapPin, Receipt, Phone } from 'lucide-react';
import { getCommandeWithLines, updateCommandeStatus } from '../../services/commandeService';
import { useToast } from '../../contexts/ToastContext';
import type { Commande, LigneCommande } from '../../types';

interface CommandeDetailsProps {
  commandeId: string;
  onClose: () => void;
}

export const CommandeDetails = ({ commandeId, onClose }: CommandeDetailsProps) => {
  const { showToast } = useToast();
  const [commande, setCommande] = useState<(Commande & { lignes: LigneCommande[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    getCommandeWithLines(commandeId)
      .then(setCommande)
      .finally(() => setLoading(false));
  }, [commandeId]);

  const handleCancelOrder = async () => {
    if (!commande) return;
    const motif = window.prompt("Veuillez saisir le motif de l'annulation :");
    if (!motif) return;

    setIsUpdating(true);
    try {
      const updatedNotes = `[ANNULATION] Motif: ${motif}${commande.notes ? "\n--- Notes Précédentes ---\n" + commande.notes : ""}`;
      await updateCommandeStatus(commande.id, 'annulee', { notes: updatedNotes });
      showToast("Commande annulée avec motif enregistré.", "success");
      onClose();
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de l'annulation.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-content card" style={{ maxWidth: '600px', textAlign: 'center', padding: '4rem' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 1.5rem' }}></div>
          <p style={{ fontWeight: 600 }}>Chargement des détails...</p>
        </div>
      </div>
    );
  }

  if (!commande) return null;

  const subtotal = (commande.lignes || []).reduce((acc, l) => acc + (l.montant_ligne || 0), 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content card" style={{ maxWidth: '700px', padding: '0', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        {/* Header Section */}
        <div style={{ padding: '2rem', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', position: 'relative' }}>
          <button 
            onClick={onClose} 
            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}
          >
            <X size={18} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.6rem', background: 'rgba(99, 102, 255, 0.2)', borderRadius: '12px' }}>
              <Receipt size={24} color="#818cf8" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Commande #{commande.id.slice(0, 8).toUpperCase()}</h2>
              <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem', fontWeight: 500 }}>Statut actuel: <span style={{ color: '#818cf8', fontWeight: 700 }}>{commande.statut_commande.replace(/_/g, ' ')}</span></p>
            </div>
          </div>
        </div>

        <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }} className="responsive-grid">
          {/* Client Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
                <User size={18} /> Informations Client
              </h4>
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{commande.nom_client}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
                   <Phone size={14} /> {commande.telephone_client}
                </div>
                <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                   <MapPin size={16} style={{ marginTop: '0.2rem' }} /> 
                   <div>
                     <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{commande.commune_livraison}</div>
                     <div>{commande.adresse_livraison}</div>
                   </div>
                </div>
              </div>
            </div>

            {/* Order Meta */}
            <div>
               <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Détails Logistique</h4>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                 <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Source</div>
                   <div style={{ fontWeight: 700 }}>{commande.source_commande}</div>
                 </div>
                 <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '12px', textAlign: 'center' }}>
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Paiement</div>
                   <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{commande.mode_paiement}</div>
                 </div>
               </div>
            </div>
          </div>

          {/* Items Section */}
          <div>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
              <ShoppingBag size={18} /> Articles Commandés
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {commande.lignes.map((l, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{l.nom_produit}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{l.quantite} x {l.prix_unitaire?.toLocaleString()} CFA</div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--primary)' }}>
                    {(l.montant_ligne || 0).toLocaleString()} <span style={{ fontSize: '0.6rem' }}>CFA</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                 <span>Sous-total produits</span>
                 <span>{subtotal.toLocaleString()} CFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                 <span>Livraison</span>
                 <span>{commande.frais_livraison?.toLocaleString()} CFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px dashed #cbd5e1', paddingTop: '1rem' }}>
                 <span style={{ fontWeight: 800, fontSize: '1rem' }}>TOTAL À ENCAISSER</span>
                 <span style={{ fontWeight: 900, fontSize: '1.4rem', color: 'var(--primary)' }}>{commande.montant_total?.toLocaleString()} CFA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '1.5rem 2rem', background: '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {!['livree', 'terminee', 'annulee'].includes(commande.statut_commande?.toLowerCase()) && (
              <button 
                className="btn btn-danger" 
                onClick={handleCancelOrder} 
                disabled={isUpdating}
                style={{ borderRadius: '12px', fontWeight: 700, background: '#fee2e2', color: '#991b1b', border: 'none' }}
              >
                {isUpdating ? 'Traitement...' : 'Annuler la Commande'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-outline" onClick={onClose} style={{ borderRadius: '12px', fontWeight: 700 }}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
};
