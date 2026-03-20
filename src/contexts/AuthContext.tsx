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
    const { data, error } = await insforge.database
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return { ...data, email } as User;
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
