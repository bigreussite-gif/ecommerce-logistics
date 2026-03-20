import { createContext, useContext, useEffect, useState } from 'react';
import { User, Role } from '../types';
import { useToast } from './ToastContext';
import { insforge } from '../lib/insforge';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  logout: async () => {},
  hasRole: () => false,
});

export const useAuth = () => useContext(AuthContext);

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
        // Fallback: If authenticated, give at least ADMIN status for setup
        return {
          id: userId,
          email,
          role: 'ADMIN',
          nom_complet: 'Admin (Recouvrement)',
          telephone: '',
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
    } else {
      showToast("Erreur lors de la déconnexion.", "error");
    }
  };

  const hasRole = (roles: Role[]) => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true; 
    return roles.includes(currentUser.role);
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, logout, hasRole }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
