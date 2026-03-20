import { useState, useEffect } from 'react';
import { Users, Search, MessageCircle, Gift, Phone, MapPin, Calendar, ExternalLink, X } from 'lucide-react';
import { getAllClients, getClientCommandes } from '../services/clientService';
import type { Client, Commande } from '../types';
import { format } from 'date-fns';

export const Clients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<{ client: Client, commandes: Commande[] } | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await getAllClients();
      // On les trie, potentiellement par date d'inscription s'ils en ont une, 
      // ici on va charger tous les clients.
      setClients(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openClientDetails = async (client: Client) => {
    const cmds = await getClientCommandes(client.id);
    // Trier les commandes par date décroissante
    cmds.sort((a, b) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime());
    setSelectedClient({ client, commandes: cmds });
  };

  // WhatsApp Templates
  const sendWhatsApp = (client: Client, templateName: 'friendly' | 'promo' | 'reminder', commandes?: Commande[]) => {
    let message = '';
    const nom = client.nom_complet.split(' ')[0] || 'Cher client';
    
    if (templateName === 'friendly') {
      message = `Bonjour ${nom} ! 🌟\nComment allez-vous ? J'espère que vous êtes satisfait de nos services. Si vous avez besoin de quoi que ce soit, nous sommes à votre disposition !\n- L'équipe`;
    } 
    else if (templateName === 'promo') {
      message = `Coucou ${nom} ! 🎉\nEn tant que client fidèle, nous vous offrons une remise spéciale sur votre prochaine commande chez nous ! Utilisez ce code PROMO VIP.\nDécouvrez nos nouveautés dès maintenant : [Lien]`;
    } 
    else if (templateName === 'reminder' && commandes && commandes.length > 0) {
      const lastCmdDesc = `${commandes[0].montant_total.toLocaleString()} CFA`;
      message = `Bonjour ${nom} ! 😊\nCela fait un moment depuis votre dernière commande chez nous (${lastCmdDesc}). \nNous voulions prendre de vos nouvelles et vous informer que de nouveaux articles sont disponibles en stock ! Besoin de quelque chose aujourd'hui ?`;
    }

    // Nettoyer et formater le numéro
    let phone = client.telephone.replace(/\D/g, '');
    if (!phone.startsWith('225') && phone.length === 10) phone = '225' + phone; // prefix CI default if needed

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredClients = clients.filter(c => 
    c.nom_complet.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.telephone.includes(searchTerm)
  );

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>;

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={28} style={{ color: 'var(--primary-color)' }} />
          CRM Clients
        </h1>
        <div style={{ color: 'var(--text-secondary)' }}>
          Total : <strong style={{ color: 'var(--text-primary)' }}>{clients.length}</strong> clients
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1rem' }}>
        <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Rechercher par nom ou numéro..." 
            style={{ paddingLeft: '3rem', maxWidth: '400px' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Liste des clients */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ margin: 0, overflowX: 'auto' }}>
          <table className="table" style={{ margin: 0 }}>
            <thead style={{ backgroundColor: 'var(--bg-color)' }}>
              <tr>
                <th>Nom & Contact</th>
                <th>Localisation</th>
                <th>Remarques</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr key={client.id} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => openClientDetails(client)} className="hoverable-row">
                  <td>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{client.nom_complet}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={12} /> {client.telephone}
                    </div>
                  </td>
                  <td>
                    {client.commune || client.ville ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        <MapPin size={14} /> {client.commune} {client.ville ? `(${client.ville})` : ''}
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'inline-block', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {client.remarques || '-'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); openClientDetails(client); }}>
                      <ExternalLink size={16} /> Fiche
                    </button>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Aucun client trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Details Modal */}
      {selectedClient && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setSelectedClient(null)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={24} />
            </button>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
               <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
                 {selectedClient.client.nom_complet.charAt(0).toUpperCase()}
               </div>
               <div>
                 <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{selectedClient.client.nom_complet}</h2>
                 <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <Phone size={16} /> {selectedClient.client.telephone}
                   {selectedClient.client.email && <>&nbsp;•&nbsp; {selectedClient.client.email}</>}
                 </p>
                 {(selectedClient.client.commune || selectedClient.client.adresse) && (
                   <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <MapPin size={16} /> {selectedClient.client.commune} - {selectedClient.client.adresse}
                   </p>
                 )}
               </div>
            </div>

            {/* Actions de Fidélisation WhatsApp */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)' }}>
                <MessageCircle size={20} /> Fidélisation & Marketing WhatsApp
              </h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button className="btn" style={{ backgroundColor: '#25D366', color: 'white', display: 'flex', gap: '0.5rem', alignItems: 'center', border: 'none' }} onClick={() => sendWhatsApp(selectedClient.client, 'friendly')}>
                  Salut Amical 👋
                </button>
                <button className="btn" style={{ backgroundColor: '#25D366', color: 'white', display: 'flex', gap: '0.5rem', alignItems: 'center', border: 'none' }} onClick={() => sendWhatsApp(selectedClient.client, 'promo')}>
                  <Gift size={18} /> Offrir Remise / Promo
                </button>
                <button className="btn" style={{ backgroundColor: '#128C7E', color: 'white', display: 'flex', gap: '0.5rem', alignItems: 'center', border: 'none' }} onClick={() => sendWhatsApp(selectedClient.client, 'reminder', selectedClient.commandes)} disabled={selectedClient.commandes.length === 0}>
                   Relance Anciens Achats
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                * Ces boutons ouvriront directement WhatsApp ou WhatsApp Web avec un message pré-écrit ultra-ciblé.
              </p>
            </div>

            {/* Historique des Achats */}
            <div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={20} /> Historique des Commandes ({selectedClient.commandes.length})
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {selectedClient.commandes.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', gridColumn: '1 / -1', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    Aucune commande enregistrée pour ce client.
                  </div>
                ) : (
                  selectedClient.commandes.map(cmd => (
                    <div key={cmd.id} style={{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 600 }}>#{cmd.id.slice(0,6)}</span>
                        <span className={`badge badge-${cmd.statut_commande === 'livree' ? 'success' : cmd.statut_commande.includes('retour') || cmd.statut_commande === 'annulee' ? 'danger' : 'info'}`}>
                          {cmd.statut_commande}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        {format(new Date(cmd.date_creation), 'dd MMMM yyyy HH:mm')}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--primary-color)' }}>
                        {Number(cmd.montant_total).toLocaleString()} CFA
                      </div>
                      <div style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                        Source : {cmd.source_commande}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      <style>{`
        .hoverable-row:hover td {
          background-color: var(--bg-color);
        }
      `}</style>
    </div>
  );
};
