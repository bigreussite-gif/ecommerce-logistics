import { useState, useEffect } from 'react';
import { getCommandesByStatus } from '../services/commandeService';
import { getAvailableLivreurs, creerFeuilleRoute, getFeuillesRoute, getCommandesByFeuille } from '../services/logistiqueService';
import type { Commande, User, FeuilleRoute } from '../types';
import { Truck, Printer, Eye, Clock } from 'lucide-react';
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

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>;

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Truck size={36} strokeWidth={2.5} />
          Logistique & Affectation
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>Optimisez vos tournées et affectez vos colis aux livreurs disponibles.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) 350px', gap: '2rem', alignItems: 'start' }} className="responsive-grid">
        
        {/* LISTE DES COMMANDES */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
              Commandes Disponibles
              <span style={{ marginLeft: '1rem', padding: '0.2rem 0.6rem', background: 'rgba(99, 102, 255, 0.1)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--primary)' }}>
                {commandes.length} flux
              </span>
            </h3>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
              {selectedCommands.size} sélectionnée(s)
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input 
                        type="checkbox" 
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedCommands(new Set(commandes.map(c => c.id)));
                          else setSelectedCommands(new Set());
                        }}
                        checked={selectedCommands.size === commandes.length && commandes.length > 0}
                      />
                    </div>
                  </th>
                  <th>Client / Destination</th>
                  <th>Zone</th>
                  <th style={{ textAlign: 'right' }}>Valeur</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map(c => (
                  <tr 
                    key={c.id} 
                    onClick={() => toggleCommand(c.id)} 
                    style={{ 
                      cursor: 'pointer', 
                      transition: 'all 0.2s ease',
                      backgroundColor: selectedCommands.has(c.id) ? 'rgba(99, 102, 255, 0.03)' : 'transparent' 
                    }}
                  >
                    <td>
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
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.nom_client || `Client #${c.client_id.slice(0,5)}`}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>{c.telephone_client}</div>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontWeight: 700, padding: '0.3rem 0.7rem' }}>{c.commune_livraison}</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontStyle: 'italic' }}>{c.adresse_livraison?.slice(0, 40)}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800 }}>{Number(c.montant_total).toLocaleString()} CFA</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(c.lignes || []).length} art.</div>
                        </div>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.5rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                          onClick={(e) => { e.stopPropagation(); setSelectedCommandeId(c.id); }}
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {commandes.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                      <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Tout est à jour !</p>
                      <p style={{ fontSize: '0.9rem' }}>Aucune commande en attente d'affectation.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
                           <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>#{f.id.slice(0, 8).toUpperCase()}</div>
                           <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{f.nom_livreur}</div>
                        </div>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.4rem', borderRadius: '8px' }}
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
    </div>
  );
};
