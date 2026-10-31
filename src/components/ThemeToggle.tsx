import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const CLAVE = "fortaleza-tema";

/** Script en el <head> que aplica el tema antes de pintar (evita el parpadeo). */
export const scriptTema = `try{if(localStorage.getItem("${CLAVE}")==="oscuro")document.documentElement.classList.add("dark")}catch(e){}`;

export function ThemeToggle() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => setOscuro(document.documentElement.classList.contains("dark")), []);
  const cambiar = () => {
    const nuevo = !oscuro;
    document.documentElement.classList.toggle("dark", nuevo);
    try {
      localStorage.setItem(CLAVE, nuevo ? "oscuro" : "claro");
    } catch {
      /* sin almacenamiento: el tema dura la sesión */
    }
    setOscuro(nuevo);
  };
  return (
    <button
      onClick={cambiar}
      className="grid size-10 shrink-0 place-items-center rounded-xl bg-sidebar-accent text-sidebar-foreground transition hover:text-sidebar-primary"
      title={oscuro ? "Modo claro" : "Modo oscuro"}
      aria-label={oscuro ? "Activar modo claro" : "Activar modo oscuro"}
    >
      {oscuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
