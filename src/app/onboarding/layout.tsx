import { AuthShell } from "@/components/AuthShell";

export default function L({ children }: { children: React.ReactNode }) {
  return <AuthShell kicker="Primer paso" title="Tu barbería, lista hoy.">{children}</AuthShell>;
}