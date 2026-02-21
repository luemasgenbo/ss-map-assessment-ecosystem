import { createClient } from '@supabase/supabase-js';

/**
 * UNITED BAYLOR ACADEMY - PERSISTENCE LAYER CONFIGURATION
 * ------------------------------------------------------
 * This client manages the handshake between the frontend and the 
 * Supabase PostgreSQL engine using Multi-Tenant RLS policies.
 */

const getSafeEnv = (key: string, fallback: string): string => {
  try {
    // 1. Try standard Vite env
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
    // 2. Try process.env for Node/CI/Sandbox environments
    if (typeof process !== 'undefined' && process.env && (process.env as any)[key]) {
      return (process.env as any)[key];
    }
    // 3. Try window.env as a last resort fallback
    if (typeof window !== 'undefined' && (window as any).env && (window as any).env[key]) {
      return (window as any).env[key];
    }
  } catch (e) {
    // Fail silently and return fallback
  }
  return fallback;
};

const supabaseUrl = getSafeEnv('VITE_SUPABASE_URL', 'https://tlbsnkrknvdquduaacnp.supabase.co');
const supabaseAnonKey = getSafeEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsYnNua3JrbnZkcXVkdWFhY25wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NTY2OTgsImV4cCI6MjA4NzIzMjY5OH0.QU888pAj_Qhum5Xq0jJCt1-9Lpx--lgsSSdR_aNx7zc');

// Initialize the Singleton Client with error handling
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey && supabaseUrl.includes('supabase.co');
};
