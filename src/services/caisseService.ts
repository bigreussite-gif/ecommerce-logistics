import { Commande, FeuilleRoute, LigneCommande } from '../types';
import { insforge } from '../lib/insforge';
import { addMouvementStock } from './produitService';

/**
 * Helper to fetch and map livreur info to avoid duplication
 */
const fetchLivreurInfos = async (data: any[]): Promise<Map<string, { nom_complet: string, telephone: string }>> => {
  if (!data || data.length === 0) return new Map();
  
  const userIds = Array.from(new Set(data.map(f => f.livreur_id).filter(Boolean)));
  if (userIds.length === 0) return new Map();

  const { data: userData } = await insforge.database
    .from('users')
    .select('id, nom_complet, telephone').limit(100000)
    .in('id', userIds);

  return new Map(userData?.map(u => [u.id, { nom_complet: u.nom_complet, telephone: u.telephone || '' }]) || []);
};

export const getFeuillesEnCours = async (livreurId?: string): Promise<FeuilleRoute[]> => {
  let query = insforge.database
    .from('feuilles_route')
    .select('*').limit(100000)
    .in('statut_feuille', ['en_cours', 'cloturee']);

  if (livreurId) {
    query = query.eq('livreur_id', livreurId);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  if (!data || data.length === 0) return [];

  const infoMap = await fetchLivreurInfos(data);

  return data.map((f: any) => {
    const info = infoMap.get(f.livreur_id);
    return {
      ...f,
      nom_livreur: info?.nom_complet || `Livreur #${f.livreur_id?.slice(0,5)}`,
      telephone_livreur: info?.telephone || ''
    };
  });
};

export const getFeuillesDuJour = async (): Promise<FeuilleRoute[]> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data, error } = await insforge.database
    .from('feuilles_route')
    .select('*').limit(100000)
    .in('statut_feuille', ['en_cours', 'cloturee'])
    .gte('date', todayStart.toISOString())
    .lte('date', todayEnd.toISOString())
    .order('date', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const infoMap = await fetchLivreurInfos(data);
  return data.map((f: any) => {
    const info = infoMap.get(f.livreur_id);
    return {
      ...f,
      nom_livreur: info?.nom_complet || `Livreur #${f.livreur_id?.slice(0,5)}`,
      telephone_livreur: info?.telephone || ''
    };
  });
};

export const getCloturedFeuilles = async (): Promise<FeuilleRoute[]> => {
  const { data, error } = await insforge.database
    .from('feuilles_route')
    .select('*').limit(100000)
    .eq('statut_feuille', 'terminee')
    .order('date', { ascending: false });

  if (error) throw error;
  
  if (!data || data.length === 0) return [];

  const infoMap = await fetchLivreurInfos(data);

  return data.map((f: any) => {
    const info = infoMap.get(f.livreur_id);
    return {
      ...f,
      nom_livreur: info?.nom_complet || `Livreur #${f.livreur_id?.slice(0,5)}`,
      telephone_livreur: info?.telephone || ''
    };
  });
};

export const getCommandesConcernees = async (feuilleRouteId: string): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone, telephone_secondaire), lignes:lignes_commandes(*)').limit(100000)
    .eq('feuille_route_id', feuilleRouteId);

  if (error) throw error;
  return (data || []).map((c: any) => ({
    ...c,
    nom_client: c.clients?.nom_complet,
    telephone_client: c.clients?.telephone,
    telephone_secondaire: c.clients?.telephone_secondaire,
    lignes: c.lignes || []
  }));
};

export interface CaisseResolution {
  id: string;
  statut: string;
  mode_paiement: string;
  date_report?: string;
  updatedLines?: LigneCommande[];
}

