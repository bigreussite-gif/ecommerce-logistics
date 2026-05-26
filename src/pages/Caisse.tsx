import { useState, useEffect, Fragment, useMemo, useCallback } from 'react';
import { getAvailableLivreurs, reassignCommandeToFeuille } from '../services/logistiqueService';
import { getFeuillesEnCours, getFeuillesDuJour, getCommandesConcernees, processCaisse, CaisseResolution } from '../services/caisseService';
import { insforge } from '../lib/insforge';
import type { User, Commande, FeuilleRoute } from '../types';
import { Calculator, CheckCircle2, ChevronRight, Plus, Search, Eye, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CommandeDetails } from '../components/commandes/CommandeDetails';

export const Caisse = () => {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [livreurs, setLivreurs] = useState<User[]>([]);
  const [selectedLivreur, setSelectedLivreur] = useState<string>('');
  const [feuilles, setFeuilles] = useState<FeuilleRoute[]>([]);
  const [feuillesDuJour, setFeuillesDuJour] = useState<FeuilleRoute[]>([]);
  const [feuilleSearch, setFeuilleSearch] = useState('');
  const [feuilleSearchResults, setFeuilleSearchResults] = useState<FeuilleRoute[]>([]);
  const [searchingFeuille, setSearchingFeuille] = useState(false);

  const [feuille, setFeuille] = useState<FeuilleRoute | null>(null);
  const [commandes, setCommandes] = useState<(Commande & { lignes?: any[] })[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, CaisseResolution>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [extraSearch, setExtraSearch] = useState('');

  // Form State
  const [montantRemisStr, setMontantRemisStr] = useState<string>('');
  const [primeLivreurStr, setPrimeLivreurStr] = useState<string>('');
  const [commentaire, setCommentaire] = useState('');

  useEffect(() => {
    getAvailableLivreurs().then(setLivreurs);
    getFeuillesDuJour().then(setFeuillesDuJour).catch(console.error);
  }, []);

  const handleFeuilleSearch = async (term: string) => {
    setFeuilleSearch(term);
    if (term.trim().length < 2) { setFeuilleSearchResults([]); return; }
    setSearchingFeuille(true);
    try {
      // Search commandes by client name or phone
      const { data: cmdData } = await (insforge as any).database
        .from('commandes')
        .select('feuille_route_id')
        .not('feuille_route_id', 'is', null)
        .or(`nom_client.ilike.%${term}%,telephone_client.ilike.%${term}%`)
        .limit(20);

      const ids = [...new Set((cmdData || []).map((c: any) => c.feuille_route_id as string).filter(Boolean))];
      if (ids.length === 0) { setFeuilleSearchResults([]); return; }

      const { data: frData } = await (insforge as any).database
        .from('feuilles_route')
        .select('*')
        .in('id', ids)
        .in('statut_feuille', ['en_cours', 'cloturee']);

      if (!frData || frData.length === 0) { setFeuilleSearchResults([]); return; }

      // Fetch livreur names
      const userIds = [...new Set(frData.map((f: any) => f.livreur_id).filter(Boolean))];
      let nameMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: uData } = await (insforge as any).database
          .from('users').select('id, nom_complet').in('id', userIds);
        nameMap = new Map((uData || []).map((u: any) => [u.id, u.nom_complet]));
      }
      setFeuilleSearchResults(frData.map((f: any) => ({ ...f, nom_livreur: nameMap.get(f.livreur_id) || `Livreur #${f.livreur_id?.slice(0,5)}` })));
    } catch(e) { console.error(e); }
    finally { setSearchingFeuille(false); }
  };

  const loadLivreur = async (livreurId: string) => {
    setSelectedLivreur(livreurId);
    setFeuille(null);
    setCommandes([]);
    setResolutions({});
    if (!livreurId) {
      setFeuilles([]);
      return;
    }
    setLoading(true);
    try {
      const fs = await getFeuillesEnCours(livreurId);
      setFeuilles(fs);
    } catch (e) {
      console.error(e);
      showToast("Erreur lors du chargement des feuilles.", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadFeuille = async (f: FeuilleRoute) => {
    setFeuille(f);
    setLoading(true);
    try {
      const cmds = await getCommandesConcernees(f.id);
      setCommandes(cmds);
      
      const newRes: Record<string, CaisseResolution> = {};
      cmds.forEach(c => {
        let statutInit = c.statut_commande;
        if (statutInit === 'en_cours_livraison' || statutInit === 'validee') statutInit = 'livree';
        
        newRes[c.id] = {
           id: c.id,
           statut: statutInit,
           mode_paiement: c.mode_paiement || 'Cash à la livraison',
           updatedLines: (c as any).lignes?.map((l: any) => ({ ...l }))
        };
      });
      setResolutions(newRes);
      
      setMontantRemisStr('');
      setPrimeLivreurStr('');
      setCommentaire('');
    } catch(e) {
      console.error(e);
      showToast("Erreur lors du chargement des commandes.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddExtraOrder = async () => {
    if (!extraSearch || !feuille) return;
    
    const cleanId = extraSearch.trim().replace('#', '').toLowerCase();
    
    if (commandes.find(c => c.id.toLowerCase().includes(cleanId) || cleanId.includes(c.id.toLowerCase()))) {
      showToast("Cette commande est déjà dans la liste.", "info");
      return;
    }

    setLoading(true);
    try {
      let results = [];
      const { data: refResults } = await insforge.database
        .from('commandes')
        .select('*, clients(nom_complet, telephone), users(nom_complet), lignes:lignes_commandes(*)')
        .or(`ref_text.ilike.%${cleanId}%`)
        .limit(1);

      if (refResults && refResults.length > 0) {
        results = refResults;
      } else {
        // Try searching by client name or phone
        const { data: clientResults } = await insforge.database
          .from('commandes')
          .select('*, clients!inner(nom_complet, telephone), users(nom_complet), lignes:lignes_commandes(*)')
          .or(`nom_complet.ilike.%${cleanId}%,telephone.ilike.%${cleanId}%`, { referencedTable: 'clients' })
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (clientResults && clientResults.length > 0) {
          results = clientResults;
        }
      }

      if (!results || results.length === 0) {
        showToast("Aucune commande trouvée avec cette référence ou ce client.", "error");
        return;
      }

      const cmd = results[0];
      
      // Check if already on another sheet
      if (cmd.feuille_route_id && cmd.feuille_route_id !== feuille.id) {
        const livreurName = cmd.users?.nom_complet || "un autre agent";
        const confirmed = window.confirm(`Cette commande est actuellement affectée à ${livreurName}. Voulez-vous la transférer sur cette feuille de route ?`);
        if (!confirmed) return;
      }

      const fullCmd = {
        ...cmd,
        nom_client: cmd.clients?.nom_complet,
        telephone_client: cmd.clients?.telephone,
        lignes: cmd.lignes || []
      };

      // Use the new reassignment service
      await reassignCommandeToFeuille(cmd.id, feuille.id, selectedLivreur);

      setCommandes(prev => [...prev, fullCmd]);
      setResolutions(prev => ({
        ...prev,
        [cmd.id]: {
          id: cmd.id,
          statut: 'livree',
          mode_paiement: 'Cash à la livraison',
          updatedLines: fullCmd.lignes.map((l: any) => ({ ...l }))
        }
      }));

      setExtraSearch('');
      showToast(`Commande #${cmd.id.slice(0,8)} réaffectée et ajoutée.`, "success");

    } catch (e) {
      console.error(e);
      showToast("Erreur lors de l'ajout ou du transfert.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllAsDelivered = () => {
    const newRes = { ...resolutions };
    commandes.forEach(c => {
      newRes[c.id] = {
        ...newRes[c.id],
        statut: 'livree'
      };
    });
    setResolutions(newRes);
    showToast("Toutes les commandes ont été marquées comme encaissées.", "success");
  };

  const calculateOrderTotalLocally = useCallback((orderId: string) => {
    const res = resolutions[orderId];
    const cmd = commandes.find(c => c.id === orderId);
    if (!cmd) return 0;

    if (!res || !res.updatedLines) {
      return Number(cmd.montant_total) || 0;
    }

    const shipping = Number(cmd.frais_livraison) || 0;
    const remise = Number(cmd.remise_totale) || 0;
    const linesSum = res.updatedLines.reduce((sum: number, l: any) => 
      sum + (Number(l.prix_unitaire) * Number(l.quantite)) + (l.choix_installation ? (Number(l.frais_installation) * Number(l.quantite)) : 0), 0
    );
    return linesSum + shipping - remise;
  }, [commandes, resolutions]);

  const montantAttendu = useMemo(() => {
    return commandes
      .filter(c => resolutions[c.id]?.statut === 'livree' && ['Cash à la livraison', 'Cash'].includes(resolutions[c.id]?.mode_paiement || ''))
      .reduce((acc, c) => acc + calculateOrderTotalLocally(c.id), 0);
  }, [commandes, resolutions, calculateOrderTotalLocally]);
  
  const montantMobileMoney = useMemo(() => {
    return commandes
      .filter(c => resolutions[c.id]?.statut === 'livree' && !['Cash à la livraison', 'Cash'].includes(resolutions[c.id]?.mode_paiement || ''))
      .reduce((acc, c) => acc + calculateOrderTotalLocally(c.id), 0);
  }, [commandes, resolutions, calculateOrderTotalLocally]);

  const toggleInstallation = (orderId: string, lineId: string) => {
    const res = resolutions[orderId];
    if (!res || !res.updatedLines) return;
    
    const newLines = res.updatedLines.map(l => {
      if (l.id === lineId) {
        return { ...l, choix_installation: !l.choix_installation };
      }
      return l;
    });
    
    setResolutions({
      ...resolutions,
      [orderId]: { ...res, updatedLines: newLines }
    });
  };

  const updateResolution = (id: string, key: string, value: string) => {
    setResolutions(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const montantRemisParsed = parseFloat(montantRemisStr) || 0;
  const primeLivreurParsed = parseFloat(primeLivreurStr) || 0;
  const isMontantSaisi = montantRemisStr.trim() !== '';
  const ecart = isMontantSaisi ? montantRemisParsed - (montantAttendu - primeLivreurParsed) : 0;

  const handleCloture = async () => {
    if (!feuille || !isMontantSaisi) return;
    
    if (montantRemisParsed < 0 || primeLivreurParsed < 0) {
      showToast("Les montants ne peuvent pas être négatifs.", "error");
      return;
    }

    const resArray = Object.values(resolutions);

    setLoading(true);
    try {
      if (!currentUser?.id) throw new Error("Identifiant caissière introuvable.");
      if (!selectedLivreur) throw new Error("Identifiant livreur introuvable.");

      await processCaisse(
        feuille.id, 
        resArray, 
        montantRemisParsed, 
        ecart, 
        commentaire,
        currentUser.id,
        selectedLivreur,
        primeLivreurParsed
      );
      
      showToast("Feuille de route clôturée avec succès.", "success");
      setTimeout(() => navigate('/historique'), 1000);
    } catch (error: any) {
      console.error("Erreur Clôture Caisse:", error);
      showToast(`Échec de la clôture : ${error?.message || "Erreur inconnue"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ animation: 'pageEnter 0.6s ease' }}>
      <div style={{ marginBottom: '2.5rem' }} className="mobile-stack">
        <div>
          <h1 className="text-premium" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.2rem)', fontWeight: 800, margin: 0 }}>Caisse & Retours</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.4rem', fontWeight: 500 }}>Gestion des retours agents et clôture financière certifiée.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* SELECTION */}
        {!feuille && (
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* LEFT: Feuilles du jour */}
          <div className="card" style={{ flex: 2, minWidth: '320px', padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '24px' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 900, color: 'white', fontSize: '1rem' }}>
                📋 Feuilles du jour
              </h3>
              <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '20px', padding: '0.2rem 0.8rem', fontSize: '0.8rem', fontWeight: 800 }}>
                {feuillesDuJour.length} active{feuillesDuJour.length > 1 ? 's' : ''}
              </span>
            </div>
            {feuillesDuJour.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>Aucune feuille créée aujourd'hui.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {feuillesDuJour.map(f => (
                  <div
                    key={f.id}
                    onClick={() => { setSelectedLivreur(f.livreur_id || ''); loadFeuille(f); }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s', background: 'white' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>#{f.id.slice(0, 8).toUpperCase()}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                        🚚 {(f as any).nom_livreur || 'Livreur'} &nbsp;&bull;&nbsp; {f.total_commandes} colis
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800,
                        background: f.statut_feuille === 'en_cours' ? '#dcfce7' : '#fef3c7',
                        color: f.statut_feuille === 'en_cours' ? '#166534' : '#92400e'
                      }}>{f.statut_feuille === 'en_cours' ? 'En cours' : 'Clôturée'}</span>
                      <ChevronRight size={18} color="var(--primary)" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Recherche + Sélection livreur */}
          <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Recherche par nom/téléphone */}
            <div className="card" style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)' }}>🔍 Rechercher une feuille</h4>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Par nom ou numéro du client</p>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Koné Amara ou 07..."
                  style={{ paddingLeft: '2.5rem', height: '44px', borderRadius: '12px' }}
                  value={feuilleSearch}
                  onChange={e => handleFeuilleSearch(e.target.value)}
                />
              </div>
              {searchingFeuille && <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Recherche...</p>}
              {!searchingFeuille && feuilleSearch.length >= 2 && feuilleSearchResults.length === 0 && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>Aucune feuille trouvée.</p>
              )}
              {feuilleSearchResults.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {feuilleSearchResults.map(f => (
                    <div
                      key={f.id}
                      onClick={() => { setSelectedLivreur(f.livreur_id || ''); loadFeuille(f); setFeuilleSearch(''); setFeuilleSearchResults([]); }}
                      style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '12px', cursor: 'pointer', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>#{f.id.slice(0,8).toUpperCase()}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(f as any).nom_livreur} &bull; {f.total_commandes} colis</div>
                      </div>
                      <ChevronRight size={16} color="var(--primary)" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sélection par livreur (optionnelle) */}
            <div className="card glass-effect" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px' }}>
              <h4 style={{ margin: '0 0 0.75rem', fontWeight: 800, fontSize: '0.9rem' }}>Par livreur</h4>
              <select className="form-select" style={{ height: '44px', fontWeight: 700 }} value={selectedLivreur} onChange={e => loadLivreur(e.target.value)}>
                <option value="">Sélectionner un agent...</option>
                {livreurs.map(l => <option key={l.id} value={l.id}>{l.nom_complet}</option>)}
              </select>
              {selectedLivreur && feuilles.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {feuilles.map(f => (
                    <div key={f.id} onClick={() => loadFeuille(f)}
                      style={{ padding: '0.75rem 1rem', background: 'white', borderRadius: '12px', cursor: 'pointer', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>#{f.id.slice(0,8).toUpperCase()}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{format(new Date(f.date), 'dd MMM yyyy')} &bull; {f.total_commandes} colis</div>
                      </div>
                      <ChevronRight size={16} color="var(--primary)" />
                    </div>
                  ))}
                </div>
              )}
              {selectedLivreur && feuilles.length === 0 && (
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Aucune feuille active pour cet agent.</p>
              )}
            </div>
          </div>
        </div>
        )}
        {/* RECONCILIATION */}
        {feuille && (
          <div className="res-grid" style={{ alignItems: 'start' }}>
            
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                    Encaissements
                    <span style={{ marginLeft: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--primary-glow)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--primary)' }}>
                      #{feuille.id.slice(0, 8).toUpperCase()}
                    </span>
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" style={{ height: '36px', fontSize: '0.8rem', padding: '0 1rem' }} onClick={handleMarkAllAsDelivered}>Tout Livré ✅</button>
                    <button className="btn btn-outline" style={{ height: '36px', fontSize: '0.8rem', padding: '0 1rem' }} onClick={() => setFeuille(null)}>Changer</button>
                  </div>
              </div>

              {/* RESTOCK WARNING */}
              {Object.values(resolutions).some(r => r.statut === 'retour_livreur' || r.statut === 'echouee') && (
                <div style={{ padding: '0.75rem 1.5rem', background: '#fff1f2', borderBottom: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                   <AlertCircle size={16} color="#ef4444" />
                   <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#991b1b' }}>
                     {Object.values(resolutions).filter(r => r.statut === 'retour_livreur' || r.statut === 'echouee').length} colis seront réintégrés en stock.
                   </span>
                </div>
              )}

              {/* QUICK ADD */}
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#fffef0', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ajouter une commande (Ref, Nom, Tél...)"
                      style={{ paddingLeft: '2.5rem', height: '40px', fontSize: '0.9rem', borderRadius: '10px' }}
                      value={extraSearch}
                      onChange={e => setExtraSearch(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleAddExtraOrder()}
                    />
                  </div>
                  <button className="btn btn-secondary" style={{ height: '40px', padding: '0 1rem' }} onClick={handleAddExtraOrder}>
                    <Plus size={16} />
                  </button>
              </div>

              <div className="table-container table-to-cards">
                <div className="table-container">
<table style={{ tableLayout: 'fixed', width: '100%' }}>
                  <colgroup>
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '23%' }} />
                    <col style={{ width: '23%' }} />
                  </colgroup>
                  <thead className="mobile-hide">
                    <tr>
                      <th>Ref</th>
                      <th>Client</th>
                      <th style={{ textAlign: 'right' }}>Montant</th>
                      <th>Statut</th>
                      <th>Paiement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commandes.map(c => (
                      <Fragment key={c.id}>
                        <tr>
                          <td data-label="Ref">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <button className="btn btn-outline" style={{ padding: '0.25rem', borderRadius: '6px', border: '1px solid #e2e8f0', width: 'auto' }} onClick={() => setSelectedOrderId(c.id)}>
                                <Eye size={12} />
                              </button>
                              <span style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.9rem' }}>#{c.id.slice(0, 5).toUpperCase()}</span>
                            </div>
                          </td>
                          <td data-label="Client">
                            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{c.nom_client || `Anonyme`}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{c.commune_livraison}</div>
                          </td>
                          <td data-label="Montant" style={{ fontWeight: 900, textAlign: 'right', fontSize: '1rem' }}>
                            {calculateOrderTotalLocally(c.id).toLocaleString()}
                          </td>
                          <td data-label="Statut">
                            <select 
                              className="form-select" 
                              style={{ 
                                padding: '0.35rem 0.5rem', 
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                border: 'none',
                                backgroundColor: resolutions[c.id]?.statut === 'livree' ? '#dcfce7' : resolutions[c.id]?.statut === 'retour_livreur' ? '#fee2e2' : '#f3f4f6'
                              }}
                              value={resolutions[c.id]?.statut || 'retour_livreur'}
                              onChange={(e) => updateResolution(c.id, 'statut', e.target.value)}
                            >
                              <option value="livree">Encaissé ✅</option>
                              <option value="retour_livreur">Retour 🔙</option>
                              <option value="echouee">Échec ❌</option>
                              <option value="a_rappeler">Reprog. 🔄</option>
                              <option value="annulee">Annulé 🚫</option>
                            </select>
                          </td>
                          <td data-label="Paiement">
                            {resolutions[c.id]?.statut === 'livree' ? (
                              <select 
                                className="form-select" 
                                style={{ padding: '0.35rem 0.5rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}
                                value={resolutions[c.id]?.mode_paiement}
                                onChange={(e) => updateResolution(c.id, 'mode_paiement', e.target.value)}
                              >
                                <option value="Cash à la livraison">CASH</option>
                                <option value="Mobile Money">MOBILE</option>
                                <option value="Carte">CARTE</option>
                              </select>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>N/A</span>
                            )}
                          </td>
                        </tr>
                        {resolutions[c.id]?.statut === 'livree' && resolutions[c.id]?.updatedLines?.some(l => Number(l.frais_installation) > 0) && (
                          <tr style={{ background: 'rgba(99, 102, 255, 0.02)' }}>
                            <td colSpan={5} style={{ padding: '0.5rem 1.5rem', borderTop: 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>Installations :</span>
                                {resolutions[c.id].updatedLines?.filter(l => Number(l.frais_installation) > 0).map(l => (
                                  <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', background: 'white', padding: '0.25rem 0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700 }}>
                                     <input 
                                       type="checkbox" 
                                       checked={l.choix_installation} 
                                       onChange={() => toggleInstallation(c.id, l.id)}
                                       style={{ width: '14px', height: '14px' }}
                                     />
                                     {l.nom_produit} (+{Number(l.frais_installation).toLocaleString()})
                                  </label>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
</div>
              </div>
            </div>

            {/* CALCULATEUR */}
            <div className="card glass-effect" style={{ border: '2px solid var(--primary)', padding: '1.5rem', borderRadius: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calculator size={20} strokeWidth={2.5} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0 }}>Récapitulatif</h3>
              </div>
              
              <div style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'rgba(0,0,0,0.03)', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase' }}>Attendu (Cash) :</span>
                  <span style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--primary)' }}>{montantAttendu.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>F</span></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.8rem' }}>Mobile Money :</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{montantMobileMoney.toLocaleString()} F</span>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Total Cash Reçu *</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Montant remis..."
                    style={{ fontSize: '1.5rem', fontWeight: 800, textAlign: 'center', height: '60px', borderRadius: '14px', border: '2px solid #e2e8f0', color: 'var(--primary)' }}
                    value={montantRemisStr}
                    onChange={e => setMontantRemisStr(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ color: '#6366f1' }}>Prime Agent (Optionnel)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="Bonus agent..."
                  style={{ fontSize: '1.1rem', fontWeight: 800, textAlign: 'center', height: '48px', borderRadius: '14px', border: '1px solid rgba(99, 102, 255, 0.3)' }}
                  value={primeLivreurStr}
                  onChange={e => setPrimeLivreurStr(e.target.value)}
                />
              </div>

              {isMontantSaisi && (
                <div style={{ 
                  padding: '1.25rem', borderRadius: '20px', marginBottom: '1.5rem',
                  backgroundColor: ecart === 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                  border: `2px solid ${ecart === 0 ? '#10b981' : '#ef4444'}`,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: ecart === 0 ? '#059669' : '#dc2626', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Écart Final</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: ecart === 0 ? '#10b981' : '#ef4444' }}>
                    {ecart > 0 ? '+' : ''}{ecart.toLocaleString()} <span style={{ fontSize: '0.9rem' }}>F</span>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Notes de clôture</label>
                <textarea 
                  className="form-input" 
                  rows={2} 
                  style={{ borderRadius: '14px', padding: '0.75rem', fontSize: '0.9rem' }}
                  value={commentaire}
                  onChange={e => setCommentaire(e.target.value)}
                  placeholder="Commentaire éventuel..."
                />
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', height: '64px', fontSize: '1.1rem', fontWeight: 900, borderRadius: '16px', boxShadow: '0 12px 20px -5px var(--primary-glow)' }}
                disabled={loading || !isMontantSaisi}
                onClick={handleCloture}
              >
                {loading ? 'Traitement...' : <><CheckCircle2 size={24} style={{ marginRight: '0.5rem' }} /> CLÔTURER SESSION</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedOrderId && (
        <CommandeDetails 
          commandeId={selectedOrderId} 
          onClose={() => setSelectedOrderId(null)} 
        />
      )}
    </div>
  );
};
