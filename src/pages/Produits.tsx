import { useState, useEffect } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { ProduitList } from '../components/produits/ProduitList';
import { ProduitForm } from '../components/produits/ProduitForm';
import { StockForm } from '../components/produits/StockForm';
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

  return (
    <>
      <div style={{ animation: 'pageEnter 0.6s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }} className="responsive-flex">
          <div>
            <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>Catalogue Inventaire</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>Gérez vos articles, prix de vente et niveaux de stock en temps réel.</p>
          </div>
          <button className="btn btn-primary" style={{ height: '56px', padding: '0 2rem', borderRadius: '18px', fontWeight: 800, fontSize: '1.05rem', boxShadow: '0 10px 15px -3px rgba(99, 102, 255, 0.3)' }} onClick={() => { setSelectedProduit(null); setIsProduitFormOpen(true); }}>
            <Plus size={22} strokeWidth={3} style={{ marginRight: '0.5rem' }} />
            Nouveau Produit
          </button>
        </div>

        <div className="card glass-effect" style={{ marginBottom: '2.5rem', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 300px' }}>
              <Search size={22} strokeWidth={2.5} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
              <input 
                type="text" 
                placeholder="Rechercher par nom ou référence unique..." 
                className="form-input"
                style={{ paddingLeft: '3.5rem', height: '56px', fontSize: '1.05rem', fontWeight: 600, borderRadius: '18px', border: '2px solid #f1f5f9' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ position: 'relative', flex: '0 0 250px' }}>
              <Filter size={20} strokeWidth={2.5} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <select 
                className="form-select"
                style={{ paddingLeft: '3.5rem', height: '56px', fontSize: '1.05rem', fontWeight: 600, borderRadius: '18px', border: '2px solid #f1f5f9', cursor: 'pointer', backgroundColor: 'white' }}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">Toutes les catégories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card glass-effect" style={{ padding: '0', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '6rem', color: 'var(--text-muted)' }}>
               <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
               <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>Synchronisation du catalogue...</p>
            </div>
          ) : (
            <ProduitList 
              produits={produits.filter(p => {
                const matchesSearch = p.nom.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesCategory = selectedCategory ? p.categorie_id === selectedCategory : true;
                return matchesSearch && matchesCategory;
              })} 
              onEdit={handleEdit}
              onStock={handleStock}
            />
          )}
        </div>
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
    </>
  );
};
