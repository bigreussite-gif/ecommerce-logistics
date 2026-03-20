import { Bell, Search, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const Header = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const location = useLocation();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Tableau de bord';
      case '/produits': return 'Produits & Stock';
      case '/commandes': return 'Gestion des Commandes';
      case '/centre-appel': return 'Centre d\'Appel';
      case '/logistique': return 'Logistique & Feuilles de Route';
      case '/livraison': return 'Mes Livraisons';
      case '/caisse': return 'Caisse & Point de Retour';
      default: return 'Application';
    }
  };

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button className="mobile-menu-btn" onClick={onMenuClick}>
           <Menu size={24} />
        </button>
        <h1 style={{ fontSize: '1.25rem', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '160px' }}>{getPageTitle()}</h1>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className="search-global" style={{ position: 'relative' }}>
          <Search className="h-4 w-4" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Recherche globale..." 
            className="form-input"
            style={{ paddingLeft: '2.25rem', width: '250px', borderRadius: 'var(--radius-full)' }}
          />
        </div>
        
        <button className="btn btn-outline" style={{ border: 'none', padding: '0.5rem', borderRadius: 'var(--radius-full)' }}>
          <Bell className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
    </header>
  );
};
