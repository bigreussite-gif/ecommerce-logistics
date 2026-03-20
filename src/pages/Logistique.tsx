import { useState, useEffect } from 'react';
import { getCommandesByStatus } from '../services/commandeService';
import { getAvailableLivreurs, creerFeuilleRoute } from '../services/logistiqueService';
import type { Commande, User } from '../types';
import { Truck, Printer } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export const Logistique = () => {
  const { showToast } = useToast();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [livreurs, setLivreurs] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCommands, setSelectedCommands] = useState<Set<string>>(new Set());
  const [selectedLivreur, setSelectedLivreur] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cmds, livs] = await Promise.all([
        getCommandesByStatus(['validee', 'a_rappeler']),
        getAvailableLivreurs()
      ]);
      setCommandes(cmds);
      setLivreurs(livs);
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
      await creerFeuilleRoute(selectedLivreur, Array.from(selectedCommands));
      showToast("Feuille de route générée avec succès !", "success");
      setSelectedCommands(new Set());
      setSelectedLivreur('');
      fetchData();
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la génération.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>;

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }} className="no-print">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Truck size={28} style={{ color: 'var(--primary-color)' }} />
          Logistique & Affectation
        </h1>
      </div>

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Commandes à livrer ({commandes.length})</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
              {selectedCommands.size} sélectionnée(s)
            </span>
          </h3>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCommands(new Set(commandes.map(c => c.id)));
                        else setSelectedCommands(new Set());
                      }}
                      checked={selectedCommands.size === commandes.length && commandes.length > 0}
                    />
                  </th>
                  <th>Client / Contact</th>
                  <th>Commune / Adresse</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map(c => (
                  <tr key={c.id} onClick={() => toggleCommand(c.id)} style={{ cursor: 'pointer', backgroundColor: selectedCommands.has(c.id) ? 'rgba(79, 70, 229, 0.05)' : 'transparent' }}>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={selectedCommands.has(c.id)}
                        onChange={() => toggleCommand(c.id)}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.nom_client || `Client #${c.client_id.slice(0,5)}`}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{c.telephone_client || 'Sans numéro'}</div>
                    </td>
                    <td>
                      <span className="badge badge-info">{c.commune_livraison}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>{Number(c.montant_total).toLocaleString()} CFA</div>
                      {c.frais_livraison !== undefined && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Inc. {c.frais_livraison} CFA de liv.)</div>}
                    </td>
                  </tr>
                ))}
                {commandes.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Aucune commande à livrer.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ height: 'max-content' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={20} color="var(--primary-color)"/>
            Créer Feuille de Route
          </h3>
          
          <div className="form-group">
            <label className="form-label">Sélectionner un livreur</label>
            <select className="form-select" value={selectedLivreur} onChange={e => setSelectedLivreur(e.target.value)}>
              <option value="">-- Choisir --</option>
              {livreurs.map(l => (
                <option key={l.id} value={l.id}>{l.nom_complet}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Colis :</span>
              <span style={{ fontWeight: 600 }}>{selectedCommands.size}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Valeur totale des colis :</span>
              <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary-color)' }}>
                {commandes.filter(c => selectedCommands.has(c.id)).reduce((a,c)=>a+Number(c.montant_total), 0).toLocaleString()} CFA
              </span>
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1.5rem', height: '44px' }}
            disabled={loading || selectedCommands.size === 0 || !selectedLivreur}
            onClick={handleGenerateFeuille}
          >
            <Printer size={18} />
            Générer / Assigner
          </button>
        </div>

      </div>
    </div>
  );
};
