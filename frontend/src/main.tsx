import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import { tokenStore } from "./api/tokenStore";
import AppChrome from "./components/shell/AppChrome";
import PortalChrome from "./components/shell/PortalChrome";
import { ProtectedRoute } from "./components/shell/ProtectedRoute";
import RouteErrorBoundary, { RouteErrorElement } from "./components/shell/RouteErrorBoundary";
import { Toaster } from "./components/ui/toast";
import "./i18n";
import "./index.css";
import Dashboard from "./routes/Dashboard";
import LiveChat from "./routes/LiveChat";
import Login from "./routes/Login";
import NotFound from "./routes/NotFound";
import PortalHome from "./routes/PortalHome";
import PortalLogin from "./routes/PortalLogin";
import Profile from "./routes/Profile";
import Tickets from "./routes/Tickets";
import CustomerList from "./features/customers/CustomerList";
import Customer360 from "./features/customers/Customer360";
import KBBrowse from "./features/kb/KBBrowse";
import KBEditor from "./features/kb/KBEditor";
import NewTicket from "./features/tickets/NewTicket";
import ReportsPage from "./features/reports/ReportsPage";
import PortalKB from "./features/portal/PortalKB";
import PortalTicketDetail from "./features/portal/PortalTicketDetail";
import Register from "./features/portal/Register";
import SubmitTicket from "./features/portal/SubmitTicket";

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
/**
 * The `/app/*` children, as their own export so `routes.test.tsx` can assert
 * the ordering React Router actually resolves — importing `main.tsx` itself
 * would execute `ReactDOM.createRoot(...).render(...)` as a side effect.
 *
 * **"tickets/new" must be registered ABOVE "tickets/:id"** — otherwise React
 * Router matches ":id" against the literal string "new" and the create form
 * never renders. The test asserts this by resolving a route, not by reading
 * array order, so a reordering that broke matching would fail it even if
 * someone "fixed" the array shape some other way.
 */
export const appRouteChildren = [
  { index: true, element: <Navigate to="/app/dashboard" replace /> },
  { path: "dashboard", element: <Dashboard /> },
  // One component for both: opening a ticket must not unmount the queue
  // and refetch it, and selection is derived from the :id param.
  { path: "tickets", element: <Tickets /> },
  { path: "tickets/new", element: <NewTicket /> },
  { path: "tickets/:id", element: <Tickets /> },
  // Same one-component-for-list-and-detail pattern as Tickets above.
  { path: "live-chat", element: <LiveChat /> },
  { path: "live-chat/:id", element: <LiveChat /> },
  { path: "customers", element: <CustomerList /> },
  { path: "customers/:id", element: <Customer360 /> },
  // KBBrowse handles both "/app/kb" and "/app/kb/:slug" — the same
  // one-component-for-list-and-detail pattern as Tickets above, so the
  // category sidebar and article list never unmount when a reader opens.
  { path: "kb", element: <KBBrowse /> },
  { path: "kb/new", element: <KBEditor /> },
  { path: "kb/:slug/edit", element: <KBEditor /> },
  { path: "kb/:slug", element: <KBBrowse /> },
  { path: "reports", element: <ReportsPage /> },
  { path: "profile", element: <Profile /> },
  ...devOnlyRoutes,
  // Catch-all *inside* the layout, so an unbuilt screen leaves the chrome
  // standing instead of throwing React Router's error page over the top
  // of it.
  { path: "*", element: <NotFound /> },
];

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
  // Unauthenticated, alongside the two logins above — outside PortalChrome's
  // ProtectedRoute subtree, since registering happens before any session exists.
  { path: "/portal/register", element: <Register /> },
  // Anything outside both shells: send it through "/" so the cached role picks
  // the right front door rather than guessing at a chrome to render it in.
  { path: "*", element: <Navigate to="/" replace /> },
  {
    path: "/app",
    element: (
      <RouteErrorBoundary>
        <ProtectedRoute audience="staff">
          <AppChrome />
        </ProtectedRoute>
      </RouteErrorBoundary>
    ),
    errorElement: <RouteErrorElement />,
    children: appRouteChildren,
  },
  {
    path: "/portal",
    element: (
      <RouteErrorBoundary>
        <ProtectedRoute audience="customer">
          <PortalChrome />
        </ProtectedRoute>
      </RouteErrorBoundary>
    ),
    errorElement: <RouteErrorElement />,
    children: [
      { index: true, element: <PortalHome /> },
      { path: "new", element: <SubmitTicket /> },
      { path: "tickets/:id", element: <PortalTicketDetail /> },
      { path: "kb", element: <PortalKB /> },
      { path: "kb/:slug", element: <PortalKB /> },
      { path: "*", element: <NotFound home="/portal" /> },
    ],
  },
]);

// Guarded on the root element existing: `routes.test.tsx` imports this module
// for `appRouteChildren` alone, and a real production index.html always has
// the element, so this changes nothing outside of that one test import.
const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
