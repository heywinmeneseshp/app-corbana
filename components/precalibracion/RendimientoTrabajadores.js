"use client";

// Rendimiento semanal por trabajador: suma las sesiones de cada precalibrador en la semana y calcula sus indicadores por
// hectárea (con el área productiva de cada lote). El tiempo es del primer al último racimo de cada sesión.
import { Fragment, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import InfoModulo from "@/components/InfoModulo";
import { getRendimiento } from "@/lib/precalibracion/api";

const n = (v, d = 1) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("es-CO", { maximumFractionDigits: d }));
const horas = (h) => {
  if (h === null || h === undefined) return "—";
  const min = Math.round(h * 60);
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
};
const km = (v) => (v === null || v === undefined ? "—" : `${n(v, 2)} km`);
const fmtFecha = (f) => (f ? f.split("-").reverse().join("/") : "—");

function Kpi({ titulo, valor, detalle }) {
  return (
    <div className="col-6 col-md-3">
      <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
        <div className="small text-secondary">{titulo}</div>
        <div className="h4 fw-bold mb-0">{valor}</div>
        {detalle && <div className="small text-secondary">{detalle}</div>}
      </div>
    </div>
  );
}

function Diferencia({ pct }) {
  if (pct === null || pct === undefined) return <span className="text-secondary">—</span>;
  const color = pct > 0 ? "#16a34a" : pct < 0 ? "#dc2626" : "#64748b";
  return (
    <span className="fw-semibold" style={{ color }}>
      {pct > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

export default function RendimientoTrabajadores({ opciones }) {
  const [filtros, setFiltros] = useState({ semanaId: opciones?.semanaActualId || "", fincaId: "" });
  const [res, setRes] = useState({ clave: null, data: null, error: "" });
  const [abiertos, setAbiertos] = useState(new Set());
  const clave = JSON.stringify(filtros);

  useEffect(() => {
    let vivo = true;
    getRendimiento(filtros)
      .then((data) => vivo && setRes({ clave, data, error: "" }))
      .catch((e) => vivo && setRes({ clave, data: null, error: e.message }));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const cargando = res.clave !== clave;
  const data = res.data;
  const alternar = (id) =>
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const grafico = (data?.trabajadores || []).filter((t) => t.haPorHora !== null).map((t) => ({ usuario: t.usuario, haPorHora: t.haPorHora }));

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h2 className="h6 fw-bold mb-0">Rendimiento por trabajador</h2>
        <InfoModulo
          titulo="Rendimiento por trabajador"
          secciones={[
            { titulo: "Qué muestra", texto: "Para la semana elegida, suma todas las sesiones de precalibración de cada trabajador y calcula cuánto rinde por hectárea." },
            { titulo: "Cómo se calcula", items: [
              "Ha: suma del área PRODUCTIVA vigente de los lotes de sus sesiones. Un lote sin área productiva no entra en los indicadores por hectárea.",
              "Horas: del primer al último racimo de cada sesión.",
              "Ha/hora = ha ÷ horas. Min/ha = minutos que demora por hectárea.",
              "Racimos/ha y racimos/hora: racimos aptos entre las ha o las horas trabajadas.",
              "Recorrido: distancia del tracking GPS de la app (se descartan saltos imposibles de GPS). Si una sesión no tiene tracking, es una aproximación con las coordenadas de los racimos.",
              "% en movimiento: parte del tiempo en que se estaba caminando (más de 0,3 m/s).",
              "vs equipo: diferencia de ha/hora frente al promedio del equipo en esa semana.",
            ] },
          ]}
        />
      </div>

      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-6 col-md-3">
            <label className="form-label small fw-medium mb-1">Semana</label>
            <select className="form-select form-select-sm rounded-3" value={filtros.semanaId} onChange={(e) => setFiltros((f) => ({ ...f, semanaId: e.target.value }))}>
              {[...(opciones?.semanas || [])].reverse().map((s) => (
                <option key={s.id} value={s.id}>
                  {s.codigo}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small fw-medium mb-1">Finca</label>
            <select className="form-select form-select-sm rounded-3" value={filtros.fincaId} onChange={(e) => setFiltros((f) => ({ ...f, fincaId: e.target.value }))}>
              <option value="">Todas</option>
              {(opciones?.fincas || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {res.error && !cargando && <div className="alert alert-danger py-2 small">{res.error}</div>}
      {cargando && <p className="text-secondary small">Calculando...</p>}
      {!cargando && data && data.trabajadores.length === 0 && <p className="text-secondary small">No hay sesiones de precalibración en {data.semana.codigo}.</p>}

      {!cargando && data && data.trabajadores.length > 0 && (
        <>
          <div className="row g-3 mb-3">
            <Kpi titulo="Hectáreas precalibradas" valor={n(data.equipo.ha, 2)} detalle={`${data.equipo.sesiones} sesiones · ${data.equipo.dias} días`} />
            <Kpi titulo="Horas trabajadas" valor={horas(data.equipo.horas)} detalle={`${n(data.equipo.minPorHa, 1)} min por ha`} />
            <Kpi titulo="Ha por hora (equipo)" valor={n(data.equipo.haPorHora, 2)} detalle={`${n(data.equipo.racimosPorHa, 1)} racimos por ha`} />
            <Kpi titulo="Recorrido total" valor={km(data.equipo.recorridoKm)} detalle={`${n(data.equipo.metrosPorHa, 0)} m por ha · ${n(data.equipo.pctMovimiento, 0)}% en movimiento`} />
          </div>

          {grafico.length > 0 && (
            <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
              <div className="fw-semibold small mb-2">Hectáreas por hora de cada trabajador — {data.semana.codigo}</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={grafico} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="usuario" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip formatter={(v) => [`${n(v, 2)} ha/h`, "Rendimiento"]} />
                  {data.equipo.haPorHora && <ReferenceLine y={data.equipo.haPorHora} stroke="#d97706" strokeDasharray="5 4" label={{ value: `Equipo ${n(data.equipo.haPorHora, 2)}`, position: "insideTopRight", fontSize: 11, fill: "#92400e" }} />}
                  <Bar dataKey="haPorHora" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0 align-middle small">
                <thead className="table-light">
                  <tr>
                    <th className="ps-3">Trabajador</th>
                    <th className="text-end">Sesiones</th>
                    <th className="text-end">Ha</th>
                    <th className="text-end">Horas</th>
                    <th className="text-end">Ha/hora</th>
                    <th className="text-end">Min/ha</th>
                    <th className="text-end">Racimos/ha</th>
                    <th className="text-end">Racimos/hora</th>
                    <th className="text-end">Recorrido</th>
                    <th className="text-end">m/ha</th>
                    <th className="text-end">km/h</th>
                    <th className="text-end">% mov.</th>
                    <th className="text-end pe-3">vs equipo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trabajadores.map((t) => {
                    const abierto = abiertos.has(t.usuarioId);
                    return (
                      <Fragment key={t.usuarioId}>
                        <tr role="button" onClick={() => alternar(t.usuarioId)}>
                          <td className="ps-3 fw-medium">
                            {abierto ? <FiChevronDown className="me-1" /> : <FiChevronRight className="me-1" />}
                            {t.usuario}
                            {t.sinAreaProductiva > 0 && <span className="badge rounded-pill text-bg-warning ms-2" title="Lotes sin área productiva registrada: no entran en los indicadores por hectárea">{t.sinAreaProductiva} sin área</span>}
                          </td>
                          <td className="text-end">{t.sesiones}</td>
                          <td className="text-end">{n(t.ha, 2)}</td>
                          <td className="text-end text-nowrap">{horas(t.horas)}</td>
                          <td className="text-end fw-semibold">{n(t.haPorHora, 2)}</td>
                          <td className="text-end">{n(t.minPorHa, 1)}</td>
                          <td className="text-end">{n(t.racimosPorHa, 1)}</td>
                          <td className="text-end">{n(t.racimosPorHora, 1)}</td>
                          <td className="text-end text-nowrap" title={t.recorridoMedido ? "Medido con el tracking GPS" : "Aproximado con las coordenadas de los racimos"}>
                            {km(t.recorridoKm)}
                            {!t.recorridoMedido && <span className="text-secondary"> ~</span>}
                          </td>
                          <td className="text-end">{n(t.metrosPorHa, 0)}</td>
                          <td className="text-end">{n(t.velocidadKmh, 2)}</td>
                          <td className="text-end">{t.pctMovimiento === null ? "—" : `${t.pctMovimiento}%`}</td>
                          <td className="text-end pe-3">
                            <Diferencia pct={t.vsEquipoHaPorHora} />
                          </td>
                        </tr>
                        {abierto &&
                          t.lotes.map((l) => (
                            <tr key={l.id} className="table-light">
                              <td className="ps-5 text-secondary">
                                {fmtFecha(l.fecha)} · {l.finca} · {l.lote}
                              </td>
                              <td className="text-end text-secondary">{l.tipo === "VIGENTE" ? "Vigente" : "Anticipada"}</td>
                              <td className="text-end">{l.ha === null ? <span className="text-warning">sin área</span> : n(l.ha, 2)}</td>
                              <td className="text-end text-nowrap">{l.duracionMin === null ? "—" : horas(l.duracionMin / 60)}</td>
                              <td className="text-end">{n(l.haPorHora, 2)}</td>
                              <td className="text-end">{n(l.minPorHa, 1)}</td>
                              <td className="text-end">{n(l.racimosPorHa, 1)}</td>
                              <td className="text-end">—</td>
                              <td className="text-end text-nowrap">
                                {l.recorridoM === null ? "—" : `${n(l.recorridoM, 0)} m`}
                                {!l.recorridoMedido && l.recorridoM !== null && <span className="text-secondary"> ~</span>}
                              </td>
                              <td className="text-end">{n(l.metrosPorHa, 0)}</td>
                              <td colSpan={3} />
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
