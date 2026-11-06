import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";

import { PageSkeleton } from "@/components/PageSkeleton";
import { useAuth } from "@/lib/auth/authContext";
import { queryClient, router } from "@/router";

export function App() {
  const auth = useAuth();

  // Guards run again whenever the session changes.
  useEffect(() => {
    void router.invalidate();
    if (auth.status === "signedOut") {
      queryClient.clear();
    }
  }, [auth.status]);

  if (auth.status === "loading") {
    return <PageSkeleton fullPage />;
  }
  return <RouterProvider router={router} context={{ auth, queryClient }} />;
}
