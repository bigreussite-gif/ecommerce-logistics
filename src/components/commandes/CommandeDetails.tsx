import { useState, useEffect } from 'react';
import { X, ShoppingBag, User, MapPin, Receipt, Phone, RefreshCw, RotateCcw, PackageX, MessageCircle } from 'lucide-react';
import { getCommandeWithLines, updateCommandeStatus, reactivateFailedCommande, registerReturn, logWhatsAppMessage } from '../../services/commandeService';
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
  const [waSentLocal, setWaSentLocal] = useState<{ type: string, date: string }[]>([]);

  useEffect(() => {
    getCommandeWithLines(commandeId)
      .then(cmd => {
        setCommande(cmd);
        setWaSentLocal(cmd.wa_sent || []);
      })
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

  const handleReactivateOrder = async () => {
    if (!commande) return;
    if (!window.confirm("Voulez-vous vraiment réactiver cette commande ?")) return;

    setIsUpdating(true);
    try {
      const updatedNotes = `[RÉACTIVATION] Commande réactivée le ${new Date().toLocaleString()}${commande.notes ? "\n--- Notes ---\n" + commande.notes : ""}`;
      await updateCommandeStatus(commande.id, 'en_attente_appel', { notes: updatedNotes });
      showToast("Commande réactivée et renvoyée en attente d'appel.", "success");
      onClose();
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la réactivation.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReactivateFailed = async () => {
    if (!commande) return;
    if (!window.confirm("Voulez-vous vraiment réactiver cette commande échouée ?")) return;
    setIsUpdating(true);
    try {
      await reactivateFailedCommande(commande.id);
      showToast("Commande réactivée (renvoyée en attente appel).", "success");
      onClose();
    } catch (error) {
       console.error(error);
       showToast("Erreur lors de la réactivation.", "error");
    } finally {
       setIsUpdating(false);
    }
  };

  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnMotif, setReturnMotif] = useState('');
  const [returnSolution, setReturnSolution] = useState('RETOUR DIRECT STOCK');
  const [returnNotes, setReturnNotes] = useState('');
  const [isDefective, setIsDefective] = useState(false);

  const handleReturnOrder = async () => {
    if (!commande || !returnMotif) return;
    setIsUpdating(true);
    try {
      const etat = isDefective ? 'DEFAILLANT' : 'REUTILISABLE';
      await registerReturn(commande.id, returnMotif, returnSolution, returnNotes, etat);
      showToast("Retour enregistré avec succès.", "success");
      onClose();
    } catch (error) {
       console.error(error);
       showToast("Erreur lors de l'enregistrement du retour.", "error");
    } finally {
       setIsUpdating(false);
    }
  };

  const generateWhatsAppLink = () => {
    if (!commande) return "";
    const nom = `*${commande.nom_client || 'Client'}*`;
    const ref = `*#${commande.id.slice(0, 8).toUpperCase()}*`;
    const articlesList = (commande.lignes || []).map((l: LigneCommande) => ` - *${l.quantite}x ${l.nom_produit}*`).join('\n');
    const subtotal = (commande.lignes || []).reduce((acc: number, l: LigneCommande) => acc + (l.montant_ligne || 0), 0);
    const delivery = Number(commande.frais_livraison) || 0;
    const total = subtotal + delivery;

    const bSubtotal = `*${subtotal.toLocaleString()} CFA*`;
    const bDelivery = `*${delivery > 0 ? delivery.toLocaleString() + " CFA" : "À définir"}*`;
    const bTotal = `*${total.toLocaleString()} CFA*`;

    const summary = `\n\n*Résumé de votre commande :*\n${articlesList}\n\n- Articles : ${bSubtotal}\n- Livraison : ${bDelivery}\n*Total à payer : ${bTotal}*`;

    let text = "";
    const status = commande.statut_commande.toLowerCase();

    if (['a_rappeler', 'absent', 'injoignable'].includes(status)) {
      text = `Bonjour ${nom},\n\nNous n'avons pas pu effectuer votre livraison car nous n'avons pas pu vous joindre (soit par défaut du livreur ou votre contretemps).\n\nPouvons-nous s'il vous plaît relancer votre commande ${ref} pour le jour suivant ?${summary}`;
    } else if (status === 'annulee') {
      text = `Bonjour ${nom},\n\nNous avons pris note de l'annulation de votre commande ${ref}.\n\nPourriez-vous nous indiquer les motifs de cette annulation s'il vous plaît ? Souhaitez-vous vraiment maintenir l'annulation ?${summary}`;
    } else if (['echouee', 'retour_livreur'].includes(status)) {
      text = `Bonjour ${nom},\n\nNous avons constaté un souci lors de la livraison de votre commande ${ref}.\n\nSouhaitez-vous que nous la reprogrammions pour demain ? Nous aimerions savoir si vous êtes toujours intéressé par vos articles :${summary}`;
    } else if (['livree', 'terminee'].includes(status)) {
      text = `Bonjour ${nom},\n\nVotre commande ${ref} a bien été livrée. Nous vous remercions de votre confiance !${summary}\n\nÀ très bientôt pour vos prochains achats.`;
    } else {
      text = `Bonjour ${nom},\n\nVotre commande ${ref} est bien enregistrée chez nous.\nSouhaitez-vous confirmer la livraison ?${summary}\n\nMerci de nous répondre pour confirmer la livraison.`;
    }
    
    const signature = "\n\n*L'équipe Jachete Côte d'Ivoire*\nwww.jachete.ci\n+225 01 72 57 13 52 ,";
    text += signature;
    
    let phone = (commande.telephone_client || '').replace(/\D/g, '');
    if (phone.length === 10) phone = '225' + phone;
    
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const handleWhatsAppClick = async (type: string) => {
    if (!commande) return;
    try {
      await logWhatsAppMessage(commande.id, type);
      setWaSentLocal(prev => [...prev, { type, date: new Date().toISOString() }]);
    } catch (err) {
      console.error("Erreur log WA:", err);
    }
  };

  const isWASent = (type: string) => waSentLocal.some(s => s.type === type);

  const getWAType = () => {
    if (!commande) return 'validation';
    const status = commande.statut_commande.toLowerCase();
    if (['a_rappeler', 'absent', 'injoignable'].includes(status)) return 'relance';
    if (status === 'annulee') return 'annulation';
    if (['echouee', 'retour_livreur'].includes(status)) return 'echec';
    if (['livree', 'terminee'].includes(status)) return 'cloture';
    return 'validation';
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

  const subtotal = (commande.lignes || []).reduce((acc: number, l: LigneCommande) => acc + (l.montant_ligne || 0), 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content card" style={{ maxWidth: '750px', padding: '0', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
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
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Commande #{(commande.id || '').slice(0, 8).toUpperCase()}</h2>
              <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem', fontWeight: 500 }}>Statut actuel: <span style={{ color: '#818cf8', fontWeight: 700 }}>{commande.statut_commande.replace(/_/g, ' ')}</span></p>
            </div>
          </div>
        </div>

        <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
             <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  <User size={16} /> Client
                </h4>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.5rem' }}>{commande.nom_client}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      <Phone size={14} /> {commande.telephone_client}
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <a 
                      href={generateWhatsAppLink()} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      onClick={() => handleWhatsAppClick(getWAType())}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.4rem', 
                        padding: '0.3rem 0.7rem', 
                        background: '#25D366', 
                        color: 'white', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        textDecoration: 'none',
                        opacity: isWASent(getWAType()) ? 0.7 : 1
                      }}
                    >
                      <MessageCircle size={14} fill="currentColor" /> 
                      {isWASent(getWAType()) ? 'Déjà envoyé' : 'WhatsApp'}
                    </a>
                    {isWASent(getWAType()) && (
                      <span style={{ fontSize: '0.6rem', color: '#059669', fontWeight: 700 }}>
                        {new Date(waSentLocal.find(s => s.type === getWAType())?.date || '').toLocaleDateString()}
                      </span>
                    )}
                   </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                   <MapPin size={16} style={{ marginTop: '0.1rem' }} /> 
                   <span>{commande.adresse_livraison}, {commande.commune_livraison}</span>
                </div>
             </div>

             <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  <ShoppingBag size={16} /> Logistique
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                   <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>Source</div>
                      <div style={{ fontWeight: 700 }}>{commande.source_commande}</div>
                   </div>
                   <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>Paiement</div>
                      <div style={{ fontWeight: 700 }}>{commande.mode_paiement}</div>
                   </div>
                </div>
             </div>
          </div>

          <div>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
              <Receipt size={18} /> Détails de la facture
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {(commande.lignes || []).map((l: LigneCommande, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'white', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
                  <div style={{ fontWeight: 700 }}>{l.nom_produit} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>x{l.quantite}</span></div>
                  <div style={{ fontWeight: 800 }}>{l.montant_ligne?.toLocaleString()} F</div>
                </div>
              ))}
            </div>

            <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              <div>
                 <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sous-total</div>
                 <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{subtotal.toLocaleString()} F</div>
              </div>
              <div>
                 <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Livraison</div>
                 <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{commande.frais_livraison?.toLocaleString()} F</div>
              </div>
              <div style={{ background: 'var(--primary)', color: 'white', padding: '1rem', borderRadius: '18px', textAlign: 'center' }}>
                 <div style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.9, textTransform: 'uppercase' }}>Total Net</div>
                 <div style={{ fontSize: '1.4rem', fontWeight: 950 }}>{commande.montant_total?.toLocaleString()} F</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '1.5rem 2rem', background: '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            {!['livree', 'terminee', 'annulee', 'retour_client'].includes(commande.statut_commande?.toLowerCase()) && (
              <button 
                className="btn btn-danger" 
                onClick={handleCancelOrder} 
                disabled={isUpdating}
                style={{ borderRadius: '12px', fontWeight: 700, background: '#fee2e2', color: '#991b1b', border: 'none' }}
              >
                {isUpdating ? 'Traitement...' : 'Annuler'}
              </button>
            )}

            {commande.statut_commande?.toLowerCase() === 'annulee' && (
              <button 
                className="btn btn-primary" 
                onClick={handleReactivateOrder} 
                disabled={isUpdating}
                style={{ borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <RefreshCw size={18} /> Réactiver Annulation
              </button>
            )}

            {['retour_livreur', 'echouee'].includes(commande.statut_commande?.toLowerCase()) && (
              <button 
                className="btn btn-primary" 
                onClick={handleReactivateFailed} 
                disabled={isUpdating}
                style={{ borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#3b82f6' }}
              >
                <RotateCcw size={18} /> Réactiver Echec
              </button>
            )}

            {['livree', 'terminee'].includes(commande.statut_commande?.toLowerCase()) && (
              <button 
                className="btn btn-warning" 
                onClick={() => setShowReturnForm(true)} 
                disabled={isUpdating}
                style={{ borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f59e0b', color: 'white' }}
              >
                <PackageX size={18} /> Gérer Retour
              </button>
            )}
          </div>
          <button className="btn btn-outline" onClick={onClose} style={{ borderRadius: '12px', fontWeight: 700 }}>Fermer</button>
        </div>
      </div>

      {showReturnForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem', borderRadius: '32px' }}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 900, fontSize: '1.4rem' }}>Enregistrer un retour</h3>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 800 }}>Motif du retour</label>
              <textarea 
                className="form-input" 
                rows={2} 
                value={returnMotif} 
                onChange={e => setReturnMotif(e.target.value)}
                placeholder="Ex: Client pas satisfait..."
                style={{ borderRadius: '16px', background: '#f8fafc', padding: '1rem' }}
                required
              />
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label" style={{ fontWeight: 800 }}>Solution appliquée</label>
              <select 
                className="form-select" 
                value={returnSolution} 
                onChange={e => setReturnSolution(e.target.value)}
                style={{ borderRadius: '16px', background: '#f8fafc', padding: '0.75rem 1rem' }}
              >
                <option value="RETOUR DIRECT STOCK">Retour Direct Stock</option>
                <option value="ECHANGE ARTICLE">Échange Article</option>
                <option value="REMBOURSEMENT">Remboursement</option>
                <option value="AVOIR CLIENT">Avoir Client</option>
              </select>
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label" style={{ fontWeight: 800 }}>Notes additionnelles</label>
              <input 
                className="form-input" 
                value={returnNotes} 
                onChange={e => setReturnNotes(e.target.value)}
                placeholder="..."
                style={{ borderRadius: '16px', background: '#f8fafc', padding: '1rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.2rem', padding: '1rem', background: '#fef2f2', borderRadius: '16px', border: '1px solid #fee2e2' }}>
              <input 
                type="checkbox" 
                id="isDefective" 
                checked={isDefective} 
                onChange={e => setIsDefective(e.target.checked)}
                style={{ width: '22px', height: '22px', cursor: 'pointer' }}
              />
              <label htmlFor="isDefective" style={{ fontWeight: 800, color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}>
                PRODUIT DÉFAILLANT (Pertes)<br/>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.8 }}>Sera retiré du stock actif</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
              <button className="btn btn-outline" style={{ flex: 1, height: '52px', borderRadius: '14px' }} onClick={() => setShowReturnForm(false)}>Annuler</button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, background: '#f59e0b', height: '52px', borderRadius: '14px' }} 
                onClick={handleReturnOrder}
                disabled={!returnMotif || isUpdating}
              >
                {isUpdating ? 'Traitement...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
