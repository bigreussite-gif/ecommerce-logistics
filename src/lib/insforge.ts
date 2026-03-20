import { createClient } from '@insforge/sdk';

const insforgeUrl = import.meta.env.VITE_INSFORGE_URL;
const insforgeAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;

if (!insforgeUrl || !insforgeAnonKey) {
  console.warn('InsForge configuration is missing. Please check your .env file.');
}

export const insforge = createClient({
  baseUrl: insforgeUrl || '',
  anonKey: insforgeAnonKey || ''
});
