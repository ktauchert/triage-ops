import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/15 text-primary shadow-sm shadow-primary/10 dark:text-primary-foreground dark:bg-primary/25",
        secondary:
          "border-border/60 bg-secondary/60 text-secondary-foreground",
        destructive:
          "border-destructive/25 bg-destructive/15 text-destructive dark:text-destructive-foreground dark:bg-destructive/25",
        outline: "border-border/60 bg-background/40 text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
