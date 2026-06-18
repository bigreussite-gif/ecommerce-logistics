import React, { useState } from 'react';
import { X, RefreshCcw, AlertTriangle, Check, Search, Save } from 'lucide-react';
import { insforge } from '../../lib/insforge';
import { Produit } from '../../types';

interface Props {
  onClose: () => void;
  produits: Produit[];
}

export const StockCorrectionModal = ({ onClose, produits }: Props) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'CHOICE' | 'AUTO' | 'MANUAL'>('CHOICE');
  
  // Auto mode
  const [autoResults, setAutoResults] = useState<any[]>([]);

  // Manual mode
  const [searchTerm, setSearchTerm] = useState('');
  const [manualStocks, setManualStocks] = useState<Record<string, string>>({});

  const calculateTheoreticalStock = async () => {
    setLoading(true);
    try {
      const { data: mvts } = await insforge.database.from('mouvements_stock').select('produit_id, type_mouvement, quantite');
      if (!mvts) { setLoading(false); return; }

      const calcMap = new Map<string, number>();
      mvts.forEach((m: any) => {
        const current = calcMap.get(m.produit_id) || 0;
        const q = Number(m.quantite);
        if (m.type_mouvement === 'entree' || m.type_mouvement === 'retour') calcMap.set(m.produit_id, current + q);
        else if (m.type_mouvement === 'sortie') calcMap.set(m.produit_id, current - q);
      });

      const res = produits.map(p => {
        const calculated = calcMap.get(p.id) || 0;
        const current = Number(p.stock_actuel || 0);
        return { id: p.id, nom: p.nom, current, calculated, needsCorrection: current !== calculated };
      });

      setAutoResults(res.filter(r => r.needsCorrection));
      setMode('AUTO');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyAutoCorrections = async () => {
    setLoading(true);
    try {
      for (const r of autoResults) {
        await insforge.database.from('produits').update({ stock_actuel: r.calculated }).eq('id', r.id);
      }
      alert('Corrections automatiques appliquées avec succès !');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la correction');
    } finally {
      setLoading(false);
    }
  };

  const saveManualCorrection = async (p: Produit) => {
    const val = manualStocks[p.id];
    if (val === undefined || val === '') return;
    
    const newStock = Number(val);
    const currentStock = Number(p.stock_actuel || 0);
    if (newStock === currentStock) return;
    
    setLoading(true);
    try {
      const diff = newStock - currentStock;
      const type = diff > 0 ? 'entree' : 'sortie';
      
      // Update directly using standard stock logic
      const { error: updErr } = await insforge.database.from('produits').update({ stock_actuel: newStock }).eq('id', p.id);
      if (updErr) throw updErr;

      await insforge.database.from('mouvements_stock').insert({
        produit_id: p.id,
        type_mouvement: type,
        quantite: Math.abs(diff),
        reference: 'Inventaire Manuel - ' + new Date().toLocaleDateString()
      });
      
      alert(`Stock de ${p.nom} mis à jour à ${newStock}`);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const filteredManual = produits.filter(p => p.nom.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content card" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
            <AlertTriangle size={24} color="#d97706" />
            Outil de Correction des Stocks
          </h2>
          <button onClick={onClose} className="btn btn-outline" style={{ border: 'none', padding: '0.5rem' }}>
            <X size={20} />
          </button>
        </div>

        {mode === 'CHOICE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <p style={{ color: '#64748b', fontSize: '1.05rem', margin: 0 }}>
              Si vos stocks affichés sont faux, vous avez deux options pour les corriger :
            </p>
            
            <div 
              style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setMode('MANUAL')}
              className="hover-card"
            >
              <h3 style={{ margin: '0 0 0.5rem 0' }}>1. Saisie Manuelle (Recommandé)</h3>
              <p style={{ margin: 0, color: '#64748b' }}>Vous avez fait un inventaire physique. Saisissez directement la quantité exacte (ex: 4) pour chaque produit. Le système s'ajustera automatiquement.</p>
            </div>

            <div 
              style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={calculateTheoreticalStock}
              className="hover-card"
            >
              <h3 style={{ margin: '0 0 0.5rem 0' }}>2. Recalcul depuis l'historique</h3>
              <p style={{ margin: 0, color: '#64748b' }}>Le système recalcule tout seul le stock théorique en se basant sur toutes les factures et tous les mouvements passés. {loading && '(Calcul...)'}</p>
            </div>
          </div>
        )}

        {mode === 'AUTO' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Résultat du recalcul automatique : {autoResults.length} erreurs trouvées.</h3>
            {autoResults.length > 0 ? (
              <>
                <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <table className="table" style={{ width: '100%' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                      <tr><th>Article</th><th style={{ textAlign: 'center' }}>Stock Affiché</th><th style={{ textAlign: 'center' }}>Stock Calculé (Historique)</th></tr>
                    </thead>
                    <tbody>
                      {autoResults.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>{r.nom}</td>
                          <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>{r.current}</td>
                          <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{r.calculated}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button className="btn btn-outline" onClick={() => setMode('CHOICE')}>Retour</button>
                  <button className="btn btn-primary" onClick={applyAutoCorrections} disabled={loading}>
                    <Check size={18} /> Forcer ces stocks
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#10b981' }}>Aucune incohérence trouvée dans l'historique.</p>
                <button className="btn btn-outline" onClick={() => setMode('CHOICE')}>Retour</button>
              </div>
            )}
          </div>
        )}

        {mode === 'MANUAL' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  placeholder="Rechercher un article..." 
                  style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="btn btn-outline" onClick={() => setMode('CHOICE')}>Retour</button>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                  <tr>
                    <th>Article</th>
                    <th style={{ textAlign: 'center' }}>Stock Affiché</th>
                    <th style={{ textAlign: 'center' }}>Vrai Stock Physique</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredManual.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.nom}</td>
                      <td style={{ textAlign: 'center', color: '#1e293b', fontWeight: 700 }}>{p.stock_actuel}</td>
                      <td style={{ width: '150px' }}>
                        <input 
                          type="number" 
                          min="0"
                          placeholder="Ex: 4"
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}
                          value={manualStocks[p.id] !== undefined ? manualStocks[p.id] : ''}
                          onChange={(e) => setManualStocks({ ...manualStocks, [p.id]: e.target.value })}
                        />
                      </td>
                      <td style={{ width: '120px', textAlign: 'right' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '0.5rem 1rem' }}
                          onClick={() => saveManualCorrection(p)}
                          disabled={loading || manualStocks[p.id] === undefined || manualStocks[p.id] === '' || Number(manualStocks[p.id]) === Number(p.stock_actuel)}
                        >
                          <Save size={16} /> Sauver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
      <style>{`
        .hover-card:hover {
          border-color: var(--primary) !important;
          background: #f8fafc;
        }
      `}</style>
    </div>
  );
};
