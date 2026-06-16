import { useState, useEffect } from 'react';
import { getCommandesByStatus } from '../services/commandeService';
import { getAvailableLivreurs, creerFeuilleRoute, getFeuillesRoute, getCommandesByFeuille, supprimerFeuilleRoute, updateLivreurFeuilleRoute } from '../services/logistiqueService';
import type { Commande, User, FeuilleRoute } from '../types';
import { Truck, Printer, Eye, Clock, Trash2, Edit3, Check, X } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { generateDeliverySlipPDF } from '../services/pdfService';
import { format } from 'date-fns';
import { CommandeDetails } from '../components/commandes/CommandeDetails';

export const Logistique = () => {
  const { showToast } = useToast();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [livreurs, setLivreurs] = useState<User[]>([]);
  const [activeFeuilles, setActiveFeuilles] = useState<FeuilleRoute[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCommands, setSelectedCommands] = useState<Set<string>>(new Set());
  const [selectedLivreur, setSelectedLivreur] = useState<string>('');
  const [selectedCommandeId, setSelectedCommandeId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('');

  const [editingFeuilleId, setEditingFeuilleId] = useState<string | null>(null);
  const [editLivreurId, setEditLivreurId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  const availableZones = Array.from(new Set(commandes.map(c => c.commune_livraison).filter(Boolean))).sort();
  const filteredCommandes = selectedZone 
    ? commandes.filter(c => c.commune_livraison === selectedZone)
    : commandes;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cmds, livs, allFeuilles] = await Promise.all([
        getCommandesByStatus(['validee', 'a_rappeler']),
        getAvailableLivreurs(),
        getFeuillesRoute()
      ]);
      setCommandes(cmds);
      setLivreurs(livs);
      
      const enCours = (allFeuilles || [])
        .filter((f: any) => f.statut_feuille === 'en_cours')
        .map((f: any) => ({
          ...f,
          nom_livreur: f.users?.nom_complet || f.nom_livreur
        }));
      setActiveFeuilles(enCours);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleCommand = (id: string) => {
    const newSet = new Set(selectedCommands);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedCommands(newSet);
  };

  const handleGenerateFeuille = async () => {
    if (!selectedLivreur) return showToast("Sélectionnez un livreur.", "error");
    if (selectedCommands.size === 0) return showToast("Sélectionnez au moins une commande.", "error");

    const selectedFullCommandes = commandes.filter(c => selectedCommands.has(c.id));
    const commandesSansArticles = selectedFullCommandes.filter((c: any) => !c.lignes || c.lignes.length === 0);
    
    if (commandesSansArticles.length > 0) {
      return showToast(`Impossible : ${commandesSansArticles.length} commande(s) sélectionnée(s) n'ont aucun article. Veuillez d'abord leur ajouter des articles.`, "error");
    }

    try {
      setLoading(true);
      const feuilleId = await creerFeuilleRoute(selectedLivreur, Array.from(selectedCommands));
      
      if (!feuilleId) {
        throw new Error("L'identifiant de la feuille de route est manquant après la création.");
      }

      // Auto-generate PDF
      const selectedFullCommandes = commandes.filter(c => selectedCommands.has(c.id));
      const livreurName = livreurs.find(l => l.id === selectedLivreur)?.nom_complet || "Livreur";
      
      try {
        generateDeliverySlipPDF({ id: feuilleId, nom_livreur: livreurName }, selectedFullCommandes);
      } catch (pdfErr) {
        console.error("Erreur PDF:", pdfErr);
        showToast("Feuille créée, mais erreur lors de la génération du PDF. Vous pouvez le réimprimer depuis l'historique.", "info");
      }

      showToast("Feuille de route générée avec succès !", "success");
      setSelectedCommands(new Set());
      setSelectedLivreur('');
      fetchData();
    } catch (error: any) {
      console.error("Détails de l'erreur Logistique:", error);
      const message = error.message || "Une erreur inattendue est survenue.";
      showToast(`Échec de la génération : ${message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ position: 'relative', minHeight: '100vh', padding: '1rem', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 1.5rem' }}></div>
        <p style={{ fontWeight: 700, color: '#64748b' }}>Chargement des données logistiques...</p>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', minHeight: '100vh', padding: '1rem', background: '#f8fafc' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', animation: 'pageEnter 0.6s ease' }}>

      {/* ZONE A: HEADER */}
      <section style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.5rem' }}>
              <div style={{ padding: '0.8rem', background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', borderRadius: '18px', color: 'white', boxShadow: '0 10px 20px rgba(99, 102, 255, 0.2)' }}>
                <Truck size={28} />
              </div>
              <h1 style={{ fontSize: '2.2rem', fontWeight: 950, margin: 0, letterSpacing: '-0.02em', color: '#1e293b' }}>Logistique & Affectation</h1>
            </div>
            <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Optimisez vos tournées et affectez vos colis aux livreurs disponibles.</p>
          </div>
        </div>
      </section>

      {/* ZONE B: STATS */}
      <section style={{ marginBottom: '3rem' }}>
        <div className="res-grid" style={{ gap: '1.5rem' }}>
          {[
            { label: 'À Affecter', value: commandes.length, color: 'var(--primary)', icon: <Truck size={22} />, desc: 'Commandes validées' },
            { label: 'Livreurs Actifs', value: livreurs.length, color: '#10b981', icon: <Clock size={22} />, desc: 'Disponibles' },
            { label: 'Sélectionnées', value: selectedCommands.size, color: '#f59e0b', icon: <Printer size={22} />, desc: 'En cours de sélection' },
            { label: 'Tournées en cours', value: activeFeuilles.length, color: '#6366f1', icon: <Clock size={22} />, desc: 'Feuilles actives' },
          ].map((item, idx) => (
            <div key={idx} className="card" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: `${item.color}10`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e293b', lineHeight: 1 }}>{item.value}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginTop: '0.25rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: item.color, marginTop: '0.2rem', textTransform: 'uppercase' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="res-grid" style={{ alignItems: 'start', gridTemplateColumns: 'minmax(0, 2fr) 350px' }}>
        
        {/* LISTE DES COMMANDES */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
              Commandes Disponibles
              <span style={{ marginLeft: '1rem', padding: '0.2rem 0.6rem', background: 'rgba(99, 102, 255, 0.1)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--primary)' }}>
                {filteredCommandes.length} flux
              </span>
            </h3>
            
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <select 
                className="form-select" 
                style={{ width: 'auto', minWidth: '180px', height: '36px', padding: '0 1rem', fontSize: '0.85rem', borderRadius: '10px' }}
                value={selectedZone}
                onChange={e => setSelectedZone(e.target.value)}
              >
                <option value="">Toutes les zones</option>
                {availableZones.map(zone => (
                  <option key={zone as string} value={zone as string}>{zone as string}</option>
                ))}
              </select>

              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                {selectedCommands.size} sélectionnée(s)
              </div>
            </div>
          </div>

          <div className="table-container table-to-cards">
            <div className="table-container">
<table style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead className="mobile-hide">
                <tr>
                  <th style={{ width: '60px', minWidth: '60px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input 
                        type="checkbox" 
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCommands(new Set([...selectedCommands, ...filteredCommandes.map(c => c.id)]));
                          } else {
                            const newSet = new Set(selectedCommands);
                            filteredCommandes.forEach(c => newSet.delete(c.id));
                            setSelectedCommands(newSet);
                          }
                        }}
                        checked={filteredCommandes.length > 0 && filteredCommandes.every(c => selectedCommands.has(c.id))}
                      />
                    </div>
                  </th>
                  <th style={{ width: '35%' }}>Client & Contact</th>
                  <th style={{ width: '35%' }}>Zone & Destination</th>
                  <th style={{ textAlign: 'right', width: '30%' }}>Valeur</th>
                </tr>
              </thead>
              <tbody>
                {filteredCommandes.map(c => (
                  <tr 
                    key={c.id} 
                    onClick={() => toggleCommand(c.id)} 
                    style={{ 
                      cursor: 'pointer', 
                      transition: 'all 0.2s ease',
                      backgroundColor: selectedCommands.has(c.id) ? 'rgba(99, 102, 255, 0.03)' : 'transparent' 
                    }}
                  >
                    <td data-label="Sélection">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input 
                          type="checkbox" 
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          checked={selectedCommands.has(c.id)}
                          onChange={() => toggleCommand(c.id)}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </td>
                    <td data-label="Client">
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.nom_client || `Client #${(c.client_id || '').slice(0,5)}`}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>{c.telephone_client}</div>
                    </td>
                    <td data-label="Zone">
                      <span className="badge badge-info" style={{ fontWeight: 700, padding: '0.3rem 0.7rem' }}>{c.commune_livraison}</span>
                      <div className="mobile-hide" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontStyle: 'italic' }}>{c.adresse_livraison?.slice(0, 40)}</div>
                    </td>
                    <td data-label="Valeur" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800 }}>{Number(c.montant_total).toLocaleString()} CFA</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(c.lignes || []).length} art.</div>
                        </div>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.5rem', borderRadius: '10px', border: '1px solid #e2e8f0', width: 'auto' }}
                          onClick={(e) => { e.stopPropagation(); setSelectedCommandeId(c.id); }}
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCommandes.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                      <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Tout est à jour !</p>
                      <p style={{ fontSize: '0.9rem' }}>Aucune commande en attente pour cette sélection.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
