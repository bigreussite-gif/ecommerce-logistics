import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentFeuilleRoute, getCommandesForFeuille, markCommandeLivre, markCommandeEchouee } from '../services/livraisonService';
import type { Commande, FeuilleRoute } from '../types';
import { MapPin, CheckCircle, XCircle } from 'lucide-react';

export const Livraison = () => {
  const { currentUser } = useAuth();
  const [feuille, setFeuille] = useState<FeuilleRoute | null>(null);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal specific
  const [selectedCommande, setSelectedCommande] = useState<Commande | null>(null);
  const [statusAction, setStatusAction] = useState<'livree' | 'retour_livreur'>('livree');
  const [noteForm, setNoteForm] = useState('');
  const [modeForm, setModeForm] = useState('');

  const fetchData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const route = await getCurrentFeuilleRoute(currentUser.id);
      if (route) {
        setFeuille(route);
        const cmds = await getCommandesForFeuille(route.id);
        setCommandes(cmds);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const handleUpdate = async () => {
    if (!selectedCommande) return;
    try {
      setLoading(true);
      if (statusAction === 'livree') {
        const montant = Number(selectedCommande.montant_total); // or any logic you want
        await markCommandeLivre(selectedCommande.id, montant, noteForm);
      } else {
        await markCommandeEchouee(selectedCommande.id, noteForm);
      }
      setSelectedCommande(null);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !selectedCommande) return <div style={{ padding: '2rem' }}>Chargement...</div>;

  if (!feuille) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Mes Livraisons</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Aucune feuille de route en cours ne vous est assignée aujourd'hui.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Feuille de Route du {new Date().toLocaleDateString()}</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
          {commandes.length} commandes à livrer - Valeur : {Number(feuille.total_montant_theorique).toLocaleString()} CFA
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {commandes.map(c => {
          const isDone = c.statut_commande === 'livree' || c.statut_commande === 'retour_livreur';
          
          return (
            <div key={c.id} className="card" style={{ opacity: isDone ? 0.6 : 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 600, fontSize: '1.125rem' }}>{Number(c.montant_total).toLocaleString()} CFA</span>
                {c.statut_commande === 'livree' && <span className="badge badge-success">Livrée</span>}
                {c.statut_commande === 'retour_livreur' && <span className="badge badge-danger">Retour</span>}
                {c.statut_commande === 'en_cours_livraison' && <span className="badge badge-info">En cours</span>}
              </div>

              <div style={{ marginBottom: '1rem', flex: 1 }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <MapPin size={16} style={{ color: 'var(--text-secondary)', marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{c.commune_livraison}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{c.adresse_livraison}</div>
                  </div>
                </div>
              </div>

              {!isDone && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    onClick={() => { setSelectedCommande(c); setStatusAction('livree'); setModeForm(c.mode_paiement); setNoteForm(''); }}
                  >
                    <CheckCircle size={16} /> Livré
                  </button>
                  <button 
                    className="btn btn-outline" 
                    style={{ flex: 1, color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                    onClick={() => { setSelectedCommande(c); setStatusAction('retour_livreur'); setNoteForm(''); }}
                  >
                    <XCircle size={16} /> Échec
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal Mise à jour Statut */}
      {selectedCommande && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1.5rem', color: statusAction === 'livree' ? 'var(--success-color)' : 'var(--danger-color)' }}>
              {statusAction === 'livree' ? 'Confirmer la Livraison' : 'Signaler un Échec'}
            </h3>
            
            {statusAction === 'livree' && (
              <div className="form-group">
                <label className="form-label">Mode d'encaissement</label>
                <select className="form-select" value={modeForm} onChange={e => setModeForm(e.target.value)}>
                  <option value="Cash">Cash (Espèces)</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Carte">Carte bancaire</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Note / Raison / Commentaire du terrain</label>
              <textarea 
                className="form-input" 
                rows={3} 
                required={statusAction === 'retour_livreur'}
                value={noteForm}
                onChange={e => setNoteForm(e.target.value)}
                placeholder={statusAction === 'retour_livreur' ? "Ex: Injoignable, Absent, Refusé..." : "Commentaire optionnel"}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setSelectedCommande(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleUpdate}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
