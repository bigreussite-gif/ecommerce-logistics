import { useState, useEffect } from 'react';
import { getCommandesByStatus, updateCommandeStatus } from '../services/commandeService';
import type { Commande, LigneCommande } from '../types';
import { 
  RefreshCw, 
  Phone, History, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { CommandeDetails } from '../components/commandes/CommandeDetails';

export const Retours = () => {
  const [commandes, setCommandes] = useState<(Commande & { lignes: LigneCommande[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedViewOrderId, setSelectedViewOrderId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get orders that failed delivery and need to be returned to stock
      const data = await getCommandesByStatus(['echouee', 'retour_livreur']);
      setCommandes(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRestock = async (id: string) => {
    try {
      setLoading(true);
      // Moving to 'retour_stock' triggers the auto-restock in commandeService
      await updateCommandeStatus(id, 'retour_stock', {
        date_retour_stock: new Date().toISOString()
      });
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setConfirmingId(null);
    }
  };

  if (loading && !confirmingId) return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement des retours...</div>;

  return (
    <div style={{ animation: 'pageEnter 0.6s ease', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0 }}>Gestion RMA</h1>
          <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '1rem', marginTop: '0.4rem' }}>Validation des retours produits au stock physique</p>
        </div>
        <div className="card glass-effect" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: 'none', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444' }}>
          <History size={20} />
          <span style={{ fontWeight: 800 }}>{commandes.length} Colis en attente</span>
        </div>
      </div>

      {commandes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '6rem 2rem', background: 'white', borderRadius: '32px', border: '1px solid #f1f5f9' }}>
          <div style={{ width: '80px', height: '80px', background: '#f0fdf4', color: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <ShieldCheck size={40} />
          </div>
          <h2 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.5rem' }}>Tout est en ordre</h2>
          <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Aucun produit en attente de réintégration au stock.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {commandes.map(c => (
            <div key={c.id} className="card glass-effect h-full flex flex-col" style={{ padding: '1.5rem', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.5rem 1rem', background: '#fee2e2', color: '#ef4444', fontSize: '0.65rem', fontWeight: 900, borderRadius: '0 0 0 12px', textTransform: 'uppercase' }}>
                {c.statut_commande === 'retour_livreur' ? 'Chez le Livreur' : 'Échoué'}
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900 }}>#{c.id.slice(-6).toUpperCase()}</div>
                  <button 
                    onClick={() => setSelectedViewOrderId(c.id)}
                    className="btn btn-sm btn-outline" 
                    style={{ borderRadius: '10px', fontSize: '0.7rem' }}
                  >
                    Détails
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                  <Phone size={14} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{c.nom_client}</span>
                </div>
              </div>

              <div style={{ background: 'rgba(241, 245, 249, 0.5)', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Articles à réintégrer</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(c.lignes || []).map((l, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{l.quantite}x {l.nom_produit}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{Number(l.montant_ligne).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                {confirmingId === c.id ? (
                  <div style={{ display: 'flex', gap: '0.5rem', animation: 'fadeIn 0.3s ease' }}>
                    <button 
                      className="btn" 
                      style={{ flex: 1, background: '#f1f5f9', color: 'var(--text-muted)', height: '48px', borderRadius: '12px' }}
                      onClick={() => setConfirmingId(null)}
                    >
                      Annuler
                    </button>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 2, background: '#10b981', height: '48px', borderRadius: '12px', fontWeight: 800 }}
                      onClick={() => handleRestock(c.id)}
                    >
                      Confirmer Reprise
                    </button>
                  </div>
                ) : (
                  <button 
                    className="btn btn-primary w-full" 
                    style={{ height: '48px', borderRadius: '14px', background: 'var(--text-main)', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
                    onClick={() => setConfirmingId(c.id)}
                  >
                    <RefreshCw size={18} />
                    Remettre en Stock
                  </button>
                )}
                
                {c.notes_livreur && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fef2f2', borderRadius: '12px', border: '1px dashed #fecaca', display: 'flex', gap: '0.5rem' }}>
                    <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ fontSize: '0.75rem', color: '#991b1b', margin: 0, fontStyle: 'italic' }}>"{c.notes_livreur}"</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedViewOrderId && (
        <CommandeDetails 
          commandeId={selectedViewOrderId} 
          onClose={() => setSelectedViewOrderId(null)} 
        />
      )}
    </div>
  );
};
