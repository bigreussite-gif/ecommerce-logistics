import { useState, useEffect, useMemo } from 'react';
import { 
  Users, Search, 
  X, TrendingUp, Eye, Download, MessageCircle, MapPin, 
  Calendar, ShoppingBag, CreditCard, ChevronRight
} from 'lucide-react';
import { getClientsWithIntelligence, getClientCommandes, ClientFidelityStats, updateClient } from '../services/clientService';
import { CommandeDetails } from '../components/commandes/CommandeDetails';
import type { Client, Commande } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '../contexts/ToastContext';

export const Clients = () => {
  const { showToast } = useToast();
  const [clients, setClients] = useState<(Client & ClientFidelityStats & { identities: string[], locations: string[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('All');
  const [selectedClient, setSelectedClient] = useState<{ client: Client & ClientFidelityStats & { identities: string[], locations: string[] }, commandes: Commande[] } | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await getClientsWithIntelligence();
      setClients(data);
    } catch (error) {
      console.error(error);
      showToast("Erreur lors du chargement des clients.", "error");
    } finally {
      setLoading(false);
    }
  };

  const openClientDetails = async (client: Client & ClientFidelityStats & { identities: string[], locations: string[] }) => {
    try {
      setIsEditing(false);
      setEditForm({
        nom_complet: client.nom_complet,
        telephone: client.telephone,
        telephone_secondaire: client.telephone_secondaire,
        commune: client.commune,
        quartier: client.quartier,
        adresse: client.adresse
      });
      const cmds = await getClientCommandes(client.id);
      cmds.sort((a, b) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime());
      setSelectedClient({ client, commandes: cmds });
    } catch(e) {
      console.error(e);
      showToast("Erreur lors du chargement des détails.", "error");
    }
  };

  const handleUpdate = async () => {
    if (!selectedClient) return;
    try {
      await updateClient(selectedClient.client.id, editForm);
      showToast("Client mis à jour avec succès !", "success");
      setIsEditing(false);
      fetchClients();
      setSelectedClient({
        ...selectedClient,
        client: { ...selectedClient.client, ...editForm as any }
      });
    } catch (e) {
      showToast("Erreur lors de la mise à jour.", "error");
    }
  };

  const sendWhatsApp = (client: Client, templateName: 'friendly' | 'promo' | 'reminder') => {
    let message = '';
    const nom = client.nom_complet.split(' ')[0] || 'Cher client';
    const signature = "\n\n*L'équipe GomboSwift*\nwww.gomboswift.ci\n+225 01 72 57 13 52";

    if (templateName === 'friendly') {
      message = `Bonjour ${nom} ! 🌟\nComment allez-vous ? J'espère que vous êtes satisfait de nos services. Si vous avez besoin de quoi que ce soit, nous sommes à votre disposition !\n${signature}`;
    } else if (templateName === 'promo') {
      message = `Coucou ${nom} ! 🎉\nEn tant que client fidèle, nous vous offrons une remise spéciale sur votre prochaine commande chez nous ! Utilisez ce code PROMO VIP.\n${signature}`;
    } else if (templateName === 'reminder') {
      message = `Bonjour ${nom} ! 😊\nOn ne vous a pas vu depuis un moment ! On espère que tout va bien. Nous avons rentré de nouveaux articles qui pourraient vous intéresser.\n${signature}`;
    }

    let phone = client.telephone.replace(/\D/g, '');
    if (!phone.startsWith('225') && phone.length === 10) phone = '225' + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = c.identities.some(id => id.toLowerCase().includes(searchTerm.toLowerCase())) || 
                           c.telephone.includes(searchTerm);
      const matchesSegment = segmentFilter === 'All' || c.segment.includes(segmentFilter);
      return matchesSearch && matchesSegment;
    });
  }, [clients, searchTerm, segmentFilter]);

  const stats = useMemo(() => {
    const totalRevenue = clients.reduce((acc, c) => acc + c.total_encaisse, 0);
    const vips = clients.filter(c => c.segment === 'Diamant 💎').length;
    const loyal = clients.filter(c => c.segment === 'Fidèle ✅').length;
    return { totalRevenue, vips, loyal };
  }, [clients]);

  const exportToCSV = () => {
    const headers = ['Nom', 'Telephone', 'Segment', 'Commandes', 'Total Depense'];
    const rows = filteredClients.map(c => [
      c.nom_complet,
      c.telephone,
      c.segment,
      c.total_commandes,
      c.total_encaisse
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `crm_clients_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  return (
    <>
      <div style={{ animation: 'pageEnter 0.6s ease', paddingBottom: '4rem' }}>
        {/* Header Section */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--primary)', borderRadius: '16px', color: 'white' }}>
                  <Users size={32} />
                </div>
                <h1 className="text-premium" style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0 }}>CRM Intelligence</h1>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: 600 }}>Analyse comportementale et fidélisation client.</p>
            </div>
            
            <button className="btn btn-primary" onClick={exportToCSV} style={{ height: '52px', borderRadius: '14px', padding: '0 2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Download size={20} /> Exporter la base
            </button>
          </div>
        </div>

        {/* Stats Mini-Dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          <div className="card glass-effect" style={{ padding: '2rem', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.05 }}>
              <TrendingUp size={120} />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Valeur Portefeuille</span>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--primary)', marginTop: '0.5rem' }}>{stats.totalRevenue.toLocaleString()} <span style={{ fontSize: '1rem' }}>CFA</span></div>
            <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700, marginTop: '0.5rem' }}>Basé sur {clients.length} clients uniques</div>
          </div>

          <div className="card glass-effect" style={{ padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Clients VIP (Diamant)</span>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#3b82f6', marginTop: '0.5rem' }}>{stats.vips}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.5rem' }}>{Math.round((stats.vips / clients.length) * 100)}% de l'audience totale</div>
          </div>

          <div className="card glass-effect" style={{ padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Taux de Rétention</span>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.5rem' }}>{Math.round(((stats.vips + stats.loyal) / clients.length) * 100)}%</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.5rem' }}>Clients ayant acheté plus de 2 fois</div>
          </div>
        </div>

        {/* Filters & Search */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
              <Search size={20} style={{ position: 'absolute', top: '50%', left: '1.25rem', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Rechercher un nom, un téléphone..." 
                style={{ paddingLeft: '3.5rem', height: '60px', borderRadius: '18px', fontSize: '1.05rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.4rem', borderRadius: '16px' }}>
              {['All', 'Diamant', 'Fidèle', 'relancer', 'Nouveau'].map(s => (
                <button
                  key={s}
                  onClick={() => setSegmentFilter(s)}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '12px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    background: segmentFilter === s ? 'white' : 'transparent',
                    color: segmentFilter === s ? 'var(--primary)' : 'var(--text-muted)',
                    boxShadow: segmentFilter === s ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {s === 'All' ? 'Tous' : s === 'relancer' ? 'À relancer' : s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Clients Table/Grid */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
          <div className="table-container">
            <table style={{ borderCollapse: 'separate', borderSpacing: '0' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>Client</th>
                  <th style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>Segment</th>
                  <th style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Achats</th>
                  <th style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>Dernière Visite</th>
                  <th style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Total Encaissé</th>
                  <th style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '6rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                      <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Analyse de la base client...</p>
                    </div>
                  </td></tr>
                ) : filteredClients.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '6rem' }}>
                    <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-muted)' }}>Aucun client trouvé.</p>
                  </td></tr>
                ) : filteredClients.map((client) => (
                  <tr key={client.id} className="hover-row" onClick={() => openClientDetails(client)} style={{ cursor: 'pointer', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--primary), #4f46e5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(99, 102, 255, 0.2)' }}>
                          {client.nom_complet.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem' }}>{client.nom_complet}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{client.telephone}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem' }}>
                      <span style={{ 
                        padding: '0.5rem 1rem', 
                        borderRadius: '12px', 
                        fontSize: '0.8rem', 
                        fontWeight: 800,
                        backgroundColor: client.segment.includes('Diamant') ? 'rgba(16, 185, 129, 0.1)' : client.segment.includes('relancer') ? 'rgba(239, 68, 68, 0.1)' : '#f1f5f9',
                        color: client.segment.includes('Diamant') ? '#059669' : client.segment.includes('relancer') ? '#dc2626' : '#64748b',
                        border: `1px solid ${client.segment.includes('Diamant') ? 'rgba(16, 185, 129, 0.2)' : 'transparent'}`
                      }}>
                        {client.segment}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem', textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{client.total_commandes}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Bordereaux</div>
                    </td>
                    <td style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        <Calendar size={14} color="var(--primary)" />
                        {client.derniere_commande ? format(new Date(client.derniere_commande), 'dd MMM yyyy', { locale: fr }) : 'Jamais'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginLeft: '1.4rem' }}>{client.locations[0] || 'Zone inconnue'}</div>
                    </td>
                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.1rem' }}>{client.total_encaisse.toLocaleString()}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Panier: {client.panier_moyen.toLocaleString()} F</div>
                    </td>
                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" style={{ borderRadius: '10px' }} onClick={(e) => { e.stopPropagation(); openClientDetails(client); }}>
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Client Detail Modal */}
      {selectedClient && (
        <div className="modal-backdrop" style={{ backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.6)' }} onClick={() => setSelectedClient(null)}>
          <div className="modal-content" style={{ maxWidth: '900px', padding: 0, borderRadius: '32px', overflow: 'hidden', boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.25)' }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ padding: '3rem', background: 'linear-gradient(135deg, #f8fafc, #eff6ff)', position: 'relative' }}>
              <button onClick={() => setSelectedClient(null)} style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '0.6rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <X size={24} />
              </button>
              
              <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
                <div style={{ width: '100px', height: '100px', borderRadius: '32px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 900, boxShadow: '0 15px 30px rgba(99, 102, 255, 0.3)' }}>
                  {selectedClient.client.nom_complet.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  {isEditing ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <input className="form-input" value={editForm.nom_complet} onChange={e => setEditForm({...editForm, nom_complet: e.target.value})} placeholder="Nom complet" />
                      <input className="form-input" value={editForm.telephone} onChange={e => setEditForm({...editForm, telephone: e.target.value})} placeholder="Téléphone Principal" />
                      <input className="form-input" value={editForm.telephone_secondaire} onChange={e => setEditForm({...editForm, telephone_secondaire: e.target.value})} placeholder="Tél 2 (Optionnel)" />
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h2 style={{ fontSize: '2.2rem', fontWeight: 900, margin: 0, color: '#0f172a' }}>{selectedClient.client.nom_complet}</h2>
                        <span style={{ padding: '0.4rem 1rem', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 800, fontSize: '0.85rem', color: 'var(--primary)' }}>{selectedClient.client.segment}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          <MessageCircle size={18} color="var(--primary)" /> {selectedClient.client.telephone}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          <MapPin size={18} color="var(--primary)" /> {selectedClient.client.commune || 'Zone non définie'}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '3rem', maxHeight: '65vh', overflowY: 'auto' }}>
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '3.5rem' }}>
                <div style={{ padding: '1.5rem', borderRadius: '24px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <CreditCard size={18} color="var(--primary)" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume d'achat</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{selectedClient.client.total_encaisse.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span></div>
                </div>
                <div style={{ padding: '1.5rem', borderRadius: '24px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <ShoppingBag size={18} color="#3b82f6" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fidélité</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{selectedClient.client.total_commandes} <span style={{ fontSize: '0.8rem' }}>Commandes</span></div>
                </div>
                <div style={{ padding: '1.5rem', borderRadius: '24px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <TrendingUp size={18} color="#10b981" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Panier Moyen</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{selectedClient.client.panier_moyen.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span></div>
                </div>
              </div>

              {/* Marketing Actions */}
              <div style={{ marginBottom: '3.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '1.5rem', color: '#0f172a' }}>Actions Marketing</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                  <button onClick={() => sendWhatsApp(selectedClient.client, 'friendly')} className="btn" style={{ height: '64px', background: '#dcfce7', color: '#166534', border: 'none', borderRadius: '20px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', transition: 'transform 0.2s' }}>
                    <MessageCircle size={20} /> Client Care 👋
                  </button>
                  <button onClick={() => sendWhatsApp(selectedClient.client, 'promo')} className="btn" style={{ height: '64px', background: '#eff6ff', color: '#1e40af', border: 'none', borderRadius: '20px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                    <TrendingUp size={20} /> Offre Spéciale 🎁
                  </button>
                  <button onClick={() => sendWhatsApp(selectedClient.client, 'reminder')} className="btn" style={{ height: '64px', background: '#fef3c7', color: '#92400e', border: 'none', borderRadius: '20px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                    <Calendar size={20} /> Relance Panier 🔄
                  </button>
                </div>
              </div>

              {/* Historical Timeline */}
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '1.5rem', color: '#0f172a' }}>Parcours Client</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {selectedClient.commandes.map((cmd) => (
                    <div key={cmd.id} onClick={() => setSelectedOrderId(cmd.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s ease' }} className="hover-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ padding: '0.75rem', background: ['livree', 'terminee'].includes(cmd.statut_commande) ? '#f0fdf4' : '#fef2f2', borderRadius: '14px' }}>
                          <ShoppingBag size={20} color={['livree', 'terminee'].includes(cmd.statut_commande) ? '#10b981' : '#ef4444'} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>#{(cmd.id || '').substring(0, 8).toUpperCase()}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{format(new Date(cmd.date_creation), 'dd MMMM yyyy', { locale: fr })}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)' }}>{cmd.montant_total?.toLocaleString()} F</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: '0.25rem' }}>{cmd.statut_commande}</div>
                      </div>
                      <ChevronRight size={20} color="#cbd5e1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '2rem 3rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {isEditing ? (
                  <>
                    <button className="btn btn-primary" onClick={handleUpdate}>Enregistrer</button>
                    <button className="btn btn-outline" onClick={() => setIsEditing(false)}>Annuler</button>
                  </>
                ) : (
                  <button className="btn btn-outline" style={{ borderRadius: '12px', fontWeight: 800 }} onClick={() => setIsEditing(true)}>Modifier les informations</button>
                )}
              </div>
              <button className="btn btn-primary" style={{ borderRadius: '12px', fontWeight: 800, padding: '0.75rem 2.5rem' }} onClick={() => setSelectedClient(null)}>Terminer</button>
            </div>
          </div>
        </div>
      )}

      {selectedOrderId && (
        <CommandeDetails 
          commandeId={selectedOrderId} 
          onClose={() => setSelectedOrderId(null)} 
        />
      )}

      <style>{`
        @keyframes pageEnter {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .hover-row:hover {
          background-color: #f8fafc !important;
        }
        .hover-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.05);
          border-color: var(--primary) !important;
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
