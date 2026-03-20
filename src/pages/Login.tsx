import React, { useState } from 'react';
import { insforge } from '../lib/insforge';
import { useToast } from '../contexts/ToastContext';
import { LogIn, Loader2 } from 'lucide-react';

export const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await insforge.auth.verifyEmail({
        email: identifier,
        otp: verificationCode
      });

      if (error) throw error;

      // After verification, create profile and promote to admin
      const userId = data?.user?.id;
      if (userId) {
        await insforge.database.from('users').insert([{
          id: userId,
          email: identifier,
          role: 'ADMIN',
          nom_complet: 'Admin Principal',
          telephone: '0757228731',
          actif: true
        }]);
      }

      showToast('Compte vérifié avec succès !', 'success');
      window.location.href = '/dashboard';
    } catch (err: any) {
      showToast(err.message || 'Code incorrect', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign Up
        const { error } = await insforge.auth.signUp({
          email: identifier,
          password
        });

        if (error) throw error;
        showToast('Compte créé ! Veuillez entrer le code reçu par e-mail.', 'success');
        setIsVerifying(true);
      } else {
        // Sign In
        let finalEmail = identifier;
        
        if (!identifier.includes('@')) {
          // Try phone first
          let { data: userRecord, error: lookupError } = await insforge.database
            .from('users')
            .select('email')
            .eq('telephone', identifier)
            .single();

          // Try name if phone fails
          if (lookupError || !userRecord) {
            const { data: nameRecord, error: nameError } = await insforge.database
              .from('users')
              .select('email')
              .ilike('nom_complet', identifier)
              .single();
            
            if (nameError || !nameRecord) {
              showToast('Identifiant (Email, Tel ou Nom) non trouvé.', 'error');
              setLoading(false);
              return;
            }
            userRecord = nameRecord;
          }
          finalEmail = userRecord.email;
        }

        const { error } = await insforge.auth.signInWithPassword({
          email: finalEmail,
          password,
        });

        if (error) {
          showToast('Identifiant ou mot de passe incorrect.', 'error');
        } else {
          window.location.href = '/dashboard';
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur d\'authentification', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <LogIn size={32} color="white" />
          </div>
          <h1 className="login-title">ECOM-360</h1>
          <p className="login-subtitle">Système de Distribution & Logistique</p>
        </div>

        {isVerifying ? (
          <form onSubmit={handleVerify} className="login-form">
            <div className="form-group">
              <label className="form-label">Code de vérification (E-mail)</label>
              <input
                type="text"
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="form-input"
                placeholder="123456"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-btn"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Vérifier le code"}
            </button>
            <button 
              type="button" 
              onClick={() => setIsVerifying(false)}
              style={{ width: '100%', marginTop: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Retour à la connexion
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="login-form">
            <div className="form-group">
              <label className="form-label">
                {isSignUp ? 'Adresse E-mail' : 'Email ou Numéro de téléphone'}
              </label>
              <input
                type={isSignUp ? 'email' : 'text'}
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="form-input"
                placeholder={isSignUp ? 'votre@email.com' : 'votre@email.com ou 0102030405'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-btn"
            >
              {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? "S'inscrire" : "Se connecter")}
            </button>
          </form>
        )}

        <div className="login-footer">
          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)} 
            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600, display: 'block', margin: '0 auto 1rem' }}
          >
            {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
          </button>
          Besoin d'aide ? Contactez l'administrateur système.
        </div>
      </div>
    </div>
  );
};
