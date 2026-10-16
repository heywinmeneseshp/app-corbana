"use client";

// Seguimiento semana a semana de Emisión Foliar: una línea por planta
// evaluada (varias plantas a la vez) con sus hojas totales y candela, y la
// variación de hojas contra la semana anterior de ESA misma planta.
import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

const COLORES = ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d"];

function Variacion({ valor }) {
  if (valor === null || valor === undefined) return <span className="text-secondary">—</span>;
  if (valor === 0) return <span className="text-secondary">0</span>;
  const sube = valor > 0;
  return (
    <span className="d-inline-flex align-items-center gap-1 fw-semibold" style={{ color: sube ? "#16a34a" : "#dc2626" }}>
      {sube ? <FiTrendingUp size={13} /> : <FiTrendingDown size={13} />}
      {sube ? "+" : ""}
      {valor}
    </span>
  );
}

export default function SeguimientoEmisionFoliar() {
  const anioActual = new Date().getFullYear();
  const [fincas, setFincas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [loteUuid, setLoteUuid] = useState("");
  const [anio, setAnio] = useState(String(anioActual));
  const [metrica, setMetrica] = useState("hojasTotales");
  const [plantas, setPlantas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((d) => setFincas(d.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoteUuid("");
    if (!fincaUuid) {
      setLotes([]);
      return;
    }
    apiFetch(`/fincas/${fincaUuid}/lotes?limit=100&incluirGrupo=true`)
      .then((d) => setLotes(d.items))
      .catch(() => setLotes([]));
  }, [fincaUuid]);

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (fincaUuid) params.set("fincaUuid", fincaUuid);
    if (loteUuid) params.set("loteUuid", loteUuid);
    if (anio) params.set("anio", anio);
    apiFetch(`/evaluaciones/emision-foliar/seguimiento?${params.toString()}`)
      .then((d) => setPlantas(d.plantas || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fincaUuid, loteUuid, anio]);

  // Una fila por semana (eje X), una columna por planta (serie).
  const datosGrafico = useMemo(() => {
    const porSemana = new Map();
    plantas.forEach((p, idx) => {
      for (const s of p.semanas) {
        const clave = `${s.semana.anio}-${String(s.semana.numeroSemana).padStart(2, "0")}`;
        if (!porSemana.has(clave)) porSemana.set(clave, { clave, semana: s.semana.codigo });
        porSemana.get(clave)[`p${idx}`] = s[metrica];
      }
    });
    return [...porSemana.values()].sort((a, b) => a.clave.localeCompare(b.clave));
  }, [plantas, metrica]);

  const opcionesAnio = [anioActual + 1, anioActual, anioActual - 1, anioActual - 2];

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <div>
          <label className="form-label small fw-medium mb-1">Finca</label>
          <select className="form-select form-select-sm rounded-3" value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)}>
            <option value="">Todas</option>
            {fincas.map((f) => (
              <option key={f.uuid} value={f.uuid}>{f.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label small fw-medium mb-1">Lote</label>
          <select className="form-select form-select-sm rounded-3" value={loteUuid} onChange={(e) => setLoteUuid(e.target.value)} disabled={!fincaUuid}>
            <option value="">Todos</option>
            {lotes.map((l) => (
              <option key={l.uuid} value={l.uuid}>{l.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label small fw-medium mb-1">Año</label>
          <select className="form-select form-select-sm rounded-3" value={anio} onChange={(e) => setAnio(e.target.value)}>
            {opcionesAnio.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label small fw-medium mb-1">Gráfico</label>
          <select className="form-select form-select-sm rounded-3" value={metrica} onChange={(e) => setMetrica(e.target.value)}>
            <option value="hojasTotales">Hojas totales</option>
            <option value="candela">Candela</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {loading && <p className="text-secondary small">Cargando...</p>}
      {!loading && !error && plantas.length === 0 && (
        <p className="text-secondary small">No hay evaluaciones de Emisión Foliar para estos filtros.</p>
      )}

      {!loading && plantas.length > 0 && (
        <>
          <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={datosGrafico} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={45} domain={["auto", "auto"]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                {plantas.map((p, idx) => (
                  <Line
                    key={p.planta.uuid}
                    type="monotone"
                    dataKey={`p${idx}`}
                    name={`${p.planta.codigo}`}
                    stroke={COLORES[idx % COLORES.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card border-0 shadow-sm rounded-4 p-3">
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>Planta</th>
                    <th>Lote</th>
                    <th>Semana</th>
                    <th className="text-end">Hojas totales</th>
                    <th className="text-end">Δ vs. sem. anterior</th>
                    <th className="text-end">Candela</th>
                  </tr>
                </thead>
                <tbody>
                  {plantas.flatMap((p) =>
                    [...p.semanas].reverse().map((s) => (
                      <tr key={`${p.planta.uuid}-${s.evaluacionUuid}`}>
                        <td className="fw-medium">{p.planta.codigo}</td>
                        <td>{p.lote.nombre}</td>
                        <td>{s.semana.codigo}</td>
                        <td className="text-end">{s.hojasTotales}</td>
                        <td className="text-end"><Variacion valor={s.variacionHojas} /></td>
                        <td className="text-end">{s.candela ?? "—"}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
