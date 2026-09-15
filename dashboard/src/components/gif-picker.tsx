"use client";
import { useState } from "react";
import { ImagePlay, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/client";

type Gif = { id: string; title: string; url: string; preview: string };

// Buscador de GIFs (Giphy) que devuelve la URL directa del gif elegido
export function GifPicker({ apiKey, initialQuery, onPick }: { apiKey: string; initialQuery?: string; onPick: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(initialQuery ?? "");
  const [results, setResults] = useState<Gif[]>([]);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try { setResults(await apiFetch<Gif[]>(`/api/gifs?q=${encodeURIComponent(q)}&key=${encodeURIComponent(apiKey)}`)); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && results.length === 0 && q) search(); }}>
      <DialogTrigger render={<Button variant="outline" size="icon" title="Buscar GIF" disabled={!apiKey} />}><ImagePlay /></DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Buscar GIF</DialogTitle><DialogDescription>Haz clic en uno para añadirlo a la lista de ese evento.</DialogDescription></DialogHeader>
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="minecraft creeper…" autoFocus />
          <Button onClick={search} disabled={busy || !q.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Search />}Buscar</Button>
        </div>
        <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-auto sm:grid-cols-4">
          {results.map((g) => (
            <button key={g.id} onClick={() => { onPick(g.url); setOpen(false); toast.success("GIF añadido"); }} className="overflow-hidden rounded-md border transition-colors hover:border-primary" title={g.title}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.preview} alt={g.title} className="h-28 w-full object-cover" loading="lazy" />
            </button>
          ))}
          {!busy && results.length === 0 && <p className="col-span-full py-8 text-center text-xs text-muted-foreground">Escribe algo y busca.</p>}
        </div>
        <p className="text-[10px] text-muted-foreground">Powered by GIPHY</p>
      </DialogContent>
    </Dialog>
  );
}
