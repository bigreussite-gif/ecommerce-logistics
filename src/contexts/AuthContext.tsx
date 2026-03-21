import { createContext, useContext, useEffect, useState } from 'react';
import { User, Role } from '../types';
import { useToast } from './ToastContext';
import { insforge } from '../lib/insforge';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
  hasPermission: (permissions: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  logout: async () => {},
  hasRole: () => false,
  hasPermission: () => false,
});

export const useAuth = () => useContext(AuthContext);

// --- Role to Permission Mapping for Fallback ---
const ROLE_PERMISSIONS: Record<Role, string[]> = {
  ADMIN: ['DASHBOARD', 'PRODUITS', 'COMMANDES', 'CENTRE_APPEL', 'LOGISTIQUE', 'LIVREUR', 'CAISSE', 'CLIENTS', 'HISTORIQUE', 'ADMIN', 'FINANCE', 'PROFIL'],
  GESTIONNAIRE: ['PRODUITS', 'COMMANDES', 'CLIENTS', 'PROFIL', 'COMMUNES', 'GESTION_LIVREURS'],
  AGENT_APPEL: ['COMMANDES', 'CENTRE_APPEL', 'CLIENTS', 'PROFIL'],
  AGENT_MIXTE: ['COMMANDES', 'CENTRE_APPEL', 'CLIENTS', 'CAISSE', 'FINANCE', 'PROFIL'],
  LOGISTIQUE: ['COMMANDES', 'LOGISTIQUE', 'PROFIL'],
  LIVREUR: ['LIVREUR', 'PROFIL'],
  CAISSIERE: ['CAISSE', 'FINANCE', 'PROFIL']
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { showToast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string, email: string) => {
    try {
      const { data, error } = await insforge.database
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.warn('Profile not found in users table, using fallback:', error);
        return {
          id: userId,
          email,
          role: 'ADMIN',
          nom_complet: 'Admin (Recouvrement)',
          telephone: '',
          permissions: ROLE_PERMISSIONS['ADMIN'],
          actif: true
        } as User;
      }

      return { ...data, email } as User;
    } catch (err) {
      console.error('Critical error in fetchUserData:', err);
      return null;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const { data } = await insforge.auth.getCurrentUser();
      
      if (data?.user) {
        const userData = await fetchUserData(data.user.id, data.user.email);
        setCurrentUser(userData);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const logout = async () => {
    const { error } = await insforge.auth.signOut();
    if (!error) {
      setCurrentUser(null);
      showToast("Déconnexion réussie.", "success");
      window.location.href = '/login';
    } else {
      showToast("Erreur lors de la déconnexion.", "error");
    }
  };

  const hasPermission = (perms: string | string[]) => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true; 

    const userPerms = currentUser.permissions && currentUser.permissions.length > 0
      ? currentUser.permissions
      : ROLE_PERMISSIONS[currentUser.role] || [];

    const required = Array.isArray(perms) ? perms : [perms];
    return required.some(p => userPerms.includes(p));
  };

  const hasRole = (roles: Role[]) => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true; 
    return roles.includes(currentUser.role);
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, logout, hasRole, hasPermission }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
