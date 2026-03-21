import { useState, useEffect } from 'react';
import { getCommandesByFeuille } from '../services/logistiqueService';
import { getCloturedFeuilles } from '../services/caisseService';
import { Calendar, Search, Truck, X, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FeuilleRoute, Commande } from '../types';
import { generateDeliverySlipPDF } from '../services/pdfService';
import { useToast } from '../contexts/ToastContext';

export const Historique = () => {
  const { showToast } = useToast();
  const [feuilles, setFeuilles] = useState<FeuilleRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedFeuille, setSelectedFeuille] = useState<FeuilleRoute | null>(null);
  const [associatedCommandes, setAssociatedCommandes] = useState<Commande[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getCloturedFeuilles();
        setFeuilles(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleReview = async (f: FeuilleRoute, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFeuille(f);
    setModalLoading(true);
    try {
      const cmds = await getCommandesByFeuille(f.id);
      setAssociatedCommandes(cmds);
    } catch (e) {
      showToast("Erreur lors du chargement des détails", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const filtered = feuilles.filter(f => 
    f.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.nom_livreur?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div style={{ animation: 'pageEnter 0.6s ease' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>Archives Scellées & Clôturées</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>Historique complet des tournées et retours de caisse</p>
        </div>

        <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Search size={20} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="Rechercher une feuille de route ou un livreur..." 
              className="form-input" 
              style={{ border: 'none', fontSize: '1.1rem', width: '100%' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="card table-responsive-cards" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date & Réf</th>
                  <th>Livreur</th>
                  <th style={{ textAlign: 'center' }}>Colis</th>
                  <th style={{ textAlign: 'right' }}>Total Théorique</th>
                  <th style={{ textAlign: 'right' }}>Somme Reçue</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>Chargement...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Aucune archive trouvée.</td></tr>
                ) : (
                  filtered.map(f => (
                    <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => handleReview(f)}>
                      <td data-label="Date & Réf">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(99, 102, 255, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Calendar size={18} />
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>{format(new Date(f.date), 'dd/MM/yyyy')}</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>#{f.id.slice(0, 8).toUpperCase()}</p>
                          </div>
                        </div>
                      </td>
                      <td data-label="Livreur">
                        <p style={{ margin: 0, fontWeight: 700 }}>{f.nom_livreur || 'Inconnu'}</p>
                      </td>
                      <td data-label="Colis" style={{ textAlign: 'center' }}>
                        <span className="badge badge-info">{f.total_commandes}</span>
                      </td>
                      <td data-label="Total Théorique" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {f.total_montant_theorique?.toLocaleString()} CFA
                      </td>
                      <td data-label="Somme Reçue" style={{ textAlign: 'right', fontWeight: 900, color: 'var(--primary)' }}>
                        {(f.montant_encaisse ?? f.total_montant_theorique)?.toLocaleString()} CFA
                      </td>
                      <td data-label="Actions" style={{ textAlign: 'right' }}>
                        <button className="btn btn-outline btn-sm" onClick={(e) => handleReview(f, e)}>Revoir</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedFeuille && (
        <ReviewModal 
          feuille={selectedFeuille} 
          commandes={associatedCommandes} 
          loading={modalLoading} 
          onClose={() => setSelectedFeuille(null)} 
          showToast={showToast}
        />
      )}
    </>
  );
};

const ReviewModal = ({ feuille, commandes, loading, onClose, showToast }: any) => {
  const handleReprint = async () => {
    try {
      await generateDeliverySlipPDF(feuille, commandes);
      showToast("Réimpression lancée.", "success");
    } catch (e) {
      showToast("Erreur lors de la génération PDF.", "error");
    }
  };

  const succesCount = commandes.filter((c: any) => c.statut_commande === 'livree' || c.statut_commande === 'terminee').length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content card glass-effect" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', padding: 0 }}>
        
        {/* Header Modal */}
        <div style={{ padding: '2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '24px 24px 0 0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <Truck size={24} color="var(--primary)" />
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.5rem' }}>Feuille de Route #{feuille.id.slice(0, 8).toUpperCase()}</h2>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontWeight: 600 }}>Livreur: <span style={{ color: 'var(--text-main)' }}>{feuille.nom_livreur}</span> | Date: {format(new Date(feuille.date), 'dd MMMM yyyy', { locale: fr })}</p>
          </div>
          <button onClick={onClose} className="btn btn-outline" style={{ borderRadius: '12px', padding: '0.6rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '2rem', maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? (
             <div style={{ textAlign: 'center', padding: '4rem' }}>Chargement...</div>
          ) : (
             <>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ padding: '1.5rem', borderRadius: '20px', background: '#f0fdf4', border: '1px solid #dcfce7' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Encaissement</p>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 900, color: '#15803d' }}>{(feuille.montant_encaisse ?? feuille.total_montant_theorique)?.toLocaleString()} CFA</p>
                  </div>
                  <div style={{ padding: '1.5rem', borderRadius: '20px', background: feuille.ecart_caisse !== 0 ? '#fef2f2' : '#f8fafc', border: `1px solid ${feuille.ecart_caisse !== 0 ? '#fee2e2' : '#e2e8f0'}` }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: feuille.ecart_caisse !== 0 ? '#991b1b' : '#64748b', textTransform: 'uppercase' }}>Écart Caisse</p>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 900, color: feuille.ecart_caisse !== 0 ? '#dc2626' : '#1e293b' }}>{feuille.ecart_caisse?.toLocaleString() || 0} CFA</p>
                  </div>
                  <div style={{ padding: '1.5rem', borderRadius: '20px', background: '#eff6ff', border: '1px solid #dbeafe' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Fidélité Joueurs</p>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 900, color: '#1d4ed8' }}>{succesCount} / {feuille.total_commandes}</p>
                  </div>
               </div>

               <div className="table-container" style={{ border: '1px solid #f1f5f9' }}>
                 <table>
                   <thead>
                     <tr>
                       <th style={{ width: '80px' }}>Réf</th>
                       <th style={{ width: '180px' }}>Client</th>
                       <th colSpan={3}>Détails des Articles (Nom, Qté, P.U.)</th>
                       <th style={{ width: '100px' }}>Statut</th>
                     </tr>
                   </thead>
                    <tbody>
                      {commandes.map((c: any) => (
                        <tr key={c.id}>
                          <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                            <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.85rem' }}>#{c.id.slice(0,8).toUpperCase()}</div>
                          </td>
                          <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                            <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{c.nom_client}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.commune_livraison}</div>
                          </td>
                          <td colSpan={3} style={{ padding: 0 }}>
                             <table style={{ width: '100%', border: 'none', margin: 0 }}>
                               <tbody>
                                 {(c.lignes || []).map((l: any, idx: number) => (
                                   <tr key={idx} style={{ borderBottom: idx === (c.lignes?.length || 0) - 1 ? 'none' : '1px solid #f8fafc' }}>
                                     <td style={{ border: 'none', padding: '0.75rem 1rem', width: '60%' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{l.nom_produit}</div>
                                     </td>
                                     <td style={{ border: 'none', padding: '0.75rem 1rem', width: '20%', textAlign: 'center' }}>
                                        <span style={{ background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 800, fontSize: '0.8rem' }}>x{l.quantite}</span>
                                     </td>
                                     <td style={{ border: 'none', padding: '0.75rem 1rem', width: '20%', textAlign: 'right', fontWeight: 700, fontSize: '0.9rem' }}>
                                        {l.prix_unitaire?.toLocaleString()}
                                     </td>
                                   </tr>
                                 ))}
                                 <tr style={{ background: 'rgba(99, 102, 255, 0.03)' }}>
                                    <td colSpan={2} style={{ border: 'none', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>TOTAL COMMANDE (LIVR: {c.frais_livraison || 0})</td>
                                    <td style={{ border: 'none', padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 900, fontSize: '1rem', color: 'var(--primary)' }}>{c.montant_total?.toLocaleString()}</td>
                                 </tr>
                               </tbody>
                             </table>
                          </td>
                          <td style={{ verticalAlign: 'top', paddingTop: '1.25rem' }}>
                             <span className={`badge ${c.statut_commande === 'livree' || c.statut_commande === 'terminee' ? 'badge-success' : 'badge-danger'}`}>
                               {c.statut_commande}
                             </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
             </>
          )}
        </div>

        <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
           <button className="btn btn-outline" onClick={onClose}>Fermer</button>
           <button className="btn btn-primary" onClick={handleReprint}>
             <Printer size={18} /> Ré-imprimer
           </button>
        </div>
      </div>
    </div>
  );
};
