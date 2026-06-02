import { Commande, FeuilleRoute, LigneCommande } from '../types';
import { insforge } from '../lib/insforge';
import { addMouvementStock } from './produitService';

/**
 * Helper to fetch and map livreur names to avoid duplication
 */
const fetchLivreurNames = async (data: any[]): Promise<Map<string, string>> => {
  if (!data || data.length === 0) return new Map();
  
  const userIds = Array.from(new Set(data.map(f => f.livreur_id).filter(Boolean)));
  if (userIds.length === 0) return new Map();

  const { data: userData } = await insforge.database
    .from('users')
    .select('id, nom_complet')
    .in('id', userIds);

  return new Map(userData?.map(u => [u.id, u.nom_complet]) || []);
};

export const getFeuillesEnCours = async (livreurId?: string): Promise<FeuilleRoute[]> => {
  let query = insforge.database
    .from('feuilles_route')
    .select('*')
    .in('statut_feuille', ['en_cours', 'cloturee']);

  if (livreurId) {
    query = query.eq('livreur_id', livreurId);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  if (!data || data.length === 0) return [];

  const nameMap = await fetchLivreurNames(data);

  return data.map((f: any) => ({
    ...f,
    nom_livreur: nameMap.get(f.livreur_id) || `Livreur #${f.livreur_id?.slice(0,5)}`
  }));
};

export const getFeuillesDuJour = async (): Promise<FeuilleRoute[]> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data, error } = await insforge.database
    .from('feuilles_route')
    .select('*')
    .in('statut_feuille', ['en_cours', 'cloturee'])
    .gte('date', todayStart.toISOString())
    .lte('date', todayEnd.toISOString())
    .order('date', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const nameMap = await fetchLivreurNames(data);
  return data.map((f: any) => ({
    ...f,
    nom_livreur: nameMap.get(f.livreur_id) || `Livreur #${f.livreur_id?.slice(0,5)}`
  }));
};

export const getCloturedFeuilles = async (): Promise<FeuilleRoute[]> => {
  const { data, error } = await insforge.database
    .from('feuilles_route')
    .select('*')
    .eq('statut_feuille', 'terminee')
    .order('date', { ascending: false });

  if (error) throw error;
  
  if (!data || data.length === 0) return [];

  const nameMap = await fetchLivreurNames(data);

  return data.map((f: any) => ({
    ...f,
    nom_livreur: nameMap.get(f.livreur_id) || `Livreur #${f.livreur_id?.slice(0,5)}`
  }));
};

