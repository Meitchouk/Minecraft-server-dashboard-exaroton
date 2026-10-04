import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";

// Todas las paginas del panel (autenticadas) van dentro del shell con sidebar y barra superior
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Suspense><AppShell>{children}</AppShell></Suspense>;
}
