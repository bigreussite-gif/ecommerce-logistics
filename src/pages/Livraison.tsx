import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentFeuilleRoute, getCommandesForFeuille, markCommandeLivre, markCommandeEchouee } from '../services/livraisonService';
import type { Commande, FeuilleRoute } from '../types';
import { 
  MapPin, CheckCircle, XCircle, Truck, 
  Phone, MessageCircle, ExternalLink, Eye 
} from 'lucide-react';
import { CommandeDetails } from '../components/commandes/CommandeDetails';

export const Livraison = () => {
  const { currentUser } = useAuth();
  const [feuille, setFeuille] = useState<FeuilleRoute | null>(null);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal specific
  const [selectedCommande, setSelectedCommande] = useState<Commande | null>(null);
  const [selectedViewOrderId, setSelectedViewOrderId] = useState<string | null>(null);
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

  const totalEncaiss = commandes.filter(c => ['livree', 'terminee'].includes(c.statut_commande)).reduce((acc, c) => acc + (Number(c.montant_encaisse) || 0), 0);
  const totalObjectif = Number(feuille.total_montant_theorique) || 0;
  const progressPercent = commandes.length > 0 ? Math.round((commandes.filter(c => ['livree', 'retour_livreur', 'terminee'].includes(c.statut_commande)).length / commandes.length) * 100) : 0;

  return (
    <div style={{ animation: 'pageEnter 0.6s ease', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="text-premium" style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>Ma Tournée</h1>
            <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem' }}>Feuille #{feuille.id.slice(-6).toUpperCase()}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)' }}>{progressPercent}%</span>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Progression</div>
          </div>
        </div>

        <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '2rem', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--primary)', transition: 'width 1s ease' }} />
        </div>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
          <div className="card glass-effect" style={{ padding: '1.25rem', border: 'none', background: 'white' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Objectif</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{totalObjectif.toLocaleString()} <span style={{ fontSize: '0.7rem' }}>CFA</span></div>
          </div>
          <div className="card glass-effect" style={{ padding: '1.25rem', border: 'none', background: 'var(--primary)', color: 'white' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.8, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Récolté</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{totalEncaiss.toLocaleString()} <span style={{ fontSize: '0.7rem' }}>CFA</span></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr' }}>
        {commandes.map(c => {
          const isDone = ['livree', 'retour_livreur', 'terminee'].includes(c.statut_commande);
          const itemCount = (c.lignes || []).reduce((acc: number, l: any) => acc + l.quantite, 0);

          return (
            <div key={c.id} className="card" style={{ 
              opacity: isDone ? 0.6 : 1, 
              padding: '1.5rem',
              borderRadius: '24px',
              border: isDone ? '1px solid #f1f5f9' : '1px solid #e2e8f0',
              background: isDone ? '#f8fafc' : 'white',
              boxShadow: isDone ? 'none' : '0 10px 20px -5px rgba(0,0,0,0.05)',
              marginBottom: '0.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div>
                   <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-main)' }}>{Number(c.montant_total).toLocaleString()} <span style={{ fontSize: '0.75rem' }}>CFA</span></div>
                   <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                     <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>#{c.id.slice(-6).toUpperCase()}</span>
                     <span className="badge" style={{ fontSize: '0.65rem', background: '#f1f5f9', color: 'var(--text-muted)' }}>{itemCount} art.</span>
                   </div>
                </div>
                <button 
                  className="btn btn-outline" 
                   style={{ padding: '0.6rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                   onClick={() => setSelectedViewOrderId(c.id)}
                >
                  <Eye size={18} />
                </button>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                 <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.75rem' }}>{c.nom_client}</div>
                 <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <a href={`tel:${c.telephone_client}`} className="btn" style={{ flex: 1, padding: '0.6rem', borderRadius: '12px', background: 'rgba(99, 102, 255, 0.1)', color: 'var(--primary)', justifyContent: 'center' }}>
                      <Phone size={18} />
                    </a>
                    <a 
                      href={`https://wa.me/${c.telephone_client?.replace(/\s/g, '')}?text=${encodeURIComponent(`Bonjour ${c.nom_client}, c'est votre livreur GomboSwift. Je suis en route pour votre commande de ${c.montant_total} CFA. Serez-vous disponible ?`)}`}
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn" 
                      style={{ flex: 1, padding: '0.6rem', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', justifyContent: 'center' }}
                    >
                      <MessageCircle size={18} />
                    </a>
                 </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <MapPin size={16} style={{ color: 'var(--primary)', marginTop: '2px' }} />
                      <div>
                         <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{c.commune_livraison}</div>
                         <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.1rem' }}>{c.adresse_livraison}</div>
                      </div>
                    </div>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.adresse_livraison}, ${c.commune_livraison}`)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn" 
                      style={{ padding: '0.4rem', borderRadius: '8px', background: 'white', border: '1px solid #e2e8f0' }}
                    >
                      <ExternalLink size={14} />
                    </a>
                 </div>
              </div>

              {!isDone ? (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 2, height: '48px', borderRadius: '14px', background: '#10b981', fontWeight: 800 }}
                    onClick={() => { setSelectedCommande(c); setStatusAction('livree'); setModeForm(c.mode_paiement || 'Cash'); setNoteForm(''); }}
                  >
                    Confirmer Livraison
                  </button>
                  <button 
                    className="btn btn-outline" 
                    style={{ flex: 1, height: '48px', borderRadius: '14px', color: '#ef4444', borderColor: '#fee2e2' }}
                    onClick={() => { setSelectedCommande(c); setStatusAction('retour_livreur'); setNoteForm(''); }}
                  >
                    Échec
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: c.statut_commande === 'livree' ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: '0.85rem' }}>
                   {c.statut_commande === 'livree' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                   {c.statut_commande === 'livree' ? 'Livraison Confirmée' : 'Échec de Livraison'}
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
      {selectedViewOrderId && (
        <CommandeDetails 
          commandeId={selectedViewOrderId} 
          onClose={() => setSelectedViewOrderId(null)} 
        />
      )}
    </div>
  );
};
