import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Commande, StatutCommande } from '../../types';
import { Eye, PhoneCall, Truck, Trash2, FileText, Edit2, MapPin, User, Hash, ShoppingBag } from 'lucide-react';

interface CommandeListProps {
  commandes: Commande[];
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onActionClick?: (commande: Commande) => void;
  onViewClick?: (commande: Commande) => void;
  onDelete?: (commande: Commande) => void;
  onInvoiceClick?: (commande: Commande) => void;
  onEditClick?: (commande: Commande) => void;
  actionIcon?: 'Eye' | 'PhoneCall' | 'Truck';
  actionLabel?: string;
}

const getStatusBadge = (status: StatutCommande) => {
  const styles: Record<string, { bg: string, color: string, label: string }> = {
    'en_attente_appel': { bg: '#fef3c7', color: '#92400e', label: 'Attente Appel' },
    'a_rappeler': { bg: '#fee2e2', color: '#991b1b', label: 'À Rappeler' },
    'validee': { bg: '#ecfdf5', color: '#065f46', label: 'Validée' },
    'en_cours_livraison': { bg: '#eef2ff', color: '#3730a3', label: 'En Livraison' },
    'livree': { bg: '#f0fdf4', color: '#166534', label: 'Livrée' },
    'terminee': { bg: '#f0fdf4', color: '#166534', label: 'Terminée' },
    'echouee': { bg: '#fef2f2', color: '#991b1b', label: 'Échouée' },
    'retour_livreur': { bg: '#fff7ed', color: '#9a3412', label: 'Retour Livr.' },
    'retour_stock': { bg: '#f8fafc', color: '#475569', label: 'En Stock' },
    'annulee': { bg: '#f1f5f9', color: '#64748b', label: 'Annulée' },
    'retour_client': { bg: '#fff7ed', color: '#c2410c', label: 'Retour Client' }
  };

  const style = styles[status] || { bg: '#f1f5f9', color: '#64748b', label: status };

  return (
    <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      padding: '0.4rem 0.8rem', 
      borderRadius: '10px', 
      fontSize: '0.75rem', 
      fontWeight: 800, 
      background: style.bg, 
      color: style.color,
      textTransform: 'uppercase',
      letterSpacing: '0.02em'
    }}>
      {style.label}
    </span>
  );
};

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'PhoneCall': return <PhoneCall size={18} />;
    case 'Truck': return <Truck size={18} />;
    default: return <Eye size={18} />;
  }
};

export const CommandeList = ({ 
  commandes, 
  selectedIds = [],
  onSelectionChange,
  onActionClick, 
  onDelete, 
  onInvoiceClick, 
  onEditClick,
  actionIcon = 'Eye', 
  actionLabel = 'Voir détails' 
}: CommandeListProps) => {
  const toggleSelectAll = () => {
    if (!onSelectionChange) return;
    if (selectedIds.length === commandes.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(commandes.map(c => c.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid: string) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (commandes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-muted)' }}>
        <ShoppingBag size={48} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
        <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>Aucune commande trouvée.</p>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', fontWeight: 600 }}>Ajustez vos filtres ou effectuez une nouvelle recherche.</p>
      </div>
    );
  }

  return (
    <div className="table-container" style={{ margin: '0 -1rem' }}>
      <table style={{ width: '100%', borderSpacing: '0 0.75rem', borderCollapse: 'separate' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase' }}>
            <th style={{ padding: '1rem', width: '40px', textAlign: 'center' }}>
              <input 
                type="checkbox" 
                className="form-checkbox"
                checked={commandes.length > 0 && selectedIds.length === commandes.length}
                onChange={toggleSelectAll}
              />
            </th>
            <th style={{ padding: '1rem' }}>Référence / Date</th>
            <th style={{ padding: '1rem' }}>Client</th>
            <th style={{ padding: '1rem' }}>Destination</th>
            <th style={{ padding: '1rem' }}>Montant</th>
            <th style={{ padding: '1rem' }}>Statut</th>
            <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {commandes.map((c) => {
            const dateRaw = c.date_creation?.toDate ? c.date_creation.toDate() : (c.date_creation || new Date());
            const dateStr = format(dateRaw, 'dd MMM yyyy', { locale: fr });
            const timeStr = format(dateRaw, 'HH:mm', { locale: fr });
            const isSelected = selectedIds.includes(c.id);
            
            return (
              <tr key={c.id} className="table-row-premium" style={{ 
                background: isSelected ? 'rgba(99, 102, 255, 0.04)' : 'white',
                boxShadow: isSelected ? '0 4px 15px rgba(99, 102, 255, 0.08)' : '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.2s ease',
                borderRadius: '16px'
              }}>
                <td style={{ padding: '1.25rem', textAlign: 'center', borderRadius: '16px 0 0 16px' }}>
                  <input 
                    type="checkbox" 
                    className="form-checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(c.id)}
                  />
                </td>
                
                <td style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '10px', color: '#64748b' }}>
                      <Hash size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, color: '#1e293b', fontSize: '0.95rem' }}>#{c.id.slice(0, 8).toUpperCase()}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{dateStr} • {timeStr}</div>
                    </div>
                  </div>
                </td>

                <td style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '36px', height: '36px', background: 'var(--primary)10', color: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                      {c.nom_client?.charAt(0) || <User size={16} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{c.nom_client || 'Client Inconnu'}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>{c.telephone_client}</div>
                    </div>
                  </div>
                </td>

                <td style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={14} color="#64748b" />
                    <div>
                      <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>{c.commune_livraison}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.adresse_livraison}</div>
                    </div>
                  </div>
                </td>

                <td style={{ padding: '1.25rem' }}>
                  <div style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.1rem' }}>
                    {Number(c.montant_total).toLocaleString()} <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>F</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>{c.lignes?.length || 0} articles</div>
                </td>

                <td style={{ padding: '1.25rem' }}>
                  {getStatusBadge(c.statut_commande)}
                </td>

                <td style={{ padding: '1.25rem', textAlign: 'right', borderRadius: '0 16px 16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button 
                      className="btn-action-premium" 
                      onClick={() => onActionClick && onActionClick(c)}
                      title={actionLabel}
                    >
                      {getIconComponent(actionIcon)}
                    </button>

                    <button 
                      className="btn-action-premium" 
                      onClick={() => onEditClick && onEditClick(c)}
                      title="Modifier"
                      style={{ color: '#f59e0b' }}
                    >
                      <Edit2 size={18} />
                    </button>
                    
                    <button 
                      className="btn-action-premium" 
                      onClick={() => onInvoiceClick && onInvoiceClick(c)}
                      title="Facture"
                    >
                      <FileText size={18} />
                    </button>

                    <button 
                      className="btn-action-premium" 
                      onClick={() => { if(window.confirm('Supprimer cette commande ?')) onDelete?.(c); }}
                      title="Supprimer"
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <style>{`
        .table-row-premium:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.06) !important;
          background: #f8fafc !important;
        }
        .btn-action-premium {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid #f1f5f9;
          background: white;
          color: #64748b;
          display: flex;
          alignItems: center;
          justifyContent: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-action-premium:hover {
          border-color: var(--primary);
          color: var(--primary);
          background: var(--primary)05;
          transform: scale(1.05);
        }
        .form-checkbox {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 2px solid #cbd5e1;
          cursor: pointer;
          accent-color: var(--primary);
        }
      `}</style>
    </div>
  );
};
