import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User as UserIcon, TrendingUp, Download, CheckCircle, XCircle } from 'lucide-react';
import { getCommandes } from '../services/commandeService';
import { getUtilisateurs } from '../services/utilisateurService';
import { Commande, User } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const StaffHistorique = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<User | null>(null);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [users, allCmds] = await Promise.all([
        getUtilisateurs(),
        getCommandes(null)
      ]);
      
      const foundStaff = users.find(u => u.id === id);
      if (foundStaff) {
        setStaff(foundStaff);
        
        // Commandes traitées par ce staff (comme livreur ou comme agent d'appel)
        const staffCmds = allCmds.filter(c => c.livreur_id === id || c.agent_appel_id === id);
        setCommandes(staffCmds.sort((a, b) => new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime()));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // const isLivreur = staff?.role === 'LIVREUR' || staff?.role === 'AGENT_MIXTE';
  
  const stats = {
    totalTraitees: commandes.length,
    succes: commandes.filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase())).length,
    echecs: commandes.filter(c => ['echouee', 'retour_livreur', 'annulee', 'absent'].includes(c.statut_commande?.toLowerCase())).length,
    montantGenere: commandes.filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase())).reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0)
  };

  const exportToCSV = () => {
    if (!staff) return;
    const headers = ['Date', 'ID Commande', 'Client', 'Statut', 'Montant'];
    const rows = commandes.map(c => [
      format(new Date(c.date_creation), 'dd/MM/yyyy HH:mm'),
      c.id.slice(0, 8).toUpperCase(),
      `"${c.nom_client}"`,
      c.statut_commande,
      c.montant_total
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historique_staff_${staff.nom_complet.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', background: '#f8fafc' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Chargement de l'historique staff...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!staff) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Membre du staff introuvable</h2>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/performance-staff')}>Retour</button>
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
              onClick={() => navigate('/performance-staff')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 700, marginBottom: '1rem', padding: 0 }}
            >
              <ArrowLeft size={18} /> Retour aux performances
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', background: 'linear-gradient(135deg, var(--primary), #4f46e5)', borderRadius: '16px', color: 'white', boxShadow: '0 8px 16px rgba(99, 102, 255, 0.2)' }}>
                <UserIcon size={28} />
              </div>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: '#1e293b', letterSpacing: '-0.02em' }}>
                  Historique: {staff.nom_complet}
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>
                  Rôle: {staff.role}
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
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b' }}>{stats.montantGenere.toLocaleString()} F</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>CA Généré (Succès)</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#e0e7ff', borderRadius: '16px', color: '#4f46e5' }}>
              <CheckCircle size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b' }}>{stats.succes}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Opérations Réussies</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '16px', color: '#ef4444' }}>
              <XCircle size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b' }}>{stats.echecs}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Échecs / Retours</div>
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
                  <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Client</th>
                  <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Statut</th>
                  <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {commandes.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                      Aucune commande trouvée pour ce staff.
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
                      <td style={{ padding: '1.25rem', fontWeight: 600, color: '#334155' }}>
                        {cmd.nom_client}
                      </td>
                      <td style={{ padding: '1.25rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)' }}>
                          {cmd.statut_commande.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem', textAlign: 'right', fontWeight: 800 }}>
                        {cmd.montant_total?.toLocaleString()} F
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
