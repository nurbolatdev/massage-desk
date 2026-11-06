import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { safeRedirect } from "@/lib/auth/redirect";
import type { AuthState } from "@/lib/auth/authContext";
import { AccessGate } from "@/pages/AccessGate";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { SectionPage } from "@/pages/SectionPage";
import { SignInPage } from "@/pages/SignInPage";
import { sections } from "@/sections";

export const queryClient = new QueryClient();

type RouterContext = { auth: AuthState; queryClient: QueryClient };

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
});

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
  component: () => (
    <AccessGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </AccessGate>
  ),
});

const sectionRoutes = sections.map((section) =>
  createRoute({
    getParentRoute: () => appRoute,
    path: section.path,
    component: () => <SectionPage section={section} />,
  }),
);

const routeTree = rootRoute.addChildren([signInRoute, appRoute.addChildren(sectionRoutes)]);

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
