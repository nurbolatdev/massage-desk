import { supabase } from "../auth/supabase";
import { createApi } from "./client";

// Expo inlines only literal `process.env.EXPO_PUBLIC_*` references.
const url = process.env.EXPO_PUBLIC_API_URL;

if (!url) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not set: copy apps/mobile/.env.example to apps/mobile/.env",
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
