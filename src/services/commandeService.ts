import { Commande, LigneCommande } from '../types';
import { insforge } from '../lib/insforge';
import { addMouvementStock } from './produitService';
import { getCommuneByName } from './adminService';
import { globalEventBus, EVENTS } from '../utils/events';

export const getCommandeWithLines = async (id: string): Promise<Commande & { lignes: LigneCommande[] }> => {
  const { data: cmd, error: cmdError } = await insforge.database
    .from('commandes')
    .select('*, clients(*), livreur:users!commandes_livreur_id_fkey(nom_complet)')
    .eq('id', id)
    .single();

  if (cmdError) throw cmdError;

  const { data: lines, error: linesError } = await insforge.database
    .from('lignes_commandes')
    .select('*')
    .eq('commande_id', id);

  if (linesError) throw linesError;

  return {
    ...cmd,
    nom_client: cmd.clients?.nom_complet,
    telephone_client: cmd.clients?.telephone,
    telephone_secondaire: cmd.clients?.telephone_secondaire,
    lignes: lines || []
  };
};

/**
 * Fetches multiple orders with their lines in optimized queries.
 */
export const getCommandesByIds = async (ids: string[]): Promise<(Commande & { lignes: LigneCommande[] })[]> => {
  if (ids.length === 0) return [];

  const { data: cmds, error: cmdError } = await insforge.database
    .from('commandes')
    .select('*, clients(*), livreur:users!commandes_livreur_id_fkey(nom_complet)')
    .in('id', ids);

  if (cmdError) throw cmdError;

  const { data: allLines, error: linesError } = await insforge.database
    .from('lignes_commandes')
    .select('*')
    .in('commande_id', ids);

  if (linesError) throw linesError;

  return (cmds || []).map(cmd => ({
    ...cmd,
    nom_client: cmd.clients?.nom_complet,
    telephone_client: cmd.clients?.telephone,
    telephone_secondaire: cmd.clients?.telephone_secondaire,
    lignes: (allLines || []).filter(l => l.commande_id === cmd.id)
  }));
};

export const getCommandes = async (limit: number | null = null, offset = 0): Promise<Commande[]> => {
  let query = insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone, telephone_secondaire), lignes:lignes_commandes(*, produits(*))')
    .order('date_creation', { ascending: false });
  
  if (limit !== null) {
    query = query.range(offset, offset + limit - 1);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  return (data || []).map((c: any) => ({
    ...c,
    nom_client: c.clients?.nom_complet,
    telephone_client: c.clients?.telephone,
    telephone_secondaire: c.clients?.telephone_secondaire
  }));
};

export const subscribeToCommandes = (callback: (commandes: Commande[]) => void) => {
  const fetch = () => {
    if (document.visibilityState === 'visible') {
      getCommandes(null).then(callback); 
    }
  };
  fetch();
  const interval = setInterval(fetch, 5000);
  return () => clearInterval(interval);
};

export const getCommandesByStatus = async (statusList: string[]): Promise<(Commande & { lignes: LigneCommande[] })[]> => {
  const { data: orders, error: orderError } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone, telephone_secondaire), lignes:lignes_commandes(*)')
    .in('statut_commande', statusList)
    .order('date_creation', { ascending: false });

  if (orderError) throw orderError;
  
  return (orders || []).map((o: any) => ({
    ...o,
    nom_client: o.clients?.nom_complet,
    telephone_client: o.clients?.telephone,
    telephone_secondaire: o.clients?.telephone_secondaire,
    lignes: o.lignes || []
  }));
};

export const subscribeToCommandesByStatus = (statusList: string[], callback: (commandes: Commande[]) => void) => {
  const fetch = () => {
    if (document.visibilityState === 'visible') {
      getCommandesByStatus(statusList).then(callback);
    }
  };
  fetch();
  const interval = setInterval(fetch, 5000);
  return () => clearInterval(interval);
};

