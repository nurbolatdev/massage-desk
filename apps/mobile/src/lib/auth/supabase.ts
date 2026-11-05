import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

import { createChunkedStorage } from "./chunkedStorage";

// Expo inlines only literal `process.env.EXPO_PUBLIC_*` references.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL is not set: copy apps/mobile/.env.example to apps/mobile/.env",
  );
}
if (!key) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set: copy apps/mobile/.env.example to apps/mobile/.env",
  );
}

export const supabase = createClient(url, key, {
  auth: {
    storage: createChunkedStorage(SecureStore),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
