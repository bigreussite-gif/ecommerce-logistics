import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, CheckCircle, Download, X, ShoppingBag, Clock, Truck, AlertCircle, Calendar, TrendingUp } from 'lucide-react';
import { CommandeList } from '../components/commandes/CommandeList';
import { CommandeForm } from '../components/commandes/CommandeForm';
import { CommandeDetails } from '../components/commandes/CommandeDetails';
import { subscribeToCommandes, deleteCommande, getCommandeWithLines, bulkUpdateCommandeStatus } from '../services/commandeService';
import { generateInvoicePDF } from '../services/pdfService';
import type { Commande } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

type Period = 'today' | '7d' | '30d' | 'all' | 'custom';

export const Commandes = () => {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCommandeId, setSelectedCommandeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'to_process' | 'in_delivery' | 'done' | 'failed'>('to_process');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Stats & Periods
  const [period, setPeriod] = useState<Period>('all');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

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

  const handleBulkValidate = async () => {
    if (selectedIds.length === 0) return;
    try {
      showToast(`Validation de ${selectedIds.length} commandes...`, "info");
      await bulkUpdateCommandeStatus(selectedIds, 'validee', { 
        agent_appel_id: currentUser?.id,
        date_validation_appel: new Date()
      });
      showToast(`${selectedIds.length} commandes validées !`, "success");
      setSelectedIds([]);
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la validation groupée.", "error");
    }
  };

  const handleLogisticsExport = async () => {
    if (selectedIds.length === 0) return;
    try {
      showToast("Préparation de l'export logistique...", "info");
      const selectedCommandes = await Promise.all(selectedIds.map(id => getCommandeWithLines(id)));
      
      const headers = ['ID', 'Client', 'Téléphone', 'Commune', 'Adresse', 'Montant à Encaisser', 'Produits'];
      const rows = selectedCommandes.map(c => [
        `#${c.id.slice(0, 8).toUpperCase()}`,
        c.nom_client || '',
        c.telephone_client || '',
        c.commune_livraison || '',
        c.adresse_livraison?.replace(/,/g, ' ') || '',
        `${c.montant_total} CFA`,
        c.lignes.map(l => `${l.quantite}x ${l.nom_produit}`).join(' | ')
      ]);

      const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `export_logistique_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Export logistique téléchargé !", "success");
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de l'export.", "error");
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

  const filteredByDateCommandes = useMemo(() => {
    if (period === 'all') return commandes;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const now = new Date();
    let effectiveStart = start;
    let effectiveEnd = end;

    if (period === 'today') {
      effectiveStart = new Date(now);
      effectiveStart.setHours(0, 0, 0, 0);
      effectiveEnd = new Date(now);
      effectiveEnd.setHours(23, 59, 59, 999);
    } else if (period === '7d') {
      effectiveStart = new Date(now);
      effectiveStart.setDate(now.getDate() - 7);
      effectiveStart.setHours(0, 0, 0, 0);
      effectiveEnd = new Date(now);
    } else if (period === '30d') {
      effectiveStart = new Date(now);
      effectiveStart.setDate(now.getDate() - 30);
      effectiveStart.setHours(0, 0, 0, 0);
      effectiveEnd = new Date(now);
    }

    return commandes.filter(c => {
      const d = new Date(c.date_creation);
      return d >= effectiveStart && d <= effectiveEnd;
    });
  }, [commandes, period, startDate, endDate]);

  const stats = useMemo(() => {
    const total = filteredByDateCommandes.length;
    const processing = filteredByDateCommandes.filter(c => ['nouvelle', 'en_attente_appel', 'a_rappeler'].includes(c.statut_commande)).length;
    const inDelivery = filteredByDateCommandes.filter(c => ['validee', 'en_cours_livraison'].includes(c.statut_commande)).length;
    const delivered = filteredByDateCommandes.filter(c => ['livree', 'terminee'].includes(c.statut_commande)).length;
    const failed = filteredByDateCommandes.filter(c => ['echouee', 'retour_livreur', 'retour_stock'].includes(c.statut_commande)).length;
    const cancelled = filteredByDateCommandes.filter(c => c.statut_commande === 'annulee').length;
    
    const successRate = total > 0 ? Math.round((delivered / (delivered + failed)) * 100) || 0 : 0;

    return { total, processing, inDelivery, delivered, failed, cancelled, successRate };
  }, [filteredByDateCommandes]);

  const filteredCommandes = filteredByDateCommandes.filter(c => {
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
  });

  return (
    <>
      <div style={{ animation: 'pageEnter 0.6s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div className="mobile-stack">
            <h1 className="text-premium" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.2rem)', fontWeight: 800, margin: 0 }}>Gestion des Commandes</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.4rem', fontWeight: 500 }}>Suivi temps réel et pilotage de vos flux logistiques.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* Period Filter Dropdown replacement or simple buttons */}
            <div style={{ display: 'flex', background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '0.3rem', boxShadow: 'var(--shadow-premium)', position: 'relative' }}>
               {(['today', '7d', '30d', 'all'] as Period[]).map((p) => (
                 <button
                   key={p}
                   onClick={() => setPeriod(p)}
                   style={{
                     padding: '0.4rem 0.8rem',
                     borderRadius: '10px',
                     fontSize: '0.75rem',
                     fontWeight: 800,
                     border: 'none',
                     background: period === p ? 'var(--primary)' : 'transparent',
                     color: period === p ? 'white' : '#64748b',
                     cursor: 'pointer',
                     transition: 'all 0.2s'
                   }}
                 >
                   {p === 'today' ? "Aujourd'hui" : p === '7d' ? '7j' : p === '30d' ? '30j' : 'Tout'}
                 </button>
               ))}
               <button 
                 onClick={() => setPeriod('custom')}
                 style={{
                   padding: '0.4rem 0.8rem',
                   borderRadius: '10px',
                   fontSize: '0.75rem',
                   fontWeight: 800,
                   border: 'none',
                   background: period === 'custom' ? 'var(--primary)' : 'transparent',
                   color: period === 'custom' ? 'white' : '#64748b',
                   cursor: 'pointer',
                   display: 'flex',
                   alignItems: 'center',
                   gap: '0.3rem'
                 }}
               >
                 <Calendar size={12} />
                 Perso.
               </button>
            </div>

            <button className="btn btn-primary" onClick={() => setIsFormOpen(true)} style={{ padding: '0.8rem 1.5rem', borderRadius: '14px', fontSize: '0.95rem', fontWeight: 700 }}>
              <Plus size={20} />
              Nouvelle Commande
            </button>
          </div>
        </div>

        {period === 'custom' && (
          <div className="card" style={{ marginBottom: '2rem', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center', animation: 'slideDown 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Du</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input" style={{ width: 'auto', padding: '0.4rem' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Au</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input" style={{ width: 'auto', padding: '0.4rem' }} />
            </div>
          </div>
        )}

        {/* DASHBOARD STATS */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '1.25rem', 
          marginBottom: '2.5rem' 
        }}>
          {[
            { label: 'Total Commandes', value: stats.total, color: 'var(--primary)', icon: <ShoppingBag size={24} />, shadow: 'var(--shadow-premium)' },
            { label: 'En Traitement', value: stats.processing, color: '#f59e0b', icon: <Clock size={24} />, shadow: '0 10px 20px rgba(245, 158, 11, 0.15)' },
            { label: 'En Livraison', value: stats.inDelivery, color: '#6366f1', icon: <Truck size={24} />, shadow: '0 10px 20px rgba(99, 102, 241, 0.15)' },
            { label: 'Livrées', value: stats.delivered, color: '#10b981', icon: <CheckCircle size={24} />, shadow: '0 10px 20px rgba(16, 185, 129, 0.15)' },
            { label: 'Échecs / Retours', value: stats.failed, color: '#ef4444', icon: <AlertCircle size={24} />, shadow: '0 10px 20px rgba(239, 68, 68, 0.15)' },
            { label: 'Taux de Succès', value: `${stats.successRate}%`, color: '#8b5cf6', icon: <TrendingUp size={24} />, shadow: '0 10px 20px rgba(139, 92, 246, 0.15)', subLabel: `${stats.delivered}/${stats.delivered+stats.failed} colis` }
          ].map((item, idx) => (
            <div 
              key={idx} 
              className="card glass-effect" 
              style={{ 
                padding: '1.5rem', 
                borderRadius: '24px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.75rem',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: item.shadow,
                transition: 'transform 0.3s ease',
                cursor: 'default'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ padding: '0.6rem', borderRadius: '14px', background: `${item.color}15`, color: item.color }}>
                  {item.icon}
                </div>
                {item.subLabel && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>{item.subLabel}</span>}
              </div>
              <div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '0.1rem' }}>{item.value}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
              </div>
            </div>
          ))}
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

        <div style={{ background: 'transparent', position: 'relative' }}>
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 1.5rem' }}></div>
              <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Synchronisation des flux en cours...</p>
            </div>
          ) : (
            <CommandeList 
              commandes={filteredCommandes} 
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onActionClick={(c) => setSelectedCommandeId(c.id)}
              onDelete={handleDelete}
              onInvoiceClick={handleInvoice}
            />
          )}

          {/* Floating Batch Action Bar */}
          {selectedIds.length > 0 && (
            <div 
              style={{ 
                position: 'fixed', 
                bottom: '2rem', 
                left: '50%', 
                transform: 'translateX(-50%)', 
                background: 'var(--bg-card)', 
                padding: '1rem 2rem', 
                borderRadius: '24px', 
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1.5rem',
                border: '1px solid var(--primary)',
                zIndex: 1000,
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderRight: '1px solid #e2e8f0', paddingRight: '1.5rem' }}>
                <span style={{ background: 'var(--primary)', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 900 }}>
                  {selectedIds.length}
                </span>
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Sélectionnés</span>
                <button 
                  onClick={() => setSelectedIds([])}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  className="btn btn-sm btn-primary" 
                  onClick={handleBulkValidate}
                  style={{ borderRadius: '12px', padding: '0.6rem 1.2rem' }}
                >
                  <CheckCircle size={18} /> Valider Groupée
                </button>
                <button 
                  className="btn btn-sm btn-outline" 
                  onClick={handleLogisticsExport}
                  style={{ borderRadius: '12px', padding: '0.6rem 1.2rem', border: '1px solid #e2e8f0' }}
                >
                  <Download size={18} /> Export Livreurs
                </button>
              </div>
            </div>
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