export const createCommandeBase = async (commande: Omit<Commande, 'id'>, lignes: Omit<LigneCommande, 'id' | 'commande_id'>[]): Promise<string> => {
  commande.date_creation = new Date();
  commande.statut_commande = 'en_attente_appel'; 

  if ((!commande.frais_livraison || commande.frais_livraison === 0) && commande.commune_livraison) {
     try {
        const zone = await getCommuneByName(commande.commune_livraison);
        if (zone) {
           commande.frais_livraison = zone.tarif_livraison;
        }
     } catch (e) { console.error("Could not fetch commune fee during creation", e); }
  }

  const totalPrimes = (lignes || []).reduce((acc, l) => acc + (!!l.choix_installation ? (Number(l.frais_installation) || 0) : 0), 0);

  const { data: cmdData, error: cmdError } = await insforge.database
    .from('commandes')
    .insert([{
      client_id: commande.client_id,
      source_commande: commande.source_commande,
      statut_commande: commande.statut_commande,
      montant_total: Number(commande.montant_total) || 0,
      frais_livraison: Number(commande.frais_livraison) || 0,
      remise_totale: Number(commande.remise_totale) || 0,
      total_primes_installation: totalPrimes,
      mode_paiement: commande.mode_paiement || 'Cash à la livraison',
      commune_livraison: commande.commune_livraison || '',
      quartier_livraison: commande.quartier_livraison || '',
      adresse_livraison: commande.adresse_livraison || '',
      notes_client: commande.notes_client || '',
      date_creation: (commande.date_creation instanceof Date ? commande.date_creation.toISOString() : commande.date_creation)
    }])
    .select();

  if (cmdError) {
    console.error("Erreur création commande:", cmdError);
    throw new Error(`Erreur insertion commande: ${cmdError.message}`);
  }
  
  const id = cmdData?.[0]?.id;
  if (!id) throw new Error("ID de commande non généré par la base de données.");

  // Process items sequentially to avoid stock race conditions
  for (const l of lignes) {
    const { error: lineError } = await insforge.database
      .from('lignes_commandes')
      .insert([{ 
        commande_id: id,
        produit_id: l.produit_id,
        nom_produit: l.nom_produit,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        choix_installation: !!l.choix_installation,
        frais_installation: l.frais_installation || 0,
        montant_ligne: l.montant_ligne
      }]);
    
    if (lineError) {
      console.error("Erreur ligne commande:", lineError);
      throw new Error(`Erreur ligne commande (${l.nom_produit}): ${lineError.message}`);
    }

    try {
      await addMouvementStock({
        produit_id: l.produit_id,
        type_mouvement: 'sortie',
        quantite: l.quantite,
        reference: `Sortie Cmd #${id.substring(0, 8)}`
      } as any);
    } catch (stkErr) {
      console.warn("Erreur mise à jour stock (non bloquant):", stkErr);
    }
  }
  
  globalEventBus.emit(EVENTS.COMMANDES_UPDATED);
  return id;
};

// Helper for stock state machine
const activeStates = ['en_attente_appel', 'validee', 'en_cours_livraison', 'livree', 'terminee', 'echouee', 'retour_livreur'];

