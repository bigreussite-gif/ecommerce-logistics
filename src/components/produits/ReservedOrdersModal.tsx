import { useState, useEffect } from 'react';
import { X, AlertCircle, Search, PackageX } from 'lucide-react';
import { insforge } from '../../lib/insforge';
import { Produit } from '../../types';
import { updateCommandeStatus } from '../../services/commandeService';
import { useToast } from '../../contexts/ToastContext';

interface ReservedOrdersModalProps {
  produit: Produit;
  type: 'reserve' | 'livraison';
  onClose: () => void;
}

export const ReservedOrdersModal = ({ produit, type, onClose }: ReservedOrdersModalProps) => {
  const { showToast } = useToast();
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const statuses = type === 'reserve' 
        ? ['nouvelle', 'a_rappeler', 'en_attente_appel', 'validee']
        : ['en_cours_livraison', 'echouee', 'retour_livreur'];

      const { data, error } = await insforge.database
        .from('lignes_commandes')
        .select(`
          quantite,
          commande_id,
          commandes!inner (
            id,
            nom_client,
            telephone_client,
            statut_commande,
            date_creation,
            commune_livraison
          )
        `)
        .eq('produit_id', produit.id)
        .in('commandes.statut_commande', statuses);

      if (error) throw error;

      let validOrders = (data || []).map((l: any) => ({
        quantite_reservee: l.quantite,
        ...l.commandes
      }));

      // Filter out > 14 days for reserved
      if (type === 'reserve') {
        const now = new Date();
        validOrders = validOrders.filter(cmd => {
          if (!cmd.date_creation) return true;
          const date = new Date(cmd.date_creation);
          const daysOld = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
          if (['nouvelle', 'a_rappeler', 'en_attente_appel'].includes(cmd.statut_commande?.toLowerCase()) && daysOld > 14) {
            return false;
          }
          return true;
        });
      }

      setCommandes(validOrders);
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la récupération des commandes.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [produit.id, type]);

  const handleCancel = async (cmdId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir annuler cette commande ? Le stock sera libéré immédiatement.")) return;
    setCancelingId(cmdId);
    try {
      await updateCommandeStatus(cmdId, 'annulee');
      showToast("Commande annulée avec succès. Le stock a été libéré.", "success");
      fetchOrders();
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'annulation de la commande.", "error");
    } finally {
      setCancelingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'nouvelle': return <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>Nouvelle</span>;
      case 'validee': return <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>Validée</span>;
      case 'a_rappeler': return <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>À rappeler</span>;
      case 'en_attente_appel': return <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>En attente d'appel</span>;
      case 'en_cours_livraison': return <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>En cours de livraison</span>;
      case 'echouee': return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>Échouée</span>;
      case 'retour_livreur': return <span style={{ background: '#fce7f3', color: '#be185d', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>Retour Livreur</span>;
      default: return <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>{status}</span>;
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: '24px', width: '100%', maxWidth: '800px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={24} color={type === 'reserve' ? '#d97706' : '#2563eb'} />
              {type === 'reserve' ? 'Commandes Réservant cet Article' : 'Commandes En Livraison'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.25rem 0 0 0', fontWeight: 500 }}>
              {produit.nom} <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>({produit.sku})</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: 'white' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid #f3f4f6', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : commandes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
              <PackageX size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#475569' }}>Aucune commande trouvée.</p>
              <p style={{ fontSize: '0.9rem' }}>Il n'y a pas de commandes affectant le stock pour ce produit en ce moment.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {commandes.map((cmd) => (
                <div key={cmd.id} style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '16px',
                  background: '#f8fafc', transition: 'all 0.2s ease'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>#{cmd.id.slice(0, 8).toUpperCase()}</span>
                      {getStatusBadge(cmd.statut_commande)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                      <span>{cmd.nom_client}</span>
                      <span>•</span>
                      <span>{cmd.telephone_client}</span>
                      {cmd.commune_livraison && (
                        <>
                          <span>•</span>
                          <span>{cmd.commune_livraison}</span>
                        </>
                      )}
                      <span>•</span>
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>
                        Bloque : <span style={{ color: type === 'reserve' ? '#d97706' : '#2563eb' }}>{cmd.quantite_reservee} unité(s)</span>
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      Créée le {new Date(cmd.date_creation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() => handleCancel(cmd.id)}
                      disabled={cancelingId === cmd.id}
                      style={{ 
                        padding: '0.5rem 1rem', borderRadius: '10px', 
                        background: '#fee2e2', color: '#dc2626', 
                        border: '1px solid #fecaca', fontWeight: 700, 
                        fontSize: '0.85rem', cursor: cancelingId === cmd.id ? 'not-allowed' : 'pointer',
                        opacity: cancelingId === cmd.id ? 0.7 : 1,
                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                      }}
                    >
                      {cancelingId === cmd.id ? 'Annulation...' : 'Annuler Commande'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
