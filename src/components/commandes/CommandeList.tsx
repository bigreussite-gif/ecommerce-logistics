import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Commande, StatutCommande } from '../../types';
import { Eye, PhoneCall, Truck } from 'lucide-react';

interface CommandeListProps {
  commandes: Commande[];
  onRefresh: () => void;
  onActionClick?: (commande: Commande) => void;
  actionIcon?: 'Eye' | 'PhoneCall' | 'Truck';
  actionLabel?: string;
}

const getStatusBadge = (status: StatutCommande) => {
  switch (status) {
    case 'en_attente_appel': return <span className="badge badge-warning">À appeler</span>;
    case 'a_rappeler': return <span className="badge badge-warning" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)' }}>À rappeler</span>;
    case 'validee': return <span className="badge badge-info">Validée</span>;
    case 'en_cours_livraison': return <span className="badge" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>En livraison</span>;
    case 'livree': return <span className="badge badge-success">Livrée</span>;
    case 'retour_livreur': return <span className="badge badge-danger">Retour Livreur</span>;
    case 'retour_stock': return <span className="badge badge-danger" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}>Retour Stock</span>;
    case 'annulee': return <span className="badge badge-danger">Annulée</span>;
    default: return <span className="badge">{status}</span>;
  }
};

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'PhoneCall': return <PhoneCall size={16} />;
    case 'Truck': return <Truck size={16} />;
    default: return <Eye size={16} />;
  }
};

export const CommandeList = ({ commandes, onActionClick, actionIcon = 'Eye', actionLabel = 'Voir détails' }: CommandeListProps) => {
  if (commandes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
        <p>Aucune commande trouvée.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Client</th>
            <th>Commune</th>
            <th>Montant</th>
            <th>Source</th>
            <th>Statut</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {commandes.map((c) => {
            const dateStr = c.date_creation?.toDate ? format(c.date_creation.toDate(), 'dd MMM yyyy HH:mm', { locale: fr }) : 'N/A';
            return (
              <tr key={c.id}>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{dateStr}</td>
                <td>
                   <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.nom_client || `Client #${c.client_id.slice(0,5)}`}</div>
                   {c.telephone_client && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.telephone_client}</div>}
                </td>
                <td>{c.commune_livraison}</td>
                <td style={{ fontWeight: 600 }}>{Number(c.montant_total).toLocaleString()} CFA</td>
                <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{c.source_commande}</td>
                <td>{getStatusBadge(c.statut_commande)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button 
                    className="btn btn-outline" 
                    style={{ padding: '0.25rem 0.5rem' }} 
                    title={actionLabel}
                    onClick={() => onActionClick && onActionClick(c)}
                  >
                    {getIconComponent(actionIcon)}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
