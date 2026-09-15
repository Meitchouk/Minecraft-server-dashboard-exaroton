"use client";
import { useState } from "react";
import { MemoryStick, MessageSquareText, Save, Coins, User, BadgeCheck, Server, Info } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { OwnKeyCard } from "@/components/own-key-card";
import { useDraft, usePoll, useServer } from "@/hooks/use-server";
import { apiFetch, motdToSpans } from "@/lib/client";

type Account = { name: string; email: string; verified: boolean; credits: number };

const COLORS: [string, string][] = [
  ["§a", "#5F5"], ["§b", "#5FF"], ["§c", "#F55"], ["§d", "#F5F"], ["§e", "#FF5"], ["§f", "#FFF"],
  ["§7", "#AAA"], ["§8", "#555"], ["§6", "#FA0"], ["§9", "#55F"], ["§2", "#0A0"], ["§4", "#A00"],
];

function MotdPreview({ motd }: { motd: string }) {
  return (
    <div className="rounded-lg border bg-black/60 px-3 py-2 font-mono text-sm leading-6">
      {motdToSpans(motd).map((s, i) => s.text === "\n" ? <br key={i} /> :
        <span key={i} style={{ color: s.color ?? "#AAA", fontWeight: s.bold ? 700 : undefined, fontStyle: s.italic ? "italic" : undefined }}>{s.text}</span>)}
      {!motd && <span className="text-muted-foreground">(vacio)</span>}
    </div>
  );
}

export default function SettingsPage() {
  const { data: server } = useServer(8000);
  const { data: ram, setData: setRamData, key: ramKey } = usePoll(() => apiFetch<{ ram: number }>("/api/server/ram"));
  const { data: motd, setData: setMotdData, key: motdKey } = usePoll(() => apiFetch<{ motd: string }>("/api/server/motd"));
  const { data: account } = usePoll(() => apiFetch<Account>("/api/account"), 60000);

  const [ramDraftState, setRamDraft] = useDraft<number>(ram?.ram ?? null, ramKey);
  const [motdDraftState, setMotdDraft] = useDraft<string>(motd?.motd ?? null, motdKey);
  const ramDraft = ramDraftState ?? 2;
  const motdDraft = motdDraftState ?? "";
  const [saving, setSaving] = useState<"ram" | "motd" | null>(null);

  const offline = server?.status === 0 || server?.status === 7;
  const ramCost = (ramDraft * 1).toFixed(0); // Exaroton: 1 credito por GB por hora

  const saveRam = async () => {
    setSaving("ram");
    try {
      const r = await apiFetch<{ ram: number }>("/api/server/ram", { method: "POST", body: JSON.stringify({ ram: ramDraft }) });
      setRamData(r); toast.success(`RAM cambiada a ${r.ram} GB`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(null); }
  };

  const saveMotd = async () => {
    setSaving("motd");
    try {
      const r = await apiFetch<{ motd: string }>("/api/server/motd", { method: "POST", body: JSON.stringify({ motd: motdDraft }) });
      setMotdData(r); toast.success("MOTD actualizado");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(null); }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Ajustes" description="Recursos del servidor, mensaje de bienvenida y cuenta." />

      <OwnKeyCard />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* RAM */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MemoryStick className="size-4 text-primary" />Memoria RAM</CardTitle>
            <CardDescription>Solo se puede cambiar con el servidor apagado. Exaroton cobra ~1 credito por GB/hora.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!ram ? <Skeleton className="h-16" /> : (
              <>
                <div className="flex items-end justify-between">
                  <span className="text-4xl font-semibold tabular-nums">{ramDraft}<span className="ml-1 text-base font-normal text-muted-foreground">GB</span></span>
                  <span className="text-xs text-muted-foreground">≈ {ramCost} creditos / hora</span>
                </div>
                <Slider min={2} max={16} step={1} value={[ramDraft]} onValueChange={(v) => setRamDraft(Array.isArray(v) ? v[0] : (v as number))} disabled={!offline} />
                <div className="flex justify-between text-[11px] text-muted-foreground"><span>2 GB</span><span>16 GB</span></div>
                {!offline && (
                  <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground"><Info className="size-3.5" />Deten el servidor para modificar la RAM.</p>
                )}
                <Button onClick={saveRam} disabled={!offline || saving === "ram" || ramDraft === ram.ram}><Save />Guardar RAM</Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* MOTD */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquareText className="size-4 text-primary" />MOTD</CardTitle>
            <CardDescription>Mensaje que se ve en la lista de servidores. Usa codigos § para color.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!motd ? <Skeleton className="h-24" /> : (
              <>
                <MotdPreview motd={motdDraft} />
                <Textarea value={motdDraft} onChange={(e) => setMotdDraft(e.target.value)} rows={3} className="font-mono" maxLength={200} />
                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-xs text-muted-foreground">Insertar:</span>
                  {COLORS.map(([code, hex]) => (
                    <button key={code} title={code} onClick={() => setMotdDraft((m) => (m ?? "") + code)}
                      className="size-5 rounded border border-white/10 transition-transform hover:scale-110" style={{ background: hex }} />
                  ))}
                  <Button size="xs" variant="secondary" onClick={() => setMotdDraft((m) => (m ?? "") + "§l")}><b>B</b></Button>
                  <Button size="xs" variant="secondary" onClick={() => setMotdDraft((m) => (m ?? "") + "§o")}><i>I</i></Button>
                  <Button size="xs" variant="secondary" onClick={() => setMotdDraft((m) => (m ?? "") + "§r")}>reset</Button>
                  <Button size="xs" variant="secondary" onClick={() => setMotdDraft((m) => (m ?? "") + "\n")}>↵</Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{motdDraft.length}/200</span>
                  <Button onClick={saveMotd} disabled={saving === "motd" || motdDraft === motd.motd}><Save />Guardar MOTD</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Server info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="size-4 text-primary" />Servidor</CardTitle>
            <CardDescription>Datos tecnicos</CardDescription>
          </CardHeader>
          <CardContent>
            {!server ? <Skeleton className="h-24" /> : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">ID</dt><dd className="font-mono">{server.id}</dd>
                <dt className="text-muted-foreground">Direccion</dt><dd className="font-mono">{server.address}</dd>
                <dt className="text-muted-foreground">Host</dt><dd className="font-mono">{server.host ?? "—"}{server.port ? `:${server.port}` : ""}</dd>
                <dt className="text-muted-foreground">Software</dt><dd>{server.software ? `${server.software.name} ${server.software.version}` : "—"}</dd>
                <dt className="text-muted-foreground">Compartido</dt><dd>{server.shared ? "Si" : "No"}</dd>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="size-4 text-primary" />Cuenta Exaroton</CardTitle>
            <CardDescription>Propietaria del token de API</CardDescription>
          </CardHeader>
          <CardContent>
            {!account ? <Skeleton className="h-24" /> : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary text-lg font-semibold">{account.name.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <p className="flex items-center gap-1.5 font-medium">{account.name}{account.verified && <BadgeCheck className="size-4 text-primary" />}</p>
                    <p className="text-xs text-muted-foreground">{account.email}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground"><Coins className="size-4" />Creditos</span>
                  <Badge className="font-mono text-sm">{account.credits.toFixed(2)}</Badge>
                </div>
                {ram && account.credits > 0 && (
                  <p className="text-xs text-muted-foreground">Con {ram.ram} GB te alcanza para ≈ <b>{(account.credits / ram.ram).toFixed(1)} h</b> de servidor.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
