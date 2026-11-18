import { useQuery } from "@tanstack/react-query";

import { fetchRole } from "./access";
import { useAuth } from "./authContext";
import { supabase } from "./supabase";

/** Reads the signed-in user's role; disabled until the user id is known. */
export function useRole() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ["role", userId],
    queryFn: () => fetchRole(supabase, userId ?? ""),
    enabled: userId !== undefined,
    staleTime: Infinity,
    retry: 1,
  });
}
