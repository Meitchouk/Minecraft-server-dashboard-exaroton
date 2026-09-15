"use client";
import { useState } from "react";
import { Star, Plus, Trash2, Play, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TargetPicker } from "@/components/target-picker";
import { useCommands } from "@/components/command-runner";
import { loadLS, saveLS } from "@/hooks/use-catalog";

type Fav = { id: string; label: string; cmd: string };
const KEY = "exaroton.favorites";

const DEFAULTS: Fav[] = [
  { id: "d1", label: "Kit inicial", cmd: "give {t} minecraft:stone_sword 1" },
  { id: "d2", label: "Teletransportar al spawn", cmd: "tp {t} 0 100 0" },
  { id: "d3", label: "Modo creativo", cmd: "gamemode creative {t}" },
];

export function Favorites({ players }: { players: string[] }) {
  const { run, online, running } = useCommands();
  const [favs, setFavs] = useState<Fav[]>(() => loadLS<Fav[]>(KEY, DEFAULTS));
  const [target, setTarget] = useState(players[0] ?? "@p");
  const [label, setLabel] = useState("");
  const [cmd, setCmd] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const persist = (f: Fav[]) => { setFavs(f); saveLS(KEY, f); };

  const add = () => {
    if (!label.trim() || !cmd.trim()) return;
    persist([...favs, { id: crypto.randomUUID(), label: label.trim(), cmd: cmd.trim().replace(/^\//, "") }]);
    setLabel(""); setCmd(""); toast.success("Favorito guardado");
  };

  const update = (id: string, patch: Partial<Fav>) => persist(favs.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="size-4 text-primary" />Mis comandos</CardTitle>
          <CardDescription>Guardados en este navegador. Usa <code className="rounded bg-muted px-1">{"{t}"}</code> donde vaya el objetivo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Objetivo para {"{t}"}</p>
            <TargetPicker value={target} onChange={setTarget} players={players} />
          </div>
          {favs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aun no tienes favoritos.</p>}
          <ul className="divide-y rounded-lg border">
            {favs.map((f) => {
              const resolved = f.cmd.replaceAll("{t}", target.trim());
              const isEdit = editing === f.id;
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  {isEdit ? (
                    <>
                      <Input value={f.label} onChange={(e) => update(f.id, { label: e.target.value })} className="h-8 w-40" />
                      <Input value={f.cmd} onChange={(e) => update(f.id, { cmd: e.target.value })} className="h-8 flex-1 font-mono text-xs" />
                      <Button size="icon-sm" variant="ghost" onClick={() => setEditing(null)}><Check /></Button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{f.label}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">/{resolved}</p>
                      </div>
                      <Button size="sm" disabled={!online || running || (f.cmd.includes("{t}") && !target.trim())} onClick={() => run(resolved)}><Play />Ejecutar</Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => setEditing(f.id)}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" className="text-destructive" onClick={() => persist(favs.filter((x) => x.id !== f.id))}><Trash2 /></Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-20 lg:self-start">
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="size-4 text-primary" />Nuevo favorito</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Nombre</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Kit PvP" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Comando</Label>
            <Input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="give {t} minecraft:diamond_sword 1" className="font-mono text-xs" onKeyDown={(e) => e.key === "Enter" && add()} />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={add} disabled={!label.trim() || !cmd.trim()}><Plus />Guardar</Button>
            {(label || cmd) && <Button variant="ghost" size="icon" onClick={() => { setLabel(""); setCmd(""); }}><X /></Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
