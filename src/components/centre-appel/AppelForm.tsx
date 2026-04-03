import { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, XCircle, MessageCircle } from 'lucide-react';
import { updateCommandeStatus } from '../../services/commandeService';
import { insforge } from '../../lib/insforge';
import { useAuth } from '../../contexts/AuthContext';
import { getCommunes } from '../../services/adminService';
import type { Commande, AppelCommande, Commune } from '../../types';

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

  useEffect(() => {
    getCommunes().then(setCommunesDb);
  }, []);

  const handleCommuneChange = (nom: string) => {
    setCommuneLocal(nom);
    const selected = communesDb.find(c => c.nom === nom);
    if (selected) {
      setFraisLivraison(selected.tarif_livraison);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);
    try {
      // 1. Enregistrer l'appel dans l'historique
      await insforge.database
        .from('appels_commandes')
        .insert([{
          commande_id: commande.id,
          agent_appel_id: currentUser.id,
          date_appel: new Date(),
          resultat_appel: resultat,
          commentaire_agent: commentaire
        }]);

      // 2. Mettre à jour le statut de la commande
      const nextStatusMap: Record<string, string> = {
        'validee': 'validee',
        'a_rappeler': 'a_rappeler',
        'annulee': 'annulee',
        'injoignable': 'a_rappeler' // if unreachable, needs callback
      };
      
      const payload: any = { 
        statut_commande: nextStatusMap[resultat],
        agent_appel_id: currentUser.id 
      };
      if (resultat === 'validee') {
        payload.date_validation_appel = new Date();
        payload.commune_livraison = communeLocal;
        payload.adresse_livraison = adresseLocal;
        if (typeof fraisLivraison === 'number') {
          payload.frais_livraison = fraisLivraison;
          // Robust subtotal: always remove what's currently marked as delivery fee
          const currentFee = Number(commande.frais_livraison) || 0;
          const subtotal = Number(commande.montant_total) - currentFee;
          payload.montant_total = subtotal + fraisLivraison;
        }
      }

      await updateCommandeStatus(commande.id, nextStatusMap[resultat], payload);
      onSave();
    } catch (error) {
      console.error("Erreur lors de la validation :", error);
    } finally {
      setLoading(false);
    }
  };

  const currentSubtotal = Number(commande.montant_total) - (Number(commande.frais_livraison) || 0);

  const generateWhatsAppLink = () => {
    const nom = `*${commande.nom_client || 'Client'}*`;
    const ref = `*#${commande.id.slice(0, 8).toUpperCase()}*`;
    const articlesList = (commande.lignes || []).map(l => ` - *${l.quantite}x ${l.nom_produit}*`).join('\n');
    const subtotal = Number(commande.montant_total) - (Number(commande.frais_livraison) || 0);
    const delivery = Number(fraisLivraison) || Number(commande.frais_livraison) || 0;
    const total = subtotal + delivery;

    const bSubtotal = `*${subtotal.toLocaleString()} CFA*`;
    const bDelivery = `*${delivery > 0 ? delivery.toLocaleString() + " CFA" : "À définir"}*`;
    const bTotal = `*${total.toLocaleString()} CFA*`;

    let missingInfo = "";
    if (!commande.commune_livraison && !communeLocal) missingInfo += "- *Votre commune de livraison*\n";
    if (!commande.adresse_livraison && !adresseLocal) missingInfo += "- *Votre adresse exacte (lieu de livraison)*\n";

    let text = `Bonjour ${nom},\n\nVotre commande est bien enregistrée chez nous sous le numéro ${ref}.\nSouhaitez-vous confirmer la livraison ?\n\nDétails de votre commande :\n${articlesList}\n\n- Prix des articles : ${bSubtotal}\n- Frais de livraison : ${bDelivery}\nTotal à payer : ${bTotal}\n\n`;

    if (missingInfo) {
      text += `Pour finaliser l'expédition, merci de nous confirmer :\n${missingInfo}\n`;
    }

    text += "Merci de nous répondre pour confirmer la livraison.";
    
    let phone = (commande.telephone_client || '').replace(/\D/g, '');
    if (phone.length === 10) phone = '225' + phone;
    
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content card" style={{ maxWidth: '550px', padding: '2.5rem' }} onClick={e => e.stopPropagation()}>
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
        
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 className="text-premium" style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Traitement d'Appel</h2>
          <div style={{ marginTop: '1.25rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Référence Commande</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)', background: '#eaedff', padding: '0.2rem 0.6rem', borderRadius: '8px' }}>#{commande.id.slice(0, 8).toUpperCase()}</strong>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              {commande.nom_client || 'Client Anonyme'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ opacity: 0.7 }}>📞</span> {commande.telephone_client}
              </div>
              <a 
                href={generateWhatsAppLink()} 
                target="_blank" 
                rel="noopener noreferrer"
                title="Envoyer un message WhatsApp"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  padding: '0.4rem 0.8rem', 
                  background: '#25D366', 
                  color: 'white', 
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 10px rgba(37, 211, 102, 0.3)'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <MessageCircle size={14} fill="currentColor" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div>
            <label className="form-label" style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', display: 'block' }}>Résultat de l'échange</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label style={{ 
                border: `2px solid ${resultat === 'validee' ? 'var(--primary)' : '#e2e8f0'}`, 
                borderRadius: '16px', padding: '1rem', cursor: 'pointer', transition: 'all 0.3s ease',
                background: resultat === 'validee' ? 'rgba(99, 102, 255, 0.05)' : 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                boxShadow: resultat === 'validee' ? '0 10px 15px -3px rgba(99, 102, 255, 0.2)' : 'none'
              }}>
                <input type="radio" checked={resultat === 'validee'} onChange={() => setResultat('validee')} style={{ display: 'none' }} />
                <CheckCircle size={28} color={resultat === 'validee' ? 'var(--primary)' : '#94a3b8'} strokeWidth={2.5} />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: resultat === 'validee' ? 'var(--primary)' : '#64748b' }}>Valider</span>
              </label>
              
              <label style={{ 
                border: `2px solid ${resultat === 'a_rappeler' ? '#f59e0b' : '#e2e8f0'}`, 
                borderRadius: '16px', padding: '1rem', cursor: 'pointer', transition: 'all 0.3s ease',
                background: resultat === 'a_rappeler' ? 'rgba(245, 158, 11, 0.05)' : 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                boxShadow: resultat === 'a_rappeler' ? '0 10px 15px -3px rgba(245, 158, 11, 0.2)' : 'none'
              }}>
                <input type="radio" checked={resultat === 'a_rappeler'} onChange={() => setResultat('a_rappeler')} style={{ display: 'none' }} />
                <Clock size={28} color={resultat === 'a_rappeler' ? '#f59e0b' : '#94a3b8'} strokeWidth={2.5} />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: resultat === 'a_rappeler' ? '#d97706' : '#64748b' }}>À rappeler</span>
              </label>

              <label style={{ 
                border: `2px solid ${resultat === 'annulee' ? '#ef4444' : '#e2e8f0'}`, 
                borderRadius: '16px', padding: '1rem', cursor: 'pointer', transition: 'all 0.3s ease',
                background: resultat === 'annulee' ? 'rgba(239, 68, 68, 0.05)' : 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                gridColumn: 'span 2',
                boxShadow: resultat === 'annulee' ? '0 10px 15px -3px rgba(239, 68, 68, 0.2)' : 'none'
              }}>
                <input type="radio" checked={resultat === 'annulee'} onChange={() => setResultat('annulee')} style={{ display: 'none' }} />
                <XCircle size={28} color={resultat === 'annulee' ? '#ef4444' : '#94a3b8'} strokeWidth={2.5} />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: resultat === 'annulee' ? '#dc2626' : '#64748b' }}>Annuler la commande</span>
              </label>
            </div>
          </div>

          {resultat === 'validee' && (
            <div style={{ padding: '1.5rem', background: '#fdf4ff', borderRadius: '20px', border: '2px solid #f5d0fe', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Zone de livraison finale</label>
                <select className="form-select" required value={communeLocal} onChange={e => handleCommuneChange(e.target.value)} style={{ background: 'white', height: '44px' }}>
                  <option value="">Sélectionner une commune...</option>
                  {communesDb.map(c => <option key={c.id} value={c.nom}>{c.nom} ({c.tarif_livraison} CFA)</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Lieu exact (Confirmation)</label>
                <input type="text" className="form-input" required value={adresseLocal} onChange={e => setAdresseLocal(e.target.value)} style={{ background: 'white', height: '44px' }} />
              </div>
              <div style={{ padding: '1.25rem', background: 'white', borderRadius: '16px', border: '1px solid #f0abfc' }}>
                 <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Montant total à encaisser</div>
                 <div className="brand-glow" style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary)' }}>
                   {(currentSubtotal + (Number(fraisLivraison) || 0)).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span>
                 </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>Note d'appel</label>
            <textarea 
              className="form-input" 
              rows={3}
              required
              style={{ background: '#f8fafc', borderRadius: '16px', padding: '1rem' }}
              placeholder="Ex: Client confirmé, livraison OK pour demain matin..."
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading} style={{ flex: 1, height: '52px', fontWeight: 700, borderRadius: '14px' }}>Abandonner</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2, height: '52px', fontWeight: 800, borderRadius: '14px', boxShadow: '0 10px 15px -3px rgba(99, 102, 255, 0.4)' }}>
              {loading ? 'Traitement...' : 'Enregistrer le résultat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
