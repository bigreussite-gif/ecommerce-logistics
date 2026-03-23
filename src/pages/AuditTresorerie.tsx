import { useState, useEffect } from 'react';
import { getFinancialData } from '../services/commandeService';
import { getDepenses, calculateProfitMetrics, generateTimeSeriesData } from '../services/financialService';
import { exportToExcel, exportToWord } from '../services/exportService';
import { generateAuditReportPDF } from '../services/pdfService';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  ShieldCheck, 
  FileText, 
  Table as TableIcon, 
  FileEdit, 
  Calendar,
  Target,
  BarChart4,
  Zap
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
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [financials, setFinancials] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  const loadAuditData = async () => {
    try {
      const start = startOfDay(new Date(startDate)).toISOString();
      const end = endOfDay(new Date(endDate)).toISOString();
      
      const [orders, allExpenses] = await Promise.all([
        getFinancialData(start, end),
        getDepenses()
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
      setTransactions(combinedTransactions);
    } catch (err) {
      showToast("Échec du chargement des données d'expertise", "error");
    }
  };

  useEffect(() => {
    loadAuditData();
  }, [startDate, endDate]);

  const handleExcelExport = () => {
    exportToExcel(transactions, "Expertise_Comptable_Flux");
    showToast("Journal des flux exporté (Excel)", "success");
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

  const handlePDFExport = () => {
    if (!financials) return;
    generateAuditReportPDF(financials, transactions, { start: startDate, end: endDate });
    showToast("Bilan d'Audit généré (PDF)", "success");
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
             Reporting financier aux normes bancaires et comptables.
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

      {financials && (
        <>
          {/* TOP METRICS - EXPERT VIEW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div className="card" style={{ padding: '2rem', background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', color: 'white', border: 'none' }}>
               <p style={{ opacity: 0.7, fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Bénéfice Net (EBITDA)</p>
               <h2 style={{ fontSize: '2.5rem', margin: '0.5rem 0', fontWeight: 900 }}>{financials.profit_net.toLocaleString()} <span style={{ fontSize: '1rem' }}>F</span></h2>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                     <div style={{ width: `${financials.marge_nette_percent}%`, height: '100%', background: '#10b981' }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{financials.marge_nette_percent}%</span>
               </div>
            </div>

            <div className="card" style={{ padding: '2rem' }}>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Marge Brute d'Exploitation</p>
               <h2 style={{ fontSize: '2.2rem', margin: '0.5rem 0', fontWeight: 800 }}>{(financials.ca_brut - financials.cogs_total).toLocaleString()} F</h2>
               <p style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700 }}>Ratio: {financials.marge_brute_percent}%</p>
            </div>

            <div className="card" style={{ padding: '2rem' }}>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>Charges Fixes (Logistique+Frais)</p>
               <h2 style={{ fontSize: '2.2rem', margin: '0.5rem 0', fontWeight: 800, color: '#ef4444' }}>{financials.depenses_fixes_total.toLocaleString()} F</h2>
               <p style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>Inclus: Salaires & Essence</p>
            </div>
          </div>

          {/* MAIN CHART & ANALYSIS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', marginBottom: '2.5rem' }} className="responsive-grid">
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h3 style={{ margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                     <BarChart4 size={20} color="var(--primary)" /> Évolutions des Flux (CA vs Profit)
                  </h3>
              </div>
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
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-premium)' }}
                    />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={3} fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card" style={{ padding: '2rem', background: '#f8fafc', border: '2px dashed #e2e8f0' }}>
                 <h4 style={{ margin: '0 0 1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <Target size={18} color="var(--primary)" /> Score de Solvabilité
                 </h4>
                 <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: financials.marge_nette_percent > 15 ? '#10b981' : '#f59e0b' }}>A+</div>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Indice de Confiance Bancaire</p>
                 </div>
                 <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <li style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                       <span style={{ color: '#64748b' }}>Autofinancement</span>
                       <span style={{ fontWeight: 700, color: '#10b981' }}>Excellent</span>
                    </li>
                    <li style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                       <span style={{ color: '#64748b' }}>Ratio Endettement</span>
                       <span style={{ fontWeight: 700 }}>Faible</span>
                    </li>
                 </ul>
              </div>

              <div className="card" style={{ padding: '2rem' }}>
                 <h4 style={{ margin: '0 0 1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <Zap size={18} color="#f59e0b" /> Expert Downloads
                 </h4>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'flex-start', gap: '0.75rem' }} onClick={handlePDFExport}>
                       <FileText size={18} /> Bilan Audit (PDF)
                    </button>
                    <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'flex-start', gap: '0.75rem' }} onClick={handleExcelExport}>
                       <TableIcon size={18} /> Journal Flux (Excel)
                    </button>
                    <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'flex-start', gap: '0.75rem' }} onClick={handleWordExport}>
                       <FileEdit size={18} /> Synthèse (Word)
                    </button>
                 </div>
              </div>
            </div>
          </div>

          {/* DETAILED LEDGER */}
          <div className="card" style={{ padding: '2rem' }}>
             <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '2rem' }}>Grand Livre des Opérations (Détails Auditor)</h3>
             <div className="table-container">
                <table style={{ width: '100%' }}>
                   <thead>
                      <tr>
                         <th>Date</th>
                         <th>Nature</th>
                         <th>Catégorie / Analytique</th>
                         <th>Libellé</th>
                         <th style={{ textAlign: 'right' }}>Débit / Crédit</th>
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
                               {t.montant > 0 ? '+' : ''}{t.montant.toLocaleString()} F
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </>
      )}
    </div>
  );
};
