import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The artboards' `.pill` — the one shape every badge in the app wears.
 *
 * `2px 8px`, 11px/600, a 999px radius and `line-height:18px` straight from
 * DesignSystem.dc.html. Colour is the caller's job, because the colour is what
 * distinguishes a status from a priority from a channel.
 */
export const Pill = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2 py-[2px]",
        "text-[11px] font-semibold leading-[18px]",
        className,
      )}
      {...props}
    />
  ),
);
Pill.displayName = "Pill";
