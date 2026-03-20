import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
// Imports...
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Headset,
  Truck,
  Map,
  Users,
  LogOut,
  Settings,
  Calculator,
  History,
  User
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { currentUser, logout, hasRole } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['ADMIN'] },
    { path: '/produits', label: 'Produits & Stock', icon: Package, roles: ['ADMIN', 'GESTIONNAIRE'] },
    { path: '/commandes', label: 'Commandes', icon: ShoppingCart, roles: ['ADMIN', 'GESTIONNAIRE', 'AGENT_APPEL', 'LOGISTIQUE'] },
    { path: '/centre-appel', label: 'Centre d\'Appel', icon: Headset, roles: ['ADMIN', 'AGENT_APPEL'] },
    { path: '/clients', label: 'CRM & Clients', icon: Users, roles: ['ADMIN', 'GESTIONNAIRE', 'AGENT_APPEL'] },
    { path: '/logistique', label: 'Logistique', icon: Truck, roles: ['ADMIN', 'LOGISTIQUE'] },
    { path: '/livraison', label: 'Mes Livraisons', icon: Map, roles: ['ADMIN', 'LIVREUR'] },
    { path: '/caisse', icon: Calculator, label: 'Caisse / Retour', roles: ['ADMIN', 'CAISSIERE'] },
    { path: '/historique', icon: History, label: 'Historique & Impression', roles: ['ADMIN'] }, // New item
    { path: '/admin', icon: Settings, label: 'Administration', roles: ['ADMIN'] }, // New item
    { path: '/profil', icon: User, label: 'Mon Profil', roles: ['ADMIN', 'GESTIONNAIRE', 'AGENT_APPEL', 'LOGISTIQUE', 'LIVREUR', 'CAISSIERE'] }, // New item
  ];

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <h2 style={{ color: 'var(--primary-color)', fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package className="h-6 w-6" />
          E-Logistics
        </h2>
      </div>

      <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
        <ul style={{ listStyle: 'none' }}>
          {navItems.filter(item => hasRole(item.roles as any)).map(item => (
            <li key={item.path}>
              <Link 
                to={item.path} 
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1.5rem',
                  color: location.pathname === item.path ? 'var(--primary-color)' : 'var(--text-secondary)',
                  backgroundColor: location.pathname === item.path ? 'rgba(79, 70, 229, 0.05)' : 'transparent',
                  borderRight: location.pathname === item.path ? '3px solid var(--primary-color)' : '3px solid transparent',
                  textDecoration: 'none',
                  fontWeight: location.pathname === item.path ? 600 : 500,
                  transition: 'var(--transition)'
                }}
              >
                <item.icon size={20} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser?.nom_complet}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Role: {currentUser?.role}</p>
        </div>
        <button 
          onClick={logout}
          className="btn btn-outline"
          style={{ width: '100%', justifyContent: 'center', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </aside>
    </>
  );
};
