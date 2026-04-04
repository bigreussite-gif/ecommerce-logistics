import { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, XCircle, MessageCircle, AlertCircle, Plus, Minus, Trash2, Search } from 'lucide-react';
import { updateCommandeStatus, updateCommandeLignesAndStock, logWhatsAppMessage } from '../../services/commandeService';
import { insforge } from '../../lib/insforge';
import { useAuth } from '../../contexts/AuthContext';
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
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState<AppelCommande['resultat_appel']>('validee');
  const [commentaire, setCommentaire] = useState('');
  const [fraisLivraison, setFraisLivraison] = useState<number | ''>(commande.frais_livraison || '');
  const [communeLocal, setCommuneLocal] = useState(commande.commune_livraison || '');
  const [adresseLocal, setAdresseLocal] = useState(commande.adresse_livraison || '');
  const [communesDb, setCommunesDb] = useState<Commune[]>([]);
  
  // Articles adjustment state
  const [lignesLocal, setLignesLocal] = useState<Partial<LigneCommande>[]>(commande.lignes || []);
  const [catalogue, setCatalogue] = useState<Produit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [waSentLocal, setWaSentLocal] = useState<{ type: string, date: string }[]>(commande.wa_sent || []);

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
    if (lignesLocal.length === 0) return alert("La commande doit contenir au moins un article.");
    
    setLoading(true);
    try {
      const subtotal = calculateSubtotal();
      const delivery = Number(fraisLivraison) || 0;
      const total = subtotal + delivery;

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
        commune_livraison: communeLocal,
        adresse_livraison: adresseLocal
      };

      if (resultat === 'validee') {
        payload.date_validation_appel = new Date();
      }

      if (resultat === 'annulee') {
        payload.notes = `[ANNULATION APPEL] Motif: ${commentaire}${commande.notes ? "\n--- Notes Précédentes ---\n" + commande.notes : ""}`;
      }

      if (resultat === 'echouee') {
        payload.notes = `[ECHEC LIVRAISON - RELANCE] Agent: ${commentaire}${commande.notes ? "\n--- Notes ---\n" + commande.notes : ""}`;
      }

      await updateCommandeStatus(commande.id, nextStatusMap[resultat], payload);
      onSave();
    } catch (error) {
      console.error("Erreur lors de la validation :", error);
    } finally {
      setLoading(false);
    }
  };

  const generateWhatsAppLink = () => {
    const nom = `*${commande.nom_client || 'Client'}*`;
    const ref = `*#${commande.id.slice(0, 8).toUpperCase()}*`;
    const articlesList = lignesLocal.map(l => ` - *${l.quantite}x ${l.nom_produit}*`).join('\n');
    const subtotal = calculateSubtotal();
    const delivery = Number(fraisLivraison) || Number(commande.frais_livraison) || 0;
    const total = subtotal + delivery;

    const bSubtotal = `*${subtotal.toLocaleString()} CFA*`;
    const bDelivery = `*${delivery > 0 ? delivery.toLocaleString() + " CFA" : "À définir"}*`;
    const bTotal = `*${total.toLocaleString()} CFA*`;

    const summary = `\n\n*Résumé de votre commande :*\n${articlesList}\n\n- Articles : ${bSubtotal}\n- Livraison : ${bDelivery}\n*Total à payer : ${bTotal}*`;

    let text = "";

    if (resultat === 'a_rappeler' || resultat === 'injoignable') {
      text = `Bonjour ${nom},\n\nNous n'avons pas pu effectuer votre livraison car nous n'avons pas pu vous joindre (soit par défaut du livreur ou votre contretemps).\n\nPouvons-nous s'il vous plaît relancer votre commande ${ref} pour le jour suivant ?${summary}`;
    } else if (resultat === 'annulee') {
      text = `Bonjour ${nom},\n\nNous avons pris note de l'annulation de votre commande ${ref}.\n\nPourriez-vous nous indiquer les motifs de cette annulation s'il vous plaît ? Souhaitez-vous vraiment maintenir l'annulation ?${summary}`;
    } else if (resultat === 'echouee') {
      text = `Bonjour ${nom},\n\nNous avons constaté un souci lors de la livraison de votre commande ${ref}.\n\nSouhaitez-vous que nous la reprogrammions pour demain ? Nous aimerions savoir si vous êtes toujours intéressé par vos articles :${summary}`;
    } else {
      // Default: Validation template
      let missingInfo = "";
      if (!commande.commune_livraison && !communeLocal) missingInfo += "- *Votre commune de livraison*\n";
      if (!commande.adresse_livraison && !adresseLocal) missingInfo += "- *Votre adresse exacte (lieu de livraison)*\n";

      text = `Bonjour ${nom},\n\nVotre commande ${ref} est bien enregistrée chez nous.\nSouhaitez-vous confirmer la livraison ?${summary}\n\n`;

      if (missingInfo) {
        text += `Pour finaliser l'expédition, merci de nous confirmer :\n${missingInfo}\n`;
      }
      text += "Merci de nous répondre pour confirmer la livraison.";
    }
    
    const signature = "\n\n*L'équipe Jachete Côte d'Ivoire*\nwww.jachete.ci\n+225 01 72 57 13 52 ,";
    text += signature;
    
    let phone = (commande.telephone_client || '').replace(/\D/g, '');
    if (phone.length === 10) phone = '225' + phone;
    
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const handleWhatsAppClick = async (type: string) => {
    try {
      await logWhatsAppMessage(commande.id, type);
      setWaSentLocal(prev => [...prev, { type, date: new Date().toISOString() }]);
    } catch (err) {
      console.error("Erreur log WA:", err);
    }
  };

  const isWASent = (type: string) => waSentLocal.some(s => s.type === type);

  const getWAType = () => {
    if (resultat === 'a_rappeler' || resultat === 'injoignable') return 'relance';
    if (resultat === 'annulee') return 'annulation';
    if (resultat === 'echouee') return 'echec';
    return 'validation';
  };

  const filteredCatalogue = searchTerm.length > 0 
    ? catalogue.filter(p => p.nom.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content card" style={{ maxWidth: '650px', padding: '2.5rem' }} onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: '1.5rem', 
            right: '1.5rem', 
            background: '#f1f5f9', 
            border: 'none', 
            borderRadius: '12px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer', 
            color: 'var(--text-muted)',
            transition: 'all 0.2s ease'
          }}
        >
          <X size={18} strokeWidth={2.5} />
        </button>
        
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="text-premium" style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Traitement d'Appel</h2>
          <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>Référence</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)', background: '#eaedff', padding: '0.2rem 0.6rem', borderRadius: '8px' }}>#{commande.id.slice(0, 8).toUpperCase()}</strong>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>{commande.nom_client || 'Client Anonyme'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>📞 {commande.telephone_client}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                  <span style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 700 }}>
                    Envoyé le {new Date(waSentLocal.find(s => s.type === getWAType())?.date || '').toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
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
            <div style={{ padding: '1.25rem', background: '#fdf4ff', borderRadius: '20px', border: '2px solid #f5d0fe', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>Zone de livraison finale</label>
                <select className="form-select" required value={communeLocal} onChange={e => handleCommuneChange(e.target.value)} style={{ background: 'white', height: '40px' }}>
                  <option value="">Sélectionner une commune...</option>
                  {communesDb.map(c => <option key={c.id} value={c.nom}>{c.nom} ({c.tarif_livraison} CFA)</option>)}
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
               {(calculateSubtotal() + (Number(fraisLivraison) || 0)).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span>
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
  );
};
