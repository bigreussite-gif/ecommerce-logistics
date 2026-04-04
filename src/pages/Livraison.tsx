import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentFeuilleRoute, getCommandesForFeuille, markCommandeLivre, markCommandeEchouee } from '../services/livraisonService';
import type { Commande, FeuilleRoute } from '../types';
import { 
  MapPin, CheckCircle, XCircle, Truck, 
  Phone, MessageCircle, Eye,
  Search, User, Clock, ChevronRight
} from 'lucide-react';
import { CommandeDetails } from '../components/commandes/CommandeDetails';
import { getFeuillesEnCours } from '../services/caisseService';

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
  
  // Admin view
  const [allActiveFeuilles, setAllActiveFeuilles] = useState<FeuilleRoute[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      if (currentUser.role === 'ADMIN' || currentUser.role === 'LOGISTIQUE') {
        const active = await getFeuillesEnCours(''); // Empty string for all
        setAllActiveFeuilles(active);
      } else {
        const route = await getCurrentFeuilleRoute(currentUser.id);
        if (route) {
          setFeuille(route);
          const cmds = await getCommandesForFeuille(route.id);
          setCommandes(cmds);
        }
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

  if (currentUser?.role === 'ADMIN' || currentUser?.role === 'LOGISTIQUE') {
    return (
      <div style={{ animation: 'pageEnter 0.6s ease', paddingBottom: '4rem' }}>
        <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0 }}>Supervision Logistique</h1>
            <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '1rem', marginTop: '0.4rem' }}>
              Suivi des tournées en temps réel ({allActiveFeuilles.length})
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', background: 'white', padding: '0.6rem 1.2rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-premium)' }}>
             <Search size={20} color="#94a3b8" />
             <input 
               type="text" 
               placeholder="Rechercher un livreur..." 
               style={{ border: 'none', outline: 'none', fontWeight: 600, fontSize: '0.9rem', width: '200px' }} 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
             />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
          {allActiveFeuilles
            .filter(f => (f.nom_livreur || f.livreur_id).toLowerCase().includes(searchQuery.toLowerCase()))
            .map(f => (
              <div 
                key={f.id} 
                className="card glass-effect" 
                style={{ padding: '0', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid #e2e8f0' }}
                onClick={async () => {
                  setLoading(true);
                  setFeuille(f);
                  const cmds = await getCommandesForFeuille(f.id);
                  setCommandes(cmds);
                  setLoading(false);
                }}
              >
                <div style={{ padding: '1.5rem', background: f.statut_feuille === 'en_cours' ? 'var(--primary)' : '#1e293b', color: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={20} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>{f.nom_livreur || `Livreur #${f.livreur_id.slice(0,5)}`}</h4>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '0.50rem', marginTop: '0.1rem' }}>
                           <Clock size={12} /> Route #{f.id.slice(-4).toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.7rem' }}>
                      {f.statut_feuille === 'en_cours' ? 'Sur le terrain' : 'En attente caisse'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.1rem' }}>
                    <span>{f.total_montant_theorique.toLocaleString()} F</span>
                    <span>{f.total_commandes} Colis</span>
                  </div>
                </div>

                <div style={{ padding: '1.5rem' }}>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      {f.communes_couvertes.map(c => (
                        <span key={c} style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.65rem', padding: '0.3rem 0.6rem', borderRadius: '6px', fontWeight: 800 }}>{c}</span>
                      ))}
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Cliquer pour auditer la tournée</span>
                      <ChevronRight size={20} color="#cbd5e1" />
                   </div>
                </div>
              </div>
          ))}
        </div>

        {/* Floating Detail View for Admin */}
        {feuille && (
           <div style={{ 
             position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, padding: '2rem', display: 'flex', justifyContent: 'center', overflow: 'auto', backdropFilter: 'blur(10px)'
           }} onClick={() => setFeuille(null)}>
              <div style={{ width: '100%', maxWidth: '900px', height: 'fit-content' }} onClick={e => e.stopPropagation()}>
                <div style={{ background: 'white', borderRadius: '32px', padding: '2rem' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                      <h2 style={{ margin: 0, fontWeight: 900 }}>Tournée de {feuille.nom_livreur}</h2>
                      <button className="btn btn-outline" onClick={() => setFeuille(null)}><XCircle /> Fermer</button>
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                      {commandes.map(c => (
                        <div key={c.id} className="card" style={{ padding: '1rem', border: '1px solid #f1f5f9' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ fontWeight: 800 }}>{c.nom_client}</span>
                              <span className={`badge ${c.statut_commande === 'livree' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.6rem' }}>{c.statut_commande}</span>
                           </div>
                           <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.adresse_livraison}</div>
                           <div style={{ marginTop: '1rem', fontWeight: 900 }}>{c.montant_total.toLocaleString()} F</div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
           </div>
        )}
      </div>
    );
  }

  // REGULAR COURIER VIEW (Refactored)
  return (
    <div style={{ animation: 'pageEnter 0.6s ease', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
          <div>
            <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 950, margin: 0 }}>Ma Tournée</h1>
            <p style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '1rem', marginTop: '0.4rem' }}>Optimisée pour aujourd'hui</p>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ background: 'var(--primary-light)', padding: '0.5rem 1rem', borderRadius: '14px', color: 'var(--primary)', fontWeight: 900, fontSize: '1.2rem' }}>
               {progressPercent}%
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '0.4rem', textTransform: 'uppercase' }}>Objectif rempli</span>
          </div>
        </div>

        <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '6px', marginBottom: '1.5rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, #8b5cf6 100%)', borderRadius: '6px', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </div>

        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="card glass-effect" style={{ padding: '1.5rem', border: 'none', background: 'white', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>À Collecter</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 950, color: 'var(--text-main)' }}>{totalObjectif.toLocaleString()} <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>F</span></div>
          </div>
          <div className="card glass-effect" style={{ padding: '1.5rem', border: 'none', background: '#10b981', color: 'white', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.9, textTransform: 'uppercase' }}>Déjà Encaissé</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 950 }}>{totalEncaiss.toLocaleString()} <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>F</span></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr' }}>
        {commandes.map(c => {
          const isDone = ['livree', 'retour_livreur', 'terminee'].includes(c.statut_commande);
          const itemCount = (c.lignes || []).reduce((acc: number, l: any) => acc + l.quantite, 0);

          return (
            <div key={c.id} className="card" style={{ 
              opacity: isDone ? 0.7 : 1, 
              padding: '1.5rem',
              borderRadius: '28px',
              border: isDone ? '1px solid #f1f5f9' : '1px solid #e2e8f0',
              background: isDone ? '#f8fafc' : 'white',
              boxShadow: isDone ? 'none' : '0 15px 35px -10px rgba(0,0,0,0.08)',
              marginBottom: '0.75rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {!isDone && (
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '4px', background: 'var(--primary)' }} />
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                   <div style={{ fontSize: '1.6rem', fontWeight: 950, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{Number(c.montant_total).toLocaleString()} <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>CFA</span></div>
                   <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.3rem' }}>
                     <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>CMD-#{c.id.slice(-6).toUpperCase()}</span>
                     <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }} />
                     <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)' }}>{itemCount} article{itemCount > 1 ? 's' : ''}</span>
                   </div>
                </div>
                <button 
                  className="btn btn-outline" 
                   style={{ width: '48px', height: '48px', borderRadius: '16px', border: '1px solid #f1f5f9', padding: 0, justifyContent: 'center' }}
                   onClick={() => setSelectedViewOrderId(c.id)}
                >
                  <Eye size={22} color="#64748b" />
                </button>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                 <div style={{ fontWeight: 900, fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-main)' }}>{c.nom_client}</div>
                 <div style={{ display: 'flex', gap: '1rem' }}>
                    <a href={`tel:${c.telephone_client}`} className="btn" style={{ flex: 1, height: '54px', borderRadius: '16px', background: '#f0f9ff', color: '#0ea5e9', justifyContent: 'center', gap: '0.75rem', fontWeight: 800 }}>
                      <Phone size={20} /> Appeler
                    </a>
                    <a 
                      href={`https://wa.me/${c.telephone_client?.replace(/\s/g, '')}?text=${encodeURIComponent(`Bonjour ${c.nom_client}, c'est votre livreur GomboSwift 🛵. Je suis en route pour votre livraison de ${c.montant_total} CFA. Serez-vous disponible d'ici 15 minutes ?`)}`}
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn" 
                      style={{ flex: 1, height: '54px', borderRadius: '16px', background: '#f0fdf4', color: '#22c55e', justifyContent: 'center', gap: '0.75rem', fontWeight: 800 }}
                    >
                      <MessageCircle size={20} /> WhatsApp
                    </a>
                 </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '20px', marginBottom: '2rem', border: '1px solid #f1f5f9' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ background: 'white', padding: '0.5rem', height: '32px', width: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <MapPin size={18} color="var(--primary)" />
                      </div>
                      <div>
                         <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text-main)' }}>{c.commune_livraison}</div>
                         <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.2rem', lineHeight: '1.4' }}>{c.adresse_livraison}</div>
                      </div>
                    </div>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.adresse_livraison}, ${c.commune_livraison}`)}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn" 
                      style={{ height: '40px', padding: '0 1rem', borderRadius: '10px', background: 'white', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: '0.8rem', gap: '0.5rem' }}
                    >
                      Waze/Maps
                    </a>
                 </div>
              </div>

              {!isDone ? (
                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 2, height: '60px', borderRadius: '18px', background: '#10b981', fontWeight: 900, fontSize: '1rem', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}
                    onClick={() => { setSelectedCommande(c); setStatusAction('livree'); setModeForm(c.mode_paiement || 'Cash'); setNoteForm(''); }}
                  >
                    Confirmer Livraison
                  </button>
                  <button 
                    className="btn btn-outline" 
                    style={{ flex: 1, height: '60px', borderRadius: '18px', color: '#ef4444', borderColor: '#fee2e2', fontWeight: 700 }}
                    onClick={() => { setSelectedCommande(c); setStatusAction('retour_livreur'); setNoteForm(''); }}
                  >
                    Échec
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', background: c.statut_commande === 'livree' ? '#f0fdf4' : '#fef2f2', borderRadius: '16px' }}>
                   <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', color: c.statut_commande === 'livree' ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                      {c.statut_commande === 'livree' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                      {c.statut_commande === 'livree' ? 'Livraison Terminée' : 'Signalé en Échec'}
                   </div>
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>STATUT FINAL</div>
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
