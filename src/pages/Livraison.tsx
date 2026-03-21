import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentFeuilleRoute, getCommandesForFeuille, markCommandeLivre, markCommandeEchouee } from '../services/livraisonService';
import type { Commande, FeuilleRoute } from '../types';
import { MapPin, CheckCircle, XCircle, Truck } from 'lucide-react';

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
      <div style={{ textAlign: 'center', padding: '8rem 2rem', animation: 'pageEnter 0.6s ease' }}>
        <div style={{ background: '#f8fafc', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#cbd5e1' }}>
          <Truck size={40} />
        </div>
        <h2 className="text-premium" style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.75rem' }}>Mes Livraisons</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '400px', margin: '0 auto', fontWeight: 500 }}>
          Aucune feuille de route active pour le moment. Reposez-vous ou contactez la logistique !
        </p>
      </div>
    );
  }

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>Ma Tournée</h1>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <div className="card glass-effect" style={{ padding: '0.75rem 1.25rem', border: '1px solid rgba(255,255,255,0.1)', flex: 1, minWidth: '180px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Objectif Encaiss.</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900 }}>{Number(feuille.total_montant_theorique).toLocaleString()} <span style={{ fontSize: '0.7rem' }}>CFA</span></div>
          </div>
          <div className="card glass-effect" style={{ padding: '0.75rem 1.25rem', border: '1px solid rgba(255,255,255,0.1)', flex: 1, minWidth: '180px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Colis à livrer</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900 }}>{commandes.length} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>unités</span></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {commandes.map(c => {
          const isDone = c.statut_commande === 'livree' || c.statut_commande === 'retour_livreur' || c.statut_commande === 'terminee';
          
          return (
            <div key={c.id} className="card" style={{ 
              opacity: isDone ? 0.7 : 1, 
              display: 'flex', 
              flexDirection: 'column',
              padding: '1.75rem',
              borderRadius: '24px',
              border: isDone ? '1px solid #f1f5f9' : '2px solid transparent',
              background: isDone ? '#f8fafc' : 'white',
              boxShadow: isDone ? 'none' : 'var(--shadow-premium)',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)' }}>{Number(c.montant_total).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span></span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.2rem' }}>CODE: #{c.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <div>
                  {(c.statut_commande === 'livree' || c.statut_commande === 'terminee') && <span className="badge badge-success" style={{ background: '#10b981', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '10px' }}>Livrée</span>}
                  {c.statut_commande === 'retour_livreur' && <span className="badge badge-danger" style={{ background: '#ef4444', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '10px' }}>Échec</span>}
                  {c.statut_commande === 'en_cours_livraison' && <div className="loading-spinner-small"></div>}
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                 <div style={{ fontWeight: 800, fontSize: '1.2rem', color: isDone ? 'var(--text-muted)' : 'var(--primary)', marginBottom: '0.4rem' }}>{c.nom_client || 'Client Privé'}</div>
                 <a href={`tel:${c.telephone_client}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99, 102, 255, 0.1)', padding: '0.5rem 1rem', borderRadius: '12px', color: 'var(--primary)', fontWeight: 800, textDecoration: 'none', fontSize: '1.1rem' }}>
                   📞 {c.telephone_client}
                 </a>
              </div>

              <div style={{ marginBottom: '1.5rem', flex: 1 }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#f8fafc', padding: '1rem', borderRadius: '16px' }}>
                  <MapPin size={20} style={{ color: 'var(--primary)', marginTop: '2px' }} strokeWidth={2.5} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>{c.commune_livraison}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '0.25rem', fontWeight: 500 }}>{c.adresse_livraison}</div>
                  </div>
                </div>
              </div>

              {!isDone && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 1.5, height: '52px', borderRadius: '14px', fontWeight: 800, boxShadow: '0 8px 15px -3px rgba(16, 185, 129, 0.3)', background: '#10b981' }}
                    onClick={() => { setSelectedCommande(c); setStatusAction('livree'); setModeForm(c.mode_paiement || 'Cash'); setNoteForm(''); }}
                  >
                    <CheckCircle size={20} strokeWidth={2.5} /> Livré
                  </button>
                  <button 
                    className="btn btn-outline" 
                    style={{ flex: 1, height: '52px', borderRadius: '14px', fontWeight: 800, color: '#ef4444', borderColor: '#fee2e2' }}
                    onClick={() => { setSelectedCommande(c); setStatusAction('retour_livreur'); setNoteForm(''); }}
                  >
                    <XCircle size={20} strokeWidth={2.5} /> Échec
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal Premium Mise à jour Statut */}
      {selectedCommande && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          backgroundColor: 'rgba(15, 23, 42, 0.7)', 
          backdropFilter: 'blur(8px)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000,
          padding: '1.5rem',
          animation: 'pageEnter 0.3s ease-out'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ marginBottom: '2rem', fontSize: '1.4rem', fontWeight: 800, textAlign: 'center', color: statusAction === 'livree' ? '#10b981' : '#ef4444' }}>
              {statusAction === 'livree' ? '🎉 Bravo ! Colis Livré' : '⚠️ Signalement d\'échec'}
            </h3>
            
            {statusAction === 'livree' && (
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Méthode d'encaissement</label>
                <select className="form-select" value={modeForm} onChange={e => setModeForm(e.target.value)} style={{ background: '#f8fafc', height: '48px', fontWeight: 600 }}>
                  <option value="Cash">Cash (Espèces)</option>
                  <option value="Mobile Money">Mobile Money (OM/Momo)</option>
                  <option value="Carte">Carte / Autre</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Note du terrain</label>
              <textarea 
                className="form-input" 
                rows={3} 
                required={statusAction === 'retour_livreur'}
                style={{ background: '#f8fafc', padding: '1rem', borderRadius: '16px' }}
                value={noteForm}
                onChange={e => setNoteForm(e.target.value)}
                placeholder={statusAction === 'retour_livreur' ? "Ex: Client injoignable après 3 tentatives..." : "Commentaire additionnel (facultatif)"}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
              <button className="btn btn-outline" onClick={() => setSelectedCommande(null)} style={{ flex: 1, height: '52px', borderRadius: '14px', fontWeight: 700 }}>Annuler</button>
              <button 
                className="btn btn-primary" 
                onClick={handleUpdate} 
                style={{ flex: 2, height: '52px', borderRadius: '14px', fontWeight: 800, background: statusAction === 'livree' ? '#10b981' : '#ef4444', boxShadow: statusAction === 'livree' ? '0 10px 15px -3px rgba(16, 185, 129, 0.4)' : '0 10px 15px -3px rgba(239, 68, 68, 0.4)' }}
              >
                Confirmer l'état
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