</div>
          </div>
        </div>

        {/* PANNEAU DE CONTRÔLE AFFECTATION */}
        <div className="card glass-effect" style={{ height: 'max-content', padding: '2rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Printer size={16} strokeWidth={2.5} />
            </div>
            Affectation Livreur
          </h3>
          
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>Choisir un agent de livraison</label>
            <select className="form-select" style={{ height: '48px', fontWeight: 600 }} value={selectedLivreur} onChange={e => setSelectedLivreur(e.target.value)}>
              <option value="">Sélectionner un livreur...</option>
              {livreurs.map(l => (
                <option key={l.id} value={l.id}>{l.nom_complet} (Actif)</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem' }}>Colis à charger :</span>
              <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{selectedCommands.size}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem' }}>Valeur Marchande :</span>
              <span className="brand-glow" style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--primary)' }}>
                {commandes.filter(c => selectedCommands.has(c.id)).reduce((a,c)=>a+Number(c.montant_total), 0).toLocaleString()} <span style={{ fontSize: '0.75rem' }}>CFA</span>
              </span>
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '2rem', height: '56px', borderRadius: '16px', fontWeight: 800, fontSize: '1rem', boxShadow: '0 10px 15px -3px rgba(99, 102, 255, 0.3)' }}
            disabled={loading || selectedCommands.size === 0 || !selectedLivreur}
            onClick={handleGenerateFeuille}
          >
            <Printer size={20} strokeWidth={2.5} style={{ marginRight: '0.5rem' }} />
            Générer Feuille de Route
          </button>
          
          <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            L'affectation notifiera instantanément le livreur sur son application mobile.
          </p>
        </div>

        {/* TOURNEES EN COURS (DEJA CREEES) */}
        {activeFeuilles.length > 0 && (
          <div className="card glass-effect" style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.8)' }}>
             <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Clock size={20} color="var(--primary)" />
                Tournées en cours ({activeFeuilles.length})
             </h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activeFeuilles.map(f => (
                  <div key={f.id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '16px', background: 'white' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                           <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>#{(f.id || '').slice(0, 8).toUpperCase()}</div>
                           {editingFeuilleId === f.id ? (
                             <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                               <select 
                                 className="form-select form-select-sm" 
                                 value={editLivreurId} 
                                 onChange={e => setEditLivreurId(e.target.value)}
                                 style={{ padding: '0.2rem 1.5rem 0.2rem 0.5rem', fontSize: '0.8rem', height: '28px' }}
                               >
                                 <option value="">Sélectionner...</option>
                                 {livreurs.map(l => (
                                   <option key={l.id} value={l.id}>{l.nom_complet}</option>
                                 ))}
                               </select>
                               <button 
                                 className="btn btn-primary btn-sm" 
                                 style={{ padding: '0.2rem 0.4rem', height: '28px' }}
                                 disabled={actionLoading || !editLivreurId || editLivreurId === f.livreur_id}
                                 onClick={async () => {
                                   try {
                                     setActionLoading(true);
                                     await updateLivreurFeuilleRoute(f.id, editLivreurId);
                                     showToast("Livreur mis à jour avec succès", "success");
                                     setEditingFeuilleId(null);
                                     fetchData();
                                   } catch (e: any) {
                                     showToast(`Erreur : ${e.message}`, "error");
                                   } finally {
                                     setActionLoading(false);
                                   }
                                 }}
                               >
                                 <Check size={14} />
                               </button>
                               <button 
                                 className="btn btn-outline btn-sm" 
                                 style={{ padding: '0.2rem 0.4rem', height: '28px' }}
                                 onClick={() => setEditingFeuilleId(null)}
                               >
                                 <X size={14} />
                               </button>
                             </div>
                           ) : (
                             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{f.nom_livreur}</div>
                           )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.4rem', borderRadius: '8px' }}
                            title="Modifier le livreur"
                            onClick={() => {
                              setEditingFeuilleId(f.id);
                              setEditLivreurId(f.livreur_id || '');
                            }}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.4rem', borderRadius: '8px' }}
                            title="Réimprimer"
                            onClick={async () => {
                              try {
                                const cmds = await getCommandesByFeuille(f.id);
                                generateDeliverySlipPDF(f, cmds);
                                showToast("Réimpression lancée.", "success");
                              } catch (e) {
                                showToast("Erreur lors de la réimpression", "error");
                              }
                            }}
                          >
                            <Printer size={16} />
                          </button>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.4rem', borderRadius: '8px', color: '#ef4444', borderColor: '#fee2e2' }}
                            title="Supprimer la feuille de route"
                            disabled={actionLoading}
                            onClick={async () => {
                              if (!window.confirm('Voulez-vous vraiment supprimer cette feuille de route ? Les commandes redeviendront "À affecter".')) return;
                              try {
                                setActionLoading(true);
                                await supprimerFeuilleRoute(f.id);
                                showToast("Feuille de route supprimée", "success");
                                fetchData();
                              } catch (e: any) {
                                showToast(`Erreur: ${e.message}`, "error");
                              } finally {
                                setActionLoading(false);
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)' }}>
                        <span>{f.total_commandes} colis</span>
                        <span>{format(new Date(f.date), 'HH:mm')}</span>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

      </div>

      {selectedCommandeId && (
        <CommandeDetails 
          commandeId={selectedCommandeId} 
          onClose={() => setSelectedCommandeId(null)} 
        />
      )}
      </div>{/* end maxWidth */}
      <style>{`
        @keyframes pageEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .res-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
      `}</style>
    </div>
  );
};
