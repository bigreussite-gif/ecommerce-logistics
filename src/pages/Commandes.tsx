import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { CommandeList } from '../components/commandes/CommandeList';
import { CommandeForm } from '../components/commandes/CommandeForm';
import { subscribeToCommandes } from '../services/commandeService';
import type { Commande } from '../types';

export const Commandes = () => {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCommandes((data) => {
      setCommandes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Gestion des Commandes</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Saisissez de nouvelles commandes et suivez leur état.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
          <Plus size={18} />
          Nouvelle Commande
        </button>
      </div>

      <div style={{ marginBottom: '1.5rem', position: 'relative', maxWidth: '500px' }}>
        <Search className="h-5 w-5" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input 
          type="text" 
          placeholder="Rechercher par téléphone, nom, ID, ou commune..." 
          className="form-input"
          style={{ paddingLeft: '2.75rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--surface-color)' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Chargement des commandes...</div>
        ) : (
          <CommandeList 
            commandes={commandes.filter(c => 
              c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.telephone_client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.nom_client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.commune_livraison?.toLowerCase().includes(searchTerm.toLowerCase())
            )} 
            onRefresh={() => {}} 
            onActionClick={() => {}}
          />
        )}
      </div>

      {isFormOpen && (
        <CommandeForm 
          onClose={() => setIsFormOpen(false)} 
          onSave={() => setIsFormOpen(false)} 
        />
      )}
    </div>
  );
};