export const getCommandesConcernees = async (feuilleRouteId: string): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone, telephone_secondaire), lignes:lignes_commandes(*)')
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
      .select('nom_complet')
      .eq('id', livreurId)
      .single();
    
    await insforge.database.from('depenses').insert([{
      date: new Date().toISOString(),
      categorie: 'Personnel / Prime',
      description: `Prime Livreur : ${livreur?.nom_complet || 'Agent'} - Feuille #${feuilleRouteId.slice(0,8)}`,
      montant: primeLivreur,
      mode_paiement: 'Espèces',
      valide: true,
      cree_par: caissiereId
    }]);
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
  const { data: lignesCommandes, error: linesError } = await insforge.database
    .from('lignes_commandes')
    .select('*')
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
    }
    
    await insforge.database
      .from('commandes')
      .update(updateData)
      .eq('id', res.id);

    // Update lines and recalculate total if delivered and lines are provided
    if (isDelivered && res.updatedLines) {
      const { data: cmdRef } = await insforge.database
        .from('commandes')
        .select('frais_livraison, remise_totale')
        .eq('id', res.id)
        .single();
        
      const shipping = Number(cmdRef?.frais_livraison) || 0;
      const remise = Number(cmdRef?.remise_totale) || 0;

      let newTotalPrimes = 0;
      let newMontantTotal = 0;

      for (const l of res.updatedLines) {
        const lineTotal = (Number(l.prix_unitaire) * Number(l.quantite)) + 
                          (l.choix_installation ? (Number(l.frais_installation) * Number(l.quantite)) : 0);
        newMontantTotal += lineTotal;
        if (l.choix_installation) newTotalPrimes += (Number(l.frais_installation) * Number(l.quantite));

        await insforge.database
          .from('lignes_commandes')
          .update({ 
            choix_installation: !!l.choix_installation, 
            montant_ligne: lineTotal,
            quantite: Number(l.quantite),
            prix_unitaire: Number(l.prix_unitaire)
          })
          .eq('id', l.id);
      }

      await insforge.database
        .from('commandes')
        .update({ 
          montant_total: newMontantTotal + shipping - remise, 
          total_primes_installation: newTotalPrimes 
        })
        .eq('id', res.id);
    }

    // Handle stock returns
    if (finalStatus === 'retour_stock' || finalStatus === 'annulee' || finalStatus === 'a_rappeler') {
      const linesToReturn = lignesCommandes.filter((l: any) => l.commande_id === res.id);
      for (const l of linesToReturn) {
        // By default, we put back in stock as "retour_livreur" reference
        // A warehouse audit will later determine if it's defective
        await addMouvementStock({
          produit_id: l.produit_id,
          type_mouvement: 'entree',
          quantite: l.quantite,
          reference: `Retour ${finalStatus === 'a_rappeler' ? 'Reporté' : 'Echec'} cmd #${res.id.slice(0,5)}`,
          commentaire: `Retour via Caisse (${finalStatus === 'a_rappeler' ? 'Reporté' : 'Échoué/Annulé'}) - Feuille #${feuilleRouteId.slice(0,8)}`
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
    await insforge.database.from('depenses').insert([{
      date: new Date().toISOString(),
      categorie: isLoss ? 'Manquant Caisse' : 'Surplus Caisse',
      description: `Écart de caisse - Livreur #${livreurId.slice(0,8)} - Feuille #${feuilleRouteId.slice(0,8)}`,
      montant: Math.abs(ecart),
      mode_paiement: 'Espèces',
      created_at: new Date().toISOString()
    }]);
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
  const { error: cmdErr } = await insforge.database
    .from('commandes')
    .update({
      statut_commande: 'en_cours_livraison',
      date_livraison_effective: null
    })
    .in('statut_commande', ['terminee', 'livree'])
    .eq('feuille_route_id', id);

  if (cmdErr) throw cmdErr;
};

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
    .select('*')
    .gte('date', startStr)
    .lte('date', endStr);

  if (retoursError) throw retoursError;

  // 2. Get orders delivered in range
  const { data: deliveredOrders, error: err1 } = await insforge.database
    .from('commandes')
    .select(selectCols)
    .gte('date_livraison_effective', startStr)
    .lte('date_livraison_effective', endStr);

  if (err1) throw err1;

  // 3. Get all sheets treated in range and find their orders
  const { data: sheets } = await insforge.database
    .from('feuilles_route')
    .select('id')
    .gte('date_traitement', startStr)
    .lte('date_traitement', endStr);

  const sheetIds = sheets?.map((s: any) => s.id) || [];
  let sheetOrders: any[] = [];

  if (sheetIds.length > 0) {
    const { data: so, error: err2 } = await insforge.database
      .from('commandes')
      .select(selectCols)
      .in('feuille_route_id', sheetIds);
    if (!err2 && so) sheetOrders = so;
  }

  // 4. Merge and deduplicate orders by id
  const allOrdersMap = new Map<string, any>();
  [...(deliveredOrders || []), ...sheetOrders].forEach(o => {
    if (o?.id) allOrdersMap.set(o.id, o);
  });
  const commandes = Array.from(allOrdersMap.values());

  // 5. Get Depenses in range
  const { data: depenses } = await insforge.database
    .from('depenses')
    .select('*')
    .gte('date', startStr)
    .lte('date', endStr);

  return { retours: retours || [], commandes, depenses: depenses || [] };
};
