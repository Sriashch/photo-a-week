/* config.js — Supabase connection.
   The anon key is designed to be public (it ships in the frontend of every
   Supabase app); your row-level security rules are what actually protect data.
   Never put the secret "service_role" key here.
   Loaded after the Supabase CDN script, before auth.js. */

const SUPABASE_URL = 'https://pxwvuakvjdfpnaupbhfm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4d3Z1YWt2amRmcG5hdXBiaGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTI4MzEsImV4cCI6MjA5ODgyODgzMX0.1121UscnhBhSkf8GcMiGc_4S-rqll6gEsKarI5rS6yk';

// one shared client, available everywhere as SB
const SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);