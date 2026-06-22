import { useState, useEffect, useMemo } from 'react';
import { Package, TrendingUp, DollarSign, ShoppingBag, Info, Percent } from 'lucide-react';
import { getProduits } from '../services/produitService';
import { getEffectiveCommandDate } from '../utils/date-utils';
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
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  failedOrders: number;
  deliveryRate: number;
  cancellationRate: number;
  failureRate: number;
}

export const AnalyseProduits = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Produit[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [period, setPeriod] = useState<PeriodDays>(30);
  const [customDays, setCustomDays] = useState<string>('30');
  const [useCustomDays, setUseCustomDays] = useState(false);

  // Raw sales data for the selected products
  const [rawSales, setRawSales] = useState<any[]>([]);

  // Load products list
  useEffect(() => {
    setLoadingProducts(true);
    getProduits()
      .then(data => {
        setProducts(data);
        if (data.length > 0) {
          // Select the first product by default
          setSelectedProductIds([data[0].id]);
        }
        setLoadingProducts(false);
      })
      .catch(err => {
        console.error(err);
        showToast("Erreur lors de la récupération des produits", "error");
        setLoadingProducts(false);
      });
  }, []);

  // Fetch sales for selected products
  useEffect(() => {
    if (selectedProductIds.length === 0) {
      setRawSales([]);
      return;
    }

    setLoadingStats(true);
    const fetchSales = async () => {
      try {
        const { data, error } = await insforge.database
          .from('lignes_commandes')
          .select('id, quantite, prix_unitaire, montant_ligne, prix_achat_unitaire, commande_id, produit_id, commandes!inner(statut_commande, date_creation, commune_livraison)')
          .in('produit_id', selectedProductIds);

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
  }, [selectedProductIds]);

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
      const cmdDate = getEffectiveCommandDate(sale.commandes || {});
      const diffTime = Math.abs(now.getTime() - cmdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= activeDaysLimit;
    });

    // 1. Volumes of completed sales
    const deliveredSales = filteredSales.filter(sale => 
      ['livree', 'terminee'].includes(sale.commandes?.statut_commande?.toLowerCase())
    );

    let deliveredQty = 0;
    let revenue = 0;
    let cost = 0;

    deliveredSales.forEach(sale => {
      const qty = Number(sale.quantite || 0);
      deliveredQty += qty;
      revenue += Number(sale.montant_ligne || 0);
      
      // Find the specific product purchase price since we have multiple selected products
      const prod = products.find(p => p.id === sale.produit_id);
      const purchasePrice = Number(sale.prix_achat_unitaire) || Number(prod?.prix_achat) || 0;
      cost += qty * purchasePrice;
    });

    const profit = revenue - cost;

    // 2. Compute order-level transformation stats
    const uniqueOrdersMap = new Map<string, string>(); // commande_id -> statut_commande
    filteredSales.forEach(sale => {
      if (sale.commande_id && sale.commandes) {
        uniqueOrdersMap.set(sale.commande_id, sale.commandes.statut_commande?.toLowerCase() || '');
      }
    });

    const totalOrdersCount = uniqueOrdersMap.size;
    let deliveredOrdersCount = 0;
    let cancelledOrdersCount = 0;
    let failedOrdersCount = 0;

    uniqueOrdersMap.forEach((status) => {
      if (['livree', 'terminee'].includes(status)) {
        deliveredOrdersCount++;
      } else if (['annulee'].includes(status)) {
        cancelledOrdersCount++;
      } else if (['echouee', 'retour_livreur', 'retour_stock', 'retour_client'].includes(status)) {
        failedOrdersCount++;
      }
    });

    const deliveryRate = totalOrdersCount > 0 ? Math.round((deliveredOrdersCount / totalOrdersCount) * 100) : 0;
    const cancellationRate = totalOrdersCount > 0 ? Math.round((cancelledOrdersCount / totalOrdersCount) * 100) : 0;
    const failureRate = totalOrdersCount > 0 ? Math.round((failedOrdersCount / totalOrdersCount) * 100) : 0;

    // Build list of recent sales
    const recent = deliveredSales
      .map(sale => ({
        commandeId: sale.commande_id,
        date: getEffectiveCommandDate(sale.commandes || {}).toLocaleDateString('fr-FR'),
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
      recentSales: recent,
      totalOrders: totalOrdersCount,
      deliveredOrders: deliveredOrdersCount,
      cancelledOrders: cancelledOrdersCount,
      failedOrders: failedOrdersCount,
      deliveryRate,
      cancellationRate,
      failureRate
    };
  }, [rawSales, activeDaysLimit, products]);

  // Aggregate stock values
  const stockValue = useMemo(() => {
    let purchase = 0;
    let sale = 0;
    let totalStock = 0;
    
    products.forEach(p => {
      if (selectedProductIds.includes(p.id)) {
        const stock = Math.max(0, Number(p.stock_actuel || 0));
        totalStock += stock;
        purchase += stock * Number(p.prix_achat || 0);
        sale += stock * Number(p.prix_vente || 0);
      }
    });
    
    return { purchase, sale, totalStock };
  }, [products, selectedProductIds]);

  // Sparkline calculation for SVG chart
  const sparklinePoints = useMemo(() => {
    const deliveredSales = rawSales.filter(sale => 
      ['livree', 'terminee'].includes(sale.commandes?.statut_commande?.toLowerCase())
    );

    if (deliveredSales.length === 0) return '';
    
    // Group sales by day
    const dailyMap: Record<string, number> = {};
    deliveredSales.forEach(sale => {
      const dateKey = getEffectiveCommandDate(sale.commandes || {}).toISOString().split('T')[0];
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
              Analyse détaillée des stocks, ventes et rentabilité par produit ou groupe de produits.
            </p>
          </div>
        </div>
      </section>

      {/* FILTER & SELECTOR GRID */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            
            {/* Multi-Product Selector */}
            <div style={{ flex: 1, minWidth: '320px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  Sélectionner un ou plusieurs articles
                </label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    onClick={() => setSelectedProductIds(products.map(p => p.id))}
                    style={{ border: 'none', background: 'none', fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                  >
                    Tout sélectionner
                  </button>
                  <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>|</span>
                  <button 
                    onClick={() => setSelectedProductIds([])}
                    style={{ border: 'none', background: 'none', fontSize: '0.75rem', fontWeight: 800, color: '#ef4444', cursor: 'pointer', padding: 0 }}
                  >
                    Tout effacer
                  </button>
                </div>
              </div>

              {/* Scrollable Checkbox List */}
              <div style={{ 
                maxHeight: '160px', 
                overflowY: 'auto', 
                border: '1px solid #e2e8f0', 
                borderRadius: '14px', 
                background: '#f8fafc',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {products.map(p => {
                  const isChecked = selectedProductIds.includes(p.id);
                  return (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedProductIds(selectedProductIds.filter(id => id !== p.id));
                          } else {
                            setSelectedProductIds([...selectedProductIds, p.id]);
                          }
                        }}
                        style={{ width: '16px', height: '16px', borderRadius: '4px', cursor: 'pointer' }}
                      />
                      <span>{p.nom} {p.sku ? `(${p.sku})` : ''}</span>
                    </label>
                  );
                })}
              </div>
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

      {selectedProductIds.length > 0 ? (
        <>
          {/* MULTI-PRODUCT SNAPSHOT CARD */}
          <section style={{ marginBottom: '2.5rem' }}>
            <div className="card" style={{ padding: '1.5rem', borderRadius: '24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <Package size={28} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 0.25rem 0' }}>
                    {selectedProductIds.length === 1 
                      ? `${products.find(p => p.id === selectedProductIds[0])?.nom}`
                      : `${selectedProductIds.length} articles sélectionnés`}
                  </h2>
                  <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem', fontWeight: 600, maxWidth: '600px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {products.filter(p => selectedProductIds.includes(p.id)).map(p => p.nom).join(', ')}
                  </p>
                </div>
              </div>

              {/* Aggregated stock details */}
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Stock Physique Total</p>
                  <p style={{ fontSize: '1.4rem', fontWeight: 950, color: '#f59e0b', margin: 0 }}>
                    {stockValue.totalStock} <span style={{ fontSize: '0.8rem' }}>unités</span>
                  </p>
                </div>
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', height: '32px' }}></div>
                <div>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Valeur Stock Achat</p>
                  <p style={{ fontSize: '1.4rem', fontWeight: 950, color: '#10b981', margin: 0 }}>
                    {stockValue.purchase.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>F</span>
                  </p>
                </div>
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', height: '32px' }}></div>
                <div>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Valeur Stock Vente</p>
                  <p style={{ fontSize: '1.4rem', fontWeight: 950, color: 'var(--primary)', margin: 0 }}>
                    {stockValue.sale.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>F</span>
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
                        Sur articles sélectionnés
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
                        Sur la période choisie
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
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginTop: '0.3rem' }}>Marge Bénéficiaire Réelle</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem', textTransform: 'uppercase' }}>
                        Marge : {stats.revenue > 0 ? Math.round((stats.profit / stats.revenue) * 100) : 0}% du CA
                      </div>
                    </div>
                  </div>

                </div>
              </section>

              {/* CONVERSION RATES & FLUX ANALYSIS */}
              <section style={{ marginBottom: '2.5rem' }}>
                <div className="card" style={{ padding: '1.75rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 950, color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Percent size={22} color="var(--primary)" />
                    Indicateurs de Performance des Ventes et Conversion des Flux
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    {/* Total Orders */}
                    <div style={{ padding: '1.25rem', borderRadius: '18px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Commandes Initiées</span>
                      <div style={{ fontSize: '2rem', fontWeight: 950, color: '#1e293b', margin: '0.5rem 0 0 0' }}>{stats.totalOrders}</div>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>Intégralité des statuts</span>
                    </div>
                    {/* Delivered Orders */}
                    <div style={{ padding: '1.25rem', borderRadius: '18px', background: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Commandes Livrées</span>
                      <div style={{ fontSize: '2rem', fontWeight: 950, color: '#16a34a', margin: '0.5rem 0 0 0' }}>{stats.deliveredOrders}</div>
                      <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 800 }}>Taux : {stats.deliveryRate}%</span>
                    </div>
                    {/* Cancelled Orders */}
                    <div style={{ padding: '1.25rem', borderRadius: '18px', background: '#fef2f2', border: '1px solid #fecaca', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Commandes Annulées</span>
                      <div style={{ fontSize: '2rem', fontWeight: 950, color: '#dc2626', margin: '0.5rem 0 0 0' }}>{stats.cancelledOrders}</div>
                      <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 800 }}>Taux : {stats.cancellationRate}%</span>
                    </div>
                    {/* Failed Orders */}
                    <div style={{ padding: '1.25rem', borderRadius: '18px', background: '#fffbeb', border: '1px solid #fef3c7', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Échecs & Retours</span>
                      <div style={{ fontSize: '2rem', fontWeight: 950, color: '#d97706', margin: '0.5rem 0 0 0' }}>{stats.failedOrders}</div>
                      <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 800 }}>Taux : {stats.failureRate}%</span>
                    </div>
                  </div>

                  {/* Horizontal visual progress bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 800, color: '#334155' }}>
                        <span>Taux de Réussite Livraison (Objectif Efficacité)</span>
                        <span style={{ color: '#16a34a' }}>{stats.deliveryRate}%</span>
                      </div>
                      <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '30px', overflow: 'hidden' }}>
                        <div style={{ width: `${stats.deliveryRate}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: '30px', transition: 'width 0.5s ease' }}></div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 800, color: '#334155' }}>
                        <span>Taux d'Annulation Directe</span>
                        <span style={{ color: '#dc2626' }}>{stats.cancellationRate}%</span>
                      </div>
                      <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '30px', overflow: 'hidden' }}>
                        <div style={{ width: `${stats.cancellationRate}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #dc2626)', borderRadius: '30px', transition: 'width 0.5s ease' }}></div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 800, color: '#334155' }}>
                        <span>Taux d'Échec / Retour Client (SAV ou Refus)</span>
                        <span style={{ color: '#d97706' }}>{stats.failureRate}%</span>
                      </div>
                      <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '30px', overflow: 'hidden' }}>
                        <div style={{ width: `${stats.failureRate}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #d97706)', borderRadius: '30px', transition: 'width 0.5s ease' }}></div>
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
                    Tendance des ventes quotidiennes (Livrées)
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
      ) : (
        <div className="card" style={{ padding: '4rem 1rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>
          <Info size={40} style={{ opacity: 0.3, marginBottom: '1rem', color: 'var(--primary)' }} />
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem', color: '#1e293b' }}>Aucun produit sélectionné</h3>
          <p style={{ margin: '0.5rem 0 0 0', fontWeight: 600 }}>Veuillez cocher au moins un article dans la liste de sélection pour afficher l'analyse.</p>
        </div>
      )}

    </div>
  );
};
