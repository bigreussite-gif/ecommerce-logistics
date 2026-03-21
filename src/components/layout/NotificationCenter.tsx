import { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, Clock, ShoppingBag } from 'lucide-react';
import { getActiveAlerts, BusinessAlert } from '../../services/alertService';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export const NotificationCenter = () => {
  const [alerts, setAlerts] = useState<BusinessAlert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000 * 5); // Check every 5 mins
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAlerts = async () => {
    try {
      const activeAlerts = await getActiveAlerts();
      setAlerts(activeAlerts);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        className="btn btn-outline" 
        style={{ 
          border: 'none', 
          padding: '0.6rem', 
          borderRadius: '12px', 
          background: isOpen ? 'var(--primary-glow)' : '#f1f5f9',
          position: 'relative',
          transition: 'all 0.3s ease'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={20} style={{ color: isOpen ? 'var(--primary)' : 'var(--text-muted)' }} />
        {alerts.length > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '18px',
            height: '18px',
            background: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            fontSize: '0.65rem',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid white',
            animation: 'pulseAlert 2s infinite'
          }}>
            {alerts.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '120%',
          right: 0,
          width: '350px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(15px)',
          borderRadius: '20px',
          boxShadow: 'var(--shadow-premium)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          zIndex: 1000,
          overflow: 'hidden',
          animation: 'modalEnter 0.3s ease'
        }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Alertes Business</h3>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{alerts.length} actives</span>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '0.5rem' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <ShoppingBag size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Opération nominale.</p>
                <p style={{ fontSize: '0.75rem' }}>Aucune alerte critique détectée.</p>
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} style={{ 
                  padding: '1rem', 
                  borderRadius: '14px', 
                  marginBottom: '0.5rem',
                  background: alert.severity === 'high' ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                  display: 'flex',
                  gap: '0.85rem',
                  border: '1px solid transparent',
                  transition: 'background 0.2s ease'
                }} className="hover-card">
                  <div style={{ 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '10px', 
                    background: alert.type === 'stock' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    color: alert.type === 'stock' ? '#ef4444' : '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {alert.type === 'stock' ? <AlertCircle size={20} /> : <Clock size={20} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.2rem' }}>{alert.message}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {formatDistanceToNow(alert.timestamp, { addSuffix: true, locale: fr })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {alerts.length > 0 && (
            <div style={{ padding: '1rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
              <button disabled style={{ background: 'transparent', border: 'none', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', cursor: 'default' }}>
                Mode de surveillance actif 🛡️
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulseAlert {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .hover-card:hover { background: #f8fafc !important; }
      `}</style>
    </div>
  );
};
