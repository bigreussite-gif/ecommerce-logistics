import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Commande, StatutCommande } from '../../types';
import { Eye, PhoneCall, Truck, Trash2, FileText, Edit2, User, Hash, ShoppingBag } from 'lucide-react';

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
  const styles: Record<string, { bg: string, color: string, label: string, border: string }> = {
    'en_attente_appel': { bg: '#fffbeb', color: '#b45309', label: 'Attente Appel', border: '#fef3c7' },
    'a_rappeler': { bg: '#fff1f2', color: '#be123c', label: 'À Rappeler', border: '#ffe4e6' },
    'validee': { bg: '#f0fdf4', color: '#15803d', label: 'Validée', border: '#dcfce7' },
    'en_cours_livraison': { bg: '#eff6ff', color: '#1d4ed8', label: 'En Livraison', border: '#dbeafe' },
    'livree': { bg: '#f0fdf4', color: '#166534', label: 'Livrée', border: '#dcfce7' },
    'terminee': { bg: '#f0fdf4', color: '#166534', label: 'Terminée', border: '#dcfce7' },
    'echouee': { bg: '#fef2f2', color: '#991b1b', label: 'Échouée', border: '#fee2e2' },
    'retour_livreur': { bg: '#fff7ed', color: '#9a3412', label: 'Retour Livr.', border: '#ffedd5' },
    'retour_stock': { bg: '#f8fafc', color: '#475569', label: 'En Stock', border: '#f1f5f9' },
    'annulee': { bg: '#f1f5f9', color: '#64748b', label: 'Annulée', border: '#e2e8f0' },
    'retour_client': { bg: '#fff7ed', color: '#c2410c', label: 'Retour Client', border: '#ffedd5' }
  };

  const style = styles[status] || { bg: '#f1f5f9', color: '#64748b', label: status, border: '#e2e8f0' };

  return (
    <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      padding: '0.35rem 0.75rem', 
      borderRadius: '12px', 
      fontSize: '0.7rem', 
      fontWeight: 900, 
      background: style.bg, 
      color: style.color,
      border: `1px solid ${style.border}`,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: style.color, marginRight: '0.5rem' }}></span>
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
      <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#94a3b8' }}>
        <div style={{ width: '80px', height: '80px', background: '#f1f5f9', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <ShoppingBag size={40} style={{ opacity: 0.2 }} />
        </div>
        <p style={{ fontSize: '1.2rem', fontWeight: 850, color: '#1e293b' }}>Aucune commande dans cette section</p>
        <p style={{ fontSize: '0.95rem', marginTop: '0.5rem', fontWeight: 600 }}>Modifiez vos filtres ou lancez une nouvelle recherche.</p>
      </div>
    );
  }

  return (
    <div className="table-container" style={{ overflowX: 'auto', background: 'white', borderRadius: '24px', boxShadow: 'var(--shadow-premium)', border: '1px solid #f1f5f9' }}>
      <table style={{ width: '100%', borderSpacing: '0', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '1000px' }}>
        <thead>
          <tr style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <th style={{ padding: '1.25rem 1rem', width: '60px', textAlign: 'center' }}>
              <input 
                type="checkbox" 
                className="form-checkbox"
                checked={commandes.length > 0 && selectedIds.length === commandes.length}
                onChange={toggleSelectAll}
              />
            </th>
            <th style={{ padding: '1.25rem 1rem', width: '180px', textAlign: 'left' }}>Référence & Date</th>
            <th style={{ padding: '1.25rem 1rem', width: '220px', textAlign: 'left' }}>Identité Client</th>
            <th style={{ padding: '1.25rem 1rem', width: '200px', textAlign: 'left' }}>Localisation</th>
            <th style={{ padding: '1.25rem 1rem', width: '160px', textAlign: 'left' }}>Détails Financiers</th>
            <th style={{ padding: '1.25rem 1rem', width: '160px', textAlign: 'left' }}>État Flux</th>
            <th style={{ padding: '1.25rem 1rem', width: '180px', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {commandes.map((c) => {
            const dateRaw = c.date_creation?.toDate ? c.date_creation.toDate() : (c.date_creation || new Date());
            const dateStr = format(dateRaw, 'dd/MM/yyyy', { locale: fr });
            const isSelected = selectedIds.includes(c.id);
            
            return (
              <tr key={c.id} className="table-row-premium" style={{ 
                background: isSelected ? '#f8faff' : 'white',
                borderBottom: '1px solid #f8fafc',
                transition: 'all 0.2s ease'
              }}>
                <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    className="form-checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(c.id)}
                  />
                </td>
                
                <td style={{ padding: '1.25rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', background: '#f1f5f9', borderRadius: '10px', color: '#64748b', flexShrink: 0 }}>
                      <Hash size={14} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 950, color: '#1e293b', fontSize: '0.85rem', fontFamily: 'monospace' }}>#{c.id.slice(0, 8).toUpperCase()}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, marginTop: '0.1rem' }}>{dateStr}</div>
                    </div>
                  </div>
                </td>

                <td style={{ padding: '1.25rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', color: '#1e293b', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem', flexShrink: 0 }}>
                      {c.nom_client?.charAt(0) || <User size={14} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 850, color: '#1e293b', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nom_client || 'Client Inconnu'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 800 }}>{c.telephone_client}</div>
                    </div>
                  </div>
                </td>

                <td style={{ padding: '1.25rem 1rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 850, color: '#334155', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.commune_livraison ? c.commune_livraison : (
                        <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.75rem', background: '#fef2f2', padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid #fee2e2', display: 'inline-block' }}>
                          Sans commune
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.adresse_livraison || 'Sans adresse'}</div>
                  </div>
                </td>

                <td style={{ padding: '1.25rem 1rem' }}>
                  <div style={{ fontWeight: 950, color: '#1e293b', fontSize: '0.95rem' }}>
                    {Number(c.montant_total).toLocaleString()} <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>F</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginTop: '0.1rem' }}>
                    {c.lignes?.length || 0} Article(s)
                  </div>
                </td>

                <td style={{ padding: '1.25rem 1rem' }}>
                  {getStatusBadge(c.statut_commande)}
                </td>

                <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                    <button className="btn-icon-premium" onClick={() => onActionClick && onActionClick(c)} title={actionLabel}>
                      {getIconComponent(actionIcon)}
                    </button>
                    <button className="btn-icon-premium" onClick={() => onEditClick && onEditClick(c)} title="Modifier" style={{ color: '#f59e0b' }}>
                      <Edit2 size={16} />
                    </button>
                    <button className="btn-icon-premium" onClick={() => onInvoiceClick && onInvoiceClick(c)} title="Facture">
                      <FileText size={16} />
                    </button>
                    <button className="btn-icon-premium" onClick={() => { if(window.confirm('Supprimer cette commande ?')) onDelete?.(c); }} title="Supprimer" style={{ color: '#ef4444' }}>
                      <Trash2 size={16} />
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
          background: #f8fafc !important;
          box-shadow: inset 4px 0 0 var(--primary);
        }
        .btn-icon-premium {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid #f1f5f9;
          background: white;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-icon-premium:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .form-checkbox {
          width: 18px;
          height: 18px;
          border-radius: 6px;
          border: 2px solid #e2e8f0;
          cursor: pointer;
          accent-color: var(--primary);
        }
      `}</style>
    </div>
  );
};
