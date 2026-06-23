import { Commande, User } from '../types';
import { insforge } from '../lib/insforge';
import { addMouvementStock } from './produitService';

export const getAvailableLivreurs = async (): Promise<User[]> => {
  const { data, error } = await insforge.database
    .from('users')
    .select('*')
    .eq('role', 'LIVREUR')
    .eq('actif', true);
  
  if (error) throw error;
  return data || [];
};

export const creerFeuilleRoute = async (livreurId: string, commandeIds: string[], vtcFraisMap?: Record<string, number>): Promise<string> => {
  // 1. Fetch commands to verify they exist and get totals
  const { data: cmdData, error: cmdFetchError } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone)')
    .in('id', commandeIds);

  if (cmdFetchError) throw new Error(`Erreur lors de la récupération des commandes : ${cmdFetchError.message}`);
  if (!cmdData || cmdData.length === 0) throw new Error("Aucune commande valide trouvée pour cette feuille de route.");
  
  const mappedCmds = cmdData.map((c: any) => ({
    ...c,
    nom_client: c.clients?.nom_complet,
    telephone_client: c.clients?.telephone
  }));
  
  const total_montant = mappedCmds.reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0);
  const communes = Array.from(new Set(mappedCmds.map(c => c.commune_livraison).filter(Boolean)));

  // 2. Insert the delivery sheet
  const { data: frData, error: frError } = await insforge.database
    .from('feuilles_route')
    .insert([{
      date: new Date().toISOString(),
      livreur_id: livreurId,
      statut_feuille: 'en_cours',
      communes_couvertes: communes,
      total_commandes: cmdData.length,
      total_montant_theorique: total_montant
    }])
    .select();

  if (frError) throw new Error(`Erreur lors de la création de la feuille de route : ${frError.message}`);
  
  const feuilleId = frData?.[0]?.id;
  if (!feuilleId) throw new Error("Échec de la récupération de l'ID de la nouvelle feuille de route.");

  // 3. Batch update all orders in one request (Atomic and efficient)
  const { error: batchUpdateError } = await insforge.database
    .from('commandes')
    .update({ 
      statut_commande: 'en_cours_livraison', 
      livreur_id: livreurId, 
      feuille_route_id: feuilleId 
    })
    .in('id', commandeIds);
  
  if (batchUpdateError) throw new Error(`Erreur lors de l'affectation des commandes : ${batchUpdateError.message}`);

  // 3.5. Update frais_livraison and montant_total for each VTC command
  if (vtcFraisMap && Object.keys(vtcFraisMap).length > 0) {
    for (const cmdId of Object.keys(vtcFraisMap)) {
      const newFrais = vtcFraisMap[cmdId];
      if (newFrais !== undefined && newFrais >= 0) {
        const cmd = cmdData.find((c: any) => c.id === cmdId);
        if (cmd) {
          const oldFrais = cmd.frais_livraison || 0;
          const diff = newFrais - oldFrais;
          const newMontantTotal = (Number(cmd.montant_total) || 0) + diff;
          
          const { error: vtcError } = await insforge.database
            .from('commandes')
            .update({ 
              frais_livraison: newFrais,
              montant_total: newMontantTotal,
              cout_vtc: newFrais // also save it in cout_vtc for traceability if needed
            })
            .eq('id', cmdId);
            
          if (vtcError) console.error("Erreur lors de la mise à jour des frais VTC:", vtcError);
        }
      }
    }
  }

  // 4. Handle stock movements for commands that were inactive (e.g., reportée/annulée) and are now active/out for delivery again
  try {
    const inactiveStates = ['a_rappeler', 'annulee', 'retour_client', 'retour_stock'];
    for (const c of mappedCmds) {
      if (inactiveStates.includes(c.statut_commande?.toLowerCase())) {
        const { data: lines } = await insforge.database
          .from('lignes_commandes')
          .select('*')
          .eq('commande_id', c.id);
        
        if (lines && lines.length > 0) {
          for (const l of lines) {
            await addMouvementStock({
              produit_id: l.produit_id,
              type_mouvement: 'sortie',
              quantite: l.quantite,
              reference: `Sortie Stock (Feuille Route) Cmd #${c.id.substring(0, 8)}`,
              commentaire: `Sortie automatique pour réexpédition (précédemment reportée/annulée) sur la feuille #${feuilleId.slice(0, 8)}`
            } as any);
          }
        }
      }
    }
  } catch (stkErr) {
    console.error("Erreur réajustement stock réaffectation feuille route:", stkErr);
  }

  return feuilleId;
};

