import React, { useState, useEffect } from 'react';
import { getAchatsStock, registerAchatStock } from '../services/achatService';
import { getFournisseurs, Fournisseur } from '../services/fournisseurService';
import { getProduits } from '../services/produitService';
import { Produit } from '../types';
import { Plus, Search, Calendar, Package, ArrowRight, CreditCard, DollarSign, X, Filter, ShoppingBag, ArrowUpRight, CheckCircle2 } from 'lucide-react';
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
            Tracez vos entrées en stock et gérez vos flux financiers partenaires.
          </p>
        </div>
        <button className="btn btn-primary btn-premium-shadow" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.8rem', borderRadius: '18px' }}>
          <Plus size={22} strokeWidth={3} /> Nouvel Approvisionnement
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card glass-effect hover-card" style={{ padding: '1.75rem', borderLeft: '5px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--primary-light)', borderRadius: '14px', color: 'var(--primary)' }}>
              <ShoppingBag size={24} />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total des Achats</span>
          </div>
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-main)' }}>{stats.total.toLocaleString()} <span style={{ fontSize: '1rem', opacity: 0.6 }}>F</span></span>
        </div>
        <div className="card glass-effect hover-card" style={{ padding: '1.75rem', borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ padding: '0.75rem', background: '#dcfce7', borderRadius: '14px', color: '#10b981' }}>
              <DollarSign size={24} />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Règlements Cash</span>
          </div>
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#10b981' }}>{stats.cash.toLocaleString()} <span style={{ fontSize: '1rem', opacity: 0.6 }}>F</span></span>
        </div>
        <div className="card glass-effect hover-card" style={{ padding: '1.75rem', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ padding: '0.75rem', background: '#fef3c7', borderRadius: '14px', color: '#f59e0b' }}>
              <CreditCard size={24} />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Engagement Crédit</span>
          </div>
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f59e0b' }}>{stats.credit.toLocaleString()} <span style={{ fontSize: '1rem', opacity: 0.6 }}>F</span></span>
        </div>
      </div>

      {/* Filter Row */}
      <div className="card glass-effect" style={{ padding: '1.25rem', marginBottom: '2.5rem', borderRadius: '22px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={22} />
          <input 
            type="text" 
            placeholder="Rechercher par produit ou par fournisseur..." 
            className="form-input"
            style={{ paddingLeft: '3.75rem', height: '3.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-outline" style={{ height: '3.5rem', borderRadius: '16px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700 }}>
          <Filter size={20} /> Filtres Avancés
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10rem 0', gap: '1.5rem' }}>
          <div className="spinner"></div>
          <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Synchronisation des stocks...</p>
        </div>
      ) : (
        <div className="card glass-effect" style={{ padding: 0, overflow: 'hidden', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)' }}>
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.05em' }}>Horodatage</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.05em' }}>Article / Référence</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.05em' }}>Fournisseur</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.05em' }}>Quantité</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'right', letterSpacing: '0.05em' }}>P.U. Achat</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'right', letterSpacing: '0.05em' }}>Investissement</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.05em' }}>Méthode</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.05em' }}>État</th>
                </tr>
              </thead>
              <tbody>
                {filteredAchats.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '6rem', color: 'var(--text-muted)', fontWeight: 600 }}>Aucune trace d'approvisionnement détectée.</td></tr>
                ) : (
                  filteredAchats.map(a => (
                    <tr key={a.id} className="table-row-hover">
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <Calendar size={15} opacity={0.6} />
                          {format(new Date(a.date_achat), 'dd MMM yyyy • HH:mm', { locale: fr })}
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ padding: '0.6rem', background: 'var(--primary-light)', borderRadius: '10px', color: 'var(--primary)' }}><Package size={18} /></div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 900, color: 'var(--text-main)', fontSize: '1.05rem' }}>{a.produits?.nom || 'Produit inconnu'}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>REF-{a.id.slice(0, 8).toUpperCase()}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{a.fournisseurs?.nom || 'Partenaire Inconnu'}</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        <span style={{ padding: '0.4rem 0.8rem', background: '#f1f5f9', color: 'var(--text-main)', borderRadius: '10px', fontWeight: 900, fontSize: '1rem' }}>{a.quantite}</span>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>{Number(a.prix_achat_unitaire).toLocaleString()} F</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: 900, fontSize: '1.15rem', color: 'var(--primary)' }}>{Number(a.montant_total).toLocaleString()} F</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: '12px', background: a.mode_paiement === 'Cash' ? '#ecfdf5' : '#fffbeb', border: '1px solid', borderColor: a.mode_paiement === 'Cash' ? '#10b981' : '#f59e0b' }}>
                          {a.mode_paiement === 'Cash' ? <DollarSign size={14} color="#10b981" /> : <CreditCard size={14} color="#f59e0b" />}
                          <span style={{ fontSize: '0.75rem', fontWeight: 900, color: a.mode_paiement === 'Cash' ? '#065f46' : '#92400e' }}>{a.mode_paiement.toUpperCase()}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        <span style={{ 
                          padding: '0.4rem 1rem', 
                          borderRadius: '12px', 
                          fontSize: '0.7rem', 
                          fontWeight: 900, 
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          background: a.statut_paiement === 'Payé' ? '#d1fae5' : '#fee2e2',
                          color: a.statut_paiement === 'Payé' ? '#065f46' : '#991b1b',
                          border: '1px solid',
                          borderColor: a.statut_paiement === 'Payé' ? '#10b981' : '#fecaca'
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

      {/* Modal d'achat Refined */}
      {isModalOpen && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(12px)', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="modal-content card" style={{ width: '100%', maxWidth: '750px', padding: 0, borderRadius: '32px', overflow: 'hidden', border: 'none', boxShadow: '0 30px 60px -15px rgba(0,0,0,0.3)' }}>
            
            {/* Header with Gradient */}
            <div style={{ background: 'linear-gradient(135deg, var(--primary), #4f46e5)', padding: '3rem 2.5rem', color: 'white', position: 'relative' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', right: '1.75rem', top: '1.75rem', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '0.6rem', borderRadius: '14px', cursor: 'pointer', transition: 'all 0.2s' }} className="hover-scale"><X size={22} /></button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.2)', borderRadius: '22px', backdropFilter: 'blur(10px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}><ShoppingBag size={40} /></div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>Nouvel Approvisionnement</h2>
                  <p style={{ margin: '0.4rem 0 0 0', opacity: 0.9, fontSize: '1.1rem', fontWeight: 500 }}>Enregistrez une entrée de stock et gérez le flux financier.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '2.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Produit à approvisionner *</label>
                  <select className="form-select" required value={formData.produit_id} onChange={e => setFormData({...formData, produit_id: e.target.value})} style={{ borderRadius: '16px', height: '3.8rem', fontWeight: 600 }}>
                    <option value="">Sélectionnez un produit...</option>
                    {produits.map(p => <option key={p.id} value={p.id}>{p.nom} (Stock actuel : {p.stock_actuel})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fournisseur Partenaire *</label>
                  <select className="form-select" required value={formData.fournisseur_id} onChange={e => setFormData({...formData, fournisseur_id: e.target.value})} style={{ borderRadius: '16px', height: '3.8rem', fontWeight: 600 }}>
                    <option value="">Sélectionnez un fournisseur...</option>
                    {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Quantité Reçue *</label>
                  <input type="number" className="form-input" required min="1" value={formData.quantite} onChange={e => setFormData({...formData, quantite: Number(e.target.value)})} style={{ borderRadius: '16px', height: '3.8rem', fontWeight: 800, fontSize: '1.2rem', textAlign: 'center' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Prix d'Achat Unitaire (F) *</label>
                  <input type="number" className="form-input" required min="0" value={formData.prix_achat_unitaire} onChange={e => setFormData({...formData, prix_achat_unitaire: Number(e.target.value)})} style={{ borderRadius: '16px', height: '3.8rem', fontWeight: 800, fontSize: '1.2rem', textAlign: 'center' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Mode de Règlement</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" onClick={() => setFormData({...formData, mode_paiement: 'Cash', statut_paiement: 'Payé'})} style={{ flex: 1, height: '3.8rem', borderRadius: '16px', border: '2px solid', borderColor: formData.mode_paiement === 'Cash' ? 'var(--primary)' : '#e2e8f0', background: formData.mode_paiement === 'Cash' ? 'var(--primary-light)' : 'white', color: formData.mode_paiement === 'Cash' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', fontSize: '1rem' }}>CASH</button>
                    <button type="button" onClick={() => setFormData({...formData, mode_paiement: 'Crédit', statut_paiement: 'En attente'})} style={{ flex: 1, height: '3.8rem', borderRadius: '16px', border: '2px solid', borderColor: formData.mode_paiement === 'Crédit' ? '#f59e0b' : '#e2e8f0', background: formData.mode_paiement === 'Crédit' ? '#fef3c7' : 'white', color: formData.mode_paiement === 'Crédit' ? '#92400e' : 'var(--text-muted)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', fontSize: '1rem' }}>CRÉDIT</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Statut de Paiement</label>
                  <select className="form-select" value={formData.statut_paiement} onChange={e => setFormData({...formData, statut_paiement: e.target.value as any})} style={{ borderRadius: '16px', height: '3.8rem', background: '#f8fafc', fontWeight: 700 }}>
                    <option value="Payé">✅ Entièrement réglé</option>
                    <option value="En attente">⏳ Paiement en attente / Dette</option>
                  </select>
                </div>
              </div>

              {/* Total Card */}
              <div style={{ padding: '2.5rem', background: 'linear-gradient(to right, #f1f5f9, #fff)', borderRadius: '28px', marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)' }}>
                <div>
                  <span style={{ fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '0.08em' }}>Investissement Total</span>
                  <div style={{ fontSize: '2.8rem', fontWeight: 950, color: 'var(--primary)', marginTop: '0.4rem', letterSpacing: '-0.02em' }}>{(formData.quantite * formData.prix_achat_unitaire).toLocaleString()} <span style={{ fontSize: '1.2rem', opacity: 0.7 }}>F</span></div>
                </div>
                <div style={{ width: '70px', height: '70px', borderRadius: '22px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 15px 30px -5px var(--primary-glow)' }}>
                  <ArrowUpRight size={36} strokeWidth={3} />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} style={{ flex: 1, height: '4.2rem', borderRadius: '18px', fontWeight: 800, fontSize: '1.1rem' }}>Annuler</button>
                <button type="submit" className="btn btn-primary btn-premium-shadow" style={{ flex: 1.8, height: '4.2rem', borderRadius: '18px', fontWeight: 900, fontSize: '1.2rem', letterSpacing: '0.02em' }}>
                  <CheckCircle2 size={24} style={{ marginRight: '0.5rem' }} /> Valider l'Approvisionnement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
