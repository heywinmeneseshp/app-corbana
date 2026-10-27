"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiRefreshCw, FiChevronDown, FiChevronRight, FiCheckCircle } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

const SEVERIDAD = {
  alta: { label: "Alta", bg: "#fee2e2", color: "#b91c1c", orden: 0 },
  media: { label: "Media", bg: "#fef3c7", color: "#b45309", orden: 1 },
  baja: { label: "Baja", bg: "#e0f2fe", color: "#0369a1", orden: 2 },
};

// Alertas del Resumen semanal: reúne en una sola vista los avisos de varios módulos (ratio, liquidación de semanas, FRAC, mezclas, inventario y
// mantenimiento). Cada alerta enlaza a la pantalla donde se atiende. Se calcula en GET /dashboard/alertas.
export default function CentroAlertas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cerrados, setCerrados] = useState(new Set());
  const [filtro, setFiltro] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await apiFetch("/dashboard/alertas"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const conteo = useMemo(() => {
    const c = { alta: 0, media: 0, baja: 0 };
    for (const g of data?.grupos || []) for (const a of g.alertas) c[a.severidad] = (c[a.severidad] || 0) + 1;
    return c;
  }, [data]);

  const toggle = (clave) =>
    setCerrados((s) => {
      const n = new Set(s);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <p className="text-secondary small mb-0">Lo que requiere atención, de todos los módulos{data?.semanaActual ? ` · semana en curso ${data.semanaActual}` : ""}.</p>
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={load} disabled={loading} title="Actualizar">
          <FiRefreshCw />
        </button>
      </div>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {loading && !data && <p className="text-secondary">Calculando el resumen...</p>}

        {data && (
          <>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {[["", "Todas"], ["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]].map(([v, l]) => (
                <button
                  key={v || "todas"}
                  type="button"
                  className={`btn btn-sm rounded-3 ${filtro === v ? "btn-brand text-white" : "btn-outline-secondary"}`}
                  onClick={() => setFiltro(v)}
                >
                  {l}
                  {v ? ` (${conteo[v]})` : ` (${conteo.alta + conteo.media + conteo.baja})`}
                </button>
              ))}
            </div>

            {data.grupos.map((g) => {
              const alertas = g.alertas
                .filter((a) => !filtro || a.severidad === filtro)
                .sort((a, b) => SEVERIDAD[a.severidad].orden - SEVERIDAD[b.severidad].orden);
              const abierto = !cerrados.has(g.clave);
              return (
                <div key={g.clave} className="card border-0 shadow-sm rounded-4 mb-3">
                  <button
                    type="button"
                    className="btn border-0 bg-transparent text-start d-flex align-items-center justify-content-between p-3"
                    onClick={() => toggle(g.clave)}
                  >
                    <span className="fw-bold d-flex align-items-center gap-2">
                      {abierto ? <FiChevronDown /> : <FiChevronRight />} {g.titulo}
                    </span>
                    <span className="d-flex gap-1">
                      {g.error ? (
                        <span className="badge rounded-pill text-bg-light text-danger">{g.error}</span>
                      ) : g.alertas.length === 0 ? (
                        <span className="badge rounded-pill" style={{ backgroundColor: "#dcfce7", color: "#15803d" }}>
                          Sin alertas
                        </span>
                      ) : (
                        ["alta", "media", "baja"]
                          .filter((sv) => g.alertas.some((a) => a.severidad === sv))
                          .map((sv) => (
                            <span key={sv} className="badge rounded-pill" style={{ backgroundColor: SEVERIDAD[sv].bg, color: SEVERIDAD[sv].color }}>
                              {g.alertas.filter((a) => a.severidad === sv).length} {SEVERIDAD[sv].label.toLowerCase()}
                            </span>
                          ))
                      )}
                    </span>
                  </button>
                  {abierto && (
                    <div className="px-3 pb-3">
                      {alertas.length === 0 ? (
                        <p className="small text-secondary mb-0 d-flex align-items-center gap-2">
                          <FiCheckCircle className="text-success" /> {g.alertas.length === 0 ? "Todo en orden." : "Sin alertas de esta severidad."}
                        </p>
                      ) : (
                        <ul className="list-unstyled mb-0">
                          {alertas.map((a, i) => (
                            <li key={i} className="d-flex align-items-start gap-2 py-2" style={{ borderTop: i ? "1px solid #f1f3f5" : "none" }}>
                              <span
                                className="badge rounded-pill flex-shrink-0 mt-1"
                                style={{ backgroundColor: SEVERIDAD[a.severidad].bg, color: SEVERIDAD[a.severidad].color, minWidth: "3.5rem" }}
                              >
                                {SEVERIDAD[a.severidad].label}
                              </span>
                              <div className="flex-grow-1 small">
                                <div className="fw-medium">{a.titulo}</div>
                                <div className="text-secondary">{a.detalle}</div>
                              </div>
                              {a.enlace && (
                                <Link href={a.enlace} className="small text-decoration-none text-nowrap flex-shrink-0">
                                  Ver
                                </Link>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
    </div>
  );
}
