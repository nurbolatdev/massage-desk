import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffRole = "admin" | "master";

/** Narrows an untyped profiles row to a known staff role; anything else has no access. */
export function roleFromProfile(row: unknown): StaffRole | null {
  if (typeof row !== "object" || row === null || !("role" in row)) {
    return null;
  }
  const { role } = row;
  return role === "admin" || role === "master" ? role : null;
}

/** Reads the signed-in user's own profile row (allowed by the own_profile_read policy). */
export async function fetchRole(client: SupabaseClient, userId: string): Promise<StaffRole | null> {
  const { data, error } = await client.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (error) {
    throw error;
  }
  return roleFromProfile(data);
}