export const updateCommandeStatus = async (id: string, status: string, additionalData: any = {}): Promise<void> => {
  const { data: currentCmd } = await insforge.database
    .from('commandes')
    .select('statut_commande')
    .eq('id', id)
    .single();

  if (!currentCmd) throw new Error("Commande introuvable");
  const prevStatus = currentCmd.statut_commande;
  const nextStatus = status;

  const resetRouteSheets = ['validee', 'a_rappeler', 'en_attente_appel', 'annulee'];
  const updatePayload: any = { 
    statut_commande: nextStatus
  };

  if (additionalData.notes_client !== undefined) updatePayload.notes_client = additionalData.notes_client;
  if (additionalData.notes_livreur !== undefined) updatePayload.notes_livreur = additionalData.notes_livreur;
  if (additionalData.commentaire_agent !== undefined) updatePayload.commentaire_agent = additionalData.commentaire_agent;
  if (additionalData.livreur_id !== undefined) updatePayload.livreur_id = additionalData.livreur_id;
  if (additionalData.feuille_route_id !== undefined) updatePayload.feuille_route_id = additionalData.feuille_route_id;
  if (additionalData.agent_appel_id !== undefined) updatePayload.agent_appel_id = additionalData.agent_appel_id;
  if (additionalData.montant_total !== undefined) updatePayload.montant_total = additionalData.montant_total;
  if (additionalData.commune_livraison !== undefined) updatePayload.commune_livraison = additionalData.commune_livraison;
  if (additionalData.adresse_livraison !== undefined) updatePayload.adresse_livraison = additionalData.adresse_livraison;
  if (additionalData.quartier_livraison !== undefined) updatePayload.quartier_livraison = additionalData.quartier_livraison;
  if (additionalData.date_livraison_effective !== undefined) updatePayload.date_livraison_effective = additionalData.date_livraison_effective;
  if (additionalData.date_livraison_prevue !== undefined) updatePayload.date_livraison_prevue = additionalData.date_livraison_prevue;
  if (additionalData.date_validation_appel !== undefined) updatePayload.date_validation_appel = additionalData.date_validation_appel;
  
  if (additionalData.frais_livraison !== undefined) {
    updatePayload.frais_livraison = additionalData.frais_livraison;
  } else if (additionalData.commune_livraison) {
    try {
      const zone = await getCommuneByName(additionalData.commune_livraison);
      if (zone) updatePayload.frais_livraison = zone.tarif_livraison;
    } catch (e) { console.error("Could not fetch commune fee during status update", e); }
  }

  if (resetRouteSheets.includes(nextStatus?.toLowerCase())) {
    updatePayload.feuille_route_id = null;
    updatePayload.livreur_id = null;
  }

  const { error } = await insforge.database
    .from('commandes')
    .update(updatePayload)
    .eq('id', id);
  
  if (error) throw error;

  const wasActive = activeStates.includes(prevStatus?.toLowerCase());
  const isNowActive = activeStates.includes(nextStatus?.toLowerCase());

  if (wasActive !== isNowActive) {
    try {
      const { data: lines } = await insforge.database
        .from('lignes_commandes')
        .select('*')
        .eq('commande_id', id);

      if (lines && lines.length > 0) {
        for (const l of lines) {
          await addMouvementStock({
            produit_id: l.produit_id,
            type_mouvement: isNowActive ? 'sortie' : 'entree',
            quantite: l.quantite,
            reference: `${isNowActive ? 'Sortie' : 'Retour'} Stock (${nextStatus}) Cmd #${id.substring(0, 8)}`
          } as any);
        }
      }
    } catch (stockErr) {
      console.error("Erreur Stock Flow:", stockErr);
    }
  }
  
  globalEventBus.emit(EVENTS.COMMANDES_UPDATED);
};

export const bulkUpdateCommandeStatus = async (ids: string[], status: string, additionalData: any = {}): Promise<void> => {
  if (ids.length === 0) return;

  // Vérification et rafraîchissement de la session pour éviter l'erreur "JWT expired"
  const { data: authData, error: authError } = await insforge.auth.refreshSession();
  if (authError || !authData?.session) {
    throw new Error("Votre session a expiré. Veuillez recharger la page pour vous reconnecter.");
  }

  // 1. Get current statuses to determine stock movements
  const { data: currentCmds } = await insforge.database
    .from('commandes')
    .select('id, statut_commande')
    .in('id', ids);

  if (!currentCmds) return;

  const nextStatus = status;
  const isNextActive = activeStates.includes(nextStatus.toLowerCase());

  // 2. Perform bulk update on commandes table
  const updatePayload: any = { statut_commande: nextStatus };
  if (additionalData.agent_appel_id) updatePayload.agent_appel_id = additionalData.agent_appel_id;
  if (additionalData.date_validation_appel) updatePayload.date_validation_appel = additionalData.date_validation_appel;
  if (additionalData.notes_livreur) updatePayload.notes_livreur = additionalData.notes_livreur;
  
  // Clear route sheets if needed
  const resetRouteSheets = ['validee', 'a_rappeler', 'en_attente_appel', 'annulee'];
  if (resetRouteSheets.includes(nextStatus.toLowerCase())) {
    updatePayload.feuille_route_id = null;
    updatePayload.livreur_id = null;
  }

  const { error: bulkErr } = await insforge.database
    .from('commandes')
    .update(updatePayload)
    .in('id', ids);

  if (bulkErr) throw bulkErr;

  // 3. Handle stock movements for commands that changed "active" state
  const idsChangingState = currentCmds
    .filter(c => activeStates.includes(c.statut_commande?.toLowerCase()) !== isNextActive)
    .map(c => c.id);

  if (idsChangingState.length > 0) {
    const { data: lines } = await insforge.database
      .from('lignes_commandes')
      .select('*')
      .in('commande_id', idsChangingState);

    if (lines && lines.length > 0) {
      // Group movements by product to minimize DB calls if possible, 
      // but addMouvementStock is not bulk-friendly yet, so we process sequentially
      for (const l of lines) {
        await addMouvementStock({
          produit_id: l.produit_id,
          type_mouvement: isNextActive ? 'sortie' : 'entree',
          quantite: l.quantite,
          reference: `Bulk ${isNextActive ? 'Sortie' : 'Retour'} (${nextStatus})`
        } as any);
      }
    }
  }

  globalEventBus.emit(EVENTS.COMMANDES_UPDATED);
};

