import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
// Imports...
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Headset,
  Truck,
  Users,
  LogOut,
  Settings,
  Calculator,
  History,
  TrendingUp,
  Activity,
  DollarSign,
  Home as HomeIcon,
  User as UserIcon,
  Wallet,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { currentUser, logout, hasPermission } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Accueil', icon: HomeIcon, permission: 'PROFIL' },
    { path: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, permission: 'DASHBOARD' },
    { path: '/produits', label: 'Produits & Stock', icon: Package, permission: 'PRODUITS' },
    { path: '/commandes', label: 'Commandes', icon: ShoppingCart, permission: 'COMMANDES' },
    { path: '/centre-appel', label: 'Centre d\'Appel', icon: Headset, permission: 'CENTRE_APPEL' },
    { path: '/clients', label: 'CRM & Clients', icon: Users, permission: 'CLIENTS' },
    { path: '/logistique', label: 'Logistique', icon: Truck, permission: 'LOGISTIQUE' },
    { path: '/retours-rma', label: 'Retours Stock (RMA)', icon: RefreshCw, permission: 'LOGISTIQUE' },
    { path: '/performance-staff', label: 'Performance Équipe', icon: Activity, permission: 'GESTION_LIVREURS' },
    { path: '/livraison', label: 'Mes Livraisons', icon: UserIcon, permission: 'LIVREUR' },
    { path: '/caisse', icon: Calculator, label: 'Caisse / Retour', permission: 'CAISSE' },
    { path: '/rapport-financier', icon: TrendingUp, label: 'Rapport Journalier', permission: 'FINANCE' },
    { path: '/net-profit', icon: DollarSign, label: 'Profit & Finances', permission: 'ADMIN' },
    { path: '/admin/tresorerie', icon: Wallet, label: 'Trésorerie Admin', permission: 'TRESORERIE' },
    { path: '/audit-tresorerie', icon: ShieldCheck, label: 'Expertise Comptable', permission: 'ADMIN' },
    { path: '/historique', icon: History, label: 'Historique & Impression', permission: 'HISTORIQUE' },
    { path: '/admin', icon: Settings, label: hasPermission('ADMIN') ? 'Administration' : 'Équipe & Zones', permission: 'COMMUNES' },
    { path: '/profil', icon: UserIcon, label: 'Mon Profil', permission: 'PROFIL' },
  ];

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="brand-logo">
          <div style={{ background: 'var(--primary)', width: '38px', height: '38px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Package size={22} />
          </div>
          <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.04em' }}>GomboSwift</span>
        </div>

        <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none', padding: '0 0.75rem' }}>
            {navItems.filter(item => hasPermission(item.permission)).map(item => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path} style={{ marginBottom: '0.25rem' }}>
                  <Link 
                    to={item.path} 
                    onClick={onClose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      padding: '0.85rem 1rem',
                      color: isActive ? 'white' : 'var(--text-muted)',
                      backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.95rem',
                      transition: 'var(--transition-smooth)',
                      boxShadow: isActive ? '0 8px 15px -3px var(--primary-glow)' : 'none'
                    }}
                  >
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div style={{ padding: '1.5rem', margin: '0 0.75rem 1.5rem', background: '#f8fafc', borderRadius: 'var(--radius-lg)', border: '1px solid #f1f5f9' }}>
          <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
              <UserIcon size={20} color="var(--primary)" />
            </div>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.1rem' }}>{currentUser?.nom_complet}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{currentUser?.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="btn btn-outline"
            style={{ width: '100%', justifyContent: 'center', color: '#ef4444', border: 'none', background: 'white', fontSize: '0.85rem' }}
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
};
