"use client";
import { useState } from "react";
import { ShieldCheck, UserCheck, UserX, Trash2, KeyRound, Plus, Clock, Crown, User as UserIcon, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { usePoll } from "@/hooks/use-server";
import { apiFetch } from "@/lib/client";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

type User = { username: string; role: "admin" | "user"; approved: boolean; createdAt: number; approvedAt?: number | null; approvedBy?: string | null; lastLogin?: number | null };
type Audit = { at: number; serverId: string; kind: string; command: string; source?: string };

const fmt = (t?: number | null) => (t ? new Date(t).toLocaleString() : "—");

export default function AdminPage() {
  const me = useMe();
  const { data: users, loading, refresh, setData } = usePoll(() => apiFetch<User[]>("/api/admin/users"), 30000);
  const { data: audit, refresh: refreshAudit } = usePoll(() => apiFetch<Audit[]>("/api/audit?limit=60&all=1"), 30000);
  const [busy, setBusy] = useState<string | null>(null);
  const [nu, setNu] = useState({ username: "", password: "", role: "user" as "user" | "admin" });
  const [pw, setPw] = useState<Record<string, string>>({});

  const patch = async (username: string, body: Record<string, unknown>, msg: string) => {
    setBusy(username);
    try {
      const u = await apiFetch<User>("/api/admin/users", { method: "PATCH", body: JSON.stringify({ username, ...body }) });
      setData((users ?? []).map((x) => (x.username === u.username ? u : x)));
      toast.success(msg);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };
  const remove = async (username: string) => {
    setBusy(username);
    try { await apiFetch(`/api/admin/users?username=${encodeURIComponent(username)}`, { method: "DELETE" }); setData((users ?? []).filter((x) => x.username !== username)); toast.success(`${username} eliminado`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };
  const create = async () => {
    setBusy("new");
    try {
      const u = await apiFetch<User>("/api/admin/users", { method: "POST", body: JSON.stringify({ ...nu, approved: true }) });
      setData([u, ...(users ?? [])]); setNu({ username: "", password: "", role: "user" }); toast.success(`Usuario ${u.username} creado y aprobado`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const pending = (users ?? []).filter((u) => !u.approved);
  const active = (users ?? []).filter((u) => u.approved);

  const Row = ({ u }: { u: User }) => (
    <li className={cn("flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2", !u.approved && "border-chart-3/40 bg-chart-3/5")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", u.role === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{u.role === "admin" ? <Crown className="size-4" /> : <UserIcon className="size-4" />}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">{u.username}{u.username === me?.username && <Badge variant="outline" className="h-4 px-1 text-[10px]">tu</Badge>}{u.role === "admin" && <Badge className="h-4 px-1 text-[10px]">admin</Badge>}{!u.approved && <Badge variant="outline" className="h-4 border-chart-3/50 px-1 text-[10px] text-chart-3">pendiente</Badge>}</p>
        <p className="text-[11px] text-muted-foreground">Creado {fmt(u.createdAt)}{u.approved && u.approvedBy && ` · aprobado por ${u.approvedBy}`}{u.lastLogin && ` · ultimo acceso ${fmt(u.lastLogin)}`}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {u.approved
          ? <Button size="xs" variant="outline" disabled={busy === u.username || u.username === me?.username} onClick={() => patch(u.username, { approved: false }, `${u.username} desaprobado`)}><UserX />Revocar</Button>
          : <Button size="xs" disabled={busy === u.username} onClick={() => patch(u.username, { approved: true }, `${u.username} aprobado`)}><UserCheck />Aprobar</Button>}
        <Button size="xs" variant="outline" disabled={busy === u.username || u.username === me?.username} onClick={() => patch(u.username, { role: u.role === "admin" ? "user" : "admin" }, `Rol cambiado`)}>{u.role === "admin" ? "Quitar admin" : "Hacer admin"}</Button>
        <Dialog>
          <DialogTrigger render={<Button size="xs" variant="ghost" />}><KeyRound />Contraseña</DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva contraseña para {u.username}</DialogTitle><DialogDescription>Minimo 8 caracteres.</DialogDescription></DialogHeader>
            <Input type="password" value={pw[u.username] ?? ""} onChange={(e) => setPw({ ...pw, [u.username]: e.target.value })} />
            <DialogFooter><Button disabled={(pw[u.username] ?? "").length < 8} onClick={() => patch(u.username, { password: pw[u.username] }, "Contraseña cambiada").then(() => setPw({ ...pw, [u.username]: "" }))}>Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        {u.username !== me?.username && (
          <AlertDialog>
            <AlertDialogTrigger render={<Button size="xs" variant="ghost" className="text-destructive" />}><Trash2 /></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Eliminar a {u.username}?</AlertDialogTitle><AlertDialogDescription>Se borra la cuenta y sus favoritos. No se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => remove(u.username)}>Eliminar</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Administracion" description="Aprueba quien puede usar el panel (y por tanto tu API key), gestiona roles y revisa la auditoria.">
        <Button variant="outline" size="sm" onClick={() => { refresh(); refreshAudit(); }}>Actualizar</Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className={cn(pending.length && "border-chart-3/40")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="size-4 text-chart-3" />Pendientes de aprobacion {pending.length > 0 && <Badge variant="outline" className="border-chart-3/50 text-chart-3">{pending.length}</Badge>}</CardTitle>
              <CardDescription>Cuentas registradas que pueden entrar al panel pero aun no usar tu servidor (tu API key).</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-16" /> : pending.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No hay solicitudes pendientes.</p> : <ul className="space-y-2">{pending.map((u) => <Row key={u.username} u={u} />)}</ul>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />Usuarios con acceso</CardTitle>
              <CardDescription>{active.length} cuenta(s) aprobada(s).</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-24" /> : <ul className="space-y-2">{active.map((u) => <Row key={u.username} u={u} />)}</ul>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4 text-primary" />Crear usuario</CardTitle><CardDescription>Queda aprobado directamente.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div><Label className="mb-1.5 block text-xs">Usuario</Label><Input value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value.toLowerCase() })} /></div>
              <div><Label className="mb-1.5 block text-xs">Contraseña</Label><Input type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></div>
              <div className="flex gap-1">
                <Button size="xs" variant={nu.role === "user" ? "default" : "outline"} onClick={() => setNu({ ...nu, role: "user" })}>Usuario</Button>
                <Button size="xs" variant={nu.role === "admin" ? "default" : "outline"} onClick={() => setNu({ ...nu, role: "admin" })}>Admin</Button>
              </div>
              <Button className="w-full" onClick={create} disabled={busy === "new" || !nu.username || nu.password.length < 8}><Plus />Crear</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ScrollText className="size-4 text-primary" />Auditoria reciente</CardTitle><CardDescription>Quien ejecuto que.</CardDescription></CardHeader>
            <CardContent>
              <ul className="max-h-96 space-y-1 overflow-auto pr-1 font-mono text-[11px]">
                {(audit ?? []).map((a, i) => (
                  <li key={i} className="flex gap-2 border-b border-border/50 py-1 last:border-0">
                    <span className="shrink-0 text-muted-foreground">{new Date(a.at).toLocaleTimeString()}</span>
                    <span className="shrink-0 text-primary">{a.source ?? "?"}</span>
                    <span className="truncate" title={a.command}>{a.command}</span>
                  </li>
                ))}
                {audit && audit.length === 0 && <li className="text-muted-foreground">Sin registros.</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
