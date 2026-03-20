import { useState, useEffect } from 'react';
import { getUtilisateurs, creerUtilisateurMock } from '../services/utilisateurService';
import type { User, Role } from '../types';
import { Users, Plus, X } from 'lucide-react';

export const Utilisateurs = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('LIVREUR');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getUtilisateurs();
      setUsers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await creerUtilisateurMock({
        nom_complet: nom,
        email: email,
        role: role,
        actif: true
      });
      setShowForm(false);
      setNom('');
      setEmail('');
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
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
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.nom_complet}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td><span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : u.role === 'LIVREUR' ? 'badge-success' : 'badge-info'}`}>{u.role}</span></td>
                    <td><span className={u.actif ? 'badge badge-success' : 'badge badge-danger'}>{u.actif ? 'Actif' : 'Inactif'}</span></td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Aucun utilisateur. Veuillez en créer un (ex: Livreur).</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
            <button onClick={() => setShowForm(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} color="var(--primary-color)"/> Nouvel Utilisateur
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nom complet *</label>
                <input type="text" className="form-input" required value={nom} onChange={e => setNom(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Email de connexion *</label>
                <input type="email" className="form-input" required value={email} onChange={e => setEmail(e.target.value)} />
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
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Créez impérativement un "LIVREUR" actif pour pouvoir générer des feuilles de route dans l'onglet Logistique.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
