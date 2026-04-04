import { useState, useEffect } from 'react';
import { insforge } from '../lib/insforge';
import { Package, AlertTriangle, Trash2 } from 'lucide-react';

interface DefaillantItem {
  id: string;
  motif: string;
  notes: string;
  etat_produit: string;
  created_at: string;
  produits: { nom: string };
  commandes: { id: string, nom_client: string };
}

export const Defaillants = () => {
  const [items, setItems] = useState<DefaillantItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDefaillants = async () => {
    setLoading(true);
    try {
      const { data, error } = await insforge.database
        .from('retours')
        .select('*, produits(nom), commandes(id, nom_client)')
        .neq('etat_produit', 'REUTILISABLE')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefaillants();
  }, []);

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>
          Articles Défaillants & Retirés
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>
          Inventaire des produits non réutilisables issus des retours clients.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>Chargement de l'inventaire défectueux...</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '6rem 2rem', borderRadius: '32px' }}>
          <Package size={48} style={{ color: '#e2e8f0', marginBottom: '1.5rem' }} />
          <h3 style={{ fontWeight: 700, margin: 0 }}>Aucun article défaillant</h3>
          <p style={{ color: 'var(--text-muted)' }}>Votre stock est actuellement exempt de produits défectueux.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {items.map(item => (
            <div key={item.id} className="card glass-effect" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid #fee2e2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span className={`badge ${item.etat_produit === 'DEFAILLANT' ? 'badge-danger' : 'badge-warning'}`}>
                  {item.etat_produit}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
              
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 800 }}>{item.produits?.nom || 'Produit Inconnu'}</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0' }}>
                Issu de la commande <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>#{item.commandes?.id.slice(-6).toUpperCase()}</span> ({item.commandes?.nom_client})
              </p>

              <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem', border: '1px dashed #fecaca' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Motif du retrait</div>
                    <p style={{ fontSize: '0.85rem', color: '#b91c1c', margin: 0, fontWeight: 500 }}>{item.motif}</p>
                    {item.notes && (
                      <p style={{ fontSize: '0.8rem', color: '#991b1b', marginTop: '0.5rem', fontStyle: 'italic' }}>"{item.notes}"</p>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1, borderRadius: '12px' }} onClick={() => window.alert("Fonctionnalité de réparation en cours de développement")}>
                  Réparé ?
                </button>
                <button className="btn btn-sm" style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px' }} onClick={() => window.alert("Demande de mise au rebut envoyée")}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
