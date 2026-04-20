import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Commande, StatutCommande } from '../../types';
import { Eye, PhoneCall, Truck, Trash2, FileText, Edit2 } from 'lucide-react';

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
  switch (status) {
    case 'en_attente_appel': return <span className="badge badge-warning">En attente appel</span>;
    case 'a_rappeler': return <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>À rappeler</span>;
    case 'validee': return <span className="badge badge-success" style={{ background: 'rgba(5, 150, 105, 0.15)', color: '#059669' }}>Validée</span>;
    case 'en_cours_livraison': return <span className="badge brand-glow" style={{ background: 'rgba(99, 102, 255, 0.15)', color: 'var(--primary)', fontWeight: 800 }}>En livraison</span>;
    case 'livree': return <span className="badge badge-success" style={{ background: '#10b981', color: 'white', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>Livrée</span>;
    case 'echouee': return <span className="badge badge-danger">Échouée</span>;
    case 'retour_livreur': return <span className="badge badge-danger" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>Retour livr.</span>;
    case 'retour_stock': return <span className="badge badge-danger" style={{ background: '#ef4444', color: 'white' }}>En Stock (Retour)</span>;
    case 'annulee': return <span className="badge" style={{ background: '#f1f5f9', color: '#94a3b8' }}>Annulée</span>;
    default: return <span className="badge">{status.replace(/_/g, ' ')}</span>;
  }
};

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'PhoneCall': return <PhoneCall size={18} strokeWidth={2.5} />;
    case 'Truck': return <Truck size={18} strokeWidth={2.5} />;
    default: return <Eye size={18} strokeWidth={2.5} />;
  }
};

export const CommandeList = ({ 
  commandes, 
  selectedIds = [],
  onSelectionChange,
  onActionClick, 
  onViewClick,
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
      <div className="card" style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)', background: 'transparent', boxShadow: 'none' }}>
        <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>Aucune commande dans cette catégorie.</p>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Les nouveaux flux apparaîtront ici en temps réel.</p>
      </div>
    );
  }

  return (
    <div className="card table-responsive-cards" style={{ padding: '0', background: 'transparent', boxShadow: 'none' }}>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input 
                  type="checkbox" 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  checked={commandes.length > 0 && selectedIds.length === commandes.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Date / ID</th>
              <th>Client & Contact</th>
              <th>Détails Livraison</th>
              <th>Montant Total</th>
              <th>Source</th>
              <th>État Actuel</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {commandes.map((c) => {
              const dateRaw = c.date_creation?.toDate ? c.date_creation.toDate() : (c.date_creation || new Date());
              const dateStr = format(dateRaw, 'dd MMM yyyy', { locale: fr });
              const timeStr = format(dateRaw, 'HH:mm', { locale: fr });
              const isSelected = selectedIds.includes(c.id);
              
              return (
                <tr key={c.id} style={{ backgroundColor: isSelected ? 'rgba(99, 102, 255, 0.03)' : 'transparent' }}>
                  <td>
                    <input 
                      type="checkbox" 
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      checked={isSelected}
                      onChange={() => toggleSelectOne(c.id)}
                    />
                  </td>
                  <td data-label="Date / ID">
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{dateStr}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{timeStr} • #{c.id.slice(0, 8).toUpperCase()}</div>
                  </td>
                  <td data-label="Client & Contact">
                     <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '0.2rem' }}>{c.nom_client || `Client #${c.client_id.slice(0,5)}`}</div>
                     {c.telephone_client && <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{c.telephone_client}</div>}
                  </td>
                  <td data-label="Livraison">
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.commune_livraison}</div>
                    {c.quartier_livraison && <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>{c.quartier_livraison}</div>}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: '1.2' }}>{c.adresse_livraison}</div>
                  </td>
                  <td data-label="Montant" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                    {Number(c.montant_total).toLocaleString()} <span style={{ fontSize: '0.75rem' }}>CFA</span>
                  </td>
                  <td data-label="Source">
                    <span className="badge" style={{ background: '#f8fafc', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {c.source_commande}
                    </span>
                  </td>
                  <td data-label="État Actuel">{getStatusBadge(c.statut_commande)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '0.6rem', borderRadius: '12px' }} 
                        title={actionLabel}
                        onClick={() => onActionClick && onActionClick(c)}
                      >
                        {getIconComponent(actionIcon)}
                      </button>

                      {onEditClick && (
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.6rem', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#f59e0b' }} 
                          title="Modifier la commande"
                          onClick={() => onEditClick(c)}
                        >
                          <Edit2 size={18} />
                        </button>
                      )}

                      {onViewClick && (
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.6rem', borderRadius: '12px', border: '1px solid #e2e8f0' }} 
                          title="Détails Articles"
                          onClick={() => onViewClick(c)}
                        >
                          <Eye size={18} strokeWidth={2.5} />
                        </button>
                      )}
                      
                      {onInvoiceClick && (
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.6rem', borderRadius: '12px', border: '1px solid #e2e8f0' }} 
                          title="Générer Facture PDF"
                          onClick={() => onInvoiceClick(c)}
                        >
                          <FileText size={18} />
                        </button>
                      )}

                      {onDelete && (
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.6rem', borderRadius: '12px', color: '#ef4444', borderColor: 'transparent' }} 
                          title="Supprimer"
                          onClick={() => { if(window.confirm('Supprimer cette commande définituvement ?')) onDelete(c); }}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
