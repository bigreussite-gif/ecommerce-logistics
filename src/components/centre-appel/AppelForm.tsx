import { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, XCircle, MessageCircle, AlertCircle, Plus, Minus, Trash2, Search, PhoneCall } from 'lucide-react';
import { updateCommandeStatus, updateCommandeLignesAndStock, logWhatsAppMessage } from '../../services/commandeService';
import { insforge } from '../../lib/insforge';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getCommunes } from '../../services/adminService';
import { subscribeToProduits } from '../../services/produitService';
import type { Commande, AppelCommande, Commune, LigneCommande, Produit } from '../../types';

interface AppelFormProps {
  commande: Commande;
  onClose: () => void;
  onSave: () => void;
}

export const AppelForm = ({ commande, onClose, onSave }: AppelFormProps) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState<AppelCommande['resultat_appel']>('validee');
  const [commentaire, setCommentaire] = useState('');
  const [fraisLivraison, setFraisLivraison] = useState<number | ''>(commande.frais_livraison || '');
  const [communeLocal, setCommuneLocal] = useState(commande.commune_livraison || '');
  const [adresseLocal, setAdresseLocal] = useState(commande.adresse_livraison || '');
  const [dateLivraisonType, setDateLivraisonType] = useState<'today' | 'tomorrow' | 'custom'>('today');
  const [customDateValue, setCustomDateValue] = useState('');
  const [communesDb, setCommunesDb] = useState<Commune[]>([]);

  // Remise (Discount) state
  const [remiseValue, setRemiseValue] = useState<number | ''>(commande.remise_totale || '');
  const [remiseType, setRemiseType] = useState<'fixe' | 'pourcentage'>('fixe');

  
  // Articles adjustment state
  const [lignesLocal, setLignesLocal] = useState<Partial<LigneCommande>[]>(commande.lignes || []);
  const [catalogue, setCatalogue] = useState<Produit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getCommunes().then(setCommunesDb);
    const unsub = subscribeToProduits(p => setCatalogue(p.filter(x => x.actif)));
    return () => unsub();
  }, []);

  const parsePrice = (p: Produit): number => {
    let prixActif = p.prix_vente;
    if (p.prix_promo && p.prix_promo > 0) {
      const now = new Date().getTime();
      const debut = p.promo_debut ? new Date(p.promo_debut).getTime() : 0;
      const fin = p.promo_fin ? new Date(p.promo_fin).getTime() : Infinity;
      if (now >= debut && now <= fin) {
        prixActif = p.prix_promo;
      }
    }
    return prixActif;
  };

  const handleUpdateQty = (idx: number, delta: number) => {
    const newLines = [...lignesLocal];
    const item = newLines[idx];
    if (!item) return;

    const newQty = Math.max(1, (item.quantite || 0) + delta);
    newLines[idx] = { 
      ...item, 
      quantite: newQty, 
      montant_ligne: newQty * (item.prix_unitaire || 0) 
    };
    setLignesLocal(newLines);
  };

  const handleRemoveLine = (idx: number) => {
    setLignesLocal(lignesLocal.filter((_, i) => i !== idx));
  };

  const handleAddProduct = (prod: Produit) => {
    const price = parsePrice(prod);
    const existingIdx = lignesLocal.findIndex(l => l.produit_id === prod.id);
    
    if (existingIdx > -1) {
      handleUpdateQty(existingIdx, 1);
    } else {
      setLignesLocal([...lignesLocal, {
        produit_id: prod.id,
        nom_produit: prod.nom,
        quantite: 1,
        prix_unitaire: price,
        montant_ligne: price
      }]);
    }
    setSearchTerm('');
  };

  const handleCommuneChange = (nom: string) => {
    setCommuneLocal(nom);
    const selected = communesDb.find(c => c.nom === nom);
    if (selected) {
      setFraisLivraison(selected.tarif_livraison);
    }
  };

  const calculateSubtotal = () => lignesLocal.reduce((acc, l) => acc + (l.montant_ligne || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (resultat !== 'annulee' && lignesLocal.length === 0) {
      showToast("La commande doit contenir au moins un article.", "error");
      return;
    }
    
    setLoading(true);
    try {
      const subtotal = calculateSubtotal();
      const delivery = Number(fraisLivraison) || 0;
      
      const discountAmount = remiseType === 'fixe' 
        ? (Number(remiseValue) || 0) 
        : Math.round(subtotal * (Number(remiseValue) || 0) / 100);

      const total = Math.max(0, subtotal + delivery - discountAmount);

      // 1. Sync lines and stock
      await updateCommandeLignesAndStock(commande.id, commande.lignes || [], lignesLocal);

      // 2. Enregistrer l'appel dans l'historique
      await insforge.database
        .from('appels_commandes')
        .insert([{
          commande_id: commande.id,
          agent_appel_id: currentUser.id,
          date_appel: new Date(),
          resultat_appel: resultat,
          commentaire_agent: commentaire
        }]);

      // 3. Mettre à jour le statut de la commande
      const nextStatusMap: Record<string, string> = {
        'validee': 'validee',
        'a_rappeler': 'a_rappeler',
        'annulee': 'annulee',
        'injoignable': 'a_rappeler',
        'echouee': 'a_rappeler'
      };
      
      const payload: any = { 
        statut_commande: nextStatusMap[resultat],
        agent_appel_id: currentUser.id,
        montant_total: total,
        frais_livraison: delivery,
        remise_totale: discountAmount,
        commune_livraison: communeLocal,
        adresse_livraison: adresseLocal
      };

      if (resultat === 'validee') {
        payload.date_validation_appel = new Date();
        
        // Handle delivery date
        let scheduledDate: any = new Date();
        if (dateLivraisonType === 'tomorrow') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          scheduledDate = tomorrow;
        } else if (dateLivraisonType === 'custom' && customDateValue) {
          scheduledDate = new Date(customDateValue);
        }
        payload.date_livraison_prevue = scheduledDate;
      }

      if (resultat === 'annulee') {
        payload.notes_client = `[ANNULATION APPEL] Motif: ${commentaire}${commande.notes_client ? "\n--- Notes Précédentes ---\n" + commande.notes_client : ""}`;
      }

      if (resultat === 'echouee') {
        payload.notes_client = `[ECHEC LIVRAISON - RELANCE] Agent: ${commentaire}${commande.notes_client ? "\n--- Notes ---\n" + commande.notes_client : ""}`;
      }

      await updateCommandeStatus(commande.id, nextStatusMap[resultat], payload);
      showToast(`Commande ${resultat === 'annulee' ? 'annulée' : (resultat === 'validee' ? 'validée' : 'mise à jour')} avec succès.`, "success");
      onSave();
    } catch (error) {
      console.error("Erreur lors de la validation :", error);
      showToast("Une erreur est survenue lors de l'enregistrement.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Détection commune intérieure (hors Abidjan)
  // Une commune est "intérieure" si son nom contient "intérieur", "interieur", "hors", ou "autre"
  const isInteriorCommune = (commune: string): boolean => {
    if (!commune) return false;
    const n = commune.toLowerCase().trim();
    return n.includes('intérieur') || n.includes('interieur') || n.includes('hors') || n === 'autre';
  };

  const generateWhatsAppLink = () => {
    const nom = `*${commande.nom_client || 'Client'}*`;
    const ref = `*#${commande.id.slice(0, 8).toUpperCase()}*`;
    const articlesList = lignesLocal.map(l => ` - *${l.quantite}x ${l.nom_produit}*`).join('\n');
    const subtotal = calculateSubtotal();
    const delivery = Number(fraisLivraison) || Number(commande.frais_livraison) || 0;
    
    const discountAmount = remiseType === 'fixe' 
      ? (Number(remiseValue) || 0) 
      : Math.round(subtotal * (Number(remiseValue) || 0) / 100);

    const total = Math.max(0, subtotal + delivery - discountAmount);
    const communeEffective = communeLocal || commande.commune_livraison || '';
    const isInterior = isInteriorCommune(communeEffective);

    const bSubtotal = `*${subtotal.toLocaleString()} CFA*`;
    const bDelivery = `*${delivery > 0 ? delivery.toLocaleString() + " CFA" : "À définir"}*`;
    const bDiscount = discountAmount > 0 ? `\n- Remise : *-${discountAmount.toLocaleString()} CFA*` : "";
    const bTotal = `*${total.toLocaleString()} CFA*`;

    const summary = `\n\n📦 *Détails de votre commande ${ref} :*\n${articlesList}\n\n- Sous-total articles : ${bSubtotal}\n- Frais d'envoi : ${bDelivery}${bDiscount}\n💰 *Total à régler : ${bTotal}*`;

    let text = "";

    if (resultat === 'a_rappeler' || resultat === 'injoignable') {
      if (isInterior && communeEffective) {
        text = `Bonjour ${nom} 👋\n\nC'est votre conseiller chez *Jachete Côte d'Ivoire*.\n\nNous avons essayé de vous joindre plusieurs fois pour votre commande mais sans succès.\n\nVotre colis est prêt et attend d'être expédié vers *${communeEffective}* ! 🚀\n\nPour ne pas perdre votre commande, pouvez-vous nous confirmer si vous êtes toujours disponible ? Répondez simplement *OUI* et on relance tout de suite.${summary}`;
      } else {
        text = `Bonjour ${nom} 👋\n\nC'est votre conseiller de *Jachete Côte d'Ivoire*.\n\nNous avons tenté de vous joindre pour votre livraison mais sans succès. Votre colis est prêt ! 📦\n\nPouvons-nous reprogrammer votre livraison pour demain ? Répondez *OUI* et le livreur sera chez vous dans les plus brefs délais.${summary}`;
      }
    } else if (resultat === 'annulee') {
      text = `Bonjour ${nom} 👋\n\nNous avons bien noté l'annulation de votre commande ${ref}. On ne va pas vous retenir si vous avez changé d'avis... *mais avant de partir*, on voulait juste vous dire quelque chose. 🙏\n\n🔥 *L'article que vous aviez choisi part très vite.* Les stocks sont limités et d'autres clients l'ont déjà commandé aujourd'hui. Si vous hésitez encore, il risque de ne plus être disponible dans quelques jours.\n\n💬 *Qu'est-ce qui vous a fait hésiter ?*\nSi c'est le prix, le délai ou une inquiétude sur la livraison — dites-le nous franchement. On trouvera une solution ensemble. Chez *Jachete Côte d'Ivoire*, chaque client compte et on est là pour vous.\n\n🎁 *Offre spéciale pour vous :* Si vous relancez votre commande maintenant, on vous réserve une *attention spéciale* en cadeau de notre part. Répondez juste *OUI* ici et on s'en occupe immédiatement !\n${summary}\n\n🛍️ *Et si vous cherchez autre chose ?*\nNotre boutique regorge d'articles de qualité livrés partout en Côte d'Ivoire :\n👉 *www.jachete.ci*\n\nParcourez nos nouveautés, nos promos du moment et commandez en quelques clics. La livraison est rapide et sécurisée — à Abidjan et dans tout le pays ! 🚀\n\n📲 On reste disponibles pour vous au *+225 07 57 22 87 31*. À très bientôt ! 🤝`;
    } else if (resultat === 'echouee') {
      if (isInterior && communeEffective) {
        text = `Bonjour ${nom} 👋\n\nVotre conseiller chez *Jachete Côte d'Ivoire* à l'appareil.\n\nNous avons eu un empêchement lors de l'expédition de votre commande vers *${communeEffective}*. Nous nous en excusons sincèrement. 🙏\n\nBonne nouvelle : votre colis est toujours disponible et prêt à partir ! Confirmez-nous et on expédie dès demain.${summary}`;
      } else {
        text = `Bonjour ${nom} 👋\n\nVotre conseiller de *Jachete Côte d'Ivoire* ici.\n\nNous avons eu un souci lors de votre livraison et nous en sommes vraiment désolés. 🙏\n\nVotre livreur sera chez vous demain à la première heure en *priorité absolue*. Êtes-vous toujours disponible ?${summary}`;
      }
    } else {
      // Validation / Confirmation
      if (isInterior && communeEffective) {
        // Lieu exact de livraison
        const lieuExact = [
          communeEffective,
          (commande.quartier_livraison || ''),
          (adresseLocal || commande.adresse_livraison || '')
        ].filter(Boolean).join(', ');

        text = `Bonjour ${nom} ! 🙌\n\nC'est votre conseiller de *Jachete Côte d'Ivoire*. Excellente nouvelle, votre commande est *confirmée* ! 🚀\n${summary}\n\n📍 *Lieu de livraison prévu :* ${lieuExact}\n⚠️ Comme vous êtes en *zone intérieure (hors Abidjan)*, votre colis sera expédié à la *gare routière de ${communeEffective}* pour que vous le récupériez sur place.\n\n✅ *Comment procéder :*\n1️⃣ Payez via *Wave* ou *Orange Money* au numéro :\n📱 *+225 07 57 22 87 31*\n2️⃣ Envoyez-nous la *capture de votre reçu* par WhatsApp sur ce même numéro\n3️⃣ On expédie immédiatement — vous récupérez à la gare !\n\n💡 *Alternative :* Vous avez un frère ou un proche actuellement à Abidjan ? Donnez-nous son contact — notre livreur peut lui remettre le colis directement ici à Abidjan !\n\n🔒 *Vous hésitez à payer ?* Nous comprenons et c'est tout à fait normal. Jachete Côte d'Ivoire existe depuis plusieurs années et des centaines de clients dans tout le pays nous font confiance chaque jour. Votre colis n'est expédié qu'*après réception et confirmation de votre paiement*. Vous pouvez nous appeler directement au *+225 07 57 22 87 31* pour qu'on réponde à toutes vos questions avant de payer. Votre satisfaction est notre priorité ! 🤝\n\n📲 Après paiement, envoyez la capture ou appelez-nous au *+225 07 57 22 87 31*. On s'occupe du reste ! 💪`;
      } else {
        let missingInfo = "";
        if (!commande.commune_livraison && !communeLocal) missingInfo += "- *Votre commune de livraison*\n";
        if (!commande.adresse_livraison && !adresseLocal) missingInfo += "- *Votre adresse exacte*\n";

        text = `Bonjour ${nom} ! 🙌\n\nC'est votre conseiller de *Jachete Côte d'Ivoire*. Votre commande est *confirmée et en cours de préparation* ! 🎉\n\nUn livreur se déplacera chez vous à *${communeEffective || 'votre adresse'}* pour vous remettre votre colis. Vous payez à la livraison, *aucune avance requise*.${summary}\n\n`;

        if (missingInfo) {
          text += `📝 Pour finaliser, merci de nous confirmer :\n${missingInfo}\n`;
        }
        text += "Répondez *OUI* pour confirmer et notre équipe prendra en charge votre livraison ! 🚚";
      }
    }
    
    const signature = "\n\n*Jachete Côte d'Ivoire* 🛍️\nwww.jachete.ci | +225 01 72 57 13 52";
    text += signature;
    
    let phone = (commande.telephone_client || '').replace(/\D/g, '');
    if (phone.length === 10) phone = '225' + phone;
    
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };



  const handleWhatsAppClick = async () => {
    try {
      await logWhatsAppMessage(commande.id, getWAType());
    } catch (err) {
      console.error("Erreur log WA:", err);
    }
  };

  const getWAType = () => {
    if (resultat === 'validee') return 'CONFIRM_ORDER';
    if (resultat === 'a_rappeler' || resultat === 'injoignable') return 'RECALL_LATER';
    if (resultat === 'annulee') return 'ORDER_CANCELLED';
    if (resultat === 'echouee') return 'ORDER_FAILED';
    return 'GENERAL';
  };

  const filteredCatalogue = searchTerm.length > 0 
    ? catalogue.filter(p => p.nom.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <div className="modal-backdrop" style={{ backdropFilter: 'blur(10px)', background: 'rgba(15, 23, 42, 0.7)' }} onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '750px', padding: 0, borderRadius: '32px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }} onClick={e => e.stopPropagation()}>
        
        {/* Header Section */}
        <div style={{ padding: '2.5rem', background: 'linear-gradient(135deg, #f8fafc, #eff6ff)', borderBottom: '1px solid #e2e8f0', position: 'relative' }}>
          <button 
            onClick={onClose} 
            style={{ 
              position: 'absolute', 
              top: '1.5rem', 
              right: '1.5rem', 
              background: 'white', 
              border: '1px solid #e2e8f0', 
              borderRadius: '14px',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer', 
              color: 'var(--text-muted)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
            }}
          >
            <X size={20} strokeWidth={2.5} />
          </button>
          
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(99, 102, 255, 0.2)' }}>
              <PhoneCall size={36} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2 className="text-premium" style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0 }}>Traitement d'Appel</h2>
                <span style={{ padding: '0.4rem 0.8rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>#{commande.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{commande.nom_client || 'Client Anonyme'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <MessageCircle size={18} color="#25D366" /> {commande.telephone_client}
                </div>
                <a 
                  href={generateWhatsAppLink()} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  onClick={() => handleWhatsAppClick()}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.4rem', 
                    padding: '0.4rem 0.8rem', 
                    background: '#25D366', 
                    color: 'white', 
                    borderRadius: '10px', 
                    fontSize: '0.75rem', 
                    fontWeight: 800, 
                    textDecoration: 'none',
                    boxShadow: '0 4px 10px rgba(37, 211, 102, 0.2)'
                  }}
                >
                  WhatsApp
                </a>
              </div>

              {/* Adresse de livraison affichée dans le header */}
              <div style={{ 
                marginTop: '1rem', 
                display: 'flex', 
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>📍 Livraison :</span>
                {(commande.commune_livraison || communeLocal) ? (
                  <span style={{ padding: '0.25rem 0.75rem', background: 'rgba(99,102,255,0.1)', color: 'var(--primary)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800 }}>
                    {communeLocal || commande.commune_livraison}
                  </span>
                ) : (
                  <span style={{ padding: '0.25rem 0.75rem', background: '#fef3c7', color: '#92400e', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}>
                    ⚠️ Commune non définie
                  </span>
                )}
                {(commande.quartier_livraison) && (
                  <span style={{ padding: '0.25rem 0.75rem', background: '#f1f5f9', color: '#475569', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                    Qtier: {commande.quartier_livraison}
                  </span>
                )}
                {(commande.adresse_livraison || adresseLocal) ? (
                  <span style={{ padding: '0.25rem 0.75rem', background: '#f0fdf4', color: '#166534', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                    {adresseLocal || commande.adresse_livraison}
                  </span>
                ) : (
                  <span style={{ padding: '0.25rem 0.75rem', background: '#fef3c7', color: '#92400e', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}>
                    ⚠️ Adresse non définie
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div style={{ padding: '2.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Articles Adjustment Section */}
          <div style={{ padding: '1.5rem', background: '#f0f9ff', borderRadius: '20px', border: '1px solid #bae6fd' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: '#0369a1', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📦 Composition de la commande
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              {lignesLocal.map((l, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'white', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{l.nom_produit}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.prix_unitaire?.toLocaleString()} CFA / unité</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <button type="button" onClick={() => handleUpdateQty(idx, -1)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}><Minus size={14} strokeWidth={3} /></button>
                    <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem' }}>{l.quantite}</span>
                    <button type="button" onClick={() => handleUpdateQty(idx, 1)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}><Plus size={14} strokeWidth={3} /></button>
                  </div>
                  <div style={{ width: '80px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>{(l.montant_ligne || 0).toLocaleString()}</div>
                  <button type="button" onClick={() => handleRemoveLine(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem' }}><Trash2 size={18} /></button>
                </div>
              ))}
            </div>

            {/* Add Product Search */}
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ajouter un article (nom ou SKU)..." 
                    style={{ paddingLeft: '2.5rem', background: 'white', height: '40px', fontSize: '0.9rem' }}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              {filteredCatalogue.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', marginTop: '4px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                  {filteredCatalogue.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => handleAddProduct(p)}
                      style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{p.nom}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SKU: {p.sku} | Stock: {p.stock_actuel}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.85rem' }}>{parsePrice(p).toLocaleString()} CFA</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Discount Section */}
          <div style={{ padding: '1.25rem', background: '#f0fdf4', borderRadius: '20px', border: '1px solid #bbf7d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#166534', margin: 0 }}>
                🏷️ Remise / Réduction
              </h3>
              <div style={{ display: 'flex', gap: '4px', background: 'white', padding: '0.2rem', borderRadius: '10px', border: '1px solid #dcfce7' }}>
                <button 
                  type="button" 
                  onClick={() => setRemiseType('fixe')}
                  style={{ 
                    padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 800, border: 'none', borderRadius: '6px', cursor: 'pointer',
                    background: remiseType === 'fixe' ? '#166534' : 'transparent',
                    color: remiseType === 'fixe' ? 'white' : '#166534'
                  }}
                >Fixe (CFA)</button>
                <button 
                  type="button" 
                  onClick={() => setRemiseType('pourcentage')}
                  style={{ 
                    padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 800, border: 'none', borderRadius: '6px', cursor: 'pointer',
                    background: remiseType === 'pourcentage' ? '#166534' : 'transparent',
                    color: remiseType === 'pourcentage' ? 'white' : '#166534'
                  }}
                >%</button>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input 
                  type="number"
                  placeholder={remiseType === 'fixe' ? "Montant (ex: 2000)" : "Pourcentage (ex: 10)"}
                  value={remiseValue}
                  onChange={e => setRemiseValue(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid #dcfce7', fontSize: '0.9rem', fontWeight: 700, outline: 'none' }}
                />
                <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, fontSize: '0.8rem', color: '#166534' }}>
                  {remiseType === 'fixe' ? 'CFA' : '%'}
                </span>
              </div>
              
              {remiseValue !== '' && Number(remiseValue) > 0 && (
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534' }}>
                  Économie: -{Math.round(remiseType === 'fixe' ? Number(remiseValue) : (calculateSubtotal() * Number(remiseValue) / 100)).toLocaleString()} CFA
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Résultat de l'échange</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <label style={{ 
                border: `2px solid ${resultat === 'validee' ? 'var(--primary)' : '#e2e8f0'}`, 
                borderRadius: '16px', padding: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                background: resultat === 'validee' ? 'rgba(99, 102, 255, 0.05)' : 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
                boxShadow: resultat === 'validee' ? '0 4px 6px -1px rgba(99, 102, 255, 0.1)' : 'none'
              }}>
                <input type="radio" checked={resultat === 'validee'} onChange={() => setResultat('validee')} style={{ display: 'none' }} />
                <CheckCircle size={20} color={resultat === 'validee' ? 'var(--primary)' : '#94a3b8'} strokeWidth={2.5} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: resultat === 'validee' ? 'var(--primary)' : '#64748b' }}>Valider</span>
              </label>
              
              <label style={{ 
                border: `2px solid ${resultat === 'a_rappeler' ? '#f59e0b' : '#e2e8f0'}`, 
                borderRadius: '16px', padding: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                background: resultat === 'a_rappeler' ? 'rgba(245, 158, 11, 0.05)' : 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem'
              }}>
                <input type="radio" checked={resultat === 'a_rappeler'} onChange={() => setResultat('a_rappeler')} style={{ display: 'none' }} />
                <Clock size={20} color={resultat === 'a_rappeler' ? '#f59e0b' : '#94a3b8'} strokeWidth={2.5} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: resultat === 'a_rappeler' ? '#d97706' : '#64748b' }}>À rappeler</span>
              </label>

              <label style={{ 
                border: `2px solid ${resultat === 'injoignable' ? '#6366f1' : '#e2e8f0'}`, 
                borderRadius: '16px', padding: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                background: resultat === 'injoignable' ? 'rgba(99, 102, 241, 0.05)' : 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem'
              }}>
                <input type="radio" checked={resultat === 'injoignable'} onChange={() => setResultat('injoignable')} style={{ display: 'none' }} />
                <MessageCircle size={20} color={resultat === 'injoignable' ? '#6366f1' : '#94a3b8'} strokeWidth={2.5} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: resultat === 'injoignable' ? '#4f46e5' : '#64748b' }}>Injoignable</span>
              </label>

              <label style={{ 
                border: `2px solid ${resultat === 'echouee' ? '#ea580c' : '#e2e8f0'}`, 
                borderRadius: '16px', padding: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                background: resultat === 'echouee' ? 'rgba(234, 88, 12, 0.05)' : 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem'
              }}>
                <input type="radio" checked={resultat === 'echouee'} onChange={() => setResultat('echouee')} style={{ display: 'none' }} />
                <AlertCircle size={20} color={resultat === 'echouee' ? '#ea580c' : '#94a3b8'} strokeWidth={2.5} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: resultat === 'echouee' ? '#c2410c' : '#64748b' }}>Échec Liv.</span>
              </label>
              
              <label style={{ 
                border: `2px solid ${resultat === 'annulee' ? '#ef4444' : '#e2e8f0'}`, 
                borderRadius: '16px', padding: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                background: resultat === 'annulee' ? 'rgba(239, 68, 68, 0.05)' : 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
                gridColumn: 'span 2'
              }}>
                <input type="radio" checked={resultat === 'annulee'} onChange={() => setResultat('annulee')} style={{ display: 'none' }} />
                <XCircle size={20} color={resultat === 'annulee' ? '#ef4444' : '#94a3b8'} strokeWidth={2.5} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: resultat === 'annulee' ? '#dc2626' : '#64748b' }}>Annuler la commande</span>
              </label>
            </div>
          </div>

          {resultat === 'validee' && (
            <div style={{ padding: '1.25rem', background: '#fdf4ff', borderRadius: '20px', border: '2px solid #f5d0fe', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ borderBottom: '1px solid #f5d0fe', paddingBottom: '0.75rem', marginBottom: '0.25rem' }}>
                <label className="form-label" style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', color: '#9d174d' }}>Programmation Livraison</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setDateLivraisonType('today')}
                    style={{ 
                      padding: '0.6rem', borderRadius: '12px', border: 'none', fontSize: '0.75rem', fontWeight: 700,
                      background: dateLivraisonType === 'today' ? '#9d174d' : 'white',
                      color: dateLivraisonType === 'today' ? 'white' : '#9d174d',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >Aujourd'hui</button>
                  <button 
                    type="button" 
                    onClick={() => setDateLivraisonType('tomorrow')}
                    style={{ 
                      padding: '0.6rem', borderRadius: '12px', border: 'none', fontSize: '0.75rem', fontWeight: 700,
                      background: dateLivraisonType === 'tomorrow' ? '#9d174d' : 'white',
                      color: dateLivraisonType === 'tomorrow' ? 'white' : '#9d174d',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >Demain</button>
                  <button 
                    type="button" 
                    onClick={() => setDateLivraisonType('custom')}
                    style={{ 
                      padding: '0.6rem', borderRadius: '12px', border: 'none', fontSize: '0.75rem', fontWeight: 700,
                      background: dateLivraisonType === 'custom' ? '#9d174d' : 'white',
                      color: dateLivraisonType === 'custom' ? 'white' : '#9d174d',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >Choisir date</button>
                </div>
                
                {dateLivraisonType === 'custom' && (
                  <input 
                    type="date" 
                    className="form-input" 
                    style={{ marginTop: '0.75rem', height: '40px', background: 'white' }} 
                    value={customDateValue}
                    onChange={e => setCustomDateValue(e.target.value)}
                    required={dateLivraisonType === 'custom'}
                  />
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>Zone de livraison finale</label>
                <select className="form-select" required value={communeLocal} onChange={e => handleCommuneChange(e.target.value)} style={{ background: 'white', height: '40px' }}>
                  <option value="">Sélectionner une commune...</option>
                  {communesDb.map(c => <option key={c.id} value={c.nom}>{c.nom} ({c.tarif_livraison} CFA)</option>)}
                  <option disabled style={{ color: '#94a3b8' }}>── Hors Abidjan ──</option>
                  <option value="Intérieur">🚌 Intérieur (Hors Abidjan) — Envoi Gare</option>
                  <option value="Autre">Autre (Zone non définie)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>Lieu exact (Confirmation)</label>
                <input type="text" className="form-input" required value={adresseLocal} onChange={e => setAdresseLocal(e.target.value)} style={{ background: 'white', height: '40px' }} />
              </div>
            </div>
          )}

          <div style={{ padding: '1.25rem', background: 'var(--primary)', borderRadius: '20px', color: 'white' }}>
             <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.9, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total à encaisser</div>
             <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>
               {Math.max(0, calculateSubtotal() + (Number(fraisLivraison) || 0) - (remiseType === 'fixe' ? (Number(remiseValue) || 0) : Math.round(calculateSubtotal() * (Number(remiseValue) || 0) / 100))).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span>
             </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
              {resultat === 'annulee' ? "Motif de l'annulation" : "Note d'appel"}
            </label>
            <textarea 
              className="form-input" 
              rows={2}
              required
              style={{ background: resultat === 'annulee' ? '#fff1f2' : '#f8fafc', borderRadius: '12px', padding: '0.75rem', border: resultat === 'annulee' ? '1px solid #fecaca' : '1px solid #e2e8f0' }}
              placeholder={resultat === 'annulee' ? "Indiquez clairement pourquoi le client annule..." : "Ex: Client confirmé, livraison OK pour demain matin..."}
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading} style={{ flex: 1, height: '48px', fontWeight: 700, borderRadius: '12px' }}>Abandonner</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2, height: '48px', fontWeight: 800, borderRadius: '12px' }}>
              {loading ? 'Traitement...' : 'Confirmer & Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  );
};
