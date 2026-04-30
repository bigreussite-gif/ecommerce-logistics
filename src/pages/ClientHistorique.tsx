import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Calendar, TrendingUp, Download, AlertCircle, ShoppingBag } from 'lucide-react';
import { getCommandes } from '../services/commandeService';
import { Commande } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { insforge } from '../lib/insforge';

export const ClientHistorique = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Pour l'instant, le client est identifié par son nom ou on peut fetch les commandes
      const allCmds = await getCommandes(null);
      // On va filtrer par nom_client === id (en décodant si c'est un nom passé dans l'URL)
      const decodedId = decodeURIComponent(id || '');
      const clientCmds = allCmds.filter(c => c.nom_client === decodedId);
      
      if (clientCmds.length > 0) {
        setClientInfo({
          nom: clientCmds[0].nom_client,
          telephone: clientCmds[0].telephone_client,
          commune: clientCmds[0].commune_livraison
        });
        setCommandes(clientCmds.sort((a, b) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime()));
      } else {
        setClientInfo({ nom: decodedId });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalCommandes: commandes.length,
    livrees: commandes.filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase())).length,
    montantTotal: commandes.filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase())).reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0)
  };

  const exportToCSV = () => {
    if (!clientInfo) return;
    const headers = ['Date', 'ID Commande', 'Statut', 'Montant', 'Livreur', 'Source'];
    const rows = commandes.map(c => [
      format(new Date(c.date_creation), 'dd/MM/yyyy HH:mm'),
      c.id.slice(0, 8).toUpperCase(),
      c.statut_commande,
      c.montant_total,
      (c as any).livreur?.nom_complet || '-',
      c.source_commande
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `achats_${clientInfo.nom.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', background: '#f8fafc' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Chargement de l'historique client...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', background: '#f8fafc', minHeight: '100vh', animation: 'pageEnter 0.4s ease' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* EN-TÊTE */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <button
              onClick={() => navigate('/clients')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 700, marginBottom: '1rem', padding: 0 }}
            >
              <ArrowLeft size={18} /> Retour aux clients
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', background: 'linear-gradient(135deg, var(--primary), #4f46e5)', borderRadius: '16px', color: 'white', boxShadow: '0 8px 16px rgba(99, 102, 255, 0.2)' }}>
                <User size={28} />
              </div>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: '#1e293b', letterSpacing: '-0.02em' }}>
                  Historique: {clientInfo?.nom}
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>
                  {clientInfo?.telephone || '-'} • {clientInfo?.commune || '-'}
                </p>
              </div>
            </div>
          </div>
          
          <button
            onClick={exportToCSV}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '12px', fontWeight: 700, background: 'white' }}
          >
            <Download size={18} /> Exporter CSV
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '16px', color: '#10b981' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b' }}>{stats.montantTotal.toLocaleString()} F</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>CA Généré</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#e0e7ff', borderRadius: '16px', color: '#4f46e5' }}>
              <ShoppingBag size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b' }}>{stats.totalCommandes}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Commandes Totales</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '16px', color: '#d97706' }}>
              <Calendar size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b' }}>{stats.livrees}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Livrées avec succès</div>
            </div>
          </div>
        </div>

        {/* TABLEAU */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID Commande</th>
                  <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Statut</th>
                  <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Montant</th>
                  <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {commandes.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                      Aucune commande trouvée pour ce client.
                    </td>
                  </tr>
                ) : (
                  commandes.map((cmd) => (
                    <tr key={cmd.id} style={{ borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                      <td style={{ padding: '1.25rem' }}>
                        <div style={{ fontWeight: 800, color: '#1e293b' }}>{format(new Date(cmd.date_creation), 'dd MMM yyyy', { locale: fr })}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{format(new Date(cmd.date_creation), 'HH:mm')}</div>
                      </td>
                      <td style={{ padding: '1.25rem', fontWeight: 700 }}>
                        #{cmd.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td style={{ padding: '1.25rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)' }}>
                          {cmd.statut_commande.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem', textAlign: 'right', fontWeight: 800 }}>
                        {cmd.montant_total?.toLocaleString()} F
                      </td>
                      <td style={{ padding: '1.25rem', fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
                        {cmd.source_commande}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      <style>{`
        @keyframes pageEnter { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};
