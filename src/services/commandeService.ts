import { Commande, LigneCommande } from '../types';
import { insforge } from '../lib/insforge';
import { addMouvementStock } from './produitService';
import { getCommuneByName } from './adminService';

export const getCommandeWithLines = async (id: string): Promise<Commande & { lignes: LigneCommande[] }> => {
  const { data: cmd, error: cmdError } = await insforge.database
    .from('commandes')
    .select('*, clients(*)')
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

export const getCommandes = async (limit = 50, offset = 0): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone, telephone_secondaire), lignes:lignes_commandes(*, produits(*))')
    .order('date_creation', { ascending: false })
    .range(offset, offset + limit - 1);
  
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
      getCommandes(100).then(callback); // Fetch top 100 for better performance
    }
  };
  fetch();
  // Sync every 5 seconds for a more "real-time" feel
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

  // Auto-set shipping fee from commune if not provided or 0
  if ((!commande.frais_livraison || commande.frais_livraison === 0) && commande.commune_livraison) {
     try {
        const zone = await getCommuneByName(commande.commune_livraison);
        if (zone) {
           commande.frais_livraison = zone.tarif_livraison;
           // If montant_total was calculated without fee, add it (assuming UI sends total including fee)
           // Actually, the UI usually calculates total = subtotal + fee. 
           // If fee was 0, total = subtotal. We should update total.
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
  return id;
};

export const updateCommandeStatus = async (id: string, status: string, additionalData: any = {}): Promise<void> => {
  // 1. Fetch current status and lines
  const { data: currentCmd } = await insforge.database
    .from('commandes')
    .select('statut_commande')
    .eq('id', id)
    .single();

  if (!currentCmd) throw new Error("Commande introuvable");
  const prevStatus = currentCmd.statut_commande;
  const nextStatus = status;

  const resetRouteSheets = ['validee', 'a_rappeler', 'en_attente_appel', 'annulee'];
  // 2. Prepare CLEAN update payload - VERY IMPORTANT to avoid 400 errors from unknown columns
  const updatePayload: any = { 
    statut_commande: nextStatus
  };

  // Map only allowed fields from additionalData to correct DB columns
  // REMOVED 'notes' to avoid PGRST204 cache error
  if (additionalData.notes_client !== undefined) updatePayload.notes_client = additionalData.notes_client;
  if (additionalData.notes_livreur !== undefined) updatePayload.notes_livreur = additionalData.notes_livreur;
  if (additionalData.commentaire_agent !== undefined) updatePayload.commentaire_agent = additionalData.commentaire_agent;
  if (additionalData.livreur_id !== undefined) updatePayload.livreur_id = additionalData.livreur_id;
  if (additionalData.feuille_route_id !== undefined) updatePayload.feuille_route_id = additionalData.feuille_route_id;
  if (additionalData.agent_appel_id !== undefined) updatePayload.agent_appel_id = additionalData.agent_appel_id;
  if (additionalData.montant_total !== undefined) updatePayload.montant_total = additionalData.montant_total;
  if (additionalData.commune_livraison !== undefined) updatePayload.commune_livraison = additionalData.commune_livraison;
  if (additionalData.adresse_livraison !== undefined) updatePayload.adresse_livraison = additionalData.adresse_livraison;
  if (additionalData.date_livraison_effective !== undefined) updatePayload.date_livraison_effective = additionalData.date_livraison_effective;
  if (additionalData.date_livraison_prevue !== undefined) updatePayload.date_livraison_prevue = additionalData.date_livraison_prevue;
  if (additionalData.date_validation_appel !== undefined) updatePayload.date_validation_appel = additionalData.date_validation_appel;
  if (additionalData.frais_livraison !== undefined) {
    updatePayload.frais_livraison = additionalData.frais_livraison;
  } else if (additionalData.commune_livraison) {
    // If commune changed but fee not provided, look it up
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
  
  if (error) {
    console.error("Order status update error:", error);
    throw error;
  }

  // 3. Stock management state machine
  // activeStates means the products are "out" of the main warehouse stock
  // We include 'echouee' and 'retour_livreur' because the physical products are still in the field/with courier
  const activeStates = ['en_attente_appel', 'validee', 'en_cours_livraison', 'livree', 'terminee', 'echouee', 'retour_livreur'];

  const wasActive = activeStates.includes(prevStatus?.toLowerCase());
  const isNowActive = activeStates.includes(nextStatus?.toLowerCase());

  // If transition changes active status, move stock
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
};

/**
 * Confirme la réintégration en stock ou le retrait définitif (défaillant)
 */
export const confirmRMAMovement = async (id: string, choice: 'REUTILISABLE' | 'DEFAILLANT', notes: string = ''): Promise<void> => {
  const { data: cmd, error: fetchErr } = await insforge.database
    .from('commandes')
    .select('*, lignes:lignes_commandes(*)')
    .eq('id', id)
    .single();

  if (fetchErr || !cmd) throw new Error("Commande non trouvée");

  // 1. Mettre à jour le statut de la commande
  // Le passage à 'retour_stock' va déclencher l'auto-restock SI c'est REUTILISABLE.
  // Mais attendez, si c'est DEFAILLANT, on veut AUSSI qu'elle soit inactive, mais on veut compenser la sortie.
  
  await updateCommandeStatus(id, 'retour_stock', {
    notes_livreur: notes ? `${cmd.notes_livreur || ''} | RMA: ${choice} - ${notes}` : cmd.notes_livreur
  });

  // 2. Si c'est défaillant, on fait une sortie immédiate pour compenser le restock auto qui a eu lieu lors de updateCommandeStatus
  if (choice === 'DEFAILLANT') {
    if (cmd.lignes && cmd.lignes.length > 0) {
      for (const l of cmd.lignes) {
        await addMouvementStock({
          produit_id: l.produit_id,
          type_mouvement: 'sortie',
          quantite: l.quantite,
          reference: `Article Défaillant (Cmd #${id.slice(0,8)})`
        } as any);
      }
    }
  }

  // 3. Enregistrer dans la table retours pour le suivi des défaillants
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

  // wasDelivered is unused here
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
};

export const bulkUpdateCommandeStatus = async (ids: string[], status: string, additionalData: any = {}): Promise<void> => {
  // Parallelize updates for massive speed boost
  const updatePromises = ids.map(id => 
    updateCommandeStatus(id, status, additionalData).catch(e => {
      console.error(`Error updating order ${id}:`, e);
    })
  );
  await Promise.all(updatePromises);
};

export const getTopSellingProducts = async (limit = 10, days?: number, start?: string, end?: string): Promise<{ nom: string, nb_ventes: number, total_ca: number, total_sorties: number, taux_succes: number }[]> => {
  let query = insforge.database
    .from('lignes_commandes')
    .select('*, commandes!inner(statut_commande, date_creation, date_livraison_effective)');

  if (days && days > 0) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const iso = startDate.toISOString();
    query = query.or(`date_livraison_effective.gte.${iso},and(date_livraison_effective.is.null,date_creation.gte.${iso})`, { foreignTable: 'commandes' });
  } else if (start && end) {
    query = query.or(`and(date_livraison_effective.gte."${start}",date_livraison_effective.lte."${end}"),and(date_livraison_effective.is.null,date_creation.gte."${start}",date_creation.lte."${end}")`, { foreignTable: 'commandes' });
  }

  const { data: lines, error: linesError } = await query;
  
  if (linesError) throw linesError;
  
  const aggregates: Record<string, { nb: number, ca: number, sorties: number, livrees: number, echecs: number, name: string }> = {};
  
  (lines || []).forEach((l: any) => {
    const key = l.nom_produit.trim().toUpperCase();
    
    if (!aggregates[key]) {
      aggregates[key] = { nb: 0, ca: 0, sorties: 0, livrees: 0, echecs: 0, name: l.nom_produit };
    }
    
    // Support both object and array return from PostgREST join
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

  return Object.values(aggregates)
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
    .sort((a, b) => b.nb_ventes - a.nb_ventes)
    .slice(0, limit);
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
    query = query.or(`and(date_livraison_effective.gte."${start}",date_livraison_effective.lte."${end}"),and(date_livraison_effective.is.null,date_creation.gte."${start}",date_creation.lte."${end}")`, { foreignTable: 'commandes' });
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
};

export const getFinancialData = async (startDate?: string, endDate?: string): Promise<(Commande & { lignes: LigneCommande[] })[]> => {
  const terminalStats = '(livree,terminee,echouee,retour_livreur,retour_stock,annulee,retour_client)';
  const filterString = `and(date_livraison_effective.gte."${startDate}",date_livraison_effective.lte."${endDate}"),and(updated_at.gte."${startDate}",updated_at.lte."${endDate}",statut_commande.in.${terminalStats})`;
  
  const { data: orders, error: orderError } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone), lignes:lignes_commandes(*)')
    .or(filterString)
    .order('date_creation', { ascending: false });

  if (orderError) throw orderError;
  if (!orders) return [];

  return orders.map((o: any) => ({
    ...o,
    nom_client: o.clients?.nom_complet,
    telephone_client: o.clients?.telephone,
    lignes: o.lignes || []
  }));
};

export const updateCommandeLignesAndStock = async (commandeId: string, oldLines: LigneCommande[], newLines: any[]): Promise<void> => {
  // Identify added, updated, and removed lines
  const oldMap = new Map(oldLines.map(l => [l.id, l]));
  
  // 1. Remove lines not in newLines
  for (const oldLine of oldLines) {
    if (!newLines.find(l => l.id === oldLine.id)) {
      // Re-add stock
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

  // 2. Add or update new lines
  for (const newLine of newLines) {
    if (!newLine.id) {
      // It's a new line - fetch cost price first
      // It's a new line - skip fetch if not needed

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

      // Subtract stock
      await addMouvementStock({
        produit_id: newLine.produit_id,
        type_mouvement: 'sortie',
        quantite: newLine.quantite,
        reference: `Sortie Nouvel Article Cmd #${commandeId.substring(0, 8)}`
      } as any);
    } else {
      // It's an update
      const oldLine = oldMap.get(newLine.id);
      if (oldLine) {
        const diff = newLine.quantite - oldLine.quantite;
        
        if (diff !== 0) {
          // Update quantity and amounts
          await insforge.database
            .from('lignes_commandes')
            .update({
              quantite: newLine.quantite,
              choix_installation: !!newLine.choix_installation,
              frais_installation: newLine.frais_installation || 0,
              montant_ligne: newLine.montant_ligne,
            })
            .eq('id', newLine.id);

          // Update stock: if qty increased, sortie diff. If decreased, retour |diff|
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
};

export const logWhatsAppMessage = async (commandeId: string, _type: string): Promise<void> => {
  await insforge.database
    .from('commandes')
    .update({ statut_commande: 'en_attente_appel' } as any) // dummy update to trigger something if needed
    .eq('id', commandeId);
};

export const createBulkCommandes = async (data: any[]): Promise<{ count: number, error?: string }> => {
  if (!data || data.length === 0) return { count: 0 };

  try {
    // 1. Charger tout le catalogue produits pour correspondance SKU
    const { data: products } = await insforge.database
      .from('produits')
      .select('id, nom, sku, prix_vente, stock_actuel');
    
    const productMap = new Map<string, any>();
    const productById = new Map<string, any>();
    (products || []).forEach(p => {
      if (p.sku) productMap.set(String(p.sku).trim().toUpperCase(), p);
      productById.set(p.id, p);
    });

    // 2. Gestion des clients en masse
    const cleanPhone = (p: any): string => String(p || '').replace(/\D/g, '').slice(-10);
    
    const phonesInFile = Array.from(new Set(data.map(item => cleanPhone(item.client.telephone)).filter(p => p.length >= 8)));
    
    // Charger UNIQUEMENT les clients existants concernés pour éviter les lenteurs sur gros catalogues
    const { data: existingClients } = await insforge.database
      .from('clients')
      .select('id, telephone, telephone_secondaire')
      .or(`telephone.in.(${phonesInFile.join(',')}),telephone_secondaire.in.(${phonesInFile.join(',')})`);
    
    const clientMapByPhone = new Map<string, string>();
    (existingClients || []).forEach(c => {
      const p1 = cleanPhone(c.telephone);
      const p2 = cleanPhone(c.telephone_secondaire);
      if (p1) clientMapByPhone.set(p1, c.id);
      if (p2) clientMapByPhone.set(p2, c.id);
    });

    // Identifier les nouveaux clients à créer
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

    // Insertion groupée des nouveaux clients
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

    // 3. Préparer les commandes et lignes
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

    // 4. Insertion groupée des commandes
    const { data: createdCmds, error: cmdErr } = await insforge.database
      .from('commandes')
      .insert(commandesToInsert)
      .select();

    if (cmdErr) throw new Error(`Erreur insertion commandes groupée: ${cmdErr.message}`);

    // 5. Insertion groupée des lignes et mouvements de stock
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
      
      // Mise à jour groupée des stocks produits
      const upsertData = Array.from(stockUpdatesMap.entries()).map(([prodId, delta]) => {
        const prod = productById.get(prodId);
        return {
          id: prodId,
          stock_actuel: (prod?.stock_actuel || 0) - delta
        };
      });

      if (upsertData.length > 0) {
        const { error: upsertErr } = await insforge.database
          .from('produits')
          .upsert(upsertData, { onConflict: 'id' });
        if (upsertErr) console.error("Erreur mise à jour stocks bulk:", upsertErr);
      }
    }

    return { count: createdCmds?.length || 0 };
  } catch (err: any) {
    console.error("Global import fail:", err);
    return { count: 0, error: err.message };
  }
};

export const updateCommandeBase = async (id: string, commande: Partial<Commande>, currentLines: LigneCommande[], newLines: any[]): Promise<void> => {
  // 1. Update the main order record
  const { error: cmdError } = await insforge.database
    .from('commandes')
    .update({
      client_id: commande.client_id,
      source_commande: commande.source_commande,
      statut_commande: commande.statut_commande,
      montant_total: commande.montant_total,
      frais_livraison: commande.frais_livraison,
      mode_paiement: commande.mode_paiement,
      commune_livraison: commande.commune_livraison,
      quartier_livraison: commande.quartier_livraison,
      adresse_livraison: commande.adresse_livraison,
      notes_client: commande.notes_client,
      remise_totale: commande.remise_totale,
      total_primes_installation: (newLines || []).reduce((acc, l) => acc + (!!l.choix_installation ? (Number(l.frais_installation) || 0) : 0), 0)
    })
    .eq('id', id);

  if (cmdError) throw cmdError;

  // 2. Synchronize lines and stock
  await updateCommandeLignesAndStock(id, currentLines, newLines);
};
