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

export const SESSION_OFFLINE_TITLE = "Нет интернета";
export const SESSION_OFFLINE_TEXT = "Проверьте подключение и попробуйте ещё раз.";

export type AccessViewInput = {
  hasSession: boolean;
  isPending: boolean;
  isError: boolean;
  role: StaffRole | null | undefined;
};

export type AccessView = "offline" | "loading" | "error" | "denied" | "allowed";

/** Decides what the access gate shows; signed in without a session means offline, token not refreshed. */
export function accessView({ hasSession, isPending, isError, role }: AccessViewInput): AccessView {
  if (!hasSession) return "offline";
  if (isPending) return "loading";
  if (isError) return "error";
  if (role === null || role === undefined) return "denied";
  return "allowed";
}