export const confirmRMAMovement = async (id: string, choice: 'REUTILISABLE' | 'DEFAILLANT', notes: string = ''): Promise<void> => {
  const { data: cmd, error: fetchErr } = await insforge.database
    .from('commandes')
    .select('*, lignes:lignes_commandes(*, produits(*))')
    .eq('id', id)
    .single();

  if (fetchErr || !cmd) throw new Error("Commande non trouvée");

  await updateCommandeStatus(id, 'retour_stock', {
    notes_livreur: notes ? `${cmd.notes_livreur || ''} | RMA: ${choice} - ${notes}` : cmd.notes_livreur
  });

  if (choice === 'DEFAILLANT') {
    let totalLossAmount = 0;
    if (cmd.lignes && cmd.lignes.length > 0) {
      for (const l of cmd.lignes) {
        // Calculate loss amount based on purchase price
        const prodData = Array.isArray(l.produits) ? l.produits[0] : l.produits;
        const purchasePrice = l.prix_achat_unitaire || prodData?.prix_achat || 0;
        totalLossAmount += (l.quantite * Number(purchasePrice));

        // Mark as exit in stock history
        await addMouvementStock({
          produit_id: l.produit_id,
          type_mouvement: 'sortie',
          quantite: l.quantite,
          reference: `Article Défaillant (Cmd #${id.slice(0,8)})`,
          commentaire: notes
        } as any);
      }
    }

    // Record the loss as an expense
    if (totalLossAmount > 0) {
      await insforge.database
        .from('depenses')
        .insert([{
          description: `Perte Stock RMA #${id.slice(-6).toUpperCase()}`,
          montant: totalLossAmount,
          categorie: 'Pertes & Dommages',
          date: new Date().toISOString(),
          created_at: new Date().toISOString()
        }]);
    }
  }

  // Record in retours table for audit trail
  if (cmd.lignes && cmd.lignes.length > 0) {
    for (const l of cmd.lignes) {
      await insforge.database
        .from('retours')
        .insert([{
          commande_id: id,
          motif: choice === 'DEFAILLANT' ? 'Défaillant au retour' : 'Réintégré',
          solution: choice === 'DEFAILLANT' ? 'Mis au rebut / Pertes' : 'Remis en vente',
          notes: notes,
          etat_produit: choice,
          produit_id: l.produit_id,
          quantite: l.quantite
        }]);
    }
  }
  
  globalEventBus.emit(EVENTS.COMMANDES_UPDATED);
  globalEventBus.emit(EVENTS.STOCK_UPDATED);
};

export const reactivateFailedCommande = async (id: string, notes?: string): Promise<void> => {
  await updateCommandeStatus(id, 'en_attente_appel', { 
    notes_client: `[RÉACTIVATION ÉCHEC] ${notes || ''}${new Date().toLocaleString()}`,
    feuille_route_id: null,
    livreur_id: null
  });
};

