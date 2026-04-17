import { useState, useEffect } from 'react';
import { getUtilisateurs } from '../services/utilisateurService';
import { getCommandes } from '../services/commandeService';
import { getProduits } from '../services/produitService';
import { Commande, Produit } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell
} from 'recharts';
import { Award, Target, PhoneCall, ShoppingBag, Truck } from 'lucide-react';
import { startOfDay, subDays, isAfter, differenceInWeeks } from 'date-fns';
import { insforge } from '../lib/insforge';

import { calculateLogisticalStats } from '../services/financialService';

interface StaffStats {
  id: string;
  nom: string;
  total_cmds: number;
  livrees: number;
  retours: number;
  annulees: number;
  reportees: number;
  ca_livraison: number;
  taux_succes: number;
}

interface AgentStats {
  id: string;
  nom: string;
  total_traitees: number;
  validees: number;
  livrees: number;
  retours: number;
  echecs: number;
  reprogrammees: number;
  annulees: number;
  taux_conversion: number; // livrees / total (vrai taux de succès)
  connexions: number;
}

interface ProductCreatorStats {
  id: string;
  nom: string;
  total_crees: number;
  frequence_hebdo: number;
  connexions: number;
}

export const StaffPerformance = () => {
  const [activeTab, setActiveTab] = useState<'livreurs' | 'agents' | 'produits'>('livreurs');
  const [livreurStats, setLivreurStats] = useState<StaffStats[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [productCreatorStats, setProductCreatorStats] = useState<ProductCreatorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('month');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [users, allCmds, allProds, loginsRes] = await Promise.allSettled([
          getUtilisateurs(),
          getCommandes(),
          getProduits(),
          insforge.database.from('audit_logins').select('*')
        ]);
        const allLogins = loginsRes.status === 'fulfilled' ? (loginsRes.value.data || []) : [];
        const users_data = users.status === 'fulfilled' ? users.value : [];
        const cmds_data = allCmds.status === 'fulfilled' ? allCmds.value : [];
        const prods_data = allProds.status === 'fulfilled' ? allProds.value : [];

        const now = new Date();
        const startOfInterval = timeFilter === 'today' ? startOfDay(now) : 
                              timeFilter === 'week' ? subDays(now, 7) : 
                              timeFilter === 'month' ? subDays(now, 30) : 
                              new Date(0);

        // --- 1. Calculate Livreur Stats ---
        const livreurs = users_data.filter(u => u.role === 'LIVREUR' || u.role === 'AGENT_MIXTE');
        const ordersByLivreur: Record<string, Commande[]> = {};
        cmds_data.forEach(c => {
          if (c.livreur_id) {
            if (!ordersByLivreur[c.livreur_id]) ordersByLivreur[c.livreur_id] = [];
            ordersByLivreur[c.livreur_id].push(c);
          }
        });

        const lStats: StaffStats[] = livreurs.map(l => {
          const lCmds = (ordersByLivreur[l.id] || []).filter(c => {
            const isSucces = ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase());
            const activeDate = (isSucces && c.date_livraison_effective) ? new Date(c.date_livraison_effective) : new Date(c.date_creation);
            return isAfter(activeDate, startOfInterval);
          });
          
          const logStats = calculateLogisticalStats(lCmds);
          const ca_livraison = lCmds.reduce((acc, c) => 
            acc + (['livree', 'terminee'].includes(c.statut_commande) ? (Number(c.frais_livraison) || 0) : 0)
          , 0);

          return {
            id: l.id,
            nom: l.nom_complet,
            total_cmds: logStats.total_sortis,
            livrees: logStats.livrees,
            retours: logStats.retours,
            annulees: logStats.annulees,
            reportees: logStats.reportees,
            ca_livraison,
            taux_succes: logStats.taux_succes
          };
        }).sort((a, b) => b.taux_succes - a.taux_succes);

        // --- 2. Calculate Agent Stats ---
        const agents = users_data.filter(u => u.role === 'AGENT_APPEL' || u.role === 'AGENT_MIXTE' || u.role === 'GESTIONNAIRE');
        const ordersByAgent: Record<string, Commande[]> = {};
        cmds_data.forEach(c => {
          if (c.agent_appel_id) {
            if (!ordersByAgent[c.agent_appel_id]) ordersByAgent[c.agent_appel_id] = [];
            ordersByAgent[c.agent_appel_id].push(c);
          }
        });

        const aStats: AgentStats[] = agents.map(a => {
          const aCmds = (ordersByAgent[a.id] || []).filter(c => isAfter(new Date(c.date_creation), startOfInterval));
          const total = aCmds.length;
          // Validées = agent a confirmé la commande avec le client
          const validees = aCmds.filter(c => ['validee', 'en_cours_livraison', 'livree', 'terminee', 'retour_livreur', 'absent', 'echouee', 'retour_stock', 'retour_client'].includes(c.statut_commande?.toLowerCase())).length;
          // Livrées = commande effectivement remise au client et payée
          const livrees = aCmds.filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase())).length;
          // Retours = livreur a tenté mais n'a pas pu livrer
          const retours = aCmds.filter(c => ['retour_livreur', 'retour_stock', 'retour_client'].includes(c.statut_commande?.toLowerCase())).length;
          // Echecs livraison
          const echecs = aCmds.filter(c => ['echouee', 'absent'].includes(c.statut_commande?.toLowerCase())).length;
          // Reprogrammées = à rappeler
          const reprogrammees = aCmds.filter(c => c.statut_commande?.toLowerCase() === 'a_rappeler').length;
          // Annulées = client a refusé ou injoignable définitivement
          const annulees = aCmds.filter(c => c.statut_commande?.toLowerCase() === 'annulee').length;
          const userLogins = allLogins.filter(l => l.user_id === a.id && isAfter(new Date(l.login_time), startOfInterval)).length;
          // Taux de conversion = livrees réelles / total des dossiers traités
          const taux_conversion = total > 0 ? Math.round((livrees / total) * 100) : 0;

          return {
            id: a.id,
            nom: a.nom_complet,
            total_traitees: total,
            validees,
            livrees,
            retours,
            echecs,
            reprogrammees,
            annulees,
            taux_conversion,
            connexions: userLogins
          };
        }).sort((a, b) => b.taux_conversion - a.taux_conversion);

        // --- 3. Calculate Product Creator Stats ---
        const creators = users_data.filter(u => u.role !== 'LIVREUR' && u.role !== 'CAISSIERE');
        const prodsByCreator: Record<string, Produit[]> = {};
        prods_data.forEach(p => {
          if (p.created_by) {
            if (!prodsByCreator[p.created_by]) prodsByCreator[p.created_by] = [];
            prodsByCreator[p.created_by].push(p);
          }
        });

        const pStats: ProductCreatorStats[] = creators.map(c => {
          const cProds = (prodsByCreator[c.id] || []).filter(p => p.created_at && isAfter(new Date(p.created_at), startOfInterval));
          const weeks = Math.max(1, differenceInWeeks(now, startOfInterval));
          const freq = Math.round((cProds.length / weeks) * 10) / 10;
          const userLogins = allLogins.filter(l => l.user_id === c.id && isAfter(new Date(l.login_time), startOfInterval)).length;

          return {
            id: c.id,
            nom: c.nom_complet,
            total_crees: cProds.length,
            frequence_hebdo: freq,
            connexions: userLogins
          };
        }).sort((a, b) => b.total_crees - a.total_crees);

        setLivreurStats(lStats);
        setAgentStats(aStats);
        setProductCreatorStats(pStats);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeFilter]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Analyse de l'activité équipe...</p>
      </div>
    );
  }

  // --- Rendering Helpers ---
  const renderLivreurTable = () => (
    <div className="table-container" style={{ margin: 0 }}>
      <table>
        <thead>
          <tr>
            <th>Livreur</th>
            <th style={{ textAlign: 'center' }}>Sorties</th>
            <th style={{ textAlign: 'center' }}>Livrés</th>
            <th style={{ textAlign: 'center' }}>Retours</th>
            <th style={{ textAlign: 'center' }}>Annulés</th>
            <th style={{ textAlign: 'center' }}>Reports</th>
            <th style={{ textAlign: 'right' }}>Gains Livr.</th>
          </tr>
        </thead>
        <tbody>
          {livreurStats.map((s) => (
            <tr key={s.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                    {s.nom.charAt(0)}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{s.nom}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: s.taux_succes > 80 ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                      {s.taux_succes}% réussite
                    </div>
                  </div>
                </div>
              </td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.total_cmds}</td>
              <td style={{ textAlign: 'center' }}>
                <span className="badge badge-success" style={{ padding: '0.2rem 0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>{s.livrees}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span className="badge badge-info" style={{ padding: '0.2rem 0.5rem', background: 'rgba(99, 102, 255, 0.1)', color: 'var(--primary)' }}>{s.retours}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span className="badge badge-danger" style={{ padding: '0.2rem 0.5rem', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>{s.annulees}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span className="badge badge-warning" style={{ padding: '0.2rem 0.5rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>{s.reportees}</span>
              </td>
              <td style={{ textAlign: 'right', fontWeight: 800 }}>
                <div style={{ whiteSpace: 'nowrap' }}>{s.ca_livraison.toLocaleString()} CFA</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderAgentTable = () => (
    <div className="table-container" style={{ margin: 0 }}>
      <table>
        <thead>
          <tr>
            <th>Agent d'Appel</th>
            <th style={{ textAlign: 'center' }}>📋 Traitées</th>
            <th style={{ textAlign: 'center' }}>✔️ Validées</th>
            <th style={{ textAlign: 'center' }}>✅ Livrées</th>
            <th style={{ textAlign: 'center' }}>📦 Retours</th>
            <th style={{ textAlign: 'center' }}>❌ Échecs</th>
            <th style={{ textAlign: 'center' }}>🔄 Reprog.</th>
            <th style={{ textAlign: 'center' }}>🚫 Annulées</th>
            <th style={{ textAlign: 'center' }}>🔌 Connexions</th>
            <th style={{ textAlign: 'right' }}>Taux Conversion</th>
          </tr>
        </thead>
        <tbody>
          {agentStats.map((s) => (
            <tr key={s.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#6366f1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                    {s.nom.charAt(0)}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{s.nom}</p>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: s.taux_conversion > 60 ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                      {s.taux_conversion}% de conversion réelle
                    </p>
                  </div>
                </div>
              </td>
              <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '1rem' }}>{s.total_traitees}</td>
              <td style={{ textAlign: 'center' }}>
                <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 700, borderRadius: '8px', fontSize: '0.85rem' }}>{s.validees}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(5, 150, 105, 0.15)', color: '#059669', fontWeight: 800, borderRadius: '8px', fontSize: '0.85rem', border: '1px solid rgba(5,150,105,0.3)' }}>{s.livrees}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', fontWeight: 700, borderRadius: '8px', fontSize: '0.85rem' }}>{s.retours}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', fontWeight: 700, borderRadius: '8px', fontSize: '0.85rem' }}>{s.echecs}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontWeight: 700, borderRadius: '8px', fontSize: '0.85rem' }}>{s.reprogrammees}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(244, 63, 94, 0.07)', color: '#dc2626', fontWeight: 700, borderRadius: '8px', fontSize: '0.85rem' }}>{s.annulees}</span>
              </td>
              <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>{s.connexions}</td>
              <td style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', color: s.taux_conversion > 60 ? '#10b981' : s.taux_conversion > 40 ? '#f59e0b' : '#f43f5e' }}>
                  {s.taux_conversion}%
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderProductTable = () => (
    <div className="table-container" style={{ margin: 0 }}>
      <table>
        <thead>
          <tr>
            <th>Gestionnaire / Staff</th>
            <th style={{ textAlign: 'center' }}>Produits Créés</th>
            <th style={{ textAlign: 'center' }}>Connexions</th>
            <th style={{ textAlign: 'right' }}>Fréquence Hebdo</th>
          </tr>
        </thead>
        <tbody>
          {productCreatorStats.map((s) => (
            <tr key={s.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#a855f7', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                    {s.nom.charAt(0)}
                  </div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{s.nom}</p>
                </div>
              </td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.total_crees}</td>
              <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>{s.connexions}</td>
              <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                {s.frequence_hebdo} items <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/semaine</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Target size={36} color="var(--primary)" strokeWidth={2.5} />
            Hub Performance Équipe
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Suivez l'efficacité opérationnelle de tous les départements.
          </p>
        </div>
        
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.5)', padding: '0.4rem', borderRadius: '14px', border: '1px solid #e2e8f0', backdropFilter: 'blur(10px)' }}>
          {(['month', 'week', 'today', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '10px',
                border: 'none',
                background: timeFilter === f ? 'var(--primary)' : 'transparent',
                color: timeFilter === f ? 'white' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                textTransform: 'capitalize'
              }}
            >
              {f === 'month' ? 'Ce mois' : f === 'week' ? '7 jours' : f === 'today' ? 'Aujourd\'hui' : 'Toujours'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '1rem' }}>
        <button 
          onClick={() => setActiveTab('livreurs')}
          className={`card ${activeTab === 'livreurs' ? 'glass-effect active-tab' : ''}`}
          style={{ 
            flex: 1, minWidth: '200px', cursor: 'pointer', border: activeTab === 'livreurs' ? '2px solid var(--primary)' : '1px solid #e2e8f0',
            background: activeTab === 'livreurs' ? 'rgba(99, 102, 255, 0.05)' : 'white',
            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem'
          }}
        >
          <div style={{ background: 'rgba(99, 102, 255, 0.1)', color: 'var(--primary)', padding: '0.75rem', borderRadius: '12px' }}>
            <Truck size={24} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Logistique</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Livraisons & Retours</div>
          </div>
        </button>

        <button 
          onClick={() => setActiveTab('agents')}
          className={`card ${activeTab === 'agents' ? 'glass-effect active-tab' : ''}`}
          style={{ 
            flex: 1, minWidth: '200px', cursor: 'pointer', border: activeTab === 'agents' ? '2px solid #6366f1' : '1px solid #e2e8f0',
            background: activeTab === 'agents' ? 'rgba(99, 102, 255, 0.05)' : 'white',
            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem'
          }}
        >
          <div style={{ background: 'rgba(99, 102, 255, 0.1)', color: '#6366f1', padding: '0.75rem', borderRadius: '12px' }}>
            <PhoneCall size={24} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Centre d'Appel</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Validations & Relances</div>
          </div>
        </button>

        <button 
          onClick={() => setActiveTab('produits')}
          className={`card ${activeTab === 'produits' ? 'glass-effect active-tab' : ''}`}
          style={{ 
            flex: 1, minWidth: '200px', cursor: 'pointer', border: activeTab === 'produits' ? '2px solid #a855f7' : '1px solid #e2e8f0',
            background: activeTab === 'produits' ? 'rgba(168, 85, 247, 0.05)' : 'white',
            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem'
          }}
        >
          <div style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '0.75rem', borderRadius: '12px' }}>
            <ShoppingBag size={24} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Inventaire</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Création de Produits</div>
          </div>
        </button>
      </div>

      <div className="card glass-effect" style={{ padding: '0', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Détails des Performances : {activeTab === 'livreurs' ? 'Logistique' : activeTab === 'agents' ? 'Centre d\'Appel' : 'Inventaire'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
             <Award size={16} color="var(--primary)" />
             Classé par efficacité
          </div>
        </div>
        
        {activeTab === 'livreurs' && renderLivreurTable()}
        {activeTab === 'agents' && renderAgentTable()}
        {activeTab === 'produits' && renderProductTable()}
      </div>

      {activeTab === 'livreurs' && livreurStats.length > 0 && (
         <div className="card glass-effect" style={{ marginTop: '2rem', padding: '2rem' }}>
           <h3 style={{ margin: '0 0 2rem 0', fontSize: '1.2rem', fontWeight: 800 }}>Impact Livraison (Succès %)</h3>
           <div style={{ height: '300px' }}>
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={livreurStats}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="nom" tick={{fontSize: 10, fontWeight: 700}} />
                 <YAxis domain={[0, 100]} />
                 <Tooltip />
                 <Bar dataKey="taux_succes" fill="var(--primary)" radius={[8, 8, 0, 0]} barSize={40}>
                   {livreurStats.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.taux_succes > 80 ? '#10b981' : '#6366f1'} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
         </div>
      )}
    </div>
  );
};
