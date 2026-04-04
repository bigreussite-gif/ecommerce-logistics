import { useState, useEffect } from 'react';
import { 
  Users, Search, 
  X, TrendingUp, Eye
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
        commune: client.commune,
        adresse: client.adresse
      });
      const cmds = await getClientCommandes(client.id);
      cmds.sort((a, b) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime());
      setSelectedClient({ client, commandes: cmds });
    } catch(e) {
      console.error(e);
    }
  };

  const handleUpdate = async () => {
    if (!selectedClient) return;
    try {
      await updateClient(selectedClient.client.id, editForm);
      showToast("Client mis à jour avec succès !", "success");
      setIsEditing(false);
      fetchClients();
      // Update selected client local state for immediate feedback
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
    
    if (templateName === 'friendly') {
      message = `Bonjour ${nom} ! 🌟\nComment allez-vous ? J'espère que vous êtes satisfait de nos services. Si vous avez besoin de quoi que ce soit, nous sommes à votre disposition !\n- GomboSwift`;
    } 
    else if (templateName === 'promo') {
      message = `Coucou ${nom} ! 🎉\nEn tant que client fidèle, nous vous offrons une remise spéciale sur votre prochaine commande chez nous ! Utilisez ce code PROMO VIP.\nDécouvrez nos nouveautés dès maintenant !`;
    } 
    else if (templateName === 'reminder') {
      message = `Bonjour ${nom} ! 😊\nOn ne vous a pas vu depuis un moment ! On espère que tout va bien. Nous avons rentré de nouveaux articles qui pourraient vous intéresser. À très vite !`;
    }

    let phone = client.telephone.replace(/\D/g, '');
    if (!phone.startsWith('225') && phone.length === 10) phone = '225' + phone;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.identities.some(id => id.toLowerCase().includes(searchTerm.toLowerCase())) || 
                         c.telephone.includes(searchTerm);
    const matchesSegment = segmentFilter === 'All' || c.segment === segmentFilter;
    return matchesSearch && matchesSegment;
  });

  const exportToCSV = () => {
    const headers = ['Nom', 'Telephone', 'Segment', 'Commandes', 'Total Depense'];
    const rows = filteredClients.map(c => [
      c.nom_complet,
      c.telephone,
      c.segment,
      c.total_commandes,
      c.total_encaisse
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `crm_clients_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div style={{ animation: 'pageEnter 0.6s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Users size={36} strokeWidth={2.5} color="var(--primary)" />
              Customer Intelligence 2.0
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.4rem', fontWeight: 600 }}>Pilotez votre fidélité client avec des segments IA.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="card glass-effect" style={{ padding: '1rem 1.5rem', borderRadius: '18px', display: 'flex', flexDirection: 'column', minWidth: '140px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Audience</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary)' }}>{clients.length}</span>
            </div>
            <div className="card glass-effect" style={{ padding: '1rem 1.5rem', borderRadius: '18px', background: 'var(--primary)', color: 'white', display: 'flex', flexDirection: 'column', minWidth: '140px', border: 'none' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.8, textTransform: 'uppercase' }}>VIP Diamant</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 900 }}>{clients.filter(c => c.segment === 'Diamant 💎').length}</span>
            </div>
          </div>
        </div>

        <div className="card glass-effect" style={{ marginBottom: '2rem', padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={20} style={{ position: 'absolute', top: '50%', left: '1.25rem', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Rechercher par nom ou téléphone..." 
              style={{ paddingLeft: '3.5rem', height: '54px', borderRadius: '14px', width: '100%', border: 'none', background: 'transparent' }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="form-select" 
            style={{ width: '200px', height: '54px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: 700 }}
            value={segmentFilter}
            onChange={e => setSegmentFilter(e.target.value)}
          >
            <option value="All">Tous les segments</option>
            <option value="Diamant 💎">Diamant 💎</option>
            <option value="Fidèle ✨">Fidèle ✨</option>
            <option value="À relancer ⚠️">À relancer ⚠️</option>
            <option value="Nouveau 🌱">Nouveau 🌱</option>
          </select>

          <button 
            className="btn btn-primary" 
            style={{ height: '54px', borderRadius: '14px', padding: '0 1.5rem', fontWeight: 800 }}
            onClick={exportToCSV}
          >
            Exporter CSV
          </button>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Identité & Client</th>
                  <th>Segment IA</th>
                  <th style={{ textAlign: 'center' }}>Fréquence</th>
                  <th style={{ textAlign: 'right' }}>Volume d'achat</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '4rem' }}>Chargement...</td></tr>
                ) : filteredClients.map((client: Client & ClientFidelityStats & { identities: string[], locations: string[] }) => (
                  <tr key={client.id} onClick={() => openClientDetails(client)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                         <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'var(--bg-app)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, border: '1px solid #e2e8f0', position: 'relative' }}>
                           {client.nom_complet.charAt(0).toUpperCase()}
                           {client.identities.length > 1 && (
                             <div title={`${client.identities.length} noms utilisés`} style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#3b82f6', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                               {client.identities.length}
                             </div>
                           )}
                         </div>
                         <div>
                           <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{client.nom_complet}</div>
                           <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {client.telephone} 
                              {client.locations.length > 0 && <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>({client.locations.join(', ')})</span>}
                           </div>
                         </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '0.4rem 1rem', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem', 
                        fontWeight: 800,
                        backgroundColor: client.segment === 'Diamant 💎' ? '#f0fdf4' : client.segment === 'À relancer ⚠️' ? '#fef2f2' : '#f8fafc',
                        color: client.segment === 'Diamant 💎' ? '#166534' : client.segment === 'À relancer ⚠️' ? '#991b1b' : '#64748b'
                      }}>
                        {client.segment}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>
                      {client.total_commandes} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>colis</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: 'var(--primary)' }}>
                      {client.total_encaisse.toLocaleString()} CFA
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); openClientDetails(client); }}>Profil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RENDER MODAL OUTSIDE MAIN CONTAINER STREAM TO AVOID TRANSFORM TRAPPING */}
      {selectedClient && (
        <div className="modal-backdrop" onClick={() => setSelectedClient(null)}>
          <div className="modal-content" style={{ maxWidth: '800px', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ padding: '2rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', position: 'relative' }}>
               <button onClick={() => setSelectedClient(null)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.5rem', cursor: 'pointer' }}>
                 <X size={20} />
               </button>
               <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                 <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 900 }}>
                    {selectedClient.client.nom_complet.charAt(0).toUpperCase()}
                 </div>
                  <div>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <input 
                           className="form-input" 
                           value={editForm.nom_complet} 
                           onChange={e => setEditForm({...editForm, nom_complet: e.target.value})}
                           placeholder="Nom complet"
                        />
                         <input 
                           className="form-input" 
                           value={editForm.telephone} 
                           onChange={e => setEditForm({...editForm, telephone: e.target.value})}
                           placeholder="Téléphone"
                        />
                      </div>
                    ) : (
                      <>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0 }}>{selectedClient.client.nom_complet}</h2>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-success">{selectedClient.client.segment}</span>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>ID Unique: {selectedClient.client.telephone}</span>
                          {selectedClient.client.identities.length > 1 && (
                            <span style={{ fontSize: '0.75rem', color: '#3b82f6', background: '#eff6ff', padding: '0.2rem 0.6rem', borderRadius: '8px', fontWeight: 800 }}>
                              Aliases: {selectedClient.client.identities.filter(id => id !== selectedClient.client.nom_complet).join(', ')}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
               </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '2rem', maxHeight: '60vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
                  <div style={{ padding: '1.25rem', borderRadius: '16px', background: '#f1f5f9' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume Total</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{selectedClient.client.total_encaisse.toLocaleString()} CFA</div>
                  </div>
                  <div style={{ padding: '1.25rem', borderRadius: '16px', background: '#f1f5f9' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Commune / Quartier</div>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <input 
                           className="form-input" 
                           style={{ fontSize: '0.8rem', height: '36px' }}
                           value={editForm.commune} 
                           onChange={e => setEditForm({...editForm, commune: e.target.value})}
                           placeholder="Commune"
                        />
                        <input 
                           className="form-input" 
                           style={{ fontSize: '0.8rem', height: '36px' }}
                           value={editForm.adresse} 
                           onChange={e => setEditForm({...editForm, adresse: e.target.value})}
                           placeholder="Adresse"
                        />
                      </div>
                    ) : (
                      <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{selectedClient.client.commune || 'N/A'}<br/><span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{selectedClient.client.adresse}</span></div>
                    )}
                  </div>
                  <div style={{ padding: '1.25rem', borderRadius: '16px', background: '#f1f5f9' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dernier Achat</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{selectedClient.commandes[0] ? format(new Date(selectedClient.commandes[0].date_creation), 'dd/MM/yy') : 'N/A'}</div>
                  </div>
               </div>

               <div style={{ marginBottom: '2.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={20} color="var(--primary)" /> Actions Marketing WhatsApp
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <button className="btn" style={{ background: '#22c55e', color: 'white', fontSize: '0.85rem' }} onClick={() => sendWhatsApp(selectedClient.client, 'friendly')}>Bienvenue 👋</button>
                    <button className="btn" style={{ background: '#16a34a', color: 'white', fontSize: '0.85rem' }} onClick={() => sendWhatsApp(selectedClient.client, 'promo')}>Promo VIP 🎁</button>
                    <button className="btn" style={{ background: '#15803d', color: 'white', fontSize: '0.85rem' }} onClick={() => sendWhatsApp(selectedClient.client, 'reminder')}>Relance 🔄</button>
                  </div>
               </div>

               <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>Historique des Commandes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedClient.commandes.map((cmd) => (
                    <div key={cmd.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                         <button 
                           className="btn btn-outline" 
                           style={{ padding: '0.4rem', borderRadius: '10px' }}
                           onClick={() => setSelectedOrderId(cmd.id)}
                         >
                           <Eye size={14} />
                         </button>
                         <div>
                           <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>#{cmd.id.slice(0,8).toUpperCase()}</div>
                           <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{format(new Date(cmd.date_creation), 'dd MMMM yyyy', { locale: fr })}</div>
                         </div>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                         <div style={{ fontWeight: 900 }}>{cmd.montant_total?.toLocaleString()} CFA</div>
                         <span className={`badge ${['livree', 'terminee'].includes(cmd.statut_commande) ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>{cmd.statut_commande}</span>
                       </div>
                    </div>
                  ))}
                </div>
            </div>

            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
               <div>
                  {isEditing ? (
                    <button className="btn btn-primary" onClick={handleUpdate}>Enregistrer les modifications</button>
                  ) : (
                    <button className="btn btn-outline" onClick={() => setIsEditing(true)}>Modifier les infos</button>
                  )}
               </div>
               <button className="btn btn-primary" onClick={() => setSelectedClient(null)}>Fermer l'Analyse</button>
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
    </>
  );
};
