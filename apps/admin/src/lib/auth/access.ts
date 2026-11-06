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

export type AccessViewInput = {
  signedIn: boolean;
  hasSession: boolean;
  isPending: boolean;
  isError: boolean;
  role: StaffRole | null | undefined;
};

export type AccessView =
  | { kind: "allowed"; role: StaffRole }
  | { kind: "offline" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "denied" };

/**
 * Decides what the access gate shows. Signed in without a session means offline (token not refreshed);
 * signed out without a session keeps the skeleton until the router redirects to the sign-in page.
 */
export function accessView({ signedIn, hasSession, isPending, isError, role }: AccessViewInput): AccessView {
  if (!hasSession) return { kind: signedIn ? "offline" : "loading" };
  if (isPending) return { kind: "loading" };
  if (isError) return { kind: "error" };
  if (role === null || role === undefined) return { kind: "denied" };
  return { kind: "allowed", role };
}
