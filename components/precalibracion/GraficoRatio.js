"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FiMaximize2 } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";

// Ratio de aptos por hectárea: año actual (azul sólida) vs promedio
// histórico de la misma semana (verde punteada). Mismo diseño que el
// gráfico de ratio de Estimaciones de Fincas.
export default function GraficoRatio({ datos, alcance }) {
  const [ampliado, setAmpliado] = useState(false);

  function renderGrafico(height) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={datos} margin={{ top: 5, right: 10, left: -10, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="etiqueta" tick={{ fontSize: 9 }} interval={0} angle={-60} textAnchor="end" height={40} />
          <YAxis tick={{ fontSize: 10 }} width={45} domain={["auto", "auto"]} />
          <Tooltip formatter={(v) => (v == null ? "—" : Number(v).toLocaleString("es", { maximumFractionDigits: 2 }))} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="ratioActual" name="Ratio año actual (aptos/ha)" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
          <Line
            type="monotone"
            dataKey="promedio"
            name="Promedio histórico (misma semana)"
            stroke="#059669"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 2 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <h2 className="h6 fw-bold mb-0">Ratio histórico{alcance ? ` — ${alcance}` : ""}</h2>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary p-1 border-0"
          title="Ampliar gráfico"
          onClick={() => setAmpliado(true)}
        >
          <FiMaximize2 size={14} />
        </button>
      </div>
      <div style={{ width: "100%", height: 230 }}>{renderGrafico("100%")}</div>

      {ampliado && (
        <ModalShell title="Ratio histórico" onClose={() => setAmpliado(false)} size="xl">
          <div style={{ width: "100%", height: "60vh" }}>{renderGrafico("100%")}</div>
        </ModalShell>
      )}
    </div>
  );
}
