// First used by the schedule pages; the API must allow this origin (CORS).
import { supabase } from "../auth/supabase";
import { createApi } from "./client";

// Vite inlines only literal `import.meta.env.VITE_*` references.
const url = import.meta.env.VITE_API_URL;

if (!url) {
  throw new Error(
    "VITE_API_URL is not set: copy apps/admin/.env.example to apps/admin/.env",
  );
}

export const api = createApi({
  baseUrl: url.replace(/\/$/, ""),
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  onUnauthorized: () => void supabase.auth.signOut({ scope: "local" }),
  fetch: globalThis.fetch,
});

export { unwrap } from "./client";
export { ApiError } from "./errors";
