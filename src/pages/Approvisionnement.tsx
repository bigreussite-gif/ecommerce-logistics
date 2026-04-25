import React, { useState, useEffect } from 'react';
import { getAchatsStock, registerBulkAchatsStock } from '../services/achatService';
import { getFournisseurs, Fournisseur } from '../services/fournisseurService';
import { getProduits } from '../services/produitService';
import { Produit } from '../types';
import { Plus, Search, Calendar, Package, CreditCard, DollarSign, X, Filter, ShoppingBag, ArrowUpRight, CheckCircle2, Trash2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AchatLine {
  id: string; // temp unique id for the UI
  produit_id: string;
  fournisseur_id: string;
  quantite: number;
  prix_achat_unitaire: number;
  mode_paiement: 'Cash' | 'Crédit';
  statut_paiement: 'Payé' | 'En attente';
}

export const Approvisionnement = () => {
  const [achats, setAchats] = useState<any[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [items, setItems] = useState<AchatLine[]>([
    { id: Math.random().toString(), produit_id: '', fournisseur_id: '', quantite: 1, prix_achat_unitaire: 0, mode_paiement: 'Cash', statut_paiement: 'Payé' }
  ]);

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [achatsData, produitsData, fournisseursData] = await Promise.all([
        getAchatsStock(),
        getProduits(),
        getFournisseurs()
      ]);
      setAchats(achatsData);
      setProduits(produitsData);
      setFournisseurs(fournisseursData);
    } catch (error) {
      showToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLine = () => {
    setItems([...items, { id: Math.random().toString(), produit_id: '', fournisseur_id: '', quantite: 1, prix_achat_unitaire: 0, mode_paiement: 'Cash', statut_paiement: 'Payé' }]);
  };

  const handleRemoveLine = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter(item => item.id !== id));
  };

  const updateLine = (id: string, data: Partial<AchatLine>) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...data };
        
        // Auto-fill price if product changes
        if (data.produit_id) {
          const prod = produits.find(p => p.id === data.produit_id);
          if (prod) {
            updated.prix_achat_unitaire = Number(prod.prix_achat) || 0;
          }
        }

        // Auto-set status based on mode
        if (data.mode_paiement) {
          updated.statut_paiement = data.mode_paiement === 'Cash' ? 'Payé' : 'En attente';
        }

        return updated;
      }
      return item;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const invalid = items.some(item => !item.produit_id || !item.fournisseur_id || item.quantite <= 0);
    if (invalid) {
      showToast('Veuillez remplir correctement toutes les lignes', 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = items.map(item => ({
        produit_id: item.produit_id,
        fournisseur_id: item.fournisseur_id,
        quantite: item.quantite,
        prix_achat_unitaire: item.prix_achat_unitaire,
        mode_paiement: item.mode_paiement,
        statut_paiement: item.statut_paiement,
        montant_total: item.quantite * item.prix_achat_unitaire
      }));

      await registerBulkAchatsStock(payload);
      showToast('Approvisionnement groupé enregistré avec succès', 'success');
      setIsModalOpen(false);
      setItems([{ id: Math.random().toString(), produit_id: '', fournisseur_id: '', quantite: 1, prix_achat_unitaire: 0, mode_paiement: 'Cash', statut_paiement: 'Payé' }]);
      loadData();
    } catch (error) {
      showToast('Erreur lors de l\'enregistrement', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredAchats = achats.filter(a => 
    a.produits?.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.fournisseurs?.nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: achats.reduce((acc, a) => acc + (Number(a.montant_total) || 0), 0),
    cash: achats.filter(a => a.mode_paiement === 'Cash').reduce((acc, a) => acc + (Number(a.montant_total) || 0), 0),
    credit: achats.filter(a => a.mode_paiement === 'Crédit').reduce((acc, a) => acc + (Number(a.montant_total) || 0), 0),
  };

  const globalTotal = items.reduce((acc, item) => acc + (item.quantite * item.prix_achat_unitaire), 0);

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 className="text-premium" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, letterSpacing: '-0.03em' }}>Approvisionnement</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '0.4rem', fontWeight: 500 }}>
            Gérez vos entrées de stock multi-produits et multi-fournisseurs.
          </p>
        </div>
        <button className="btn btn-primary btn-premium-shadow" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.8rem', borderRadius: '18px' }}>
          <Plus size={22} strokeWidth={3} /> Nouvelle Session d'Achat
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card glass-effect hover-card" style={{ padding: '1.75rem', borderLeft: '5px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--primary-light)', borderRadius: '14px', color: 'var(--primary)' }}>
              <ShoppingBag size={24} />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total des Achats</span>
          </div>
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-main)' }}>{stats.total.toLocaleString()} <span style={{ fontSize: '1rem', opacity: 0.6 }}>F</span></span>
        </div>
        <div className="card glass-effect hover-card" style={{ padding: '1.75rem', borderLeft: '5px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ padding: '0.75rem', background: '#dcfce7', borderRadius: '14px', color: '#10b981' }}>
              <DollarSign size={24} />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Règlements Cash</span>
          </div>
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#10b981' }}>{stats.cash.toLocaleString()} <span style={{ fontSize: '1rem', opacity: 0.6 }}>F</span></span>
        </div>
        <div className="card glass-effect hover-card" style={{ padding: '1.75rem', borderLeft: '5px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ padding: '0.75rem', background: '#fef3c7', borderRadius: '14px', color: '#f59e0b' }}>
              <CreditCard size={24} />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Engagement Crédit</span>
          </div>
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f59e0b' }}>{stats.credit.toLocaleString()} <span style={{ fontSize: '1rem', opacity: 0.6 }}>F</span></span>
        </div>
      </div>

      {/* Filter Row */}
      <div className="card glass-effect" style={{ padding: '1.25rem', marginBottom: '2.5rem', borderRadius: '22px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={22} />
          <input 
            type="text" 
            placeholder="Rechercher par produit ou par fournisseur..." 
            className="form-input"
            style={{ paddingLeft: '3.75rem', height: '3.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-outline" style={{ height: '3.5rem', borderRadius: '16px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700 }}>
          <Filter size={20} /> Filtres Avancés
        </button>
      </div>

      {loading && !isModalOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10rem 0', gap: '1.5rem' }}>
          <div className="spinner"></div>
          <p style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Synchronisation des flux d'achat...</p>
        </div>
      ) : (
        <div className="card glass-effect" style={{ padding: 0, overflow: 'hidden', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)' }}>
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.05em' }}>Horodatage</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.05em' }}>Article / Référence</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.05em' }}>Fournisseur</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.05em' }}>Quantité</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'right', letterSpacing: '0.05em' }}>P.U. Achat</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'right', letterSpacing: '0.05em' }}>Investissement</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.05em' }}>Méthode</th>
                  <th style={{ padding: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.05em' }}>État</th>
                </tr>
              </thead>
              <tbody>
                {filteredAchats.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '6rem', color: 'var(--text-muted)', fontWeight: 600 }}>Aucune trace d'approvisionnement détectée.</td></tr>
                ) : (
                  filteredAchats.map(a => (
                    <tr key={a.id} className="table-row-hover">
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <Calendar size={15} opacity={0.6} />
                          {format(new Date(a.date_achat), 'dd MMM yyyy • HH:mm', { locale: fr })}
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ padding: '0.6rem', background: 'var(--primary-light)', borderRadius: '10px', color: 'var(--primary)' }}><Package size={18} /></div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 900, color: 'var(--text-main)', fontSize: '1.05rem' }}>{a.produits?.nom || 'Produit inconnu'}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>REF-{a.id.slice(0, 8).toUpperCase()}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{a.fournisseurs?.nom || 'Partenaire Inconnu'}</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        <span style={{ padding: '0.4rem 0.8rem', background: '#f1f5f9', color: 'var(--text-main)', borderRadius: '10px', fontWeight: 900, fontSize: '1rem' }}>{a.quantite}</span>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>{Number(a.prix_achat_unitaire).toLocaleString()} F</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: 900, fontSize: '1.15rem', color: 'var(--primary)' }}>{Number(a.montant_total).toLocaleString()} F</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: '12px', background: a.mode_paiement === 'Cash' ? '#ecfdf5' : '#fffbeb', border: '1px solid', borderColor: a.mode_paiement === 'Cash' ? '#10b981' : '#f59e0b' }}>
                          {a.mode_paiement === 'Cash' ? <DollarSign size={14} color="#10b981" /> : <CreditCard size={14} color="#f59e0b" />}
                          <span style={{ fontSize: '0.75rem', fontWeight: 900, color: a.mode_paiement === 'Cash' ? '#065f46' : '#92400e' }}>{a.mode_paiement.toUpperCase()}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        <span style={{ 
                          padding: '0.4rem 1rem', 
                          borderRadius: '12px', 
                          fontSize: '0.7rem', 
                          fontWeight: 900, 
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          background: a.statut_paiement === 'Payé' ? '#d1fae5' : '#fee2e2',
                          color: a.statut_paiement === 'Payé' ? '#065f46' : '#991b1b',
                          border: '1px solid',
                          borderColor: a.statut_paiement === 'Payé' ? '#10b981' : '#fecaca'
                        }}>
                          {a.statut_paiement}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal d'achat Multi-Produits / Multi-Fournisseurs */}
      {isModalOpen && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(12px)', backgroundColor: 'rgba(15, 23, 42, 0.7)' }}>
          <div className="modal-content card" style={{ width: '100%', maxWidth: '1100px', padding: 0, borderRadius: '32px', overflow: 'hidden', border: 'none', boxShadow: '0 30px 60px -15px rgba(0,0,0,0.4)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, var(--primary), #4f46e5)', padding: '2.5rem', color: 'white', position: 'relative' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '0.6rem', borderRadius: '14px', cursor: 'pointer' }} className="hover-scale"><X size={22} /></button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.2)', borderRadius: '22px', backdropFilter: 'blur(10px)' }}><ShoppingBag size={40} /></div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>Nouvelle Session d'Approvisionnement</h2>
                  <p style={{ margin: '0.4rem 0 0 0', opacity: 0.9, fontSize: '1.1rem', fontWeight: 500 }}>Ajoutez plusieurs articles et fournisseurs dans une seule opération.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '2.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 1rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ textAlign: 'left', padding: '0 1rem' }}>Produit</th>
                    <th style={{ textAlign: 'left', padding: '0 1rem' }}>Fournisseur</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Quantité</th>
                    <th style={{ textAlign: 'right', width: '150px' }}>Prix Unitaire (F)</th>
                    <th style={{ textAlign: 'center', width: '150px' }}>Mode</th>
                    <th style={{ textAlign: 'right', padding: '0 1rem', width: '150px' }}>Sous-total</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} style={{ background: '#f8fafc', borderRadius: '20px' }}>
                      <td style={{ padding: '1rem', borderRadius: '20px 0 0 20px' }}>
                        <select 
                          className="form-select" 
                          required 
                          value={item.produit_id} 
                          onChange={e => updateLine(item.id, { produit_id: e.target.value })}
                          style={{ borderRadius: '12px', height: '3.5rem', fontWeight: 600, border: '1px solid #e2e8f0' }}
                        >
                          <option value="">Produit...</option>
                          {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <select 
                          className="form-select" 
                          required 
                          value={item.fournisseur_id} 
                          onChange={e => updateLine(item.id, { fournisseur_id: e.target.value })}
                          style={{ borderRadius: '12px', height: '3.5rem', fontWeight: 600, border: '1px solid #e2e8f0' }}
                        >
                          <option value="">Fournisseur...</option>
                          {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <input 
                          type="number" 
                          className="form-input text-center" 
                          required 
                          min="1" 
                          value={item.quantite} 
                          onChange={e => updateLine(item.id, { quantite: Number(e.target.value) })}
                          style={{ borderRadius: '12px', height: '3.5rem', fontWeight: 800, fontSize: '1.1rem' }}
                        />
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <input 
                          type="number" 
                          className="form-input text-right" 
                          required 
                          min="0" 
                          value={item.prix_achat_unitaire} 
                          onChange={e => updateLine(item.id, { prix_achat_unitaire: Number(e.target.value) })}
                          style={{ borderRadius: '12px', height: '3.5rem', fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}
                        />
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <select 
                          className="form-select" 
                          value={item.mode_paiement} 
                          onChange={e => updateLine(item.id, { mode_paiement: e.target.value as any })}
                          style={{ borderRadius: '12px', height: '3.5rem', fontWeight: 700, background: item.mode_paiement === 'Cash' ? '#ecfdf5' : '#fffbeb', color: item.mode_paiement === 'Cash' ? '#065f46' : '#92400e', border: '1px solid #e2e8f0' }}
                        >
                          <option value="Cash">CASH</option>
                          <option value="Crédit">CRÉDIT</option>
                        </select>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                        {(item.quantite * item.prix_achat_unitaire).toLocaleString()} F
                      </td>
                      <td style={{ padding: '1rem', borderRadius: '0 20px 20px 0' }}>
                        <button type="button" onClick={() => handleRemoveLine(item.id)} disabled={items.length === 1} style={{ background: 'none', border: 'none', color: '#ef4444', opacity: items.length === 1 ? 0.3 : 1, cursor: 'pointer' }}>
                          <Trash2 size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button type="button" onClick={handleAddLine} className="btn btn-outline" style={{ width: '100%', height: '3.5rem', borderRadius: '16px', border: '2px dashed #cbd5e1', color: 'var(--text-muted)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                <Plus size={20} strokeWidth={3} /> Ajouter une ligne d'article
              </button>

              {/* Summary and Footer */}
              <div style={{ marginTop: '3rem', padding: '2.5rem', background: '#f8fafc', borderRadius: '28px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '0.08em' }}>Investissement Global</span>
                  <div style={{ fontSize: '3rem', fontWeight: 950, color: 'var(--primary)', marginTop: '0.4rem', letterSpacing: '-0.03em' }}>{globalTotal.toLocaleString()} <span style={{ fontSize: '1.2rem', opacity: 0.7 }}>F</span></div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)} style={{ height: '4.5rem', padding: '0 2.5rem', borderRadius: '18px', fontWeight: 800, fontSize: '1.1rem' }}>Annuler</button>
                  <button type="submit" className="btn btn-primary btn-premium-shadow" disabled={loading} style={{ height: '4.5rem', padding: '0 3rem', borderRadius: '18px', fontWeight: 950, fontSize: '1.2rem', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {loading ? <div className="spinner-white"></div> : <><CheckCircle2 size={24} /> Valider l'Approvisionnement</>}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