export const processCaisse = async (
  feuilleRouteId: string, 
  resolutions: CaisseResolution[], 
  montantPhysique: number, 
  ecart: number, 
  commentaire: string,
  caissiereId: string,
  livreurId: string,
  primeLivreur: number = 0
): Promise<void> => {
  // 0. Record Prime as Expense if > 0
  if (primeLivreur > 0) {
    const { data: livreur } = await insforge.database
      .from('users')
      .select('nom_complet').limit(100000)
      .eq('id', livreurId)
      .single();
    
    const { error: primeErr } = await insforge.database.from('depenses').insert([{
      date: new Date().toISOString(),
      categorie: 'Personnel / Prime',
      description: `Prime Livreur : ${livreur?.nom_complet || 'Agent'} - Feuille #${feuilleRouteId.slice(0,8)}`,
      montant: primeLivreur,
      paye_par_id: caissiereId,
      created_at: new Date().toISOString()
    }]);
    if (primeErr) throw primeErr;
  }

  // 1. Update Feuille Route status
  const { error: frError } = await insforge.database
    .from('feuilles_route')
    .update({
      statut_feuille: 'terminee',
      date_traitement: new Date().toISOString(),
      montant_encaisse: montantPhysique,
      ecart_caisse: ecart
    })
    .eq('id', feuilleRouteId);

  if (frError) throw frError;
  
  const orderIds = resolutions.map(r => r.id);
  
  // FETCH CURRENT COMMAND STATUSES TO KNOW IF WE NEED TO DEDUCT/ADD STOCK
  const { data: currentCmds } = await insforge.database
    .from('commandes')
    .select('id, statut_commande').limit(100000)
    .in('id', orderIds);
    
  const { data: lignesCommandes, error: linesError } = await insforge.database
    .from('lignes_commandes')
    .select('*').limit(100000)
    .in('commande_id', orderIds);

  if (linesError) throw linesError;
  
  // Process resolutions sequentially for stock to avoid race conditions 
  for (const res of resolutions) {
    let finalStatus = res.statut;
    if (res.statut === 'livree') finalStatus = 'terminee';
    if (res.statut === 'retour_livreur' || res.statut === 'echouee') finalStatus = 'retour_stock';
    
    const isDelivered = finalStatus === 'terminee' || finalStatus === 'livree';
    
    const updateData: any = { 
      statut_commande: finalStatus, 
      mode_paiement: res.mode_paiement 
    };

    if (!isDelivered) {
      updateData.feuille_route_id = null;
      if (finalStatus === 'a_rappeler' && res.date_report) {
        updateData.date_livraison_prevue = res.date_report;
      }
    } else {
      updateData.date_livraison_effective = new Date().toISOString();
      
      // Fetch current command info to handle final calculations and montant_encaisse
      const { data: cmdRef } = await insforge.database
        .from('commandes')
        .select('montant_total, frais_livraison, remise_totale, livraison_incluse').limit(100000)
        .eq('id', res.id)
        .single();

      if (cmdRef) {
        let finalMontant = Number(cmdRef.montant_total) || 0;

        if (res.updatedLines) {
          const shipping = Number(cmdRef.frais_livraison) || 0;
          const remise = Number(cmdRef.remise_totale) || 0;
          const incluse = cmdRef.livraison_incluse === true;

          let newTotalPrimes = 0;
          let newMontantTotal = 0;

          for (const l of res.updatedLines) {
            const lineTotal = (Number(l.prix_unitaire) * Number(l.quantite)) + 
                              (l.choix_installation ? (Number(l.frais_installation) * Number(l.quantite)) : 0);
            newMontantTotal += lineTotal;
            if (l.choix_installation) newTotalPrimes += (Number(l.frais_installation) * Number(l.quantite));

            const { error: lineErr } = await insforge.database
              .from('lignes_commandes')
              .update({ 
                choix_installation: !!l.choix_installation, 
                montant_ligne: lineTotal,
                quantite: Number(l.quantite),
                prix_unitaire: Number(l.prix_unitaire),
                prime_payee: !!l.prime_payee,
                frais_installation: Number(l.frais_installation) || 0
              })
              .eq('id', l.id);
            if (lineErr) throw lineErr;
          }

          finalMontant = newMontantTotal + (incluse ? 0 : shipping) - remise;
          updateData.montant_total = finalMontant;
          updateData.total_primes_installation = newTotalPrimes;
        }

        updateData.montant_encaisse = finalMontant;
      }
    }
    
    const { error: cmdErr } = await insforge.database
      .from('commandes')
      .update(updateData)
      .eq('id', res.id);
    if (cmdErr) throw cmdErr;

    // --- STOCK FIX: ONLY ADD/REMOVE STOCK IF 'WAS OUT' != 'IS NOW OUT' ---
    const currentCmd = currentCmds?.find(c => c.id === res.id);
    const prevStatus = currentCmd?.statut_commande || '';
    
    const outOfWarehouseStates = ['livree', 'terminee'];
    const wasOut = outOfWarehouseStates.includes(prevStatus.toLowerCase());
    const isNowOut = outOfWarehouseStates.includes(finalStatus.toLowerCase());

    if (wasOut !== isNowOut) {
      const linesForThisOrder = lignesCommandes.filter((l: any) => l.commande_id === res.id);
      for (const l of linesForThisOrder) {
        await addMouvementStock({
          produit_id: l.produit_id,
          commande_id: res.id,
          type_mouvement: isNowOut ? 'sortie' : 'entree',
          quantite: l.quantite,
          reference: `Caisse: ${isNowOut ? 'Sortie' : 'Retour'} (${finalStatus}) Cmd #${res.id.slice(0,8)}`,
          commentaire: `Traitement Caisse - Feuille #${feuilleRouteId.slice(0,8)}`
        } as any);
      }
    }
  }

  // 2. Log formal Caisse Retour
  const { error: retourError } = await insforge.database
    .from('caisse_retours')
    .insert([{ 
      date: new Date().toISOString(), 
      feuille_route_id: feuilleRouteId, 
      livreur_id: livreurId,
      caissiere_id: caissiereId,
      montant_remis_par_livreur: montantPhysique, 
      montant_attendu: montantPhysique - ecart,
      ecart, 
      commentaire_caissiere: commentaire 
    }]);

  if (retourError) throw retourError;

  // 3. Handle Cash Discrepancy (Ecart) as a Financial Entry
  if (Math.abs(ecart) > 0) {
    const isLoss = ecart < 0;
    const { error: ecartErr } = await insforge.database.from('depenses').insert([{
      date: new Date().toISOString(),
      categorie: isLoss ? 'Manquant Caisse' : 'Surplus Caisse',
      description: `Écart de caisse - Livreur #${livreurId.slice(0,8)} - Feuille #${feuilleRouteId.slice(0,8)}`,
      montant: Math.abs(ecart),
      paye_par_id: caissiereId,
      created_at: new Date().toISOString()
    }]);
    if (ecartErr) throw ecartErr;
  }
};

