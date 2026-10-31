import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Printer, X } from "lucide-react";
import { Kpi } from "@/components/AppShell";
import { BotonCsv, Seccion, Tabla } from "@/components/comercial/comun";
import { Contenido, EncabezadoSolucion } from "@/components/soluciones/comun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { generarCronograma, type Refuerzo } from "@/lib/fide/simulador";
import { fmtNumero } from "@/lib/export";

export const Route = createFileRoute("/soluciones/simulador")({
  head: () => ({ meta: [{ title: "Simulador de planes · Hub Fortaleza" }] }),
  component: Page,
});

const gs = (v: number) => `Gs ${fmtNumero(v, 0)}`;
const gsMM = (v: number) => `Gs ${fmtNumero(v / 1_000_000, 1)} MM`;

function Page() {
  const [valorMM, setValorMM] = useState(420);
  const [cuotasTotales, setCuotasTotales] = useState(180);
  const [cuotasPre, setCuotasPre] = useState(60);
  const [tasaPct, setTasaPct] = useState(0.9);
  const [inicio, setInicio] = useState("2026-11-10");
  const [refuerzos, setRefuerzos] = useState<Refuerzo[]>([{ periodo: 60, monto: 40_000_000 }]);

  const { filas, resumen } = useMemo(
    () =>
      generarCronograma({
        valor: valorMM * 1_000_000,
        cuotasTotales,
        cuotasPre: Math.min(cuotasPre, cuotasTotales),
        tasa: tasaPct / 100,
        inicio,
        refuerzos: refuerzos.filter((r) => r.periodo >= 1 && r.monto > 0),
      }),
    [valorMM, cuotasTotales, cuotasPre, tasaPct, inicio, refuerzos],
  );

  const actualizarRefuerzo = (i: number, cambio: Partial<Refuerzo>) =>
    setRefuerzos((prev) => prev.map((r, k) => (k === i ? { ...r, ...cambio } : r)));

  return (
    <main className="pb-10">
      <EncabezadoSolucion
        categoria="Comercial"
        titulo="Simulador de planes"
        desc="Cronograma de aportes de un socio: cuotas antes de la adjudicación sin interés, saldo financiado después y refuerzos."
        requiere="Es la misma lógica del cuotero que ya usa el equipo, verificada contra su salida fila por fila. Los valores y tasas de acá son de ejemplo: para producción hay que cargar los vigentes de cada plan."
        pregunta="Simulá un plan de 180 cuotas con 60 cuotas antes de la adjudicación."
        fuente="ilustrativo"
      />
      <Contenido>
        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <Seccion
              titulo="Parámetros"
              acciones={
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="size-3.5" /> PDF
                </Button>
              }
            >
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor de la unidad (Gs MM)</Label>
                  <Input
                    id="valor"
                    type="number"
                    min={10}
                    value={valorMM}
                    onChange={(e) => setValorMM(Math.max(1, Number(e.target.value)))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Cuotas totales: <strong>{cuotasTotales}</strong> (
                    {fmtNumero(cuotasTotales / 12, 1)} años)
                  </Label>
                  <Slider
                    value={[cuotasTotales]}
                    min={12}
                    max={240}
                    step={6}
                    onValueChange={(v) => setCuotasTotales(v[0] ?? 180)}
                    aria-label="Cuotas totales"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Cuotas antes de la adjudicación:{" "}
                    <strong>{Math.min(cuotasPre, cuotasTotales)}</strong>
                  </Label>
                  <Slider
                    value={[Math.min(cuotasPre, cuotasTotales)]}
                    min={0}
                    max={cuotasTotales}
                    step={6}
                    onValueChange={(v) => setCuotasPre(v[0] ?? 0)}
                    aria-label="Cuotas antes de la adjudicación"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Tasa mensual del tramo financiado: <strong>{fmtNumero(tasaPct, 2)}%</strong>
                  </Label>
                  <Slider
                    value={[tasaPct]}
                    min={0}
                    max={3}
                    step={0.05}
                    onValueChange={(v) => setTasaPct(v[0] ?? 0.9)}
                    aria-label="Tasa mensual"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inicio">Primera cuota</Label>
                  <Input
                    id="inicio"
                    type="date"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Refuerzos</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setRefuerzos((prev) => [
                          ...prev,
                          { periodo: Math.min(cuotasTotales, 12), monto: 20_000_000 },
                        ])
                      }
                    >
                      <Plus className="size-3.5" /> Agregar
                    </Button>
                  </div>
                  {refuerzos.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin refuerzos.</p>
                  )}
                  {refuerzos.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={cuotasTotales}
                        value={r.periodo}
                        onChange={(e) => actualizarRefuerzo(i, { periodo: Number(e.target.value) })}
                        className="w-20"
                        aria-label={`Período del refuerzo ${i + 1}`}
                      />
                      <Input
                        type="number"
                        min={0}
                        step={1_000_000}
                        value={r.monto}
                        onChange={(e) => actualizarRefuerzo(i, { monto: Number(e.target.value) })}
                        aria-label={`Monto del refuerzo ${i + 1}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRefuerzos((prev) => prev.filter((_, k) => k !== i))}
                        aria-label={`Quitar refuerzo ${i + 1}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Período (número de cuota) y monto en guaraníes.
                  </p>
                </div>
              </div>
            </Seccion>
          </div>

          <div className="space-y-6 xl:col-span-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <Kpi
                label="Cuota antes de adjudicar"
                value={gs(resumen.cuotaPre)}
                hint={`${resumen.cuotasPre} cuotas sin interés`}
              />
              <Kpi
                label="Cuota después de adjudicar"
                value={gs(resumen.cuotaPost)}
                hint={`${resumen.cuotasPost} cuotas con sistema francés`}
              />
              <Kpi
                label="Total pagado"
                value={gsMM(resumen.totalPagado)}
                hint={`Valor de la unidad: ${gsMM(resumen.valor)}`}
              />
              <Kpi
                label="Intereses"
                value={gsMM(resumen.totalIntereses)}
                hint={`Incluye ${gsMM(resumen.interesesCapitalizados)} capitalizados en la obra`}
              />
            </div>

            <Seccion
              titulo={`Cronograma · ${filas.length} líneas`}
              acciones={<BotonCsv filas={filas} nombre="cronograma-plan" />}
            >
              <Tabla
                alto={520}
                filas={filas}
                clave={(f) => `${f.tramo}-${f.periodo}-${f.monto}`}
                columnas={[
                  { titulo: "N°", valor: (f) => f.periodo, numero: true },
                  { titulo: "Fecha", valor: (f) => f.fecha },
                  {
                    titulo: "Tramo",
                    valor: (f) => (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          f.tramo === "Refuerzo"
                            ? "bg-[var(--series-4)]/15 text-[var(--series-4)]"
                            : f.tramo === "Post-adjudicación"
                              ? "bg-[var(--series-1)]/15 text-[var(--series-1)]"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {f.tramo}
                      </span>
                    ),
                  },
                  { titulo: "Monto", valor: (f) => gs(f.monto), numero: true },
                  { titulo: "Interés", valor: (f) => gs(f.interes), numero: true },
                  { titulo: "Amortización", valor: (f) => gs(f.amortizacion), numero: true },
                  { titulo: "Saldo", valor: (f) => gs(f.saldo), numero: true },
                ]}
              />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                El tramo previo a la adjudicación no lleva interés. Como durante la obra se cobra
                menos de lo que correspondería a un plan sin interés, ese faltante devenga interés
                simple y se <strong>capitaliza</strong>: se suma al capital que se financia después.
                Es la misma lógica del cuotero original, y los tests del Hub comparan este
                cronograma contra su salida.
              </p>
            </Seccion>
          </div>
        </div>
      </Contenido>
    </main>
  );
}
