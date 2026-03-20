import { useState, useEffect } from 'react';
import { CommandeList } from '../components/commandes/CommandeList';
import { AppelForm } from '../components/centre-appel/AppelForm';
import { subscribeToCommandesByStatus } from '../services/commandeService';
import type { Commande } from '../types';

export const CentreAppel = () => {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommande, setSelectedCommande] = useState<Commande | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCommandesByStatus(['en_attente_appel', 'a_rappeler'], (data) => {
      setCommandes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Centre d'Appel</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Liste des commandes en attente de validation ou à rappeler.</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>À Traiter ({commandes.length})</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Chargement...</div>
        ) : (
          <CommandeList 
            commandes={commandes} 
            onRefresh={() => {}}
            onActionClick={setSelectedCommande}
            actionIcon="PhoneCall"
            actionLabel="Appeler"
          />
        )}
      </div>

      {selectedCommande && (
        <AppelForm 
          commande={selectedCommande}
          onClose={() => setSelectedCommande(null)}
          onSave={() => setSelectedCommande(null)}
        />
      )}
    </div>
  );
};
