import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { 
  PieChart as RechartsPieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { AlertTriangle, Bell, Star, PieChart } from 'lucide-react';


export const Clients = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [clients, setClients] = useState<(Client & ClientFidelityStats & { identities: string[], locations: string[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [segmentFilter, setSegmentFilter] = useState('All');
  const [selectedClient, setSelectedClient] = useState<{ client: Client & ClientFidelityStats & { identities: string[], locations: string[] }, commandes: Commande[] } | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'} | null>(null);

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
    const signature = "\n\n*L'équipe JACHETECI CRM*\nwww.jachete.ci\n+225 01 72 57 13 52";

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
      const matchesSearch = c.identities.some(id => id.toLowerCase().includes(deferredSearchTerm.toLowerCase())) || 
                           c.telephone.includes(deferredSearchTerm);
      const matchesSegment = segmentFilter === 'All' || c.segment.includes(segmentFilter);
      return matchesSearch && matchesSegment;
    });
  }, [clients, deferredSearchTerm, segmentFilter]);

  const sortedClients = useMemo(() => {
    let sortable = [...filteredClients];
    if (sortConfig !== null) {
      sortable.sort((a, b) => {
        let aVal: any = a[sortConfig.key as keyof typeof a];
        let bVal: any = b[sortConfig.key as keyof typeof b];
        
        if (sortConfig.key === 'dernier_achat') {
          aVal = a.derniere_commande_brute ? new Date(a.derniere_commande_brute).getTime() : 0;
          bVal = b.derniere_commande_brute ? new Date(b.derniere_commande_brute).getTime() : 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [filteredClients, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };


  const stats = useMemo(() => {
    const totalRevenue = clients.reduce((acc, c) => acc + c.total_encaisse, 0);
    const vips = clients.filter(c => c.segment === 'Diamant 💎').length;
    const loyal = clients.filter(c => c.segment === 'Fidèle ✅').length;
    const prospects = clients.filter(c => c.segment === 'Prospect 🎯').length;
    return { totalRevenue, vips, loyal, prospects };
  }, [clients]);


  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach(c => {
      counts[c.segment] = (counts[c.segment] || 0) + 1;
    });
    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
    return Object.keys(counts).map((key, index) => ({
      name: key,
      value: counts[key],
      color: COLORS[index % COLORS.length]
    }));
  }, [clients]);

  const smartAlerts = useMemo(() => {
    const alerts = [];
    const inactiveVips = clients.filter(c => 
      c.segment.includes('Diamant') && 
      c.derniere_commande && 
      (new Date().getTime() - new Date(c.derniere_commande).getTime()) > 60 * 24 * 60 * 60 * 1000
    );
    if (inactiveVips.length > 0) {
      alerts.push({
        type: 'danger',
        title: `${inactiveVips.length} Clients VIP Inactifs`,
        message: "Ces clients n'ont rien acheté depuis plus de 60 jours.",
        icon: <AlertTriangle size={20} color="#ef4444" />
      });
    }

    const recentNew = clients.filter(c => 
      c.segment.includes('Nouveau') && 
      c.derniere_commande &&
      (new Date().getTime() - new Date(c.derniere_commande).getTime()) < 7 * 24 * 60 * 60 * 1000
    );
    if (recentNew.length > 0) {
      alerts.push({
        type: 'success',
        title: `${recentNew.length} Nouveaux Clients cette semaine`,
        message: 'Accueillez-les chaleureusement pour les fidéliser !',
        icon: <Star size={20} color="#10b981" />
      });
    }
    return alerts;
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
      <div style={{ position: 'relative', minHeight: '100vh', padding: '1rem', background: '#f8fafc', paddingBottom: '4rem' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', animation: 'pageEnter 0.6s ease' }}>

        {/* ZONE A: HEADER */}
        <section style={{ marginBottom: '3rem' }}>
          <div className="header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.5rem' }}>
                <div style={{ padding: '0.8rem', background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', borderRadius: '18px', color: 'white', boxShadow: '0 10px 20px rgba(99, 102, 255, 0.2)' }}>
                  <Users size={28} />
                </div>
                <h1 style={{ fontSize: '2.2rem', fontWeight: 950, margin: 0, letterSpacing: '-0.02em', color: '#1e293b' }}>CRM Intelligence</h1>
              </div>
              <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Analyse comportementale et fidélisation client.</p>
            </div>
            <div className="actions-wrapper" style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'white', padding: '0.6rem', borderRadius: '22px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
              <button className="btn btn-primary" onClick={exportToCSV} style={{ height: '44px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                <Download size={18} /> Exporter la base
              </button>
            </div>
          </div>
        </section>

        {/* ZONE B: STATS */}
        <section style={{ marginBottom: '3rem' }}>
          <div className="res-grid" style={{ gap: '1.5rem' }}>
            {[
              { label: 'Total Encaissé', value: `${stats.totalRevenue.toLocaleString()} CFA`, color: 'var(--primary)', icon: <TrendingUp size={22} />, desc: `${clients.length - stats.prospects} acheteurs actifs` },
              { label: 'Prospects', value: stats.prospects, color: '#8b5cf6', icon: <Users size={22} />, desc: '0 commande livrée' },
              { label: 'Clients VIP & Fidèles', value: stats.vips + stats.loyal, color: '#f59e0b', icon: <Star size={22} />, desc: 'Acheteurs récurrents' },
              { label: 'Total Contacts', value: clients.length, color: '#10b981', icon: <Users size={22} />, desc: 'Base active' },
            ].map((item, idx) => (
              <div key={idx} className="card" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: `${item.color}10`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e293b', lineHeight: 1 }}>{item.value}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginTop: '0.25rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: item.color, marginTop: '0.2rem', textTransform: 'uppercase' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        
        {/* CRM DASHBOARD - CHARTS & ALERTS */}
        <section style={{ marginBottom: '3rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
          
          <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PieChart size={20} color="var(--primary)" /> Segments Clients
            </h3>
            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
              {chartData.map((entry, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: entry.color }}></div>
                  {entry.name} ({entry.value})
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={20} color="#f59e0b" /> Alertes Intelligentes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {smartAlerts.length === 0 ? (
                 <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune alerte pour le moment.</div>
              ) : smartAlerts.map((alert, i) => (
                <div key={i} style={{ 
                  padding: '1rem', 
                  borderRadius: '16px', 
                  background: alert.type === 'danger' ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${alert.type === 'danger' ? '#fecaca' : '#bbf7d0'}`,
                  display: 'flex', gap: '1rem', alignItems: 'flex-start'
                }}>
                  <div style={{ marginTop: '0.2rem' }}>{alert.icon}</div>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 800, color: '#0f172a' }}>{alert.title}</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ZONE C: FILTRES */}
        <section style={{ marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.25rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div className="tabs-container" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '2px', scrollbarWidth: 'none' }}>
                {['All', 'Diamant', 'Fidèle', 'relancer', 'Nouveau', 'Prospect'].map(s => (
                  <button
                    key={s}
                    onClick={() => setSegmentFilter(s)}
                    style={{
                      padding: '0.6rem 1.25rem', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 800,
                      whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                      background: segmentFilter === s ? 'rgba(99,102,255,0.08)' : 'transparent',
                      color: segmentFilter === s ? 'var(--primary)' : '#64748b',
                    }}
                  >
                    {s === 'All' ? 'Tous' : s === 'relancer' ? 'À relancer' : s}
                  </button>
                ))}
              </div>
              <div className="search-wrapper" style={{ position: 'relative', minWidth: '320px', flex: 1, maxWidth: '500px' }}>
                <Search size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Rechercher un nom, un téléphone..."
                  style={{ paddingLeft: '3.5rem', height: '48px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.95rem' }}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ZONE D: LISTE */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
          <div className="table-container table-to-cards">
            <div className="table-container">
<table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'separate', borderSpacing: '0' }}>
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead className="mobile-hide" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: '#f8fafc' }}>
                  <th onClick={() => requestSort('nom_complet')} style={{ cursor: 'pointer', textAlign: 'left', padding: '1.25rem 1.5rem', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Client {sortConfig?.key === 'nom_complet' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th style={{ textAlign: 'left', padding: '1.25rem', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Segment</th>
                  <th onClick={() => requestSort('total_commandes')} style={{ cursor: 'pointer', textAlign: 'center', padding: '1.25rem', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Commandes {sortConfig?.key === 'total_commandes' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th onClick={() => requestSort('dernier_achat')} style={{ cursor: 'pointer', textAlign: 'left', padding: '1.25rem', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Dernier Contact {sortConfig?.key === 'dernier_achat' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th onClick={() => requestSort('total_encaisse')} style={{ cursor: 'pointer', textAlign: 'right', padding: '1.25rem', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>CA (Encaissé / Brut) {sortConfig?.key === 'total_encaisse' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th style={{ textAlign: 'right', padding: '1.25rem 1.5rem', borderBottom: '2px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>Action</th>
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
                ) : sortedClients.map((client) => (
                  <tr key={client.id} className="hover-row" onClick={() => openClientDetails(client)} style={{ cursor: 'pointer', transition: 'background 0.2s' }}>
                    <td data-label="Client" style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="mobile-hide" style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--primary), #4f46e5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(99, 102, 255, 0.2)' }}>
                          {client.nom_complet.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem' }}>{client.nom_complet}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{client.telephone}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Segment" style={{ padding: '1.25rem' }}>
                      <span style={{ 
                        padding: '0.5rem 1rem', 
                        borderRadius: '12px', 
                        fontSize: '0.8rem', 
                        fontWeight: 800,
                        backgroundColor: client.segment.includes('Diamant') ? 'rgba(16, 185, 129, 0.1)' : client.segment.includes('Prospect') ? 'rgba(139, 92, 246, 0.1)' : client.segment.includes('relancer') ? 'rgba(239, 68, 68, 0.1)' : '#f1f5f9',
                        color: client.segment.includes('Diamant') ? '#059669' : client.segment.includes('Prospect') ? '#7c3aed' : client.segment.includes('relancer') ? '#dc2626' : '#64748b',
                        border: `1px solid ${client.segment.includes('Diamant') ? 'rgba(16, 185, 129, 0.2)' : client.segment.includes('Prospect') ? 'rgba(139, 92, 246, 0.2)' : 'transparent'}`
                      }}>
                        {client.segment}
                      </span>
                    </td>
                    <td data-label="Commandes" style={{ padding: '1.25rem', textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{client.total_commandes} <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>total</span></div>
                      <div style={{ fontSize: '0.8rem', color: client.total_commandes_livrees > 0 ? '#10b981' : 'var(--text-muted)', fontWeight: 700 }}>{client.total_commandes_livrees} livrées</div>
                    </td>
                    <td data-label="Dernier Contact" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        <Calendar size={14} color="var(--primary)" />
                        {client.derniere_commande_brute ? format(new Date(client.derniere_commande_brute), 'dd MMM yyyy', { locale: fr }) : 'Jamais'}
                      </div>
                      <div className="mobile-hide" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginLeft: '1.4rem' }}>{client.locations[0] || 'Zone inconnue'}</div>
                    </td>
                    <td data-label="CA (Encaissé / Brut)" style={{ padding: '1.25rem', textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, color: '#10b981', fontSize: '1.1rem' }}>{client.total_encaisse.toLocaleString()} F</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>Brut: {client.total_brut.toLocaleString()} F</div>
                    </td>
                    <td data-label="Action" style={{ padding: '1.25rem', textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" style={{ borderRadius: '10px', width: 'auto' }} onClick={(e) => { e.stopPropagation(); openClientDetails(client); }}>
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
        </div>{/* end maxWidth wrapper */}
      </div>{/* end outer bg */}

      {/* Client Detail Modal */}
      {selectedClient && (
        <div className="modal-backdrop" style={{ backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.6)' }} onClick={() => setSelectedClient(null)}>
          <div className="modal-content" style={{ maxWidth: '900px', padding: 0, borderRadius: '32px', overflow: 'hidden', boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.25)' }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ padding: '3rem', background: 'linear-gradient(135deg, #f8fafc, #eff6ff)', position: 'relative' }}>
              <button onClick={() => setSelectedClient(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '0.6rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', zIndex: 10 }}>
                <X size={24} />
              </button>
              
              <div className="modal-header-flex" style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
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
            <div style={{ padding: '2rem', maxHeight: '65vh', overflowY: 'auto' }}>
              
              {/* Jauge de Fidélité */}
              <div style={{ marginBottom: '2.5rem', background: 'linear-gradient(90deg, #f8fafc, #f1f5f9)', padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontWeight: 900, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={18} color="var(--primary)" /> Progression VIP
                  </h4>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{Math.min(100, Math.round((selectedClient.client.total_commandes / 10) * 100))}% vers Diamant</span>
                </div>
                <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    background: 'linear-gradient(90deg, var(--primary), #8b5cf6)', 
                    width: `${Math.min(100, (selectedClient.client.total_commandes / 10) * 100)}%`,
                    transition: 'width 1s ease-in-out'
                  }}></div>
                </div>
                <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  {selectedClient.client.total_commandes >= 10 
                    ? 'Ce client a atteint le statut Diamant ! 🎉'
                    : `Encore ${10 - selectedClient.client.total_commandes} commandes pour débloquer le statut Diamant.`}
                </p>
              </div>

              {/* KPIs */}

              <div className="stats-grid-modal" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '3.5rem' }}>
                <div style={{ padding: '1.5rem', borderRadius: '24px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <CreditCard size={18} color="var(--primary)" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume d'achat</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>{selectedClient.client.total_encaisse.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span></div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.2rem' }}>Brut: {selectedClient.client.total_brut.toLocaleString()} CFA</div>
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
                <div className="stats-grid-modal" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: '#0f172a' }}>Parcours Client</h3>
                  <button onClick={() => navigate(`/clients/${encodeURIComponent(selectedClient.client.nom_complet)}/historique`)} className="btn btn-outline btn-sm" style={{ borderRadius: '10px', fontWeight: 700, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Eye size={16} /> Voir Historique Complet
                  </button>
                </div>
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
        .res-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
          gap: 1.5rem;
        }
        .tabs-container {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding: 4px 2px;
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
        }
        .tabs-container::-webkit-scrollbar { display: none; }
        
        @media (max-width: 768px) {
          .header-flex {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 1.5rem !important;
          }
          .actions-wrapper {
            width: 100%;
            justify-content: space-between;
          }
          .search-wrapper {
            min-width: 100% !important;
          }
          .res-grid {
            grid-template-columns: 1fr;
          }
          .modal-content {
            padding: 1.5rem !important;
          }
          .modal-header-flex {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 1rem !important;
          }
        }
        @media (max-width: 480px) {
          .actions-wrapper {
            flex-direction: column;
            width: 100%;
          }
          .actions-wrapper .btn {
            width: 100%;
          }
          .stats-grid-modal {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
};
