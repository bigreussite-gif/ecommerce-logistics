export type Role = 'ADMIN' | 'GESTIONNAIRE' | 'AGENT_APPEL' | 'LOGISTIQUE' | 'LIVREUR' | 'CAISSIERE' | 'AGENT_MIXTE';

export type Permission = 
  | 'DASHBOARD'
  | 'PRODUITS'
  | 'COMMANDES'
  | 'CENTRE_APPEL'
  | 'LOGISTIQUE'
  | 'LIVREUR'
  | 'CAISSE'
  | 'CLIENTS'
  | 'HISTORIQUE'
  | 'ADMIN'
  | 'PROFIL'
  | 'FINANCE'
  | 'COMMUNES'
  | 'GESTION_LIVREURS'
  | 'TRESORERIE';

export interface User {
  id: string;
  email: string;
  role: Role;
  nom_complet: string;
  telephone?: string;
  password?: string;
  communes_servies?: string[]; 
  permissions?: string[]; // Dynamic permissions
  actif?: boolean;
  tenant_id?: string;
}

export interface Produit {
  id: string;
  nom: string;
  description?: string;
  prix_achat: number;
  prix_vente: number;
  prix_promo?: number;
  promo_debut?: any; // Date or Timestamp
  promo_fin?: any;
  devise: string;
  sku: string;
  stock_actuel: number;
  stock_minimum: number;
  actif: boolean;
  images?: string[];
  image_url?: string;
  categorie_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  tenant_id?: string;
}

export interface Client {
  id: string;
  nom_complet: string;
  telephone: string;
  email?: string;
  adresse?: string;
  commune?: string;
  ville?: string;
  remarques?: string;
}

export interface Categorie {
  id: string;
  nom: string;
  description?: string;
}

export type StatutCommande = 'nouvelle' | 'a_rappeler' | 'en_attente_appel' | 'validee' | 'en_cours_livraison' | 'livree' | 'retour_livreur' | 'absent' | 'echouee' | 'annulee' | 'terminee' | 'retour_stock' | 'retour_client';

export interface Commande {
  id: string;
  date_creation: Date | any; // allow firestore timestamp
  client_id: string;
  nom_client?: string;
  telephone_client?: string;
  source_commande: string;
  statut_commande: StatutCommande;
  montant_total: number;
  frais_livraison: number;
  mode_paiement: string;
  commune_livraison: string;
  adresse_livraison: string;
  notes_client?: string;
  notes?: string;
  agent_appel_id?: string;
  livreur_id?: string;
  feuille_route_id?: string;
  date_validation_appel?: Date | any;
  date_livraison_prevue?: Date | string;
  date_livraison_effective?: Date | any;
  montant_encaisse?: number;
  notes_livreur?: string;
  commentaire_agent?: string;
  // Extras for Dashboard/Reporting
  nombre_produits?: number;
  lignes?: LigneCommande[];
  created_by?: string;
  wa_sent?: { type: string, date: string }[];
}

export interface LigneCommande {
  id: string;
  commande_id: string;
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
  prix_achat_unitaire?: number; // Captures cost at time of sale
  montant_ligne: number;
}

export interface AppelCommande {
  id: string;
  commande_id: string;
  agent_appel_id: string;
  date_appel: Date | any;
  resultat_appel: 'validee' | 'a_rappeler' | 'annulee' | 'injoignable' | 'echouee';
  commentaire_agent?: string;
}

export interface FeuilleRoute {
  id: string;
  date: Date | any;
  livreur_id: string;
  statut_feuille: 'en_cours' | 'cloturee' | 'terminee' | 'annulee';
  communes_couvertes: string[];
  total_commandes: number;
  total_montant_theorique: number;
  lien_pdf?: string;
  date_traitement?: string | Date;
  // Extras
  montant_encaisse?: number;
  ecart_caisse?: number;
  nom_livreur?: string;
}

export interface MouvementStock {
  id: string;
  produit_id: string;
  type_mouvement: 'entree' | 'sortie' | 'retour';
  quantite: number;
  date: Date | string;
  reference?: string;
  commentaire?: string;
  tenant_id?: string;
  fait_par?: string;
}

export interface Commune {
  id: string;
  nom: string;
  tarif_livraison: number;
}

export interface CaisseRetour {
  id: string;
  date: Date | any;
  livreur_id: string;
  feuille_route_id: string;
  montant_remis_par_livreur: number;
  montant_attendu: number;
  ecart: number;
  commentaire_caissiere?: string;
  caissiere_id?: string;
}

export interface Depense {
  id: string;
  date: Date | string;
  categorie: string;
  montant: number;
  description?: string;
  piece_jointe_url?: string;
  paye_par_id?: string;
}
