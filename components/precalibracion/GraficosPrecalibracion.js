"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Tooltip con la cinta y edad explícitas (el color ya viene de la cinta).
function TooltipCinta({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border rounded-3 px-2 py-1 small shadow-sm">
      <div className="d-flex align-items-center gap-1 fw-medium">
        <span className="rounded-circle d-inline-block" style={{ width: 8, height: 8, background: d.color }} />
        {d.nombre} · Edad {d.edad}
      </div>
      <div>{Number(payload[0].value).toLocaleString("es")} racimos</div>
    </div>
  );
}

function ContenedorGrafico({ titulo, descripcion, children, alto = 230 }) {
  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 h-100 d-flex flex-column">
      <h2 className="h6 fw-bold mb-0">{titulo}</h2>
      {descripcion && <p className="small text-secondary mb-2">{descripcion}</p>}
      <div className="my-auto" style={{ height: alto }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Gráfico de distribución por cinta/edad (ocupa su columna del grid que
// arma la página). Cantidad arriba de la barra y % dentro (blanco).
export default function GraficosPrecalibracion({ distribucion }) {
  const total = distribucion.reduce((a, d) => a + (d.racimos || 0), 0);
  return (
    <ContenedorGrafico titulo="Distribución por edad">
          <BarChart data={distribucion} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="etiqueta" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip content={<TooltipCinta />} />
            <Bar dataKey="racimos" radius={[6, 6, 0, 0]}>
              {distribucion.map((d) => (
                <Cell key={d.cintaId} fill={d.color} />
              ))}
              <LabelList
                dataKey="racimos"
                position="top"
                style={{ fontSize: 11, fontWeight: 600 }}
                formatter={(valor) => Number(valor).toLocaleString("es")}
              />
              <LabelList
                dataKey="racimos"
                position="insideTop"
                style={{ fontSize: 11, fontWeight: 600, fill: "#ffffff", paintOrder: "stroke", stroke: "rgba(0,0,0,0.3)", strokeWidth: 2 }}
                formatter={(valor) => (total ? `${((Number(valor) / total) * 100).toFixed(1)}%` : "—")}
              />
            </Bar>
          </BarChart>
    </ContenedorGrafico>
  );
}
