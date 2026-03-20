import { createContext, useContext, useEffect, useState } from 'react';
import { User, Role } from '../types';
import { useToast } from './ToastContext';

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

  useEffect(() => {
    // Mode Prototype Local: Auto Login
    setCurrentUser({
      id: 'dev-admin',
      email: 'admin@ecommerce.local',
      role: 'ADMIN',
      nom_complet: 'Super Admin (Local)',
      actif: true
    });
    setLoading(false);
  }, []);

  const logout = async () => {
    // In local mode, we don't really log out
    showToast("Déconnexion simulée en mode local.", "info");
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
