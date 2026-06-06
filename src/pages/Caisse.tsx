import { useState, useEffect, Fragment, useMemo, useCallback } from 'react';
import { getAvailableLivreurs, reassignCommandeToFeuille } from '../services/logistiqueService';
import { getFeuillesEnCours, getFeuillesDuJour, getCommandesConcernees, processCaisse, CaisseResolution } from '../services/caisseService';
import { insforge } from '../lib/insforge';
import type { User, Commande, FeuilleRoute } from '../types';
import { Calculator, CheckCircle2, ChevronRight, Plus, Search, Eye, AlertCircle, RefreshCw, X, Check } from 'lucide-react';
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
  const [transferringCommande, setTransferringCommande] = useState<Commande | null>(null);
  const [transferLivreurId, setTransferLivreurId] = useState<string>('');
  const [pendingAddCommande, setPendingAddCommande] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [extraSearch, setExtraSearch] = useState('');
  const [selectedTab, setSelectedTab] = useState<'toutes' | 'livrees' | 'a_rappeler' | 'retours' | 'transferes'>('toutes');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [modeCalculEcart, setModeCalculEcart] = useState<'brut' | 'sans_livraison' | 'net'>('net');

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
      // Search clients by name or phone
      const { data: clientData } = await insforge.database
        .from('clients')
        .select('id')
        .or(`nom_complet.ilike.%${term}%,telephone.ilike.%${term}%`);

      const clientIds = (clientData || []).map((c: any) => c.id);
      if (clientIds.length === 0) { setFeuilleSearchResults([]); return; }

      // Search commandes by client name or phone
      const { data: cmdData } = await (insforge as any).database
        .from('commandes')
        .select('feuille_route_id')
        .not('feuille_route_id', 'is', null)
        .in('client_id', clientIds)
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
    
    const term = extraSearch.trim();
    const cleanId = term.toLowerCase().replace('#', '');
    
    if (commandes.find(c => c.id.toLowerCase().includes(cleanId) || cleanId.includes(c.id.toLowerCase()))) {
      showToast("Cette commande est déjà dans la liste.", "info");
      return;
    }

    setLoading(true);
    try {
      // 1. Search for matching clients first
      const clientIds: string[] = [];
      const cleanTerm = term.replace(/\s+/g, '');

      // A. If it looks like a phone number, use the robust searchClientByPhone helper
      const isMaybePhone = /\d{6,}/.test(cleanTerm);
      if (isMaybePhone) {
        const { searchClientByPhone } = await import('../services/clientService');
        const client = await searchClientByPhone(cleanTerm);
        if (client) {
          clientIds.push(client.id);
        }
      }

      // B. General ILIKE search with spaced variant for 10-digit phone numbers (e.g. "05 05 44 11 18")
      let spacedTerm = term;
      if (/^\d{10}$/.test(cleanTerm)) {
        spacedTerm = cleanTerm.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
      }

      const { data: matchedClients } = await insforge.database
        .from('clients')
        .select('id')
        .or(`nom_complet.ilike.%${term}%,telephone.ilike.%${term}%,telephone.ilike.%${cleanTerm}%,telephone.ilike.%${spacedTerm}%`);
      
      if (matchedClients) {
        matchedClients.forEach(c => {
          if (!clientIds.includes(c.id)) {
            clientIds.push(c.id);
          }
        });
      }
      
      // 2. Query commandes by ref_text or client_ids
      let query = insforge.database
        .from('commandes')
        .select('*, clients(nom_complet, telephone), users(nom_complet), lignes:lignes_commandes(*)');
      
      if (clientIds.length > 0) {
        query = query.or(`ref_text.ilike.%${cleanId}%,client_id.in.(${clientIds.map(id => `"${id}"`).join(',')})`);
      } else {
        query = query.or(`ref_text.ilike.%${cleanId}%`);
      }
      
      const { data: results, error: queryError } = await query
        .order('created_at', { ascending: false })
        .limit(1);

      if (queryError) throw queryError;

      if (!results || results.length === 0) {
        showToast("Aucune commande trouvée avec cette référence ou ce client.", "error");
        return;
      }
      const cmd = results[0];
      
      const fullCmd = {
        ...cmd,
        nom_client: cmd.clients?.nom_complet,
        telephone_client: cmd.clients?.telephone,
        lignes: cmd.lignes || []
      };

      setPendingAddCommande(fullCmd);

    } catch (e) {
      console.error(e);
      showToast("Erreur lors de la recherche de la commande.", "error");
    } finally {
      setLoading(false);
    }
  };

  const confirmAddExtraOrder = async () => {
    if (!pendingAddCommande || !feuille) return;
    setLoading(true);
    try {
      // Use the new reassignment service
      await reassignCommandeToFeuille(pendingAddCommande.id, feuille.id, selectedLivreur);

      setCommandes(prev => [...prev, pendingAddCommande]);
      setResolutions(prev => ({
        ...prev,
        [pendingAddCommande.id]: {
          id: pendingAddCommande.id,
          statut: 'livree',
          mode_paiement: 'Cash à la livraison',
          updatedLines: pendingAddCommande.lignes.map((l: any) => ({ ...l }))
        }
      }));

      setExtraSearch('');
      showToast(`Commande #${pendingAddCommande.id.slice(0,8)} réaffectée et ajoutée.`, "success");
      setPendingAddCommande(null);
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

  const financeDetails = useMemo(() => {
    let cashAvecLivraison = 0;
    let cashFraisLivraison = 0;
    let cashPrimesInstallation = 0;
    let mmTotal = 0;

    commandes.forEach(c => {
      const res = resolutions[c.id];
      const orderTotal = calculateOrderTotalLocally(c.id);

      if (res?.statut === 'livree') {
        const isCash = ['Cash à la livraison', 'Cash'].includes(res?.mode_paiement || '');
        if (isCash) {
          cashAvecLivraison += orderTotal;
          cashFraisLivraison += Number(c.frais_livraison) || 0;
          if (res.updatedLines) {
            res.updatedLines.forEach((l: any) => {
              if (l.choix_installation && l.prime_payee) {
                cashPrimesInstallation += Number(l.frais_installation) * Number(l.quantite);
              }
            });
          }
        } else {
          mmTotal += orderTotal;
        }
      }
    });

    const primeLivreurParsed = parseFloat(primeLivreurStr) || 0;
    const cashSansLivraison = cashAvecLivraison - cashFraisLivraison;
    const cashNet = cashSansLivraison - cashPrimesInstallation - primeLivreurParsed;

    return {
      cashAvecLivraison,
      cashFraisLivraison,
      cashPrimesInstallation,
      cashSansLivraison,
      cashNet,
      mmTotal
    };
  }, [commandes, resolutions, calculateOrderTotalLocally, primeLivreurStr]);

  const montantAttendu = useMemo(() => {
    if (modeCalculEcart === 'brut') return financeDetails.cashAvecLivraison;
    if (modeCalculEcart === 'sans_livraison') return financeDetails.cashSansLivraison;
    return financeDetails.cashNet;
  }, [financeDetails, modeCalculEcart]);
  
  const montantMobileMoney = useMemo(() => {
    return financeDetails.mmTotal;
  }, [financeDetails]);

  const counts = useMemo(() => {
    const c = { toutes: 0, livrees: 0, a_rappeler: 0, retours: 0, transferes: 0 };
    commandes.forEach(cmd => {
      c.toutes++;
      const status = resolutions[cmd.id]?.statut;
      if (status === 'livree') c.livrees++;
      else if (status === 'a_rappeler') c.a_rappeler++;
      else if (['retour_livreur', 'echouee', 'annulee'].includes(status || '')) c.retours++;
      else if (status === 'transfere') c.transferes++;
    });
    return c;
  }, [commandes, resolutions]);

  const filteredCommandes = useMemo(() => {
    return commandes.filter(c => {
      const searchLower = orderSearchTerm.toLowerCase().trim();
      const matchesSearch = !searchLower ||
        c.id.toLowerCase().includes(searchLower) ||
        (c.nom_client || '').toLowerCase().includes(searchLower) ||
        (c.telephone_client || '').toLowerCase().includes(searchLower) ||
        (c.commune_livraison || '').toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      const status = resolutions[c.id]?.statut;
      if (selectedTab === 'toutes') return true;
      if (selectedTab === 'livrees') return status === 'livree';
      if (selectedTab === 'a_rappeler') return status === 'a_rappeler';
      if (selectedTab === 'retours') return ['retour_livreur', 'echouee', 'annulee'].includes(status || '');
      if (selectedTab === 'transferes') return status === 'transfere';
      return true;
    });
  }, [commandes, resolutions, selectedTab, orderSearchTerm]);

  const toggleInstallation = (orderId: string, lineId: string) => {
    const res = resolutions[orderId];
    if (!res || !res.updatedLines) return;
    
    const newLines = res.updatedLines.map(l => {
      if (l.id === lineId) {
        return { ...l, choix_installation: !l.choix_installation, prime_payee: !l.choix_installation ? true : false };
      }
      return l;
    });
    
    setResolutions({
      ...resolutions,
      [orderId]: { ...res, updatedLines: newLines }
    });
  };

  const togglePrimePayee = (orderId: string, lineId: string) => {
    const res = resolutions[orderId];
    if (!res || !res.updatedLines) return;
    const newLines = res.updatedLines.map(l => {
      if (l.id === lineId) return { ...l, prime_payee: !l.prime_payee };
      return l;
    });
    setResolutions({ ...resolutions, [orderId]: { ...res, updatedLines: newLines } });
  };

  const updateLine = (orderId: string, lineId: string, field: string, value: any) => {
    const res = resolutions[orderId];
    if (!res || !res.updatedLines) return;
    const newLines = res.updatedLines.map(l => {
      if (l.id === lineId) return { ...l, [field]: value };
      return l;
    });
    setResolutions({ ...resolutions, [orderId]: { ...res, updatedLines: newLines } });
  };

  const executeTransfer = async () => {
    if (!transferringCommande || !transferLivreurId || !feuille) return;
    setLoading(true);
    try {
      await reassignCommandeToFeuille(transferringCommande.id, undefined, transferLivreurId);
      setCommandes(prev => prev.filter(c => c.id !== transferringCommande.id));
      const newRes = { ...resolutions };
      delete newRes[transferringCommande.id];
      setResolutions(newRes);
      showToast(`Commande transférée avec succès.`, "success");
      setTransferringCommande(null);
      setTransferLivreurId('');
    } catch (e) {
      console.error(e);
      showToast("Erreur lors du transfert.", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateResolution = (id: string, key: string, value: string) => {
    if (key === 'statut' && value === 'transfere') {
      const cmd = commandes.find(c => c.id === id);
      if (cmd) setTransferringCommande(cmd);
      return;
    }
    setResolutions(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const primesInstallationTotales = useMemo(() => {
    let total = 0;
    Object.values(resolutions).forEach(res => {
      if (res.statut === 'livree' && res.updatedLines) {
        res.updatedLines.forEach((l: any) => {
          if (l.choix_installation && l.prime_payee) {
            total += Number(l.frais_installation) * Number(l.quantite);
          }
        });
      }
    });
    return total;
  }, [resolutions]);

  const montantRemisParsed = parseFloat(montantRemisStr) || 0;
  const primeLivreurParsedForm = parseFloat(primeLivreurStr) || 0;
  const primeLivreurParsedTotal = primeLivreurParsedForm + primesInstallationTotales;
  const isMontantSaisi = montantRemisStr.trim() !== '';
  const ecart = isMontantSaisi ? montantRemisParsed - montantAttendu : 0;

  const handleCloture = async () => {
    if (!feuille || !isMontantSaisi) return;
    
    if (montantRemisParsed < 0 || primeLivreurParsedForm < 0) {
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
        primeLivreurParsedTotal
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
      <style>{`
        .caisse-grid-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (min-width: 1025px) {
          .caisse-grid-container {
            grid-template-columns: 2.2fr 1fr;
          }
        }
      `}</style>
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
          <div className="caisse-grid-container" style={{ alignItems: 'start' }}>
            
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    Encaissements
                    <span style={{ padding: '0.2rem 0.5rem', background: 'var(--primary-glow)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--primary)' }}>
                      #{feuille.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span style={{ padding: '0.2rem 0.6rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '20px', fontSize: '0.8rem', color: '#1e40af', fontWeight: 800 }}>
                      🚚 {(feuille as any).nom_livreur || livreurs.find(l => l.id === selectedLivreur)?.nom_complet || 'Livreur'}
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

              {/* FILTRAGE LOCAL ET ONGLETS */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Filtrer les commandes de cette feuille (Nom, Téléphone, Commune, Réf...)"
                    style={{ paddingLeft: '2.5rem', height: '38px', fontSize: '0.85rem', borderRadius: '10px', width: '100%' }}
                    value={orderSearchTerm}
                    onChange={e => setOrderSearchTerm(e.target.value)}
                  />
                  {orderSearchTerm && (
                    <button 
                      onClick={() => setOrderSearchTerm('')}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => setSelectedTab('toutes')}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid #cbd5e1',
                      background: selectedTab === 'toutes' ? 'var(--text-main)' : 'white',
                      color: selectedTab === 'toutes' ? 'white' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    📦 Toutes ({counts.toutes})
                  </button>

                  <button 
                    onClick={() => setSelectedTab('livrees')}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid #dcfce7',
                      background: selectedTab === 'livrees' ? '#10b981' : 'white',
                      color: selectedTab === 'livrees' ? 'white' : '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    ✅ OK / Livrées ({counts.livrees})
                  </button>

                  <button 
                    onClick={() => setSelectedTab('a_rappeler')}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid #fef3c7',
                      background: selectedTab === 'a_rappeler' ? '#f59e0b' : 'white',
                      color: selectedTab === 'a_rappeler' ? 'white' : '#b45309',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    🔄 À reporter ({counts.a_rappeler})
                  </button>

                  <button 
                    onClick={() => setSelectedTab('retours')}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid #fee2e2',
                      background: selectedTab === 'retours' ? '#ef4444' : 'white',
                      color: selectedTab === 'retours' ? 'white' : '#b91c1c',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    ❌ Retours (X) ({counts.retours})
                  </button>

                  <button 
                    onClick={() => setSelectedTab('transferes')}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid #e0f2fe',
                      background: selectedTab === 'transferes' ? '#0ea5e9' : 'white',
                      color: selectedTab === 'transferes' ? 'white' : '#0369a1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    ➡️ Transférées ({counts.transferes})
                  </button>
                </div>
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
                      {filteredCommandes.map(c => {
                        const resolution = resolutions[c.id];
                        const isDelivered = resolution?.statut === 'livree';
                        const isPostponed = resolution?.statut === 'a_rappeler';
                        const isReturned = ['retour_livreur', 'echouee', 'annulee'].includes(resolution?.statut || '');
                        const isTransferred = resolution?.statut === 'transfere';

                        let rowBg = 'white';
                        let rowBorderLeft = '4px solid transparent';
                        if (isDelivered) {
                          rowBg = '#f0fdf4';
                          rowBorderLeft = '4px solid #22c55e';
                        } else if (isPostponed) {
                          rowBg = '#fffbeb';
                          rowBorderLeft = '4px solid #f59e0b';
                        } else if (isReturned) {
                          rowBg = '#fef2f2';
                          rowBorderLeft = '4px solid #ef4444';
                        } else if (isTransferred) {
                          rowBg = '#f0f9ff';
                          rowBorderLeft = '4px solid #0ea5e9';
                        }

                        return (
                          <Fragment key={c.id}>
                            <tr style={{ backgroundColor: rowBg, borderLeft: rowBorderLeft, transition: 'all 0.2s' }}>
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
                                <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700 }}>{c.telephone_client}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{c.commune_livraison}</div>
                              </td>
                              <td data-label="Montant" style={{ fontWeight: 900, textAlign: 'right', fontSize: '1rem' }}>
                                {calculateOrderTotalLocally(c.id).toLocaleString()}
                              </td>
                              <td data-label="Statut">
                                {/* Boutons rapides */}
                                <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.4rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => updateResolution(c.id, 'statut', 'livree')}
                                    style={{
                                      flex: 1,
                                      padding: '0.35rem 0',
                                      borderRadius: '6px',
                                      border: '1.5px solid #10b981',
                                      background: isDelivered ? '#10b981' : 'transparent',
                                      color: isDelivered ? 'white' : '#10b981',
                                      fontWeight: 800,
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '2px',
                                      transition: 'all 0.15s'
                                    }}
                                    title="Livré (OK)"
                                  >
                                    <Check size={12} strokeWidth={3} /> OK
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateResolution(c.id, 'statut', 'a_rappeler');
                                      if (!resolution?.date_report) {
                                        const tomorrow = new Date();
                                        tomorrow.setDate(tomorrow.getDate() + 1);
                                        updateResolution(c.id, 'date_report', tomorrow.toISOString().split('T')[0]);
                                      }
                                    }}
                                    style={{
                                      flex: 1,
                                      padding: '0.35rem 0',
                                      borderRadius: '6px',
                                      border: '1.5px solid #f59e0b',
                                      background: isPostponed ? '#f59e0b' : 'transparent',
                                      color: isPostponed ? 'white' : '#b45309',
                                      fontWeight: 800,
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '2px',
                                      transition: 'all 0.15s'
                                    }}
                                    title="Reporter"
                                  >
                                    <RefreshCw size={10} strokeWidth={3} /> Reprog
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => updateResolution(c.id, 'statut', 'retour_livreur')}
                                    style={{
                                      flex: 1,
                                      padding: '0.35rem 0',
                                      borderRadius: '6px',
                                      border: '1.5px solid #ef4444',
                                      background: isReturned ? '#ef4444' : 'transparent',
                                      color: isReturned ? 'white' : '#ef4444',
                                      fontWeight: 800,
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '2px',
                                      transition: 'all 0.15s'
                                    }}
                                    title="Retour (X)"
                                  >
                                    <X size={12} strokeWidth={3} /> X
                                  </button>
                                </div>

                                <select 
                                  className="form-select" 
                                  style={{ 
                                    padding: '0.25rem 0.5rem', 
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    width: '100%',
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: 'white'
                                  }}
                                  value={resolution?.statut || 'retour_livreur'}
                                  onChange={(e) => updateResolution(c.id, 'statut', e.target.value)}
                                >
                                  <option value="livree">Encaissé ✅</option>
                                  <option value="retour_livreur">Retour 🔙</option>
                                  <option value="echouee">Échec ❌</option>
                                  <option value="a_rappeler">Reprog. 🔄</option>
                                  <option value="annulee">Annulé 🚫</option>
                                  <option value="transfere">Transférer ➡️</option>
                                </select>
                                {isPostponed && (
                                  <input 
                                    type="date"
                                    className="form-input"
                                    style={{ marginTop: '0.4rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px', width: '100%' }}
                                    value={resolution?.date_report || ''}
                                    onChange={(e) => updateResolution(c.id, 'date_report', e.target.value)}
                                  />
                                )}
                              </td>
                              <td data-label="Paiement">
                                {isDelivered ? (
                                  <select 
                                    className="form-select" 
                                    style={{ padding: '0.35rem 0.5rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, width: '100%' }}
                                    value={resolution?.mode_paiement || 'Cash à la livraison'}
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
                            {isDelivered && resolution?.updatedLines?.length && (
                              <tr style={{ background: 'rgba(99, 102, 255, 0.02)' }}>
                                <td colSpan={5} style={{ padding: '0.5rem 1.5rem', borderTop: 'none' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {/* Installation Primes */}
                                    {resolution.updatedLines.some(l => Number(l.frais_installation) > 0) && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>Installations :</span>
                                        {resolution.updatedLines.filter(l => Number(l.frais_installation) > 0).map(l => (
                                          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.25rem 0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                                              <input 
                                                type="checkbox" 
                                                checked={l.choix_installation} 
                                                onChange={() => toggleInstallation(c.id, l.id)}
                                                style={{ width: '14px', height: '14px' }}
                                              />
                                              {l.nom_produit} (+{Number(l.frais_installation).toLocaleString()})
                                            </label>
                                            {l.choix_installation && (
                                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.5rem', borderLeft: '1px solid #e2e8f0', paddingLeft: '0.5rem', color: '#10b981' }}>
                                                <input 
                                                  type="checkbox" 
                                                  checked={l.prime_payee} 
                                                  onChange={() => togglePrimePayee(c.id, l.id)}
                                                  style={{ width: '14px', height: '14px' }}
                                                />
                                                Prime payée
                                              </label>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    {/* Lignes Adjustment (Partial sales) */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ajustement Lots / Quantités :</span>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                        {resolution.updatedLines.map(l => (
                                          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.nom_produit}>{l.nom_produit}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                              <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>Qté:</span>
                                              <input 
                                                type="number" 
                                                min={0}
                                                value={l.quantite} 
                                                onChange={e => updateLine(c.id, l.id, 'quantite', Number(e.target.value))}
                                                style={{ width: '50px', padding: '0.15rem 0.25rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                              />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                              <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>Prix Unitaire:</span>
                                              <input 
                                                type="number" 
                                                min={0}
                                                value={l.prix_unitaire} 
                                                onChange={e => updateLine(c.id, l.id, 'prix_unitaire', Number(e.target.value))}
                                                style={{ width: '80px', padding: '0.15rem 0.25rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
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
              
              <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* 3 scenarios selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Mode de versement du livreur</div>
                  
                  {/* Option 1: Global (Avec livraison) */}
                  <label style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '0.6rem 0.8rem', 
                    borderRadius: '10px', 
                    background: modeCalculEcart === 'brut' ? '#eff6ff' : 'white', 
                    border: `1.5px solid ${modeCalculEcart === 'brut' ? '#3b82f6' : '#e2e8f0'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="radio" 
                        name="modeCalculEcart" 
                        checked={modeCalculEcart === 'brut'} 
                        onChange={() => setModeCalculEcart('brut')}
                        style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: modeCalculEcart === 'brut' ? '#1e40af' : '#475569' }}>
                        Somme Globale <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>(Avec Livr.)</span>
                      </span>
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: modeCalculEcart === 'brut' ? '#1e40af' : '#1e293b' }}>
                      {financeDetails.cashAvecLivraison.toLocaleString()} F
                    </span>
                  </label>

                  {/* Option 2: Sans livraison */}
                  <label style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '0.6rem 0.8rem', 
                    borderRadius: '10px', 
                    background: modeCalculEcart === 'sans_livraison' ? '#fffbeb' : 'white', 
                    border: `1.5px solid ${modeCalculEcart === 'sans_livraison' ? '#f59e0b' : '#e2e8f0'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="radio" 
                        name="modeCalculEcart" 
                        checked={modeCalculEcart === 'sans_livraison'} 
                        onChange={() => setModeCalculEcart('sans_livraison')}
                        style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: modeCalculEcart === 'sans_livraison' ? '#92400e' : '#475569' }}>
                        Sans Livraison <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>(Frais déduits)</span>
                      </span>
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: modeCalculEcart === 'sans_livraison' ? '#92400e' : '#1e293b' }}>
                      {financeDetails.cashSansLivraison.toLocaleString()} F
                    </span>
                  </label>

                  {/* Option 3: Net (Sans livraison & sans primes) */}
                  <label style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '0.6rem 0.8rem', 
                    borderRadius: '10px', 
                    background: modeCalculEcart === 'net' ? '#f0fdf4' : 'white', 
                    border: `1.5px solid ${modeCalculEcart === 'net' ? '#10b981' : '#e2e8f0'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="radio" 
                        name="modeCalculEcart" 
                        checked={modeCalculEcart === 'net'} 
                        onChange={() => setModeCalculEcart('net')}
                        style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: modeCalculEcart === 'net' ? '#166534' : '#475569' }}>
                        Somme Net à Verser <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>(Livr. & Primes déduites)</span>
                      </span>
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: modeCalculEcart === 'net' ? '#166534' : '#1e293b' }}>
                      {financeDetails.cashNet.toLocaleString()} F
                    </span>
                  </label>
                </div>

                {/* Detail Summary info */}
                <div style={{ padding: '0.8rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Frais Livraison collectés (Cash) :</span>
                    <span style={{ fontWeight: 700, color: '#475569' }}>-{financeDetails.cashFraisLivraison.toLocaleString()} F</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Primes d'Installation validées :</span>
                    <span style={{ fontWeight: 700, color: '#475569' }}>-{financeDetails.cashPrimesInstallation.toLocaleString()} F</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', paddingTop: '0.4rem', borderTop: '1px dashed #cbd5e1' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Mobile Money (Non impacté) :</span>
                    <span style={{ fontWeight: 800, color: '#0369a1' }}>{montantMobileMoney.toLocaleString()} F</span>
                  </div>
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

      {/* Modal Transfert Livreur */}
      {transferringCommande && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card glass-effect" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', borderRadius: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '0.5rem' }}>Transférer à un autre livreur</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Commande #{transferringCommande.id.slice(0,8)} - {transferringCommande.nom_client}</p>
            
            <div className="form-group">
              <label className="form-label">Sélectionner le livreur</label>
              <select className="form-select" value={transferLivreurId} onChange={e => setTransferLivreurId(e.target.value)}>
                <option value="">Choisir...</option>
                {livreurs.filter(l => l.id !== selectedLivreur).map(l => (
                  <option key={l.id} value={l.id}>{l.nom_complet}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setTransferringCommande(null)}>Annuler</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={!transferLivreurId || loading} onClick={executeTransfer}>Transférer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Ajout / Transfert de commande */}
      {pendingAddCommande && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 950, color: '#0f172a', margin: 0 }}>🔍 Confirmer la commande</h3>
              <button onClick={() => setPendingAddCommande(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Commande</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--primary)' }}>#{pendingAddCommande.id.slice(0, 8).toUpperCase()}</span>
                
                <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Client</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{pendingAddCommande.nom_client || 'Inconnu'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Téléphone</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{pendingAddCommande.telephone_client || 'Non renseigné'}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '14px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Destination</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{pendingAddCommande.commune_livraison || '-'}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '2px' }}>{pendingAddCommande.quartier_livraison || ''}</span>
                </div>
                <div style={{ border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '14px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Montant total</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981', display: 'block', marginTop: '2px' }}>{Number(pendingAddCommande.montant_total).toLocaleString()} F</span>
                </div>
              </div>

              {pendingAddCommande.lignes && pendingAddCommande.lignes.length > 0 && (
                <div style={{ border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '14px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Articles ({pendingAddCommande.lignes.length})</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '100px', overflowY: 'auto' }}>
                    {pendingAddCommande.lignes.map((l: any, i: number) => (
                      <span key={i} style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                        📦 {l.quantite}x {l.nom_produit}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Status information and warning */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {pendingAddCommande.feuille_route_id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#fff1f2', border: '1px solid #fee2e2', borderRadius: '12px' }}>
                    <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b' }}>
                      Cette commande est déjà sur la feuille d'un autre livreur. Elle sera **transférée** ici.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: '12px' }}>
                    <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46' }}>
                      Cette commande est en logistique (non affectée). Elle sera ajoutée à cette feuille.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" style={{ flex: 1, height: '48px', borderRadius: '12px', fontWeight: 800 }} onClick={() => setPendingAddCommande(null)}>
                Annuler
              </button>
              <button className="btn btn-primary" style={{ flex: 2, height: '48px', borderRadius: '12px', fontWeight: 900 }} disabled={loading} onClick={confirmAddExtraOrder}>
                {loading ? 'Traitement...' : pendingAddCommande.feuille_route_id ? 'Confirmer le Transfert ➡️' : 'Confirmer l\'Ajout ✅'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
