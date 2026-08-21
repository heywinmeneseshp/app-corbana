"use client";

import { useEffect, useState } from "react";
import {
  FiCheck,
  FiX,
  FiDroplet,
  FiThermometer,
  FiWind,
  FiFileText,
  FiCheckCircle,
  FiImage,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { apiFetch, apiFetchBlob, apiUploadCampo } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import AppLogo from "@/components/AppLogo";

// Mismos colores que el PDF exportado (lib/visitaLaborExport.js) — texto de
// color sin relleno, para que el modal se vea igual que el documento.
const ESTADO_COLOR = {
  Hecho: "#198754",
  "En ejecucion": "#b48200",
  Pendiente: "#6c757d",
};

const COLUMNAS = [
  { key: "controlMaleza", label: "Control de Maleza" },
  { key: "drenajes", label: "Drenajes" },
  { key: "desmache", label: "Desmache" },
  { key: "programaFertilizacion", label: "Prog. Fertilización" },
  { key: "fitosaneo", label: "Fitosaneo" },
  { key: "reduccionInoculo", label: "Reducción Inóculo" },
];

const badgeBorderStyle = (color) => ({
  border: `1px solid ${color}`,
  color,
  fontWeight: 600,
});

// `alarmaSi` decide cuál valor es el "malo" (rojo): true por defecto —
// Hallazgos, donde "Sí" (hay Moko/Fusarium) es lo alarmante. En
// Cumplimiento de protocolos es al revés: "Sí" (cumple) es lo normal y
// "No" (no cumple) es lo alarmante — se pasa `alarmaSi={false}`.
function SiNoBadge({ valor, alarmaSi = true }) {
  const esAlarma = alarmaSi ? valor : !valor;
  const color = esAlarma ? "#dc3545" : "#6c757d";
  return (
    <span
      className="badge rounded-pill bg-transparent d-inline-flex align-items-center gap-1"
      style={badgeBorderStyle(color)}
    >
      {valor ? <FiCheck size={12} /> : <FiX size={12} />} {valor ? "Sí" : "No"}
    </span>
  );
}

// Detalle de una visita de Sanidad Vegetal / Labor Cultural, mostrado como
// modal (no como página aparte) desde el listado en ReporteLabores.js.
export default function VisitaLaborModal({ visitaUuid, onClose, onChanged }) {
  const [visita, setVisita] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [generandoWord, setGenerandoWord] = useState(false);
  const [revisando, setRevisando] = useState(false);
  // uuid de la foto -> object URL local (blob) — se piden autenticadas vía
  // fetch (un <img src> normal no puede mandar el Bearer del panel) y no se
  // apunta directo a Drive porque el archivo no es público.
  const [fotoUrls, setFotoUrls] = useState({});
  // Índice de la foto abierta en el visor de pantalla completa (lightbox),
  // o null si está cerrado — permite pasar de una foto a otra con
  // "Anterior"/"Siguiente" sin salir del modal (antes se abría cada foto en
  // una pestaña nueva).
  const [fotoAbiertaIndex, setFotoAbiertaIndex] = useState(null);

  useEffect(() => {
    apiFetch(`/labores-culturales/visitas/${visitaUuid}`)
      .then(setVisita)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [visitaUuid]);

  useEffect(() => {
    if (!visita?.fotos?.length) return;
    let cancelado = false;
    const urls = {};

    Promise.all(
      visita.fotos.map((foto) =>
        apiFetchBlob(`/labores-culturales/fotos/${foto.uuid}/archivo`)
          .then((blob) => {
            urls[foto.uuid] = URL.createObjectURL(blob);
          })
          .catch(() => {}),
      ),
    ).then(() => {
      if (!cancelado) setFotoUrls(urls);
    });

    return () => {
      cancelado = true;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [visita?.fotos]);

  const handleExportarPdf = async () => {
    setGenerandoPdf(true);
    try {
      const { downloadVisitaLaborPdf } = await import("@/lib/visitaLaborExport");
      await downloadVisitaLaborPdf(visita);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const handleExportarWord = async () => {
    setGenerandoWord(true);
    try {
      const { downloadVisitaLaborWord } = await import("@/lib/visitaLaborWordExport");
      await downloadVisitaLaborWord(visita);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerandoWord(false);
    }
  };

  useEffect(() => {
    if (fotoAbiertaIndex === null || !visita?.fotos?.length) return;
    const total = visita.fotos.length;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setFotoAbiertaIndex(null);
      if (e.key === "ArrowLeft") setFotoAbiertaIndex((i) => (i - 1 + total) % total);
      if (e.key === "ArrowRight") setFotoAbiertaIndex((i) => (i + 1) % total);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fotoAbiertaIndex, visita?.fotos?.length]);

  const handleMarcarRevisada = async () => {
    setRevisando(true);
    setError("");
    try {
      await apiFetch(`/labores-culturales/visitas/${visitaUuid}/revisar`, { method: "PUT" });
      const actualizada = await apiFetch(`/labores-culturales/visitas/${visitaUuid}`);
      setVisita(actualizada);
      onChanged?.();

      // Aviso de revisión aprobada, con el PDF real adjunto — se genera acá
      // (jsPDF, el backend no genera PDFs) y se manda aparte; si falla, no
      // se le muestra como error bloqueante al usuario (la revisión en sí
      // ya quedó guardada), solo se registra en consola.
      try {
        const { generarVisitaLaborPdfBlob } = await import("@/lib/visitaLaborExport");
        const { blob, nombre } = await generarVisitaLaborPdfBlob(actualizada);
        await apiUploadCampo(`/labores-culturales/visitas/${visitaUuid}/correo-revision`, "pdf", blob, nombre);
      } catch (errCorreo) {
        console.error("No se pudo enviar el aviso de revisión por correo:", errCorreo);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRevisando(false);
    }
  };

  return (
    <ModalShell
      title={visita ? `Visita Sanidad y Vegetal — ${visita.fincaNombre}` : "Visita Sanidad y Vegetal"}
      onClose={onClose}
      width="90%"
    >
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <p className="text-secondary">Cargando...</p>
      ) : visita ? (
        <div>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4 pb-3 border-bottom">
            <div className="d-flex align-items-start gap-3">
              <AppLogo size={36} color="#198754" />
              <div>
                <h2 className="fw-bold h5 mb-1">Visita Sanidad y Vegetal — {visita.fincaNombre}</h2>
                <p className="text-secondary small mb-0">
                  Semana {visita.semanaCodigo} · {visita.fecha}
                </p>
              </div>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              {!visita.revisadoEn && (
                <button
                  type="button"
                  className="btn btn-outline-success rounded-3 d-flex align-items-center gap-1 text-nowrap"
                  onClick={handleMarcarRevisada}
                  disabled={revisando}
                >
                  <FiCheckCircle /> {revisando ? "Marcando..." : "Marcar como revisado"}
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline-secondary rounded-3 d-flex align-items-center gap-1 text-nowrap"
                onClick={handleExportarPdf}
                disabled={generandoPdf}
              >
                <FiFileText /> {generandoPdf ? "Generando..." : "Exportar PDF"}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary rounded-3 d-flex align-items-center gap-1 text-nowrap"
                onClick={handleExportarWord}
                disabled={generandoWord}
              >
                <FiFileText /> {generandoWord ? "Generando..." : "Exportar Word"}
              </button>
            </div>
          </div>

          {visita.clima && (
            <section className="mb-4">
              <h3 className="h6 fw-semibold mb-2">Condiciones climáticas</h3>
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
            <h3 className="h6 fw-semibold mb-2">Estado fitosanitario por lote</h3>
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
                          <span style={{ color: ESTADO_COLOR[l[c.key]] || "#6c757d", fontWeight: 600 }}>
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
            <h3 className="h6 fw-semibold mb-2">Hallazgos</h3>
            <div className="row g-3">
              <div className="col-md-6 d-flex">
                <div className="border rounded-3 p-3 w-100">
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
              <div className="col-md-6 d-flex">
                <div className="border rounded-3 p-3 w-100">
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
            <h3 className="h6 fw-semibold mb-2">Cumplimiento de protocolos de bioseguridad</h3>
            <div className="row g-3">
              <div className="col-md-6">
                <div className="border rounded-3 p-3 d-flex justify-content-between align-items-center">
                  <span className="small">FOC-R4 (Ley 2081 del 2024)</span>
                  <SiNoBadge valor={visita.cumpleProtocoloFocR4} alarmaSi={false} />
                </div>
              </div>
              <div className="col-md-6">
                <div className="border rounded-3 p-3 d-flex justify-content-between align-items-center">
                  <span className="small">Moko (Resolución ICA 1468 del 2013)</span>
                  <SiNoBadge valor={visita.cumpleProtocoloMoko} alarmaSi={false} />
                </div>
              </div>
            </div>
          </section>

          {visita.checklistObservacion && (
            <section className="mb-4">
              <h3 className="h6 fw-semibold mb-2">Observaciones y/o plan de acción</h3>
              <p className="small text-secondary" style={{ whiteSpace: "pre-wrap" }}>
                {visita.checklistObservacion}
              </p>
            </section>
          )}

          {visita.fotos?.length > 0 && (
            <section>
              <h3 className="h6 fw-semibold mb-2 d-flex align-items-center gap-2">
                <FiImage /> Fotos
              </h3>
              <div className="d-flex flex-wrap gap-2">
                {visita.fotos.map((foto, i) =>
                  fotoUrls[foto.uuid] ? (
                    <button
                      key={foto.uuid}
                      type="button"
                      className="p-0 border-0 bg-transparent"
                      onClick={() => setFotoAbiertaIndex(i)}
                      title={foto.nombreOriginal || "Foto"}
                    >
                      <img
                        src={fotoUrls[foto.uuid]}
                        alt={foto.nombreOriginal || "Foto de la visita"}
                        className="rounded-3 border"
                        style={{ width: 96, height: 96, objectFit: "cover" }}
                      />
                    </button>
                  ) : (
                    <div
                      key={foto.uuid}
                      className="rounded-3 border d-flex align-items-center justify-content-center text-secondary"
                      style={{ width: 96, height: 96 }}
                    >
                      <span className="spinner-border spinner-border-sm" />
                    </div>
                  ),
                )}
              </div>
            </section>
          )}

          <section className="mt-5 pt-4 border-top">
            <div className="row g-4">
              <div className="col-md-6">
                <div className="text-center">
                  <p className="mb-4">&nbsp;</p>
                  <p className="border-top d-inline-block px-4 mb-1 pt-1 small fw-semibold">
                    {visita.revisadoEn ? visita.revisadoPorNombre || "—" : "Pendiente de revisión"}
                  </p>
                  <p className="small text-secondary mb-0">
                    {visita.revisadoEn ? visita.revisadoPorCargo || "Revisor" : ""}
                  </p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="text-center">
                  <p className="mb-4">&nbsp;</p>
                  <p className="border-top d-inline-block px-4 mb-1 pt-1 small fw-semibold">
                    {visita.usuarioNombre || "—"}
                  </p>
                  <p className="small text-secondary mb-0">{visita.usuarioCargo || "Responsable"}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {fotoAbiertaIndex !== null && visita?.fotos?.length > 0 && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ backgroundColor: "rgba(0,0,0,0.85)", zIndex: 1100 }}
          onClick={() => setFotoAbiertaIndex(null)}
        >
          <button
            type="button"
            className="btn btn-light rounded-circle position-absolute d-flex align-items-center justify-content-center p-0"
            style={{ top: 16, right: 16, width: 40, height: 40 }}
            onClick={() => setFotoAbiertaIndex(null)}
          >
            <FiX size={20} />
          </button>

          {visita.fotos.length > 1 && (
            <button
              type="button"
              className="btn btn-light rounded-circle position-absolute d-flex align-items-center justify-content-center p-0"
              style={{ left: 16, width: 48, height: 48 }}
              onClick={(e) => {
                e.stopPropagation();
                setFotoAbiertaIndex((i) => (i - 1 + visita.fotos.length) % visita.fotos.length);
              }}
            >
              <FiChevronLeft size={24} />
            </button>
          )}

          <img
            src={fotoUrls[visita.fotos[fotoAbiertaIndex].uuid]}
            alt={visita.fotos[fotoAbiertaIndex].nombreOriginal || "Foto de la visita"}
            style={{ maxWidth: "90%", maxHeight: "85vh", objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()}
          />

          {visita.fotos.length > 1 && (
            <button
              type="button"
              className="btn btn-light rounded-circle position-absolute d-flex align-items-center justify-content-center p-0"
              style={{ right: 16, width: 48, height: 48 }}
              onClick={(e) => {
                e.stopPropagation();
                setFotoAbiertaIndex((i) => (i + 1) % visita.fotos.length);
              }}
            >
              <FiChevronRight size={24} />
            </button>
          )}

          {visita.fotos.length > 1 && (
            <span
              className="position-absolute text-white small"
              style={{ bottom: 16, left: "50%", transform: "translateX(-50%)" }}
            >
              {fotoAbiertaIndex + 1} / {visita.fotos.length}
            </span>
          )}
        </div>
      )}
    </ModalShell>
  );
}
