import { Search, Menu, Home, RefreshCw } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { NotificationCenter } from './NotificationCenter';
import { useToast } from '../../contexts/ToastContext';

export const Header = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const location = useLocation();
  const { showToast } = useToast();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Portail GomboSwift';
      case '/dashboard': return 'Business 360°';
      case '/produits': return 'Produits & Stock';
      case '/commandes': return 'Gestion des Commandes';
      case '/centre-appel': return 'Centre d\'Appel';
      case '/logistique': return 'Logistique & Feuilles de Route';
      case '/livraison': return 'Mes Livraisons';
      case '/caisse': return 'Caisse & Point de Retour';
      case '/rapport-financier': return 'Rapport Journalier & Analyses';
      default: return 'Nexus Logistics';
    }
  };

  const handleClearCache = () => {
    if (window.confirm("Voulez-vous effacer les caches et rafraîchir l'application ? Cela peut résoudre certains ralentissements.")) {
      localStorage.clear();
      sessionStorage.clear();
      showToast("Caches effacés. Redémarrage...", "success");
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    }
  };

  return (
    <header className="header" style={{ padding: '0.75rem 1.5rem', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button className="mobile-menu-btn" onClick={onMenuClick}>
           <Menu size={22} />
        </button>
        <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-main)' }} className="text-premium">
          {getPageTitle()}
        </h2>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
        <div className="search-premium mobile-hide" style={{ maxWidth: '300px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder="Recherche globale..." 
            style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', fontSize: '0.85rem', fontWeight: 600 }}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
           <button 
             onClick={handleClearCache}
             className="btn btn-outline" 
             title="Effacer Cache & Rafraîchir"
             style={{ border: 'none', padding: '0.6rem', borderRadius: '12px', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
           >
             <RefreshCw size={18} />
             <span className="mobile-hide" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Cache</span>
           </button>

           <Link to="/" className="btn btn-outline" style={{ border: 'none', padding: '0.6rem', borderRadius: '12px', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
             <Home size={20} />
           </Link>
        </div>

        <NotificationCenter />
      </div>
    </header>
  );
};
