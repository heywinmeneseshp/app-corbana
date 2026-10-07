"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import GraficoSemanalComparable from "@/components/reportes/GraficoSemanalComparable";
import { BarraSelecciones, useSelecciones } from "@/components/reportes/SeleccionesEvaluacion";

// Los cuatro gráficos de Inicio (Ratio, Cajas, Embolses, Aprovechamiento).
// En la tarjeta se ven según el filtro del propio Inicio (panel «Fincas
// Activas»); al EXPANDIRLOS a pantalla completa aparece el filtro de
// selecciones de Reportes > Producción (fincas/grupos × años, comparables)
// y el slider de semanas. Cada gráfico tiene su propia selección.
const CHARTS = [
  { id: "ratio", titulo: "Ratio", ayuda: "Cajas producidas / racimos procesados, por semana", campo: "ratio", campoArreglo: "ratioAnual", color: "#6d28d9", limites: [{ valor: 1, color: "#b45309" }], decimal: true },
  { id: "cajas", titulo: "Cajas Producidas", ayuda: "Por semana de registro", campo: "cajas", campoArreglo: "ratioAnual", color: "#16a34a" },
  { id: "embolses", titulo: "Embolses", ayuda: "Por semana de embolse", campo: "embolse", campoArreglo: "embolseAnual", color: "#2563eb" },
  { id: "aprovechamiento", titulo: "Aprovechamiento", ayuda: "(RECUSE + PROCESADO) / embolsado", campo: "aprovechamiento", campoArreglo: "aprovechamientoAnual", color: "#047857", ejeAjustado: true, yUnit: "%", decimal: true },
];

// Arreglo del gráfico dentro de una respuesta de /dashboard/resumen.
function itemsDe(res, c) {
  let items = res?.[c.campoArreglo] || [];
  // Aprovechamiento arranca desde la primera semana de embolse (antes no hay qué aprovechar).
  if (c.id === "aprovechamiento" && res?.primeraSemanaEmbolse) {
    items = items.filter((s) => s.numeroSemana >= res.primeraSemanaEmbolse.numeroSemana);
  }
  return items;
}

function GraficoInicio({ c, fincas, dashboard, etiquetaBase }) {
  const sel = useSelecciones({ fincas });
  // Sin tocar el filtro de selecciones se usa lo que ya cargó Inicio (cero
  // consultas extra); al cambiarlo se pide cada serie a /dashboard/resumen.
  const porDefecto = sel.canastas.length === 1 && sel.canastas[0].objetivos.length === 0 && sel.canastas[0].anios.length === 0;
  const [respuestas, setRespuestas] = useState([]); // [{ serie, res }]
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const claveSeries = JSON.stringify(sel.series.map((s) => [s.key, s.anio, s.fincaIds]));

  useEffect(() => {
    if (porDefecto) return undefined;
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setError("");
    Promise.all(
      sel.series.map((serie) => {
        const params = new URLSearchParams({ anio: String(serie.anio) });
        if (serie.fincaIds.length > 0) params.set("fincas", serie.fincaIds.join(","));
        return apiFetch(`/dashboard/resumen?${params.toString()}`).then((res) => ({ serie, res }));
      }),
    )
      .then((r) => !cancelado && setRespuestas(r))
      .catch((err) => !cancelado && setError(err.message))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveSeries, porDefecto]);

  const serieBase = { key: "base", label: etiquetaBase, fincaUuids: [], fincaIds: [], anio: dashboard.anioSeleccionado, color: c.color };
  const series = porDefecto ? [serieBase] : sel.series;
  const datos = porDefecto ? [{ serie: serieBase, items: itemsDe(dashboard, c) }] : respuestas.map(({ serie, res }) => ({ serie, items: itemsDe(res, c) }));

  return (
    <GraficoSemanalComparable
      titulo={c.titulo}
      ayuda={c.ayuda}
      datos={datos}
      cargandoExterno={!porDefecto && cargando}
      errorExterno={porDefecto ? "" : error}
      series={series}
      lineas={[{ key: c.id, label: c.titulo, color: c.color, campo: c.campo }]}
      limites={c.limites}
      ejeAjustado={c.ejeAjustado}
      yUnit={c.yUnit}
      formato={c.decimal ? (v) => `${Number(v).toLocaleString("es", { maximumFractionDigits: 2 })}${c.yUnit || ""}` : undefined}
      precipitacion={false}
      alto={230}
      mensajeVacio="Sin datos"
      filtrosExpandido={<BarraSelecciones sel={sel} />}
    />
  );
}

// `dashboard`: la respuesta de /dashboard/resumen que ya tiene Inicio (con su
// filtro de fincas/año); `etiquetaBase`: cómo se llama esa selección.
export default function GraficosInicio({ dashboard, etiquetaBase }) {
  const [fincas, setFincas] = useState(null);

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((res) => setFincas(res.items || []))
      .catch(() => setFincas([]));
  }, []);

  if (!dashboard) return null;
  return (
    <div className="row g-3 mt-0">
      {CHARTS.map((c) => (
        <div key={c.id} className="col-xl-6">
          <GraficoInicio c={c} fincas={fincas || []} dashboard={dashboard} etiquetaBase={etiquetaBase} />
        </div>
      ))}
    </div>
  );
}
