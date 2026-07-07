import { useState, useEffect, useMemo } from 'react';
import { startOfMonth, endOfMonth, subDays, format, startOfYear, endOfYear } from 'date-fns';
import { getRangeFinancials } from '../services/caisseService';
import { getProduits } from '../services/produitService';
import { getFournisseurs } from '../services/fournisseurService';
import { calculateProfitMetrics, calculateStockValue } from '../services/financialService';
import { useToast } from '../contexts/ToastContext';
import { FileText, Download, Calendar, Activity, Archive } from 'lucide-react';

export const EtatsFinanciers = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<{ retours: any[], commandes: any[], depenses: any[] } | null>(null);
  const [produits, setProduits] = useState<any[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'resultat' | 'bilan' | 'tresorerie'>('resultat');
  
  // Date range
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const refreshData = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const [finRes, prodRes, fourRes] = await Promise.all([
        getRangeFinancials(startDate, endDate),
        getProduits(),
        getFournisseurs()
      ]);
      setData(finRes);
      setProduits(prodRes);
      setFournisseurs(fourRes);
    } catch (e) {
      console.error(e);
      showToast("Erreur de chargement des états financiers", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [startDate, endDate]);

  const setRange = (preset: 'month' | 'lastMonth' | 'year') => {
    let s = new Date();
    let e = new Date();

    if (preset === 'month') {
      s = startOfMonth(new Date());
      e = endOfMonth(new Date());
    } else if (preset === 'lastMonth') {
      s = startOfMonth(subDays(startOfMonth(new Date()), 1));
      e = endOfMonth(s);
    } else if (preset === 'year') {
      s = startOfYear(new Date());
      e = endOfYear(new Date());
    }

    setStartDate(format(s, 'yyyy-MM-dd'));
    setEndDate(format(e, 'yyyy-MM-dd'));
  };

  const handlePrint = () => {
    window.print();
  };

  const stats = useMemo(() => {
    if (!data) return null;
    return calculateProfitMetrics(data.commandes, data.depenses || []);
  }, [data]);

  const stockValue = useMemo(() => {
    return calculateStockValue(produits);
  }, [produits]);

  if (loading || !data || !stats) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
        <p style={{ fontWeight: 600 }}>Génération des états financiers...</p>
      </div>
    );
  }

  // --- COMPTE DE RÉSULTAT (P&L) DATA ---
  const ca_brut = stats.ca_brut;
  const frais_livraison_clients = stats.ca_brut - stats.ca_net_produits; 
  const ca_net = stats.ca_net_produits;
  const cogs = stats.cogs_total;
  const marge_brute = ca_net - cogs;
  
  const charges_exploitation = stats.depenses_fixes_total + stats.frais_vtc_total + stats.pertes_livraison;
  const frais_personnel_primes = stats.total_installation_primes;
  const extractions = stats.total_extractions;
  
  const resultat_exploitation = marge_brute - charges_exploitation - frais_personnel_primes;
  const resultat_net = stats.profit_net_reel; 

  // --- BILAN SIMPLIFIÉ DATA ---
  const totalMobileMoney = (data.commandes || [])
    .filter(c => ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase()) && !['Cash à la livraison', 'Cash'].includes(c.mode_paiement || ''))
    .reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0);
  
  const cashPhysiqueRecus = data.retours.reduce((acc, r) => acc + (Number(r.montant_remis_par_livreur) || 0), 0);
  const total_sorties = stats.total_sorties;
  const tresorerie_periode = (totalMobileMoney + cashPhysiqueRecus) - total_sorties;

  const totalDettesFournisseurs = fournisseurs.reduce((acc, f) => acc + (Number(f.solde_dette) || 0), 0);

  // --- FLUX DE TRÉSORERIE DATA ---
  const total_achats_stock = stats.total_achats_stock;

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }} className="print-container">
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div className="mobile-stack">
          <h1 className="text-premium" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.2rem)', fontWeight: 800, margin: 0 }}>
            États Financiers
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Pièces comptables du {format(new Date(startDate), 'dd/MM/yyyy')} au {format(new Date(endDate), 'dd/MM/yyyy')}
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.4rem', background: '#f1f5f9', padding: '0.4rem', borderRadius: '14px' }}>
            {[
              { id: 'month', label: 'Ce mois' },
              { id: 'lastMonth', label: 'Mois dernier' },
              { id: 'year', label: 'Cette année' }
            ].map(p => (
              <button 
                key={p.id}
                onClick={() => setRange(p.id as any)}
                style={{ 
                  padding: '0.5rem 0.8rem', 
                  borderRadius: '10px', 
                  border: 'none', 
                  background: 'transparent',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'white'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'white', padding: '0.6rem 1rem', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <Calendar size={18} style={{ color: 'var(--primary)' }} />
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              style={{ border: 'none', fontWeight: 700, outline: 'none', fontSize: '0.85rem' }} 
            />
            <span style={{ color: '#cbd5e1' }}>/</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              style={{ border: 'none', fontWeight: 700, outline: 'none', fontSize: '0.85rem' }} 
            />
          </div>

          <button 
            onClick={handlePrint}
            className="btn btn-primary"
            style={{ 
              padding: '0.6rem 1.2rem', 
              borderRadius: '12px', 
              fontWeight: 800, 
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
            }}
          >
            <Download size={16} /> EXPORTER PIÈCE (PDF)
          </button>
        </div>
      </div>

      {/* TABS (no-print) */}
      <div className="no-print" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem' }}>
        <button 
          onClick={() => setActiveTab('resultat')}
          style={{
            background: activeTab === 'resultat' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'resultat' ? 'white' : 'var(--text-muted)',
            border: 'none', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', cursor: 'pointer'
          }}
        >
          <FileText size={18} /> Compte de Résultat
        </button>
        <button 
          onClick={() => setActiveTab('bilan')}
          style={{
            background: activeTab === 'bilan' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'bilan' ? 'white' : 'var(--text-muted)',
            border: 'none', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', cursor: 'pointer'
          }}
        >
          <Archive size={18} /> Bilan Simplifié
        </button>
        <button 
          onClick={() => setActiveTab('tresorerie')}
          style={{
            background: activeTab === 'tresorerie' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'tresorerie' ? 'white' : 'var(--text-muted)',
            border: 'none', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', cursor: 'pointer'
          }}
        >
          <Activity size={18} /> Flux de Trésorerie
        </button>
      </div>

      {/* PRINT HEADER (only visible in print) */}
      <div className="print-only" style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 10px 0' }}>ÉTATS FINANCIERS - PIÈCE COMPTABLE</h1>
        <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
          Période du {format(new Date(startDate), 'dd/MM/yyyy')} au {format(new Date(endDate), 'dd/MM/yyyy')}
        </p>
        <hr style={{ marginTop: '20px', border: '1px solid #eee' }} />
      </div>

      {/* CONTENT AREAS */}
      <div className="card" style={{ padding: '2rem', borderRadius: '20px' }}>
        
        {/* COMPTE DE RÉSULTAT */}
        {(activeTab === 'resultat' || window.matchMedia('print').matches) && (
          <div className="print-section">
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
              Compte de Résultat <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', background: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '20px' }}>P&L</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <FinancialRow label="Chiffre d'Affaires Brut" value={ca_brut} isHeader />
              <FinancialRow label="Frais de Livraison Facturés" value={-frais_livraison_clients} isSub />
              <FinancialRow label="Chiffre d'Affaires Net" value={ca_net} isTotal />
              
              <div style={{ height: '1.5rem' }}></div>
              <FinancialRow label="Coût des Marchandises Vendues (COGS)" value={-cogs} />
              <FinancialRow label="Marge Brute" value={marge_brute} isTotal />
              
              <div style={{ height: '1.5rem' }}></div>
              <FinancialRow label="Charges d'Exploitation" value={0} isHeader />
              <FinancialRow label="Dépenses Fixes / Fonctionnement" value={-stats.depenses_fixes_total} isSub />
              <FinancialRow label="Frais VTC / Déplacements" value={-stats.frais_vtc_total} isSub />
              <FinancialRow label="Primes d'Installation & Personnel" value={-frais_personnel_primes} isSub />
              <FinancialRow label="Pertes Logistiques (Echecs facturés)" value={-stats.pertes_livraison} isSub />
              
              <FinancialRow label="Résultat d'Exploitation (EBITDA)" value={resultat_exploitation} isTotal />

              <div style={{ height: '1.5rem' }}></div>
              <FinancialRow label="Autres Charges et Produits" value={0} isHeader />
              <FinancialRow label="Manquants de Caisse constatés" value={-stats.manquant_caisse} isSub />
              <FinancialRow label="Surplus de Caisse constatés" value={stats.surplus_caisse} isSub />
              <FinancialRow label="Extractions (Commissions Logistique/Admin)" value={-extractions} isSub />
              <FinancialRow label="Retenue Forfaitaire" value={-stats.retenue_charges} isSub />

              <div style={{ height: '2rem' }}></div>
              <div style={{ padding: '1.5rem', background: resultat_net >= 0 ? '#f0fdf4' : '#fff1f2', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `2px solid ${resultat_net >= 0 ? '#bbf7d0' : '#fecaca'}` }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: resultat_net >= 0 ? '#166534' : '#991b1b' }}>RÉSULTAT NET</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: resultat_net >= 0 ? '#15803d' : '#e11d48' }}>
                  {resultat_net.toLocaleString()} CFA
                </span>
              </div>
            </div>
          </div>
        )}

        {/* BILAN SIMPLIFIÉ */}
        {(activeTab === 'bilan' || window.matchMedia('print').matches) && (
          <div className="print-section" style={{ marginTop: window.matchMedia('print').matches ? '4rem' : '0' }}>
             <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
              Bilan Simplifié <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', background: '#3b82f6', padding: '0.2rem 0.6rem', borderRadius: '20px' }}>Actifs</span>
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              {/* ACTIFS */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>ACTIFS (Ce qu'on possède)</h3>
                <FinancialRow label="Valeur du Stock Actuel (Prix d'achat)" value={stockValue} />
                <FinancialRow label="Trésorerie Période (Cash + Digital - Sorties)" value={tresorerie_periode} />
                
                <div style={{ marginTop: '2rem' }}>
                  <FinancialRow label="TOTAL DES ACTIFS" value={stockValue + tresorerie_periode} isTotal />
                </div>
              </div>

              {/* PASSIFS */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>PASSIFS (Ce qu'on doit)</h3>
                <FinancialRow label="Dettes Fournisseurs" value={totalDettesFournisseurs} />
                <FinancialRow label="Capitaux Propres (Équilibre)" value={(stockValue + tresorerie_periode) - totalDettesFournisseurs} />
                
                <div style={{ marginTop: '2rem' }}>
                  <FinancialRow label="TOTAL DES PASSIFS" value={stockValue + tresorerie_periode} isTotal />
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2rem', fontStyle: 'italic' }}>
              * Ce bilan est une représentation simplifiée basée sur le stock actuel valorisé au prix d'achat, et les flux de trésorerie de la période sélectionnée.
            </p>
          </div>
        )}

        {/* FLUX DE TRÉSORERIE */}
        {(activeTab === 'tresorerie' || window.matchMedia('print').matches) && (
          <div className="print-section" style={{ marginTop: window.matchMedia('print').matches ? '4rem' : '0' }}>
             <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
              Flux de Trésorerie <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', background: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '20px' }}>Cash Flow</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <FinancialRow label="FLUX ENTRANTS (Encaissements)" value={0} isHeader />
              <FinancialRow label="Cash Physique Collecté (Retours de feuilles)" value={cashPhysiqueRecus} isSub />
              <FinancialRow label="Paiements Digitaux (Mobile Money/Virement)" value={totalMobileMoney} isSub />
              <FinancialRow label="Surplus de caisse" value={stats.surplus_caisse} isSub />
              <FinancialRow label="Total Encaissements" value={cashPhysiqueRecus + totalMobileMoney + stats.surplus_caisse} isTotal />
              
              <div style={{ height: '1.5rem' }}></div>
              <FinancialRow label="FLUX SORTANTS (Décaissements)" value={0} isHeader />
              <FinancialRow label="Achats de Stock (Fournisseurs)" value={-total_achats_stock} isSub />
              <FinancialRow label="Dépenses Fixes & Frais d'Exploitation" value={-(stats.depenses_fixes_total + stats.frais_vtc_total)} isSub />
              <FinancialRow label="Primes & Personnel" value={-frais_personnel_primes} isSub />
              <FinancialRow label="Manquants de caisse" value={-stats.manquant_caisse} isSub />
              <FinancialRow label="Total Décaissements" value={-(total_achats_stock + stats.depenses_fixes_total + stats.frais_vtc_total + frais_personnel_primes + stats.manquant_caisse)} isTotal />

              <div style={{ height: '2rem' }}></div>
              <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid #e2e8f0' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)' }}>VARIATION DE TRÉSORERIE NETTE</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: (cashPhysiqueRecus + totalMobileMoney + stats.surplus_caisse) - (total_achats_stock + stats.depenses_fixes_total + stats.frais_vtc_total + frais_personnel_primes + stats.manquant_caisse) >= 0 ? '#15803d' : '#e11d48' }}>
                  {((cashPhysiqueRecus + totalMobileMoney + stats.surplus_caisse) - (total_achats_stock + stats.depenses_fixes_total + stats.frais_vtc_total + frais_personnel_primes + stats.manquant_caisse)).toLocaleString()} CFA
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// Helper component for rows
const FinancialRow = ({ label, value, isHeader = false, isTotal = false, isSub = false }: { label: string, value: number, isHeader?: boolean, isTotal?: boolean, isSub?: boolean }) => {
  if (isHeader) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0', borderBottom: '2px solid #cbd5e1', marginTop: '1rem' }}>
        <span style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text-main)', textTransform: 'uppercase' }}>{label}</span>
      </div>
    );
  }
  
  if (isTotal) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderTop: '2px dashed #cbd5e1', borderBottom: '2px solid #e2e8f0', background: '#f8fafc', margin: '0.5rem 0' }}>
        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', paddingLeft: '1rem' }}>{label}</span>
        <span style={{ fontWeight: 900, fontSize: '1.1rem', color: value >= 0 ? 'var(--text-main)' : '#e11d48', paddingRight: '1rem' }}>
          {value.toLocaleString()}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontWeight: 500, fontSize: '0.95rem', color: isSub ? 'var(--text-muted)' : 'var(--text-main)', paddingLeft: isSub ? '1.5rem' : '0.5rem' }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '0.95rem', color: value < 0 ? '#ef4444' : 'var(--text-main)', paddingRight: '0.5rem' }}>
        {value === 0 ? '-' : value.toLocaleString()}
      </span>
    </div>
  );
};
