import { useEffect, useState } from "react";
import { LogOut, UserRound } from "lucide-react";

/** Usuario conectado y botón para salir. No muestra nada si el Hub no está protegido. */
export function SesionUsuario() {
  const [usuario, setUsuario] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sesion")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { protegido: boolean; usuario: string | null } | null) =>
        setUsuario(d?.protegido ? d.usuario : null),
      )
      .catch(() => setUsuario(null));
  }, []);

  if (!usuario) return null;

  const salir = async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/login");
  };

  return (
    <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/80">
      <UserRound className="size-3.5 shrink-0" />
      <span className="flex-1 truncate" title={usuario}>
        {usuario}
      </span>
      <button
        onClick={salir}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition hover:bg-sidebar-accent hover:text-sidebar-primary"
        title="Cerrar sesión"
      >
        <LogOut className="size-3.5" /> Salir
      </button>
    </div>
  );
}
