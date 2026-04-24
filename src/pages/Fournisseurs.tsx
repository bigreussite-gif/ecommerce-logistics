import React, { useState, useEffect } from 'react';
import { getFournisseurs, createFournisseur, updateFournisseur, deleteFournisseur, Fournisseur } from '../services/fournisseurService';
import { Building2, Plus, Search, Phone, Mail, MapPin, Trash2, Edit2, Wallet } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export const Fournisseurs = () => {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState<Fournisseur | null>(null);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>Gestion Fournisseurs</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem' }}>
            Suivi des partenaires et des dettes d'approvisionnement.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingFournisseur(null); setFormData({ nom: '', contact: '', telephone: '', adresse: '' }); setIsModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={20} /> Nouveau Fournisseur
        </button>
      </div>

      <div className="card glass-effect" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
          <input 
            type="text" 
            placeholder="Rechercher par nom ou téléphone..." 
            className="input"
            style={{ paddingLeft: '3rem', fontSize: '1.05rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Chargement...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filtered.map(f => (
            <div key={f.id} className="card glass-effect hover-card" style={{ padding: '1.5rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.75rem', borderRadius: '12px' }}>
                  <Building2 size={24} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleEdit(f)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={18} /></button>
                  <button onClick={() => handleDelete(f)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={18} /></button>
                </div>
              </div>

              <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '1.25rem' }}>{f.nom}</h3>
              {f.contact && <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Contact: {f.contact}</p>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <Phone size={16} /> {f.telephone || 'Non renseigné'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <MapPin size={16} /> {f.adresse || 'Pas d\'adresse'}
                </div>
              </div>

              <div style={{ background: f.solde_dette > 0 ? '#fff1f2' : '#f0fdf4', padding: '1rem', borderRadius: '14px', border: '1px solid', borderColor: f.solde_dette > 0 ? '#fecaca' : '#bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: f.solde_dette > 0 ? '#be123c' : '#15803d', display: 'block' }}>Dette Actuelle</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: 900, color: f.solde_dette > 0 ? '#be123c' : '#15803d' }}>{Number(f.solde_dette || 0).toLocaleString()} F</span>
                </div>
                {f.solde_dette > 0 && (
                  <button 
                    onClick={async () => {
                      const amount = prompt(`Montant à régler pour ${f.nom} (Dette: ${f.solde_dette} F) :`, f.solde_dette.toString());
                      if (amount && !isNaN(Number(amount))) {
                        try {
                          const { payDebt } = await import('../services/fournisseurService');
                          await payDebt(f.id, Number(amount));
                          showToast('Paiement enregistré', 'success');
                          loadFournisseurs();
                        } catch (e) {
                          showToast('Erreur paiement', 'error');
                        }
                      }
                    }}
                    className="btn btn-primary" 
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    Régler
                  </button>
                )}
                {!f.solde_dette || f.solde_dette <= 0 && <Wallet size={24} color="#15803d" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', fontWeight: 900 }}>{editingFournisseur ? 'Modifier Fournisseur' : 'Nouveau Fournisseur'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Nom de l'entreprise *</label>
                <input type="text" className="input" required value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Nom du contact</label>
                <input type="text" className="input" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Téléphone</label>
                <input type="text" className="input" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label>Adresse</label>
                <textarea className="input" rows={2} value={formData.adresse} onChange={e => setFormData({...formData, adresse: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} style={{ flex: 1 }}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
