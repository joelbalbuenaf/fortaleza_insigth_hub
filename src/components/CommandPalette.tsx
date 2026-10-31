import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, MessageSquareText } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { navReportes, navSoluciones } from "@/lib/navegacion";
import { categoriasPreguntas } from "@/lib/analytical-questions";

const EVENTO = "abrir-paleta";
export const abrirPaleta = () => window.dispatchEvent(new Event(EVENTO));

const sugeridas = Object.values(categoriasPreguntas).flatMap((l) => l.slice(0, 2));

/** Ctrl+K: navegar a cualquier pantalla o preguntarle algo a Fide. */
export function CommandPalette() {
  const [abierta, setAbierta] = useState(false);
  const [texto, setTexto] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierta((a) => !a);
      }
    };
    const abrir = () => setAbierta(true);
    window.addEventListener("keydown", tecla);
    window.addEventListener(EVENTO, abrir);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener(EVENTO, abrir);
    };
  }, []);

  const ir = (to: string, search?: Record<string, string>) => {
    setAbierta(false);
    setTexto("");
    void navigate({ to, ...(search ? { search } : {}) } as never);
  };

  return (
    <CommandDialog open={abierta} onOpenChange={setAbierta}>
      <CommandInput
        placeholder="Buscá una pantalla o escribí una pregunta para Fide…"
        value={texto}
        onValueChange={setTexto}
      />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        {texto.trim().length > 3 && (
          <CommandGroup heading="Fide">
            <CommandItem
              value={`preguntar ${texto}`}
              onSelect={() => ir("/chat", { q: texto.trim() })}
            >
              <MessageSquareText /> Preguntar a Fide: “{texto.trim()}”
            </CommandItem>
          </CommandGroup>
        )}
        <CommandGroup heading="Reportes">
          {navReportes.map(({ to, label, icon: Icon }) => (
            <CommandItem key={to} value={label} onSelect={() => ir(to)}>
              <Icon /> {label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Soluciones">
          {navSoluciones.map(({ to, label, icon: Icon }) => (
            <CommandItem key={to} value={label} onSelect={() => ir(to)}>
              <Icon /> {label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Preguntas sugeridas">
          {sugeridas.map((q) => (
            <CommandItem key={q} value={q} onSelect={() => ir("/chat", { q })}>
              <ArrowRight /> {q}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
