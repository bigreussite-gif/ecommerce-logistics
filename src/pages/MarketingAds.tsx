import { useState, useEffect } from 'react';
import { Megaphone, Copy, Wand2, CheckCircle2, TrendingUp } from 'lucide-react';
import { getProduits } from '../services/produitService';
import { useToast } from '../contexts/ToastContext';
import type { Produit } from '../types';

export const MarketingAds = () => {
  const { showToast } = useToast();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Produit | null>(null);
  const [generatedAd, setGeneratedAd] = useState<{ hook: string; body: string; cta: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchProduits = async () => {
      try {
        const data = await getProduits();
        // Filtre les produits actifs
        const actifs = data.filter((p: Produit) => p.actif !== false);
        setProduits(actifs);
        if (actifs.length > 0) {
          setSelectedProduct(actifs[0]);
        }
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduits();
  }, []);

  const generateAd = () => {
    if (!selectedProduct) return;
    setIsGenerating(true);

    // Simulation de génération d'IA (Règles logiques simples)
    setTimeout(() => {
      const hooks = [
        `🔥 Vous cherchez le meilleur ${selectedProduct.nom} du marché ?`,
        `🚨 STOP ! Ne ratez pas cette opportunité sur notre ${selectedProduct.nom}.`,
        `✨ Transformez votre quotidien avec ${selectedProduct.nom} !`
      ];
      const bodies = [
        `Découvrez la qualité exceptionnelle de notre produit. Disponible à seulement ${Number(selectedProduct.prix_vente).toLocaleString()} FCFA, c'est l'investissement parfait que vous attendiez.`,
        `Nos clients l'adorent ! Avec un stock ultra limité, c'est le moment idéal pour vous procurer votre ${selectedProduct.nom} à ${Number(selectedProduct.prix_vente).toLocaleString()} FCFA.`,
        `Alliez performance et élégance. Ce produit a été spécialement conçu pour répondre à toutes vos exigences, et tout ça pour ${Number(selectedProduct.prix_vente).toLocaleString()} FCFA.`
      ];
      const ctas = [
        `👉 Cliquez ici pour commander maintenant avant la rupture de stock !`,
        `🛒 Envoyez-nous un message pour réserver le vôtre dès aujourd'hui.`,
        `🚀 Stock limité ! Commandez vite via le lien ci-dessous.`
      ];

      const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
      const randomBody = bodies[Math.floor(Math.random() * bodies.length)];
      const randomCta = ctas[Math.floor(Math.random() * ctas.length)];

      setGeneratedAd({
        hook: randomHook,
        body: randomBody,
        cta: randomCta
      });
      setIsGenerating(false);
      showToast('Publicité générée avec succès !', 'success');
    }, 800);
  };

  const copyToClipboard = () => {
    if (!generatedAd) return;
    const text = `${generatedAd.hook}\n\n${generatedAd.body}\n\n${generatedAd.cta}`;
    navigator.clipboard.writeText(text);
    showToast('Texte copié dans le presse-papier !', 'success');
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>;
  }

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
            Générateur de Publicités
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>
            Créez rapidement des accroches marketing percutantes pour vos meilleurs produits.
          </p>
        </div>
        <div style={{ padding: '0.8rem 1.5rem', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
          <Megaphone size={20} />
          <span>Marketing & Ads</span>
        </div>
      </div>

      <div className="res-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="card glass-effect" style={{ padding: '2rem' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} color="#3b82f6" />
            1. Sélectionnez un produit
          </h3>
          
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">Produit à promouvoir</label>
            <select 
              className="form-input" 
              value={selectedProduct?.id || ''}
              onChange={(e) => {
                const p = produits.find(prod => prod.id === e.target.value);
                if (p) setSelectedProduct(p);
              }}
            >
              {produits.map(p => (
                <option key={p.id} value={p.id}>{p.nom} - {Number(p.prix_vente).toLocaleString()} FCFA</option>
              ))}
            </select>
          </div>

          <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>Détails du produit cible :</div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>{selectedProduct?.nom}</div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <span className="badge badge-success">Prix: {Number(selectedProduct?.prix_vente || 0).toLocaleString()} FCFA</span>
              <span className="badge badge-warning">Stock: {selectedProduct?.stock_actuel || selectedProduct?.stock_disponible || 0}</span>
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
            onClick={generateAd}
            disabled={isGenerating || !selectedProduct}
          >
            {isGenerating ? 'Génération en cours...' : (
              <>
                <Wand2 size={20} />
                Générer le Copywriting
              </>
            )}
          </button>
        </div>

        <div className="card glass-effect" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={20} color="#10b981" />
            2. Résultat Généré
          </h3>

          {generatedAd ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: '#f1f5f9', padding: '2rem', borderRadius: '16px', flex: 1, position: 'relative' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>L'Accroche (Hook)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>{generatedAd.hook}</div>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Le Corps (Body)</div>
                  <div style={{ fontSize: '1rem', color: '#334155', lineHeight: 1.6 }}>{generatedAd.body}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Appel à l'action (CTA)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>{generatedAd.cta}</div>
                </div>
              </div>
              
              <button 
                className="btn" 
                style={{ marginTop: '1.5rem', background: '#0f172a', color: 'white', padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', borderRadius: '12px' }}
                onClick={copyToClipboard}
              >
                <Copy size={20} />
                Copier pour Facebook / Instagram
              </button>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '2px dashed #e2e8f0', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
              <Megaphone size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
              <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Aucune publicité générée.</p>
              <p style={{ fontSize: '0.9rem' }}>Cliquez sur "Générer le Copywriting" pour obtenir une suggestion de texte pour vos réseaux sociaux.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
