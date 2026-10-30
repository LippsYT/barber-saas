import { AuthShell } from "@/components/AuthShell";

export default function L({ children }: { children: React.ReactNode }) {
  return <AuthShell kicker="Tu cuenta" title="Entra y abre la agenda.">{children}</AuthShell>;
}
