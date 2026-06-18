-- Migration pour ajouter l'option de livraison incluse aux commandes
ALTER TABLE commandes ADD COLUMN livraison_incluse BOOLEAN DEFAULT false;
