import { useState, useEffect } from 'react';
import { getAvailableLivreurs } from '../services/logistiqueService';
import { getFeuillesEnCours, getCommandesConcernees, processCaisse } from '../services/caisseService';
import type { User, Commande, FeuilleRoute } from '../types';
import { Calculator, CheckCircle2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../contexts/ToastContext';

export const Caisse = () => {
  const { showToast } = useToast();
  const [livreurs, setLivreurs] = useState<User[]>([]);
  const [selectedLivreur, setSelectedLivreur] = useState<string>('');
  const [feuilles, setFeuilles] = useState<FeuilleRoute[]>([]);
  
  const [feuille, setFeuille] = useState<FeuilleRoute | null>(null);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, { statut: string, mode_paiement: string }>>({});

  const [loading, setLoading] = useState(false);

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
        if (statutInit === 'en_cours_livraison') statutInit = 'retour_livreur';
        
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
      await processCaisse(feuille.id, resArray, montantRemisParsed, ecart, commentaire);
      showToast("Feuille de route clôturée avec succès.", "success");
      setFeuille(null);
      setCommandes([]);
      setSelectedLivreur('');
      setFeuilles([]);
      setMontantRemisStr('');
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la clôture.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Point de Retour / Caisse</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Saisie des retours papier et clôture financière de la journée.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', alignItems: 'start' }}>
        
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: 1, minWidth: '300px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>1. Sélection du Livreur</h3>
            <select className="form-select" value={selectedLivreur} onChange={(e) => loadLivreur(e.target.value)}>
              <option value="">-- Renseignez un livreur --</option>
              {livreurs.map(l => (
                <option key={l.id} value={l.id}>{l.nom_complet}</option>
              ))}
            </select>
          </div>

          {(selectedLivreur && (!feuille)) && (
            <div className="card" style={{ flex: 2, minWidth: '300px' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>2. Choisissez une feuille en cours</h3>
               {feuilles.length === 0 ? (
                 <p style={{ color: 'var(--text-secondary)' }}>Ce livreur n'a aucune feuille de route en cours.</p>
               ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                   {feuilles.map(f => (
                     <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', backgroundColor: 'var(--bg-color)' }} onClick={() => loadFeuille(f)}>
                        <div>
                          <div style={{ fontWeight: 'bold' }}>Feuille #{f.id.slice(0, 5)}</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{format(new Date(f.date), 'dd/MM/yyyy HH:mm')} - {f.total_commandes} Colis</div>
                        </div>
                        <ChevronRight size={20} style={{ color: 'var(--primary-color)' }}/>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}
        </div>

        {feuille && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                 <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Cocher les résultats (Fiche #{feuille.id.slice(0,5)})</h3>
                 <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} onClick={() => setFeuille(null)}>Annuler / Revenir</button>
              </div>

              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: '700px' }}>
                  <thead>
                    <tr>
                      <th>Ref. Colis</th>
                      <th>Client (Commune)</th>
                      <th>Montant</th>
                      <th>Statut au Retour</th>
                      <th>Mode Paiement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commandes.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>#{c.id.slice(0,5).toUpperCase()}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.nom_client || `Client #${c.client_id.slice(0,5)}`}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.telephone_client} - {c.commune_livraison}</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{Number(c.montant_total).toLocaleString()} CFA</td>
                        <td>
                          <select 
                            className="form-select" 
                            style={{ 
                              padding: '0.25rem 0.5rem', 
                              backgroundColor: resolutions[c.id]?.statut === 'livree' ? '#dcfce7' : resolutions[c.id]?.statut === 'retour_livreur' ? '#fee2e2' :resolutions[c.id]?.statut === 'a_rappeler' ? '#fef3c7' : '#f3f4f6' 
                            }}
                            value={resolutions[c.id]?.statut || 'retour_livreur'}
                            onChange={(e) => updateResolution(c.id, 'statut', e.target.value)}
                          >
                            <option value="livree">✅ Encaissé (Livré)</option>
                            <option value="retour_livreur">🔙 De Retour (Échec)</option>
                            <option value="a_rappeler">🔄 Reprogrammer</option>
                            <option value="annulee">❌ Annuler</option>
                          </select>
                        </td>
                        <td>
                          {resolutions[c.id]?.statut === 'livree' ? (
                            <select 
                              className="form-select" 
                              style={{ padding: '0.25rem 0.5rem' }}
                              value={resolutions[c.id]?.mode_paiement}
                              onChange={(e) => updateResolution(c.id, 'mode_paiement', e.target.value)}
                            >
                              <option value="Cash à la livraison">Cash</option>
                              <option value="Mobile Money">Mobile Money</option>
                              <option value="Carte">Carte ou Autre</option>
                            </select>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card" style={{ borderTop: '4px solid var(--primary-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <Calculator size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Réconciliation</h3>
              </div>
              
              <div style={{ marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Attendu Cash :</span>
                  <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--success-color)' }}>{montantAttendu.toLocaleString()} CFA</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Mobile Money :</span>
                  <span style={{ fontWeight: 600 }}>{montantMobileMoney.toLocaleString()} CFA</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Total Cash Remis (Compté physiquement) *</label>
                <input 
                  type="number" 
                  className="form-input" 
                  min="0"
                  style={{ fontSize: '1.5rem', fontWeight: 700, padding: '1rem', textAlign: 'center' }}
                  value={montantRemisStr}
                  onChange={e => setMontantRemisStr(e.target.value)}
                />
              </div>

              {isMontantValide && (
                <div style={{ 
                  padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem',
                  backgroundColor: ecart === 0 ? 'rgba(16, 185, 129, 0.1)' : ecart > 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: ecart === 0 ? 'var(--success-color)' : ecart > 0 ? 'var(--info-color)' : 'var(--danger-color)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Écart de caisse final :</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800 }}>
                    {ecart > 0 ? '+' : ''}{ecart.toLocaleString()} CFA
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Note / Explication écart (Optionnel)</label>
                <textarea 
                  className="form-input" 
                  rows={2} 
                  value={commentaire}
                  onChange={e => setCommentaire(e.target.value)}
                />
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', height: '56px', fontSize: '1.125rem', marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                disabled={loading || !isMontantValide}
                onClick={handleCloture}
              >
                <CheckCircle2 size={24} />
                CLÔTURER
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
