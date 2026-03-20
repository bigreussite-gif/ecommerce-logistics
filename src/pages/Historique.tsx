import { useState, useEffect } from 'react';
import { getAvailableLivreurs, getFeuillesRoute, getCommandesByFeuille } from '../services/logistiqueService';
import { updateItem } from '../services/localDb';
import type { Commande, User, FeuilleRoute } from '../types';
import { History, Printer, Lock, Calendar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../contexts/ToastContext';

export const Historique = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [livreurs, setLivreurs] = useState<User[]>([]);
  const [feuilles, setFeuilles] = useState<FeuilleRoute[]>([]);
  const [impression, setImpression] = useState<{feuille: any, commandes: Commande[]} | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [livs, hist] = await Promise.all([
        getAvailableLivreurs(),
        getFeuillesRoute()
      ]);
      setLivreurs(livs);
      
      // Sort by descending date
      const sortedHist = hist.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setFeuilles(sortedHist);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrint = async (feuille: any) => {
    try {
      const cmds = await getCommandesByFeuille(feuille.id);
      setImpression({ feuille, commandes: cmds });
      setTimeout(() => window.print(), 500);
    } catch(e) {
      showToast("Erreur lors de l'impression", "error");
    }
  };

  const handleDeleteFeuille = async (feuille: FeuilleRoute) => {
    if (feuille.statut_feuille === 'terminee') {
      showToast("Impossible de supprimer une archive classée.", "error");
      return;
    }
    
    if (window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cette feuille de route en cours ?")) {
      try {
        await updateItem('feuilles_route', feuille.id, { statut_feuille: 'annulee' });
        showToast("Feuille de route supprimée / annulée.", "success");
        fetchData();
      } catch (e) {
        showToast("Erreur lors de la suppression.", "error");
      }
    }
  };

  const feuillesEnCours = feuilles.filter(f => f.statut_feuille !== 'terminee');
  const feuillesTraitees = feuilles.filter(f => f.statut_feuille === 'terminee');

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>;

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="no-print">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={28} style={{ color: 'var(--primary-color)' }} />
          Historique & Impression
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Gestion sécurisée des archives de feuilles de route</p>
      </div>

      <div className="card no-print" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--warning-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} />
          Feuilles de route En Cours ({feuillesEnCours.length})
        </h2>
        
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date de Création</th>
                <th>ID</th>
                <th>Livreur</th>
                <th>Colis</th>
                <th>Montant Théorique</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {feuillesEnCours.map(h => {
                const livreur = livreurs.find(l => l.id === h.livreur_id);
                return (
                  <tr key={h.id}>
                    <td>{format(new Date(h.date), 'dd/MM/yyyy HH:mm')}</td>
                    <td style={{ fontWeight: 500 }}>#{h.id.slice(0, 5)}</td>
                    <td>{livreur?.nom_complet || 'Livreur inconnu'}</td>
                    <td>{h.total_commandes} commandes</td>
                    <td style={{ fontWeight: 600 }}>{Number(h.total_montant_theorique).toLocaleString()} CFA</td>
                    <td><span className="badge badge-warning">{h.statut_feuille || 'En Cours'}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline btn-sm" title="Imprimer" onClick={() => handlePrint(h)}>
                          <Printer size={16} />
                        </button>
                        <button className="btn btn-outline btn-sm" title="Supprimer" style={{ color: 'var(--danger-color)' }} onClick={() => handleDeleteFeuille(h)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {feuillesEnCours.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Aucune feuille en cours.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card no-print">
        <h2 style={{ marginBottom: '1rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={20} />
          Archives Traitées ({feuillesTraitees.length})
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Les feuilles clôturées par la caisse sont inviolables (suppression/modification interdite).
        </p>

        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th>Date Traitement</th>
                <th>ID</th>
                <th>Livreur</th>
                <th>Colis Livrés</th>
                <th>Montant Encaissé</th>
                <th style={{ textAlign: 'center' }}>Garantie</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {feuillesTraitees.map(h => {
                const livreur = livreurs.find(l => l.id === h.livreur_id);
                return (
                  <tr key={h.id}>
                    <td style={{ color: 'var(--success-color)', fontWeight: 600 }}>
                      {h.date_traitement ? format(new Date(h.date_traitement), 'dd/MM/yyyy HH:mm') : 'Inconnue'}
                    </td>
                    <td style={{ fontWeight: 500 }}>#{h.id.slice(0, 5)}</td>
                    <td>{livreur?.nom_complet || 'Livreur inconnu'}</td>
                    <td>{h.total_commandes} initial(s)</td>
                    <td style={{ fontWeight: 600 }}>{(h as any).montant_encaisse?.toLocaleString() || '---'} CFA</td>
                    <td style={{ textAlign: 'center' }} title="Archive scellée">
                      <Lock size={16} color="var(--success-color)" />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" title="Ré-imprimer" onClick={() => handlePrint(h)}>
                        <Printer size={16} /> Imprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
              {feuillesTraitees.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Aucune archive clôturée.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Impression View */}
      {impression && (
        <div id="print-area" style={{ display: 'none' }}>
           <style>{`
            @media print {
              @page { size: landscape; margin: 10mm; }
              body * { visibility: hidden; }
              #print-area, #print-area * { visibility: visible; }
              #print-area { display: block !important; position: absolute; left: 0; top: 0; width: 100%; padding: 2rem; background: white; color: black; }
              .no-print { display: none !important; }
              table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
              th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
              th { background-color: #f8f9fa; }
              h1, h2, h3 { color: black; }
            }
          `}</style>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '1rem', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px' }}>FEUILLE DE ROUTE</h1>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px' }}>Date de création: {format(new Date(impression.feuille.date), 'dd/MM/yyyy HH:mm')}</p>
              {impression.feuille.date_traitement && (
                 <p style={{ margin: '0.25rem 0 0 0', fontSize: '14px', color: 'green', fontWeight: 'bold' }}>Clôturée le: {format(new Date(impression.feuille.date_traitement), 'dd/MM/yyyy HH:mm')}</p>
              )}
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '14px' }}>Réf: #{impression.feuille.id.toUpperCase()}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Livreur: {livreurs.find(l => l.id === impression.feuille.livreur_id)?.nom_complet || 'Inconnu'}</h2>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '14px', fontWeight: 'bold' }}>Total Colis: {impression.feuille.total_commandes}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>N° Commande</th>
                <th>Client</th>
                <th>Téléphone</th>
                <th>Commune</th>
                <th>Adresse exacte</th>
                <th>Montant à encaisser</th>
                <th>Signature Client</th>
              </tr>
            </thead>
            <tbody>
              {impression.commandes.map(cmd => (
                <tr key={cmd.id}>
                  <td style={{ fontWeight: 'bold' }}>#{cmd.id.slice(0,5).toUpperCase()}</td>
                  <td>{cmd.nom_client || 'Client Info Manquante'}</td>
                  <td style={{ fontWeight: 'bold' }}>{cmd.telephone_client}</td>
                  <td>{cmd.commune_livraison}</td>
                  <td>{cmd.adresse_livraison}</td>
                  <td style={{ fontWeight: 'bold' }}>{Number(cmd.montant_total).toLocaleString()} CFA</td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between' }}>
             <div style={{ borderTop: '1px solid black', width: '250px', textAlign: 'center', paddingTop: '0.5rem', fontWeight: 'bold' }}>Visa Agent Logistique / Caisse</div>
             <div style={{ borderTop: '1px solid black', width: '250px', textAlign: 'center', paddingTop: '0.5rem', fontWeight: 'bold' }}>Signature Livreur</div>
          </div>
        </div>
      )}
    </div>
  );
};
