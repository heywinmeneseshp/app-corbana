"use client";

// Precalibración por semana (no por sesión): suma las sesiones de cada semana con sus hectáreas, horas, recorrido e indicadores.
import { useEffect, useState } from "react";
import InfoModulo from "@/components/InfoModulo";
import { getSemanal } from "@/lib/precalibracion/api";

const n = (v, d = 1) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("es-CO", { maximumFractionDigits: d }));
const horas = (h) => {
  if (h === null || h === undefined) return "—";
  const min = Math.round(h * 60);
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
};
const fmtFecha = (f) => (f ? f.split("-").reverse().slice(0, 2).join("/") : "");

export default function ResumenSemanal({ opciones }) {
  const [filtros, setFiltros] = useState({ fincaId: "", tipo: "" });
  const [res, setRes] = useState({ clave: null, data: null, error: "" });
  const clave = JSON.stringify(filtros);

  useEffect(() => {
    let vivo = true;
    getSemanal(filtros)
      .then((data) => vivo && setRes({ clave, data, error: "" }))
      .catch((e) => vivo && setRes({ clave, data: null, error: e.message }));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const cargando = res.clave !== clave;
  const semanas = res.data?.semanas || [];

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h2 className="h6 fw-bold mb-0">Precalibración por semana</h2>
        <InfoModulo
          titulo="Precalibración por semana"
          secciones={[
            { titulo: "Qué muestra", texto: "Una fila por semana de precalibración, con la suma de todas sus sesiones (de todos los trabajadores y lotes)." },
            {
              titulo: "Cómo se calcula",
              items: [
                "Ha: suma del área productiva vigente de los lotes de cada sesión.",
                "Duración: suma del tiempo del primer al último racimo de cada sesión. Recorrido: suma del recorrido de las sesiones (tracking GPS cuando existe).",
                "Ha/hora, min/ha, racimos/ha y m/ha usan solo las sesiones con área productiva.",
                "Semana de cosecha: la misma semana si es vigente y la siguiente si es anticipada.",
              ],
            },
          ]}
        />
      </div>

      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <div className="row g-2 align-items-end">
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
          <div className="col-6 col-md-3">
            <label className="form-label small fw-medium mb-1">Tipo</label>
            <select className="form-select form-select-sm rounded-3" value={filtros.tipo} onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value }))}>
              <option value="">Todos</option>
              <option value="VIGENTE">Vigente</option>
              <option value="ANTICIPADA">Anticipada</option>
            </select>
          </div>
        </div>
      </div>

      {res.error && !cargando && <div className="alert alert-danger py-2 small">{res.error}</div>}
      {cargando && <p className="text-secondary small">Calculando...</p>}
      {!cargando && !res.error && semanas.length === 0 && <p className="text-secondary small">Aún no hay sesiones de precalibración.</p>}

      {!cargando && semanas.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle small text-center text-nowrap" style={{ width: "auto", margin: "0 auto" }}>
              <thead className="table-light text-wrap">
                <tr>
                  <th>Semana</th>
                  <th>Período</th>
                  <th>Semana de cosecha</th>
                  <th>Sesiones</th>
                  <th>Trabajadores</th>
                  <th>Lotes</th>
                  <th>Has</th>
                  <th>Duración total</th>
                  <th>Recorrido total</th>
                  <th>Racimos aptos</th>
                  <th title="Hectáreas por hora">Ha/hora</th>
                  <th title="Minutos por hectárea">Min/ha</th>
                  <th>Racimos/ha</th>
                  <th title="Metros recorridos por hectárea">m/ha</th>
                  <th>km/h</th>
                  <th title="Porcentaje del tiempo en movimiento (solo con tracking GPS)">% mov.</th>
                </tr>
              </thead>
              <tbody>
                {semanas.map((s) => (
                  <tr key={s.semana}>
                    <td className="fw-semibold">{s.semana}</td>
                    <td>
                      {fmtFecha(s.desde)}
                      {s.hasta !== s.desde ? ` – ${fmtFecha(s.hasta)}` : ""}
                    </td>
                    <td>{s.semanaCosecha || "—"}</td>
                    <td>{s.sesiones}</td>
                    <td>{s.trabajadores}</td>
                    <td>{s.lotes}</td>
                    <td>
                      {n(s.ha, 2)}
                      {s.sinAreaProductiva > 0 && (
                        <span className="badge rounded-pill text-bg-warning ms-1" title="Sesiones de lotes sin área productiva: no entran en los indicadores por hectárea">
                          {s.sinAreaProductiva} sin área
                        </span>
                      )}
                    </td>
                    <td>{horas(s.horas)}</td>
                    <td>
                      {n(s.recorridoKm, 2)} km
                      {!s.recorridoMedido && s.recorridoKm > 0 && (
                        <span className="text-secondary" title="Aproximado con las coordenadas de los racimos (sin tracking GPS)">
                          {" "}
                          ~
                        </span>
                      )}
                    </td>
                    <td>{n(s.racimos, 0)}</td>
                    <td className="fw-semibold">{n(s.haPorHora, 2)}</td>
                    <td>{n(s.minPorHa, 1)}</td>
                    <td>{n(s.racimosPorHa, 1)}</td>
                    <td>{n(s.metrosPorHa, 0)}</td>
                    <td>{n(s.velocidadKmh, 2)}</td>
                    <td>{s.pctMovimiento === null ? "—" : `${s.pctMovimiento}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
