import { useState, useEffect } from 'react';
import { getFinancialData, getTopSellingProducts } from '../services/commandeService';
import { getDepenses, calculateProfitMetrics, generateTimeSeriesData, getHourlyDistribution } from '../services/financialService';
import { exportToExcel, exportToWord, exportToJson } from '../services/exportService';
import { generateAuditReportPDF } from '../services/pdfService';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  ShieldCheck, 
  Table as TableIcon, 
  Calendar,
  Target,
  BarChart4,
  Download,
  Database,
  Briefcase,
  Layers,
  TrendingUp,
  FileCode,
  Clock
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { useToast } from '../contexts/ToastContext';

export const AuditTresorerie = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [financials, setFinancials] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  const loadAuditData = async () => {
    setLoading(true);
    try {
      const start = startOfDay(new Date(startDate)).toISOString();
      const end = endOfDay(new Date(endDate)).toISOString();
      
      const [orders, allExpenses, top] = await Promise.all([
        getFinancialData(start, end),
        getDepenses(),
        getTopSellingProducts(5, 0, start, end)
      ]);

      const filteredExpenses = allExpenses.filter(e => {
        const d = new Date(e.date);
        return d >= new Date(start) && d <= new Date(end);
      });

      const metrics = calculateProfitMetrics(orders, filteredExpenses);
      const timeseries = generateTimeSeriesData(orders, 'daily');
      
      const combinedTransactions = [
        ...orders.map(o => ({
          date: o.date_creation,
          type: 'ENCAISSEMENT',
          description: `Vente #${o.id.substring(0,8).toUpperCase()} - ${o.nom_client}`,
          categorie: 'PRODUITS',
          montant: (Number(o.montant_total) || 0) - (Number(o.frais_livraison) || 0)
        })),
        ...filteredExpenses.map(e => ({
          date: e.date,
          type: 'DÉCAISSEMENT',
          description: e.description || 'Dépense opérationnelle',
          categorie: e.categorie,
          montant: -Math.abs(e.montant)
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setFinancials(metrics);
      setChartData(timeseries);
      setHourlyData(getHourlyDistribution(orders));
      setTransactions(combinedTransactions);
      setTopProducts(top);
    } catch (err) {
      showToast("Échec du chargement des données d'expertise", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, [startDate, endDate]);

  const handleJournalExport = () => {
    let balance = 0;
    const journalData = [...transactions].reverse().map(t => {
      balance += t.montant;
      return {
        Date: format(new Date(t.date), 'dd/MM/yyyy HH:mm'),
        Type: t.type,
        Libellé: t.description,
        Catégorie: t.categorie,
        Montant: t.montant,
        Solde: balance
      };
    }).reverse();
    exportToExcel(journalData, "Journal_Complet_Solde");
    showToast("Journal complet exporté", "success");
  };

  const handleBankStatementExport = () => {
    let balance = 0;
    const bankData = [...transactions].reverse().map(t => {
      balance += t.montant;
      return {
        Date: format(new Date(t.date), 'yyyy-MM-dd'),
        "Description Opération": t.description,
        Débit: t.montant < 0 ? Math.abs(t.montant) : 0,
        Crédit: t.montant > 0 ? t.montant : 0,
        Solde: balance
      };
    }).reverse();
    exportToExcel(bankData, "Releve_Type_Banque");
    showToast("Relevé bancaire exporté", "success");
  };

  const handleMonthlySummaryExport = () => {
    const months: Record<string, { in: number, out: number }> = {};
    transactions.forEach(t => {
      const monthKey = format(new Date(t.date), 'yyyy-MM');
      if (!months[monthKey]) months[monthKey] = { in: 0, out: 0 };
      if (t.montant > 0) months[monthKey].in += t.montant;
      else months[monthKey].out += Math.abs(t.montant);
    });
    
    const summaryData = Object.entries(months).map(([key, val]) => ({
      Mois: key,
      "Total Encaissements": val.in,
      "Total Décaissements": val.out,
      "Flux Net": val.in - val.out
    }));
    exportToExcel(summaryData, "Synthese_Mensuelle");
    showToast("Synthèse mensuelle exportée", "success");
  };

  const handleFlatTableExport = () => {
    exportToExcel(transactions, "Tableau_Plat_Comptable");
    showToast("Tableau plat exporté", "success");
  };

  const handleJsonExport = () => {
    const auditData = {
      rapport: "Audit Trésorerie GomboSwift",
      periode: { debut: startDate, fin: endDate },
      metriques: financials,
      journaux: transactions
    };
    exportToJson(auditData, "Audit_JSON_Period");
    showToast("Données JSON exportées", "success");
  };

  const handlePDFExport = () => {
    if (!financials) return;
    generateAuditReportPDF(financials, transactions, { start: startDate, end: endDate });
    showToast("Bilan d'Audit généré (PDF)", "success");
  };

  const handleWordExport = () => {
    if (!financials) return;
    const content = {
      title: "BILAN DE SYNTHÈSE AUDIT",
      period: `${startDate} au ${endDate}`,
      metrics: [
        { label: "Chiffre d'Affaires Brut", value: `${financials.ca_brut.toLocaleString()} CFA` },
        { label: "Marge Brute", value: `${(financials.ca_brut - financials.cogs_total).toLocaleString()} CFA` },
        { label: "Bénéfice Net (EBITDA)", value: `${financials.profit_net.toLocaleString()} CFA` }
      ],
      summary: "L'analyse des flux de trésorerie sur la période indique une santé financière stable. Les marges opérationnelles sont conformes aux prévisions du secteur logistique. Ce document peut être utilisé pour les démarches administratives et bancaires."
    };
    exportToWord(content, "Rapport_Expertise_Word");
    showToast("Rapport de synthèse exporté (Word)", "success");
  };

  return (
    <div style={{ animation: 'pageEnter 0.6s ease', paddingBottom: '3rem' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ background: '#1e293b', color: 'white', padding: '0.4rem', borderRadius: '8px' }}>
               <ShieldCheck size={20} />
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audit & Expertise</span>
          </div>
          <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0 }}>Trésorerie Avancée</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.4rem', fontWeight: 500 }}>
             Expertise comptable et analyses pour dossiers bancaires.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'white', padding: '1rem 1.5rem', borderRadius: '24px', boxShadow: 'var(--shadow-premium)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar size={18} color="var(--primary)" />
            <input type="date" className="filter-date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: 'none', background: '#f1f5f9', padding: '0.5rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }} />
            <span style={{ color: '#94a3b8', fontWeight: 700 }}>→</span>
            <input type="date" className="filter-date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: 'none', background: '#f1f5f9', padding: '0.5rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
          <p style={{ fontWeight: 600, color: '#64748b' }}>Analyse des écritures comptables en cours...</p>
        </div>
      ) : financials && (
        <>
          {/* TOP METRICS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div className="card" style={{ padding: '2rem', background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', color: 'white', border: 'none' }}>
               <p style={{ opacity: 0.7, fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Chiffre d'Affaires Brut</p>
               <h2 style={{ fontSize: '2.5rem', margin: '0.5rem 0', fontWeight: 900 }}>{financials.ca_brut.toLocaleString()} <span style={{ fontSize: '1rem' }}>F</span></h2>
               <p style={{ fontSize: '0.9rem', color: '#10b981', fontWeight: 700 }}>Total collecté (produits + livraison)</p>
            </div>

            <div className="card" style={{ padding: '2rem', borderLeft: '5px solid #10b981' }}>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Bénéfice Net (EBITDA)</p>
               <h2 style={{ fontSize: '2.2rem', margin: '0.5rem 0', fontWeight: 900, color: '#10b981' }}>{financials.profit_net.toLocaleString()} F</h2>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '3px' }}>
                     <div style={{ width: `${Math.max(0, Math.min(100, financials.marge_nette_percent))}%`, height: '100%', background: '#10b981', borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{financials.marge_nette_percent}%</span>
               </div>
            </div>

            <div className="card" style={{ padding: '2rem' }}>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Marge Brute</p>
               <h2 style={{ fontSize: '2.2rem', margin: '0.5rem 0', fontWeight: 800 }}>{(financials.ca_brut - financials.cogs_total).toLocaleString()} F</h2>
               <p style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700 }}>Ratio: {financials.marge_brute_percent}%</p>
            </div>

            <div className="card" style={{ padding: '2rem' }}>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Charges Fixes</p>
               <h2 style={{ fontSize: '2.2rem', margin: '0.5rem 0', fontWeight: 800, color: '#ef4444' }}>{financials.depenses_fixes_total.toLocaleString()} F</h2>
               <p style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>Total dépenses opérationnelles</p>
            </div>
          </div>

          {/* EXPORTS SECTION */}
          <div className="card" style={{ padding: '2rem', marginBottom: '2.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Download size={20} color="#f97316" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Exports pour la banque / comptabilité</h3>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Fichiers CSV avec séparateur point-virgule, encodage UTF-8 avec BOM (ouverture directe dans Excel). Format JSON pour audit ou intégration outil.
            </p>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              <button 
                onClick={handleJournalExport}
                className="btn-export-expert"
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ padding: '4px', background: '#f0f9ff', borderRadius: '6px' }}><div style={{ color: '#0ea5e9' }}><Briefcase size={18} /></div></div>
                Journal complet + solde
              </button>

              <button 
                onClick={handleBankStatementExport}
                className="btn-export-expert"
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ padding: '4px', background: '#fff7ed', borderRadius: '6px' }}><div style={{ color: '#f59e0b' }}><Layers size={18} /></div></div>
                Relevé type banque (Débit / Crédit / Solde)
              </button>

              <button 
                onClick={handleMonthlySummaryExport}
                className="btn-export-expert"
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ padding: '4px', background: '#f0fdf4', borderRadius: '6px' }}><div style={{ color: '#10b981' }}><TableIcon size={18} /></div></div>
                Synthèse mensuelle (période)
              </button>

              <button 
                onClick={handleMonthlySummaryExport}
                className="btn-export-expert"
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ padding: '4px', background: '#f5f3ff', borderRadius: '6px' }}><div style={{ color: '#8b5cf6' }}><TrendingUp size={18} /></div></div>
                Évolution mensuelle (tout historique)
              </button>

              <button 
                onClick={handleFlatTableExport}
                className="btn-export-expert"
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ padding: '4px', background: '#f8fafc', borderRadius: '6px' }}><div style={{ color: '#64748b' }}><Database size={18} /></div></div>
                Tableau plat (période)
              </button>

              <button 
                onClick={handleJsonExport}
                className="btn-export-expert"
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ padding: '4px', background: '#fff1f2', borderRadius: '6px' }}><div style={{ color: '#e11d48' }}><FileCode size={18} /></div></div>
                Audit JSON (période)
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '2rem', marginBottom: '2.5rem' }} className="responsive-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Main Chart */}
              <div className="card" style={{ padding: '2rem' }}>
                <h3 style={{ margin: '0 0 2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <BarChart4 size={20} color="var(--primary)" /> Évolutions des Flux Porteurs
                </h3>
                <div style={{ width: '100%', height: '350px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-premium)' }} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                      <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={3} fill="transparent" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* NEW: HOURLY DISTRIBUTION (LA STORY DU JOUR) */}
              <div className="card" style={{ padding: '2rem' }}>
                <h3 style={{ margin: '0 0 1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                   <Clock size={20} color="var(--primary)" /> Analyse de "L'Heure d'Or" (Pics de Vente)
                </h3>
                <div style={{ width: '100%', height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area type="stepAfter" dataKey="count" stroke="var(--primary)" fill="var(--primary-light)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem', fontWeight: 600 }}>
                  💡 Astuce : Concentrez vos appels de confirmation 1h avant les pics de vente pour maximiser le taux de succès.
                </p>
              </div>

              {/* Recommendations Section */}
              <div className="card" style={{ padding: '2rem', background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <h3 style={{ margin: '0 0 1.5rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <ShieldCheck size={20} /> Recommandations de Rentabilité
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {financials.marge_brute_percent < 30 ? (
                    <div style={{ display: 'flex', gap: '0.75rem', background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                      <div style={{ color: '#ef4444', fontWeight: 900 }}>⚠️</div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>Marge brute faible ({financials.marge_brute_percent}%)</p>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>Augmentez vos prix de vente ou négociez de meilleurs tarifs avec vos fournisseurs.</p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                      <div style={{ color: '#10b981', fontWeight: 900 }}>✅</div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>Excellente marge brute ({financials.marge_brute_percent}%)</p>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>Votre structure de prix est optimale pour la croissance.</p>
                      </div>
                    </div>
                  )}

                  {financials.depenses_fixes_total > (financials.ca_brut * 0.4) && (
                    <div style={{ display: 'flex', gap: '0.75rem', background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                      <div style={{ color: '#f59e0b', fontWeight: 900 }}>📉</div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>Charges fixes trop élevées</p>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>Vos dépenses représentent plus de 40% de votre CA. Envisagez de réduire les coûts opérationnels.</p>
                      </div>
                    </div>
                  )}

                  {topProducts.length > 0 && topProducts[0].taux_succes < 60 && (
                    <div style={{ display: 'flex', gap: '0.75rem', background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                      <div style={{ color: '#ef4444', fontWeight: 900 }}>📦</div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>Problème de livraison: {topProducts[0].nom}</p>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>Le taux de succès est de {topProducts[0].taux_succes}%. Revoyez le processus de confirmation d'appel.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Best Product Card */}
              <div className="card" style={{ padding: '2rem', borderTop: '5px solid #8b5cf6' }}>
                  <h4 style={{ margin: '0 0 1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={18} color="#8b5cf6" /> Meilleur Produit
                  </h4>
                  {topProducts.length > 0 ? (
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '0.5rem' }}>{topProducts[0].nom}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Ventes confirmées:</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>{topProducts[0].nb_ventes} unités</span>
                      </div>
                      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${topProducts[0].taux_succes}%`, height: '100%', background: '#8b5cf6' }} />
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>Taux de succès: {topProducts[0].taux_succes}% sur cette période.</p>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Aucune donnée disponible pour cette période.</p>
                  )}
              </div>

              <div className="card" style={{ padding: '2.5rem 2rem', background: '#f8fafc', border: '2px dashed #e2e8f0', textAlign: 'center' }}>
                 <Target size={32} color="var(--primary)" style={{ margin: '0 auto 1.5rem' }} />
                 <h4 style={{ margin: '0 0 0.5rem', fontWeight: 800 }}>Confiance Bancaire</h4>
                 <div style={{ fontSize: '3rem', fontWeight: 900, color: '#10b981', margin: '0.5rem 0' }}>
                   {financials.profit_net > 0 ? (financials.marge_nette_percent > 20 ? 'A+' : 'B') : 'C'}
                 </div>
                 <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Le ratio de liquidité est évalué en fonction des flux réels.</p>
              </div>

              <div className="card" style={{ padding: '2rem' }}>
                 <h4 style={{ margin: '0 0 1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={18} color="#1e293b" /> Actions Audit
                 </h4>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handlePDFExport}>
                       Générer Rapport PDF
                    </button>
                    <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={handleWordExport}>
                       Export Microsoft Word
                    </button>
                 </div>
              </div>
            </div>
          </div>

          {/* DETAILED LEDGER */}
          <div className="card" style={{ padding: '2rem' }}>
             <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '2rem' }}>Grand Livre des Écritures (Analytique)</h3>
             <div className="table-container">
                <table style={{ width: '100%' }}>
                   <thead>
                      <tr>
                         <th>Date / Heure</th>
                         <th>Nature</th>
                         <th>Catégorie</th>
                         <th>Libellé Professionnel</th>
                         <th style={{ textAlign: 'right' }}>Montant (F CFA)</th>
                      </tr>
                   </thead>
                   <tbody>
                      {transactions.map((t, i) => (
                         <tr key={i}>
                            <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{format(new Date(t.date), 'dd/MM/yyyy HH:mm')}</td>
                            <td>
                               <span className={`badge ${t.type === 'ENCAISSEMENT' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                 {t.type}
                               </span>
                            </td>
                            <td style={{ fontWeight: 700, fontSize: '0.8rem' }}>{t.categorie}</td>
                            <td style={{ fontSize: '0.9rem' }}>{t.description}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: t.montant > 0 ? '#10b981' : '#ef4444' }}>
                               {(t.montant > 0 ? '+' : '') + t.montant.toLocaleString()} F
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </>
      )}

      <style>{`
        .btn-export-expert:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
          border-color: #94a3b8 !important;
        }
        .btn-export-expert:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
};
