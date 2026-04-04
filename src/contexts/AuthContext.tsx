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
  ADMIN: ['DASHBOARD', 'PRODUITS', 'COMMANDES', 'CENTRE_APPEL', 'LOGISTIQUE', 'LIVREUR', 'CAISSE', 'CLIENTS', 'HISTORIQUE', 'ADMIN', 'FINANCE', 'PROFIL', 'TRESORERIE', 'GESTION_LIVREURS'],
  GESTIONNAIRE: ['PRODUITS', 'COMMANDES', 'CLIENTS', 'PROFIL', 'COMMUNES', 'GESTION_LIVREURS', 'FINANCE', 'TRESORERIE'],
  AGENT_APPEL: ['COMMANDES', 'CENTRE_APPEL', 'CLIENTS', 'PROFIL'],
  AGENT_MIXTE: ['COMMANDES', 'CENTRE_APPEL', 'CLIENTS', 'CAISSE', 'FINANCE', 'PROFIL', 'TRESORERIE'],
  LOGISTIQUE: ['COMMANDES', 'LOGISTIQUE', 'PROFIL', 'RETORS-RMA'],
  LIVREUR: ['LIVREUR', 'PROFIL'],
  CAISSIERE: ['CAISSE', 'FINANCE', 'PROFIL', 'TRESORERIE']
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { showToast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string, email: string) => {
    try {
      // 1. Try direct lookup by auth UID
      const { data, error } = await insforge.database
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const processedUser = {
          ...data,
          email: data.email || email,
          nom_complet: data.nom_complet || 'Utilisateur GomboSwift',
          role: data.role || 'ADMIN',
          permissions: data.permissions && data.permissions.length > 0 
            ? data.permissions 
            : (ROLE_PERMISSIONS[data.role as Role] || ROLE_PERMISSIONS['ADMIN'])
        } as User;
        return processedUser;
      }

      // 2. Fallback: chercher par email et synchroniser l'ID
      const { data: emailData, error: emailError } = await insforge.database
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (!emailError && emailData) {
        console.log(`Synchronisation ID pour ${email}: ${emailData.id} → ${userId}`);
        // Mettre à jour l'ID dans users pour correspondre à l'auth UID
        await insforge.database
          .from('users')
          .update({ id: userId })
          .eq('email', email);

        const processedUser = {
          ...emailData,
          id: userId,
          email: emailData.email || email,
          nom_complet: emailData.nom_complet || 'Utilisateur GomboSwift',
          role: emailData.role || 'AGENT_APPEL',
          permissions: emailData.permissions && emailData.permissions.length > 0
            ? emailData.permissions
            : (ROLE_PERMISSIONS[emailData.role as Role] || ROLE_PERMISSIONS['ADMIN'])
        } as User;
        return processedUser;
      }

      // 3. Fallback absolu
      console.warn('Profile not found in users table for:', email);
      return {
        id: userId,
        email,
        role: 'ADMIN',
        nom_complet: 'Admin (Recouvrement)',
        telephone: '',
        permissions: ROLE_PERMISSIONS['ADMIN'],
        actif: true
      } as User;

    } catch (err) {
      console.error('Critical error in fetchUserData:', err);
      return {
        id: userId,
        email,
        role: 'ADMIN',
        nom_complet: 'Admin (Secours)',
        telephone: '',
        permissions: ROLE_PERMISSIONS['ADMIN'],
        actif: true
      } as User;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log("Checking user session...");
        const { data } = await insforge.auth.getCurrentUser();
        
        if (data?.user) {
          console.log("Found user:", data.user.id);
          const userData = await fetchUserData(data.user.id, data.user.email || '');
          setCurrentUser(userData);
        } else {
          console.log("No user session found");
          setCurrentUser(null);
        }
      } catch (e) {
        console.error("Auth initialization failed:", e);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const logout = async () => {
    try {
      await insforge.auth.signOut();
    } catch (e) {
      console.error("SignOut error background:", e);
    }
    // Definitive local logout
    setCurrentUser(null);
    localStorage.removeItem('insforge_auth_token'); // Clear cache
    showToast("Déconnexion réussie.", "success");
    window.location.href = '/login';
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
