import { Commande } from '../types';

/**
 * Returns the effective date for a command based on its status.
 * If the command is successfully delivered/terminated, it returns the delivery date.
 * Otherwise, it returns the creation date.
 */
export const getEffectiveCommandDate = (c: Partial<Commande>): Date => {
  const isSuccess = ['livree', 'terminee'].includes(c.statut_commande?.toLowerCase() || '');
  if (isSuccess && c.date_livraison_effective) {
    return new Date(c.date_livraison_effective);
  }
  return new Date(c.date_creation || Date.now());
};

/**
 * Checks if a command falls within a specific period using the effective date.
 */
export const isCommandInPeriod = (c: Partial<Commande>, start: Date, end: Date): boolean => {
  const dateToUse = getEffectiveCommandDate(c);
  return dateToUse >= start && dateToUse <= end;
};
