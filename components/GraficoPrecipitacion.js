"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch } from "@/lib/api";

const hoyIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" });
const haceDias = (n) => {
  const d = new Date(`${hoyIso()}T12:00:00`);
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("sv-SE");
};

// Gráfica de precipitación por día con los mismos filtros de la pantalla
// (finca, usuario, fechas/semana). Con una finca elegida muestra sus mm por
// día; sin finca, el promedio de las fincas que registraron ese día. Si no hay
// fechas en el filtro usa los últimos 30 días.
export default function GraficoPrecipitacion({ filtros, fincaFiltrada }) {
  const [res, setRes] = useState({ query: null, items: [], error: "" });

  const query = useMemo(() => {
    const p = new URLSearchParams(filtros);
    if (!p.get("fechaDesde") && !p.get("fechaHasta")) {
      p.set("fechaDesde", haceDias(29));
      p.set("fechaHasta", hoyIso());
    }
    return p.toString();
  }, [filtros]);

  // Resultado junto con la consulta que lo produjo: si no coincide con la
  // consulta actual, todavía se está cargando.
  useEffect(() => {
    let vivo = true;
    apiFetch(`/precipitacion-diaria/serie?${query}`)
      .then((d) => vivo && setRes({ query, items: d.items || [], error: "" }))
      .catch((e) => vivo && setRes({ query, items: [], error: e.message }));
    return () => {
      vivo = false;
    };
  }, [query]);

  const cargando = res.query !== query;
  const items = res.items;
  const error = res.error;

  const datos = useMemo(() => {
    const porDia = new Map();
    for (const r of items) {
      const a = porDia.get(r.fecha) || { suma: 0, n: 0 };
      a.suma += r.mm;
      a.n += 1;
      porDia.set(r.fecha, a);
    }
    return [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, { suma, n }]) => ({ fecha, mm: Math.round((fincaFiltrada ? suma : suma / n) * 10) / 10, fincas: n }));
  }, [items, fincaFiltrada]);

  const total = datos.reduce((a, d) => a + d.mm, 0);

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-4">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-baseline mb-2">
          <h2 className="h6 fw-semibold mb-0">Gráfica de precipitaciones</h2>
          <span className="small text-secondary">
            {fincaFiltrada ? "mm por día de la finca" : "promedio de mm por día entre las fincas que registraron"}
            {datos.length > 0 && ` · ${Math.round(total * 10) / 10} mm${fincaFiltrada ? " acumulados" : " (suma de promedios)"}`}
          </span>
        </div>
        {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}
        {!error && cargando && <p className="text-secondary small mb-0">Cargando...</p>}
        {!error && !cargando && datos.length === 0 && (
          <p className="text-secondary small mb-0">No hay registros en este periodo.</p>
        )}
        {!error && datos.length > 0 && (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={datos} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickFormatter={(f) => f.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} width={40} unit=" mm" />
              <Tooltip formatter={(v) => [`${v} mm`, "Precipitación"]} labelFormatter={(f) => f} />
              <Bar dataKey="mm" fill="#2563eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