export const getFeuillesRoute = async () => {
  const { data, error } = await insforge.database
    .from('feuilles_route')
    .select('*, users(*)')
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getCommandesByFeuille = async (feuilleId: string): Promise<Commande[]> => {
  const { data: orders, error: orderError } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone)')
    .eq('feuille_route_id', feuilleId);

  if (orderError) throw orderError;
  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map(o => o.id);
  
  // Fetch associated lines
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

export const getCommandeByReference = async (id: string): Promise<Commande | null> => {
  const { data, error } = await insforge.database
    .from('commandes')
    .select('*, clients(nom_complet, telephone)')
    .eq('id', id)
    .single();

  if (error) return null;
  
  return {
    ...data,
    nom_client: data.clients?.nom_complet,
    telephone_client: data.clients?.telephone
  };
};

export const supprimerFeuilleRoute = async (feuilleId: string): Promise<void> => {
  // 1. Reset orders that were still 'en_cours_livraison' back to 'validee'
  await insforge.database
    .from('commandes')
    .update({ 
      statut_commande: 'validee', 
      livreur_id: null, 
      feuille_route_id: null 
    })
    .eq('feuille_route_id', feuilleId)
    .eq('statut_commande', 'en_cours_livraison');

  // 2. Clear feuille_route_id for any other orders
  await insforge.database
    .from('commandes')
    .update({ 
      feuille_route_id: null 
    })
    .eq('feuille_route_id', feuilleId);

  // 3. Delete the sheet
  const { error } = await insforge.database
    .from('feuilles_route')
    .delete()
    .eq('id', feuilleId);

  if (error) throw error;
};

export const updateLivreurFeuilleRoute = async (feuilleId: string, newLivreurId: string): Promise<void> => {
  // 1. Check if the feuille exists
  const { data: fr, error: frError } = await insforge.database
    .from('feuilles_route')
    .select('id, statut_feuille')
    .eq('id', feuilleId)
    .single();

  if (frError || !fr) throw new Error("Feuille de route introuvable");
  if (fr.statut_feuille !== 'en_cours') throw new Error("Impossible de modifier une feuille de route clôturée");

  // 2. Update the feuille_route
  const { error: updateFrError } = await insforge.database
    .from('feuilles_route')
    .update({ livreur_id: newLivreurId })
    .eq('id', feuilleId);

  if (updateFrError) throw updateFrError;

  // 3. Update the commands attached to it
  const { error: updateCmdError } = await insforge.database
    .from('commandes')
    .update({ livreur_id: newLivreurId })
    .eq('feuille_route_id', feuilleId);

  if (updateCmdError) throw updateCmdError;
};

export const reassignCommandeToFeuille = async (commandeId: string, targetFeuilleId: string | undefined, targetLivreurId: string): Promise<void> => {
  // 1. Get the command to check current state
  const { data: cmd, error: cmdError } = await insforge.database
    .from('commandes')
    .select('montant_total, feuille_route_id, statut_commande')
    .eq('id', commandeId)
    .single();
    
  if (cmdError || !cmd) throw new Error("Commande introuvable");
  
  const oldFeuilleId = cmd.feuille_route_id;
  const oldStatus = cmd.statut_commande;
  const montant = Number(cmd.montant_total) || 0;

  // 2. Update the command
  const { error: updateCmdError } = await insforge.database
    .from('commandes')
    .update({ 
      feuille_route_id: targetFeuilleId || null, 
      livreur_id: targetLivreurId,
      statut_commande: 'en_cours_livraison' 
    })
    .eq('id', commandeId);

  if (updateCmdError) throw updateCmdError;

  // Handle stock movements if the command was previously in an inactive state where stock was returned
  try {
    const inactiveStates = ['a_rappeler', 'annulee', 'retour_client', 'retour_stock'];
    if (inactiveStates.includes(oldStatus?.toLowerCase())) {
      const { data: lines } = await insforge.database
        .from('lignes_commandes')
        .select('*')
        .eq('commande_id', commandeId);
      
      if (lines && lines.length > 0) {
        for (const l of lines) {
          await addMouvementStock({
            produit_id: l.produit_id,
            type_mouvement: 'sortie',
            quantite: l.quantite,
            reference: `Sortie Stock (Transfert) Cmd #${commandeId.substring(0, 8)}`,
            commentaire: `Sortie automatique pour réexpédition lors du transfert (précédemment reportée/annulée)`
          } as any);
        }
      }
    }
  } catch (stkErr) {
    console.error("Erreur réajustement stock transfert commande:", stkErr);
  }

  // 3. Update the NEW sheet stats
  if (targetFeuilleId) {
    const { data: targetFeuille } = await insforge.database
      .from('feuilles_route')
      .select('total_commandes, total_montant_theorique')
      .eq('id', targetFeuilleId)
      .single();

    if (targetFeuille) {
      await insforge.database
        .from('feuilles_route')
        .update({
          total_commandes: (targetFeuille.total_commandes || 0) + 1,
          total_montant_theorique: Number(targetFeuille.total_montant_theorique || 0) + montant
        })
        .eq('id', targetFeuilleId);
    }
  }

  // 4. Update the OLD sheet stats (if it existed)
  if (oldFeuilleId && oldFeuilleId !== targetFeuilleId) {
    const { data: oldFeuille } = await insforge.database
      .from('feuilles_route')
      .select('total_commandes, total_montant_theorique')
      .eq('id', oldFeuilleId)
      .single();

    if (oldFeuille) {
      await insforge.database
        .from('feuilles_route')
        .update({
          total_commandes: Math.max(0, (oldFeuille.total_commandes || 0) - 1),
          total_montant_theorique: Math.max(0, Number(oldFeuille.total_montant_theorique || 0) - montant)
        })
        .eq('id', oldFeuilleId);
    }
  }
};