export const registerReturn = async (id: string, motif: string, solution: string, notes: string, etat_produit: string): Promise<void> => {
  const { data: cmd, error: fetchErr } = await insforge.database
    .from('commandes')
    .select('*, lignes:lignes_commandes(*)')
    .eq('id', id)
    .single();

  if (fetchErr || !cmd) throw new Error("Commande non trouvée");

  const productLine = cmd.lignes?.[0];
  await insforge.database
    .from('retours')
    .insert([{
      commande_id: id,
      motif,
      solution,
      notes,
      etat_produit,
      produit_id: productLine?.produit_id,
      quantite: productLine?.quantite || 1
    }]);

  const finalNotes = `[RETOUR CLIENT] ${etat_produit} - Motif: ${motif}. ${notes}${cmd.notes_client ? "\n---\n" + cmd.notes_client : ""}`;
  
  const { error: updateErr } = await insforge.database
    .from('commandes')
    .update({
      statut_commande: 'retour_client',
      notes_client: finalNotes
    } as any)
    .eq('id', id);

  if (updateErr) throw updateErr;

  if (cmd.lignes && cmd.lignes.length > 0) {
    for (const l of cmd.lignes) {
      if (etat_produit === 'REUTILISABLE') {
        await addMouvementStock({
          produit_id: l.produit_id,
          type_mouvement: 'entree',
          quantite: l.quantite,
          reference: `Retour au Stock Client (Cmd #${id.slice(0,8)})`
        } as any);
      } else {
        await addMouvementStock({
          produit_id: l.produit_id,
          type_mouvement: 'sortie',
          quantite: 0,
          reference: `Article ${etat_produit} (Cmd #${id.slice(0,8)})`
        } as any);
      }
    }
  }
  
  globalEventBus.emit(EVENTS.COMMANDES_UPDATED);
};

export const getTopSellingProducts = async (limit: number | null = null, days?: number, start?: string, end?: string): Promise<{ nom: string, nb_ventes: number, total_ca: number, total_sorties: number, taux_succes: number }[]> => {
  let query = insforge.database
    .from('lignes_commandes')
    .select('*, commandes!inner(statut_commande, date_creation, date_livraison_effective)');

  if (days && days > 0) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const iso = startDate.toISOString();
    query = query.or(`date_livraison_effective.gte.${iso},and(date_livraison_effective.is.null,date_creation.gte.${iso})`, { foreignTable: 'commandes' });
  } else if (start && end) {
    query = query.or(`and(date_livraison_effective.gte.${start},date_livraison_effective.lte.${end}),and(date_livraison_effective.is.null,date_creation.gte.${start},date_creation.lte.${end})`, { foreignTable: 'commandes' });
  }

  const { data: lines, error: linesError } = await query;
  
  if (linesError) throw linesError;
  
  const aggregates: Record<string, { nb: number, ca: number, sorties: number, livrees: number, echecs: number, name: string }> = {};
  
  (lines || []).forEach((l: any) => {
    const key = l.nom_produit.trim().toUpperCase();
    
    if (!aggregates[key]) {
      aggregates[key] = { nb: 0, ca: 0, sorties: 0, livrees: 0, echecs: 0, name: l.nom_produit };
    }
    
    const cmd = Array.isArray(l.commandes) ? l.commandes[0] : l.commandes;
    if (!cmd) return;

    const status = cmd.statut_commande?.toLowerCase();
    
    const isSortie = ['en_cours_livraison', 'livree', 'terminee', 'echouee', 'retour_stock', 'retour_livreur'].includes(status);
    const isLivree = ['livree', 'terminee'].includes(status);
    const isEchec = ['echouee', 'retour_stock', 'retour_livreur'].includes(status);
    
    if (isLivree) {
      aggregates[key].nb += Number(l.quantite || 0);
      aggregates[key].ca += Number(l.montant_ligne || 0);
      aggregates[key].livrees += Number(l.quantite || 0);
    }
    
    if (isEchec) {
      aggregates[key].echecs += Number(l.quantite || 0);
    }
    
    if (isSortie) {
      aggregates[key].sorties += Number(l.quantite || 0);
    }
  });

  const result = Object.values(aggregates)
    .map(stats => {
      const finishedAttempts = stats.livrees + stats.echecs;
      return { 
        nom: stats.name, 
        nb_ventes: stats.livrees, 
        total_ca: stats.ca,
        total_sorties: stats.sorties,
        taux_succes: finishedAttempts > 0 ? Math.round((stats.livrees / finishedAttempts) * 100) : 0
      };
    })
    .sort((a, b) => b.nb_ventes - a.nb_ventes);
  
  if (limit !== null) {
    return result.slice(0, limit);
  }
  return result;
};

