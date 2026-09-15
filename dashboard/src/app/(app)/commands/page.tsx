"use client";
import { useState } from "react";
import { Zap, Gift, FlaskConical, PawPrint, Star, MapPin, Backpack, History, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { CommandProvider, useCommands } from "@/components/command-runner";
import { useServer } from "@/hooks/use-server";
import { useCatalog } from "@/hooks/use-catalog";
import { QuickCommands } from "./quick";
import { GiveCommand } from "./give";
import { EffectsCommand } from "./effects";
import { SummonCommand } from "./summon";
import { Favorites } from "./favorites";
import { TeleportCommand } from "./teleport";
import { InventoryCommand } from "./inventory";

function HistoryPanel() {
  const { history, clear, run } = useCommands();
  if (!history.length) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><History className="size-4 text-primary" />Ejecutados en esta sesion</CardTitle>
        <Button size="xs" variant="ghost" onClick={clear}><Trash2 />Limpiar</Button>
      </CardHeader>
      <CardContent>
        <ul className="max-h-48 space-y-1 overflow-auto font-mono text-xs">
          {history.map((h) => (
            <li key={h.id} className="flex items-center gap-2">
              {h.ok ? <CheckCircle2 className="size-3.5 shrink-0 text-primary" /> : <XCircle className="size-3.5 shrink-0 text-destructive" />}
              <button className="truncate text-left hover:underline" onClick={() => run(h.command)} title="Repetir">/{h.command}</button>
              <span className="ml-auto shrink-0 text-muted-foreground">{new Date(h.at).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function CommandsPage() {
  const { data: server } = useServer(5000);
  const { data: catalog, loading: catLoading } = useCatalog();
  const [tab, setTab] = useState("quick");
  const players = server?.players.list ?? [];
  const online = server?.status === 1;

  return (
    <CommandProvider online={online}>
      <div className="flex flex-col gap-4">
        <PageHeader title="Comandos" description="Acciones rapidas, give con catalogo de items, efectos, invocaciones y tus favoritos.">
          <StatusBadge status={server?.status} />
          <Badge variant="outline" className="font-mono">{players.length} jugador(es)</Badge>
        </PageHeader>

        {!online && (
          <div className="rounded-lg border border-chart-3/30 bg-chart-3/10 px-3 py-2 text-sm text-chart-3">
            El servidor no esta en linea: puedes preparar y copiar comandos, pero no ejecutarlos.
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList className="w-full flex-wrap sm:w-auto">
            <TabsTrigger value="quick" className="gap-1.5"><Zap className="size-4" />Rapidos</TabsTrigger>
            <TabsTrigger value="give" className="gap-1.5"><Gift className="size-4" />Give</TabsTrigger>
            <TabsTrigger value="inv" className="gap-1.5"><Backpack className="size-4" />Inventario</TabsTrigger>
            <TabsTrigger value="tp" className="gap-1.5"><MapPin className="size-4" />Teleport</TabsTrigger>
            <TabsTrigger value="effects" className="gap-1.5"><FlaskConical className="size-4" />Efectos</TabsTrigger>
            <TabsTrigger value="summon" className="gap-1.5"><PawPrint className="size-4" />Invocar</TabsTrigger>
            <TabsTrigger value="favs" className="gap-1.5"><Star className="size-4" />Favoritos</TabsTrigger>
          </TabsList>
          <TabsContent value="quick"><QuickCommands players={players} /></TabsContent>
          <TabsContent value="give"><GiveCommand catalog={catalog} loading={catLoading} players={players} /></TabsContent>
          <TabsContent value="inv"><InventoryCommand catalog={catalog} players={players} /></TabsContent>
          <TabsContent value="tp"><TeleportCommand players={players} /></TabsContent>
          <TabsContent value="effects"><EffectsCommand catalog={catalog} loading={catLoading} players={players} /></TabsContent>
          <TabsContent value="summon"><SummonCommand catalog={catalog} loading={catLoading} players={players} /></TabsContent>
          <TabsContent value="favs"><Favorites players={players} /></TabsContent>
        </Tabs>

        <HistoryPanel />
      </div>
    </CommandProvider>
  );
}
