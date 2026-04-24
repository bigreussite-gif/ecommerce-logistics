import React, { useState, useEffect } from 'react';
import { getFournisseurs, createFournisseur, updateFournisseur, deleteFournisseur, Fournisseur, payDebt } from '../services/fournisseurService';
import { Building2, Plus, Search, Phone, MapPin, Trash2, Edit2, Wallet, X, User, ArrowRight } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export const Fournisseurs = () => {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
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
    loadFournisseurs();
  }, []);

  const loadFournisseurs = async () => {
    try {
      setLoading(true);
      const data = await getFournisseurs();
      setFournisseurs(data);
    } catch (error) {
      showToast('Erreur lors du chargement des fournisseurs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalDette = fournisseurs.reduce((acc, f) => acc + (Number(f.solde_dette) || 0), 0);

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
      loadFournisseurs();
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
      loadFournisseurs();
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
        loadFournisseurs();
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, letterSpacing: '-0.03em' }}>Fournisseurs</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Gérez vos partenaires commerciaux et le suivi des règlements.
          </p>
        </div>
        <button className="btn btn-primary btn-premium-shadow" onClick={() => { setEditingFournisseur(null); setFormData({ nom: '', contact: '', telephone: '', adresse: '' }); setIsModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.5rem', borderRadius: '16px' }}>
          <Plus size={22} strokeWidth={2.5} /> Nouveau Fournisseur
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '5px solid var(--primary)' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Partenaires</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 900 }}>{fournisseurs.length}</span>
            <div style={{ padding: '0.75rem', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}>
              <Building2 size={24} />
            </div>
          </div>
        </div>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '5px solid #ef4444' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dette Fournisseur Totale</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444' }}>{totalDette.toLocaleString()} F</span>
            <div style={{ padding: '0.75rem', background: '#fee2e2', borderRadius: '12px', color: '#ef4444' }}>
              <Wallet size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="card glass-effect" style={{ padding: '1.25rem', marginBottom: '2rem', borderRadius: '20px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={22} />
          <input 
            type="text" 
            placeholder="Rechercher par nom, téléphone ou contact..." 
            className="input"
            style={{ paddingLeft: '3.5rem', fontSize: '1.1rem', height: '3.5rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}><div className="spinner"></div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.75rem' }}>
          {filtered.map(f => (
            <div key={f.id} className="card glass-effect hover-card" style={{ padding: '1.75rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-glow))', color: 'white', padding: '0.85rem', borderRadius: '16px', boxShadow: '0 8px 16px -4px var(--primary-glow)' }}>
                  <Building2 size={26} />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => handleEdit(f)} className="btn-icon" style={{ background: '#f1f5f9', color: 'var(--text-main)', borderRadius: '12px' }}><Edit2 size={18} /></button>
                  <button onClick={() => handleDelete(f.id)} className="btn-icon" style={{ background: '#fef2f2', color: '#ef4444', borderRadius: '12px' }}><Trash2 size={18} /></button>
                </div>
              </div>

              <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 900, fontSize: '1.4rem', color: 'var(--text-main)' }}>{f.nom}</h3>
              {f.contact && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.95rem' }}>
                  <User size={16} /> {f.contact}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Phone size={16} /></div>
                  {f.telephone || 'Non renseigné'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MapPin size={16} /></div>
                  {f.adresse || 'Pas d\'adresse enregistrée'}
                </div>
              </div>

              <div style={{ 
                background: Number(f.solde_dette) > 0 ? 'linear-gradient(to right, #fff1f2, #fff)' : 'linear-gradient(to right, #f0fdf4, #fff)', 
                padding: '1.25rem', 
                borderRadius: '20px', 
                border: '1px solid', 
                borderColor: Number(f.solde_dette) > 0 ? '#fecaca' : '#bbf7d0', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.02)'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: Number(f.solde_dette) > 0 ? '#be123c' : '#15803d', display: 'block', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Solde Dû</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 900, color: Number(f.solde_dette) > 0 ? '#be123c' : '#15803d' }}>{Number(f.solde_dette || 0).toLocaleString()} F</span>
                </div>
                {Number(f.solde_dette) > 0 && (
                  <button 
                    onClick={() => { setSelectedFournisseur(f); setPayAmount(f.solde_dette.toString()); setIsPayModalOpen(true); }}
                    className="btn btn-primary" 
                    style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    Régler <ArrowRight size={16} strokeWidth={3} />
                  </button>
                )}
                {(!f.solde_dette || Number(f.solde_dette) <= 0) && <div style={{ color: '#15803d' }}><Wallet size={28} opacity={0.3} /></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Fournisseur */}
      {isModalOpen && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-content card" style={{ width: '100%', maxWidth: '550px', padding: 0, borderRadius: '28px', overflow: 'hidden', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ background: 'var(--primary)', padding: '2rem', color: 'white', position: 'relative' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '12px', cursor: 'pointer' }}><X size={20} /></button>
              <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900 }}>{editingFournisseur ? 'Éditer Partenaire' : 'Nouveau Fournisseur'}</h2>
              <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8, fontSize: '0.95rem' }}>Veuillez renseigner les informations de votre fournisseur.</p>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>Nom de l'entreprise *</label>
                <input type="text" className="input" required value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} style={{ borderRadius: '12px', height: '3.2rem' }} placeholder="Ex: SOGEBOX S.A." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>Nom du contact</label>
                  <input type="text" className="input" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} style={{ borderRadius: '12px', height: '3.2rem' }} placeholder="Nom du responsable" />
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>Téléphone</label>
                  <input type="text" className="input" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} style={{ borderRadius: '12px', height: '3.2rem' }} placeholder="+224..." />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>Adresse complète</label>
                <textarea className="input" rows={3} value={formData.adresse} onChange={e => setFormData({...formData, adresse: e.target.value})} style={{ borderRadius: '12px', padding: '1rem' }} placeholder="Ville, Quartier, Rue..." />
              </div>
              <div style={{ display: 'flex', gap: '1.25rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} style={{ flex: 1, height: '3.5rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontWeight: 700 }}>Annuler</button>
                <button type="submit" className="btn btn-primary btn-premium-shadow" style={{ flex: 1, height: '3.5rem', borderRadius: '14px', fontWeight: 800 }}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Paiement Dette */}
      {isPayModalOpen && selectedFournisseur && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-content card" style={{ width: '100%', maxWidth: '450px', padding: 0, borderRadius: '28px', overflow: 'hidden', border: 'none' }}>
            <div style={{ background: '#be123c', padding: '2rem', color: 'white', position: 'relative' }}>
              <button onClick={() => setIsPayModalOpen(false)} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '12px', cursor: 'pointer' }}><X size={20} /></button>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>Régler une Dette</h2>
              <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8, fontSize: '0.9rem' }}>{selectedFournisseur.nom}</p>
            </div>
            <form onSubmit={handlePayDebt} style={{ padding: '2rem' }}>
              <div style={{ background: '#fff1f2', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem', textAlign: 'center', border: '1px dashed #fecaca' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#be123c', textTransform: 'uppercase' }}>Dette Actuelle</span>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#be123c' }}>{Number(selectedFournisseur.solde_dette).toLocaleString()} F</div>
              </div>
              <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>Montant à verser (F)</label>
                <input 
                  type="number" 
                  className="input" 
                  required 
                  autoFocus
                  value={payAmount} 
                  onChange={e => setPayAmount(e.target.value)} 
                  style={{ borderRadius: '12px', height: '3.5rem', fontSize: '1.25rem', fontWeight: 800, textAlign: 'center' }} 
                />
              </div>
              <div style={{ display: 'flex', gap: '1.25rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsPayModalOpen(false)} style={{ flex: 1, height: '3.5rem', borderRadius: '14px', fontWeight: 700 }}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, height: '3.5rem', borderRadius: '14px', fontWeight: 800, background: '#be123c', border: 'none' }}>Valider le Paiement</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
