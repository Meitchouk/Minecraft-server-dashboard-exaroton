"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("Las contraseñas no coinciden");
    setBusy(true); setError(null);
    try {
      await apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password }) });
      router.replace("/login?registered=1");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>Cualquiera puede registrarse y entrar. El servidor del administrador solo se habilita cuando apruebe tu cuenta; mientras tanto puedes usar tu propia API key.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="u" className="mb-1.5 block">Usuario</Label>
            <Input id="u" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="3-24 caracteres: letras, numeros, . _ -" autoFocus required />
          </div>
          <div>
            <Label htmlFor="p" className="mb-1.5 block">Contraseña</Label>
            <Input id="p" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 8 caracteres" required />
          </div>
          <div>
            <Label htmlFor="c" className="mb-1.5 block">Repetir contraseña</Label>
            <Input id="c" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !username || password.length < 8}>{busy ? <Loader2 className="animate-spin" /> : <UserPlus />}Registrarme</Button>
          <p className="text-center text-xs text-muted-foreground">¿Ya tienes cuenta? <Link href="/login" className="text-primary underline-offset-4 hover:underline">Iniciar sesion</Link></p>
        </form>
      </CardContent>
    </Card>
  );
}
