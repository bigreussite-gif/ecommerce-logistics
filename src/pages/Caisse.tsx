import { useState, useEffect } from 'react';
import { getAvailableLivreurs } from '../services/logistiqueService';
import { getFeuillesEnCours, getCommandesConcernees, processCaisse } from '../services/caisseService';
import { insforge } from '../lib/insforge';
import type { User, Commande, FeuilleRoute } from '../types';
import { Calculator, CheckCircle2, ChevronRight, Plus, Search, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CommandeDetails } from '../components/commandes/CommandeDetails';

export const Caisse = () => {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [livreurs, setLivreurs] = useState<User[]>([]);
  const [selectedLivreur, setSelectedLivreur] = useState<string>('');
  const [feuilles, setFeuilles] = useState<FeuilleRoute[]>([]);
  
  const [feuille, setFeuille] = useState<FeuilleRoute | null>(null);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, { statut: string, mode_paiement: string }>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [extraSearch, setExtraSearch] = useState('');

  // Form State
  const [montantRemisStr, setMontantRemisStr] = useState<string>('');
  const [commentaire, setCommentaire] = useState('');

  useEffect(() => {
    getAvailableLivreurs().then(setLivreurs);
  }, []);

  const loadLivreur = async (livreurId: string) => {
    setSelectedLivreur(livreurId);
    setFeuille(null);
    setCommandes([]);
    setResolutions({});
    if (!livreurId) {
      setFeuilles([]);
      return;
    }
    setLoading(true);
    try {
      const fs = await getFeuillesEnCours(livreurId);
      setFeuilles(fs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadFeuille = async (f: FeuilleRoute) => {
    setFeuille(f);
    setLoading(true);
    try {
      const cmds = await getCommandesConcernees(f.id);
      setCommandes(cmds);
      
      const newRes: any = {};
      cmds.forEach(c => {
        let statutInit = c.statut_commande;
        if (statutInit === 'en_cours_livraison' || statutInit === 'validee') statutInit = 'livree';
        
        newRes[c.id] = {
           statut: statutInit,
           mode_paiement: c.mode_paiement || 'Cash à la livraison'
        };
      });
      setResolutions(newRes);
      
      setMontantRemisStr('');
      setCommentaire('');
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExtraOrder = async () => {
    if (!extraSearch || !feuille) return;
    
    // Clean search string (could be #ID... or just ID)
    const cleanId = extraSearch.trim().replace('#', '').toLowerCase();
    
    // Check if already in list
    if (commandes.find(c => c.id.toLowerCase().includes(cleanId) || cleanId.includes(c.id.toLowerCase()))) {
      showToast("Cette commande est déjà dans la liste.", "info");
      return;
    }

    setLoading(true);
    try {
      // Find the command by partial ID or full ID
      const { data: results } = await insforge.database
        .from('commandes')
        .select('*, clients(nom_complet, telephone)')
        .or(`id.ilike.%${cleanId}%`)
        .limit(1);

      if (!results || results.length === 0) {
        showToast("Aucune commande trouvée avec cette référence.", "error");
        return;
      }

      const cmd = results[0];
      const fullCmd = {
        ...cmd,
        nom_client: cmd.clients?.nom_complet,
        telephone_client: cmd.clients?.telephone
      };

      // 1. Assign to current sheet in DB
      await insforge.database
        .from('commandes')
        .update({ 
          feuille_route_id: feuille.id, 
          livreur_id: selectedLivreur,
          statut_commande: 'en_cours_livraison' 
        })
        .eq('id', cmd.id);

      // 2. Add to local state
      setCommandes(prev => [...prev, fullCmd]);
      setResolutions(prev => ({
        ...prev,
        [cmd.id]: {
          statut: 'livree',
          mode_paiement: 'Cash à la livraison'
        }
      }));

      setExtraSearch('');
      showToast(`Commande #${cmd.id.slice(0,8)} ajoutée à la tournée.`, "success");

    } catch (e) {
      showToast("Erreur lors de l'ajout.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllAsDelivered = () => {
    const newRes = { ...resolutions };
    commandes.forEach(c => {
      newRes[c.id] = {
        statut: 'livree',
        mode_paiement: c.mode_paiement || 'Cash à la livraison'
      };
    });
    setResolutions(newRes);
    showToast("Toutes les commandes ont été marquées comme encaissées.", "success");
  };

  const getMontantCashAttendu = () => {
    try {
      return commandes
        .filter(c => resolutions[c.id]?.statut === 'livree' && ['Cash à la livraison', 'Cash'].includes(resolutions[c.id]?.mode_paiement || ''))
        .reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0);
    } catch(e) { return 0; }
  };
  
  const getMontantMobileMoney = () => {
    try {
      return commandes
        .filter(c => resolutions[c.id]?.statut === 'livree' && !['Cash à la livraison', 'Cash'].includes(resolutions[c.id]?.mode_paiement || ''))
        .reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0);
    } catch(e) { return 0; }
  };

  const updateResolution = (id: string, key: string, value: string) => {
    setResolutions(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const montantAttendu = Number(getMontantCashAttendu()) || 0;
  const montantMobileMoney = Number(getMontantMobileMoney()) || 0;
  const montantRemisParsed = isNaN(parseFloat(montantRemisStr)) ? 0 : parseFloat(montantRemisStr);
  const isMontantValide = montantRemisStr.trim() !== '';
  const ecart = isMontantValide ? montantRemisParsed - montantAttendu : 0;

  const handleCloture = async () => {
    if (!feuille || !isMontantValide) return;
    
    const resArray = Object.keys(resolutions).map(id => ({
       id,
       statut: resolutions[id].statut,
       mode_paiement: resolutions[id].mode_paiement
    }));

    setLoading(true);
    try {
      if (!currentUser?.id) throw new Error("Identifiant caissière introuvable.");
      if (!selectedLivreur) throw new Error("Identifiant livreur introuvable.");

      await processCaisse(
        feuille.id, 
        resArray, 
        montantRemisParsed, 
        ecart, 
        commentaire,
        currentUser.id,
        selectedLivreur
      );
      
      showToast("Feuille de route clôturée avec succès.", "success");
      
      // Redirect to history to avoid "blank" state
      setTimeout(() => {
        navigate('/historique');
      }, 1000);
    } catch (error: any) {
      console.error("Erreur Clôture Caisse:", error);
      const msg = error?.message || "Erreur inconnue";
      showToast(`Échec de la clôture : ${msg}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>Point de Retour & Caisse</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>Saisie des retours agents et clôture financière certifiée.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2.5rem', alignItems: 'start' }}>
        
        {/* ETAPE 1 & 2: SELECTION */}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div className="card glass-effect" style={{ flex: 1, minWidth: '350px', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>1</span>
              Sélection du Livreur
            </h3>
            <select className="form-select" style={{ height: '52px', fontWeight: 700, fontSize: '1.05rem' }} value={selectedLivreur} onChange={(e) => loadLivreur(e.target.value)}>
              <option value="">Renseignez l'agent...</option>
              {livreurs.map(l => (
                <option key={l.id} value={l.id}>{l.nom_complet}</option>
              ))}
            </select>
          </div>

          {(selectedLivreur && (!feuille)) && (
            <div className="card glass-effect" style={{ flex: 1.5, minWidth: '350px', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>2</span>
                Choisir une feuille active
              </h3>
               {feuilles.length === 0 ? (
                 <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '20px', border: '2px dashed #e2e8f0' }}>
                   <p style={{ color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>Aucune feuille de route en cours trouvée.</p>
                 </div>
               ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                   {feuilles.map(f => (
                     <div 
                       key={f.id} 
                       style={{ 
                         display: 'flex', 
                         justifyContent: 'space-between', 
                         alignItems: 'center', 
                         padding: '1.25rem 1.5rem', 
                         border: '1px solid #e2e8f0', 
                         borderRadius: '20px', 
                         cursor: 'pointer', 
                         backgroundColor: 'white',
                         transition: 'all 0.2s ease',
                         boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                       }} 
                       onClick={() => loadFeuille(f)}
                       className="hover-card"
                     >
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1.1rem' }}>Feuille #{f.id.slice(0, 8).toUpperCase()}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.2rem' }}>
                            {format(new Date(f.date), 'dd MMMM yyyy à HH:mm')} • {f.total_commandes} Colis
                          </div>
                        </div>
                        <ChevronRight size={24} style={{ color: 'var(--primary)' }}/>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}
        </div>

        {/* ETAPE 3: RECONCILIATION */}
        {feuille && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 400px', gap: '2.5rem', alignItems: 'start' }} className="responsive-grid">
            
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                    Contrôle des encaissements
                    <span style={{ marginLeft: '1rem', padding: '0.2rem 0.6rem', background: 'rgba(99, 102, 255, 0.1)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--primary)' }}>
                      #{feuille.id.slice(0, 8).toUpperCase()}
                    </span>
                  </h3>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ borderRadius: '12px', height: '40px', fontWeight: 700, fontSize: '0.85rem' }} 
                      onClick={handleMarkAllAsDelivered}
                    >
                      Tout marquer : Livré ✅
                    </button>
                    <button className="btn btn-outline" style={{ borderRadius: '12px', height: '40px', fontWeight: 700, fontSize: '0.85rem' }} onClick={() => setFeuille(null)}>Changer de feuille</button>
                  </div>
              </div>

              {/* RESTOCK SUMMARY */}
              {Object.values(resolutions).some(r => r.statut === 'retour_livreur') && (
                <div style={{ padding: '1rem 2.5rem', background: '#fff1f2', borderBottom: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                   <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div>
                   <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#991b1b' }}>
                     {Object.values(resolutions).filter(r => r.statut === 'retour_livreur').length} colis à réintégrer en stock après clôture.
                   </span>
                </div>
              )}

              {/* QUICK ADD EXTRA ORDERS */}
              <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid #f1f5f9', background: '#fffef0', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                 <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ajouter un colis hors-bordereau (Ref #...)"
                      style={{ paddingLeft: '2.75rem', height: '44px', borderRadius: '12px', border: '2px solid #fef3c7' }}
                      value={extraSearch}
                      onChange={e => setExtraSearch(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleAddExtraOrder()}
                    />
                 </div>
                 <button className="btn btn-secondary" style={{ height: '44px', borderRadius: '12px', padding: '0 1.5rem', fontWeight: 800, whiteSpace: 'nowrap' }} onClick={handleAddExtraOrder}>
                    <Plus size={18} style={{ marginRight: '0.5rem' }} /> Ajouter
                 </button>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Colis</th>
                      <th>Client / Zone</th>
                      <th style={{ textAlign: 'right' }}>Dû</th>
                      <th>Statut Final</th>
                      <th>Paiement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commandes.map(c => (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                              onClick={() => setSelectedOrderId(c.id)}
                            >
                              <Eye size={14} />
                            </button>
                            <span style={{ fontWeight: 800, color: 'var(--text-muted)' }}>#{c.id.slice(0, 5).toUpperCase()}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{c.nom_client || `Anonyme`}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{c.commune_livraison}</div>
                        </td>
                        <td style={{ fontWeight: 900, textAlign: 'right', fontSize: '1.05rem' }}>{Number(c.montant_total).toLocaleString()}</td>
                        <td>
                          <select 
                            className="form-select" 
                            style={{ 
                              padding: '0.4rem 0.75rem', 
                              borderRadius: '10px',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              backgroundColor: resolutions[c.id]?.statut === 'livree' ? '#dcfce7' : resolutions[c.id]?.statut === 'retour_livreur' ? '#fee2e2' :resolutions[c.id]?.statut === 'a_rappeler' ? '#fef3c7' : '#f3f4f6',
                              border: 'none'
                            }}
                            value={resolutions[c.id]?.statut || 'retour_livreur'}
                            onChange={(e) => updateResolution(c.id, 'statut', e.target.value)}
                          >
                            <option value="livree">Encaissé ✅</option>
                            <option value="retour_livreur">Retour 🔙</option>
                            <option value="a_rappeler">Reprog. 🔄</option>
                            <option value="annulee">Annulé ❌</option>
                          </select>
                        </td>
                        <td>
                          {resolutions[c.id]?.statut === 'livree' ? (
                            <select 
                              className="form-select" 
                              style={{ padding: '0.4rem 0.75rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700 }}
                              value={resolutions[c.id]?.mode_paiement}
                              onChange={(e) => updateResolution(c.id, 'mode_paiement', e.target.value)}
                            >
                              <option value="Cash à la livraison">CASH</option>
                              <option value="Mobile Money">MOBILE</option>
                              <option value="Carte">AUTRE</option>
                            </select>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PANNEAU DE RECONCILIATION FINANCIERE */}
            <div className="card glass-effect" style={{ border: '2px solid var(--primary)', padding: '1.5rem', borderRadius: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calculator size={24} strokeWidth={2.5} />
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Calculateur</h3>
              </div>
              
              <div style={{ marginBottom: '2rem', padding: '1.75rem', background: '#f1f5f9', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attendu en Cash :</span>
                  <span className="brand-glow" style={{ fontWeight: 900, fontSize: '1.6rem', color: 'var(--primary)' }}>{montantAttendu.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>Mobile Money (Digital) :</span>
                  <span style={{ fontWeight: 800, color: '#64748b' }}>{montantMobileMoney.toLocaleString()} <span style={{ fontSize: '0.7rem' }}>CFA</span></span>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)', opacity: 0.9 }}>Total Cash Reçu *</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="0"
                    placeholder="Saisir le montant..."
                    style={{ 
                      fontSize: '1.6rem', 
                      fontWeight: 800, 
                      padding: '0.75rem', 
                      textAlign: 'center', 
                      height: '64px', 
                      borderRadius: '16px', 
                      border: '2px solid #e2e8f0', 
                      color: 'var(--primary)',
                      background: 'rgba(255,255,255,0.6)',
                      width: '100%'
                    }}
                    value={montantRemisStr}
                    onChange={e => setMontantRemisStr(e.target.value)}
                  />
                  <div style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#94a3b8', fontSize: '1rem' }}>CFA</div>
                </div>
              </div>

              {isMontantValide && (
                <div style={{ 
                  padding: '1.75rem', borderRadius: '24px', marginBottom: '2rem', marginTop: '1.5rem',
                  backgroundColor: ecart === 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                  border: `2px solid ${ecart === 0 ? '#10b981' : '#ef4444'}`,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: ecart === 0 ? '#059669' : '#dc2626', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Écart de caisse final</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: ecart === 0 ? '#10b981' : '#ef4444' }}>
                    {ecart > 0 ? '+' : ''}{ecart.toLocaleString()} <span style={{ fontSize: '1rem' }}>CFA</span>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Note d'explication (Si écart)</label>
                <textarea 
                  className="form-input" 
                  rows={2} 
                  style={{ borderRadius: '16px', padding: '1rem', background: '#f8fafc' }}
                  value={commentaire}
                  onChange={e => setCommentaire(e.target.value)}
                  placeholder="Justifiez toute différence de centime..."
                />
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', height: '70px', fontSize: '1.2rem', fontWeight: 900, marginTop: '1rem', borderRadius: '20px', boxShadow: '0 15px 25px -5px rgba(99, 102, 255, 0.4)', letterSpacing: '0.02em' }}
                disabled={loading || !isMontantValide}
                onClick={handleCloture}
              >
                {loading ? 'SCELLEMENT...' : <><CheckCircle2 size={28} strokeWidth={2.5} style={{ marginRight: '0.75rem' }} /> CLÔTURER LA SESSION</>}
              </button>
              
              <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: '1.4' }}>
                 Attention : Cette action est irréversible et scellera les données financières de cette feuille de route.
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedOrderId && (
        <CommandeDetails 
          commandeId={selectedOrderId} 
          onClose={() => setSelectedOrderId(null)} 
        />
      )}
    </div>
  );
};
