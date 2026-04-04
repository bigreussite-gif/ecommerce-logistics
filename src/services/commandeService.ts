import { Commande, LigneCommande } from '../types';
import { insforge } from '../lib/insforge';
import { addMouvementStock } from './produitService';

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
    lignes: lines || []
  };
};

export const getCommandes = async (): Promise<Commande[]> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone)')
    .order('date_creation', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map((c: any) => ({
    ...c,
    nom_client: c.clients?.nom_complet,
    telephone_client: c.clients?.telephone
  }));
};

export const subscribeToCommandes = (callback: (commandes: Commande[]) => void) => {
  getCommandes().then(callback);
  const interval = setInterval(() => getCommandes().then(callback), 3000);
  return () => clearInterval(interval);
};

export const getCommandesByStatus = async (statusList: string[]): Promise<(Commande & { lignes: LigneCommande[] })[]> => {
  const { data: orders, error: orderError } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone)')
    .in('statut_commande', statusList)
    .order('date_creation', { ascending: false });

  if (orderError) throw orderError;

  const { data: lines, error: linesError } = await insforge.database
    .from('lignes_commandes')
    .select('*');

  if (linesError) throw linesError;
  
  return (orders || []).map((o: any) => ({
    ...o,
    nom_client: o.clients?.nom_complet,
    telephone_client: o.clients?.telephone,
    lignes: (lines || []).filter((l: any) => l.commande_id === o.id)
  }));
};

export const subscribeToCommandesByStatus = (statusList: string[], callback: (commandes: Commande[]) => void) => {
  getCommandesByStatus(statusList).then(callback);
  const interval = setInterval(() => getCommandesByStatus(statusList).then(callback), 3000);
  return () => clearInterval(interval);
};

export const createCommandeBase = async (commande: Omit<Commande, 'id'>, lignes: Omit<LigneCommande, 'id' | 'commande_id'>[]): Promise<string> => {
  commande.date_creation = new Date();
  commande.statut_commande = 'en_attente_appel'; 

  const { data: cmdData, error: cmdError } = await insforge.database
    .from('commandes')
    .insert([commande])
    .select();

  if (cmdError) {
    console.error("Erreur création commande:", cmdError);
    throw new Error(`Erreur insertion commande: ${cmdError.message}`);
  }
  
  const id = cmdData?.[0]?.id;
  if (!id) throw new Error("ID de commande non généré par la base de données.");

  for (const l of lignes) {
    // Fetch current purchase price to lock it in the line
    const { data: prodData } = await insforge.database
      .from('produits')
      .select('prix_achat')
      .eq('id', l.produit_id)
      .single();

    const { error: lineError } = await insforge.database
      .from('lignes_commandes')
      .insert([{ 
        ...l, 
        commande_id: id,
        prix_achat_unitaire: prodData?.prix_achat || 0 
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

  const resetRouteSheets = ['validee', 'a_rappeler', 'en_attente_appel'];
  const updatePayload: any = { 
    statut_commande: nextStatus, 
    ...additionalData, 
    updated_at: new Date() 
  };

  if (resetRouteSheets.includes(nextStatus?.toLowerCase())) {
    updatePayload.feuille_route_id = null;
    updatePayload.livreur_id = null; // Also clear livreur if it's being re-queued
  }

  // 2. Update status in DB
  const { error } = await insforge.database
    .from('commandes')
    .update(updatePayload)
    .eq('id', id);
  
  if (error) throw error;

  // 3. Stock management state machine
  const activeStates = ['en_attente_appel', 'validee', 'en_cours_livraison', 'livree', 'terminee'];

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

export const reactivateFailedCommande = async (id: string, notes?: string): Promise<void> => {
  await updateCommandeStatus(id, 'en_attente_appel', { 
    notes: `[RÉACTIVATION ÉCHEC] ${notes || ''}${new Date().toLocaleString()}`,
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

  const wasDelivered = ['livree', 'terminee'].includes(cmd.statut_commande?.toLowerCase());
  const finalNotes = `[RETOUR CLIENT] ${etat_produit} - Motif: ${motif}. ${notes}${cmd.notes ? "\n---\n" + cmd.notes : ""}`;
  
  const { error: updateErr } = await insforge.database
    .from('commandes')
    .update({
      statut_commande: 'retour_client',
      notes: finalNotes,
      montant_encaisse: wasDelivered ? 0 : cmd.montant_encaisse,
      updated_at: new Date().toISOString()
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
  for (const id of ids) {
    try {
      await updateCommandeStatus(id, status, additionalData);
    } catch (e) {
      console.error(`Error updating order ${id}:`, e);
    }
  }
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

export const deleteCommande = async (id: string): Promise<void> => {
  const { error } = await insforge.database
    .from('commandes')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export const getFinancialData = async (startDate?: string, endDate?: string): Promise<(Commande & { lignes: LigneCommande[] })[]> => {
  // Correct grouping: (date_livraison_effective IN range) OR (updated_at IN range)
  const filterString = `and(date_livraison_effective.gte.${startDate},date_livraison_effective.lte.${endDate}),and(updated_at.gte.${startDate},updated_at.lte.${endDate})`;
  
  let query = insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone)')
    .in('statut_commande', ['livree', 'terminee', 'LIVREE', 'TERMINEE'])
    .or(filterString);

  const { data: orders, error: orderError } = await query.order('updated_at', { ascending: false });

  if (orderError) throw orderError;
  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map(o => o.id);
  
  // Optimized: only fetch lines for these orders
  const { data: lines, error: linesError } = await insforge.database
    .from('lignes_commandes')
    .select('*')
    .in('commande_id', orderIds);

  if (linesError) throw linesError;

  return orders.map((o: any) => ({
    ...o,
    nom_client: o.clients?.nom_complet,
    telephone_client: o.clients?.telephone,
    lignes: (lines || []).filter((l: any) => l.commande_id === o.id)
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
      const { data: prodData } = await insforge.database
        .from('produits')
        .select('prix_achat')
        .eq('id', newLine.produit_id)
        .single();

      await insforge.database
        .from('lignes_commandes')
        .insert([{
          ...newLine,
          commande_id: commandeId,
          prix_achat_unitaire: prodData?.prix_achat || 0
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

export const logWhatsAppMessage = async (commandeId: string, type: string): Promise<void> => {
  const { data: cmd } = await insforge.database
    .from('commandes')
    .select('wa_sent')
    .eq('id', commandeId)
    .single();

  const newLog = { type, date: new Date().toISOString() };
  const waSent = Array.isArray(cmd?.wa_sent) ? [...(cmd.wa_sent as any), newLog] : [newLog];

  await insforge.database
    .from('commandes')
    .update({ wa_sent: waSent } as any)
    .eq('id', commandeId);
};
