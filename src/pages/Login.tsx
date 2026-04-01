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
      window.location.href = '/';
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

        const { data: authData, error } = await insforge.auth.signInWithPassword({
          email: finalEmail,
          password,
        });

        if (error) {
          showToast('Identifiant ou mot de passe incorrect.', 'error');
        } else if (authData?.user) {
          // Log the connection
          try {
            await insforge.database.from('audit_logins').insert([{
              user_id: authData.user.id,
              user_agent: navigator.userAgent,
              login_time: new Date()
            }]);
          } catch (logErr) {
            console.warn("Échec du log de connexion:", logErr);
          }
          window.location.href = '/';
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur d\'authentification', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-v2" style={{ 
      position: 'relative', 
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      {/* BACKGROUND BLOBS ENGINE */}
      <div className="blob-container">
        <div className="blob" style={{ width: '600px', height: '600px', background: 'rgba(79, 70, 229, 0.35)', top: '-200px', left: '-200px', animationDelay: '0s' }}></div>
        <div className="blob" style={{ width: '500px', height: '500px', background: 'rgba(147, 51, 234, 0.25)', bottom: '-150px', right: '-150px', animationDelay: '-5s' }}></div>
        <div className="blob" style={{ width: '400px', height: '400px', background: 'rgba(99, 102, 255, 0.25)', top: '20%', right: '10%', animationDelay: '-10s' }}></div>
      </div>

      <div className="glass-card-futuristic floating" style={{ 
        width: '100%', 
        maxWidth: '440px', 
        padding: '3.5rem 2.5rem', 
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* LOGO & TITRE FUTURISTE */}
        <div style={{ textAlign: 'center', marginBottom: '3.5rem', position: 'relative', zIndex: 2 }}>
          <div style={{ 
            width: '80px', 
            height: '80px', 
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', 
            borderRadius: '22px', 
            margin: '0 auto 1.5rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 0 40px rgba(99, 102, 255, 0.5), inset 0 0 15px rgba(255,255,255,0.4)',
            border: '1px solid rgba(255,255,255,0.3)'
          }}>
            <LogIn size={38} color="white" strokeWidth={2.5} />
          </div>
          
          <h1 className="text-neon" style={{ 
            fontSize: '2.6rem', 
            fontWeight: 900, 
            margin: 0, 
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            textTransform: 'uppercase'
          }}>GomboSwift</h1>
          
          <div style={{ 
            marginTop: '1.2rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '15px' 
          }}>
            <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2))' }}></div>
            <p style={{ 
              color: 'rgba(255,255,255,0.6)', 
              fontSize: '0.75rem', 
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
              margin: 0,
              whiteSpace: 'nowrap'
            }}>Nexus Logistics</p>
            <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.2), transparent)' }}></div>
          </div>
        </div>

        {isVerifying ? (
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Code d'authentification</label>
              <input
                type="text"
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="form-input input-futuristic"
                style={{ height: '64px', borderRadius: '18px', fontSize: '1.6rem', textAlign: 'center', letterSpacing: '0.5em', fontWeight: 900, width: '100%' }}
                placeholder="000000"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ height: '64px', borderRadius: '18px', fontWeight: 900, fontSize: '1.1rem', background: 'linear-gradient(90deg, #6366f1, #a855f7)', border: 'none', boxShadow: '0 20px 30px -10px rgba(99, 102, 255, 0.6)', width: '100%' }}
            >
              {loading ? <Loader2 className="animate-spin" /> : "VÉRIFIER L'IDENTITÉ"}
            </button>
            
            <button 
              type="button" 
              onClick={() => setIsVerifying(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}
            >
              Annuler
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                {isSignUp ? 'Identité Digitale' : 'Connexion d\'identification'}
              </label>
              <input
                type={isSignUp ? 'email' : 'text'}
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="form-input input-futuristic"
                style={{ height: '60px', borderRadius: '16px', fontWeight: 600, fontSize: '1rem', width: '100%' }}
                placeholder={isSignUp ? 'email@secteur.ci' : 'Email ou Numéro'}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Clé de Sécurité</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input input-futuristic"
                style={{ height: '60px', borderRadius: '16px', fontWeight: 600, fontSize: '1rem', width: '100%' }}
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ height: '64px', borderRadius: '18px', fontWeight: 900, fontSize: '1.2rem', background: 'linear-gradient(90deg, #6366f1, #a855f7)', border: 'none', boxShadow: '0 20px 30px -10px rgba(99, 102, 255, 0.6)', marginTop: '0.5rem', width: '100%' }}
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : (isSignUp ? "INITIALISER" : "SE CONNECTER")}
            </button>
          </form>
        )}

        <div style={{ marginTop: '2.5rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2.5rem', position: 'relative', zIndex: 2 }}>
          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)} 
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.12)', 
              color: 'rgba(255,255,255,0.85)', 
              padding: '0.8rem 1.5rem',
              borderRadius: '14px',
              cursor: 'pointer', 
              fontWeight: 800, 
              fontSize: '0.8rem', 
              letterSpacing: '0.05em',
              transition: 'all 0.3s ease',
              width: '100%'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            {isSignUp ? 'DÉJÀ RÉFÉRENCÉ ? SE CONNECTER' : 'PAS DE COMPTE ? S\'INSCRIRE'}
          </button>
          
          <div style={{ 
            marginTop: '2rem', 
            color: 'rgba(255,255,255,0.3)', 
            fontSize: '0.7rem', 
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
             <div style={{ width: '5px', height: '5px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' }}></div>
             Accès Chiffré AES-256
          </div>
        </div>
      </div>
    </div>
  );
};
