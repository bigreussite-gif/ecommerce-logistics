import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Package, AlertTriangle, TrendingUp, Tag, Download, Activity, X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProduitList } from '../components/produits/ProduitList';
import { ProduitForm } from '../components/produits/ProduitForm';
import { StockForm } from '../components/produits/StockForm';
import { BulkImportProduitModal } from '../components/produits/BulkImportProduitModal';
import { subscribeToProduits } from '../services/produitService';
import { getCategories } from '../services/adminService';
import { Produit, Categorie } from '../types';

export const Produits = () => {
  const navigate = useNavigate();
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
  
  const [statsModalProduit, setStatsModalProduit] = useState<Produit | null>(null);

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
    const enStock = produits.filter(p => (p.stock_disponible ?? p.stock_actuel ?? 0) > (p.stock_minimum ?? 0)).length;
    const stockBas = produits.filter(p => (p.stock_disponible ?? p.stock_actuel ?? 0) <= (p.stock_minimum ?? 0) && (p.stock_disponible ?? p.stock_actuel ?? 0) > 0).length;
    const rupture = produits.filter(p => (p.stock_disponible ?? p.stock_actuel ?? 0) === 0).length;
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
          <div className="header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
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

            <div className="actions-wrapper" style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'white', padding: '0.6rem', borderRadius: '22px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
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

              {/* Filtre catégorie - Menu Déroulant Premium */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1', minWidth: '300px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
                  <Tag size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 1 }} />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{
                      width: '100%',
                      height: '48px',
                      padding: '0 1.5rem 0 3.5rem',
                      borderRadius: '16px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: '#1e293b',
                      appearance: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <option value="">Toutes les catégories ({stats.total})</option>
                    {categories.map(c => {
                      const count = produits.filter(p => p.categorie_id === c.id).length;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.nom} ({count})
                        </option>
                      );
                    })}
                  </select>
                  <div style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}>
                    <Search size={14} style={{ transform: 'rotate(90deg)' }} /> {/* Custom arrow look */}
                  </div>
                </div>
              </div>

              {/* Barre de recherche */}
              <div className="search-wrapper" style={{ position: 'relative', minWidth: '320px', flex: 1, maxWidth: '500px' }}>
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
                onView={(p) => setStatsModalProduit(p)}
              />
            )}
          </div>
        </section>

      </div>

      {/* POPUP RÉSUMÉ ACTIVITÉ PRODUIT */}
      {statsModalProduit && (
        <div className="modal-backdrop" onClick={() => setStatsModalProduit(null)}>
          <div
            className="modal-content card"
            style={{ padding: 0, overflow: 'hidden', maxWidth: '500px', width: '96%' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Popup */}
            <div style={{ padding: '2rem', background: 'linear-gradient(135deg, var(--primary), #4f46e5)', color: 'white', position: 'relative' }}>
              <button
                onClick={() => setStatsModalProduit(null)}
                style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              >
                <X size={18} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.2)', borderRadius: '14px' }}>
                  <Activity size={24} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Activité Produit</h2>
                  <p style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem', fontWeight: 600 }}>{statsModalProduit.nom}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8, fontWeight: 700 }}>Stock Physique</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{statsModalProduit.stock_actuel} u.</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8, fontWeight: 700 }}>Stock Dispo</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10b981' }}>{statsModalProduit.stock_disponible ?? statsModalProduit.stock_actuel} u.</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8, fontWeight: 700 }}>Prix Unitaire</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{statsModalProduit.prix_vente?.toLocaleString()} F</div>
                </div>
              </div>
            </div>

            {/* Contenu Popup */}
            <div style={{ padding: '2rem', textAlign: 'center' }}>
               <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '1.5rem', fontSize: '1.05rem' }}>
                 Accédez à l'historique complet des mouvements de stock (entrées fournisseurs et sorties ventes) pour cet article.
               </p>
               <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/produits/${statsModalProduit.id}/historique`)}
                  style={{ width: '100%', height: '54px', borderRadius: '16px', fontSize: '1rem', fontWeight: 800, display: 'flex', justifyContent: 'space-between', padding: '0 1.5rem' }}
                >
                  <span>Voir Détail Complet</span>
                  <ArrowRight size={20} />
               </button>
            </div>
          </div>
        </div>
      )}

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
        .res-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
          gap: 1.5rem;
        }
        .tabs-container {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding: 4px 2px;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none;  /* IE/Edge */
          -webkit-overflow-scrolling: touch;
        }
        .tabs-container::-webkit-scrollbar {
          display: none; /* Chrome/Safari */
        }
        @media (max-width: 768px) {
          .header-flex {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 1.5rem !important;
          }
          .actions-wrapper {
            width: 100%;
            justify-content: space-between;
          }
          .search-wrapper {
            min-width: 100% !important;
          }
          .res-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 480px) {
          .actions-wrapper {
            flex-direction: column;
            width: 100%;
          }
          .actions-wrapper .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
