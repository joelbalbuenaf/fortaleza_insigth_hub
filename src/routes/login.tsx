import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import fide from "@/assets/fide.svg";
import logoFortaleza from "@/assets/logo-fortaleza.png";
import logoFortalezaBlanco from "@/assets/logo-fortaleza-blanco.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { destinoSeguro } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" ? { next: s["next"] } : {},
  head: () => ({
    meta: [{ title: "Ingresar · Hub Analítico Fortaleza" }, { name: "robots", content: "noindex" }],
  }),
  component: Login,
});

function Login() {
  const { next } = Route.useSearch();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const ingresar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usuario, clave }),
      });
      const datos = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(datos.error ?? "No se pudo iniciar sesión.");
      // Recarga completa: el servidor ya ve la cookie de sesión.
      window.location.assign(destinoSeguro(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
      setEnviando(false);
    }
  };

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-2">
      <section className="bg-hero relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-brand-stripe" />
        <img
          src={logoFortalezaBlanco}
          alt="Fortaleza Inmuebles"
          width={185}
          height={62}
          className="h-14 w-auto self-start"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sidebar-primary">
            Fortaleza Inmuebles S.A.
          </p>
          <h1 className="mt-3 text-5xl font-bold">Hub Analítico</h1>
          <p className="mt-4 max-w-md text-lg opacity-80">
            Cartera de aportes, adjudicaciones, obra y mercado en un solo lugar, con Fide para
            preguntarle a los datos.
          </p>
        </div>
        <div className="flex items-center gap-3 opacity-80">
          <img
            src={fide}
            alt=""
            width={44}
            height={44}
            className="size-11 rounded-lg bg-white p-1"
          />
          <p className="text-sm">
            <strong>Fide</strong> — tu agente de datos
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <img
              src={logoFortaleza}
              alt="Fortaleza Inmuebles"
              width={185}
              height={62}
              className="h-11 w-auto self-start"
            />
          </div>
          <span className="grid size-12 place-items-center rounded-xl bg-secondary text-primary dark:text-sidebar-primary">
            <LockKeyhole className="size-6" />
          </span>
          <h2 className="mt-4 text-2xl font-bold">Ingresar al Hub</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Acceso restringido · contiene datos confidenciales de la cartera de socios
          </p>

          <form onSubmit={ingresar} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="usuario">Usuario</Label>
              <Input
                id="usuario"
                autoComplete="username"
                autoFocus
                required
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clave">Contraseña</Label>
              <div className="relative">
                <Input
                  id="clave"
                  type={ver ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando && <Loader2 className="size-4 animate-spin" />}
              Ingresar
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
