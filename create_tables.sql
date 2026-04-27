CREATE TABLE IF NOT EXISTS fournisseurs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom TEXT NOT NULL,
    contact TEXT,
    email TEXT,
    adresse TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lignes_depenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    depense_id UUID REFERENCES depenses(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantite NUMERIC DEFAULT 1,
    prix_unitaire NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS achats_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fournisseur_id UUID REFERENCES fournisseurs(id),
    depense_id UUID REFERENCES depenses(id) ON DELETE CASCADE,
    date_achat TIMESTAMPTZ DEFAULT now(),
    statut_reception TEXT DEFAULT 'Reçu',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mouvements_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produit_id UUID REFERENCES produits(id),
    type TEXT NOT NULL,
    quantite NUMERIC NOT NULL,
    motif TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
