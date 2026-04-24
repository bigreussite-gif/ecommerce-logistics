import { useState, useEffect } from 'react';
import { getCommandesByStatus, confirmRMAMovement } from '../services/commandeService';
import type { Commande, LigneCommande } from '../types';
import { 
  RefreshCw, 
  Phone, History, AlertTriangle, ShieldCheck, X, CheckCircle2, AlertOctagon, MessageSquare
} from 'lucide-react';
import { CommandeDetails } from '../components/commandes/CommandeDetails';
import { useToast } from '../contexts/ToastContext';

export const Retours = () => {
  const [commandes, setCommandes] = useState<(Commande & { lignes: LigneCommande[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedViewOrderId, setSelectedViewOrderId] = useState<string | null>(null);
  const [rmaModalOrder, setRmaModalOrder] = useState<(Commande & { lignes: LigneCommande[] }) | null>(null);
  const [rmaData, setRmaData] = useState({
    choice: 'REUTILISABLE' as 'REUTILISABLE' | 'DEFAILLANT',
    notes: ''
  });

  const { showToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getCommandesByStatus(['echouee', 'retour_livreur']);
      setCommandes(data);
    } catch (error) {
      showToast('Erreur lors du chargement des retours', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConfirmRMA = async () => {
    if (!rmaModalOrder) return;
    try {
      setLoading(true);
      await confirmRMAMovement(rmaModalOrder.id, rmaData.choice, rmaData.notes);
      showToast(`Produit ${rmaData.choice === 'REUTILISABLE' ? 'réintégré' : 'marqué défaillant'} avec succès`, 'success');
      setRmaModalOrder(null);
      setRmaData({ choice: 'REUTILISABLE', notes: '' });
      fetchData();
    } catch (error) {
      showToast('Erreur lors de la validation', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !rmaModalOrder) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
      <div className="spinner"></div>
      <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Synchronisation du flux RMA...</p>
    </div>
  );

  return (
    <div style={{ animation: 'pageEnter 0.6s ease', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0 }}>Gestion RMA</h1>
          <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '1.1rem', marginTop: '0.4rem' }}>Validation des retours produits au stock physique</p>
        </div>
        <div className="card glass-effect" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: 'none', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', borderRadius: '16px' }}>
          <History size={20} />
          <span style={{ fontWeight: 800 }}>{commandes.length} Colis en attente</span>
        </div>
      </div>

      {commandes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '8rem 2rem', background: 'white', borderRadius: '40px', border: '1px solid #f1f5f9', boxShadow: '0 20px 40px -20px rgba(0,0,0,0.05)' }}>
          <div style={{ width: '100px', height: '100px', background: '#f0fdf4', color: '#22c55e', borderRadius: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', transform: 'rotate(-5deg)' }}>
            <ShieldCheck size={48} />
          </div>
          <h2 style={{ fontWeight: 900, fontSize: '2rem', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>Tout est en ordre</h2>
          <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '1.1rem', maxWidth: '400px', margin: '0 auto' }}>Le stock physique est parfaitement synchronisé avec le flux logistique.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '2rem' }}>
          {commandes.map(c => (
            <div key={c.id} className="card glass-effect h-full flex flex-col hover-card" style={{ padding: '2rem', borderRadius: '32px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.8)' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.6rem 1.25rem', background: '#fee2e2', color: '#ef4444', fontSize: '0.75rem', fontWeight: 900, borderRadius: '0 0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {c.statut_commande === 'retour_livreur' ? 'Chez le Livreur' : 'Échoué'}
              </div>

              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 950, letterSpacing: '-0.03em', color: 'var(--text-main)' }}>#{c.id.slice(-6).toUpperCase()}</div>
                  <button 
                    onClick={() => setSelectedViewOrderId(c.id)}
                    className="btn btn-sm btn-outline" 
                    style={{ borderRadius: '12px', fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                  >
                    Détails
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.75rem', color: 'var(--text-muted)' }}>
                  <div style={{ width: '32px', height: '32px', background: '#f8fafc', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Phone size={14} /></div>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>{c.nom_client}</span>
                </div>
              </div>

              <div style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', padding: '1.5rem', borderRadius: '22px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Contenu du Colis</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(c.lignes || []).map((l, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '28px', height: '28px', background: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', border: '1px solid #e2e8f0' }}>{l.quantite}</div>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>{l.nom_produit}</span>
                      </div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{Number(l.montant_ligne).toLocaleString()} F</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button 
                  className="btn btn-primary w-full btn-premium-shadow" 
                  style={{ height: '56px', borderRadius: '18px', background: 'var(--text-main)', color: 'white', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontSize: '1.05rem' }}
                  onClick={() => setRmaModalOrder(c)}
                >
                  <RefreshCw size={20} />
                  Valider le Retour Physique
                </button>
                
                {c.notes_livreur && (
                  <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#fff1f2', borderRadius: '16px', border: '1px dashed #fecaca', display: 'flex', gap: '0.75rem' }}>
                    <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ fontSize: '0.85rem', color: '#991b1b', margin: 0, fontStyle: 'italic', lineHeight: '1.4', fontWeight: 500 }}>"{c.notes_livreur}"</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal RMA Choice */}
      {rmaModalOrder && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(12px)', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="modal-content card" style={{ width: '100%', maxWidth: '600px', padding: 0, borderRadius: '32px', overflow: 'hidden', border: 'none', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.3)' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--text-main), #475569)', padding: '2.5rem', color: 'white', position: 'relative' }}>
              <button onClick={() => setRmaModalOrder(null)} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '0.6rem', borderRadius: '14px', cursor: 'pointer' }}><X size={22} /></button>
              <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>Audit du Retour</h2>
              <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '1.05rem', fontWeight: 500 }}>Vérifiez l'état physique des produits pour la commande #{rmaModalOrder.id.slice(-6).toUpperCase()}</p>
            </div>

            <div style={{ padding: '2.5rem' }}>
              <div style={{ marginBottom: '2.5rem' }}>
                <label className="form-label" style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.25rem', display: 'block', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>État du Colis</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <button 
                    onClick={() => setRmaData({...rmaData, choice: 'REUTILISABLE'})}
                    style={{ 
                      padding: '2rem 1.5rem', 
                      borderRadius: '24px', 
                      border: '2px solid', 
                      borderColor: rmaData.choice === 'REUTILISABLE' ? '#10b981' : '#e2e8f0',
                      background: rmaData.choice === 'REUTILISABLE' ? '#f0fdf4' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '1rem',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ padding: '0.75rem', background: rmaData.choice === 'REUTILISABLE' ? '#10b981' : '#f1f5f9', color: rmaData.choice === 'REUTILISABLE' ? 'white' : '#94a3b8', borderRadius: '16px' }}><CheckCircle2 size={32} /></div>
                    <div>
                      <span style={{ display: 'block', fontWeight: 900, fontSize: '1.1rem', color: rmaData.choice === 'REUTILISABLE' ? '#065f46' : 'var(--text-main)' }}>Réutilisable</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Remettre en vente immédiatement</span>
                    </div>
                  </button>

                  <button 
                    onClick={() => setRmaData({...rmaData, choice: 'DEFAILLANT'})}
                    style={{ 
                      padding: '2rem 1.5rem', 
                      borderRadius: '24px', 
                      border: '2px solid', 
                      borderColor: rmaData.choice === 'DEFAILLANT' ? '#ef4444' : '#e2e8f0',
                      background: rmaData.choice === 'DEFAILLANT' ? '#fef2f2' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '1rem',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ padding: '0.75rem', background: rmaData.choice === 'DEFAILLANT' ? '#ef4444' : '#f1f5f9', color: rmaData.choice === 'DEFAILLANT' ? 'white' : '#94a3b8', borderRadius: '16px' }}><AlertOctagon size={32} /></div>
                    <div>
                      <span style={{ display: 'block', fontWeight: 900, fontSize: '1.1rem', color: rmaData.choice === 'DEFAILLANT' ? '#991b1b' : 'var(--text-main)' }}>Défaillant</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Retirer du stock (Pertes)</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '3rem' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MessageSquare size={16} /> Observations Audit (Optionnel)
                </label>
                <textarea 
                  className="form-input" 
                  rows={3} 
                  placeholder="Notez ici les éventuels dégâts ou motifs du retrait..."
                  value={rmaData.notes}
                  onChange={e => setRmaData({...rmaData, notes: e.target.value})}
                  style={{ borderRadius: '18px', padding: '1.25rem', fontSize: '1rem', fontWeight: 500 }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <button className="btn btn-outline" onClick={() => setRmaModalOrder(null)} style={{ flex: 1, height: '4.5rem', borderRadius: '18px', fontWeight: 800, fontSize: '1.1rem' }}>Annuler</button>
                <button 
                  className="btn btn-primary btn-premium-shadow" 
                  onClick={handleConfirmRMA}
                  disabled={loading}
                  style={{ 
                    flex: 1.8, 
                    height: '4.5rem', 
                    borderRadius: '18px', 
                    fontWeight: 950, 
                    fontSize: '1.2rem', 
                    background: rmaData.choice === 'REUTILISABLE' ? '#10b981' : '#ef4444',
                    border: 'none',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem'
                  }}
                >
                  {loading ? <div className="spinner-white"></div> : <><CheckCircle2 size={24} /> Confirmer la Décision</>}
                </button>
              </div>
            </div>
          </div>
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
