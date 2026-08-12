"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiArrowLeft, FiCheck, FiX, FiDroplet, FiThermometer, FiWind } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";

const ESTADO_BADGE = {
  Hecho: "text-bg-success",
  "En ejecucion": "text-bg-warning",
  Pendiente: "text-bg-secondary",
};

const COLUMNAS = [
  { key: "controlMaleza", label: "Control de Maleza" },
  { key: "drenajes", label: "Drenajes" },
  { key: "desmache", label: "Desmache" },
  { key: "programaFertilizacion", label: "Prog. Fertilización" },
  { key: "fitosaneo", label: "Fitosaneo" },
  { key: "reduccionInoculo", label: "Reducción Inóculo" },
];

function SiNoBadge({ valor }) {
  return valor ? (
    <span className="badge rounded-pill text-bg-danger d-inline-flex align-items-center gap-1">
      <FiCheck size={12} /> Sí
    </span>
  ) : (
    <span className="badge rounded-pill text-bg-light text-secondary d-inline-flex align-items-center gap-1">
      <FiX size={12} /> No
    </span>
  );
}

export default function VisitaLaborCulturalPage() {
  const { visitaUuid } = useParams();
  const router = useRouter();
  const [visita, setVisita] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/labores-culturales/visitas/${visitaUuid}`)
      .then(setVisita)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [visitaUuid]);

  return (
    <RequirePermission code="menu.sanidad_vegetal.labores">
    <div className="p-4 p-md-5" style={{ maxWidth: 900 }}>
      <button
        type="button"
        className="btn btn-link text-secondary text-decoration-none d-flex align-items-center gap-1 px-0 mb-3"
        onClick={() => router.push("/sanidad-vegetal/labores")}
      >
        <FiArrowLeft /> Volver al listado
      </button>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <p className="text-secondary">Cargando...</p>
      ) : visita ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 p-md-5">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4 pb-3 border-bottom">
              <div>
                <h1 className="fw-bold h4 mb-1">Visita Sanidad y Vegetal — {visita.fincaNombre}</h1>
                <p className="text-secondary small mb-0">
                  Semana {visita.semanaCodigo} · {visita.fecha} · Responsable: {visita.usuarioNombre || "—"}
                </p>
              </div>
            </div>

            {visita.clima && (
              <section className="mb-4">
                <h2 className="h6 fw-semibold mb-2">Condiciones climáticas</h2>
                <div className="d-flex gap-4 flex-wrap">
                  <span className="d-flex align-items-center gap-2 small">
                    <FiDroplet className="text-primary" /> {visita.clima.mm} mm
                  </span>
                  {visita.clima.temperatura != null && (
                    <span className="d-flex align-items-center gap-2 small">
                      <FiThermometer className="text-danger" /> {visita.clima.temperatura} °C
                    </span>
                  )}
                  {visita.clima.humedadRelativa != null && (
                    <span className="d-flex align-items-center gap-2 small">
                      <FiWind className="text-info" /> {visita.clima.humedadRelativa}% HR
                    </span>
                  )}
                </div>
              </section>
            )}

            <section className="mb-4">
              <h2 className="h6 fw-semibold mb-2">Estado fitosanitario por lote</h2>
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr className="text-secondary small">
                      <th>Lote</th>
                      {COLUMNAS.map((c) => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visita.lotes.map((l) => (
                      <tr key={l.uuid}>
                        <td className="fw-semibold">{l.loteNombre}</td>
                        {COLUMNAS.map((c) => (
                          <td key={c.key}>
                            <span className={`badge rounded-pill ${ESTADO_BADGE[l[c.key]] || "text-bg-light"}`}>
                              {l[c.key]}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {visita.lotes.some((l) => l.observacion) && (
                <div className="mt-2">
                  {visita.lotes
                    .filter((l) => l.observacion)
                    .map((l) => (
                      <p key={l.uuid} className="small text-secondary mb-1">
                        <strong>{l.loteNombre}:</strong> {l.observacion}
                      </p>
                    ))}
                </div>
              )}
            </section>

            <section className="mb-4">
              <h2 className="h6 fw-semibold mb-2">Hallazgos</h2>
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="border rounded-3 p-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-semibold small">Vigilancia Moko</span>
                      <SiNoBadge valor={visita.mokoPresente} />
                    </div>
                    {visita.mokoPresente && visita.mokoLotes.length > 0 && (
                      <p className="small text-secondary mb-0">
                        Lotes: {visita.mokoLotes.map((l) => l.loteNombre).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded-3 p-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-semibold small">Vigilancia Fusarium Oxysporum Cubense R4</span>
                      <SiNoBadge valor={visita.fusariumPresente} />
                    </div>
                    {visita.fusariumPresente && visita.fusariumLotes.length > 0 && (
                      <p className="small text-secondary mb-0">
                        Lotes: {visita.fusariumLotes.map((l) => l.loteNombre).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-4">
              <h2 className="h6 fw-semibold mb-2">Cumplimiento de protocolos de bioseguridad</h2>
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 d-flex justify-content-between align-items-center">
                    <span className="small">FOC-R4 (Ley 2081 del 2024)</span>
                    <SiNoBadge valor={visita.cumpleProtocoloFocR4} />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 d-flex justify-content-between align-items-center">
                    <span className="small">Moko (Resolución ICA 1468 del 2013)</span>
                    <SiNoBadge valor={visita.cumpleProtocoloMoko} />
                  </div>
                </div>
              </div>
            </section>

            {visita.checklistObservacion && (
              <section>
                <h2 className="h6 fw-semibold mb-2">Observaciones y/o plan de acción</h2>
                <p className="small text-secondary" style={{ whiteSpace: "pre-wrap" }}>
                  {visita.checklistObservacion}
                </p>
              </section>
            )}
          </div>
        </div>
      ) : null}
    </div>
    </RequirePermission>
  );
}