// A simple LocalStorage-based Database to replace Firebase for zero-config offline testing.
// Triggers events so components using subscriptions update instantly.

const getList = (collection: string) => {
  try {
    return JSON.parse(localStorage.getItem(collection) || '[]');
  } catch (e) {
    return [];
  }
};

const saveList = (collection: string, list: any[]) => {
  localStorage.setItem(collection, JSON.stringify(list));
  window.dispatchEvent(new Event(`db-${collection}`));
};

export const getItems = (collection: string) => getList(collection);

export const subscribeToItems = <T,>(
  collection: string, 
  callback: (data: T[]) => void, 
  filterFn?: (item: T) => boolean,
  sortFn?: (a: T, b: T) => number
) => {
  const fetchAndTrigger = () => {
    let data: T[] = getList(collection);
    if (filterFn) data = data.filter(filterFn);
    if (sortFn) data = data.sort(sortFn);
    callback(data);
  };
  fetchAndTrigger();
  window.addEventListener(`db-${collection}`, fetchAndTrigger);
  return () => window.removeEventListener(`db-${collection}`, fetchAndTrigger);
};

export const addItem = (collection: string, item: any) => {
  const list = getList(collection);
  const newItem = { ...item, id: Math.random().toString(36).substr(2, 9) };
  list.push(newItem);
  saveList(collection, list);
  return newItem.id;
};

export const updateItem = (collection: string, id: string, changes: any) => {
  const list = getList(collection);
  const index = list.findIndex((i: any) => i.id === id);
  if (index >= 0) {
    list[index] = { ...list[index], ...changes };
    saveList(collection, list);
  }
};

export const updateItems = (collection: string, updates: {id: string, changes: any}[]) => {
  const list = getList(collection);
  let changed = false;
  updates.forEach(u => {
    const index = list.findIndex((i: any) => i.id === u.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...u.changes };
      changed = true;
    }
  });
  if (changed) saveList(collection, list);
};

export const getItem = (collection: string, id: string) => {
  return getList(collection).find((i:any) => i.id === id) || null;
};

export const deleteItem = (collection: string, id: string) => {
  const list = getList(collection);
  const filteredList = list.filter((i: any) => i.id !== id);
  if (list.length !== filteredList.length) {
    saveList(collection, filteredList);
  }
};
