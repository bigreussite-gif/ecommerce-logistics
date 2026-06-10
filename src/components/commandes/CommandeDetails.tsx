import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ShoppingBag, User, MapPin, Receipt, Phone, RefreshCw, RotateCcw, PackageX, MessageCircle, AlertCircle, CheckCircle, Clock, Edit3 } from 'lucide-react';
import { getCommandeWithLines, updateCommandeStatus, reactivateFailedCommande, registerReturn, logWhatsAppMessage } from '../../services/commandeService';
import { getCommunes } from '../../services/adminService';
import { useToast } from '../../contexts/ToastContext';
import type { Commande, LigneCommande, Commune } from '../../types';
import { CommandeForm } from './CommandeForm';

interface CommandeDetailsProps {
  commandeId: string;
  onClose: () => void;
}

export const CommandeDetails = ({ commandeId, onClose }: CommandeDetailsProps) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [commande, setCommande] = useState<(Commande & { lignes: LigneCommande[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    getCommandeWithLines(commandeId)
      .then(cmd => {
        setCommande(cmd);
      })
      .finally(() => setLoading(false));
  }, [commandeId]);

  const handleCancelOrder = async () => {
    if (!commande) return;
    const motif = window.prompt("Veuillez saisir le motif de l'annulation :");
    if (!motif) return;

    setIsUpdating(true);
    try {
      const updatedNotes = `[ANNULATION] Motif: ${motif}${commande.notes_client ? "\n--- Notes Précédentes ---\n" + commande.notes_client : ""}`;
      await updateCommandeStatus(commande.id, 'annulee', { notes_client: updatedNotes });
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
      const updatedNotes = `[RÉACTIVATION] Commande réactivée le ${new Date().toLocaleString()}${commande.notes_client ? "\n--- Notes ---\n" + commande.notes_client : ""}`;
      await updateCommandeStatus(commande.id, 'en_attente_appel', { notes_client: updatedNotes });
      showToast("Commande réactivée et renvoyée en attente d'appel.", "success");
      onClose();
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la réactivation.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReassign = async () => {
    if (!commande) return;
    if (!window.confirm("Voulez-vous vraiment retirer cette commande de son livreur actuel pour la réattribuer ?")) return;

    setIsUpdating(true);
    try {
      const updatedNotes = `[RÉATTRIBUTION] Détachée du livreur le ${new Date().toLocaleString()}${commande.notes_client ? "\n--- Notes ---\n" + commande.notes_client : ""}`;
      await updateCommandeStatus(commande.id, 'validee', { notes_client: updatedNotes });
      showToast("Commande remise en attente d'affectation.", "success");
      onClose();
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la réattribution.", "error");
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

  // Zone assignment states
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [zoneCommune, setZoneCommune] = useState('');
  const [zoneAdresse, setZoneAdresse] = useState('');
  const [zoneQuartier, setZoneQuartier] = useState('');

  const handleOpenZoneForm = async () => {
    if (communes.length === 0) {
      try {
        const list = await getCommunes();
        setCommunes(list);
      } catch (e) {
        console.error('Erreur chargement communes:', e);
      }
    }
    setZoneCommune(commande?.commune_livraison || '');
    setZoneAdresse(commande?.adresse_livraison || '');
    setZoneQuartier(commande?.quartier_livraison || '');
    setShowZoneForm(true);
  };

  const handleSaveZone = async () => {
    if (!commande || !zoneCommune.trim()) return;
    setIsUpdating(true);
    try {
      await updateCommandeStatus(commande.id, commande.statut_commande, {
        commune_livraison: zoneCommune.trim(),
        adresse_livraison: zoneAdresse.trim(),
        quartier_livraison: zoneQuartier.trim(),
      });
      showToast('Zone de livraison enregistrée avec succès !', 'success');
      // Refresh commande data
      const updated = await getCommandeWithLines(commande.id);
      setCommande(updated);
      setShowZoneForm(false);
    } catch (error) {
      console.error(error);
      showToast('Erreur lors de la mise à jour de la zone.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

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

  // Détection commune intérieure (hors Abidjan)
  const isInteriorCommune = (commune: string): boolean => {
    if (!commune) return false;
    const n = commune.toLowerCase().trim();
    return n.includes('intérieur') || n.includes('interieur') || n.includes('hors') || n === 'autre';
  };

  const generateWhatsAppLink = () => {
    if (!commande) return "";
    const nom = `*${commande.nom_client || 'Client'}*`;
    const ref = `*#${commande.id.slice(0, 8).toUpperCase()}*`;
    const articlesList = (commande.lignes || []).map((l: LigneCommande) => ` - *${l.quantite}x ${l.nom_produit}*`).join('\n');
    const subtotal = (commande.lignes || []).reduce((acc: number, l: LigneCommande) => acc + (l.montant_ligne || 0), 0);
    const delivery = Number(commande.frais_livraison) || 0;
    const remise = Number(commande.remise_totale) || 0;
    const total = Math.max(0, subtotal + delivery - remise);

    const bSubtotal = `*${subtotal.toLocaleString()} CFA*`;
    const bDelivery = `*${delivery > 0 ? delivery.toLocaleString() + " CFA" : "À définir"}*`;
    const bRemise = remise > 0 ? `\n- Remise : *-${remise.toLocaleString()} CFA*` : "";
    const bTotal = `*${total.toLocaleString()} CFA*`;

    const communeEffective = commande.commune_livraison || '';
    const isInterior = isInteriorCommune(communeEffective);

    const summary = `\n\n📦 *Détails de votre commande ${ref} :*\n${articlesList}\n\n- Sous-total articles : ${bSubtotal}\n- Frais d'envoi : ${bDelivery}${bRemise}\n💰 *Total à régler : ${bTotal}*`;

    let text = "";
    const status = commande.statut_commande.toLowerCase();

    if (['a_rappeler', 'absent', 'injoignable'].includes(status)) {
      if (isInterior && communeEffective) {
        text = `Bonjour ${nom} 👋\n\nC'est votre conseiller chez *Jachete Côte d'Ivoire*.\n\nNous avons essayé de vous joindre plusieurs fois pour votre commande mais sans succès.\n\nVotre colis est prêt et attend d'être expédié vers *${communeEffective}* ! 🚀\n\nPour ne pas perdre votre commande, confirmez-nous votre disponibilité en répondant *OUI* et on relance tout de suite.${summary}\n\n📞 Appelez-nous au *+225 01 72 57 13 52* pour toute question.`;
      } else {
        text = `Bonjour ${nom} 👋\n\nC'est votre conseiller de *Jachete Côte d'Ivoire*.\n\nNous avons tenté de vous joindre pour votre livraison mais sans succès. Votre colis est prêt ! 📦\n\nPouvons-nous reprogrammer votre livraison pour demain ? Répondez *OUI* et le livreur sera chez vous dans les plus brefs délais.${summary}\n\n📞 Besoin d'aide ? Appelez-nous au *+225 01 72 57 13 52*.`;
      }
    } else if (status === 'annulee') {
      text = `Bonjour ${nom} 👋\n\nNous avons bien noté l'annulation de votre commande ${ref}. On ne va pas vous retenir si vous avez changé d'avis... *mais avant de partir*, on voulait juste vous dire quelque chose. 🙏\n\n🔥 *L'article que vous aviez choisi part très vite.* Les stocks sont limités et d'autres clients l'ont déjà commandé aujourd'hui. Si vous hésitez encore, il risque de ne plus être disponible dans quelques jours.\n\n💬 *Qu'est-ce qui vous a fait hésiter ?*\nSi c'est le prix, le délai ou une inquiétude sur la livraison — dites-le nous franchement. On trouvera une solution ensemble. Chez *Jachete Côte d'Ivoire*, chaque client compte et on est là pour vous.\n\n🎁 *Offre spéciale pour vous :* Si vous relancez votre commande maintenant, on vous réserve une *attention spéciale* en cadeau de notre part. Répondez juste *OUI* ici et on s'en occupe immédiatement !\n${summary}\n\n🛍️ *Et si vous cherchez autre chose ?*\nNotre boutique regorge d'articles de qualité livrés partout en Côte d'Ivoire :\n👉 *www.jachete.ci*\n\nParcourez nos nouveautés, nos promos du moment et commandez en quelques clics. La livraison est rapide et sécurisée — à Abidjan et dans tout le pays ! 🚀\n\n📞 Appelez notre service client au *+225 01 72 57 13 52* pour toute question. À très bientôt ! 🤝`;
    } else if (['echouee', 'retour_livreur'].includes(status)) {
      if (isInterior && communeEffective) {
        text = `Bonjour ${nom} 👋\n\nVotre conseiller chez *Jachete Côte d'Ivoire* à l'appareil.\n\nNous avons eu un empêchement lors de l'expédition de votre commande vers *${communeEffective}*. Nous nous en excusons sincèrement. 🙏\n\nBonne nouvelle : votre colis est toujours disponible et prêt à partir ! Confirmez-nous et on expédie dès demain.${summary}\n\n📞 Appelez-nous au *+225 01 72 57 13 52* ou répondez *OUI* ici.`;
      } else {
        text = `Bonjour ${nom} 👋\n\nVotre conseiller de *Jachete Côte d'Ivoire* ici.\n\nNous avons eu un souci lors de votre livraison et nous en sommes vraiment désolés. 🙏\n\nVotre livreur sera chez vous demain à la première heure en *priorité absolue*. Êtes-vous toujours disponible ?${summary}\n\n📞 Appelez-nous au *+225 01 72 57 13 52* pour confirmer le créneau.`;
      }
    } else if (['livree', 'terminee'].includes(status)) {
      text = `Bonjour ${nom} 🎉\n\nVotre commande ${ref} a bien été livrée avec succès !\n\nNous vous remercions sincèrement pour votre confiance. 🙏 C'était un plaisir de vous servir !${summary}\n\nVous avez aimé votre expérience ? Parlez-en autour de vous ! Et retrouvez nos nouveaux articles sur *www.jachete.ci* 🛍️\n\n📞 Pour nous joindre : *+225 01 72 57 13 52*. À très bientôt ! 🤝`;
    } else {
      // Confirmation / En attente
      if (isInterior && communeEffective) {
        // Lieu exact
        const lieuExact = [
          communeEffective,
          commande.quartier_livraison || '',
          commande.adresse_livraison || ''
        ].filter(Boolean).join(', ');

        text = `Bonjour ${nom} ! 🙌\n\nC'est votre conseiller de *Jachete Côte d'Ivoire*. Nous vous informons que votre commande a bien été *enregistrée* ! 🎉\n${summary}\n\n📍 *Lieu de livraison prévu :* ${lieuExact}\n⚠️ Comme vous êtes en *zone intérieure (hors Abidjan)*, votre colis sera expédié à la *gare routière de ${communeEffective}* pour que vous le récupériez sur place.\n\n✅ *Procédure pour l'expédition :*\nPuisque nous n'effectuons pas de livraison directe à l'intérieur du pays, le paiement à la livraison n'est pas possible.\n1️⃣ Veuillez effectuer le dépôt du montant de la commande via *Wave* ou *Orange Money* au :\n💸 *+225 07 57 22 87 31*\n2️⃣ Envoyez-nous la *capture de votre reçu* par WhatsApp sur ce même numéro\n3️⃣ Dès réception de votre dépôt, nous expédions immédiatement votre colis — vous le récupérez à la gare !\n\n💡 *Alternative :* Vous avez un frère ou un proche actuellement à Abidjan ? Donnez-nous son contact — notre livreur peut lui remettre le colis directement ici à Abidjan et il pourra payer à la livraison !\n\n🔒 *Vous hésitez à payer en avance ?* Nous comprenons. Jachete Côte d'Ivoire existe depuis plusieurs années et des centaines de clients dans tout le pays nous font confiance chaque jour. Appelez notre service client au *+225 01 72 57 13 52* pour toutes vos questions avant de payer. Votre satisfaction est notre priorité ! 🤝\n\n📲 Après paiement, envoyez la capture au *+225 07 57 22 87 31*. On s'occupe du reste ! 💪`;
      } else {
        text = `Bonjour ${nom} ! 🙌\n\nC'est votre conseiller de *Jachete Côte d'Ivoire*. Nous vous informons que votre commande a bien été *enregistrée* ! 🎉\n${summary}\n\nUn livreur va vous appeler *aujourd'hui ou demain* pour la livraison à *${communeEffective || 'votre adresse'}*. Vous payez à la livraison, *aucune avance requise*.\n\nRépondez *OUI* pour confirmer ! 🚚\n\n📞 Questions ? Appelez-nous au *+225 01 72 57 13 52*.`;
      }
    }
    
    const signature = "\n\n*Jachete Côte d'Ivoire* 🛍️\nwww.jachete.ci | +225 01 72 57 13 52";
    text += signature;
    
    let phone = (commande.telephone_client || '').replace(/\D/g, '');
    if (phone.length === 10) phone = '225' + phone;
    
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const handleWhatsAppClick = async () => {
    if (!commande) return;
    try {
      await logWhatsAppMessage(commande.id, getWAType());
    } catch (err) {
      console.error("Erreur log WA:", err);
    }
  };

  const getWAType = () => {
    const status = (commande?.statut_commande || '').toLowerCase();
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

  if (isEditing) {
    return (
      <CommandeForm
        editingCommande={commande}
        originalLines={commande.lignes}
        onClose={() => setIsEditing(false)}
        onSave={async () => {
          setIsEditing(false);
          setLoading(true);
          try {
            const cmd = await getCommandeWithLines(commandeId);
            setCommande(cmd);
          } finally {
            setLoading(false);
          }
        }}
      />
    );
  }

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
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Commande #{(commande.id || '').slice(0, 8).toUpperCase()}</h2>
              <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem', fontWeight: 500 }}>Statut actuel: <span style={{ color: '#818cf8', fontWeight: 700 }}>{commande.statut_commande.replace(/_/g, ' ')}</span></p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginRight: '2rem' }}>
              <button 
                onClick={() => setIsEditing(true)}
                className="btn btn-primary btn-sm" 
                style={{ borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#4f46e5', color: 'white', border: 'none' }}
              >
                <Edit3 size={16} /> Modifier
              </button>
              <button 
                onClick={() => { onClose(); navigate(`/commandes/${commande.id}/historique`); }}
                className="btn btn-outline btn-sm" 
                style={{ borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <Clock size={16} /> Historique
              </button>
            </div>
          </div>
        </div>

        {/* MOTIF D'ANNULATION OU RETOUR */}
        {(commande.statut_commande.toLowerCase() === 'annulee' || commande.statut_commande.toLowerCase() === 'retour_client') && (
          <div style={{ margin: '1.5rem 2rem 0', padding: '1.25rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed #fecaca', borderRadius: '18px', display: 'flex', gap: '1rem', alignItems: 'start' }}>
            <div style={{ color: '#ef4444', marginTop: '2px' }}><AlertCircle size={20} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                {commande.statut_commande.toLowerCase() === 'annulee' ? "Motif de l'annulation" : "Détails du retour"}
              </div>
              <div style={{ fontSize: '0.95rem', color: '#7f1d1d', fontWeight: 600, lineHeight: 1.4 }}>
                {commande.notes_client?.includes('Motif:') 
                  ? commande.notes_client.split('Motif:')[1].split('\n')[0].trim() 
                  : (commande.notes_client || 'Aucune information renseignée')}
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
             <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  <User size={16} /> Client
                </h4>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.5rem' }}>{commande.nom_client}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                        <Phone size={14} /> {commande.telephone_client}
                      </div>
                      {commande.telephone_secondaire && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>
                          <Phone size={12} /> {commande.telephone_secondaire} <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(Sec.)</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <a 
                      href={generateWhatsAppLink()} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      onClick={() => handleWhatsAppClick()}
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
                        textDecoration: 'none'
                      }}
                    >
                      <MessageCircle size={14} fill="currentColor" /> 
                      WhatsApp
                    </a>
                   </div>
                </div>
                <div style={{ marginTop: '0.75rem', background: '#f1f5f9', borderRadius: '14px', padding: '0.75rem 1rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                     <MapPin size={14} color="var(--primary)" />
                     <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>Adresse de livraison</span>
                   </div>
                   <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.5 }}>
                     {commande.adresse_livraison || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Adresse non précisée</span>}
                   </div>
                   {commande.quartier_livraison && (
                     <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>Quartier : {commande.quartier_livraison}</div>
                   )}
                   <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 800, marginTop: '0.25rem' }}>
                     📍 {commande.commune_livraison || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Commune non précisée</span>}
                   </div>
                   
                   {/* ⚠️ ALERTE ZONE MANQUANTE */}
                   {!commande.commune_livraison && (
                     <div style={{ marginTop: '0.75rem', padding: '0.85rem 1rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px dashed #f59e0b', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                       <AlertCircle size={18} color="#d97706" style={{ flexShrink: 0 }} />
                       <div style={{ flex: 1 }}>
                         <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#92400e', textTransform: 'uppercase', marginBottom: '2px' }}>Zone de livraison manquante</div>
                         <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>Cette commande ne peut pas être affectée sans zone.</div>
                       </div>
                       <button
                         onClick={handleOpenZoneForm}
                         style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                       >
                         <Edit3 size={13} /> Ajouter
                       </button>
                     </div>
                   )}
                   {/* ✏️ BOUTON MODIFIER ZONE (quand elle existe déjà) */}
                   {commande.commune_livraison && (
                     <button
                       onClick={handleOpenZoneForm}
                       style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.6rem', background: 'transparent', color: 'var(--primary)', border: '1px solid rgba(99,102,255,0.25)', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                     >
                       <Edit3 size={12} /> Modifier la zone
                     </button>
                   )}
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
                   {(commande as any).livreur?.nom_complet && (
                     <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #e2e8f0' }}>
                       <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '0.25rem' }}>Affectation Logistique</div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                         <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(99, 102, 255, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <User size={12} strokeWidth={3} />
                         </div>
                         <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{(commande as any).livreur.nom_complet}</div>
                         {commande.feuille_route_id && (
                           <span style={{ fontSize: '0.7rem', background: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 700, color: '#475569' }}>
                             #{(commande.feuille_route_id || '').slice(0, 5).toUpperCase()}
                           </span>
                         )}
                       </div>
                     </div>
                   )}
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
                  <div style={{ fontWeight: 700 }}>
                    {l.nom_produit} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>x{l.quantite}</span>
                    {l.choix_installation && (
                      <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800, marginTop: '2px' }}>
                        + Installation incluse ({(Number(l.frais_installation) * l.quantite).toLocaleString()} F)
                      </div>
                    )}
                  </div>
                  <div style={{ fontWeight: 800 }}>{l.montant_ligne?.toLocaleString()} F</div>
                </div>
              ))}
            </div>

            <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              <div>
                 <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sous-total</div>
                 <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{subtotal.toLocaleString()} F</div>
              </div>
              <div>
                 <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Livraison</div>
                 <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{commande.frais_livraison?.toLocaleString()} F</div>
              </div>
              {commande.remise_totale ? (
                <div>
                   <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f43f5e', textTransform: 'uppercase' }}>Remise</div>
                   <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f43f5e' }}>-{commande.remise_totale.toLocaleString()} F</div>
                </div>
              ) : (
                <div>
                   <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remise</div>
                   <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>0 F</div>
                </div>
              )}
              <div style={{ background: 'var(--primary)', color: 'white', padding: '1rem', borderRadius: '18px', textAlign: 'center' }}>
                 <div style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.9, textTransform: 'uppercase' }}>Total Net</div>
                 <div style={{ fontSize: '1.4rem', fontWeight: 950 }}>{commande.montant_total?.toLocaleString()} F</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '1.5rem 2rem', background: '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* ✅ Boutons de validation directe pour commandes en attente */}
            {['nouvelle', 'en_attente_appel', 'a_rappeler'].includes(commande.statut_commande?.toLowerCase()) && (
              <>
                <button 
                  className="btn btn-primary" 
                  onClick={async () => {
                    setIsUpdating(true);
                    try {
                      await updateCommandeStatus(commande.id, 'validee', { agent_appel_id: undefined, date_validation_appel: new Date() });
                      showToast('Commande validée avec succès !', 'success');
                      onClose();
                    } catch(e) { showToast('Erreur lors de la validation.', 'error'); }
                    finally { setIsUpdating(false); }
                  }}
                  disabled={isUpdating}
                  style={{ borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#10b981', border: 'none' }}
                >
                  <CheckCircle size={18} /> Valider
                </button>
                <button 
                  className="btn"
                  onClick={async () => {
                    setIsUpdating(true);
                    try {
                      await updateCommandeStatus(commande.id, 'a_rappeler', {});
                      showToast('Commande mise en attente de rappel.', 'success');
                      onClose();
                    } catch(e) { showToast('Erreur.', 'error'); }
                    finally { setIsUpdating(false); }
                  }}
                  disabled={isUpdating}
                  style={{ borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f59e0b', color: 'white', border: 'none' }}
                >
                  <RefreshCw size={18} /> À Rappeler
                </button>
              </>
            )}

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
                <RefreshCw size={18} /> Réactiver
              </button>
            )}

            {commande.statut_commande?.toLowerCase() === 'en_cours_livraison' && (
              <button 
                className="btn btn-warning" 
                onClick={handleReassign} 
                disabled={isUpdating}
                style={{ borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f59e0b', color: 'white', border: 'none' }}
              >
                <RotateCcw size={18} /> Réattribuer
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

      {/* MODAL ZONE DE LIVRAISON */}
      {showZoneForm && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(6px)' }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', borderRadius: '32px', boxShadow: '0 30px 60px -10px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '14px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 12px rgba(245,158,11,0.3)' }}>
                <MapPin size={20} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: '#1e293b' }}>Zone de livraison</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Définir ou modifier la destination</p>
              </div>
              <button onClick={() => setShowZoneForm(false)} style={{ marginLeft: 'auto', background: '#f1f5f9', border: 'none', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 800, fontSize: '0.85rem' }}>Commune / Zone de livraison <span style={{ color: '#ef4444' }}>*</span></label>
              {communes.length > 0 ? (
                <select
                  className="form-select"
                  value={zoneCommune}
                  onChange={e => setZoneCommune(e.target.value)}
                  style={{ borderRadius: '14px', background: '#f8fafc', height: '48px', fontWeight: 700, borderColor: !zoneCommune ? '#f59e0b' : undefined }}
                >
                  <option value="">-- Sélectionner une commune --</option>
                  {communes.map(c => (
                    <option key={c.id} value={c.nom}>{c.nom} — {c.tarif_livraison.toLocaleString()} CFA</option>
                  ))}
                  <option value="Intérieur / Hors Abidjan">Intérieur / Hors Abidjan</option>
                </select>
              ) : (
                <input
                  className="form-input"
                  value={zoneCommune}
                  onChange={e => setZoneCommune(e.target.value)}
                  placeholder="Ex: Cocody, Yopougon, San-Pédro..."
                  style={{ borderRadius: '14px', background: '#f8fafc', padding: '0.85rem 1rem', fontWeight: 600, borderColor: !zoneCommune ? '#f59e0b' : undefined }}
                />
              )}
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label" style={{ fontWeight: 800, fontSize: '0.85rem' }}>Quartier</label>
              <input
                className="form-input"
                value={zoneQuartier}
                onChange={e => setZoneQuartier(e.target.value)}
                placeholder="Ex: Riviera 3, Deux Plateaux..."
                style={{ borderRadius: '14px', background: '#f8fafc', padding: '0.85rem 1rem', fontWeight: 600 }}
              />
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label" style={{ fontWeight: 800, fontSize: '0.85rem' }}>Adresse précise</label>
              <textarea
                className="form-input"
                rows={2}
                value={zoneAdresse}
                onChange={e => setZoneAdresse(e.target.value)}
                placeholder="Ex: En face du carrefour Shell, près du marché..."
                style={{ borderRadius: '14px', background: '#f8fafc', padding: '0.85rem 1rem', fontWeight: 600, resize: 'none' }}
              />
            </div>

            {!zoneCommune && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.07)', borderRadius: '12px', border: '1px solid #fde68a', fontSize: '0.78rem', color: '#92400e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={14} /> La commune est obligatoire pour affecter cette commande.
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1, height: '50px', borderRadius: '14px', fontWeight: 700 }}
                onClick={() => setShowZoneForm(false)}
              >
                Annuler
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', height: '50px', borderRadius: '14px', fontWeight: 800, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 8px 16px rgba(245,158,11,0.3)' }}
                onClick={handleSaveZone}
                disabled={!zoneCommune.trim() || isUpdating}
              >
                <CheckCircle size={18} />
                {isUpdating ? 'Enregistrement...' : 'Enregistrer la zone'}
              </button>
            </div>
          </div>
        </div>
      )}

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
