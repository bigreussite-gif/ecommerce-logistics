import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateAdminUser } from '../services/adminService';
import { User, Save, Lock } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export const Profil = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!currentUser) return <div>Connexion requise.</div>;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast("Les mots de passe ne correspondent pas.", "error");
      return;
    }
    if (password.length < 4) {
      showToast("Le mot de passe doit faire au moins 4 caractères.", "error");
      return;
    }

    setLoading(true);
    try {
      await updateAdminUser(currentUser.id, { password });
      showToast("Mot de passe mis à jour avec succès !", "success");
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la mise à jour.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={28} style={{ color: 'var(--primary-color)' }} />
          Mon Profil
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Gérez vos informations et votre sécurité.</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Informations Personnelles</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', width: '120px', display: 'inline-block' }}>Nom Complet:</span>
            <strong style={{ fontSize: '1.125rem' }}>{currentUser.nom_complet}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', width: '120px', display: 'inline-block' }}>Email/Login:</span>
            <strong>{currentUser.email}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', width: '120px', display: 'inline-block' }}>Rôle:</span>
            <span className="badge badge-info">{currentUser.role}</span>
          </div>
        </div>
      </div>

      <div className="card">
         <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lock size={18} />
          Changer de mot de passe
        </h3>
        <form onSubmit={handleUpdatePassword}>
          <div className="form-group">
            <label className="form-label">Nouveau mot de passe</label>
            <input 
              type="password" 
              className="form-input" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 4 caractères"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmer le mot de passe</label>
            <input 
              type="password" 
              className="form-input" 
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Save size={18} style={{ marginRight: '0.5rem' }} />
            {loading ? 'Mise à jour...' : 'Sauvegarder le mot de passe'}
          </button>
        </form>
      </div>

    </div>
  );
};
