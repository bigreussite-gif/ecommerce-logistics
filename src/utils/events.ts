type Callback = () => void;

class EventBus {
  private listeners: { [key: string]: Callback[] } = {};

  subscribe(event: string, callback: Callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.unsubscribe(event, callback);
  }

  on(event: string, callback: Callback) {
    this.subscribe(event, callback);
  }

  off(event: string, callback: Callback) {
    this.unsubscribe(event, callback);
  }

  private unsubscribe(event: string, callback: Callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event: string) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb());
    }
  }
}

export const globalEventBus = new EventBus();

export const EVENTS = {
  ACHATS_UPDATED: 'ACHATS_UPDATED',
  STOCK_UPDATED: 'STOCK_UPDATED',
  FOURNISSEURS_UPDATED: 'FOURNISSEURS_UPDATED',
  COMMANDES_UPDATED: 'COMMANDES_UPDATED',
  FINANCE_UPDATED: 'FINANCE_UPDATED',
};
