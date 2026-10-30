import * as React from "react";
import { cn } from "@/lib/utils";
// shadcn/ui Card
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("rounded-xl border border-border/70 bg-card text-card-foreground shadow-soft", className)} {...p} />;
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-col gap-1 p-4 pb-2", className)} {...p} />;
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("text-sm font-medium text-muted-foreground", className)} {...p} />;
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("p-4 pt-0", className)} {...p} />;
