"use client";

import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiCalendar, FiTrendingDown, FiTrendingUp } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";

const ESTILO_MOTIVO = {
  yli_bajo: { color: "#b45309", fondo: "#fffbeb", borde: "#fde68a", icono: <FiTrendingDown size={14} /> },
  indice_alto: { color: "#be123c", fondo: "#fff1f2", borde: "#fecdd3", icono: <FiTrendingUp size={14} /> },
};

export default function SanidadAlertasPage() {
  const [semanas, setSemanas] = useState([]);
  const [semanaUuid, setSemanaUuid] = useState(""); // "" = por defecto, la semana anterior a la actual (la resuelve el backend)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const hoyIso = new Date().toISOString().slice(0, 10);
    apiFetch("/semanas?limit=100")
      .then((res) =>
        setSemanas(
          (res.items || [])
            .filter((s) => s.fechaInicio <= hoyIso) // no mostrar semanas futuras; la semana en curso sí se puede elegir
            .sort((a, b) => a.anio - b.anio || a.numeroSemana - b.numeroSemana),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (semanaUuid) params.set("semanaUuid", semanaUuid);
    apiFetch(`/evaluaciones/alertas-semana${params.toString() ? `?${params.toString()}` : ""}`)
      .then((res) => {
        if (cancelado) return;
        setData(res);
        // Una vez que el backend resuelve la semana por defecto, se refleja
        // en el select para que el usuario vea cuál está viendo.
        if (!semanaUuid && res.semana) setSemanaUuid(res.semana.uuid);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelado) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [semanaUuid]);

  return (
    <RequirePermission code="menu.sanidad_vegetal.alertas">
      <div className="p-4 p-md-5">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div className="d-flex align-items-center gap-3">
            <span
              className="rounded-circle d-flex align-items-center justify-content-center text-white"
              style={{ width: 42, height: 42, background: "linear-gradient(135deg,#f59e0b,#dc2626)" }}
            >
              <FiAlertTriangle size={20} />
            </span>
            <div>
              <h1 className="fw-bold h3 mb-1">Alertas de Sanidad Vegetal</h1>
              <p className="text-secondary mb-0">
                Fincas con YLI por debajo de 8, o Índice de Infección por encima de 33%, en la semana seleccionada.
              </p>
            </div>
          </div>
          <div>
            <label className="form-label small fw-medium text-secondary mb-1">Semana</label>
            <select
              className="form-select form-select-sm rounded-3 shadow-sm"
              style={{ width: 180 }}
              value={semanaUuid}
              onChange={(e) => setSemanaUuid(e.target.value)}
            >
              {semanas.map((s) => (
                <option key={s.uuid} value={s.uuid}>
                  {s.codigo}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small rounded-3">{error}</div>}

        {loading && (
          <div className="d-flex justify-content-center align-items-center py-5 text-secondary">
            <div className="spinner-border spinner-border-sm me-2" role="status"></div>
            <span className="small">Cargando alertas...</span>
          </div>
        )}

        {!loading && !error && data && !data.semana && (
          <p className="text-secondary small py-5 text-center mb-0">
            Todavía no hay ninguna semana cerrada para evaluar.
          </p>
        )}

        {!loading && !error && data?.semana && (
          <>
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="badge rounded-pill border bg-light text-dark px-3 py-2 fw-medium">
                <FiCalendar className="me-1" style={{ marginTop: -2 }} />
                Semana evaluada: {data.semana.codigo}
              </span>
              <span className="text-secondary small">
                ({data.semana.fechaInicio} — {data.semana.fechaFin})
              </span>
            </div>

            {data.alertas.length === 0 ? (
              <div className="card border-0 shadow-sm rounded-4 p-5 text-center">
                <FiCheckCircle size={32} className="text-success mx-auto mb-2" />
                <p className="text-secondary mb-0">
                  Ninguna finca superó los umbrales de alerta en la semana {data.semana.codigo}.
                </p>
              </div>
            ) : (
              <div className="row g-3">
                {data.alertas.map((a) => (
                  <div className="col-12 col-md-6 col-xl-4" key={a.fincaUuid}>
                    <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <h2 className="h6 fw-bold mb-0">{a.fincaNombre}</h2>
                        <span className="badge rounded-pill text-bg-danger">{a.motivos.length} alerta(s)</span>
                      </div>
                      <div className="d-flex gap-3 mb-3 small text-secondary">
                        <span>YLI: <strong className="text-dark">{a.promedioYli ?? "—"}</strong></span>
                        <span>Índice: <strong className="text-dark">{a.promedioIndice != null ? `${a.promedioIndice}%` : "—"}</strong></span>
                      </div>
                      <div className="d-flex flex-column gap-2">
                        {a.motivos.map((m) => {
                          const estilo = ESTILO_MOTIVO[m.tipo] || ESTILO_MOTIVO.indice_alto;
                          return (
                            <div
                              key={m.tipo}
                              className="d-flex align-items-center gap-2 rounded-3 px-3 py-2 small fw-medium"
                              style={{ background: estilo.fondo, border: `1px solid ${estilo.borde}`, color: estilo.color }}
                            >
                              {estilo.icono}
                              {m.mensaje}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </RequirePermission>
  );
}
