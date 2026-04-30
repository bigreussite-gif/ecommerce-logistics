import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Calendar, CheckCircle, XCircle, RotateCcw, Package, PhoneCall, Download } from 'lucide-react';
import { getCommandeWithLines } from '../services/commandeService';
import { Commande, LigneCommande } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const CommandeHistorique = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [commande, setCommande] = useState<(Commande & { lignes: LigneCommande[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCommandeWithLines(id)
      .then(cmd => setCommande(cmd))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', background: '#f8fafc' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Génération de la chronologie...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!commande) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Commande introuvable</h2>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/commandes')}>Retour</button>
      </div>
    );
  }

  // Construction de la chronologie (Timeline)
  const timeline: { date: Date | null, title: string, description: string, icon: any, color: string }[] = [];

  if (commande.date_creation) {
    timeline.push({
      date: new Date(commande.date_creation),
      title: "Création de la commande",
      description: `Commande passée via ${commande.source_commande}`,
      icon: Package,
      color: '#3b82f6'
    });
  }

  if (commande.date_validation_appel) {
    timeline.push({
      date: new Date(commande.date_validation_appel),
      title: "Validation Centre d'Appel",
      description: "Appel client effectué et commande validée pour livraison.",
      icon: PhoneCall,
      color: '#10b981'
    });
  }

  if (commande.date_livraison_effective) {
    timeline.push({
      date: new Date(commande.date_livraison_effective),
      title: "Livraison Effectuée",
      description: `Colis livré et fonds encaissés (${commande.montant_total} F).`,
      icon: CheckCircle,
      color: '#10b981'
    });
  }

  if (commande.statut_commande === 'annulee' && commande.updated_at) {
    timeline.push({
      date: new Date(commande.updated_at),
      title: "Commande Annulée",
      description: "Le client ou le système a annulé la commande.",
      icon: XCircle,
      color: '#ef4444'
    });
  }

  // Parse custom notes from notes_client (like [ANNULATION], [RÉACTIVATION])
  if (commande.notes_client) {
    const lines = commande.notes_client.split('\n');
    lines.forEach((line) => {
      if (line.includes('[ANNULATION]')) {
         timeline.push({ date: null, title: "Annulation", description: line.replace('[ANNULATION]', '').trim(), icon: XCircle, color: '#ef4444' });
      }
      if (line.includes('[RÉACTIVATION]')) {
         timeline.push({ date: null, title: "Réactivation", description: line.replace('[RÉACTIVATION]', '').trim(), icon: RotateCcw, color: '#3b82f6' });
      }
      if (line.includes('[RÉATTRIBUTION]')) {
         timeline.push({ date: null, title: "Réattribution", description: line.replace('[RÉATTRIBUTION]', '').trim(), icon: RotateCcw, color: '#f59e0b' });
      }
    });
  }

  const sortedTimeline = timeline.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.getTime() - a.date.getTime();
  });

  const exportToCSV = () => {
    const headers = ['Evenement', 'Date', 'Description'];
    const rows = sortedTimeline.map(t => [
      t.title,
      t.date ? format(t.date, 'dd/MM/yyyy HH:mm') : 'N/A',
      `"${t.description.replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historique_commande_${commande.id.slice(0,8)}.csv`);
    link.click();
  };

  return (
    <div style={{ padding: '1rem', background: '#f8fafc', minHeight: '100vh', animation: 'pageEnter 0.4s ease' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <button
              onClick={() => navigate(-1)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 700, marginBottom: '1rem', padding: 0 }}
            >
              <ArrowLeft size={18} /> Retour
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', background: 'linear-gradient(135deg, var(--primary), #4f46e5)', borderRadius: '16px', color: 'white', boxShadow: '0 8px 16px rgba(99, 102, 255, 0.2)' }}>
                <Clock size={28} />
              </div>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: '#1e293b', letterSpacing: '-0.02em' }}>
                  Historique Commande
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>
                  #{commande.id.slice(0,8).toUpperCase()} - {commande.nom_client}
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

        <div className="card glass-effect" style={{ padding: '2.5rem', borderRadius: '24px' }}>
           <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '24px', width: '2px', background: '#e2e8f0' }} />
              
              {sortedTimeline.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b' }}>Aucun historique disponible.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {sortedTimeline.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div key={idx} style={{ display: 'flex', gap: '1.5rem', position: 'relative' }}>
                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'white', border: `2px solid ${item.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, color: item.color, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                           <Icon size={22} />
                        </div>
                        <div style={{ flex: 1, background: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{item.title}</h3>
                              {item.date && (
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99,102,255,0.1)', padding: '0.3rem 0.6rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <Calendar size={12} /> {format(item.date, 'dd MMM yyyy HH:mm', { locale: fr })}
                                </div>
                              )}
                           </div>
                           <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem', lineHeight: '1.5' }}>
                             {item.description}
                           </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
           </div>
        </div>

      </div>
      <style>{`
        @keyframes pageEnter { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};
