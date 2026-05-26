import { useState, useEffect } from 'react';
import { X, Search, Trash2, Plus } from 'lucide-react';
import type { Produit, Client, LigneCommande, Commande } from '../../types';
import { subscribeToProduits } from '../../services/produitService';
import { searchClientByPhone, createClient, updateClient } from '../../services/clientService';
import { createCommandeBase, updateCommandeBase } from '../../services/commandeService';
import { getCommunes } from '../../services/adminService';
import { useToast } from '../../contexts/ToastContext';
import type { Commune } from '../../types';

export const CommandeForm = ({ onClose, onSave, editingCommande, originalLines }: { onClose: () => void, onSave: () => void, editingCommande?: Commande, originalLines?: LigneCommande[] }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Client Search & State
  const [clientRecherche, setClientRecherche] = useState<Partial<Client>>({ telephone: '', telephone_secondaire: '', nom_complet: '', email: '', adresse: '', commune: '', quartier: '', ville: '', remarques: '' });
  const [clientId, setClientId] = useState<string | null>(null);

  // Products State
  const [catalogue, setCatalogue] = useState<Produit[]>([]);
  const [lignes, setLignes] = useState<Partial<LigneCommande>[]>([]);
  const [lineSearches, setLineSearches] = useState<Record<number, string>>({});
  
  // Order Details
  const [source, setSource] = useState('Facebook');
  const [modePaiement, setModePaiement] = useState('Cash à la livraison');
  const [notes, setNotes] = useState('');
  
  const [communesDb, setCommunesDb] = useState<Commune[]>([]);
  const [fraisLivraison, setFraisLivraison] = useState(0);
  const [remiseValue, setRemiseValue] = useState<number | ''>(0);
  const [remiseType, setRemiseType] = useState<'fixe' | 'pourcentage'>('fixe');

  useEffect(() => {
    getCommunes().then(setCommunesDb);
  }, []);

  useEffect(() => {
    if (editingCommande) {
      setClientRecherche({
        telephone: editingCommande.telephone_client || '',
        telephone_secondaire: editingCommande.telephone_secondaire || '',
        nom_complet: editingCommande.nom_client || '',
        commune: editingCommande.commune_livraison || '',
        quartier: editingCommande.quartier_livraison || '',
        adresse: editingCommande.adresse_livraison || '',
      });
      setSource(editingCommande.source_commande || 'Facebook');
      setModePaiement(editingCommande.mode_paiement || 'Cash à la livraison');
      setNotes(editingCommande.notes_client || '');
      setFraisLivraison(editingCommande.frais_livraison || 0);
      setRemiseValue(editingCommande.remise_totale || 0);
      setRemiseType('fixe'); // We store fixed in DB, so default to fixe on edit
      setClientId(editingCommande.client_id);
    }
    if (originalLines) {
      setLignes(originalLines.map(l => ({ ...l })));
    }
  }, [editingCommande, originalLines]);

  useEffect(() => {
    const unsubscribe = subscribeToProduits((prods: Produit[]) => {
      setCatalogue(prods.filter(p => p.actif));
    });
    return () => unsubscribe();
  }, []);

  const updateFraisLivraison = (communeNom: string) => {
    const commune = communesDb.find(c => c.nom === communeNom);
    setFraisLivraison(commune?.tarif_livraison || 0);
  };

  useEffect(() => {
    if (clientRecherche.commune) {
      updateFraisLivraison(clientRecherche.commune);
    }
  }, [clientRecherche.commune, communesDb]);

  const handleSearchClient = async () => {
    if (!clientRecherche.telephone) return;
    // Normalize: keep only digits, take last 10
    const phoneNorm = clientRecherche.telephone.replace(/\D/g, '').slice(-10);
    const found = await searchClientByPhone(phoneNorm || clientRecherche.telephone);
    if (found) {
      setClientId(found.id);
      setClientRecherche(prev => ({ ...prev, ...found }));
    } else {
      setClientId(null);
      showToast("Aucun client trouvé avec ce numéro. Vous pouvez saisir les informations du nouveau client.", "info");
    }
  };

  const addLigne = () => {
    setLignes([...lignes, { produit_id: '', quantite: 1, prix_unitaire: 0, choix_installation: false, frais_installation: 0 }]);
  };

  const parsePrice = (p: any): number => {
    if (!p) return 0;
    const fields = ['prix_vente', 'prixVente', 'prix_unitaire', 'prixUnitaire', 'prix', 'price', 'prix_achat'];
    let rawValue = undefined;
    for (const f of fields) {
      if (p[f] !== undefined && p[f] !== null) {
        rawValue = p[f];
        break;
      }
    }
    
    if (rawValue === undefined) return 0;
    const val = typeof rawValue === 'string' ? parseFloat(rawValue.replace(/[^0-9.-]+/g,"")) : Number(rawValue);
    return isNaN(val) ? 0 : val;
  };

  const updateLigne = (index: number, field: keyof LigneCommande, value: any) => {
    const newLignes = [...lignes];
    if (field === 'produit_id') {
      const prod = catalogue.find(p => p.id === value);
      if (!prod) return;

      let prixActif = parsePrice(prod);
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
        choix_installation: false,
        frais_installation: prod.frais_installation || 0,
        montant_ligne: prixActif * (newLignes[index].quantite || 1) 
      };
    } else if (field === 'quantite') {
      const qte = Math.max(1, Number(value));
      const prix = Number(newLignes[index].prix_unitaire) || 0;
      const avecInstal = !!newLignes[index].choix_installation;
      const frais = Number(newLignes[index].frais_installation) || 0;
      newLignes[index] = { 
        ...newLignes[index], 
        quantite: qte, 
        montant_ligne: (prix * qte) + (avecInstal ? (frais * qte) : 0)
      };
    } else if (field === 'choix_installation') {
      const qte = Number(newLignes[index].quantite) || 1;
      const prix = Number(newLignes[index].prix_unitaire) || 0;
      const choix = !!value;
      const frais = Number(newLignes[index].frais_installation) || 0;
      newLignes[index] = { 
        ...newLignes[index], 
        choix_installation: choix,
        montant_ligne: (prix * qte) + (choix ? (frais * qte) : 0)
      };
    }
    setLignes(newLignes);
  };

  const subtotal = lignes.reduce((acc, l) => acc + Number(l.montant_ligne || 0), 0);
  const discountAmount = remiseType === 'fixe' 
    ? (Number(remiseValue) || 0) 
    : Math.round(subtotal * (Number(remiseValue) || 0) / 100);
  const totalMontant = Math.max(0, (subtotal + fraisLivraison) - discountAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientRecherche.nom_complet) return showToast("Le nom du client est obligatoire.", "error");
    if (totalMontant <= 0) return showToast("Le montant total de la commande ne peut pas être 0 CFA. Vérifiez le prix des produits.", "error");
    if (lignes.length === 0) return showToast("Ajoutez au moins un produit.", "error");
    if (!lignes.every(l => l.produit_id && l.quantite)) return showToast("Veuillez remplir correctement les produits.", "error");

    setLoading(true);
    try {
      let finalClientId = clientId;
      if (!finalClientId && clientRecherche.telephone) {
        // Normalize phone to avoid duplicate key violations (UNIQUE constraint)
        const phoneNorm = clientRecherche.telephone.replace(/\D/g, '').slice(-10) || clientRecherche.telephone;
        const existing = await searchClientByPhone(phoneNorm);
        if (existing) {
          finalClientId = existing.id;
        } else {
          finalClientId = await createClient({
            telephone: phoneNorm,
            telephone_secondaire: clientRecherche.telephone_secondaire || '',
            nom_complet: clientRecherche.nom_complet!,
            email: clientRecherche.email || '',
            adresse: clientRecherche.adresse || '',
            commune: clientRecherche.commune || '',
            quartier: clientRecherche.quartier || '',
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

      if (editingCommande) {
        const updateData: Partial<Commande> = {
          client_id: finalClientId,
          source_commande: source,
          montant_total: totalMontant,
          frais_livraison: fraisLivraison,
          mode_paiement: modePaiement,
          commune_livraison: clientRecherche.commune || '',
          quartier_livraison: clientRecherche.quartier || '',
          adresse_livraison: clientRecherche.adresse || '',
          notes_client: notes,
          remise_totale: discountAmount,
        };

        if (finalClientId) {
          await updateClient(finalClientId, {
            nom_complet: clientRecherche.nom_complet,
            telephone: clientRecherche.telephone,
            telephone_secondaire: clientRecherche.telephone_secondaire || '',
            commune: clientRecherche.commune || '',
            quartier: clientRecherche.quartier || '',
            adresse: clientRecherche.adresse || '',
            email: clientRecherche.email || '',
          });
        }

        await updateCommandeBase(editingCommande.id, updateData, originalLines || [], lignes as any[]);
        showToast("Commande et client mis à jour avec succès !", "success");
      } else {
        const newCommande: Omit<Commande, 'id' | 'date_creation' | 'statut_commande'> = {
          client_id: finalClientId,
          source_commande: source,
          montant_total: totalMontant,
          frais_livraison: fraisLivraison,
          mode_paiement: modePaiement,
          commune_livraison: clientRecherche.commune || '',
          quartier_livraison: clientRecherche.quartier || '',
          adresse_livraison: clientRecherche.adresse || '',
          notes_client: notes,
          remise_totale: discountAmount,
        };

        await createCommandeBase(newCommande as any, lignes as Omit<LigneCommande, 'id' | 'commande_id'>[]);
        showToast("Commande créée avec succès !", "success");
      }
      onSave();
    } catch (error: any) {
      console.error('Erreur création/modification commande:', error);
      const msg = error?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique') || error?.code === '23505') {
        showToast("Ce numéro de téléphone est déjà utilisé par un autre client. Veuillez vérifier.", "error");
      } else {
        showToast(editingCommande ? `Erreur lors de la mise à jour: ${msg || 'inconnu'}` : `Erreur lors de la création: ${msg || 'inconnu'}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content card" style={{ maxWidth: '900px', padding: '2.5rem' }} onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: '1.5rem', 
            right: '1.5rem', 
            background: '#f1f5f9', 
            border: 'none', 
            borderRadius: '12px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer', 
            color: 'var(--text-muted)',
            transition: 'all 0.2s ease'
          }}
        >
          <X size={20} strokeWidth={2.5} />
        </button>
        
        <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="text-premium" style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>
              {editingCommande ? `Modifier Commande #${editingCommande.id.slice(0, 8).toUpperCase()}` : 'Nouvelle Commande'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.4rem', fontWeight: 500 }}>
              {editingCommande ? 'Modifiez les informations nécessaires ci-dessous.' : 'Veuillez renseigner les détails du client et la composition de la commande.'}
            </p>
          </div>
          {!editingCommande && (
            <button 
              type="button" 
              className="btn btn-outline" 
              style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', borderRadius: '10px', color: 'var(--primary)', borderColor: 'var(--primary)' }}
              onClick={() => { onClose(); (window as any).openBulkImport?.(); }}
            >
              <Search size={14} /> Importer via Excel
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '2rem' }}>
          
          <div style={{ padding: '2rem', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>1</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Informations Client</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Téléphone Mobile *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" className="form-input" style={{ background: 'white', height: '48px', fontWeight: 600 }} placeholder="Ex: 0707070707" required value={clientRecherche.telephone} onChange={e => { setClientRecherche({...clientRecherche, telephone: e.target.value}); setClientId(null); }} />
                  <button type="button" className="btn btn-primary" style={{ width: '48px', padding: 0, borderRadius: '12px' }} onClick={handleSearchClient} title="Vérifier l'existence"><Search size={20} strokeWidth={2.5} /></button>
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Nom Complet *</label>
                <input type="text" className="form-input" style={{ background: 'white', height: '48px' }} required value={clientRecherche.nom_complet} onChange={e => setClientRecherche({...clientRecherche, nom_complet: e.target.value})} />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Téléphone Secondaire (Facultatif)</label>
                <input type="text" className="form-input" style={{ background: 'white', height: '48px' }} placeholder="Ex: 0102030405" value={clientRecherche.telephone_secondaire} onChange={e => setClientRecherche({...clientRecherche, telephone_secondaire: e.target.value})} />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Zone / Commune *</label>
                 <select className="form-select" style={{ background: 'white', height: '48px' }} required value={clientRecherche.commune || ''} onChange={e => setClientRecherche({...clientRecherche, commune: e.target.value})}>
                  <option value="">Sélectionner une zone...</option>
                  {communesDb.map(c => <option key={c.id} value={c.nom}>{c.nom} ({c.tarif_livraison.toLocaleString()} CFA)</option>)}
                  <option disabled style={{ fontWeight: 800, color: '#94a3b8' }}>── Hors Abidjan ──</option>
                  <option value="Intérieur">🚌 Intérieur (Hors Abidjan) — Envoi Gare</option>
                  <option value="Autre">Autre (Zone non définie)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Quartier / Repère</label>
                <input type="text" className="form-input" style={{ background: 'white', height: '48px' }} placeholder="Ex: Palmeraie, Riviera 3..." value={clientRecherche.quartier} onChange={e => setClientRecherche({...clientRecherche, quartier: e.target.value})} />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Adresse Détaillée (Rue, Porte, Bât...)</label>
                <input type="text" className="form-input" style={{ background: 'white', height: '48px' }} placeholder="Ex: Bâtiment A, Porte 12..." value={clientRecherche.adresse} onChange={e => setClientRecherche({...clientRecherche, adresse: e.target.value})} />
              </div>
            </div>
          </div>

          <div style={{ padding: '2rem', border: '2px solid #f1f5f9', borderRadius: '24px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>2</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Panier Commande</h3>
              </div>
              <button type="button" className="btn btn-outline" onClick={addLigne} style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '12px' }}><Plus size={16} strokeWidth={2.5} /> Ajouter un article</button>
            </div>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              {lignes.map((l, idx) => (
                <div key={idx} className="glass-effect" style={{ display: 'flex', gap: '1.5rem', padding: '1.25rem', borderRadius: '18px', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(241, 245, 249, 0.5)' }}>
                  <div style={{ flex: '2', minWidth: '240px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>Article</label>
                      <input 
                        type="text" 
                        placeholder="Filtrer article..." 
                        style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', width: '120px' }}
                        value={lineSearches[idx] || ''}
                        onChange={e => setLineSearches({ ...lineSearches, [idx]: e.target.value })}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    <select className="form-select" required value={l.produit_id} onChange={(e) => updateLigne(idx, 'produit_id', e.target.value)} style={{ background: 'white' }}>
                      <option value="">Choisir un produit...</option>
                      {catalogue.filter(p => !lineSearches[idx] || p.nom.toLowerCase().includes(lineSearches[idx].toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(lineSearches[idx].toLowerCase()))).map(p => (
                        <option key={p.id} value={p.id}>{p.nom} ({parsePrice(p).toLocaleString()} CFA)</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: '100px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Qté</label>
                    <input type="number" className="form-input" min="1" value={l.quantite} onChange={e => updateLigne(idx, 'quantite', e.target.value)} style={{ background: 'white', textAlign: 'center', fontWeight: 700 }} />
                  </div>
                  {l.frais_installation ? (
                    <div style={{ padding: '0.5rem', background: l.choix_installation ? 'rgba(16, 185, 129, 0.1)' : 'white', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                        <input type="checkbox" checked={l.choix_installation} onChange={e => updateLigne(idx, 'choix_installation', e.target.checked)} />
                        Installation (+{(l.frais_installation * (l.quantite || 1)).toLocaleString()})
                      </label>
                    </div>
                  ) : null}
                  <div style={{ flex: '1', textAlign: 'right' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Sous-total</label>
                    <div className="brand-glow" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{(l.montant_ligne || 0).toLocaleString()} <span style={{ fontSize: '0.75rem' }}>CFA</span></div>
                  </div>
                  <button type="button" className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '0.75rem', borderRadius: '12px' }} onClick={() => setLignes(lignes.filter((_, i) => i !== idx))}><Trash2 size={20} /></button>
                </div>
              ))}
            </div>

            {lignes.length > 0 && (
              <div style={{ marginTop: '2.5rem', padding: '2rem', background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', borderRadius: '24px', color: 'white', boxShadow: '0 20px 25px -5px rgba(79, 70, 229, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', opacity: 0.9, fontWeight: 500 }}>
                  <span>Frais de livraison ({clientRecherche.commune || 'Standard'})</span>
                  <span>{fraisLivraison.toLocaleString()} CFA</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', opacity: 0.9, fontWeight: 500, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Remise / Réduction</span>
                    <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.2)', padding: '0.2rem', borderRadius: '8px' }}>
                      <button 
                        type="button" 
                        onClick={() => setRemiseType('fixe')}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, border: 'none', borderRadius: '5px', cursor: 'pointer', background: remiseType === 'fixe' ? 'white' : 'transparent', color: remiseType === 'fixe' ? 'var(--primary)' : 'white' }}
                      >CFA</button>
                      <button 
                        type="button" 
                        onClick={() => setRemiseType('pourcentage')}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, border: 'none', borderRadius: '5px', cursor: 'pointer', background: remiseType === 'pourcentage' ? 'white' : 'transparent', color: remiseType === 'pourcentage' ? 'var(--primary)' : 'white' }}
                      >%</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="number" 
                      className="form-input" 
                      style={{ width: '90px', height: '36px', fontSize: '0.9rem', background: 'white', border: 'none', color: 'var(--primary)', fontWeight: 900, borderRadius: '10px', textAlign: 'center' }} 
                      value={remiseValue} 
                      onChange={e => setRemiseValue(e.target.value === '' ? '' : Number(e.target.value))} 
                    />
                    {discountAmount > 0 && (
                      <span style={{ fontWeight: 800 }}>(-{discountAmount.toLocaleString()} CFA)</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Total à encaisser</span>
                  <span style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-1px' }}>{totalMontant.toLocaleString()} CFA</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Provenance Commande</label>
              <select className="form-select" value={source} onChange={e => setSource(e.target.value)} style={{ background: '#f8fafc', height: '48px' }}>
                <option value="Facebook">Facebook Ads</option>
                <option value="WhatsApp">WhatsApp Business</option>
                <option value="Site Web">Site E-commerce</option>
                <option value="Appel Entrant">Appel Entrant direct</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Méthode de Paiement</label>
              <select className="form-select" value={modePaiement} onChange={e => setModePaiement(e.target.value)} style={{ background: '#f8fafc', height: '48px' }}>
                <option value="Cash à la livraison">Cash à la livraison (COD)</option>
                <option value="Mobile Money">Paiement Mobile (Anticipé)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>Observations & Instructions Spéciales</label>
            <textarea className="form-input" rows={3} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '16px' }} placeholder="Ex: Livraison après 17h, appeler avant de venir..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.25rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading} style={{ padding: '0.8rem 2rem', fontWeight: 700, borderRadius: '14px' }}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.8rem 3rem', fontWeight: 800, borderRadius: '14px', fontSize: '1rem', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)' }}>
              {loading ? 'Traitement...' : editingCommande ? 'Enregistrer les modifications' : 'Confirmer la Commande'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
