"use client";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Etiqueta y aviso reutilizables para controles reservados al administrador
export function AdminBadge({ className }: { className?: string }) {
  return <Badge variant="outline" className={cn("h-4 gap-1 border-chart-3/50 px-1 text-[9px] text-chart-3", className)}><Lock className="size-2.5" />admin</Badge>;
}

export function ReadOnlyNotice({ what }: { what: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-chart-3/30 bg-chart-3/10 px-3 py-2 text-sm text-chart-3">
      <Lock className="size-4 shrink-0" />Solo lectura: {what} esta reservado al administrador.
    </div>
  );
}
