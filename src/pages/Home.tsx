import { useAuth } from '../contexts/AuthContext';
import { 
  Package, 
  ShoppingCart, 
  Headset, 
  Truck, 
  Users, 
  Calculator, 
  History, 
  TrendingUp, 
  Settings,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const Home = () => {
  const { currentUser, hasPermission } = useAuth();

  const menuItems = [
    { path: '/produits', label: 'Produits', desc: 'Gestion du stock et catalogue', icon: Package, permission: 'PRODUITS', color: '#6366f1' },
    { path: '/commandes', label: 'Commandes', desc: 'Suivi et flux des colis', icon: ShoppingCart, permission: 'COMMANDES', color: '#8b5cf6' },
    { path: '/centre-appel', label: 'Centre d\'Appel', desc: 'Validation et suivi appels', icon: Headset, permission: 'CENTRE_APPEL', color: '#ec4899' },
    { path: '/clients', label: 'Clients CRM', desc: 'Fidélisation et base clients', icon: Users, permission: 'CLIENTS', color: '#f59e0b' },
    { path: '/logistique', label: 'Logistique', desc: 'Dispatching et tournées', icon: Truck, permission: 'LOGISTIQUE', color: '#10b981' },
    { path: '/caisse', label: 'Caisse', desc: 'Encaissements et retours', icon: Calculator, permission: 'CAISSE', color: '#06b6d4' },
    { path: '/rapport-financier', label: 'Analyses', desc: 'Performances et orientations', icon: TrendingUp, permission: 'FINANCE', color: '#6366f1' },
    { path: '/historique', label: 'Historique', desc: 'Archives et impressions', icon: History, permission: 'HISTORIQUE', color: '#64748b' },
    { path: '/admin', label: 'Admin', desc: 'Paramètres et utilisateurs', icon: Settings, permission: 'ADMIN', color: '#ef4444' },
  ];

  const allowedItems = menuItems.filter(item => hasPermission(item.permission));

  return (
    <div style={{ animation: 'pageEnter 0.6s ease', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 className="text-premium" style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>
          Bonne arrivée, {currentUser?.nom_complet?.split(' ')[0]} ! 👋
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 500 }}>
          Ravi de vous revoir sur <span style={{ color: 'var(--primary)', fontWeight: 800 }}>GomboSwift</span>. Où souhaitez-vous travailler aujourd'hui ?
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {allowedItems.map((item, i) => (
          <Link key={i} to={item.path} style={{ textDecoration: 'none' }}>
            <div className="card glass-effect hover-card" style={{ 
              padding: '1.75rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1.5rem',
              border: '1px solid rgba(255,255,255,0.1)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                borderRadius: '16px', 
                background: `${item.color}15`, 
                color: item.color, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <item.icon size={28} strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.25rem', fontWeight: 800, color: 'var(--text-main)', fontSize: '1.1rem' }}>{item.label}</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>{item.desc}</p>
              </div>
              <ChevronRight size={20} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              
              {/* Subtle background glow on hover child */}
              <div className="hover-glow" style={{ 
                position: 'absolute', 
                bottom: '-20px', 
                right: '-20px', 
                width: '100px', 
                height: '100px', 
                background: item.color, 
                filter: 'blur(50px)', 
                opacity: 0,
                transition: 'opacity 0.3s ease'
              }}></div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: '4rem', padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
         <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
            Votre accès est sécurisé et chiffré. Rôle actuel : <span className="badge badge-info" style={{ textTransform: 'uppercase' }}>{currentUser?.role}</span>
         </p>
      </div>
    </div>
  );
};