export const reopenFeuilleRoute = async (id: string): Promise<void> => {
  // 1. Supprimer l'enregistrement caisse_retours associé
  const { error: retourErr } = await insforge.database
    .from('caisse_retours')
    .delete()
    .eq('feuille_route_id', id);

  if (retourErr) throw retourErr;

  // 2. Remettre la feuille en cours
  const { error } = await insforge.database
    .from('feuilles_route')
    .update({
      statut_feuille: 'en_cours',
      montant_encaisse: 0,
      ecart_caisse: 0,
      date_traitement: null
    })
    .eq('id', id);

  if (error) throw error;

  // 3. Remettre les commandes "terminee/livree" en "en_cours_livraison"
  // FIRST: Get commands that will change
  const { data: cmdsToRevert } = await insforge.database
    .from('commandes')
    .select('id').limit(100000)
    .in('statut_commande', ['terminee', 'livree'])
    .eq('feuille_route_id', id);

  const cmdIds = (cmdsToRevert || []).map(c => c.id);

  if (cmdIds.length > 0) {
    const { error: cmdErr } = await insforge.database
      .from('commandes')
      .update({
        statut_commande: 'en_cours_livraison',
        date_livraison_effective: null
      })
      .in('id', cmdIds);

    if (cmdErr) throw cmdErr;

    // 4. Revert stock (Entree) because they are no longer "livree"
    const { data: lines } = await insforge.database
      .from('lignes_commandes')
      .select('*').limit(100000)
      .in('commande_id', cmdIds);
      
    if (lines) {
      for (const l of lines) {
        await addMouvementStock({
          produit_id: l.produit_id,
          commande_id: l.commande_id,
          type_mouvement: 'entree',
          quantite: l.quantite,
          reference: `Annulation Caisse / Feuille Réouverte (Cmd #${l.commande_id.substring(0,8)})`
        } as any);
      }
    }
  }

export const getRangeFinancials = async (startDateStr: string, endDateStr?: string): Promise<any> => {
  const start = new Date(startDateStr);
  start.setHours(0,0,0,0);
  
  const end = endDateStr ? new Date(endDateStr) : new Date(startDateStr);
  end.setHours(23,59,59,999);

  const startStr = start.toISOString();
  const endStr = end.toISOString();

  const selectCols = 'id, montant_total, statut_commande, mode_paiement, frais_livraison, updated_at, date_creation, date_livraison_effective, total_primes_installation, clients(nom_complet, telephone_secondaire), lignes:lignes_commandes(*, produits(prix_achat))';

  // 1. Get Caisse Retours for the range
  const { data: retours, error: retoursError } = await insforge.database
    .from('caisse_retours')
    .select('*').limit(100000)
    .gte('date', startStr)
    .lte('date', endStr);

  if (retoursError) throw retoursError;

  const successStats = '(livree,terminee)';
  const filterString = `and(statut_commande.in.${successStats},date_livraison_effective.gte."${startStr}",date_livraison_effective.lte."${endStr}"),and(statut_commande.not.in.${successStats},date_creation.gte."${startStr}",date_creation.lte."${endStr}")`;

  // 2. Get all orders in range using unified logic
  const { data: commandes, error: err1 } = await insforge.database
    .from('commandes')
    .select(selectCols).limit(100000)
    .or(filterString);

  if (err1) throw err1;

  // 5. Get Depenses in range
  const { data: depenses } = await insforge.database
    .from('depenses')
    .select('*').limit(100000)
    .gte('date', startStr)
    .lte('date', endStr);

  return { retours: retours || [], commandes, depenses: depenses || [] };
};
