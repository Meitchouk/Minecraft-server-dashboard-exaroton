"use client";
import { Users, User, Shuffle, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Selector de objetivo para comandos: jugadores conectados + selectores @a/@p/@r + texto libre
const SELECTORS = [
  { v: "@a", label: "Todos", icon: Users },
  { v: "@p", label: "Mas cercano", icon: Crosshair },
  { v: "@r", label: "Aleatorio", icon: Shuffle },
];

export function TargetPicker({ value, onChange, players, allowSelectors = true, className }: {
  value: string; onChange: (v: string) => void; players: string[]; allowSelectors?: boolean; className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap gap-1.5">
        {allowSelectors && SELECTORS.map((s) => (
          <Button key={s.v} size="xs" variant={value === s.v ? "default" : "outline"} onClick={() => onChange(s.v)}><s.icon />{s.label}</Button>
        ))}
        {players.map((p) => (
          <Button key={p} size="xs" variant={value === p ? "default" : "secondary"} onClick={() => onChange(p)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://mc-heads.net/avatar/${encodeURIComponent(p)}/16`} alt="" width={14} height={14} className="size-3.5 rounded-[2px]" />
            {p}
          </Button>
        ))}
        {players.length === 0 && <span className="self-center text-xs text-muted-foreground">Sin jugadores conectados</span>}
      </div>
      <div className="relative">
        <User className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Nombre o selector" className="h-8 pl-8 font-mono text-xs" />
      </div>
    </div>
  );
}
