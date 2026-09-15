"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const registered = params.get("registered") === "1";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesion</CardTitle>
        <CardDescription>{registered ? "Cuenta creada. Podras entrar cuando el administrador la apruebe." : "Accede con tu usuario del panel."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="u" className="mb-1.5 block">Usuario</Label>
            <Input id="u" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          </div>
          <div>
            <Label htmlFor="p" className="mb-1.5 block">Contraseña</Label>
            <Input id="p" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !username || !password}>{busy ? <Loader2 className="animate-spin" /> : <LogIn />}Entrar</Button>
          <p className="text-center text-xs text-muted-foreground">¿No tienes cuenta? <Link href="/register" className="text-primary underline-offset-4 hover:underline">Crear una</Link></p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
