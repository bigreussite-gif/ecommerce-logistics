import { useState, useEffect } from 'react';
import { X, Search, Trash2, Plus } from 'lucide-react';
import type { Produit, Client, LigneCommande, Commande } from '../../types';
import { subscribeToProduits } from '../../services/produitService';
import { searchClientByPhone, createClient } from '../../services/clientService';
import { createCommandeBase } from '../../services/commandeService';
import { getCommunes } from '../../services/adminService';
import { useToast } from '../../contexts/ToastContext';
import type { Commune } from '../../types';

export const CommandeForm = ({ onClose, onSave }: { onClose: () => void, onSave: () => void }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Client Search & State
  const [clientRecherche, setClientRecherche] = useState<Partial<Client>>({ telephone: '', nom_complet: '', email: '', adresse: '', commune: '', ville: '', remarques: '' });
  const [clientId, setClientId] = useState<string | null>(null);

  // Products State
  const [catalogue, setCatalogue] = useState<Produit[]>([]);
  const [lignes, setLignes] = useState<Partial<LigneCommande>[]>([]);
  
  // Order Details
  const [source, setSource] = useState('Facebook');
  const [modePaiement, setModePaiement] = useState('Cash à la livraison');
  const [notes, setNotes] = useState('');
  
  const [communesDb, setCommunesDb] = useState<Commune[]>([]);

  useEffect(() => {
    getCommunes().then(setCommunesDb);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToProduits((prods: Produit[]) => {
      setCatalogue(prods.filter(p => p.actif));
    });
    return () => unsubscribe();
  }, []);

  const handleSearchClient = async () => {
    if (!clientRecherche.telephone) return;
    const found = await searchClientByPhone(clientRecherche.telephone);
    if (found) {
      setClientId(found.id);
      setClientRecherche(found);
    } else {
      setClientId(null);
      showToast("Aucun client trouvé avec ce numéro. Vous pouvez saisir les informations du nouveau client.", "info");
    }
  };

  const addLigne = () => {
    setLignes([...lignes, { produit_id: '', quantite: 1, prix_unitaire: 0 }]);
  };

  const parsePrice = (p: any): number => {
    if (!p) return 0;
    // Try multiple potential field names
    const rawValue = p.prix_vente !== undefined ? p.prix_vente : (p.prixVente !== undefined ? p.prixVente : (p.prix !== undefined ? p.prix : 0));
    const val = typeof rawValue === 'string' ? parseFloat(rawValue.replace(/[^0-9.-]+/g,"")) : Number(rawValue);
    return isNaN(val) ? 0 : val;
  };

  const updateLigne = (index: number, field: keyof LigneCommande, value: any) => {
    const newLignes = [...lignes];
    if (field === 'produit_id') {
      const prod = catalogue.find(p => p.id === value);
      if (!prod) return;

      console.log('Produit sélectionné:', prod); // For debugging
      let prixActif = parsePrice(prod);
      
      // Check for active promotion
      const promoVal = prod.prix_promo !== undefined ? prod.prix_promo : (prod as any).prixPromo;
      if (promoVal !== undefined && promoVal !== null && promoVal !== 0) {
        const now = new Date().getTime();
        const debut = prod.promo_debut ? new Date(prod.promo_debut).getTime() : 0;
        const fin = prod.promo_fin ? new Date(prod.promo_fin).getTime() : Infinity;
        if (now >= debut && now <= fin) {
          prixActif = typeof promoVal === 'string' ? parseFloat(promoVal.replace(/[^0-9.-]+/g,"")) : Number(promoVal);
        }
      }

      newLignes[index] = { 
        ...newLignes[index], 
        produit_id: value, 
        nom_produit: prod.nom, 
        prix_unitaire: prixActif, 
        montant_ligne: prixActif * (newLignes[index].quantite || 1) 
      };
    } else if (field === 'quantite') {
      const qte = Math.max(1, Number(value));
      const prix = Number(newLignes[index].prix_unitaire) || 0;
      newLignes[index] = { 
        ...newLignes[index], 
        quantite: qte, 
        montant_ligne: prix * qte 
      };
    }
    setLignes(newLignes);
  };

  const totalMontant = lignes.reduce((acc, l) => acc + Number(l.montant_ligne || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientRecherche.nom_complet) return showToast("Le nom du client est obligatoire.", "error");
    if (totalMontant <= 0) return showToast("Le montant total de la commande ne peut pas être 0 CFA. Vérifiez le prix des produits.", "error");
    if (lignes.length === 0) return showToast("Ajoutez au moins un produit.", "error");
    if (!lignes.every(l => l.produit_id && l.quantite)) return showToast("Veuillez remplir correctement les produits.", "error");

    setLoading(true);
    try {
      let finalClientId = clientId;
      
      // Verify if client exists by phone if not explicitly set
      if (!finalClientId && clientRecherche.telephone) {
        const existing = await searchClientByPhone(clientRecherche.telephone);
        if (existing) {
          finalClientId = existing.id;
        } else {
          finalClientId = await createClient({
            telephone: clientRecherche.telephone,
            nom_complet: clientRecherche.nom_complet!,
            email: clientRecherche.email || '',
            adresse: clientRecherche.adresse || '',
            commune: clientRecherche.commune || '',
            ville: clientRecherche.ville || 'Abidjan',
            remarques: clientRecherche.remarques || ''
          });
        }
      }
      
      if (!finalClientId) {
        showToast("Veuillez renseigner un numéro de téléphone valide.", "error");
        setLoading(false);
        return;
      }

      const newCommande: Omit<Commande, 'id' | 'date_creation' | 'statut_commande'> = {
        client_id: finalClientId,
        nom_client: clientRecherche.nom_complet,
        telephone_client: clientRecherche.telephone,
        source_commande: source,
        montant_total: totalMontant,
        mode_paiement: modePaiement,
        commune_livraison: clientRecherche.commune || '',
        adresse_livraison: clientRecherche.adresse || '',
        notes_client: notes,
      };

      await createCommandeBase(newCommande as any, lignes as Omit<LigneCommande, 'id' | 'commande_id'>[]);
      onSave();
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la création.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="card" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <X size={20} />
        </button>
        
        <h2 style={{ marginBottom: '1.5rem' }}>Nouvelle Commande</h2>
        
        <form onSubmit={handleSubmit}>
          
          <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>1. Client</h3>
            <div className="form-group" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Téléphone *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" className="form-input" placeholder="Ex: 0102030405" required value={clientRecherche.telephone} onChange={e => { setClientRecherche({...clientRecherche, telephone: e.target.value}); setClientId(null); }} />
                  <button type="button" className="btn btn-outline" onClick={handleSearchClient} title="Rechercher si le client existe">
                    <Search size={16} />
                  </button>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nom complet *</label>
                <input type="text" className="form-input" required value={clientRecherche.nom_complet} onChange={e => setClientRecherche({...clientRecherche, nom_complet: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Email (Optionnel)</label>
                <input type="email" className="form-input" value={clientRecherche.email} onChange={e => setClientRecherche({...clientRecherche, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Commune (Optionnel, affiné à l'appel)</label>
                 <select className="form-select" value={clientRecherche.commune || ''} onChange={e => setClientRecherche({...clientRecherche, commune: e.target.value})}>
                  <option value="">Sélectionner une commune...</option>
                  {communesDb.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Adresse détaillée (Optionnel)</label>
                <input type="text" className="form-input" value={clientRecherche.adresse} onChange={e => setClientRecherche({...clientRecherche, adresse: e.target.value})} />
              </div>
            </div>
          </div>

          <div style={{ padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--primary-color)', margin: 0 }}>2. Produits</h3>
              <button type="button" className="btn btn-outline" onClick={addLigne} style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                <Plus size={14} /> Ajouter produit
              </button>
            </div>
            
            {lignes.map((l, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 2 }}>
                  <select className="form-select" required value={l.produit_id} onChange={(e) => updateLigne(idx, 'produit_id', e.target.value)}>
                    <option value="">Sélectionner un produit</option>
                    {catalogue.filter(p => p.actif).map(p => {
                      const prixActif = parsePrice(p);
                      return <option key={p.id} value={p.id}>{p.nom} - {prixActif.toLocaleString()} {p.devise || 'CFA'} (Stock: {p.stock_actuel})</option>;
                    })}
                  </select>
                </div>
                <div style={{ width: '80px' }}>
                  <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Qté</label>
                  <input type="number" className="form-input" min="1" value={l.quantite} onChange={e => updateLigne(idx, 'quantite', Math.max(1, Number(e.target.value)))} required />
                </div>
                <div style={{ width: '160px', padding: '0 0.5rem' }}>
                   <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Prix Unit.</label>
                   <div style={{ fontWeight: 500, padding: '0.5rem 0' }}>{l.prix_unitaire?.toLocaleString()} CFA</div>
                </div>
                <div style={{ flex: 1, textAlign: 'right', padding: '0 1rem' }}>
                   <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sous-total</label>
                   <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                     {(l.montant_ligne || 0).toLocaleString()} CFA
                   </div>
                </div>
                <button type="button" className="btn btn-outline" style={{ border: 'none', color: 'var(--danger-color)', marginTop: '1.25rem' }} onClick={() => setLignes(lignes.filter((_, i) => i !== idx))}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {lignes.length > 0 && (
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1rem', textAlign: 'right', fontWeight: 700, fontSize: '1.25rem' }}>
                Total: {totalMontant.toLocaleString()} CFA
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Source de la commande</label>
              <select className="form-select" value={source} onChange={e => setSource(e.target.value)}>
                <option value="Facebook">Facebook</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Site Web">Site Web</option>
                <option value="Appel Entrant">Appel Entrant</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Mode de paiement</label>
              <select className="form-select" value={modePaiement} onChange={e => setModePaiement(e.target.value)}>
                <option value="Cash à la livraison">Cash à la livraison</option>
                <option value="Mobile Money">Mobile Money (Avant livraison)</option>
              </select>
            </div>
            
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Notes client / Instructions</label>
              <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Création...' : 'Créer la commande'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
