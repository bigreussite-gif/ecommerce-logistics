import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, Download, Sparkles, Loader2, BrainCircuit, Calendar, PieChart } from 'lucide-react';
import { getFinancialData } from '../services/commandeService';
import { getDepenses, calculateProfitMetrics, calculateStockValue } from '../services/financialService';
import { getFournisseurs } from '../services/fournisseurService';
import { getProduits } from '../services/produitService';
import { insforge } from '../lib/insforge';
import { useToast } from '../contexts/ToastContext';
import { startOfMonth, endOfMonth, subDays, format } from 'date-fns';

export const GestionFinanciere = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [aiForecast, setAiForecast] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [period, setPeriod] = useState<'today' | 'yesterday' | '7d' | '30d' | 'month'>('month');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [finances, setFinances] = useState<any>({
    soldeActuel: 0,
    creances: 0,
    dettes: 0,
    tresorerieNette: 0,
    encaisses: 0,
    sorties: 0,
    depensesByCategory: [],
    profitNet: 0,
    stockVal: 0
  });

  const setRange = (preset: 'today' | 'yesterday' | '7d' | '30d' | 'month') => {
    let s = new Date();
    let e = new Date();
    if (preset === 'yesterday') {
      s = subDays(new Date(), 1);
      e = subDays(new Date(), 1);
    } else if (preset === '7d') {
      s = subDays(new Date(), 7);
    } else if (preset === '30d') {
      s = subDays(new Date(), 30);
    } else if (preset === 'month') {
      s = startOfMonth(new Date());
      e = endOfMonth(new Date());
    }
    setPeriod(preset);
    setStartDate(format(s, 'yyyy-MM-dd'));
    setEndDate(format(e, 'yyyy-MM-dd'));
  };

  const generateAIForecast = async () => {
    setIsGenerating(true);
    try {
      const summary = {
        solde: finances.soldeActuel,
        creances: finances.creances,
        dettes: finances.dettes,
        tresorerieNette: finances.tresorerieNette,
        encaisses: finances.encaisses,
        sorties: finances.sorties,
        profitNet: finances.profitNet
      };
      
      const prompt = `Agis comme un directeur financier pour une PME ivoirienne. Voici mes finances pour la période sélectionnée : ${JSON.stringify(summary)}. Fais une prévision de trésorerie courte et concrète, et donne un conseil sur le bénéfice actuel. Dis-moi si je risque un découvert ou si je peux investir. Utilise des bullet points et du texte riche (gras).`;
      
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

  const fetchFinance = async () => {
    setLoading(true);
    try {
      const [commandes, depenses, fournisseurs, produits] = await Promise.all([
        getFinancialData(startDate, endDate).catch(() => []),
        getDepenses().catch(() => []),
        getFournisseurs().catch(() => []),
        getProduits().catch(() => [])
      ]);

      const start = new Date(startDate); start.setHours(0,0,0,0);
      const end = new Date(endDate); end.setHours(23,59,59,999);
      
      const filteredDepenses = depenses.filter((d: any) => {
        const dDate = new Date(d.date);
        return dDate >= start && dDate <= end;
      });

      let encaisses = 0;
      let creances = 0; 
      commandes.forEach((c: any) => {
        if (['livree', 'terminee'].includes(c.statut_commande)) encaisses += Number(c.montant_total || 0);
        else if (['validee', 'en_cours_livraison'].includes(c.statut_commande)) creances += Number(c.montant_total || 0);
      });

      let sorties = 0;
      const catMap: Record<string, number> = {};
      filteredDepenses.forEach((d: any) => {
        const amt = Number(d.montant || 0);
        sorties += amt;
        catMap[d.categorie] = (catMap[d.categorie] || 0) + amt;
      });
      
      const depensesByCategory = Object.entries(catMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      let dettes = 0; 
      fournisseurs.forEach((f: any) => dettes += Number(f.solde_dette || 0));

      const soldeActuel = encaisses - sorties;
      const tresorerieNette = soldeActuel + creances - dettes;
      const stockVal = calculateStockValue(produits);
      
      const metrics = calculateProfitMetrics(commandes, filteredDepenses);

      setFinances({
        soldeActuel,
        creances,
        dettes,
        tresorerieNette,
        encaisses,
        sorties,
        depensesByCategory,
        profitNet: metrics.profit_net_reel,
        stockVal
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinance();
  }, [startDate, endDate]);

  if (loading && finances.soldeActuel === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement financier...</div>;
  }

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
            Gestion Financière PME
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>
            Vision globale de votre trésorerie et analyse des fuites d'argent.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="filter-group">
            <button className={period === 'today' ? 'active' : ''} onClick={() => setRange('today')}>Aujourd'hui</button>
            <button className={period === '7d' ? 'active' : ''} onClick={() => setRange('7d')}>7 Jours</button>
            <button className={period === 'month' ? 'active' : ''} onClick={() => setRange('month')}>Ce Mois</button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Calendar size={18} color="var(--text-muted)" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" style={{ padding: '0.5rem' }} />
            <span style={{ color: 'var(--text-muted)' }}>-</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" style={{ padding: '0.5rem' }} />
          </div>
          <button className="btn btn-outline" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Download size={18} /> Exporter
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ padding: '0.8rem', background: '#ecfdf5', borderRadius: '12px', color: '#10b981' }}><Wallet size={24} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Flux de Trésorerie</p>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>{Number(finances.soldeActuel.toFixed(0)).toLocaleString()} CFA</h2>
            </div>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ padding: '0.8rem', background: '#f5f3ff', borderRadius: '12px', color: '#8b5cf6' }}><TrendingUp size={24} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Bénéfice Net Période</p>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#8b5cf6' }}>{Number(finances.profitNet.toFixed(0)).toLocaleString()} CFA</h2>
            </div>
          </div>
        </div>
        
        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ padding: '0.8rem', background: '#eff6ff', borderRadius: '12px', color: '#3b82f6' }}><TrendingUp size={24} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Créances (À encaisser)</p>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#3b82f6' }}>{Number(finances.creances.toFixed(0)).toLocaleString()} CFA</h2>
            </div>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '1.5rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ padding: '0.8rem', background: '#fef2f2', borderRadius: '12px', color: '#ef4444' }}><TrendingDown size={24} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Dettes (À payer)</p>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#ef4444' }}>{Number(finances.dettes.toFixed(0)).toLocaleString()} CFA</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="res-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Analyse des fuites d'argent */}
          <div className="card glass-effect" style={{ padding: '2rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <PieChart size={20} color="#f97316" /> Fuite d'Argent (Répartition des Dépenses)
            </h3>
            
            {finances.depensesByCategory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {finances.depensesByCategory.map((d: any, i: number) => {
                  const percent = finances.sorties > 0 ? (d.value / finances.sorties) * 100 : 0;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{d.name}</span>
                        <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{d.value.toLocaleString()} CFA</span>
                      </div>
                      <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${percent}%`, background: i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#3b82f6' }}></div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {percent.toFixed(1)}% des sorties
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Aucune dépense enregistrée sur cette période.
              </div>
            )}
            
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Total Sorties</div>
              <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#ef4444' }}>{finances.sorties.toLocaleString()} CFA</div>
            </div>
          </div>
          
          <div className="card glass-effect" style={{ padding: '2rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0' }}>Bilan Simplifié PME</h3>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ borderRight: '1px solid #e2e8f0', padding: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={16} /> ACTIF</h4>
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
                    <span style={{ fontWeight: 700 }}>{Number(finances.stockVal).toLocaleString()}</span>
                  </div>
                </div>
                <div style={{ padding: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingDown size={16} /> PASSIF</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Dettes Fournisseurs</span>
                    <span style={{ fontWeight: 700 }}>{Number(finances.dettes).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Capitaux Propres</span>
                    <span style={{ fontWeight: 700 }}>{Number(finances.tresorerieNette).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '1rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #e2e8f0', fontWeight: 900 }}>
                <div>Total Actif: {Number(finances.soldeActuel + finances.creances + finances.stockVal).toLocaleString()}</div>
                <div>Total Passif: {Number(finances.dettes + finances.tresorerieNette + finances.stockVal).toLocaleString()}</div>
              </div>
            </div>
          </div>

        </div>

        <div className="card glass-effect" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BrainCircuit size={20} color="#8b5cf6" /> 
              Prévisionnel & Recommandations IA
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
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#334155', lineHeight: 1.6, flex: 1 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              <div style={{ padding: '2rem', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Cliquez sur le bouton ci-dessus pour générer une analyse par intelligence artificielle de vos finances et identifier les leviers d'optimisation (comme vos marges à 50%).
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
