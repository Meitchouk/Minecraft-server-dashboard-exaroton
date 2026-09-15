import { AppShell } from "@/components/app-shell";

// Todas las paginas del panel (autenticadas) van dentro del shell con sidebar y barra superior
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
