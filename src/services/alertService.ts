import { insforge } from '../lib/insforge';
import { Commande, Produit } from '../types';
import { differenceInHours } from 'date-fns';

export interface BusinessAlert {
  id: string;
  type: 'stock' | 'retard' | 'performance';
  severity: 'high' | 'medium' | 'low';
  message: string;
  timestamp: Date;
  metadata?: any;
}

export const getActiveAlerts = async (): Promise<BusinessAlert[]> => {
  const alerts: BusinessAlert[] = [];
  const now = new Date();

  try {
    // 1. Alertes Stock (Stock < Stock Minimum)
    const { data: lowStock } = await insforge.database
      .from('produits')
      .select('*')
      .filter('stock_actuel', 'lt', 'stock_minimum')
      .eq('actif', true);

    if (lowStock) {
      lowStock.forEach((p: Produit) => {
        alerts.push({
          id: `stock-${p.id}`,
          type: 'stock',
          severity: 'high',
          message: `Stock critique : ${p.nom} (${p.stock_actuel} restant)`,
          timestamp: now,
          metadata: { productId: p.id }
        });
      });
    }

    // 2. Alertes Retard (Commandes en validation > 24h)
    const { data: delayedOrders } = await insforge.database
      .from('commandes')
      .select('*')
      .eq('statut_commande', 'validation_appel');

    if (delayedOrders) {
      delayedOrders.forEach((o: Commande) => {
        const hours = differenceInHours(now, new Date(o.date_creation));
        if (hours > 24) {
          alerts.push({
            id: `delay-${o.id}`,
            type: 'retard',
            severity: hours > 48 ? 'high' : 'medium',
            message: `Commande #${o.id.slice(0, 8)} en attente depuis ${hours}h`,
            timestamp: now,
            metadata: { orderId: o.id }
          });
        }
      });
    }

  } catch (error) {
    console.error("Erreur Sentinel alerts:", error);
  }

  return alerts;
};
