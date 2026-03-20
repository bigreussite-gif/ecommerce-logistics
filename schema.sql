-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users (Extending auth.users)
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'GESTIONNAIRE', 'AGENT_APPEL', 'LOGISTIQUE', 'LIVREUR', 'CAISSIERE')),
  nom_complet TEXT NOT NULL,
  telephone TEXT,
  communes_servies TEXT[], -- For livreur
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage all users" ON users FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Table: produits
CREATE TABLE produits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom TEXT NOT NULL,
  description TEXT,
  prix_achat NUMERIC(15, 2) NOT NULL DEFAULT 0,
  prix_vente NUMERIC(15, 2) NOT NULL DEFAULT 0,
  prix_promo NUMERIC(15, 2),
  promo_debut TIMESTAMPTZ,
  promo_fin TIMESTAMPTZ,
  devise TEXT NOT NULL DEFAULT 'XOF',
  sku TEXT UNIQUE,
  stock_actuel INTEGER NOT NULL DEFAULT 0,
  stock_minimum INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  image_url TEXT,
  images TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE produits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public products access" ON produits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage products" ON produits FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'GESTIONNAIRE', 'LOGISTIQUE'))
);

-- Table: clients
CREATE TABLE clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom_complet TEXT NOT NULL,
  telephone TEXT UNIQUE NOT NULL,
  email TEXT,
  adresse TEXT,
  commune TEXT,
  ville TEXT,
  remarques TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff access clients" ON clients FOR ALL TO authenticated USING (true);

-- Table: commandes
CREATE TABLE commandes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date_creation TIMESTAMPTZ DEFAULT now(),
  client_id UUID REFERENCES clients(id),
  source_commande TEXT,
  statut_commande TEXT NOT NULL,
  montant_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
  frais_livraison NUMERIC(15, 2) DEFAULT 0,
  mode_paiement TEXT,
  commune_livraison TEXT,
  adresse_livraison TEXT,
  notes_client TEXT,
  agent_appel_id UUID REFERENCES users(id),
  livreur_id UUID REFERENCES users(id),
  feuille_route_id UUID,
  date_validation_appel TIMESTAMPTZ,
  date_livraison_effective TIMESTAMPTZ,
  montant_encaisse NUMERIC(15, 2),
  notes_livreur TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff access orders" ON commandes FOR ALL TO authenticated USING (true);

-- Table: lignes_commandes
CREATE TABLE lignes_commandes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  commande_id UUID REFERENCES commandes(id) ON DELETE CASCADE,
  produit_id UUID REFERENCES produits(id),
  nom_produit TEXT NOT NULL,
  quantite INTEGER NOT NULL,
  prix_unitaire NUMERIC(15, 2) NOT NULL,
  montant_ligne NUMERIC(15, 2) NOT NULL
);

ALTER TABLE lignes_commandes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff access order lines" ON lignes_commandes FOR ALL TO authenticated USING (true);

-- Table: mouvements_stock
CREATE TABLE mouvements_stock (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  produit_id UUID REFERENCES produits(id),
  type_mouvement TEXT NOT NULL CHECK (type_mouvement IN ('entree', 'sortie', 'retour')),
  quantite INTEGER NOT NULL,
  date TIMESTAMPTZ DEFAULT now(),
  reference TEXT,
  commentaire TEXT,
  fait_par UUID REFERENCES users(id)
);

ALTER TABLE mouvements_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff access stock movements" ON mouvements_stock FOR ALL TO authenticated USING (true);

-- Table: communes
CREATE TABLE communes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom TEXT NOT NULL,
  tarif_livraison NUMERIC(15, 2) NOT NULL DEFAULT 0
);

ALTER TABLE communes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read communes" ON communes FOR SELECT TO authenticated USING (true);

-- Table: feuilles_route
CREATE TABLE feuilles_route (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date TIMESTAMPTZ DEFAULT now(),
  livreur_id UUID REFERENCES users(id),
  statut_feuille TEXT NOT NULL DEFAULT 'en_cours',
  communes_couvertes TEXT[],
  total_commandes INTEGER DEFAULT 0,
  total_montant_theorique NUMERIC(15, 2) DEFAULT 0,
  lien_pdf TEXT,
  date_traitement TIMESTAMPTZ
);

ALTER TABLE feuilles_route ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff access feuilles route" ON feuilles_route FOR ALL TO authenticated USING (true);

-- Table: caisse_retours
CREATE TABLE caisse_retours (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date TIMESTAMPTZ DEFAULT now(),
  livreur_id UUID REFERENCES users(id),
  feuille_route_id UUID REFERENCES feuilles_route(id),
  montant_remis_par_livreur NUMERIC(15, 2) NOT NULL,
  montant_attendu NUMERIC(15, 2) NOT NULL,
  ecart NUMERIC(15, 2) NOT NULL,
  commentaire_caissiere TEXT,
  caissiere_id UUID REFERENCES users(id)
);

ALTER TABLE caisse_retours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff access caisse retours" ON caisse_retours FOR ALL TO authenticated USING (true);

-- Table: appels_commandes
CREATE TABLE appels_commandes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  commande_id UUID REFERENCES commandes(id) ON DELETE CASCADE,
  agent_appel_id UUID REFERENCES users(id),
  date_appel TIMESTAMPTZ DEFAULT now(),
  resultat_appel TEXT NOT NULL,
  commentaire_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE appels_commandes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff access appels" ON appels_commandes FOR ALL TO authenticated USING (true);
