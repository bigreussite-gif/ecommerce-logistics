-- Migration pour ajouter l'option de livraison incluse aux produits
ALTER TABLE produits ADD COLUMN livraison_incluse BOOLEAN DEFAULT false;
