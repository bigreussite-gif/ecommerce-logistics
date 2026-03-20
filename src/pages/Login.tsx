import React, { useState } from 'react';
import { insforge } from '../lib/insforge';
import { useToast } from '../contexts/ToastContext';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';

export const Login = () => {
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalEmail = identifier;

      // Simple check: if it doesn't look like an email, assume it's a phone number
      if (!identifier.includes('@')) {
        const { data: userRecord, error: lookupError } = await insforge.database
          .from('users')
          .select('email')
          .eq('telephone', identifier)
          .single();

        if (lookupError || !userRecord) {
          showToast("Identifiant (Email ou Téléphone) non trouvé.", "error");
          setLoading(false);
          return;
        }
        finalEmail = userRecord.email;
      }

      const { error } = await insforge.auth.signInWithPassword({
        email: finalEmail,
        password
      });

      if (error) {
        showToast("Identifiant ou mot de passe incorrect.", "error");
      } else {
        showToast("Connexion réussie !", "success");
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      showToast("Une erreur est survenue lors de la connexion.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4 shadow-lg shadow-blue-500/20">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">ECOM-360</h1>
          <p className="text-slate-400">Logistique & Distribution</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email ou Numéro de téléphone</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-600"
                placeholder="votre@email.com ou 0102030405"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-600"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Se connecter"}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-700 text-center">
          <p className="text-sm text-slate-500">
            Besoin d'aide ? Contactez l'administrateur système.
          </p>
        </div>
      </div>
    </div>
  );
};
