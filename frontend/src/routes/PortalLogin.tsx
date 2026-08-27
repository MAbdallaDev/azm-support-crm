import Login from "./Login";

/**
 * `/portal/login`. A distinct route so the customer front door has its own
 * URL from day one — ProtectedRoute and the refresh interceptor both redirect
 * here by role. Story 09 gives it portal-specific copy; the mechanics are the
 * same single login endpoint either way.
 */
export default function PortalLogin() {
  return <Login audience="customer" />;
}
