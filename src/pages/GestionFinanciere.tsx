import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, Download, Activity, Sparkles, Loader2, BrainCircuit } from 'lucide-react';
import { getFinancialData } from '../services/commandeService';
import { getDepenses } from '../services/financialService';
import { getFournisseurs } from '../services/fournisseurService';
import { insforge } from '../lib/insforge';
import { useToast } from '../contexts/ToastContext';

export const GestionFinanciere = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [aiForecast, setAiForecast] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [finances, setFinances] = useState<any>({
    soldeActuel: 0,
    creances: 0,
    dettes: 0,
    tresorerieNette: 0,
    cashflowMensuel: []
  });

  const generateAIForecast = async () => {
    setIsGenerating(true);
    try {
      const summary = {
        solde: finances.soldeActuel,
        creances: finances.creances,
        dettes: finances.dettes,
        tresorerieNette: finances.tresorerieNette,
        encaisses: finances.encaisses,
        sorties: finances.sorties
      };
      
      const prompt = `Agis comme un directeur financier pour une PME ivoirienne. Voici mes finances actuelles : ${JSON.stringify(summary)}. Fais une prévision de trésorerie très courte et concrète pour la fin du mois. Dis-moi si je risque un découvert ou si je peux investir. Sois très bref, utilise des bullet points et du texte riche.`;
      
      const completion = await insforge.ai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [{ role: 'user', content: prompt }]
      });

      setAiForecast(completion.choices[0].message.content.trim());
      showToast('Prévisionnel généré !', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erreur IA', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const fetchFinance = async () => {
      try {
        const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const end = new Date().toISOString().split('T')[0];

        const [commandes, depenses, fournisseurs] = await Promise.all([
          getFinancialData(start, end).catch(() => []),
          getDepenses().catch(() => []),
          getFournisseurs().catch(() => [])
        ]);

        // Calculs simplifiés (Bilan & Trésorerie PME)
        let encaisses = 0;
        let creances = 0; // Commandes validées mais non encaissées
        commandes.forEach((c: any) => {
          if (c.statut_commande === 'livree') encaisses += Number(c.montant_total || 0);
          else if (['validee', 'en_cours_livraison'].includes(c.statut_commande)) {
            creances += Number(c.montant_total || 0);
          }
        });

        let sorties = 0;
        let dettes = 0; 
        depenses.forEach((d: any) => {
          sorties += Number(d.montant || 0);
        });
        
        fournisseurs.forEach((f: any) => {
          dettes += Number(f.solde_dette || 0);
        });

        const soldeActuel = encaisses - sorties;
        const tresorerieNette = soldeActuel + creances - dettes;

        setFinances({
          soldeActuel,
          creances,
          dettes,
          tresorerieNette,
          encaisses,
          sorties
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchFinance();
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement financier...</div>;
  }

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
            Gestion Financière PME
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>
            Vision globale de votre trésorerie, créances clients et dettes fournisseurs.
          </p>
        </div>
        <button className="btn btn-outline" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Download size={18} /> Exporter le Bilan
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ padding: '0.8rem', background: '#ecfdf5', borderRadius: '12px', color: '#10b981' }}><Wallet size={24} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Solde de Trésorerie Actuel</p>
              <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#10b981' }}>{Number(finances.soldeActuel.toFixed(0)).toLocaleString()} CFA</h2>
            </div>
          </div>
        </div>
        
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ padding: '0.8rem', background: '#eff6ff', borderRadius: '12px', color: '#3b82f6' }}><TrendingUp size={24} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Créances (À encaisser)</p>
              <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#3b82f6' }}>{Number(finances.creances.toFixed(0)).toLocaleString()} CFA</h2>
            </div>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ padding: '0.8rem', background: '#fef2f2', borderRadius: '12px', color: '#ef4444' }}><TrendingDown size={24} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Dettes (À payer)</p>
              <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#ef4444' }}>{Number(finances.dettes.toFixed(0)).toLocaleString()} CFA</h2>
            </div>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', background: '#0f172a', color: 'white', border: 'none' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }}><Activity size={24} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8, fontWeight: 600 }}>Trésorerie Nette Projetée</p>
              <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: 'white' }}>{Number(finances.tresorerieNette.toFixed(0)).toLocaleString()} CFA</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="res-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card glass-effect" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BrainCircuit size={20} color="#8b5cf6" /> 
              Prévisionnel de Trésorerie IA
            </h3>
            <button 
              className="btn" 
              onClick={generateAIForecast}
              disabled={isGenerating}
              style={{ 
                background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', 
                color: 'white', 
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderRadius: '8px',
                fontWeight: 700
              }}
            >
              {isGenerating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              {aiForecast ? 'Actualiser' : 'Générer prévisionnel'}
            </button>
          </div>
          
          {aiForecast ? (
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#334155', lineHeight: 1.6 }}>
              {aiForecast.split('\n').map((line, i) => {
                if (line.startsWith('### ')) return <h4 key={i} style={{ margin: '1rem 0 0.5rem 0', color: '#1e293b' }}>{line.replace('### ', '')}</h4>;
                if (line.startsWith('## ')) return <h3 key={i} style={{ margin: '1rem 0 0.5rem 0', color: '#1e293b' }}>{line.replace('## ', '')}</h3>;
                if (line.startsWith('# ')) return <h2 key={i} style={{ margin: '1.5rem 0 0.5rem 0', color: '#0f172a' }}>{line.replace('# ', '')}</h2>;
                if (line.startsWith('- ')) return <li key={i} style={{ marginLeft: '1.5rem', marginBottom: '0.5rem' }}>{line.replace('- ', '')}</li>;
                if (line.startsWith('* ')) return <li key={i} style={{ marginLeft: '1.5rem', marginBottom: '0.5rem' }}>{line.replace('* ', '')}</li>;
                if (line.trim() === '') return <br key={i} />;
                return <p key={i} style={{ margin: '0 0 0.5rem 0' }}>{line}</p>;
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>+ Ventes en cours de livraison</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Encaissement prévu sous 24-48h</div>
                </div>
                <div style={{ fontWeight: 900, color: '#10b981' }}>+ {Number(finances.creances).toLocaleString()}</div>
              </div>
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>- Achats fournisseurs (Estimation)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Règlement attendu cette semaine</div>
                </div>
                <div style={{ fontWeight: 900, color: '#ef4444' }}>- {Number(finances.dettes).toLocaleString()}</div>
              </div>
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>- Charges fixes mensuelles (Salaires, Loyers)</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Prochaine échéance le 30</div>
                </div>
                <div style={{ fontWeight: 900, color: '#ef4444' }}>- 250,000</div>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '2px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 900, fontSize: '1.2rem', color: '#0f172a' }}>Solde Projeté Fin de Semaine</div>
                <div style={{ fontWeight: 900, fontSize: '1.4rem', color: (finances.soldeActuel + finances.creances - finances.dettes - 250000) > 0 ? '#10b981' : '#ef4444' }}>
                  {Number(finances.soldeActuel + finances.creances - finances.dettes - 250000).toLocaleString()} CFA
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card glass-effect" style={{ padding: '2rem' }}>
          <h3 style={{ margin: '0 0 1.5rem 0' }}>Bilan Simplifié PME</h3>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ borderRight: '1px solid #e2e8f0', padding: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={16} /> ACTIF (Ce que l'on possède)</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Trésorerie</span>
                  <span style={{ fontWeight: 700 }}>{Number(finances.soldeActuel).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Créances Clients</span>
                  <span style={{ fontWeight: 700 }}>{Number(finances.creances).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Stock (Valorisation)</span>
                  <span style={{ fontWeight: 700 }}>...</span>
                </div>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingDown size={16} /> PASSIF (Ce que l'on doit)</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Dettes Fournisseurs</span>
                  <span style={{ fontWeight: 700 }}>{Number(finances.dettes).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Dettes Fiscales</span>
                  <span style={{ fontWeight: 700 }}>0</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Capitaux Propres</span>
                  <span style={{ fontWeight: 700 }}>{Number(finances.tresorerieNette).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #e2e8f0', fontWeight: 900 }}>
              <div>Total Actif: {Number(finances.soldeActuel + finances.creances).toLocaleString()}</div>
              <div>Total Passif: {Number(finances.dettes + finances.tresorerieNette).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
