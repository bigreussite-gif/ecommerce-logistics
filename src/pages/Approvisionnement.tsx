import React, { useState, useEffect } from 'react';
import { getAchatsStock, registerAchatStock } from '../services/achatService';
import { getFournisseurs, Fournisseur } from '../services/fournisseurService';
import { getProduits } from '../services/produitService';
import { Produit } from '../types';
import { Plus, Search, Calendar, Package, ArrowRight, CreditCard, DollarSign, X, Filter, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const Approvisionnement = () => {
  const [achats, setAchats] = useState<any[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredAchats = achats.filter(a => 
    a.produits?.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.fournisseurs?.nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: achats.reduce((acc, a) => acc + (Number(a.montant_total) || 0), 0),
    cash: achats.filter(a => a.mode_paiement === 'Cash').reduce((acc, a) => acc + (Number(a.montant_total) || 0), 0),
    credit: achats.filter(a => a.mode_paiement === 'Crédit').reduce((acc, a) => acc + (Number(a.montant_total) || 0), 0),
  };

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, letterSpacing: '-0.03em' }}>Approvisionnement</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Tracez vos entrées en stock et gérez vos coûts d'achat.
          </p>
        </div>
        <button className="btn btn-primary btn-premium-shadow" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.5rem', borderRadius: '16px' }}>
          <Plus size={22} strokeWidth={3} /> Nouvel Achat
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card glass-effect" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #fff, #f8fafc)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}>
              <ShoppingBag size={24} />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume Total Achats</span>
          </div>
          <span style={{ fontSize: '2rem', fontWeight: 900 }}>{stats.total.toLocaleString()} F</span>
        </div>
        <div className="card glass-effect" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #fff, #f0fdf4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', background: '#dcfce7', borderRadius: '12px', color: '#10b981' }}>
              <DollarSign size={24} />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paiements Cash</span>
          </div>
          <span style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981' }}>{stats.cash.toLocaleString()} F</span>
        </div>
        <div className="card glass-effect" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #fff, #fef3c7)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', background: '#fef3c7', borderRadius: '12px', color: '#f59e0b' }}>
              <CreditCard size={24} />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Achats à Crédit</span>
          </div>
          <span style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b' }}>{stats.credit.toLocaleString()} F</span>
        </div>
      </div>

      <div className="card glass-effect" style={{ padding: '1.25rem', marginBottom: '2rem', borderRadius: '20px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
          <input 
            type="text" 
            placeholder="Rechercher par produit ou fournisseur..." 
            className="input"
            style={{ paddingLeft: '3.5rem', fontSize: '1.05rem', height: '3.2rem', borderRadius: '14px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-outline" style={{ height: '3.2rem', borderRadius: '14px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={18} /> Filtres
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}><div className="spinner"></div></div>
      ) : (
        <div className="card glass-effect" style={{ padding: 0, overflow: 'hidden', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.8)' }}>
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'left' }}>Date & Heure</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'left' }}>Désignation Produit</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'left' }}>Fournisseur</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Qté</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Prix Unit.</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right' }}>Montant Total</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Mode</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>Paiement</th>
                </tr>
              </thead>
              <tbody>
                {filteredAchats.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', fontWeight: 500 }}>Aucune opération d'approvisionnement trouvée.</td></tr>
                ) : (
                  filteredAchats.map(a => (
                    <tr key={a.id} className="table-row-hover">
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={14} />
                          {format(new Date(a.date_achat), 'dd MMM yyyy HH:mm', { locale: fr })}
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ padding: '0.5rem', background: '#f1f5f9', borderRadius: '8px', color: 'var(--primary)' }}><Package size={16} /></div>
                          <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem' }}>{a.produits?.nom || 'Produit inconnu'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{a.fournisseurs?.nom || 'Fournisseur inconnu'}</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        <span style={{ padding: '0.35rem 0.75rem', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '8px', fontWeight: 900, fontSize: '0.95rem' }}>{a.quantite}</span>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: 600 }}>{Number(a.prix_achat_unitaire).toLocaleString()} F</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)' }}>{Number(a.montant_total).toLocaleString()} F</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: '10px', background: a.mode_paiement === 'Cash' ? '#ecfdf5' : '#fffbeb', border: '1px solid', borderColor: a.mode_paiement === 'Cash' ? '#10b981' : '#f59e0b' }}>
                          {a.mode_paiement === 'Cash' ? <DollarSign size={14} color="#10b981" /> : <CreditCard size={14} color="#f59e0b" />}
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: a.mode_paiement === 'Cash' ? '#065f46' : '#92400e' }}>{a.mode_paiement}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        <span style={{ 
                          padding: '0.4rem 0.85rem', 
                          borderRadius: '20px', 
                          fontSize: '0.7rem', 
                          fontWeight: 900, 
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
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
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-content card" style={{ width: '100%', maxWidth: '700px', padding: 0, borderRadius: '28px', overflow: 'hidden', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-glow))', padding: '2.5rem', color: 'white', position: 'relative' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '12px', cursor: 'pointer' }}><X size={20} /></button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.2)', borderRadius: '16px' }}><ShoppingBag size={32} /></div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 900 }}>Nouvel Achat</h2>
                  <p style={{ margin: '0.25rem 0 0 0', opacity: 0.8, fontSize: '1rem' }}>Enregistrez une entrée de stock fournisseur.</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '2.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.6rem', display: 'block' }}>Produit à approvisionner *</label>
                  <select className="input" required value={formData.produit_id} onChange={e => setFormData({...formData, produit_id: e.target.value})} style={{ borderRadius: '14px', height: '3.5rem' }}>
                    <option value="">Choisir un produit...</option>
                    {produits.map(p => <option key={p.id} value={p.id}>{p.nom} (Stock act: {p.stock_actuel})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.6rem', display: 'block' }}>Fournisseur partenaire *</label>
                  <select className="input" required value={formData.fournisseur_id} onChange={e => setFormData({...formData, fournisseur_id: e.target.value})} style={{ borderRadius: '14px', height: '3.5rem' }}>
                    <option value="">Choisir un fournisseur...</option>
                    {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.6rem', display: 'block' }}>Quantité d'unités *</label>
                  <input type="number" className="input" required min="1" value={formData.quantite} onChange={e => setFormData({...formData, quantite: Number(e.target.value)})} style={{ borderRadius: '14px', height: '3.5rem', fontWeight: 700 }} />
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.6rem', display: 'block' }}>Prix d'achat unitaire (F) *</label>
                  <input type="number" className="input" required min="0" value={formData.prix_achat_unitaire} onChange={e => setFormData({...formData, prix_achat_unitaire: Number(e.target.value)})} style={{ borderRadius: '14px', height: '3.5rem', fontWeight: 700 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.6rem', display: 'block' }}>Mode de règlement</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" onClick={() => setFormData({...formData, mode_paiement: 'Cash', statut_paiement: 'Payé'})} style={{ flex: 1, height: '3.5rem', borderRadius: '14px', border: '2px solid', borderColor: formData.mode_paiement === 'Cash' ? 'var(--primary)' : '#e2e8f0', background: formData.mode_paiement === 'Cash' ? 'var(--primary-light)' : 'white', color: formData.mode_paiement === 'Cash' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>Cash</button>
                    <button type="button" onClick={() => setFormData({...formData, mode_paiement: 'Crédit', statut_paiement: 'En attente'})} style={{ flex: 1, height: '3.5rem', borderRadius: '14px', border: '2px solid', borderColor: formData.mode_paiement === 'Crédit' ? '#f59e0b' : '#e2e8f0', background: formData.mode_paiement === 'Crédit' ? '#fef3c7' : 'white', color: formData.mode_paiement === 'Crédit' ? '#92400e' : 'var(--text-muted)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>Crédit</button>
                  </div>
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.6rem', display: 'block' }}>Statut de Paiement</label>
                  <select className="input" value={formData.statut_paiement} onChange={e => setFormData({...formData, statut_paiement: e.target.value as any})} style={{ borderRadius: '14px', height: '3.5rem', background: '#f8fafc' }}>
                    <option value="Payé">Payé / Réglé</option>
                    <option value="En attente">En attente / Impayé</option>
                  </select>
                </div>
              </div>

              <div style={{ padding: '2rem', background: 'linear-gradient(to right, var(--primary-light), #fff)', borderRadius: '24px', marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--primary-light)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)' }}>
                <div>
                  <span style={{ fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em' }}>Total à régler au fournisseur</span>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--primary)', marginTop: '0.25rem' }}>{(formData.quantite * formData.prix_achat_unitaire).toLocaleString()} F</div>
                </div>
                <div style={{ width: '60px', height: '60px', borderRadius: '20px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 20px -5px var(--primary-glow)' }}>
                  <ArrowUpRight size={32} strokeWidth={3} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.25rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} style={{ flex: 1, height: '4rem', borderRadius: '16px', fontWeight: 700, fontSize: '1.1rem' }}>Annuler</button>
                <button type="submit" className="btn btn-primary btn-premium-shadow" style={{ flex: 1.5, height: '4rem', borderRadius: '16px', fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.02em' }}>Valider l'Approvisionnement</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
