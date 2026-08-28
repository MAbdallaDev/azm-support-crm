import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn `Dialog`, hand-written against Radix rather than CLI-generated —
 * the shadcn CLI needs Node 20 and this project is pinned to 18 (story 06).
 *
 * Distinct from `ConfirmDialog`'s `AlertDialog`: an alert dialog is for a
 * yes/no decision and traps focus until answered; this is for browsing and
 * picking something (the KB article picker), which is a `dialog`, not an
 * `alertdialog`, in ARIA terms — and it needs a close button an alert
 * dialog deliberately omits.
 */

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-ink/50 data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 top-1/2 z-50 mx-auto grid w-full max-w-lg -translate-y-1/2 gap-4",
        "border bg-background p-6 shadow-lg duration-200 sm:rounded-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute end-4 top-4 rounded-sm text-muted-foreground opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div className={cn("flex flex-col gap-1.5 text-start", className)} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-[15px] font-bold", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger };
