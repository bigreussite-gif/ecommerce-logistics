import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Filter, Package, AlertTriangle, TrendingUp, Tag, Download } from 'lucide-react';
import { ProduitList } from '../components/produits/ProduitList';
import { ProduitForm } from '../components/produits/ProduitForm';
import { StockForm } from '../components/produits/StockForm';
import { BulkImportProduitModal } from '../components/produits/BulkImportProduitModal';
import { subscribeToProduits } from '../services/produitService';
import { getCategories } from '../services/adminService';
import { Produit, Categorie } from '../types';

export const Produits = () => {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  const [isProduitFormOpen, setIsProduitFormOpen] = useState(false);
  const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);

  const [isStockFormOpen, setIsStockFormOpen] = useState(false);
  const [stockProduit, setStockProduit] = useState<Produit | null>(null);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCategories().then(setCategories).catch(console.error);
    const unsubscribe = subscribeToProduits((data) => {
      setProduits(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEdit = (produit: Produit) => {
    setSelectedProduit(produit);
    setIsProduitFormOpen(true);
  };

  const handleStock = (produit: Produit) => {
    setStockProduit(produit);
    setIsStockFormOpen(true);
  };

  const stats = useMemo(() => {
    const total = produits.length;
    const enStock = produits.filter(p => (p.stock_actuel ?? 0) > (p.stock_minimum ?? 0)).length;
    const stockBas = produits.filter(p => (p.stock_actuel ?? 0) <= (p.stock_minimum ?? 0) && (p.stock_actuel ?? 0) > 0).length;
    const rupture = produits.filter(p => (p.stock_actuel ?? 0) === 0).length;
    const nbCategories = new Set(produits.map(p => p.categorie_id).filter(Boolean)).size;
    return { total, enStock, stockBas, rupture, nbCategories };
  }, [produits]);

  const filteredProduits = produits.filter(p => {
    const matchesSearch =
      p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory ? p.categorie_id === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ position: 'relative', minHeight: '100vh', padding: '1rem', background: '#f8fafc' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', animation: 'pageEnter 0.6s ease' }}>

        {/* ZONE A: VISION & ACTIONS */}
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.5rem' }}>
                <div style={{ padding: '0.8rem', background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', borderRadius: '18px', color: 'white', boxShadow: '0 10px 20px rgba(99, 102, 255, 0.2)' }}>
                  <Package size={28} />
                </div>
                <h1 style={{ fontSize: '2.2rem', fontWeight: 950, margin: 0, letterSpacing: '-0.02em', color: '#1e293b' }}>
                  Catalogue Inventaire
                </h1>
              </div>
              <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
                Gérez vos articles, prix de vente et niveaux de stock en temps réel.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'white', padding: '0.6rem', borderRadius: '22px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setIsBulkOpen(true)}
                  className="btn btn-outline"
                  style={{ height: '44px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <Download size={18} style={{ transform: 'rotate(180deg)' }} /> Import
                </button>
                <button
                  onClick={() => { setSelectedProduit(null); setIsProduitFormOpen(true); }}
                  className="btn btn-primary"
                  style={{ height: '44px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, padding: '0 1.5rem' }}
                >
                  <Plus size={20} /> Nouveau Produit
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ZONE B: STATS CARDS */}
        <section style={{ marginBottom: '3rem' }}>
          <div className="res-grid" style={{ gap: '1.5rem' }}>
            {[
              { label: 'Total Produits', value: stats.total, color: 'var(--primary)', icon: <Package size={22} />, desc: 'Dans le catalogue' },
              { label: 'En Stock', value: stats.enStock, color: '#10b981', icon: <TrendingUp size={22} />, desc: 'Niveau suffisant' },
              { label: 'Stock Bas', value: stats.stockBas, color: '#f59e0b', icon: <AlertTriangle size={22} />, desc: 'Sous le minimum' },
              { label: 'Rupture', value: stats.rupture, color: '#ef4444', icon: <AlertTriangle size={22} />, desc: 'Stock épuisé' },
              { label: 'Catégories', value: stats.nbCategories, color: '#6366f1', icon: <Tag size={22} />, desc: 'Familles actives' },
            ].map((item, idx) => (
              <div key={idx} className="card" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '1.25rem', alignItems: 'center', transition: 'transform 0.2s' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: `${item.color}10`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e293b', lineHeight: 1 }}>{item.value}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginTop: '0.25rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: item.color, marginTop: '0.2rem', textTransform: 'uppercase' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ZONE C: FILTRES */}
        <section style={{ marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.25rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>

              {/* Filtre catégorie sous forme de tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '2px', scrollbarWidth: 'none' }}>
                <button
                  onClick={() => setSelectedCategory('')}
                  style={{
                    padding: '0.6rem 1.25rem', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 800,
                    whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                    background: selectedCategory === '' ? 'var(--primary)10' : 'transparent',
                    color: selectedCategory === '' ? 'var(--primary)' : '#64748b',
                    display: 'flex', alignItems: 'center', gap: '0.6rem'
                  }}
                >
                  Tous <span style={{ fontSize: '0.75rem', fontWeight: 900, opacity: selectedCategory === '' ? 1 : 0.6 }}>{stats.total}</span>
                </button>
                {categories.map(c => {
                  const count = produits.filter(p => p.categorie_id === c.id).length;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(c.id)}
                      style={{
                        padding: '0.6rem 1.25rem', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 800,
                        whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                        background: selectedCategory === c.id ? 'var(--primary)10' : 'transparent',
                        color: selectedCategory === c.id ? 'var(--primary)' : '#64748b',
                        display: 'flex', alignItems: 'center', gap: '0.6rem'
                      }}
                    >
                      {c.nom}
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, opacity: selectedCategory === c.id ? 1 : 0.6 }}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Barre de recherche */}
              <div style={{ position: 'relative', minWidth: '320px', flex: 1, maxWidth: '500px' }}>
                <Search size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou référence..."
                  className="form-input"
                  style={{ paddingLeft: '3.5rem', height: '48px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.95rem' }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ZONE D: LISTE */}
        <section>
          <div className="card" style={{ padding: '0.5rem', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', minHeight: '400px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '6rem' }}>
                <div className="loading-spinner" style={{ margin: '0 auto 1.5rem' }}></div>
                <p style={{ fontWeight: 700, color: '#64748b' }}>Synchronisation du catalogue...</p>
              </div>
            ) : (
              <ProduitList
                produits={filteredProduits}
                onEdit={handleEdit}
                onStock={handleStock}
              />
            )}
          </div>
        </section>

      </div>

      {isProduitFormOpen && (
        <ProduitForm
          produit={selectedProduit}
          onClose={() => setIsProduitFormOpen(false)}
          onSave={() => setIsProduitFormOpen(false)}
        />
      )}

      {isStockFormOpen && stockProduit && (
        <StockForm
          produit={stockProduit}
          onClose={() => setIsStockFormOpen(false)}
          onSave={() => setIsStockFormOpen(false)}
        />
      )}

      {isBulkOpen && (
        <BulkImportProduitModal
          onClose={() => setIsBulkOpen(false)}
          onSave={() => setIsBulkOpen(false)}
        />
      )}

      <style>{`
        @keyframes pageEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .res-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
      `}</style>
    </div>
  );
};