export const getCategoryPerformance = async (days?: number, start?: string, end?: string): Promise<{ nom: string, nb_articles: number, ca: number }[]> => {
  let query = insforge.database
    .from('lignes_commandes')
    .select('*, commandes!inner(statut_commande, date_creation, date_livraison_effective), produits(categorie_id, categories(nom))');

  if (days && days > 0) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const iso = startDate.toISOString();
    query = query.or(`date_livraison_effective.gte.${iso},and(date_livraison_effective.is.null,date_creation.gte.${iso})`, { foreignTable: 'commandes' });
  } else if (start && end) {
    query = query.or(`and(date_livraison_effective.gte.${start},date_livraison_effective.lte.${end}),and(date_livraison_effective.is.null,date_creation.gte.${start},date_creation.lte.${end})`, { foreignTable: 'commandes' });
  }

  const { data: lines, error: linesError } = await query;
  if (linesError) throw linesError;
  
  const aggregates: Record<string, { nb: number, ca: number, name: string }> = {};
  
  (lines || []).forEach((l: any) => {
    const prod = Array.isArray(l.produits) ? l.produits[0] : l.produits;
    if (!prod) return;
    
    const cat = Array.isArray(prod.categories) ? prod.categories[0] : prod.categories;
    const catName = cat?.nom || 'Sans Catégorie';
    
    if (!aggregates[catName]) {
      aggregates[catName] = { nb: 0, ca: 0, name: catName };
    }
    
    const cmd = Array.isArray(l.commandes) ? l.commandes[0] : l.commandes;
    if (!cmd) return;

    const status = cmd.statut_commande?.toLowerCase();
    const isLivree = ['livree', 'terminee'].includes(status);
    
    if (isLivree) {
      aggregates[catName].nb += Number(l.quantite || 0);
      aggregates[catName].ca += Number(l.montant_ligne || 0);
    }
  });

  return Object.values(aggregates)
    .map(a => ({ nom: a.name, nb_articles: a.nb, ca: a.ca }))
    .sort((a, b) => b.ca - a.ca);
};

export const deleteCommande = async (id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('commandes')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  globalEventBus.emit(EVENTS.COMMANDES_UPDATED);
};

export const getFinancialData = async (startDate?: string, endDate?: string): Promise<(Commande & { lignes: LigneCommande[] })[]> => {
  const terminalStats = '(livree,terminee,echouee,retour_livreur,retour_stock,annulee,retour_client)';
  
  // Dates with special characters (like ISO timestamps) MUST be quoted in .or() filters
  const start = startDate ? `"${startDate}"` : '"2000-01-01"';
  const end = endDate ? `"${endDate}"` : '"2099-12-31"';
  
  const filterString = `and(date_livraison_effective.gte.${start},date_livraison_effective.lte.${end}),and(updated_at.gte.${start},updated_at.lte.${end},statut_commande.in.${terminalStats})`;
  
  const { data: orders, error: orderError } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone), lignes:lignes_commandes(*, produits(prix_achat))')
    .or(filterString)
    .order('date_creation', { ascending: false });

  if (orderError) {
    console.error("Financial fetch error details:", orderError);
    throw orderError;
  }
  if (!orders) return [];

  return orders.map((o: any) => ({
    ...o,
    nom_client: o.clients?.nom_complet,
    telephone_client: o.clients?.telephone,
    lignes: o.lignes || []
  }));
};

export const updateCommandeBase = async (id: string, updates: Partial<Commande>, oldLines: LigneCommande[], newLines: any[]): Promise<void> => {
  const { error: cmdError } = await insforge.database
    .from('commandes')
    .update(updates as any)
    .eq('id', id);

  if (cmdError) throw cmdError;

  await updateCommandeLignesAndStock(id, oldLines, newLines);
  
  globalEventBus.emit(EVENTS.COMMANDES_UPDATED);
};

