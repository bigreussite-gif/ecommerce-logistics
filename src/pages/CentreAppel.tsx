import { useState, useEffect, useMemo } from 'react';
import { 
  PhoneCall, CheckCircle, Clock, X,
  MessageSquare, TrendingUp, Search, ChevronRight
} from 'lucide-react';
import { AppelForm } from '../components/centre-appel/AppelForm';
import { CommandeDetails } from '../components/commandes/CommandeDetails';
import { subscribeToCommandesByStatus } from '../services/commandeService';
import { useAuth } from '../contexts/AuthContext';
import type { Commande } from '../types';

const SHOP_NAME = "Jachete Côte d'Ivoire";

export const CentreAppel = () => {
  const { currentUser } = useAuth();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommande, setSelectedCommande] = useState<Commande | null>(null);
  const [viewingCommandeId, setViewingCommandeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeScript, setActiveScript] = useState<{ title: string, text: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCommandesByStatus(['en_attente_appel', 'a_rappeler'], (data) => {
      setCommandes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const urgent = commandes.filter(c => c.statut_commande === 'a_rappeler').length;
    const newCalls = commandes.filter(c => c.statut_commande === 'en_attente_appel').length;
    return { urgent, newCalls, total: commandes.length };
  }, [commandes]);

  const filteredCommandes = useMemo(() => {
    return commandes.filter(c => {
      const matchesSearch = (c.nom_client || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (c.telephone_client || '').includes(searchTerm);
      const matchesStatus = statusFilter === 'All' || 
                           (statusFilter === 'New' && c.statut_commande === 'en_attente_appel') ||
                           (statusFilter === 'Relance' && c.statut_commande === 'a_rappeler');
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (a.statut_commande === 'a_rappeler' && b.statut_commande !== 'a_rappeler') return -1;
      if (a.statut_commande !== 'a_rappeler' && b.statut_commande === 'a_rappeler') return 1;
      return new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime();
    });
  }, [commandes, searchTerm, statusFilter]);

  const scriptsTemplates = [
    { 
      id: 'standard', 
      title: "🚀 Confirmation Directe (Abidjan)", 
      text: "Bonjour [NOM_CLIENT] ! 🙌 C'est [OPERATEUR] de Jachete Côte d'Ivoire. Excellente nouvelle : votre commande est prête et notre livreur se déplace à [LOCALISATION] pour vous la remettre ! Vous payez à la livraison, aucune avance requise. Êtes-vous disponible pour réceptionner votre colis aujourd'hui ?" 
    },
    {
      id: 'interieur',
      title: "🚌 Commune Intérieure (Hors Abidjan)",
      text: "Bonjour [NOM_CLIENT] ! 🙌 C'est [OPERATEUR] de Jachete CI. Super nouvelle : votre commande est prête à être expédiée vers [LOCALISATION] ! ✅ Voici comment ça marche : 1️⃣ Payez via Wave ou Orange Money au numéro de dépôt 💸 +225 07 57 22 87 31 2️⃣ Envoyez la capture de votre reçu par WhatsApp sur ce même numéro 3️⃣ Votre colis est expédié immédiatement à la gare routière de votre ville 4️⃣ Vous récupérez sur place — rapide et sécurisé ! 💡 Astuce : si vous avez un frère ou proche à Abidjan en ce moment, donnez-nous son contact — on livre directement ici ! Après paiement, envoyez la capture au +225 07 57 22 87 31 ou appelez notre service au +225 01 72 57 13 52."
    },
    { 
      id: 'recall', 
      title: "⏳ Relance 'On est ensemble'", 
      text: "Bonjour [NOM_CLIENT], c'est [OPERATEUR] de Jachete CI. On a essayé de vous joindre plusieurs fois pour votre colis, mais ça ne passait pas. Votre commande est déjà prête pour [LOCALISATION]. On ne veut pas que ça traîne ici, donc dites-moi : est-ce qu'on peut envoyer le livreur maintenant pour finir ça ?" 
    },
    { 
      id: 'delay', 
      title: "🛠️ Solution 'Priorité Chic'", 
      text: "Bonjour [NOM_CLIENT], c'est [OPERATEUR] de Jachete CI. On a eu un petit contretemps aujourd'hui, on s'excuse vraiment pour ça. Mais j'ai décidé de vous mettre en 'Priorité 1' pour demain matin à la première heure sur [LOCALISATION]. Vous serez le tout premier livré. C'est bon pour vous ?" 
    },
    {
      id: 'marketing_recovery',
      title: "💎 Reconquête 'Cadeau'",
      text: "Bonjour [NOM_CLIENT], c'est [OPERATEUR] de Jachete CI. Je vois que votre commande à [LOCALISATION] a été annulée. C'est vraiment dommage parce que c'est un article qui finit vite. Si vous reprenez maintenant, je vous rajoute un petit cadeau de la boutique pour vous faire plaisir. On relance la livraison ?"
    }
  ];

  const formatScript = (template: string, commande?: Commande) => {
    let text = template;
    const clientName = commande?.nom_client || "[Nom du Client]";
    const location = commande ? (commande.quartier_livraison || commande.commune_livraison || "[Commune]") : "[Commune/Quartier]";
    const operatorName = currentUser?.nom_complet || currentUser?.email?.split('@')[0] || "votre conseiller";

    text = text.replace(/\[NOM_CLIENT\]/g, clientName);
    text = text.replace(/\[BOUTIQUE\]/g, SHOP_NAME);
    text = text.replace(/\[LOCALISATION\]/g, location);
    text = text.replace(/\[OPERATEUR\]/g, operatorName);
    
    return text;
  };

  const handleShowScript = (id: string, commande?: Commande) => {
    const template = scriptsTemplates.find(s => s.id === id);
    if (template) {
      setActiveScript({
        title: template.title,
        text: formatScript(template.text, commande)
      });
    }
  };

  const getSuggestedScriptId = (commande: Commande) => {
    if (commande.statut_commande === 'a_rappeler') return 'recall';
    const commune = (commande.commune_livraison || '').toLowerCase().trim();
    if (commune && (commune.includes('intérieur') || commune.includes('interieur') || commune.includes('hors') || commune === 'autre')) return 'interieur';
    return 'standard';
  };

  return (
    <>
      <div style={{ animation: 'pageEnter 0.6s ease', paddingBottom: '4rem' }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <div style={{ padding: '0.75rem', background: 'var(--primary)', borderRadius: '16px', color: 'white' }}>
                <PhoneCall size={32} />
              </div>
              <h1 className="text-premium" style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0 }}>Call Center Ops</h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: 600 }}>Coordination des flux de validation et relances clients.</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="card glass-effect" style={{ padding: '1rem 1.5rem', borderRadius: '18px', display: 'flex', flexDirection: 'column', minWidth: '160px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Flux Total</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary)' }}>{stats.total}</span>
            </div>
            <div className="card glass-effect" style={{ padding: '1rem 1.5rem', borderRadius: '18px', background: '#fef2f2', border: '1px solid #fee2e2', display: 'flex', flexDirection: 'column', minWidth: '160px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase' }}>À Rappeler</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#dc2626' }}>{stats.urgent}</span>
            </div>
          </div>
        </div>

        <div className="res-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 350px', alignItems: 'start' }}>
          {/* Main Area: Order List */}
          <div className="card glass-effect" style={{ padding: '2rem', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Clock size={24} color="var(--primary)" /> File d'attente
              </h3>
              
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1, minWidth: '400px', justifyContent: 'flex-end' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '250px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Filtrer..." 
                    style={{ paddingLeft: '3rem', height: '44px', borderRadius: '12px', background: 'white' }}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                  {[
                    { id: 'All', label: 'Tous' },
                    { id: 'New', label: 'Nouveaux' },
                    { id: 'Relance', label: 'Relances' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '10px',
                        border: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: statusFilter === f.id ? 'white' : 'transparent',
                        color: statusFilter === f.id ? 'var(--primary)' : 'var(--text-muted)',
                        boxShadow: statusFilter === f.id ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '6rem' }}>
                <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
                <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Synchronisation du flux d'appels...</p>
              </div>
            ) : filteredCommandes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '6rem', background: '#f8fafc', borderRadius: '20px', border: '2px dashed #e2e8f0' }}>
                <CheckCircle size={48} color="#10b981" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Tous les appels sont traités !</h4>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 600 }}>Le flux est vide pour le moment.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredCommandes.map(cmd => (
                  <div key={cmd.id} className="call-row" style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: '1.5rem', background: 'white', borderRadius: '20px', 
                    border: `1px solid ${cmd.statut_commande === 'a_rappeler' ? '#fee2e2' : '#f1f5f9'}`,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden'
                  }} onClick={() => setViewingCommandeId(cmd.id)}>
                    {cmd.statut_commande === 'a_rappeler' && (
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: '#ef4444' }} />
                    )}
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                      <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: cmd.statut_commande === 'a_rappeler' ? '#fef2f2' : '#eff6ff', color: cmd.statut_commande === 'a_rappeler' ? '#dc2626' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PhoneCall size={24} strokeWidth={2.5} />
                      </div>
                      
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e293b' }}>{cmd.nom_client}</span>
                          {cmd.statut_commande === 'a_rappeler' && <span style={{ padding: '0.2rem 0.6rem', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800 }}>URGENT: RELANCE</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '0.25rem' }}>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 700 }}>📞 {cmd.telephone_client}</div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>📍 {cmd.commune_livraison || 'Zone inconnue'}</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                       <div style={{ textAlign: 'right', marginRight: '1rem' }}>
                         <div style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.1rem' }}>{(cmd.montant_total || 0).toLocaleString()} F</div>
                         <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>{cmd.lignes?.length} articles</div>
                       </div>
                       
                       <div style={{ display: 'flex', gap: '0.5rem' }}>
                         <button 
                           className="btn btn-outline" 
                           style={{ height: '48px', borderRadius: '14px', padding: '0 1rem', fontWeight: 800, fontSize: '0.8rem' }}
                           onClick={(e) => { 
                             e.stopPropagation(); 
                             const scriptId = getSuggestedScriptId(cmd);
                             handleShowScript(scriptId, cmd);
                           }}
                         >
                           Script
                         </button>
                         <button 
                           className="btn btn-primary" 
                           style={{ height: '48px', borderRadius: '14px', padding: '0 1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                           onClick={(e) => { e.stopPropagation(); setSelectedCommande(cmd); }}
                         >
                           Traiter <ChevronRight size={18} />
                         </button>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: Scripts & Insights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="card glass-effect" style={{ padding: '2rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <MessageSquare size={20} color="var(--primary)" /> Scripts Opérateurs
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {scriptsTemplates.map((s, i) => (
                  <div key={i} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.5)', borderRadius: '16px', border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => handleShowScript(s.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)' }}>{s.title}</div>
                      <ChevronRight size={14} color="var(--primary)" />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{s.text}"</p>
                    <button className="btn btn-outline btn-sm" style={{ width: '100%', marginTop: '1rem', height: '32px', fontSize: '0.75rem', borderRadius: '8px' }}>Afficher</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card glass-effect" style={{ padding: '2rem', borderRadius: '24px', background: 'linear-gradient(135deg, var(--primary), #4f46e5)', color: 'white', border: 'none' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 900 }}>Productivité</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>85%</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 700 }}>Taux de validation</div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4', opacity: 0.9 }}>
                Assurez-vous de bien valider la <strong>commune</strong> et le <strong>créneau horaire</strong> lors de chaque appel.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Script Viewer Modal */}
      {activeScript && (
        <div className="modal-backdrop" style={{ backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.6)' }} onClick={() => setActiveScript(null)}>
          <div className="modal-content" style={{ maxWidth: '600px', padding: '3rem', borderRadius: '32px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary)' }}>{activeScript.title}</h2>
              <button onClick={() => setActiveScript(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '12px', width: '40px', height: '40px', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '24px', border: '1px solid #e2e8f0', position: 'relative' }}>
              <MessageSquare size={24} color="var(--primary)" style={{ position: 'absolute', top: '-12px', left: '2rem', background: 'white', padding: '4px', borderRadius: '8px' }} />
              <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.8', color: '#334155', fontWeight: 600 }}>
                {activeScript.text}
              </p>
            </div>
            <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, height: '56px', borderRadius: '16px', fontWeight: 800 }}
                onClick={() => {
                  navigator.clipboard.writeText(activeScript.text);
                  setActiveScript(null);
                }}
              >
                Copier le script
              </button>
              <button className="btn btn-outline" style={{ flex: 1, height: '56px', borderRadius: '16px', fontWeight: 800 }} onClick={() => setActiveScript(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {selectedCommande && (
        <AppelForm 
          commande={selectedCommande}
          onClose={() => setSelectedCommande(null)}
          onSave={() => setSelectedCommande(null)}
        />
      )}

      {viewingCommandeId && (
        <CommandeDetails 
          commandeId={viewingCommandeId} 
          onClose={() => setViewingCommandeId(null)} 
        />
      )}

      <style>{`
        @keyframes pageEnter {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .call-row:hover {
          transform: translateX(5px);
          border-color: var(--primary) !important;
          box-shadow: 0 8px 25px rgba(99, 102, 255, 0.08) !important;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};
