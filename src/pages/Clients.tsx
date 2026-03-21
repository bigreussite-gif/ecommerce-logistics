import { useState, useEffect } from 'react';
import { 
  Users, Search, MessageCircle, Phone, MapPin, 
  X
} from 'lucide-react';
import { getClientsWithIntelligence, getClientCommandes, ClientFidelityStats } from '../services/clientService';
import type { Client, Commande } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const Clients = () => {
  const [clients, setClients] = useState<(Client & ClientFidelityStats)[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<{ client: Client & ClientFidelityStats, commandes: Commande[] } | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  const openClientDetails = async (client: Client & ClientFidelityStats) => {
    const cmds = await getClientCommandes(client.id);
    cmds.sort((a, b) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime());
    setSelectedClient({ client, commandes: cmds });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sendWhatsApp = (client: Client, templateName: 'friendly' | 'promo' | 'reminder') => {
    let message = '';
    const nom = client.nom_complet.split(' ')[0] || 'Cher client';
    
    if (templateName === 'friendly') {
      message = `Bonjour ${nom} ! 🌟\nComment allez-vous ? J'espère que vous êtes satisfait de nos services. Si vous avez besoin de quoi que ce soit, nous sommes à votre disposition !\n- L'équipe`;
    } 
    else if (templateName === 'promo') {
      message = `Coucou ${nom} ! 🎉\nEn tant que client fidèle, nous vous offrons une remise spéciale sur votre prochaine commande chez nous ! Utilisez ce code PROMO VIP.\nDécouvrez nos nouveautés dès maintenant : [Lien]`;
    } 
    else if (templateName === 'reminder') {
      message = `Bonjour ${nom} ! 😊\nOn ne vous a pas vu depuis un moment ! On espère que tout va bien. \nNous avons rentré de nouveaux articles qui pourraient vous intéresser. À très vite !`;
    }

    let phone = client.telephone.replace(/\D/g, '');
    if (!phone.startsWith('225') && phone.length === 10) phone = '225' + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredClients = clients.filter(c => 
    c.nom_complet.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.telephone.includes(searchTerm)
  );

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="loading-spinner"></div>
      <p style={{ marginTop: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Analyse intelligente de la base CRM...</p>
    </div>
  );

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Users size={36} strokeWidth={2.5} color="var(--primary)" />
            Customer Intelligence 2.0
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>Fidélisez vos clients avec une segmentation IA et des actions WhatsApp ciblées.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ background: 'white', padding: '1rem 1.5rem', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Audience</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)' }}>{clients.length} <span style={{ fontSize: '0.8rem' }}>leads</span></div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', padding: '1rem 1.5rem', borderRadius: '18px', color: 'white' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.9, textTransform: 'uppercase' }}>Clients VIP</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{clients.filter(c => c.segment === 'Diamant 💎').length}</div>
          </div>
        </div>
      </div>

      <div className="card glass-effect" style={{ marginBottom: '2.5rem', padding: '1.5rem' }}>
        <div style={{ position: 'relative', maxWidth: '600px' }}>
          <Search size={22} style={{ position: 'absolute', top: '50%', left: '1.25rem', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Rechercher par nom ou téléphone..." 
            style={{ paddingLeft: '3.5rem', height: '54px', borderRadius: '14px' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card glass-effect" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Identité & Client</th>
                <th>Segment IA</th>
                <th style={{ textAlign: 'center' }}>Total Commandes</th>
                <th style={{ textAlign: 'right' }}>Dépense Totale</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr key={client.id} onClick={() => openClientDetails(client)} className="hover-card">
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                       <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                         {client.nom_complet.charAt(0).toUpperCase()}
                       </div>
                       <div>
                         <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{client.nom_complet}</div>
                         <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{client.telephone}</div>
                       </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ 
                      padding: '0.4rem 0.8rem', 
                      borderRadius: '10px', 
                      fontSize: '0.75rem', 
                      fontWeight: 800,
                      backgroundColor: client.segment === 'Diamant 💎' ? '#fef3c7' : client.segment === 'À relancer ⚠️' ? '#fee2e2' : '#f1f5f9',
                      color: client.segment === 'Diamant 💎' ? '#92400e' : client.segment === 'À relancer ⚠️' ? '#991b1b' : '#64748b'
                    }}>
                      {client.segment}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{client.total_commandes}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                    {client.total_depense.toLocaleString()} <span style={{ fontSize: '0.7rem' }}>CFA</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-outline" style={{ borderRadius: '10px', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                      Détails
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedClient && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          backgroundColor: 'rgba(0,0,0,0.4)', 
          backdropFilter: 'blur(8px)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 9999, 
          padding: '1.5rem',
          animation: 'modalEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }} onClick={() => setSelectedClient(null)}>
          <div className="card" style={{ 
            maxWidth: '900px', 
            width: '100%', 
            maxHeight: '90vh', 
            overflowY: 'auto', 
            position: 'relative', 
            padding: '2.5rem', 
            background: 'white',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: 'none',
            borderRadius: '24px'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedClient(null)} 
              style={{ 
                position: 'absolute', 
                top: '1.5rem', 
                right: '1.5rem', 
                background: '#f1f5f9', 
                border: 'none', 
                borderRadius: '50%', 
                width: '40px', 
                height: '40px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}
            >
              <X size={20} />
            </button>
            
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '30px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 900 }}>
                {selectedClient.client.nom_complet.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>{selectedClient.client.nom_complet}</h2>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <Phone size={16} color="var(--primary)" /> {selectedClient.client.telephone}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <MapPin size={16} color="var(--primary)" /> {selectedClient.client.commune || 'Abidjan'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
              <div className="card" style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Volume Achats</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)' }}>{selectedClient.client.total_depense.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span></div>
              </div>
              <div className="card" style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Panier Moyen</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{selectedClient.client.panier_moyen.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>CFA</span></div>
              </div>
              <div className="card" style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Dernier Achat</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: '0.4rem' }}>
                  {selectedClient.client.derniere_commande ? format(new Date(selectedClient.client.derniere_commande), 'dd MMM yyyy', { locale: fr }) : 'Jamais'}
                </div>
              </div>
            </div>

            <div style={{ background: '#f0fdf4', padding: '1.5rem', borderRadius: '20px', border: '1px solid #bbf7d0', marginBottom: '2.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <MessageCircle size={20} /> Actions CRM Directes
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <button className="btn" style={{ backgroundColor: '#25D366', color: 'white', fontWeight: 800, border: 'none', height: '50px', borderRadius: '12px' }} onClick={() => sendWhatsApp(selectedClient.client, 'friendly')}>
                  Message Bienvenue 👋
                </button>
                <button className="btn" style={{ backgroundColor: '#128C7E', color: 'white', fontWeight: 800, border: 'none', height: '50px', borderRadius: '12px' }} onClick={() => sendWhatsApp(selectedClient.client, 'promo')}>
                  Offre Spéciale 🎁
                </button>
                <button className="btn" style={{ backgroundColor: '#075E54', color: 'white', fontWeight: 800, border: 'none', height: '50px', borderRadius: '12px' }} onClick={() => sendWhatsApp(selectedClient.client, 'reminder')}>
                  Relance Client 🔄
                </button>
              </div>
            </div>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <h4 style={{ fontWeight: 800, marginBottom: '1rem' }}>Historique des Commandes</h4>
              {selectedClient.commandes.map(cmd => (
                <div key={cmd.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>#{cmd.id.slice(0,8).toUpperCase()} - {format(new Date(cmd.date_creation), 'dd/MM/yyyy')}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cmd.statut_commande}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--primary)' }}>{Number(cmd.montant_total).toLocaleString()} CFA</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
