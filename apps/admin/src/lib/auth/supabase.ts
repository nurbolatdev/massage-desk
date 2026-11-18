import { createClient } from "@supabase/supabase-js";

import { createRememberStorage } from "./rememberStorage";

// Vite inlines only literal `import.meta.env.VITE_*` references.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url) {
  throw new Error(
    "VITE_SUPABASE_URL is not set: copy apps/admin/.env.example to apps/admin/.env",
  );
}
if (!key) {
  throw new Error(
    "VITE_SUPABASE_PUBLISHABLE_KEY is not set: copy apps/admin/.env.example to apps/admin/.env",
  );
}

const remember = createRememberStorage(window.localStorage, window.sessionStorage);

/** Call before `signInWithPassword` with the "remember on this computer" checkbox value. */
export const setRemember = remember.setRemember;

export const supabase = createClient(url, key, {
  auth: {
    storage: remember.storage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
