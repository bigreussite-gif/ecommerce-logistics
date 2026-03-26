import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { CommandeList } from '../components/commandes/CommandeList';
import { CommandeForm } from '../components/commandes/CommandeForm';
import { CommandeDetails } from '../components/commandes/CommandeDetails';
import { subscribeToCommandes, deleteCommande, getCommandeWithLines } from '../services/commandeService';
import { generateInvoicePDF } from '../services/pdfService';
import type { Commande } from '../types';
import { useToast } from '../contexts/ToastContext';

export const Commandes = () => {
  const { showToast } = useToast();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCommandeId, setSelectedCommandeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'to_process' | 'in_delivery' | 'done' | 'failed'>('to_process');

  const handleInvoice = async (commande: Commande) => {
    try {
      showToast("Génération de la facture...", "info");
      const fullCommande = await getCommandeWithLines(commande.id);
      generateInvoicePDF(fullCommande);
      showToast("Facture générée !", "success");
    } catch (error) {
      console.error(error);
      showToast("Erreur PDF.", "error");
    }
  };

  const handleDelete = async (commande: Commande) => {
    try {
      await deleteCommande(commande.id);
      showToast("Commande supprimée.", "success");
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la suppression.", "error");
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCommandes((data) => {
      setCommandes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <>
      <div style={{ animation: 'pageEnter 0.6s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>Gestion des Commandes</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>Saisissez de nouvelles commandes et suivez leur cycle de vie.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setIsFormOpen(true)} style={{ padding: '0.8rem 1.5rem', borderRadius: '14px', fontSize: '0.95rem', fontWeight: 700 }}>
            <Plus size={20} />
            Nouvelle Commande
          </button>
        </div>

        {/* BARRE DE RECHERCHE ET TABS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div style={{ position: 'relative', maxWidth: '600px', width: '100%' }}>
            <div style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <Search size={20} strokeWidth={2.5} />
            </div>
            <input 
              type="text" 
              placeholder="Rechercher un client, téléphone, ID ou zone..." 
              className="form-input"
              style={{ 
                paddingLeft: '3.5rem', 
                height: '56px',
                fontSize: '1rem',
                borderRadius: '18px', 
                background: 'white',
                boxShadow: 'var(--shadow-premium)',
                border: '2px solid transparent',
                transition: 'all 0.3s ease'
              }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', overflowX: 'auto', gap: '0.75rem', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
            {[
              { id: 'to_process', label: 'À Traiter', color: '#f59e0b' },
              { id: 'in_delivery', label: 'En Livraison', color: 'var(--primary)' },
              { id: 'done', label: 'Terminées', color: '#10b981' },
              { id: 'failed', label: 'Retours/Échecs', color: '#ef4444' },
              { id: 'all', label: 'Tout', color: 'var(--primary)' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: activeTab === tab.id ? 'none' : '1px solid #e2e8f0',
                  background: activeTab === tab.id ? tab.color : 'white',
                  color: activeTab === tab.id ? 'white' : '#64748b',
                  boxShadow: activeTab === tab.id ? `0 8px 16px ${tab.color}33` : 'none',
                  transform: activeTab === tab.id ? 'translateY(-1px)' : 'none'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: 'transparent' }}>
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 1.5rem' }}></div>
              <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Synchronisation des flux en cours...</p>
            </div>
          ) : (
            <CommandeList 
              commandes={commandes.filter(c => {
                const matchesSearch = 
                  c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  c.telephone_client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  c.nom_client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  c.commune_livraison?.toLowerCase().includes(searchTerm.toLowerCase());
                
                if (!matchesSearch) return false;

                if (activeTab === 'all') return true;
                if (activeTab === 'to_process') return ['nouvelle', 'en_attente_appel', 'a_rappeler'].includes(c.statut_commande);
                if (activeTab === 'in_delivery') return ['validee', 'en_cours_livraison'].includes(c.statut_commande);
                if (activeTab === 'done') return ['livree', 'terminee'].includes(c.statut_commande);
                if (activeTab === 'failed') return ['echouee', 'retour_livreur', 'retour_stock'].includes(c.statut_commande);
                
                return true;
              })} 
              onActionClick={(c) => setSelectedCommandeId(c.id)}
              onDelete={handleDelete}
              onInvoiceClick={handleInvoice}
            />
          )}
        </div>
      </div>

      {isFormOpen && (
        <CommandeForm 
          onClose={() => setIsFormOpen(false)} 
          onSave={() => setIsFormOpen(false)} 
        />
      )}

      {selectedCommandeId && (
        <CommandeDetails 
          commandeId={selectedCommandeId} 
          onClose={() => setSelectedCommandeId(null)} 
        />
      )}
    </>
  );
};
