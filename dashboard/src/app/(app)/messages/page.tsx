"use client";
import { useState } from "react";
import { GifPicker } from "@/components/gif-picker";
import { MessageSquareHeart, Megaphone, ScrollText, Save, Play, Plus, Trash2, Radio, Loader2, Eye, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { AdminBadge, ReadOnlyNotice } from "@/components/admin-only";
import { usePoll, useDraft, useServer } from "@/hooks/use-server";
import { usePermissions } from "@/hooks/use-permissions";
import { apiFetch } from "@/lib/client";
import { cn } from "@/lib/utils";

type Settings = {
  welcome: { enabled: boolean; title: string; subtitle: string; chat: string; firstJoinChat: string };
  auto: { enabled: boolean; intervalMin: number; messages: string[] };
  discord: { webhook: string; joins: boolean; deaths: boolean; chat: boolean; serverStatus: boolean; mentionEveryone: boolean; name: string; avatar: string; serverName: string; address: string; gifs: { join: string; leave: string; death: string; online: string; offline: string }; giphy: { apiKey: string; auto: boolean; rating: "g" | "pg" | "pg-13" | "r"; terms: { join: string; leave: string; death: string; online: string; offline: string } } };
  rules: string;
};
type Watcher = { connected: boolean; serverOnline: boolean; online: string[]; lastLine: number | null; events: number };

export default function MessagesPage() {
  const { data: settings, key, setData } = usePoll(() => apiFetch<Settings>("/api/messages"));
  const { data: watcher, refresh: refreshWatcher } = usePoll(() => apiFetch<Watcher>("/api/watcher"), 15000);
  const { data: server } = useServer(8000);
  const perms = usePermissions();
  const canEdit = perms.can("config.write");
  const [draft, setDraft] = useDraft<Settings>(settings, key);
  const [saving, setSaving] = useState(false);
  const [newMsg, setNewMsg] = useState("");
  const [previewFor, setPreviewFor] = useState("");
  const d = draft;
  const dirty = !!d && !!settings && JSON.stringify(d) !== JSON.stringify(settings);

  const save = async () => {
    if (!d) return;
    setSaving(true);
    try { setData(await apiFetch<Settings>("/api/messages", { method: "POST", body: JSON.stringify(d) })); toast.success("Mensajes guardados"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };
  const preview = async () => {
    const p = previewFor || server?.players.list[0];
    if (!p) return toast.error("No hay jugadores conectados para la prueba");
    if (dirty) await save();
    try { await apiFetch("/api/messages/preview", { method: "POST", body: JSON.stringify({ player: p }) }); toast.success(`Bienvenida enviada a ${p}`); }
    catch (e) { toast.error((e as Error).message); }
  };

  if (!d) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  const set = (patch: Partial<Settings>) => setDraft({ ...d, ...patch });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Mensajes" description="Bienvenida, consejos automaticos, reglas y avisos a Discord. Sin mods: lo hace el panel escuchando la consola.">
        {perms.ready && !canEdit && <AdminBadge />}
        <Button onClick={save} disabled={!dirty || saving || !canEdit}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Guardar</Button>
      </PageHeader>

      {/* Estado del observador */}
      <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm", watcher?.connected ? "border-primary/30 bg-primary/5" : "border-chart-3/40 bg-chart-3/10")}>
        <Radio className={cn("size-4", watcher?.connected ? "text-primary" : "text-chart-3")} />
        {watcher ? (
          <span className="flex-1">
            Observador de consola: <b>{watcher.connected ? "conectado" : "reconectando…"}</b>
            {watcher.serverOnline ? <> · servidor en linea · {watcher.online.length} jugador(es): <span className="font-mono">{watcher.online.join(", ") || "—"}</span></> : " · servidor apagado"}
            {watcher.lastLine && <span className="text-muted-foreground"> · ultima linea: {new Date(watcher.lastLine).toLocaleTimeString()}</span>}
          </span>
        ) : <span className="flex-1">Comprobando observador…</span>}
        <Button size="xs" variant="ghost" onClick={refreshWatcher}>Actualizar</Button>
      </div>
      {perms.ready && !canEdit && <ReadOnlyNotice what="editar los mensajes" />}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bienvenida */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquareHeart className="size-4 text-primary" />Bienvenida al entrar</CardTitle>
            <CardDescription>Titulo grande en pantalla + mensaje en el chat 2,5 s despues de conectarse. Usa <code className="rounded bg-muted px-1">{"{player}"}</code> para el nombre.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2"><span className="text-sm">Activada</span><Switch checked={d.welcome.enabled} disabled={!canEdit} onCheckedChange={(v) => set({ welcome: { ...d.welcome, enabled: v } })} /></div>
            <div><Label className="mb-1.5 block text-xs">Titulo</Label><Input value={d.welcome.title} readOnly={!canEdit} onChange={(e) => set({ welcome: { ...d.welcome, title: e.target.value } })} /></div>
            <div><Label className="mb-1.5 block text-xs">Subtitulo</Label><Input value={d.welcome.subtitle} readOnly={!canEdit} onChange={(e) => set({ welcome: { ...d.welcome, subtitle: e.target.value } })} /></div>
            <div><Label className="mb-1.5 block text-xs">Mensaje en el chat</Label><Textarea rows={2} value={d.welcome.chat} readOnly={!canEdit} onChange={(e) => set({ welcome: { ...d.welcome, chat: e.target.value } })} /></div>
            <div><Label className="mb-1.5 block text-xs">Mensaje la primera vez que entra</Label><Textarea rows={2} value={d.welcome.firstJoinChat} readOnly={!canEdit} onChange={(e) => set({ welcome: { ...d.welcome, firstJoinChat: e.target.value } })} /></div>
            <div className="flex gap-2">
              <Input placeholder={server?.players.list[0] ? `Probar con ${server.players.list[0]}` : "Jugador conectado…"} value={previewFor} onChange={(e) => setPreviewFor(e.target.value)} className="font-mono" />
              <Button variant="outline" onClick={preview} disabled={!canEdit || server?.status !== 1}><Eye />Probar</Button>
            </div>
          </CardContent>
        </Card>

        {/* Mensajes automaticos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Megaphone className="size-4 text-primary" />Consejos automaticos</CardTitle>
            <CardDescription>Se envian por turnos al chat, solo cuando hay jugadores conectados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="text-sm">Activados</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">cada <Input type="number" min={1} max={240} value={d.auto.intervalMin} readOnly={!canEdit} onChange={(e) => set({ auto: { ...d.auto, intervalMin: Number(e.target.value) || 12 } })} className="h-7 w-16 font-mono" /> min</label>
                <Switch checked={d.auto.enabled} disabled={!canEdit} onCheckedChange={(v) => set({ auto: { ...d.auto, enabled: v } })} />
              </div>
            </div>
            <ul className="space-y-1.5">
              {d.auto.messages.map((m, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                  <Badge variant="secondary" className="h-5 w-6 justify-center px-0 font-mono">{i + 1}</Badge>
                  <span className="min-w-0 flex-1 truncate" title={m}>{m}</span>
                  {canEdit && <Button size="icon-xs" variant="ghost" onClick={() => set({ auto: { ...d.auto, messages: d.auto.messages.filter((_, j) => j !== i) } })}><Trash2 /></Button>}
                </li>
              ))}
              {d.auto.messages.length === 0 && <li className="py-3 text-center text-xs text-muted-foreground">Sin mensajes.</li>}
            </ul>
            {canEdit && (
              <div className="flex gap-2">
                <Input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Nuevo consejo…" onKeyDown={(e) => { if (e.key === "Enter" && newMsg.trim()) { set({ auto: { ...d.auto, messages: [...d.auto.messages, newMsg.trim()] } }); setNewMsg(""); } }} />
                <Button variant="outline" disabled={!newMsg.trim()} onClick={() => { set({ auto: { ...d.auto, messages: [...d.auto.messages, newMsg.trim()] } }); setNewMsg(""); }}><Plus /></Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reglas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ScrollText className="size-4 text-primary" />Reglas (/rules)</CardTitle>
            <CardDescription>Una regla por linea. Se guardan en el archivo que lee el comando <code className="rounded bg-muted px-1">/rules</code> del servidor.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea rows={8} value={d.rules} readOnly={!canEdit} onChange={(e) => set({ rules: e.target.value })} className="font-mono text-sm" />
          </CardContent>
        </Card>

        {/* Discord */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Webhook className="size-4 text-primary" />Discord (webhook)</CardTitle>
            <CardDescription>Tarjetas con la skin del jugador, color por evento, GIF opcional y mencion a @everyone al encender. Sin mods ni bot. En el canal: Editar canal → Integraciones → Webhooks → Nuevo webhook → copiar URL.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input type="password" placeholder="https://discord.com/api/webhooks/…" value={d.discord.webhook} readOnly={!canEdit} onChange={(e) => set({ discord: { ...d.discord, webhook: e.target.value } })} className="font-mono text-xs" />
              <Button variant="outline" disabled={!canEdit || !d.discord.webhook} onClick={() => apiFetch("/api/messages/preview", { method: "POST", body: JSON.stringify({ discord: d.discord.webhook }) }).then(() => toast.success("Mensaje de prueba enviado a Discord")).catch((e) => toast.error((e as Error).message))}>Probar</Button>
            </div>
            {([["joins", "Entradas y salidas de jugadores"], ["deaths", "Muertes"], ["serverStatus", "Servidor encendido / apagado"], ["mentionEveryone", "Mencionar a @everyone cuando el servidor se enciende"], ["chat", "Todo el chat del juego"]] as const).map(([k, label]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border px-3 py-2"><span className="text-sm">{label}</span><Switch checked={d.discord[k]} disabled={!canEdit} onCheckedChange={(v) => set({ discord: { ...d.discord, [k]: v } })} /></div>
            ))}
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Apariencia y GIFs</summary>
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label className="mb-1.5 block text-xs">Nombre del bot</Label><Input value={d.discord.name} readOnly={!canEdit} onChange={(e) => set({ discord: { ...d.discord, name: e.target.value } })} /></div>
                  <div><Label className="mb-1.5 block text-xs">Avatar del bot (URL de imagen)</Label><Input value={d.discord.avatar} readOnly={!canEdit} onChange={(e) => set({ discord: { ...d.discord, avatar: e.target.value } })} className="font-mono text-xs" /></div>
                  <div><Label className="mb-1.5 block text-xs">Nombre del servidor (pie de las tarjetas)</Label><Input value={d.discord.serverName} readOnly={!canEdit} onChange={(e) => set({ discord: { ...d.discord, serverName: e.target.value } })} /></div>
                  <div><Label className="mb-1.5 block text-xs">Direccion que se muestra al encender</Label><Input value={d.discord.address} readOnly={!canEdit} onChange={(e) => set({ discord: { ...d.discord, address: e.target.value } })} className="font-mono text-xs" /></div>
                </div>
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium">GIFs automaticos con Giphy</p>
                  <p className="text-[11px] text-muted-foreground">Con una API key gratuita de Giphy (developers.giphy.com → Create an App → API) el panel elige un GIF al azar por tema en cada evento, y puedes buscar GIFs aqui mismo para fijarlos.</p>
                  <div className="flex gap-2">
                    <Input type="password" placeholder="API key de Giphy" value={d.discord.giphy.apiKey} readOnly={!canEdit} onChange={(e) => set({ discord: { ...d.discord, giphy: { ...d.discord.giphy, apiKey: e.target.value } } })} className="font-mono text-xs" />
                    <select value={d.discord.giphy.rating} disabled={!canEdit} onChange={(e) => set({ discord: { ...d.discord, giphy: { ...d.discord.giphy, rating: e.target.value as Settings["discord"]["giphy"]["rating"] } } })} className="rounded-lg border bg-transparent px-2 text-xs">
                      {["g", "pg", "pg-13", "r"].map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2"><span className="text-sm">GIF aleatorio por tema cuando no hay URL fija</span><Switch checked={d.discord.giphy.auto} disabled={!canEdit} onCheckedChange={(v) => set({ discord: { ...d.discord, giphy: { ...d.discord.giphy, auto: v } } })} /></div>
                </div>
                {([["online", "Servidor encendido"], ["join", "Entra un jugador"], ["leave", "Sale un jugador"], ["death", "Muerte"], ["offline", "Servidor apagado"]] as const).map(([k, l]) => (
                  <div key={k} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                    <div>
                      <Label className="mb-1.5 block text-xs">{l} · tema para el GIF aleatorio</Label>
                      <Input value={d.discord.giphy.terms[k]} readOnly={!canEdit} onChange={(e) => set({ discord: { ...d.discord, giphy: { ...d.discord.giphy, terms: { ...d.discord.giphy.terms, [k]: e.target.value } } } })} placeholder="ej. minecraft welcome" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">GIF fijo (URLs, una por linea; tiene prioridad)</Label>
                      <div className="flex gap-2">
                        <Textarea rows={1} value={d.discord.gifs[k]} readOnly={!canEdit} onChange={(e) => set({ discord: { ...d.discord, gifs: { ...d.discord.gifs, [k]: e.target.value } } })} className="font-mono text-xs" placeholder="https://media.giphy.com/media/…/giphy.gif" />
                        {canEdit && <GifPicker apiKey={d.discord.giphy.apiKey} initialQuery={d.discord.giphy.terms[k]} onPick={(url) => set({ discord: { ...d.discord, gifs: { ...d.discord.gifs, [k]: (d.discord.gifs[k] ? d.discord.gifs[k].trim() + "\n" : "") + url } } })} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
            <p className="text-[11px] text-muted-foreground">Los avisos se envian cuando ocurre el evento (alguien entra, muere, el servidor arranca…); si el servidor esta apagado no hay nada que avisar. Es de una sola direccion (juego → Discord). Para que lo escrito en Discord aparezca en el juego haria falta un bot o un mod.</p>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-3 rounded-full border bg-popover/90 px-4 py-2 shadow-xl backdrop-blur transition-all" style={{ opacity: dirty ? 1 : 0, pointerEvents: dirty ? "auto" : "none" }}>
        <span className="text-sm">Cambios sin guardar</span>
        <Button size="sm" variant="ghost" onClick={() => settings && setDraft(settings)}>Descartar</Button>
        <Button size="sm" onClick={save} disabled={saving}><Save />Guardar</Button>
      </div>
      <p className="text-xs text-muted-foreground"><Play className="mr-1 inline size-3" />Los cambios se aplican al guardar, sin reiniciar.</p>
    </div>
  );
}
