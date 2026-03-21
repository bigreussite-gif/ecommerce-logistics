-- SCRIPTS POUR L'ÉTAPE 4 : PROFIT NET & DÉPENSES
-- À exécuter dans l'éditeur SQL de votre tableau de bord InsForge / Supabase.

-- 1. Création de la table des dépenses
CREATE TABLE IF NOT EXISTS depenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date TIMESTAMPTZ DEFAULT now(),
  categorie TEXT NOT NULL, -- 'Loyé', 'Salaire', 'Marketing', 'Logistique', 'Autre'
  montant NUMERIC(15, 2) NOT NULL DEFAULT 0,
  description TEXT,
  piece_jointe_url TEXT,
  paye_par_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activation de la sécurité RLS pour les dépenses
ALTER TABLE depenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff access depenses" ON depenses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'GESTIONNAIRE'))
);

-- 2. Mise à jour de lignes_commandes pour capturer le coût d'achat au moment de la vente
-- Cela permet un calcul de profit historique précis même si le prix d'achat change plus tard.
ALTER TABLE lignes_commandes ADD COLUMN IF NOT EXISTS prix_achat_unitaire NUMERIC(15, 2) DEFAULT 0;

-- 3. (Optionnel) Peupler prix_achat_unitaire pour les anciennes commandes basées sur le prix actuel
UPDATE lignes_commandes lc
SET prix_achat_unitaire = p.prix_achat
FROM produits p
WHERE lc.produit_id = p.id AND lc.prix_achat_unitaire = 0;
