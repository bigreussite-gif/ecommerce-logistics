import { useState, useEffect } from 'react';
import { getUtilisateurs, creerUtilisateur, updateUtilisateur, supprimerUtilisateur } from '../services/utilisateurService';
import type { User, Role } from '../types';
import { Users, Plus, X, Edit2, Trash2, Check, AlertCircle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export const Utilisateurs = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { showToast } = useToast();

  // Form
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('LIVREUR');
  const [actif, setActif] = useState(true);
  const [telephone, setTelephone] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getUtilisateurs();
      setUsers(data);
    } catch (error) {
      console.error(error);
      showToast("Erreur lors du chargement des utilisateurs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await creerUtilisateur({
        nom_complet: nom,
        email: email,
        role: role,
        actif: actif,
        telephone: telephone
      });
      showToast("Utilisateur créé avec succès", "success");
      closeForm();
      fetchData();
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la création", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    try {
      await updateUtilisateur(editingUser.id, {
        nom_complet: nom,
        role: role,
        actif: actif,
        telephone: telephone
      });
      showToast("Utilisateur mis à jour", "success");
      closeForm();
      fetchData();
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la mise à jour", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir désactiver ${user.nom_complet} ?`)) return;
    try {
      await supprimerUtilisateur(user.id);
      showToast("Utilisateur désactivé", "success");
      fetchData();
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la suppression", "error");
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setNom(user.nom_complet);
    setEmail(user.email);
    setRole(user.role);
    setActif(user.actif ?? true);
    setTelephone(user.telephone || '');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setNom('');
    setEmail('');
    setRole('LIVREUR');
    setActif(true);
    setTelephone('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Utilisateurs du Système</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Gérez les livreurs, agents et admins.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={18} /> Créer Utilisateur
        </button>
      </div>

      <div className="card">
        {loading && users.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Chargement...</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nom Complet</th>
                  <th>Email / Téléphone</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.nom_complet}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {u.id.substring(0, 8)}...</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{u.email}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{u.telephone || 'Aucun numéro'}</div>
                    </td>
                    <td><span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : u.role === 'LIVREUR' ? 'badge-success' : 'badge-info'}`}>{u.role}</span></td>
                    <td>
                      <span className={`badge ${u.actif ? 'badge-success' : 'badge-danger'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}>
                        {u.actif ? <Check size={12} /> : <AlertCircle size={12} />}
                        {u.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                        <button className="btn btn-icon" title="Modifier" onClick={() => openEdit(u)} style={{ padding: '0.5rem', borderRadius: '8px' }}>
                          <Edit2 size={16} color="var(--primary-color)" />
                        </button>
                        <button className="btn btn-icon" title="Désactiver" onClick={() => handleDelete(u)} style={{ padding: '0.5rem', borderRadius: '8px' }}>
                          <Trash2 size={16} color="var(--danger-color)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Aucun utilisateur. Veuillez en créer un (ex: Livreur).</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '550px', position: 'relative', animation: 'scaleUp 0.3s ease-out' }}>
            <button onClick={closeForm} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={20} />
            </button>
            
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ backgroundColor: 'rgba(52, 152, 219, 0.1)', padding: '0.5rem', borderRadius: '12px' }}>
                <Users size={24} color="var(--primary-color)"/>
              </div>
              {editingUser ? 'Modifier l\'Utilisateur' : 'Nouvel Utilisateur'}
            </h2>

            <form onSubmit={editingUser ? handleUpdate : handleCreate} className="form-grid">
              <div className="form-group">
                <label className="form-label">Nom complet *</label>
                <input type="text" className="form-input" required value={nom} onChange={e => setNom(e.target.value)} placeholder="ex: Jean Dupont" />
              </div>

              <div className="form-group">
                <label className="form-label">Email de connexion *</label>
                <input type="email" className="form-input" required disabled={!!editingUser} value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
                {editingUser && <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>L'email ne peut pas être modifié.</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Numéro de téléphone</label>
                <input type="text" className="form-input" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="ex: 0102030405" />
              </div>

              <div className="form-group">
                <label className="form-label">Rôle *</label>
                <select className="form-select" value={role} onChange={e => setRole(e.target.value as Role)}>
                  <option value="ADMIN">ADMIN</option>
                  <option value="GESTIONNAIRE">GESTIONNAIRE</option>
                  <option value="AGENT_APPEL">AGENT D'APPEL</option>
                  <option value="LOGISTIQUE">LOGISTIQUE</option>
                  <option value="LIVREUR">LIVREUR</option>
                  <option value="CAISSIERE">CAISSIÈRE</option>
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                <input type="checkbox" id="user-actif" checked={actif} onChange={e => setActif(e.target.checked)} style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }} />
                <label htmlFor="user-actif" style={{ cursor: 'pointer', fontWeight: 500 }}>Utilisateur Actif</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={closeForm}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '120px' }}>
                  {loading ? 'Traitement...' : (editingUser ? 'Enregistrer' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
