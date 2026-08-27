import { cn } from "@/lib/utils";

/**
 * A loading placeholder. Used by DataTable's loading rows and by
 * ProtectedRoute's full-screen session check.
 *
 * `aria-hidden` because a screen reader announcing eight grey rectangles is
 * noise; the live region that says "loading" belongs to the caller.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      data-testid="skeleton"
      className={cn("animate-pulse rounded-md bg-surface-3", className)}
      {...props}
    />
  );
}
