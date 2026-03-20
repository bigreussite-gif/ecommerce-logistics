import { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, XCircle } from 'lucide-react';
import { updateCommandeStatus } from '../../services/commandeService';
import { addItem } from '../../services/localDb';
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
      addItem('appels_commandes', {
        commande_id: commande.id,
        agent_appel_id: currentUser.id,
        date_appel: new Date(),
        resultat_appel: resultat,
        commentaire_agent: commentaire
      });

      // 2. Mettre à jour le statut de la commande
      const nextStatusMap: Record<string, string> = {
        'validee': 'validee',
        'a_rappeler': 'a_rappeler',
        'annulee': 'annulee',
        'injoignable': 'a_rappeler' // if unreachable, needs callback
      };
      
      const payload: any = { statut_commande: nextStatusMap[resultat] };
      if (resultat === 'validee') {
        payload.date_validation_appel = new Date();
        payload.commune_livraison = communeLocal;
        payload.adresse_livraison = adresseLocal;
        if (typeof fraisLivraison === 'number') {
          payload.frais_livraison = fraisLivraison;
          payload.montant_total = Number(commande.montant_total) + fraisLivraison;
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

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="card" style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <X size={20} />
        </button>
        
        <h2 style={{ marginBottom: '0.5rem' }}>Traitement Appel</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Commande <strong style={{ color: 'var(--text-primary)' }}>#{commande.id.slice(0, 5)}</strong> - {Number(commande.montant_total).toLocaleString()} CFA
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>
            📞 {commande.nom_client || 'Client'} - {commande.telephone_client || 'Sans numéro'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          
          <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <label style={{ 
              border: `1px solid ${resultat === 'validee' ? 'var(--success-color)' : 'var(--border-color)'}`, 
              borderRadius: 'var(--radius-md)', padding: '0.75rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
              backgroundColor: resultat === 'validee' ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
            }}>
              <input type="radio" checked={resultat === 'validee'} onChange={() => setResultat('validee')} style={{ display: 'none' }} />
              <CheckCircle size={24} color="var(--success-color)" />
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Valider</span>
            </label>
            
            <label style={{ 
              border: `1px solid ${resultat === 'a_rappeler' || resultat === 'injoignable' ? 'var(--warning-color)' : 'var(--border-color)'}`, 
              borderRadius: 'var(--radius-md)', padding: '0.75rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
              backgroundColor: resultat === 'a_rappeler' || resultat === 'injoignable' ? 'rgba(245, 158, 11, 0.05)' : 'transparent'
            }}>
              <input type="radio" checked={resultat === 'a_rappeler'} onChange={() => setResultat('a_rappeler')} style={{ display: 'none' }} />
              <Clock size={24} color="var(--warning-color)" />
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>À rappeler / Inj.</span>
            </label>

            <label style={{ 
              border: `1px solid ${resultat === 'annulee' ? 'var(--danger-color)' : 'var(--border-color)'}`, 
              borderRadius: 'var(--radius-md)', padding: '0.75rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
              backgroundColor: resultat === 'annulee' ? 'rgba(239, 68, 68, 0.05)' : 'transparent', gridColumn: 'span 2'
            }}>
              <input type="radio" checked={resultat === 'annulee'} onChange={() => setResultat('annulee')} style={{ display: 'none' }} />
              <XCircle size={24} color="var(--danger-color)" />
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Annuler la commande</span>
            </label>
          </div>

          {resultat === 'validee' && (
            <div style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: 0, color: 'var(--success-color)', fontSize: '0.875rem' }}>Confirmer l'adresse de livraison finale</h4>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Commune (Zone de livraison) *</label>
                <select className="form-select" required value={communeLocal} onChange={e => handleCommuneChange(e.target.value)}>
                  <option value="">Sélectionner une commune...</option>
                  {communesDb.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                  <option value="Autre">Autre (Hors zone config.)</option>
                </select>
                {communeLocal === 'Autre' && (
                  <input type="text" className="form-input" placeholder="Préciser la commune..." style={{ marginTop: '0.5rem' }} onChange={e => setCommuneLocal(e.target.value)} />
                )}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Lieu exact *</label>
                <input type="text" className="form-input" required value={adresseLocal} onChange={e => setAdresseLocal(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-sm)' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Frais de Livraison négociés (CFA)</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input type="number" className="form-input" style={{ width: '150px' }} placeholder="Ex: 2000" min="0" value={fraisLivraison} onChange={e => setFraisLivraison(e.target.value ? Number(e.target.value) : '')} />
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                    TOTAL À PAYER : {(Number(commande.montant_total) + (Number(fraisLivraison) || 0)).toLocaleString()} CFA
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Note / Résultat de l'appel *</label>
            <textarea 
              className="form-input" 
              rows={3}
              required
              placeholder="Détails de l'échange avec le client..."
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Fermer</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Validation...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
