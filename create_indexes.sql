CREATE INDEX IF NOT EXISTS idx_cmd_client ON public.commandes(client_id);
CREATE INDEX IF NOT EXISTS idx_cmd_fr ON public.commandes(feuille_route_id);
CREATE INDEX IF NOT EXISTS idx_cmd_livreur ON public.commandes(livreur_id);
CREATE INDEX IF NOT EXISTS idx_cmd_statut ON public.commandes(statut_commande);
CREATE INDEX IF NOT EXISTS idx_cmd_date ON public.commandes(date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_cmd_commune ON public.commandes(commune_livraison);

CREATE INDEX IF NOT EXISTS idx_lcmd_cmd ON public.lignes_commandes(commande_id);
CREATE INDEX IF NOT EXISTS idx_lcmd_prod ON public.lignes_commandes(produit_id);

CREATE INDEX IF NOT EXISTS idx_mvt_prod ON public.mouvements_stock(produit_id);
CREATE INDEX IF NOT EXISTS idx_mvt_date ON public.mouvements_stock(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clients_tel ON public.clients(telephone);

NOTIFY pgrst, 'reload schema';
