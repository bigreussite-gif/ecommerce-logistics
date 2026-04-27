import React, { useState, useEffect } from 'react';
import { getFournisseurs, createFournisseur, updateFournisseur, deleteFournisseur, Fournisseur, payDebt } from '../services/fournisseurService';
import { getAchatsStock } from '../services/achatService';
import { Building2, Plus, Search, Phone, Trash2, Edit2, Wallet, X, User, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { globalEventBus, EVENTS } from '../utils/events';

export const Fournisseurs = () => {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [achats, setAchats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState<Fournisseur | null>(null);
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [formData, setFormData] = useState({
    nom: '',
    contact: '',
    telephone: '',
    adresse: ''
  });

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
    
    const unsubscribe = globalEventBus.subscribe(EVENTS.FOURNISSEURS_UPDATED, () => {
      loadData();
    });
    
    const unsubscribeAchats = globalEventBus.subscribe(EVENTS.ACHATS_UPDATED, () => {
      loadData();
    });
    
    return () => {
      unsubscribe();
      unsubscribeAchats();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fData, aData] = await Promise.all([
        getFournisseurs(),
        getAchatsStock()
      ]);
      setFournisseurs(fData);
      setAchats(aData);
    } catch (error) {
      showToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };


  const totalDette = fournisseurs.reduce((acc, f) => acc + (Number(f.solde_dette) || 0), 0);

  const getSupplierStats = (supplierId: string) => {
    const sAchats = achats.filter(a => a.fournisseur_id === supplierId);
    const cash = sAchats.filter(a => a.statut_paiement === 'Payé').reduce((acc, a) => acc + (Number(a.montant_total) || 0), 0);
    const credit = sAchats.filter(a => a.statut_paiement === 'En attente').reduce((acc, a) => acc + (Number(a.montant_total) || 0), 0);
    const itemsCount = sAchats.reduce((acc, a) => acc + (Number(a.quantite) || 0), 0);
    
    const productCounts: Record<string, number> = {};
    sAchats.forEach(a => {
      const name = a.produits?.nom || 'Inconnu';
      productCounts[name] = (productCounts[name] || 0) + Number(a.quantite);
    });
    const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return { cash, credit, itemsCount, topProduct };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFournisseur) {
        await updateFournisseur(editingFournisseur.id, formData);
        showToast('Fournisseur mis à jour avec succès', 'success');
      } else {
        await createFournisseur(formData);
        showToast('Fournisseur créé avec succès', 'success');
      }
      setIsModalOpen(false);
      setEditingFournisseur(null);
      setFormData({ nom: '', contact: '', telephone: '', adresse: '' });
      loadData();
    } catch (error) {
      showToast('Erreur lors de l\'enregistrement', 'error');
    }
  };

  const handlePayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFournisseur || !payAmount) return;
    try {
      await payDebt(selectedFournisseur.id, Number(payAmount));
      showToast('Paiement enregistré avec succès', 'success');
      setIsPayModalOpen(false);
      setPayAmount('');
      loadData();
    } catch (error) {
      showToast('Erreur lors du paiement', 'error');
    }
  };

  const handleEdit = (f: Fournisseur) => {
    setEditingFournisseur(f);
    setFormData({
      nom: f.nom,
      contact: f.contact || '',
      telephone: f.telephone || '',
      adresse: f.adresse || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      try {
        await deleteFournisseur(id);
        showToast('Fournisseur supprimé', 'success');
        loadData();
      } catch (error) {
        showToast('Erreur lors de la suppression', 'error');
      }
    }
  };

  const filtered = fournisseurs.filter(f => 
    f.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.telephone && f.telephone.includes(searchTerm))
  );

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="mobile-stack">
          <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, letterSpacing: '-0.03em' }}>Gestion Fournisseurs</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Gérez vos partenaires commerciaux et le suivi des règlements fournisseurs.
          </p>
        </div>
        <button className="btn btn-primary btn-premium-shadow" onClick={() => { setEditingFournisseur(null); setFormData({ nom: '', contact: '', telephone: '', adresse: '' }); setIsModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.6rem', borderRadius: '18px' }}>
          <Plus size={22} strokeWidth={3} /> Nouveau Partenaire
        </button>
      </div>

      <div className="res-grid-sm" style={{ marginBottom: '2.5rem' }}>
        <div className="card glass-effect hover-card" style={{ padding: '1.75rem', borderLeft: '5px solid var(--primary)' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Partenaires</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 900 }}>{fournisseurs.length}</span>
            <div style={{ padding: '0.85rem', background: 'var(--primary-light)', borderRadius: '14px', color: 'var(--primary)' }}>
              <Building2 size={26} />
            </div>
          </div>
        </div>
        <div className="card glass-effect hover-card" style={{ padding: '1.75rem', borderLeft: '5px solid #ef4444' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Encours Dette Totale</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ef4444' }}>{totalDette.toLocaleString()} <span style={{ fontSize: '1rem', opacity: 0.7 }}>F</span></span>
            <div style={{ padding: '0.85rem', background: '#fee2e2', borderRadius: '14px', color: '#ef4444' }}>
              <Wallet size={26} />
            </div>
          </div>
        </div>
      </div>

      <div className="card glass-effect" style={{ padding: '1.25rem', marginBottom: '2.5rem', borderRadius: '22px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={22} />
          <input 
            type="text" 
            placeholder="Rechercher par nom, téléphone ou contact..." 
            className="form-input"
            style={{ paddingLeft: '3.75rem', fontSize: '1.1rem', height: '3.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8rem 0' }}><div className="spinner"></div></div>
      ) : (
        <div className="res-grid">
          {filtered.map(f => {
            const fStats = getSupplierStats(f.id);
            return (
              <div key={f.id} className="card glass-effect hover-card" style={{ padding: '2rem', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 15px 30px -5px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem' }}>
                  <div style={{ background: 'linear-gradient(135deg, var(--primary), #4f46e5)', color: 'white', padding: '1rem', borderRadius: '18px', boxShadow: '0 8px 16px -4px rgba(99, 102, 255, 0.4)' }}>
                    <Building2 size={28} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={() => handleEdit(f)} className="btn-icon" style={{ background: '#f1f5f9', color: 'var(--text-main)', borderRadius: '12px', width: '40px', height: '40px', border: 'none', cursor: 'pointer' }}><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(f.id)} className="btn-icon" style={{ background: '#fef2f2', color: '#ef4444', borderRadius: '12px', width: '40px', height: '40px', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                  </div>
                </div>

                <h3 style={{ margin: '0 0 0.6rem 0', fontWeight: 900, fontSize: '1.5rem', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{f.nom}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {f.contact && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>
                      <User size={14} color="var(--primary)" /> {f.contact}
                    </div>
                  )}
                  {f.telephone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem' }}>
                      <Phone size={14} color="var(--primary)" /> {f.telephone}
                    </div>
                  )}
                </div>

                {/* Internal Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Cash</span>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981' }}>{fStats.cash.toLocaleString()}</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Crédit</span>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#f59e0b' }}>{fStats.credit.toLocaleString()}</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Articles</span>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-main)' }}>{fStats.itemsCount}</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Phare</span>
                    <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#ec4899', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fStats.topProduct}>{fStats.topProduct}</div>
                  </div>
                </div>

                <div style={{ 
                  marginTop: 'auto',
                  background: Number(f.solde_dette) > 0 ? 'linear-gradient(to right, #fff1f2, #fff)' : 'linear-gradient(to right, #f0fdf4, #fff)', 
                  padding: '1.25rem', 
                  borderRadius: '20px', 
                  border: '1.5px solid', 
                  borderColor: Number(f.solde_dette) > 0 ? '#fecaca' : '#bbf7d0', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: Number(f.solde_dette) > 0 ? '#be123c' : '#15803d', display: 'block', letterSpacing: '0.08em', marginBottom: '0.15rem' }}>Solde Dû</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 950, color: Number(f.solde_dette) > 0 ? '#be123c' : '#15803d' }}>{Number(f.solde_dette || 0).toLocaleString()} <span style={{ fontSize: '0.8rem' }}>F</span></span>
                  </div>
                  {Number(f.solde_dette) > 0 && (
                    <button 
                      onClick={() => { setSelectedFournisseur(f); setPayAmount(f.solde_dette.toString()); setIsPayModalOpen(true); }}
                      className="btn btn-primary" 
                      style={{ padding: '0.6rem 1rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, width: 'auto' }}
                    >
                      Régler <ArrowRight size={16} strokeWidth={3} />
                    </button>
                  )}
                  {(!f.solde_dette || Number(f.solde_dette) <= 0) && <div style={{ color: '#15803d', opacity: 0.5 }}><CheckCircle2 size={28} /></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Fournisseur Refined */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--primary), #4f46e5)', padding: '2.5rem', color: 'white', position: 'relative' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.6rem', borderRadius: '14px', cursor: 'pointer' }}><X size={22} /></button>
              <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>{editingFournisseur ? 'Éditer le Partenaire' : 'Nouveau Fournisseur'}</h2>
              <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '1rem', fontWeight: 500 }}>Coordonnées du partenaire commercial.</p>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '2.5rem' }}>
              <div className="form-group">
                <label className="form-label">Nom de l'entreprise *</label>
                <input type="text" className="form-input" required value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} style={{ borderRadius: '14px', height: '3.6rem', fontWeight: 600 }} placeholder="Ex: SOGEBOX S.A." />
              </div>
              <div className="res-grid-sm" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Nom du contact</label>
                  <input type="text" className="form-input" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} style={{ borderRadius: '14px', height: '3.6rem', fontWeight: 600 }} placeholder="Responsable" />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input type="text" className="form-input" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} style={{ borderRadius: '14px', height: '3.6rem', fontWeight: 600 }} placeholder="+224..." />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                <label className="form-label">Adresse / Bureau</label>
                <textarea className="form-input" rows={2} value={formData.adresse} onChange={e => setFormData({...formData, adresse: e.target.value})} style={{ borderRadius: '14px', padding: '1.25rem', fontWeight: 500 }} placeholder="Ville, Quartier, Secteur..." />
              </div>
              <div className="mobile-stack" style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} style={{ flex: 1, height: '4rem', borderRadius: '16px', fontWeight: 800 }}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1.5, height: '4rem', borderRadius: '16px', fontWeight: 900, fontSize: '1.1rem' }}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Paiement Dette Refined */}
      {isPayModalOpen && selectedFournisseur && (
        <div className="modal-backdrop">
          <div className="modal-content card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: '#be123c', padding: '2.5rem', color: 'white', position: 'relative' }}>
              <button onClick={() => setIsPayModalOpen(false)} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.6rem', borderRadius: '14px', cursor: 'pointer' }}><X size={22} /></button>
              <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900 }}>Régler une Dette</h2>
              <p style={{ margin: '0.4rem 0 0 0', opacity: 0.9, fontSize: '1rem', fontWeight: 500 }}>Versement pour : {selectedFournisseur.nom}</p>
            </div>
            <form onSubmit={handlePayDebt} style={{ padding: '2.5rem' }}>
              <div style={{ background: '#fff1f2', padding: '1.5rem', borderRadius: '22px', marginBottom: '2rem', textAlign: 'center', border: '1.5px dashed #fecaca' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#be123c', textTransform: 'uppercase' }}>Dette Actuelle</span>
                <div style={{ fontSize: '2.2rem', fontWeight: 950, color: '#be123c', marginTop: '0.2rem' }}>{Number(selectedFournisseur.solde_dette).toLocaleString()} F</div>
              </div>
              <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>Montant du versement (F)</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    required 
                    autoFocus
                    value={payAmount} 
                    onChange={e => setPayAmount(e.target.value)} 
                    style={{ borderRadius: '18px', height: '4rem', fontSize: '1.6rem', fontWeight: 950, textAlign: 'center', color: '#be123c' }} 
                  />
                </div>
              </div>
              <div className="mobile-stack" style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsPayModalOpen(false)} style={{ flex: 1, height: '4rem', borderRadius: '18px', fontWeight: 800 }}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1.5, height: '4rem', borderRadius: '18px', fontWeight: 900, background: '#be123c', border: 'none' }}>Confirmer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