export const updateCommandeLignesAndStock = async (commandeId: string, oldLines: LigneCommande[], newLines: any[]): Promise<void> => {
  const oldMap = new Map(oldLines.map(l => [l.id, l]));
  
  for (const oldLine of oldLines) {
    if (!newLines.find(l => l.id === oldLine.id)) {
      await addMouvementStock({
        produit_id: oldLine.produit_id,
        type_mouvement: 'retour',
        quantite: oldLine.quantite,
        reference: `RETOUR Suppr Ligne Cmd #${commandeId.substring(0, 8)}`
      } as any);

      await insforge.database
        .from('lignes_commandes')
        .delete()
        .eq('id', oldLine.id);
    }
  }

  for (const newLine of newLines) {
    if (!newLine.id) {
      await insforge.database
        .from('lignes_commandes')
        .insert([{
          ...newLine,
          choix_installation: !!newLine.choix_installation,
          frais_installation: newLine.frais_installation || 0,
          commande_id: commandeId
        }])
        .select()
        .single();

      await addMouvementStock({
        produit_id: newLine.produit_id,
        type_mouvement: 'sortie',
        quantite: newLine.quantite,
        reference: `Sortie Nouvel Article Cmd #${commandeId.substring(0, 8)}`
      } as any);
    } else {
      const oldLine = oldMap.get(newLine.id);
      if (oldLine) {
        const diff = newLine.quantite - oldLine.quantite;
        
        if (diff !== 0) {
          await insforge.database
            .from('lignes_commandes')
            .update({
              quantite: newLine.quantite,
              choix_installation: !!newLine.choix_installation,
              frais_installation: newLine.frais_installation || 0,
              montant_ligne: newLine.montant_ligne,
            })
            .eq('id', newLine.id);

          await addMouvementStock({
            produit_id: newLine.produit_id,
            type_mouvement: diff > 0 ? 'sortie' : 'retour',
            quantite: Math.abs(diff),
            reference: `Modif Qté Ligne Cmd #${commandeId.substring(0, 8)}`
          } as any);
        }
      }
    }
  }
  
  globalEventBus.emit(EVENTS.COMMANDES_UPDATED);
};

export const logWhatsAppMessage = async (commandeId: string, _type: string): Promise<void> => {
  await insforge.database
    .from('commandes')
    .update({ statut_commande: 'en_attente_appel' } as any) 
    .eq('id', commandeId);
  
  globalEventBus.emit(EVENTS.COMMANDES_UPDATED);
};

