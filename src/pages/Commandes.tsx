import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, CheckCircle, Download, X, ShoppingBag, Clock, Truck, AlertCircle, Calendar } from 'lucide-react';
import { CommandeList } from '../components/commandes/CommandeList';
import { CommandeForm } from '../components/commandes/CommandeForm';
import { BulkImportModal } from '../components/commandes/BulkImportModal';
import { CommandeDetails } from '../components/commandes/CommandeDetails';
import { subscribeToCommandes, deleteCommande, getCommandeWithLines, bulkUpdateCommandeStatus } from '../services/commandeService';
import { generateInvoicePDF } from '../services/pdfService';
import type { Commande, LigneCommande } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

type Period = 'today' | '7d' | '30d' | 'all' | 'custom';

export const Commandes = () => {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [selectedCommandeId, setSelectedCommandeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'to_process' | 'in_delivery' | 'done' | 'failed' | 'annulee' | 'retours'>('to_process');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingCommande, setEditingCommande] = useState<Commande | null>(null);
  const [originalLines, setOriginalLines] = useState<LigneCommande[]>([]);
  
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

  const handleEdit = async (commande: Commande) => {
    try {
      showToast("Préparation de la modification...", "info");
      const full = await getCommandeWithLines(commande.id);
      setEditingCommande(full);
      setOriginalLines(full.lignes);
      setIsFormOpen(true);
    } catch (error) {
      console.error(error);
      showToast("Impossible de charger les détails.", "error");
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
    (window as any).openBulkImport = () => setIsBulkOpen(true);
    return () => { delete (window as any).openBulkImport; };
  }, []);

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
    const processing = filteredByDateCommandes.filter((c: Commande) => ['nouvelle', 'a_rappeler', 'en_attente_appel'].includes(c.statut_commande)).length;
    const inDelivery = filteredByDateCommandes.filter((c: Commande) => c.statut_commande === 'en_cours_livraison').length;
    const delivered = filteredByDateCommandes.filter((c: Commande) => ['livree', 'terminee'].includes(c.statut_commande)).length;
    const failed = filteredByDateCommandes.filter((c: Commande) => ['echouee', 'retour_livreur', 'retour_stock'].includes(c.statut_commande?.toLowerCase())).length;
    const cancelled = filteredByDateCommandes.filter((c: Commande) => ['annulee'].includes(c.statut_commande?.toLowerCase())).length;
    const retours = filteredByDateCommandes.filter((c: Commande) => c.statut_commande === 'retour_client').length;
    
    const successRate = total > 0 ? Math.round((delivered / (delivered + failed + delivered)) * 100) || 0 : 0;

    return { total, processing, inDelivery, delivered, failed, cancelled, retours, successRate };
  }, [filteredByDateCommandes]);

  const filteredCommandes = filteredByDateCommandes.filter((c: Commande) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (c.nom_client || '').toLowerCase().includes(searchLower) || 
      (c.telephone_client || '').toLowerCase().includes(searchLower) ||
      (c.id || '').toLowerCase().includes(searchLower);
    
    if (!matchesSearch) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'to_process') return ['nouvelle', 'a_rappeler', 'en_attente_appel'].includes(c.statut_commande);
    if (activeTab === 'in_delivery') return c.statut_commande === 'en_cours_livraison';
    if (activeTab === 'done') return ['livree', 'terminee'].includes(c.statut_commande);
    if (activeTab === 'failed') return ['echouee', 'retour_livreur', 'retour_stock'].includes(c.statut_commande?.toLowerCase());
    if (activeTab === 'annulee') return ['annulee'].includes(c.statut_commande?.toLowerCase());
    if (activeTab === 'retours') return c.statut_commande === 'retour_client';
    
    return true;
  });

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setIsBulkOpen(true);
    } else {
      showToast("Veuillez déposer un fichier Excel ou CSV valide.", "error");
    }
  };

  return (
    <div 
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}
      style={{ position: 'relative', minHeight: '100vh', paddingBottom: '5rem' }}
    >
      {isDragging && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(99, 102, 255, 0.1)',
          backdropFilter: 'blur(12px)',
          border: '4px dashed var(--primary)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--primary)',
          pointerEvents: 'none',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ background: 'white', padding: '4rem', borderRadius: '48px', boxShadow: '0 30px 60px -12px rgba(99, 102, 255, 0.3)', textAlign: 'center', transform: 'scale(1.1)' }}>
            <div style={{ background: 'var(--primary)', color: 'white', width: '100px', height: '100px', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', boxShadow: '0 15px 30px rgba(99, 102, 255, 0.4)' }}>
              <Download size={48} style={{ transform: 'rotate(180deg)' }} />
            </div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1e293b' }}>Importation Intelligente</h2>
            <p style={{ fontWeight: 600, fontSize: '1.1rem', color: '#64748b', marginTop: '1rem' }}>Relâchez votre fichier Excel ou CSV pour traiter les commandes.</p>
          </div>
        </div>
      )}

      <div style={{ animation: 'pageEnter 0.6s ease' }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <div style={{ padding: '0.75rem', background: 'var(--primary)', borderRadius: '16px', color: 'white' }}>
                <ShoppingBag size={32} />
              </div>
              <h1 className="text-premium" style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0 }}>Gestion Commandes</h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: 600 }}>Pilotez vos flux logistiques et suivez vos performances en temps réel.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '0.4rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
               {(['today', '7d', '30d', 'all'] as Period[]).map((p) => (
                 <button
                   key={p}
                   onClick={() => setPeriod(p)}
                   style={{
                     padding: '0.6rem 1.2rem',
                     borderRadius: '12px',
                     fontSize: '0.8rem',
                     fontWeight: 800,
                     border: 'none',
                     background: period === p ? 'var(--primary)' : 'transparent',
                     color: period === p ? 'white' : '#64748b',
                     cursor: 'pointer',
                     transition: 'all 0.2s ease'
                   }}
                 >
                   {p === 'today' ? "Aujourd'hui" : p === '7d' ? '7j' : p === '30d' ? '30j' : 'Tout'}
                 </button>
               ))}
               <button 
                 onClick={() => setPeriod('custom')}
                 style={{
                   padding: '0.6rem 1.2rem',
                   borderRadius: '12px',
                   fontSize: '0.8rem',
                   fontWeight: 800,
                   border: 'none',
                   background: period === 'custom' ? 'var(--primary)' : 'transparent',
                   color: period === 'custom' ? 'white' : '#64748b',
                   cursor: 'pointer',
                   display: 'flex',
                   alignItems: 'center',
                   gap: '0.5rem'
                 }}
               >
                 <Calendar size={14} /> Custom
               </button>
            </div>

            <button className="btn btn-outline" onClick={() => setIsBulkOpen(true)} style={{ height: '52px', padding: '0 1.5rem', borderRadius: '16px', fontWeight: 800, border: '1px solid #e2e8f0', background: 'white' }}>
              <Download size={20} style={{ transform: 'rotate(180deg)' }} />
              Import Bulk
            </button>

            <button className="btn btn-primary" onClick={() => setIsFormOpen(true)} style={{ height: '52px', padding: '0 1.5rem', borderRadius: '16px', fontWeight: 800, boxShadow: '0 10px 20px rgba(99, 102, 255, 0.2)' }}>
              <Plus size={22} /> Nouvelle
            </button>
          </div>
        </div>

        {period === 'custom' && (
          <div className="card glass-effect" style={{ marginBottom: '2.5rem', padding: '1.5rem', display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'center', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', animation: 'slideDown 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)' }}>DU</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input" style={{ width: 'auto', height: '40px', borderRadius: '10px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)' }}>AU</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input" style={{ width: 'auto', height: '40px', borderRadius: '10px' }} />
            </div>
          </div>
        )}

        {/* Dashboard Analytics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          {[
            { label: 'Flux Total', value: stats.total, color: 'var(--primary)', icon: <ShoppingBag size={24} />, trend: 'Volume Global' },
            { label: 'En Validation', value: stats.processing, color: '#f59e0b', icon: <Clock size={24} />, trend: 'Flux entrant' },
            { label: 'Livraison', value: stats.inDelivery, color: '#6366f1', icon: <Truck size={24} />, trend: 'En transit' },
            { label: 'Livrées', value: stats.delivered, color: '#10b981', icon: <CheckCircle size={24} />, trend: `${stats.successRate}% succès` },
            { label: 'Échecs / Retours', value: stats.failed, color: '#ef4444', icon: <AlertCircle size={24} />, trend: 'À traiter' }
          ].map((item, idx) => (
            <div key={idx} className="card glass-effect" style={{ padding: '2rem', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'all 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `${item.color}15`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.icon}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: item.color, padding: '0.3rem 0.6rem', background: `${item.color}10`, borderRadius: '8px', textTransform: 'uppercase' }}>
                  {item.trend}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#1e293b' }}>{item.value.toLocaleString()}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters & Actions Area */}
        <div className="card glass-effect" style={{ padding: '2rem', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div style={{ position: 'relative', maxWidth: '500px', width: '100%' }}>
                <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Rechercher par client, téléphone ou ID..." 
                  className="form-input"
                  style={{ paddingLeft: '3.5rem', height: '52px', borderRadius: '16px', background: 'white', border: '1px solid #e2e8f0', fontWeight: 600 }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', overflowX: 'auto', gap: '6px', background: '#f1f5f9', padding: '6px', borderRadius: '16px', scrollbarWidth: 'none' }}>
                {[
                  { id: 'to_process', label: 'Flux', count: stats.processing },
                  { id: 'in_delivery', label: 'En Livraison', count: stats.inDelivery },
                  { id: 'done', label: 'Livrées', count: stats.delivered },
                  { id: 'failed', label: 'Échecs', count: stats.failed },
                  { id: 'all', label: 'Tout', count: stats.total }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      padding: '0.6rem 1.25rem',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      border: 'none',
                      background: activeTab === tab.id ? 'white' : 'transparent',
                      color: activeTab === tab.id ? 'var(--primary)' : '#64748b',
                      boxShadow: activeTab === tab.id ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {tab.label}
                    <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: activeTab === tab.id ? 'var(--primary)15' : '#e2e8f0', color: activeTab === tab.id ? 'var(--primary)' : '#64748b', borderRadius: '6px' }}>{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '6rem' }}>
                <div className="loading-spinner" style={{ margin: '0 auto 1.5rem' }}></div>
                <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Chargement de vos données logistiques...</p>
              </div>
            ) : (
              <CommandeList 
                commandes={filteredCommandes} 
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onActionClick={(c) => setSelectedCommandeId(c.id)}
                onDelete={handleDelete}
                onInvoiceClick={handleInvoice}
                onEditClick={handleEdit}
              />
            )}
          </div>
        </div>

        {/* Floating Batch Action Bar */}
        {selectedIds.length > 0 && (
          <div 
            style={{ 
              position: 'fixed', 
              bottom: '2.5rem', 
              left: '50%', 
              transform: 'translateX(-50%)', 
              background: '#1e293b', 
              padding: '1.25rem 2.5rem', 
              borderRadius: '24px', 
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '2rem',
              zIndex: 1000,
              animation: 'slideUp 0.3s ease',
              color: 'white'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '2rem' }}>
              <div style={{ background: 'var(--primary)', color: 'white', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 900 }}>
                {selectedIds.length}
              </div>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>SÉLECTIONNÉS</span>
              <button 
                onClick={() => setSelectedIds([])}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', padding: '0.5rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleBulkValidate}
                style={{ height: '48px', borderRadius: '14px', padding: '0 1.5rem', fontWeight: 800, background: 'white', color: '#1e293b' }}
              >
                <CheckCircle size={20} /> Valider Groupée
              </button>
              <button 
                className="btn btn-outline" 
                onClick={handleLogisticsExport}
                style={{ height: '48px', borderRadius: '14px', padding: '0 1.5rem', fontWeight: 800, border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
              >
                <Download size={20} /> Export Livreurs
              </button>
            </div>
          </div>
        )}
      </div>

      {isFormOpen && (
        <CommandeForm 
          onClose={() => { setIsFormOpen(false); setEditingCommande(null); setOriginalLines([]); }} 
          onSave={() => { setIsFormOpen(false); setEditingCommande(null); setOriginalLines([]); }} 
          editingCommande={editingCommande || undefined}
          originalLines={originalLines}
        />
      )}

      {isBulkOpen && (
        <BulkImportModal 
          onClose={() => setIsBulkOpen(false)} 
          onSave={() => setIsBulkOpen(false)} 
        />
      )}

      {selectedCommandeId && (
        <CommandeDetails 
          commandeId={selectedCommandeId} 
          onClose={() => setSelectedCommandeId(null)} 
        />
      )}

      <style>{`
        @keyframes pageEnter {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translate(-50%, 100px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
