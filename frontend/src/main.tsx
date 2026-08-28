import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import { tokenStore } from "./api/tokenStore";
import AppChrome from "./components/shell/AppChrome";
import PortalChrome from "./components/shell/PortalChrome";
import { ProtectedRoute } from "./components/shell/ProtectedRoute";
import { Toaster } from "./components/ui/toast";
import "./i18n";
import "./index.css";
import Dashboard from "./routes/Dashboard";
import Login from "./routes/Login";
import NotFound from "./routes/NotFound";
import PortalHome from "./routes/PortalHome";
import PortalLogin from "./routes/PortalLogin";
import Profile from "./routes/Profile";
import Tickets from "./routes/Tickets";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/**
 * The kitchen sink is DEV-only, gated **here** rather than by a role check
 * inside the component. `import.meta.env.DEV` is replaced with `false` at
 * build time, so the ternary collapses, nothing references the dynamic import,
 * and Rollup drops the module entirely — the code is not in the production
 * bundle at all, which a runtime check could never achieve.
 */
const devOnlyRoutes = import.meta.env.DEV
  ? [
      {
        path: "_kitchen-sink",
        lazy: async () => ({ Component: (await import("./routes/KitchenSink")).default }),
      },
    ]
  : [];

/**
 * Two shells under one router.
 *
 *   /login, /portal/login          public — two front doors, one endpoint
 *   /app/*    staff only           AppChrome
 *   /portal/* customers only       PortalChrome
 *
 * The role check that keeps them apart lives in ProtectedRoute; the API
 * enforces the real permissions independently (story 03's two-layer model).
 */
const router = createBrowserRouter([
  // "/" is answered from the cached role rather than a fixed target, so a
  // signed-in customer opening a bare bookmark lands in the portal.
  {
    path: "/",
    element: (
      <Navigate to={tokenStore.role === "customer" ? "/portal" : "/app/dashboard"} replace />
    ),
  },
  { path: "/login", element: <Login /> },
  { path: "/portal/login", element: <PortalLogin /> },
  // Anything outside both shells: send it through "/" so the cached role picks
  // the right front door rather than guessing at a chrome to render it in.
  { path: "*", element: <Navigate to="/" replace /> },
  {
    path: "/app",
    element: (
      <ProtectedRoute audience="staff">
        <AppChrome />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      // One component for both: opening a ticket must not unmount the queue
      // and refetch it, and selection is derived from the :id param.
      { path: "tickets", element: <Tickets /> },
      { path: "tickets/:id", element: <Tickets /> },
      { path: "profile", element: <Profile /> },
      ...devOnlyRoutes,
      // Catch-all *inside* the layout, so an unbuilt screen leaves the chrome
      // standing instead of throwing React Router's error page over the top
      // of it. Stories 07-09 add real routes above this one.
      { path: "*", element: <NotFound /> },
    ],
  },
  {
    path: "/portal",
    element: (
      <ProtectedRoute audience="customer">
        <PortalChrome />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <PortalHome /> },
      { path: "*", element: <NotFound home="/portal" /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>,
);
