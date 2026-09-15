"use client";
import { useState } from "react";
import { Folder, FileText, File as FileIcon, ChevronRight, Home, Save, Trash2, RefreshCw, FolderPlus, Upload, Download, Settings2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { apiFetch, formatBytes, type FileInfo } from "@/lib/client";
import { useDraft, usePoll } from "@/hooks/use-server";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { ReadOnlyNotice } from "@/components/admin-only";

const SHORTCUTS = [
  { label: "Raiz", path: "/" },
  { label: "server.properties", path: "/server.properties" },
  { label: "mods", path: "/mods" },
  { label: "config", path: "/config" },
  { label: "plugins", path: "/plugins" },
  { label: "world", path: "/world" },
  { label: "logs", path: "/logs" },
];

const norm = (p: string) => ("/" + p.replace(/^\/+/, "")).replace(/\/+/g, "/");
const parent = (p: string) => { const s = norm(p).split("/").filter(Boolean); s.pop(); return "/" + s.join("/"); };

export default function FilesPage() {
  const [path, setPath] = useState("/");
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const perms = usePermissions();
  const canWrite = perms.can("files.write");

  // Carga info del nodo y, si es texto legible y pequeno, su contenido
  const { data, loading: fetching, error, refresh, key } = usePoll(async () => {
    const i = await apiFetch<FileInfo>(`/api/server/files/info?path=${encodeURIComponent(path)}`);
    let c: string | null = null;
    if (!i.isDirectory && i.isTextFile && i.isReadable && i.size < 2_000_000) {
      c = await apiFetch<string>(`/api/server/files/data?path=${encodeURIComponent(path)}`);
    }
    return { path, info: i, content: c };
  }, 0, [path]);

  const stale = data !== null && data.path !== path;
  const loading = fetching || stale;
  const info = stale ? null : data?.info ?? null;
  const content = stale ? null : data?.content ?? null;
  const [draftState, setDraft] = useDraft<string>(content, key);
  const draft = draftState ?? "";
  const load = (p: string) => (p === path ? refresh() : setPath(p));

  const crumbs = norm(path).split("/").filter(Boolean);
  const dirty = content !== null && draft !== content;

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/server/files/data?path=${encodeURIComponent(path)}`, { method: "PUT", body: draft, headers: { "Content-Type": "application/octet-stream" } });
      refresh(); toast.success("Archivo guardado", { description: "Reinicia el servidor si aplica." });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const remove = async (p: string) => {
    try {
      await apiFetch(`/api/server/files/data?path=${encodeURIComponent(p)}`, { method: "DELETE" });
      toast.success("Eliminado"); if (p === path) setPath(parent(p)); else load(path);
    } catch (e) { toast.error((e as Error).message); }
  };

  const mkdir = async () => {
    if (!newName.trim()) return;
    try {
      await apiFetch(`/api/server/files/data?path=${encodeURIComponent(norm(path + "/" + newName.trim()))}&mkdir=1`, { method: "PUT" });
      toast.success("Carpeta creada"); setNewName(""); load(path);
    } catch (e) { toast.error((e as Error).message); }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      const id = toast.loading(`Subiendo ${f.name}…`);
      try {
        await apiFetch(`/api/server/files/data?path=${encodeURIComponent(norm(path + "/" + f.name))}`, { method: "PUT", body: f, headers: { "Content-Type": "application/octet-stream" } });
        toast.success(`${f.name} subido`, { id });
      } catch (e) { toast.error(`Error con ${f.name}`, { id, description: (e as Error).message }); }
    }
    load(path);
  };

  const download = () => {
    if (content === null) return;
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = info?.name ?? "file.txt"; a.click();
    URL.revokeObjectURL(a.href);
  };

  const children = [...(info?.children ?? [])].sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Archivos" description="Explora y edita los archivos del servidor.">
        <Button variant="outline" size="sm" onClick={() => load(path)}><RefreshCw className={cn(loading && "animate-spin")} />Recargar</Button>
      </PageHeader>

      {perms.ready && !canWrite && <ReadOnlyNotice what="modificar archivos" />}
      <div className="flex flex-wrap gap-1.5">
        {SHORTCUTS.map((s) => (
          <Button key={s.path} size="xs" variant={norm(path) === s.path ? "default" : "secondary"} onClick={() => setPath(s.path)}>{s.label}</Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center gap-1 border-b py-2.5 text-sm">
          <button className="rounded p-1 hover:bg-muted" onClick={() => setPath("/")}><Home className="size-4" /></button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="size-3.5 text-muted-foreground" />
              <button className={cn("rounded px-1 py-0.5 hover:bg-muted", i === crumbs.length - 1 && "font-medium")} onClick={() => setPath("/" + crumbs.slice(0, i + 1).join("/"))}>{c}</button>
            </span>
          ))}
          {info && !info.isDirectory && <Badge variant="outline" className="ml-2 font-mono text-[11px]">{formatBytes(info.size)}</Badge>}

          <div className="ml-auto flex items-center gap-1.5">
            {info?.isDirectory && canWrite && (
              <>
                <Dialog>
                  <DialogTrigger render={<Button size="sm" variant="outline" />}><FolderPlus />Carpeta</DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nueva carpeta</DialogTitle><DialogDescription>Se creara dentro de <code className="font-mono">{norm(path)}</code></DialogDescription></DialogHeader>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="nombre" className="font-mono" />
                    <DialogFooter><Button onClick={mkdir} disabled={!newName.trim()}>Crear</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button size="sm" variant="outline" nativeButton={false} render={<label />}>
                  <Upload />Subir<input type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
                </Button>
              </>
            )}
            {content !== null && (
              <>
                <Button size="sm" variant="outline" onClick={download}><Download />Descargar</Button>
                {canWrite && <Button size="sm" onClick={save} disabled={!dirty || saving || !info?.isWritable}><Save />Guardar</Button>}
              </>
            )}
            {info && norm(path) !== "/" && canWrite && (
              <AlertDialog>
                <AlertDialogTrigger render={<Button size="sm" variant="destructive" />}><Trash2 /></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar {info.isDirectory ? "carpeta" : "archivo"}?</AlertDialogTitle>
                    <AlertDialogDescription><code className="font-mono">{norm(path)}</code> se eliminara permanentemente del servidor. Esta accion no se puede deshacer.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => remove(path)}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? <div className="p-4 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
          : !info ? <div className="p-8 text-center text-sm text-muted-foreground">{error ?? "No se pudo cargar la ruta."}</div>
          : info.isDirectory ? (
            <ul className="divide-y">
              {norm(path) !== "/" && (
                <li><button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50" onClick={() => setPath(parent(path))}><Folder className="size-4" />..</button></li>
              )}
              {children.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Carpeta vacia</li>}
              {children.map((c) => (
                <li key={c.path} className="group flex items-center hover:bg-muted/50">
                  <button className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left text-sm" onClick={() => setPath(norm(c.path))}>
                    {c.isDirectory ? <Folder className="size-4 text-chart-3" /> : c.isConfigFile ? <Settings2 className="size-4 text-primary" /> : c.isTextFile ? <FileText className="size-4 text-muted-foreground" /> : <FileIcon className="size-4 text-muted-foreground" />}
                    <span className="truncate font-mono">{c.name}</span>
                    {!c.isReadable && <Lock className="size-3 text-muted-foreground" />}
                    <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{c.isDirectory ? "" : formatBytes(c.size)}</span>
                  </button>
                  {canWrite && <Button size="icon-xs" variant="ghost" className="mr-2 opacity-0 group-hover:opacity-100" onClick={() => remove(norm(c.path))} aria-label="Eliminar"><Trash2 /></Button>}
                </li>
              ))}
            </ul>
          ) : content !== null ? (
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} readOnly={!canWrite}
              className="min-h-[60vh] resize-y rounded-none border-0 bg-black/40 font-mono text-[12.5px] leading-relaxed focus-visible:ring-0" />
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {info.isTextFile ? "Archivo demasiado grande para editar aqui." : "Archivo binario: no se puede previsualizar."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
