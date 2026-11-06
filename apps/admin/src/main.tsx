import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "./styles/index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { AuthProvider } from "@/lib/auth/session";
import { queryClient } from "@/router";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root is missing in index.html");
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
