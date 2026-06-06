import { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, Search, RefreshCw, X, Check, MapPin, 
  Send, AlertCircle, ShoppingBag, Calendar, CheckSquare
} from 'lucide-react';
import { insforge } from '../lib/insforge';
import { getCommunes } from '../services/adminService';
import type { Commande, Commune } from '../types';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const RelanceWhatsApp = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'attente' | 'envoyes'>('attente');
  const [commandes, setCommandes] = useState<any[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [selectedCommune, setSelectedCommune] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [pendingRelance, setPendingRelance] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Fetch Communes & Orders
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Communes
      const communesList = await getCommunes();
      setCommunes(communesList);

      // 2. Fetch Pending/Active Orders (not delivered, completed or cancelled)
      const { data, error } = await insforge.database
        .from('commandes')
        .select('*, clients(nom_complet, telephone), lignes:lignes_commandes(*)')
        .not('statut_commande', 'in', '("livree","terminee","annulee")')
        .order('date_creation', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((c: any) => ({
        ...c,
        nom_client: c.clients?.nom_complet || 'Client Inconnu',
        telephone_client: c.clients?.telephone || 'Non renseigné',
        lignes: c.lignes || []
      }));

      setCommandes(formatted);
    } catch (e) {
      console.error(e);
      showToast("Erreur lors du chargement des données.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Commandes
  const filteredCommandes = useMemo(() => {
    return commandes.filter(c => {
      // Tab filter
      const matchesTab = activeTab === 'attente' 
        ? !c.whatsapp_sent 
        : !!c.whatsapp_sent;

      // Commune filter
      const matchesCommune = selectedCommune === 'All' 
        ? true 
        : c.commune_livraison?.toLowerCase() === selectedCommune.toLowerCase();

      // Search term filter
      const matchesSearch = searchTerm.trim() === ''
        ? true
        : c.nom_client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.telephone_client?.includes(searchTerm) ||
          c.id.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesTab && matchesCommune && matchesSearch;
    });
  }, [commandes, activeTab, selectedCommune, searchTerm]);

  // Generate WhatsApp Message Template
  const generateMessage = (cmd: any) => {
    if (!cmd) return '';
    const firstName = cmd.nom_client.split(' ')[0] || 'Client';
    const amount = Number(cmd.montant_total).toLocaleString();
    const commune = cmd.commune_livraison || 'votre ville';
    
    return `Bonjour ${firstName} ! 🙌\n` +
      `C'est votre conseiller de *Jachete Côte d'Ivoire*. Nous vous informons que votre commande de ${amount} F est prête à être expédiée vers ${commune}. 🚀\n\n` +
      `Veuillez effectuer le dépôt du montant de la commande via *Wave* ou *Orange Money* au :\n` +
      `💸 *+225 07 57 22 87 31*\n\n` +
      `Envoyez-nous la capture de votre reçu par WhatsApp. Dès réception de votre dépôt, nous expédions immédiatement ! 🤝`;
  };

  // Mark as Sent
  const handleMarkAsSent = async (cmdId: string, openLink: boolean = false) => {
    setActionLoading(true);
    try {
      const { error } = await insforge.database
        .from('commandes')
        .update({ 
          whatsapp_sent: true,
          whatsapp_sent_at: new Date().toISOString()
        } as any)
        .eq('id', cmdId);

      if (error) throw error;

      // Update local state
      setCommandes(prev => prev.map(c => {
        if (c.id === cmdId) {
          return { ...c, whatsapp_sent: true, whatsapp_sent_at: new Date().toISOString() };
        }
        return c;
      }));

      showToast("Commande marquée comme relancée !", "success");

      if (openLink && pendingRelance) {
        let phone = pendingRelance.telephone_client.replace(/\D/g, '');
        if (!phone.startsWith('225') && phone.length === 10) {
          phone = '225' + phone;
        }
        const text = generateMessage(pendingRelance);
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
      }

      setPendingRelance(null);
    } catch (e) {
      console.error(e);
      showToast("Erreur lors de la mise à jour du statut WhatsApp.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Reset WhatsApp Sent status
  const handleResetStatus = async (cmdId: string) => {
    setLoading(true);
    try {
      const { error } = await insforge.database
        .from('commandes')
        .update({ 
          whatsapp_sent: false,
          whatsapp_sent_at: null
        } as any)
        .eq('id', cmdId);

      if (error) throw error;

      setCommandes(prev => prev.map(c => {
        if (c.id === cmdId) {
          return { ...c, whatsapp_sent: false, whatsapp_sent_at: null };
        }
        return c;
      }));

      showToast("Commande remise en attente de relance.", "success");
    } catch (e) {
      console.error(e);
      showToast("Erreur lors du déplacement de la commande.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ position: 'relative', minHeight: '100vh', padding: '1rem', background: '#f8fafc', paddingBottom: '4rem' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', animation: 'pageEnter 0.6s ease' }}>
          
          {/* HEADER */}
          <section style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.5rem' }}>
                  <div style={{ padding: '0.8rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '18px', color: 'white', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.2)' }}>
                    <MessageSquare size={28} />
                  </div>
                  <h1 style={{ fontSize: '2.2rem', fontWeight: 950, margin: 0, letterSpacing: '-0.02em', color: '#1e293b' }}>Relance WhatsApp</h1>
                </div>
                <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Gestion et suivi des expéditions et relances pour l'intérieur.</p>
              </div>
              <div>
                <button className="btn btn-outline" onClick={fetchData} style={{ height: '44px', borderRadius: '12px', background: 'white' }}>
                  <RefreshCw size={18} className={loading ? 'spin-icon' : ''} /> Actualiser
                </button>
              </div>
            </div>
          </section>

          {/* FILTRES & TABS */}
          <section style={{ marginBottom: '2rem' }}>
            <div className="card" style={{ padding: '1.25rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                
                {/* TABS */}
                <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '4px', borderRadius: '16px' }}>
                  <button
                    onClick={() => setActiveTab('attente')}
                    style={{
                      padding: '0.6rem 1.25rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800,
                      border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                      background: activeTab === 'attente' ? 'white' : 'transparent',
                      color: activeTab === 'attente' ? '#1e293b' : '#64748b',
                      boxShadow: activeTab === 'attente' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    En attente ({commandes.filter(c => !c.whatsapp_sent).length})
                  </button>
                  <button
                    onClick={() => setActiveTab('envoyes')}
                    style={{
                      padding: '0.6rem 1.25rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800,
                      border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                      background: activeTab === 'envoyes' ? 'white' : 'transparent',
                      color: activeTab === 'envoyes' ? '#1e293b' : '#64748b',
                      boxShadow: activeTab === 'envoyes' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    Déjà envoyés ({commandes.filter(c => c.whatsapp_sent).length})
                  </button>
                </div>

                {/* FILTERS */}
                <div style={{ display: 'flex', gap: '1rem', flex: 1, justifySelf: 'end', maxWidth: '800px', flexWrap: 'wrap', width: '100%' }}>
                  {/* Commune dropdown */}
                  <select
                    className="form-input"
                    value={selectedCommune}
                    onChange={e => setSelectedCommune(e.target.value)}
                    style={{ flex: '1 1 200px', height: '48px', borderRadius: '16px', fontWeight: 600, border: '1px solid #e2e8f0', background: '#f8fafc' }}
                  >
                    <option value="All">Toutes les Communes</option>
                    {communes.map(c => (
                      <option key={c.id} value={c.nom}>{c.nom}</option>
                    ))}
                  </select>

                  {/* Search Bar */}
                  <div className="search-wrapper" style={{ position: 'relative', flex: '2 1 300px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Rechercher client, téléphone ou réf..."
                      style={{ paddingLeft: '3.5rem', height: '48px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.95rem' }}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* LIST */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
            <div className="table-container table-to-cards">
              <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'separate', borderSpacing: '0' }}>
                <colgroup>
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '15%' }} />
                </colgroup>
                <thead className="mobile-hide" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '1.25rem 1.5rem', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Réf Commande</th>
                    <th style={{ textAlign: 'left', padding: '1.25rem', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Client</th>
                    <th style={{ textAlign: 'left', padding: '1.25rem', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Commune / Quartier</th>
                    <th style={{ textAlign: 'right', padding: '1.25rem', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Montant Total</th>
                    <th style={{ textAlign: 'left', padding: '1.25rem', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Produits commandés</th>
                    <th style={{ textAlign: 'center', padding: '1.25rem 1.5rem', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '6rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                          <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                          <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Chargement des commandes...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCommandes.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '6rem' }}>
                        <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-muted)' }}>Aucune commande en attente.</p>
                      </td>
                    </tr>
                  ) : filteredCommandes.map((cmd) => (
                    <tr key={cmd.id} className="hover-row" style={{ transition: 'background 0.2s' }}>
                      <td data-label="Réf Commande" style={{ padding: '1.25rem 1.5rem' }}>
                        <span style={{ fontWeight: 900, color: 'var(--primary)', fontFamily: 'monospace', fontSize: '1rem' }}>
                          #{cmd.id.slice(0, 8).toUpperCase()}
                        </span>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', fontWeight: 700 }}>
                          {format(new Date(cmd.date_creation), 'dd MMM yyyy HH:mm', { locale: fr })}
                        </div>
                      </td>
                      <td data-label="Client" style={{ padding: '1.25rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{cmd.nom_client}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{cmd.telephone_client}</div>
                      </td>
                      <td data-label="Commune / Quartier" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#1e293b' }}>
                          <MapPin size={14} color="#059669" /> {cmd.commune_livraison}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '1.1rem' }}>{cmd.quartier_livraison || ''}</div>
                      </td>
                      <td data-label="Montant Total" style={{ padding: '1.25rem', textAlign: 'right', fontWeight: 900, fontSize: '1.1rem', color: '#10b981' }}>
                        {Number(cmd.montant_total).toLocaleString()} F
                      </td>
                      <td data-label="Produits commandés" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {cmd.lignes.map((l: any, i: number) => (
                            <div key={i} style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                              📦 {l.nom_produit} <span style={{ fontWeight: 800, color: 'var(--primary)' }}>x{l.quantite}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td data-label="Actions" style={{ padding: '1.25rem', textAlign: 'center' }}>
                        {activeTab === 'attente' ? (
                          <button 
                            className="btn" 
                            onClick={() => setPendingRelance(cmd)}
                            style={{ 
                              background: '#10b981', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '12px',
                              fontWeight: 800,
                              height: '38px',
                              padding: '0 1rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)'
                            }}
                          >
                            <Send size={14} /> Relancer
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button 
                              className="btn btn-outline btn-sm"
                              onClick={() => handleResetStatus(cmd.id)}
                              style={{ 
                                borderRadius: '10px', 
                                border: '1px solid #cbd5e1', 
                                color: '#64748b',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                height: '34px'
                              }}
                            >
                              <RefreshCw size={12} /> Réinitialiser
                            </button>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: '#059669', background: '#dcfce7', padding: '0 8px', borderRadius: '8px' }}>
                              <Check size={12} /> Envoyé
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {pendingRelance && (
        <div className="modal-backdrop" style={{ backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.6)' }} onClick={() => setPendingRelance(null)}>
          <div className="modal-content" style={{ maxWidth: '650px', borderRadius: '28px', overflow: 'hidden', padding: 0, boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.25)' }} onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ padding: '2rem', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderBottom: '1px solid #e2e8f0', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '8px', background: '#10b981', color: 'white', borderRadius: '12px' }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#14532d', margin: 0 }}>Confirmer l'envoi de la relance</h3>
                  <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>Destinataire: {pendingRelance.nom_client} ({pendingRelance.telephone_client})</span>
                </div>
              </div>
              <button 
                onClick={() => setPendingRelance(null)} 
                style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.4rem', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Message Preview */}
            <div style={{ padding: '2rem' }}>
              <div style={{ marginBottom: '1.25rem', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Aperçu du message WhatsApp à envoyer :
              </div>
              <div 
                style={{ 
                  background: '#f8fafc', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '16px', 
                  padding: '1.5rem', 
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontSize: '0.95rem',
                  lineHeight: '1.5',
                  color: '#334155',
                  whiteSpace: 'pre-line'
                }}
              >
                {generateMessage(pendingRelance)}
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => setPendingRelance(null)}
                style={{ borderRadius: '12px', fontWeight: 800 }}
              >
                Annuler
              </button>
              
              <button 
                className="btn" 
                disabled={actionLoading}
                onClick={() => handleMarkAsSent(pendingRelance.id, false)}
                style={{ 
                  borderRadius: '12px', 
                  fontWeight: 800,
                  background: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CheckSquare size={16} /> Marquer envoyé
              </button>

              <button 
                className="btn" 
                disabled={actionLoading}
                onClick={() => handleMarkAsSent(pendingRelance.id, true)}
                style={{ 
                  borderRadius: '12px', 
                  fontWeight: 800,
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                }}
              >
                <Send size={16} /> {actionLoading ? 'Ouverture...' : 'Ouvrir WhatsApp'}
              </button>
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes pageEnter {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        .hover-row:hover {
          background-color: #f8fafc !important;
        }
        .spinner {
          border-radius: 50%;
          border: 3px solid #f3f3f3;
          border-top: 3px solid var(--primary);
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }
      `}</style>
    </>
  );
};