export const createBulkCommandes = async (data: any[]): Promise<{ count: number, error?: string }> => {
  if (!data || data.length === 0) return { count: 0 };

  try {
    // Vérification et rafraîchissement de la session pour éviter l'erreur "JWT expired"
    const { data: authData, error: authError } = await insforge.auth.refreshSession();
    if (authError || !authData?.session) {
      throw new Error("Votre session a expiré. Veuillez recharger la page pour vous reconnecter.");
    }

    const { data: products } = await insforge.database
      .from('produits')
      .select('id, nom, sku, prix_vente, stock_actuel');
    
    const productMap = new Map<string, any>();
    const productById = new Map<string, any>();
    (products || []).forEach((p: any) => {
      if (p.sku) productMap.set(String(p.sku).trim().toUpperCase(), p);
      productById.set(p.id, p);
    });

    const cleanPhone = (p: any): string => String(p || '').replace(/\D/g, '').slice(-10);
    const rawPhones = data.map(item => String(item.client?.telephone || '').trim()).filter(p => p.length >= 8);
    const cleanPhones = data.map(item => cleanPhone(item.client?.telephone)).filter(p => p.length >= 8);
    
    // We must search both the cleaned version and the exact raw version to avoid missing existing exact matches
    const phonesInFile = Array.from(new Set([...rawPhones, ...cleanPhones]));
    
    // Format the array for Supabase .in() filter (wrap in double quotes to handle spaces/plus signs)
    const formattedPhones = phonesInFile.map(p => `"${p}"`).join(',');
    
    const { data: existingClients } = await insforge.database
      .from('clients')
      .select('id, telephone, telephone_secondaire')
      .or(`telephone.in.(${formattedPhones}),telephone_secondaire.in.(${formattedPhones})`);
    
    const clientMapByPhone = new Map<string, string>();
    (existingClients || []).forEach(c => {
      const p1 = cleanPhone(c.telephone);
      const p2 = cleanPhone(c.telephone_secondaire);
      if (p1) clientMapByPhone.set(p1, c.id);
      if (p2) clientMapByPhone.set(p2, c.id);
    });

    const newClientsToCreate: any[] = [];
    const processedPhones = new Set<string>();

    data.forEach(item => {
      const phone = cleanPhone(item.client.telephone);
      if (phone && phone.length >= 8 && !clientMapByPhone.has(phone) && !processedPhones.has(phone)) {
        newClientsToCreate.push({
          nom_complet: item.client.nom_complet,
          telephone: item.client.telephone,
          telephone_secondaire: item.client.telephone_secondaire || '',
          commune: item.commune || '',
          quartier: item.quartier || '',
          adresse: item.adresse || ''
        });
        processedPhones.add(phone);
      }
    });

    if (newClientsToCreate.length > 0) {
      const { data: createdClients, error: clientErr } = await insforge.database
        .from('clients')
        .insert(newClientsToCreate)
        .select();
      
      if (clientErr) throw new Error(`Erreur création clients groupée: ${clientErr.message}`);
      
      (createdClients || []).forEach(c => {
        const p = cleanPhone(c.telephone);
        if (p) clientMapByPhone.set(p, c.id);
      });
    }

    const commandesToInsert: any[] = [];
    const itemsWithValidData: any[] = [];
    const now = new Date().toISOString();
    const source = `Import ${now.slice(0, 10)}`;

    data.forEach(item => {
      const phone = cleanPhone(item.client.telephone);
      const clientId = clientMapByPhone.get(phone);
      if (!clientId) return;

      let totalCmd = 0;
      const cmdLines: any[] = [];

      item.lines.forEach((l: any) => {
        const prod = productMap.get(String(l.produit).trim().toUpperCase());
        if (prod) {
          const prix = prod.prix_vente;
          const montant = prix * l.quantite;
          totalCmd += montant;
          cmdLines.push({
            produit_id: prod.id,
            nom_produit: prod.nom,
            quantite: l.quantite,
            prix_unitaire: prix,
            montant_ligne: montant
          });
        }
      });

      if (cmdLines.length > 0) {
        commandesToInsert.push({
          client_id: clientId,
          source_commande: source,
          statut_commande: 'en_attente_appel',
          montant_total: totalCmd + (item.frais_livraison || 0),
          frais_livraison: item.frais_livraison || 0,
          commune_livraison: item.commune || '',
          quartier_livraison: item.quartier || '',
          adresse_livraison: item.adresse || '',
          notes_client: item.notes || '',
          date_creation: now
        });
        itemsWithValidData.push({ lines: cmdLines });
      }
    });

    if (commandesToInsert.length === 0) return { count: 0, error: "Aucune donnée valide à importer." };

    const { data: createdCmds, error: cmdErr } = await insforge.database
      .from('commandes')
      .insert(commandesToInsert)
      .select();

    if (cmdErr) throw new Error(`Erreur insertion commandes groupée: ${cmdErr.message}`);

    const linesToInsert: any[] = [];
    const stockMovesToInsert: any[] = [];
    const stockUpdatesMap = new Map<string, number>();

    (createdCmds || []).forEach((cmd, idx) => {
      const sourceItem = itemsWithValidData[idx];
      sourceItem.lines.forEach((l: any) => {
        linesToInsert.push({
          commande_id: cmd.id,
          ...l
        });
        stockMovesToInsert.push({
          produit_id: l.produit_id,
          type_mouvement: 'sortie',
          quantite: l.quantite,
          reference: `Import Cmd #${cmd.id.substring(0, 8)}`,
          date: now
        });
        
        const currentDelta = stockUpdatesMap.get(l.produit_id) || 0;
        stockUpdatesMap.set(l.produit_id, currentDelta + l.quantite);
      });
    });

    if (linesToInsert.length > 0) {
      const { error: linesErr } = await insforge.database
        .from('lignes_commandes')
        .insert(linesToInsert);
      if (linesErr) throw new Error(`Erreur lignes: ${linesErr.message}`);
    }

    if (stockMovesToInsert.length > 0) {
      await insforge.database
        .from('mouvements_stock')
        .insert(stockMovesToInsert);
      
      for (const [prodId, delta] of stockUpdatesMap.entries()) {
        const prod = productById.get(prodId);
        if (prod) {
          await insforge.database
            .from('produits')
            .update({ stock_actuel: (Number(prod.stock_actuel) || 0) - delta })
            .eq('id', prodId);
        }
      }
    }

    globalEventBus.emit(EVENTS.COMMANDES_UPDATED);
    return { count: createdCmds?.length || 0 };

  } catch (e: any) {
    console.error("Bulk Import Error:", e);
    return { count: 0, error: e.message };
  }
};
