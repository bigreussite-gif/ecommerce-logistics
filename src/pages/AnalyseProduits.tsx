import { useState, useEffect, useMemo } from 'react';
import { Package, TrendingUp, DollarSign, ShoppingBag, AlertTriangle, Info, ArrowLeftRight, Percent } from 'lucide-react';
import { getProduits } from '../services/produitService';
import { insforge } from '../lib/insforge';
import type { Produit } from '../types';
import { useToast } from '../contexts/ToastContext';

type PeriodDays = 7 | 30 | 90 | 365 | 'all';

interface ProductStats {
  deliveredQty: number;
  revenue: number;
  cost: number;
  profit: number;
  recentSales: {
    commandeId: string;
    date: string;
    quantite: number;
    total: number;
    commune: string;
  }[];
}

export const AnalyseProduits = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Produit[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [customDays, setCustomDays] = useState<string>('30');
  const [useCustomDays, setUseCustomDays] = useState(false);

  // Raw sales data for the selected product
  const [rawSales, setRawSales] = useState<any[]>([]);

  // Selected product object
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Load products list
  useEffect(() => {
    setLoadingProducts(true);
    getProduits()
      .then(data => {
        setProducts(data);
        if (data.length > 0) {
          setSelectedProductId(data[0].id);
        }
        setLoadingProducts(false);
      })
      .catch(err => {
        console.error(err);
        showToast("Erreur lors de la récupération des produits", "error");
        setLoadingProducts(false);
      });
  }, []);

  // Fetch sales for selected product
  useEffect(() => {
    if (!selectedProductId) return;

    setLoadingStats(true);
    const fetchSales = async () => {
      try {
        const { data, error } = await insforge.database
          .from('lignes_commandes')
          .select('id, quantite, prix_unitaire, montant_ligne, prix_achat_unitaire, commande_id, commandes!inner(statut_commande, date_creation, commune_livraison)')
          .eq('produit_id', selectedProductId)
          .in('commandes.statut_commande', ['livree', 'terminee']);

        if (error) throw error;
        setRawSales(data || []);
        setLoadingStats(false);
      } catch (err) {
        console.error(err);
        showToast("Erreur lors de la récupération de l'historique de ventes", "error");
        setLoadingStats(false);
      }
    };

    fetchSales();
  }, [selectedProductId]);

  // Calculate effective days limit
  const activeDaysLimit = useMemo(() => {
    if (useCustomDays) {
      const parsed = parseInt(customDays, 10);
      return isNaN(parsed) || parsed <= 0 ? null : parsed;
    }
    return period === 'all' ? null : period;
  }, [period, customDays, useCustomDays]);

  // Filter and compute stats based on period/days limit
  const stats = useMemo<ProductStats>(() => {
    const now = new Date();
    
    // Filter raw sales by the selected number of days
    const filteredSales = rawSales.filter(sale => {
      if (activeDaysLimit === null) return true;
      const cmdDate = new Date(sale.commandes?.date_creation);
      const diffTime = Math.abs(now.getTime() - cmdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= activeDaysLimit;
    });

    let deliveredQty = 0;
    let revenue = 0;
    let cost = 0;

    filteredSales.forEach(sale => {
      const qty = Number(sale.quantite || 0);
      deliveredQty += qty;
      revenue += Number(sale.montant_ligne || 0);
      
      // Fallback purchase price if not recorded at the time of purchase
      const purchasePrice = Number(sale.prix_achat_unitaire) || Number(selectedProduct?.prix_achat) || 0;
      cost += qty * purchasePrice;
    });

    const profit = revenue - cost;

    // Build list of recent sales
    const recent = filteredSales
      .map(sale => ({
        commandeId: sale.commande_id,
        date: new Date(sale.commandes?.date_creation).toLocaleDateString('fr-FR'),
        quantite: Number(sale.quantite || 0),
        total: Number(sale.montant_ligne || 0),
        commune: sale.commandes?.commune_livraison || 'Non spécifiée'
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return {
      deliveredQty,
      revenue,
      cost,
      profit,
      recentSales: recent
    };
  }, [rawSales, activeDaysLimit, selectedProduct]);

  // Stock values
  const stockValue = useMemo(() => {
    if (!selectedProduct) return { purchase: 0, sale: 0 };
    const stock = Number(selectedProduct.stock_actuel || 0);
    return {
      purchase: stock * Number(selectedProduct.prix_achat || 0),
      sale: stock * Number(selectedProduct.prix_vente || 0)
    };
  }, [selectedProduct]);

  // Sparkline calculation for SVG chart
  const sparklinePoints = useMemo(() => {
    if (rawSales.length === 0) return '';
    
    // Group sales by day
    const dailyMap: Record<string, number> = {};
    rawSales.forEach(sale => {
      const dateKey = new Date(sale.commandes?.date_creation).toISOString().split('T')[0];
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + Number(sale.quantite || 0);
    });

    // Sort dates
    const sortedDates = Object.keys(dailyMap).sort();
    if (sortedDates.length < 2) return '';

    const maxVal = Math.max(...Object.values(dailyMap), 1);
    const width = 500;
    const height = 120;
    const padding = 10;
    const step = (width - padding * 2) / (sortedDates.length - 1);

    return sortedDates
      .map((date, index) => {
        const x = padding + index * step;
        const val = dailyMap[date];
        const y = height - padding - ((val / maxVal) * (height - padding * 2));
        return `${x},${y}`;
      })
      .join(' ');
  }, [rawSales]);

  if (loadingProducts) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" style={{ marginBottom: '1.5rem' }}></div>
        <p style={{ fontWeight: 700, color: '#64748b' }}>Chargement du catalogue des produits...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '1rem', animation: 'pageEnter 0.6s ease' }}>
      
      {/* HEADER SECTION */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.5rem' }}>
          <div style={{ padding: '0.8rem', background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', borderRadius: '18px', color: 'white', boxShadow: '0 10px 20px rgba(99, 102, 255, 0.2)' }}>
            <TrendingUp size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 950, margin: 0, letterSpacing: '-0.02em', color: '#1e293b' }}>
              Performance & Analyse Produit
            </h1>
            <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
              Analyse détaillée des stocks, ventes et rentabilité par produit.
            </p>
          </div>
        </div>
      </section>

      {/* FILTER & SELECTOR GRID */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            
            {/* Product Selector */}
            <div style={{ flex: 1, minWidth: '300px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                Sélectionner un produit
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '14px',
                  padding: '0 1rem',
                  fontWeight: 700,
                  fontSize: '1rem',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#1e293b',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nom} {p.sku ? `(${p.sku})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Filter */}
            <div style={{ minWidth: '350px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Fenêtre d'analyse temporelle
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="customDaysCheck"
                    checked={useCustomDays}
                    onChange={(e) => setUseCustomDays(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="customDaysCheck" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
                    Jours personnalisés
                  </label>
                </div>
              </div>

              {useCustomDays ? (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', animation: 'slideDown 0.2s ease' }}>
                  <input
                    type="number"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    min="1"
                    className="form-input"
                    style={{ height: '44px', borderRadius: '12px', fontWeight: 700, width: '120px' }}
                    placeholder="Nb jours"
                  />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>derniers jours d'activité</span>
                </div>
              ) : (
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '14px', padding: '0.25rem', width: 'fit-content' }}>
                  {([
                    { label: '7 jours', val: 7 },
                    { label: '30 jours', val: 30 },
                    { label: '90 jours', val: 90 },
                    { label: '1 an', val: 365 },
                    { label: 'Tout', val: 'all' }
                  ] as { label: string, val: PeriodDays }[]).map((item) => (
                    <button
                      key={item.label}
                      onClick={() => setPeriod(item.val)}
                      style={{
                        padding: '0.6rem 1.2rem',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        border: 'none',
                        background: period === item.val ? 'white' : 'transparent',
                        color: period === item.val ? 'var(--primary)' : '#64748b',
                        boxShadow: period === item.val ? '0 4px 10px rgba(0,0,0,0.05)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {selectedProduct && (
        <>
          {/* PRODUCT SNAPSHOT CARD */}
          <section style={{ marginBottom: '2.5rem' }}>
            <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt={selectedProduct.nom} style={{ width: '80px', height: '80px', borderRadius: '16px', objectFit: 'cover', background: 'white' }} />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '16px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={36} color="white" />
                  </div>
                )}
                <div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0 0 0.25rem 0' }}>{selectedProduct.nom}</h2>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '0.25rem 0.75rem', borderRadius: '8px', fontWeight: 700 }}>
                      SKU: {selectedProduct.sku || 'N/A'}
                    </span>
                    <span style={{ fontSize: '0.8rem', background: selectedProduct.actif ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: selectedProduct.actif ? '#10b981' : '#ef4444', padding: '0.25rem 0.75rem', borderRadius: '8px', fontWeight: 700 }}>
                      {selectedProduct.actif ? 'ACTIF' : 'INACTIF'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Purchase vs Sale Price display */}
              <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Prix d'Achat</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 950, color: '#f59e0b' }}>
                    {Number(selectedProduct.prix_achat).toLocaleString()} <span style={{ fontSize: '0.9rem' }}>FCFA</span>
                  </p>
                </div>
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', height: '40px' }}></div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Prix de Vente</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 950, color: '#10b981' }}>
                    {Number(selectedProduct.prix_vente).toLocaleString()} <span style={{ fontSize: '0.9rem' }}>FCFA</span>
                  </p>
                </div>
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', height: '40px' }}></div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Marge Théorique</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 950, color: 'var(--primary)' }}>
                    {(Number(selectedProduct.prix_vente) - Number(selectedProduct.prix_achat)).toLocaleString()} <span style={{ fontSize: '0.9rem' }}>FCFA</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* MAIN PERFORMANCE METRICS */}
          {loadingStats ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem' }}>
              <div className="loading-spinner" style={{ marginBottom: '1rem' }}></div>
              <p style={{ fontWeight: 700, color: '#64748b' }}>Analyse des statistiques en cours...</p>
            </div>
          ) : (
            <>
              <section style={{ marginBottom: '2.5rem' }}>
                <div className="res-grid" style={{ gap: '1.5rem' }}>
                  
                  {/* Delivered Qty */}
                  <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '1.25rem', alignItems: 'center', transition: 'all 0.3s ease', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShoppingBag size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#1e293b', lineHeight: 1 }}>
                        {stats.deliveredQty}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginTop: '0.3rem' }}>Unités Livrées</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem', textTransform: 'uppercase' }}>
                        Commandes complétées
                      </div>
                    </div>
                  </div>

                  {/* Stock Remaining */}
                  <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '1.25rem', alignItems: 'center', transition: 'all 0.3s ease', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ 
                      width: '54px', height: '54px', borderRadius: '16px', 
                      background: selectedProduct.stock_actuel <= selectedProduct.stock_minimum ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,255,0.1)', 
                      color: selectedProduct.stock_actuel <= selectedProduct.stock_minimum ? '#ef4444' : 'var(--primary)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center' 
                    }}>
                      <Package size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#1e293b', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        {selectedProduct.stock_actuel}
                        {selectedProduct.stock_actuel <= selectedProduct.stock_minimum && (
                          <span style={{ fontSize: '0.7rem', color: '#ef4444', background: '#fef2f2', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                            <AlertTriangle size={10} /> CRITIQUE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginTop: '0.3rem' }}>Stock Restant</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginTop: '0.2rem', textTransform: 'uppercase' }}>
                        Alerte à {selectedProduct.stock_minimum} unités
                      </div>
                    </div>
                  </div>

                  {/* Stock Value */}
                  <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '1.25rem', alignItems: 'center', transition: 'all 0.3s ease', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowLeftRight size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#1e293b', lineHeight: 1 }}>
                        {stockValue.purchase.toLocaleString()} F
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginTop: '0.3rem' }}>Valeur Actifs (Achat)</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem', textTransform: 'uppercase' }}>
                        Vente pot. : {stockValue.sale.toLocaleString()} F
                      </div>
                    </div>
                  </div>

                  {/* Revenue Generated */}
                  <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '1.25rem', alignItems: 'center', transition: 'all 0.3s ease', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: 'rgba(99,102,255,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DollarSign size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#1e293b', lineHeight: 1 }}>
                        {stats.revenue.toLocaleString()} F
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginTop: '0.3rem' }}>Chiffre d'Affaires</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.2rem', textTransform: 'uppercase' }}>
                        Sur les {activeDaysLimit || 'tous les'} derniers jours
                      </div>
                    </div>
                  </div>

                  {/* Profit Generated */}
                  <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '1.25rem', alignItems: 'center', transition: 'all 0.3s ease', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Percent size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#10b981', lineHeight: 1 }}>
                        {stats.profit.toLocaleString()} F
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginTop: '0.3rem' }}>Marge de Profit Réelle</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem', textTransform: 'uppercase' }}>
                        Marge : {stats.revenue > 0 ? Math.round((stats.profit / stats.revenue) * 100) : 0}% du CA
                      </div>
                    </div>
                  </div>

                </div>
              </section>

              {/* DETAILS & TREND SECTION */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem' }}>
                
                {/* SVG Trend Chart */}
                <div className="card" style={{ padding: '1.75rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={18} color="var(--primary)" />
                    Tendance des ventes quotidiennes
                  </h3>
                  
                  {sparklinePoints ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <svg viewBox="0 0 500 120" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2"/>
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0"/>
                          </linearGradient>
                        </defs>
                        {/* Area under curve */}
                        <path
                          d={`M 10,110 L ${sparklinePoints} L 490,110 Z`}
                          fill="url(#gradient)"
                        />
                        {/* Sparkline curve */}
                        <polyline
                          fill="none"
                          stroke="var(--primary)"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={sparklinePoints}
                        />
                      </svg>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>
                        <span>Début historique</span>
                        <span>Aujourd'hui</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', minHeight: '120px' }}>
                      <Info size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                      <p style={{ fontWeight: 650, margin: 0 }}>Pas assez de données pour générer un graphique.</p>
                      <p style={{ fontSize: '0.75rem', margin: '0.2rem 0 0 0' }}>Enregistrez plus de livraisons pour ce produit.</p>
                    </div>
                  )}
                </div>

                {/* Recent Sales Table */}
                <div className="card" style={{ padding: '1.75rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1e293b', marginBottom: '1rem' }}>
                    Dernières ventes livrées
                  </h3>
                  
                  {stats.recentSales.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>
                            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Commande</th>
                            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Date</th>
                            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>Commune</th>
                            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Qté</th>
                            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentSales.map((sale, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.85rem' }}>
                              <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                #{sale.commandeId.slice(0, 8).toUpperCase()}
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem', color: '#64748b', fontWeight: 600 }}>{sale.date}</td>
                              <td style={{ padding: '0.75rem 0.5rem', color: '#334155', fontWeight: 600 }}>{sale.commune}</td>
                              <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 800 }}>{sale.quantite}</td>
                              <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                                {sale.total.toLocaleString()} F
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                      <p style={{ fontWeight: 700, margin: 0 }}>Aucune vente enregistrée sur cette période.</p>
                    </div>
                  )}
                </div>

              </div>
            </>
          )}
        </>
      )}

    </div>
  );
};
