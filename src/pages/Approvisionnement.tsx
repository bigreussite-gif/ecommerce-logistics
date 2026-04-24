import React, { useState, useEffect } from 'react';
import { getAchatsStock, registerAchatStock } from '../services/achatService';
import { getFournisseurs, Fournisseur } from '../services/fournisseurService';
import { getProduits } from '../services/produitService';
import { Produit } from '../types';
import { Plus, CreditCard, DollarSign } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const Approvisionnement = () => {
  const [achats, setAchats] = useState<any[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    produit_id: '',
    fournisseur_id: '',
    quantite: 1,
    prix_achat_unitaire: 0,
    mode_paiement: 'Cash' as 'Cash' | 'Crédit',
    statut_paiement: 'Payé' as 'Payé' | 'En attente'
  });

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [achatsData, produitsData, fournisseursData] = await Promise.all([
        getAchatsStock(),
        getProduits(),
        getFournisseurs()
      ]);
      setAchats(achatsData);
      setProduits(produitsData);
      setFournisseurs(fournisseursData);
    } catch (error) {
      showToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.produit_id || !formData.fournisseur_id) {
      showToast('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    try {
      const montant_total = formData.quantite * formData.prix_achat_unitaire;
      await registerAchatStock({
        ...formData,
        montant_total
      });
      showToast('Approvisionnement enregistré avec succès', 'success');
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      showToast('Erreur lors de l\'enregistrement', 'error');
    }
  };

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>Approvisionnement Stock</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem' }}>
            Enregistrez vos achats de marchandises et gérez les flux financiers.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={20} /> Nouvel Achat
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Chargement...</div>
      ) : (
        <div className="card glass-effect" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Produit</th>
                  <th>Fournisseur</th>
                  <th>Qté</th>
                  <th>Prix Unitaire</th>
                  <th>Total</th>
                  <th>Mode</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {achats.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>Aucun achat enregistré.</td></tr>
                ) : (
                  achats.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontSize: '0.85rem' }}>{format(new Date(a.date_achat), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                      <td style={{ fontWeight: 700 }}>{a.produits?.nom || 'Produit inconnu'}</td>
                      <td>{a.fournisseurs?.nom || 'Fournisseur inconnu'}</td>
                      <td style={{ fontWeight: 700 }}>{a.quantite}</td>
                      <td>{Number(a.prix_achat_unitaire).toLocaleString()} F</td>
                      <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{Number(a.montant_total).toLocaleString()} F</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700 }}>
                          {a.mode_paiement === 'Cash' ? <DollarSign size={14} color="#10b981" /> : <CreditCard size={14} color="#f59e0b" />}
                          {a.mode_paiement}
                        </span>
                      </td>
                      <td>
                        <span style={{ 
                          padding: '0.3rem 0.6rem', 
                          borderRadius: '20px', 
                          fontSize: '0.7rem', 
                          fontWeight: 800, 
                          background: a.statut_paiement === 'Payé' ? '#d1fae5' : '#fef3c7',
                          color: a.statut_paiement === 'Payé' ? '#065f46' : '#92400e'
                        }}>
                          {a.statut_paiement}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal d'achat */}
      {isModalOpen && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content card" style={{ width: '100%', maxWidth: '600px', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', fontWeight: 900 }}>Nouvel Approvisionnement</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label>Produit *</label>
                  <select className="input" required value={formData.produit_id} onChange={e => setFormData({...formData, produit_id: e.target.value})}>
                    <option value="">Sélectionner...</option>
                    {produits.map(p => <option key={p.id} value={p.id}>{p.nom} (Stock: {p.stock_actuel})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Fournisseur *</label>
                  <select className="input" required value={formData.fournisseur_id} onChange={e => setFormData({...formData, fournisseur_id: e.target.value})}>
                    <option value="">Sélectionner...</option>
                    {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label>Quantité *</label>
                  <input type="number" className="input" required min="1" value={formData.quantite} onChange={e => setFormData({...formData, quantite: Number(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label>Prix Achat Unitaire *</label>
                  <input type="number" className="input" required min="0" value={formData.prix_achat_unitaire} onChange={e => setFormData({...formData, prix_achat_unitaire: Number(e.target.value)})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="form-group">
                  <label>Mode de Paiement</label>
                  <select className="input" value={formData.mode_paiement} onChange={e => {
                    const mode = e.target.value as 'Cash' | 'Crédit';
                    setFormData({...formData, mode_paiement: mode, statut_paiement: mode === 'Cash' ? 'Payé' : 'En attente'});
                  }}>
                    <option value="Cash">Cash</option>
                    <option value="Crédit">Crédit</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Statut Paiement</label>
                  <select className="input" value={formData.statut_paiement} onChange={e => setFormData({...formData, statut_paiement: e.target.value as any})}>
                    <option value="Payé">Payé</option>
                    <option value="En attente">En attente</option>
                  </select>
                </div>
              </div>

              <div style={{ padding: '1.5rem', background: 'var(--primary-light)', borderRadius: '14px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>TOTAL À RÉGLER :</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)' }}>{(formData.quantite * formData.prix_achat_unitaire).toLocaleString()} F</span>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} style={{ flex: 1 }}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Valider l'Approvisionnement</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
