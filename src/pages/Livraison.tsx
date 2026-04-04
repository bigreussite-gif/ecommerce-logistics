import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  const [selectedFeuilleId, setSelectedFeuilleId] = useState<string | null>(null);

  const lastFetchedIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchData = useCallback(async (forcedId?: string) => {
    if (!currentUser || isFetchingRef.current) return;
    
    const targetId = forcedId || selectedFeuilleId;
    
    // Prevent redundant fetching if nothing changed
    if (targetId && targetId === lastFetchedIdRef.current && !forcedId) return;

    isFetchingRef.current = true;
    setLoading(true);
    try {
      if (currentUser.role === 'ADMIN' || currentUser.role === 'LOGISTIQUE') {
        const active = await getFeuillesEnCours(''); 
        setAllActiveFeuilles(active);
        
        let currentId = targetId;
        if (active.length > 0 && !currentId) {
          currentId = active[0].id;
          setSelectedFeuilleId(currentId);
        }

        if (currentId) {
          lastFetchedIdRef.current = currentId;
          const [cmds, found] = await Promise.all([
            getCommandesForFeuille(currentId),
            Promise.resolve(active.find(f => f.id === currentId))
          ]);
          setCommandes(cmds);
          if (found) setFeuille(found);
        }
      } else {
        const currentLog = await getCurrentFeuilleRoute(currentUser.id);
        setFeuille(currentLog);
        if (currentLog) {
          const cmds = await getCommandesForFeuille(currentLog.id);
          setCommandes(cmds);
        }
      }
    } catch (error) {
      console.error("Livraison Fetch Error:", error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [currentUser, selectedFeuilleId]);

  useEffect(() => {
    fetchData();
  }, [currentUser?.id, selectedFeuilleId, fetchData]); 

  const handleUpdate = async () => {
    if (!selectedCommande) return;
    try {
      setLoading(true);
      if (statusAction === 'livree') {
        const montant = Number(selectedCommande.montant_total);
        await markCommandeLivre(selectedCommande.id, montant, noteForm);
      } else {
        await markCommandeEchouee(selectedCommande.id, noteForm);
      }
      setSelectedCommande(null);
      await fetchData(); // Refresh current state after update
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !selectedCommande) return <div style={{ padding: '2rem' }}>Chargement...</div>;

  const adminStats = useMemo(() => {
    if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'LOGISTIQUE') return null;
    const totalObjectif = allActiveFeuilles.reduce((acc, f) => acc + (f.total_montant_theorique || 0), 0);
    const totalCommandes = allActiveFeuilles.reduce((acc, f) => acc + (f.total_commandes || 0), 0);
    const inProgress = allActiveFeuilles.filter(f => f.statut_feuille === 'en_cours').length;
    const waitingCaisse = allActiveFeuilles.filter(f => f.statut_feuille === 'cloturee').length;
    
    return { totalObjectif, totalCommandes, inProgress, waitingCaisse };
  }, [allActiveFeuilles, currentUser]);

  const filteredFeuilles = useMemo(() => {
    return allActiveFeuilles.filter(f => 
      (f.nom_livreur || f.livreur_id || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allActiveFeuilles, searchQuery]);

  if (loading && !selectedCommande && !feuille && allActiveFeuilles.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1.5rem', animation: 'pulse 2s infinite' }}>
       <div className="loading-spinner"></div>
       <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Initialisation du centre de contrôle logistique...</p>
    </div>
  );

  if (!feuille && (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'LOGISTIQUE')) {
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

  const totalEncaiss = commandes.filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase())).reduce((acc, c) => acc + (Number(c.montant_encaisse) || 0), 0);
  const totalObjectif = Number(feuille?.total_montant_theorique) || 0;
  const progressPercent = commandes.length > 0 ? Math.round((commandes.filter(c => ['livree', 'retour_livreur', 'terminee'].includes(c.statut_commande?.toLowerCase())).length / commandes.length) * 100) : 0;

  if (currentUser?.role === 'ADMIN' || currentUser?.role === 'LOGISTIQUE') {
    return (
      <div style={{ animation: 'pageEnter 0.6s ease', paddingBottom: '4rem' }}>
        <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0 }}>Supervision Logistique</h1>
            <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '1rem', marginTop: '0.4rem' }}>
              Pilotage des tournées et flux financiers en temps réel.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', background: 'white', padding: '0.8rem 1.5rem', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-premium)', width: '100%', maxWidth: '400px' }}>
             <Search size={22} color="#94a3b8" />
             <input 
               type="text" 
               placeholder="Rechercher un livreur ou un secteur..." 
               style={{ border: 'none', outline: 'none', fontWeight: 600, fontSize: '1rem', width: '100%', background: 'transparent' }} 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
             />
          </div>
        </div>

        {/* ADMIN GLOBAL STATS */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '1.5rem', 
          marginBottom: '3rem' 
        }}>
          {[
            { label: 'Argent sur le terrain', value: adminStats?.totalObjectif?.toLocaleString() + ' F', color: 'var(--primary)', icon: <Truck size={24} /> },
            { label: 'Colis en circulation', value: adminStats?.totalCommandes, color: '#6366f1', icon: <Eye size={24} /> },
            { label: 'Tournées actives', value: adminStats?.inProgress, color: '#f59e0b', icon: <Clock size={24} /> },
            { label: 'Prêt pour Caisse', value: adminStats?.waitingCaisse, color: '#10b981', icon: <CheckCircle size={24} /> }
          ].map((item, idx) => (
            <div key={idx} className="card glass-effect" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid white', boxShadow: 'var(--shadow-premium)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                 <div style={{ background: `${item.color}15`, color: item.color, padding: '0.6rem', borderRadius: '12px' }}>{item.icon}</div>
               </div>
               <div style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '0.2rem' }}>{item.value}</div>
               <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{item.label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '2rem' }}>
           <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <button className="badge" style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800, border: 'none' }}>Toutes les tournées ({filteredFeuilles.length})</button>
           </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '2rem' }}>
          {filteredFeuilles.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem', background: '#f8fafc', borderRadius: '32px', color: '#94a3b8' }}>
               <Truck size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
               <p style={{ fontWeight: 800 }}>Aucune tournée trouvée pour votre recherche.</p>
            </div>
          ) : filteredFeuilles.map(f => (
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
                        <h4 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem' }}>{f.nom_livreur || `Livreur #${f.livreur_id.slice(0,5)}`}</h4>
                        <div style={{ fontSize: '0.8rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.50rem', marginTop: '0.2rem', fontWeight: 600 }}>
                           <Clock size={12} /> Route #{f.id.slice(-4).toUpperCase()} • {new Date(f.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </div>
                      </div>
                    </div>
                    <span className="badge" style={{ background: f.statut_feuille === 'cloturee' ? '#10b981' : 'rgba(255,255,255,0.25)', color: 'white', fontSize: '0.75rem', padding: '0.4rem 0.8rem', borderRadius: '10px', fontWeight: 800 }}>
                      {f.statut_feuille === 'en_cours' ? '🛵 Sur le terrain' : '💰 Prêt Caisse'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 950, fontSize: '1.3rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.2rem' }}>Objectif</span>
                       <span>{f.total_montant_theorique.toLocaleString()} F</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                       <span style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.2rem' }}>Volume</span>
                       <span>{f.total_commandes} Colis</span>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.5rem' }}>
                   <div style={{ marginBottom: f.communes_couvertes?.length > 0 ? '1.5rem' : '0.5rem' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Zones d'activité</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {f.communes_couvertes?.map(c => (
                          <span key={c} style={{ background: '#f1f5f9', color: '#1e293b', fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '10px', fontWeight: 800 }}>{c}</span>
                        )) || <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.8rem' }}>Aucune zone spécifiée</span>}
                      </div>
                   </div>
                   
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                         <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: f.statut_feuille === 'en_cours' ? '#f59e0b' : '#10b981' }}></div>
                         <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Audit temps réel</span>
                      </div>
                      <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                         Voir Détails <ChevronRight size={18} />
                      </div>
                   </div>
                </div>
              </div>
          ))}
        </div>

        {/* Floating Detail View for Admin - OVERHAULED */}
        {feuille && (
           <div style={{ 
             position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', zIndex: 1000, padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(12px)', animation: 'fadeIn 0.3s ease'
           }} onClick={() => setFeuille(null)}>
              <div style={{ width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <div style={{ background: 'white', borderRadius: '32px', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                   {/* Modal Header */}
                   <div style={{ padding: '2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '32px 32px 0 0' }}>
                      <div>
                        <h2 style={{ margin: 0, fontWeight: 950, fontSize: '1.6rem', color: 'var(--text-main)' }}>Tournée de {feuille.nom_livreur}</h2>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                           <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)' }}>#{feuille.id.slice(0, 8).toUpperCase()}</span>
                           <span className="badge badge-primary">{commandes.length} commandes</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setFeuille(null)} 
                        style={{ border: 'none', background: 'white', width: '44px', height: '44px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', color: '#64748b' }}
                      >
                        <XCircle size={24} />
                      </button>
                   </div>

                   {/* Modal Body */}
                   <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                        {commandes.map(c => {
                          const status = c.statut_commande?.toLowerCase();
                          const isDone = ['livree', 'terminee', 'echouee', 'retour_livreur', 'retour_stock'].includes(status);
                          const isSuccess = ['livree', 'terminee'].includes(status);
                          
                          return (
                            <div 
                              key={c.id} 
                              className="card" 
                              style={{ 
                                padding: '1.5rem', 
                                border: '1px solid #f1f5f9',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                position: 'relative'
                              }}
                              onClick={() => setSelectedViewOrderId(c.id)}
                              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                  <div style={{ fontWeight: 900, color: 'var(--text-main)', fontSize: '1.05rem' }}>{c.nom_client}</div>
                                  <span className={`badge ${isSuccess ? 'badge-success' : isDone ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                                    {status === 'livree' || status === 'terminee' ? 'LIVRÉE' : status?.replace(/_/g, ' ')?.toUpperCase()}
                                  </span>
                               </div>
                               
                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                                  <MapPin size={14} /> {c.commune_livraison}
                               </div>

                               <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontSize: '1.1rem', fontWeight: 950, color: 'var(--primary)' }}>{Number(c.montant_total).toLocaleString()} F</div>
                                  {isDone && (
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                                       {isSuccess ? '✅ ENCAISSÉ' : '❌ ÉCHEC'}
                                    </div>
                                  )}
                               </div>
                            </div>
                          );
                        })}
                      </div>
                   </div>

                   {/* Modal Footer */}
                   <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', borderRadius: '0 0 32px 32px' }}>
                      <div style={{ display: 'flex', gap: '2rem' }}>
                         <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Collecté</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>{commandes.filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase())).reduce((acc, c) => acc + (c.montant_encaisse || c.montant_total), 0).toLocaleString()} F</div>
                         </div>
                         <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Taux Succès</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)' }}>
                              {commandes.length > 0 ? Math.round((commandes.filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase())).length / commandes.length) * 100) : 0}%
                            </div>
                         </div>
                      </div>
                      <button className="btn btn-primary" onClick={() => setFeuille(null)} style={{ padding: '0 2rem', borderRadius: '14px', height: '48px', fontWeight: 800 }}>Terminer l'Audit</button>
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
