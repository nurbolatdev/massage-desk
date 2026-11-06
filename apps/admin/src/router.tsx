import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { Clock } from "lucide-react";

import { StateCard } from "@/components/StateCard";
import { safeRedirect } from "@/lib/auth/redirect";
import type { AuthState } from "@/lib/auth/authContext";
import { SignInPage } from "@/pages/SignInPage";

export const queryClient = new QueryClient();

type RouterContext = { auth: AuthState; queryClient: QueryClient };

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Outlet });

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  beforeLoad: ({ context, search }) => {
    if (context.auth.status === "signedIn") {
      throw redirect({ href: safeRedirect(search.redirect) });
    }
  },
  component: SignInPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: ({ context, location }) => {
    if (context.auth.status === "signedOut") {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: Outlet,
});

// Temporary card until the section routes arrive.
const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: () => (
    <StateCard
      icon={Clock}
      title="Раздел появится позже"
      text="Записи, доход, доля бота и загруженность по часам."
    />
  ),
});

const routeTree = rootRoute.addChildren([signInRoute, appRoute.addChildren([homeRoute])]);

export const router = createRouter({
  routeTree,
  context: {
    auth: { status: "loading", session: null, signOut: async () => false },
    queryClient,
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
