import { User } from '../types';
import { getItems, addItem } from './localDb';

export const getUtilisateurs = async (): Promise<User[]> => getItems('users');

export const creerUtilisateurMock = async (user: Omit<User, 'id'>): Promise<void> => {
  addItem('users', user);
};
