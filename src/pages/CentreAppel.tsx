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
    <>
      <div style={{ animation: 'pageEnter 0.6s ease' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 className="text-premium" style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>Centre d'Appel</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginTop: '0.4rem', fontWeight: 500 }}>Gestion des flux de validation client et relances téléphoniques.</p>
        </div>

        <div className="card glass-effect" style={{ marginBottom: '2.5rem', padding: '2rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>
              Flux à Traiter 
              <span style={{ marginLeft: '1rem', padding: '0.2rem 0.8rem', background: 'rgba(99, 102, 255, 0.1)', borderRadius: '10px', fontSize: '0.9rem' }}>
                {commandes.length} commandes
              </span>
            </h3>
          </div>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
              <p style={{ fontWeight: 600 }}>Récupération des appels prioritaires...</p>
            </div>
          ) : (
            <CommandeList 
              commandes={commandes} 
              onActionClick={setSelectedCommande}
              actionIcon="PhoneCall"
              actionLabel="Lancer l'appel"
            />
          )}
        </div>
      </div>

      {selectedCommande && (
        <AppelForm 
          commande={selectedCommande}
          onClose={() => setSelectedCommande(null)}
          onSave={() => setSelectedCommande(null)}
        />
      )}
    </>
  );
};
