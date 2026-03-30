-- Script de migration globale pour aligner la base de données sur le code
-- Exécuté le 30 Mars 2026

-- 1. Mise à jour de la table produits
ALTER TABLE produits RENAME COLUMN prix TO prix_vente;
ALTER TABLE produits RENAME COLUMN prix_barre TO prix_promo;
ALTER TABLE produits RENAME COLUMN quantite TO stock_actuel;
ALTER TABLE produits RENAME COLUMN seuil_alerte TO stock_minimum;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS prix_achat NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS devis TEXT DEFAULT 'XOF';
ALTER TABLE produits ADD COLUMN IF NOT EXISTS images TEXT[];

-- 2. Mise à jour de la table commandes
ALTER TABLE commandes RENAME COLUMN statut TO statut_commande;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS date_creation TIMESTAMPTZ DEFAULT now();
UPDATE commandes SET date_creation = created_at WHERE date_creation IS NULL;

ALTER TABLE commandes ADD COLUMN IF NOT EXISTS frais_livraison NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS commune_livraison TEXT;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS adresse_livraison TEXT;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS source_commande TEXT;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS notes_client TEXT;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS agent_appel_id UUID;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS feuille_route_id UUID;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS date_validation_appel TIMESTAMPTZ;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS date_livraison_effective TIMESTAMPTZ;
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS montant_encaisse NUMERIC(15, 2);
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS notes_livreur TEXT;

-- 3. Création des tables manquantes (utilisées par le code)
CREATE TABLE IF NOT EXISTS lignes_commandes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  commande_id UUID REFERENCES commandes(id) ON DELETE CASCADE,
  produit_id UUID REFERENCES produits(id),
  nom_produit TEXT NOT NULL,
  quantite INTEGER NOT NULL,
  prix_unitaire NUMERIC(15, 2) NOT NULL,
  prix_achat_unitaire NUMERIC(15, 2) DEFAULT 0,
  montant_ligne NUMERIC(15, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS depenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date TIMESTAMPTZ DEFAULT now(),
  categorie TEXT NOT NULL,
  montant NUMERIC(15, 2) NOT NULL DEFAULT 0,
  description TEXT,
  piece_jointe_url TEXT,
  paye_par_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Initialisation des données (migration des anciens champs produits/quantite)
INSERT INTO lignes_commandes (commande_id, produit_id, nom_produit, quantite, prix_unitaire, montant_ligne)
SELECT 
  c.id, 
  c.produit_id, 
  (SELECT nom FROM produits WHERE id = c.produit_id) as nom_produit,
  COALESCE(c.quantite, 1),
  (SELECT prix_vente FROM produits WHERE id = c.produit_id) as prix_unitaire,
  (SELECT prix_vente FROM produits WHERE id = c.produit_id) * COALESCE(c.quantite, 1) as montant_ligne
FROM commandes c
LEFT JOIN lignes_commandes lc ON c.id = lc.commande_id
WHERE lc.id IS NULL AND c.produit_id IS NOT NULL;
