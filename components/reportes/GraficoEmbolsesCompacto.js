"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FiMaximize2, FiX, FiBarChart2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import { COLOR_HEX } from "@/lib/semanaColor";

// Mismo endpoint que usa el Gráfico de Embolses del reporte completo (ver
// components/reportes/GraficoMovimientoAnual.js) — acá se pide un solo
// año, y se recorta a las semanas 1..hastaSemana (la semana en la que está
// parado el tablero de indicadores), en vez de mostrar el año completo.
// `fincaUuid`: si el tablero está filtrado/drillado a una finca puntual
// (clic en una fila de la tabla "Fincas", o el filtro de finca de arriba),
// el gráfico se filtra a esa misma finca — pedido explícito, no debe
// quedar mostrando el total de todas las fincas mientras el resto del
// panel ya está filtrado.
function useEmbolsesDelAnio(anio, hastaSemana, fincaUuid) {
  const [puntos, setPuntos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!anio) return;
    let cancelado = false;
    const params = new URLSearchParams({ anios: String(anio), tipo: "EMBOLSE" });
    if (fincaUuid) params.set("fincaUuids", fincaUuid);
    apiFetch(`/racimo-movimientos/reporte-embolses?${params.toString()}`)
      .then((res) => {
        if (cancelado) return;
        const puntosAnio = res?.anios?.[0]?.puntos || [];
        const filtrados = hastaSemana
          ? puntosAnio.filter((p) => p.numeroSemana <= hastaSemana)
          : puntosAnio;
        setPuntos(filtrados.sort((a, b) => a.numeroSemana - b.numeroSemana));
      })
      .catch((err) => !cancelado && setError(err.message));
    return () => {
      cancelado = true;
    };
  }, [anio, hastaSemana, fincaUuid]);

  return { puntos, error };
}

function GraficoLinea({ puntos, height }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={puntos} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="numeroSemana" tickFormatter={(v) => `S${v}`} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} width={40} domain={["auto", "auto"]} />
        <Tooltip
          formatter={(v) => [Number(v).toLocaleString("es"), "Embolsado"]}
          labelFormatter={(v) => `Semana ${v}`}
        />
        <Line
          type="monotone"
          dataKey="totalEmbolsado"
          stroke="#16a34a"
          strokeWidth={2}
          connectNulls={false}
          // Cada punto es una semana de embolse — se colorea según su
          // cinta (mismo criterio que GraficoMovimientoAnual), en vez de
          // dejar todos los puntos del mismo color de la línea.
          dot={(dotProps) => {
            const p = puntos.find((x) => x.numeroSemana === dotProps.payload.numeroSemana);
            const colorHex = COLOR_HEX[p?.color] || "#16a34a";
            return (
              <circle
                key={`punto-${dotProps.payload.numeroSemana}`}
                cx={dotProps.cx}
                cy={dotProps.cy}
                r={4}
                fill={colorHex}
                stroke="#374151"
                strokeWidth={1}
              />
            );
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Tarjeta compacta con el Gráfico de Embolses del año vigente hasta la
// semana en la que está parado el tablero de indicadores — pedido
// explícito: esquina inferior derecha del panel, con opción de ampliar en un
// modal (mismo dato, más grande) sin salir de la pantalla.
export default function GraficoEmbolsesCompacto({ anio, hastaSemana, fincaUuid, fincaNombre }) {
  const [ampliado, setAmpliado] = useState(false);
  const { puntos, error } = useEmbolsesDelAnio(anio, hastaSemana, fincaUuid);

  return (
    <div className="rounded-4 shadow-sm h-100 p-3 bg-white">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <h3 className="h6 fw-semibold mb-0 d-flex align-items-center gap-2" style={{ color: "#0f172a" }}>
          <span
            className="rounded-circle d-inline-flex align-items-center justify-content-center"
            style={{ width: 26, height: 26, background: "#ecfdf5", color: "#059669" }}
          >
            <FiBarChart2 size={14} />
          </span>
          Gráfico de Embolses
        </h3>
        <button
          type="button"
          className="btn btn-sm btn-light rounded-circle p-1 shadow-sm"
          title="Ampliar"
          onClick={() => setAmpliado(true)}
          disabled={!puntos?.length}
        >
          <FiMaximize2 size={13} />
        </button>
      </div>
      <p className="text-secondary small mb-2">
        Total embolsado por semana — {anio}, hasta la semana {hastaSemana || "actual"}
        {fincaUuid ? ` — ${fincaNombre || "finca filtrada"}` : ""}.
      </p>

      {error && <p className="text-danger small mb-0">{error}</p>}
      {!error && puntos === null && <p className="text-secondary small mb-0">Cargando...</p>}
      {!error && puntos !== null && puntos.length === 0 && (
        <p className="text-secondary small mb-0">Sin embolses registrados todavía.</p>
      )}
      {!error && puntos?.length > 0 && <GraficoLinea puntos={puntos} height={170} />}

      {ampliado && (
        <ModalShell title={`Gráfico de Embolses — ${anio}${fincaUuid ? ` — ${fincaNombre || ""}` : ""}`} onClose={() => setAmpliado(false)} size="xl">
          <p className="text-secondary small mb-3">
            Total embolsado por semana, hasta la semana {hastaSemana || "actual"} de {anio}
            {fincaUuid ? ` — ${fincaNombre || "finca filtrada"}` : ""}.
          </p>
          {puntos?.length > 0 && <GraficoLinea puntos={puntos} height={420} />}
          <div className="d-flex justify-content-end mt-3">
            <button type="button" className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-1" onClick={() => setAmpliado(false)}>
              <FiX size={14} /> Cerrar
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
