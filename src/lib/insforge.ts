import { createClient } from '@insforge/sdk';

// Clean and sanitize environment variables to prevent accidental newlines or whitespace
const rawUrl = (import.meta.env.VITE_INSFORGE_URL || 'https://fgat4f9m.eu-central.insforge.app').trim().replace(/\/+$/, '');
const rawKey = (import.meta.env.VITE_INSFORGE_ANON_KEY || 'ik_246659318b3a90f79a95de2904edf7b3').trim();

export const insforge = createClient({
  baseUrl: rawUrl,
  anonKey: rawKey
});

