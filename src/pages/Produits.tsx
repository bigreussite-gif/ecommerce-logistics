import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { ProduitList } from '../components/produits/ProduitList';
import { ProduitForm } from '../components/produits/ProduitForm';
import { StockForm } from '../components/produits/StockForm';
import { subscribeToProduits } from '../services/produitService';
import { Produit } from '../types';

export const Produits = () => {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isProduitFormOpen, setIsProduitFormOpen] = useState(false);
  const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);
  
  const [isStockFormOpen, setIsStockFormOpen] = useState(false);
  const [stockProduit, setStockProduit] = useState<Produit | null>(null);

  useEffect(() => {
    setLoading(true);
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Catalogue Produits</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Gérez vos articles, prix et niveaux de stock.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelectedProduit(null); setIsProduitFormOpen(true); }}>
          <Plus size={18} />
          Nouveau Produit
        </button>
      </div>

      <div style={{ marginBottom: '1.5rem', position: 'relative', maxWidth: '500px' }}>
        <Search className="h-5 w-5" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input 
          type="text" 
          placeholder="Rechercher un produit par nom, catégorie, ou ID..." 
          className="form-input"
          style={{ paddingLeft: '2.75rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--surface-color)' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Chargement des produits...</div>
        ) : (
          <ProduitList 
            produits={produits.filter(p => 
              p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
              p.id.toLowerCase().includes(searchTerm.toLowerCase())
            )} 
            onEdit={handleEdit}
            onStock={handleStock}
          />
        )}
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
    </div>
  );
};
