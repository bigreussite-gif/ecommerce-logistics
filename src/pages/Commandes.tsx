import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, CheckCircle, Download, X, ShoppingBag, Clock, Truck, AlertCircle, Calendar } from 'lucide-react';
import { CommandeList } from '../components/commandes/CommandeList';
import { CommandeForm } from '../components/commandes/CommandeForm';
import { BulkImportModal } from '../components/commandes/BulkImportModal';
import { CommandeDetails } from '../components/commandes/CommandeDetails';
import { subscribeToCommandes, deleteCommande, getCommandeWithLines, bulkUpdateCommandeStatus, getCommandesByIds } from '../services/commandeService';
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
  
  const [period, setPeriod] = useState<Period>('7d'); // Default to 7 days for better focus
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
      const selectedCommandes = await getCommandesByIds(selectedIds);
      
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
    
    const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
    const failureRate = total > 0 ? Math.round(((failed + cancelled + retours) / total) * 100) : 0;

    return { total, processing, inDelivery, delivered, failed, cancelled, retours, deliveryRate, failureRate };
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
      style={{ position: 'relative', minHeight: '100vh', padding: '1rem', background: '#f8fafc' }}
    >
      {/* Dynamic Dropzone Overlay */}
      {isDragging && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(99, 102, 255, 0.1)', backdropFilter: 'blur(12px)',
          border: '4px dashed var(--primary)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'var(--primary)', pointerEvents: 'none', animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ background: 'white', padding: '4rem', borderRadius: '48px', boxShadow: '0 30px 60px -12px rgba(99, 102, 255, 0.3)', textAlign: 'center' }}>
            <div style={{ background: 'var(--primary)', color: 'white', width: '100px', height: '100px', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
              <Download size={48} style={{ transform: 'rotate(180deg)' }} />
            </div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 900 }}>Importation Intelligente</h2>
            <p style={{ fontWeight: 600, color: '#64748b' }}>Relâchez votre fichier pour traiter les commandes.</p>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1600px', margin: '0 auto', animation: 'pageEnter 0.6s ease' }}>
        
        {/* ZONE A: VISION & ACTIONS */}
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.5rem' }}>
                <div style={{ padding: '0.8rem', background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', borderRadius: '18px', color: 'white', boxShadow: '0 10px 20px rgba(99, 102, 255, 0.2)' }}>
                  <ShoppingBag size={28} />
                </div>
                <h1 style={{ fontSize: '2.2rem', fontWeight: 950, margin: 0, letterSpacing: '-0.02em', color: '#1e293b' }}>
                  Hub Commandes
                </h1>
              </div>
              <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
                Pilotage centralisé des flux de livraison et performance logistique.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'white', padding: '0.6rem', borderRadius: '22px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '14px', padding: '0.25rem' }}>
                {(['today', '7d', '30d', 'all'] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    style={{
                      padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, border: 'none',
                      background: period === p ? 'white' : 'transparent',
                      color: period === p ? 'var(--primary)' : '#64748b',
                      boxShadow: period === p ? '0 4px 10px rgba(0,0,0,0.05)' : 'none',
                      cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                  >
                    {p === 'today' ? "Aujourd'hui" : p === '7d' ? '7j' : p === '30d' ? '30j' : 'Tout'}
                  </button>
                ))}
                <button onClick={() => setPeriod('custom')} style={{ padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800, border: 'none', background: period === 'custom' ? 'white' : 'transparent', color: period === 'custom' ? 'var(--primary)' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={12} /> Perso
                </button>
              </div>

              <div style={{ width: '1px', height: '30px', background: '#e2e8f0' }}></div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setIsBulkOpen(true)} className="btn btn-outline" style={{ height: '44px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700 }}>
                  <Download size={18} style={{ transform: 'rotate(180deg)' }} /> Import
                </button>
                <button onClick={() => setIsFormOpen(true)} className="btn btn-primary" style={{ height: '44px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, padding: '0 1.5rem' }}>
                  <Plus size={20} /> Nouvelle Commande
                </button>
              </div>
            </div>
          </div>

          {period === 'custom' && (
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', animation: 'slideDown 0.3s ease' }}>
              <div className="card glass-effect" style={{ padding: '1rem 2rem', borderRadius: '16px', display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>DU</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input" style={{ height: '36px', width: 'auto' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>AU</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input" style={{ height: '36px', width: 'auto' }} />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ZONE B: LOGISTICS INTELLIGENCE */}
        <section style={{ marginBottom: '3rem' }}>
          <div className="res-grid" style={{ gap: '1.5rem' }}>
            {[
              { label: 'Flux Total', value: stats.total, color: 'var(--primary)', icon: <ShoppingBag size={22} />, desc: 'Commandes traitées' },
              { label: 'Validation', value: stats.processing, color: '#f59e0b', icon: <Clock size={22} />, desc: 'En attente de tri' },
              { label: 'En Livraison', value: stats.inDelivery, color: '#6366f1', icon: <Truck size={22} />, desc: 'Sorties logistique' },
              { label: 'Livraisons', value: `${stats.deliveryRate}%`, color: '#10b981', icon: <CheckCircle size={22} />, desc: `${stats.delivered} colis livrés` },
              { label: 'Perturbations', value: `${stats.failureRate}%`, color: '#ef4444', icon: <AlertCircle size={22} />, desc: `${stats.failed + stats.cancelled + stats.retours} échecs/retours` }
            ].map((item, idx) => (
              <div key={idx} className="card" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '1.25rem', alignItems: 'center', transition: 'all 0.3s ease', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: `${item.color}10`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#1e293b', lineHeight: 1, letterSpacing: '-0.02em' }}>{item.value}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginTop: '0.3rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: item.color, marginTop: '0.2rem', textTransform: 'uppercase' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ZONE C: FLEET MANAGEMENT (FILTERS) */}
        <section style={{ marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.25rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
              
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '2px', scrollbarWidth: 'none' }}>
                {[
                  { id: 'to_process', label: 'À Valider', count: stats.processing, color: '#f59e0b' },
                  { id: 'in_delivery', label: 'En Livraison', count: stats.inDelivery, color: '#6366f1' },
                  { id: 'done', label: 'Livrées', count: stats.delivered, color: '#10b981' },
                  { id: 'failed', label: 'Échecs', count: stats.failed, color: '#ef4444' },
                  { id: 'annulee', label: 'Annulées', count: stats.cancelled, color: '#64748b' },
                  { id: 'all', label: 'Historique', count: stats.total, color: 'var(--primary)' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      padding: '0.6rem 1.25rem', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 800,
                      whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                      background: activeTab === tab.id ? `${tab.color}10` : 'transparent',
                      color: activeTab === tab.id ? tab.color : '#64748b',
                      display: 'flex', alignItems: 'center', gap: '0.6rem'
                    }}
                  >
                    {tab.label}
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, opacity: activeTab === tab.id ? 1 : 0.6 }}>{tab.count}</span>
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', minWidth: '320px', flex: 1, maxWidth: '500px' }}>
                <Search size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text" placeholder="Rechercher (Client, Tel, ID)..." 
                  className="form-input" style={{ paddingLeft: '3.5rem', height: '48px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.95rem' }}
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ZONE D: DATA HUB (THE LIST) */}
        <section>
          <div className="card" style={{ padding: '0.5rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', minHeight: '400px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '6rem' }}>
                <div className="loading-spinner" style={{ margin: '0 auto 1.5rem' }}></div>
                <p style={{ fontWeight: 700, color: '#64748b' }}>Chargement du catalogue des flux...</p>
              </div>
            ) : (
              <CommandeList 
                key={`${activeTab}-${searchTerm}-${period}`}
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
        </section>

        {/* Floating Batch Action Bar */}
        {selectedIds.length > 0 && (
          <div style={{ 
            position: 'fixed', bottom: '2.5rem', left: '50%', transform: 'translateX(-50%)', 
            background: '#1e293b', padding: '1.25rem 2.5rem', borderRadius: '24px', 
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '2rem',
            zIndex: 1000, animation: 'slideUp 0.3s ease', color: 'white'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '2rem' }}>
              <div style={{ background: 'var(--primary)', color: 'white', width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 900 }}>
                {selectedIds.length}
              </div>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>SÉLECTIONNÉS</span>
              <button onClick={() => setSelectedIds([])} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-primary" onClick={handleBulkValidate} style={{ height: '48px', borderRadius: '14px', padding: '0 1.5rem', fontWeight: 800, background: 'white', color: '#1e293b' }}>
                <CheckCircle size={20} /> Valider Groupée
              </button>
              <button className="btn btn-outline" onClick={handleLogisticsExport} style={{ height: '48px', borderRadius: '14px', padding: '0 1.5rem', fontWeight: 800, border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>
                <Download size={20} /> Export Livreurs
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals & Overlays */}
      {isFormOpen && (
        <CommandeForm 
          onClose={() => { setIsFormOpen(false); setEditingCommande(null); setOriginalLines([]); }} 
          onSave={() => { setIsFormOpen(false); setEditingCommande(null); setOriginalLines([]); }} 
          editingCommande={editingCommande || undefined}
          originalLines={originalLines}
        />
      )}

      {isBulkOpen && (
        <BulkImportModal onClose={() => setIsBulkOpen(false)} onSave={() => setIsBulkOpen(false)} />
      )}

      {selectedCommandeId && (
        <CommandeDetails commandeId={selectedCommandeId} onClose={() => setSelectedCommandeId(null)} />
      )}

      <style>{`
        @keyframes pageEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { transform: translate(-50%, 100px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .res-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
      `}</style>
    </div>
  );
};
