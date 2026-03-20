export type Role = 'ADMIN' | 'GESTIONNAIRE' | 'AGENT_APPEL' | 'LOGISTIQUE' | 'LIVREUR' | 'CAISSIERE';

export interface User {
  id: string;
  email: string;
  role: Role;
  nom_complet: string;
  telephone?: string;
  password?: string;
  communes_servies?: string[]; // Only for livreur
  actif?: boolean; // Only for livreur or other accounts
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

export type StatutCommande =
  | 'en_attente_appel'
  | 'validee'
  | 'a_rappeler'
  | 'annulee'
  | 'en_cours_livraison'
  | 'livree'
  | 'echouee'
  | 'retour_livreur'
  | 'retour_stock'
  | 'terminee';

export interface Commande {
  id: string;
  date_creation: Date | any; // allow firestore timestamp
  client_id: string;
  nom_client?: string;
  telephone_client?: string;
  source_commande: string;
  statut_commande: StatutCommande;
  montant_total: number;
  frais_livraison?: number;
  mode_paiement: string;
  commune_livraison: string;
  adresse_livraison: string;
  notes_client?: string;
  agent_appel_id?: string;
  livreur_id?: string;
  feuille_route_id?: string;
  date_validation_appel?: Date | any;
  date_livraison_effective?: Date | any;
  montant_encaisse?: number;
  notes_livreur?: string;
}

export interface LigneCommande {
  id: string;
  commande_id: string;
  produit_id: string;
  nom_produit: string;
  quantite: number;
  prix_unitaire: number;
  montant_ligne: number;
}

export interface AppelCommande {
  id: string;
  commande_id: string;
  agent_appel_id: string;
  date_appel: Date | any;
  resultat_appel: 'validee' | 'a_rappeler' | 'annulee' | 'injoignable';
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
}

export interface MouvementStock {
  id: string;
  produit_id: string;
  type_mouvement: 'entree' | 'sortie' | 'retour';
  quantite: number;
  date: Date | string;
  reference?: string;
  commentaire?: string;
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
}
