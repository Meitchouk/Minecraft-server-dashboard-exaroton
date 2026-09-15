"use client";
import { useState, useSyncExternalStore } from "react";
import { KeyRound, ShieldAlert, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, getOwnToken, setOwnToken } from "@/lib/client";

const sub = (cb: () => void) => { window.addEventListener("exaroton:server-changed", cb); return () => window.removeEventListener("exaroton:server-changed", cb); };

// Permite usar la API key del propio usuario. Solo vive en sessionStorage de esta pestaña y viaja en una cabecera;
// el servidor la usa al vuelo para hablar con Exaroton y nunca la guarda ni la registra.
export function OwnKeyCard() {
  const active = useSyncExternalStore(sub, () => !!getOwnToken(), () => false);
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);

  const use = async () => {
    const k = key.trim();
    if (!k) return;
    setTesting(true);
    try {
      // prueba la key antes de activarla (sin guardarla): pide la cuenta con esa cabecera
      const acc = await apiFetch<{ name: string; credits: number }>("/api/account", { headers: { "x-exaroton-token": k } });
      setOwnToken(k); setKey("");
      toast.success(`Usando la API key de ${acc.name}`, { description: `${acc.credits.toFixed(2)} creditos · solo en esta pestaña` });
    } catch (e) { toast.error("La API key no es valida", { description: (e as Error).message }); }
    finally { setTesting(false); }
  };

  return (
    <Card className={active ? "border-chart-3/40" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" />Mi API key de Exaroton</CardTitle>
        <CardDescription>Por defecto el panel usa la API key del administrador. Si prefieres operar con la tuya (tus servidores, tus creditos), puedes usarla temporalmente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-chart-3/30 bg-chart-3/10 p-3 text-xs text-chart-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <p><b>Bajo tu responsabilidad.</b> La key se guarda solo en la memoria de esta pestaña (se borra al cerrarla o al cerrar sesion), se envia cifrada a este panel para cada accion y <b>nunca se almacena</b> en el servidor, en la base de datos ni en la auditoria.</p>
        </div>
        {active ? (
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <span className="flex items-center gap-2 text-sm"><Check className="size-4 text-primary" />Usando tu API key en esta sesion</span>
            <Button size="sm" variant="outline" onClick={() => { setOwnToken(""); toast.info("Vuelves a usar la key del administrador"); }}><X />Dejar de usarla</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Pega tu API key (exaroton.com/account → API)" className="font-mono" onKeyDown={(e) => e.key === "Enter" && use()} />
            <Button onClick={use} disabled={!key.trim() || testing}>{testing ? <Loader2 className="animate-spin" /> : <KeyRound />}Usar en esta sesion</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
