import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
// shadcn/ui Button (adaptado a la paleta)
export const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition disabled:pointer-events-none disabled:opacity-50 active:scale-[.98]", {
  variants: {
    variant: { default: "bg-primary text-primary-foreground hover:bg-ink-700", gold: "bg-gold text-ink hover:bg-gold-400", outline: "border border-border bg-card hover:bg-muted", ghost: "hover:bg-muted", ghostDark: "text-cream/80 hover:bg-white/10 hover:text-cream", outlineDark: "border border-white/20 text-cream hover:bg-white/10" },
    size: { default: "h-11 px-4", sm: "h-9 px-3 text-sm", lg: "h-12 px-6 text-base", icon: "h-10 w-10" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...p }, ref) => <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...p} />);
Button.displayName = "Button";
