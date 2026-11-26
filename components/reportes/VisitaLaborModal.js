"use client";

import { bloquesObservacion } from "@/lib/textoObservacion";
import { useEffect, useState } from "react";
import {
  FiCheck,
  FiX,
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
// Dato con etiqueta pequeña arriba (mismo estilo que la ventana de la programación de aspersión).
function Dato({ label, children, ancho = "col-6 col-md" }) {
  return (
    <div className={ancho}>
      <div className="border rounded-3 overflow-hidden h-100 text-center">
        <div className="fw-bold text-uppercase py-1" style={{ fontSize: "0.62rem", backgroundColor: "#f0fdf4", color: "#166534", letterSpacing: "0.03em" }}>
          {label}
        </div>
        <div className="fw-semibold small py-2 px-1">{children ?? "—"}</div>
      </div>
    </div>
  );
}

// Título de sección en franja verde (como el PDF).
function Seccion({ children }) {
  return (
    <div className="fw-bold text-uppercase text-white rounded-2 px-2 py-1 mb-2 d-flex align-items-center gap-2" style={{ backgroundColor: "#166534", fontSize: "0.72rem", letterSpacing: "0.03em" }}>
      {children}
    </div>
  );
}

// Firma (PNG) guardada en el perfil del usuario; sin firma queda el espacio en blanco sobre la línea.
function FirmaPerfil({ userUuid }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!userUuid) return undefined;
    let actual = null;
    let cancelado = false;
    apiFetchBlob(`/auth/firmas/${userUuid}`)
      .then((blob) => {
        if (cancelado) return;
        actual = URL.createObjectURL(blob);
        setUrl(actual);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
      if (actual) URL.revokeObjectURL(actual);
    };
  }, [userUuid]);
  return (
    <div style={{ height: 60 }} className="d-flex align-items-end justify-content-center">
      {url && userUuid ? <img src={url} alt="Firma" style={{ maxHeight: 58, maxWidth: "100%" }} /> : null}
    </div>
  );
}

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

  // «Ver PDF»: lo abre en otra pestaña. La pestaña se abre de una vez (con el clic) para que el navegador no la bloquee y
  // luego se le carga el PDF ya generado.
  const handleExportarPdf = async () => {
    setGenerandoPdf(true);
    const pestana = window.open("", "_blank");
    try {
      const { generarVisitaLaborPdfBlob } = await import("@/lib/visitaLaborExport");
      const { blob } = await generarVisitaLaborPdfBlob(visita);
      const url = URL.createObjectURL(blob);
      if (pestana) pestana.location.href = url;
      else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      pestana?.close();
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
          <div className="d-flex justify-content-end flex-wrap gap-2 mb-2">
            <div className="d-flex gap-2 flex-wrap">
              {!visita.revisadoEn && (
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm rounded-3 d-flex align-items-center gap-1 text-nowrap"
                  onClick={handleMarcarRevisada}
                  disabled={revisando}
                >
                  <FiCheckCircle /> {revisando ? "Marcando..." : "Marcar como revisado"}
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-1 text-nowrap"
                onClick={handleExportarPdf}
                disabled={generandoPdf}
              >
                <FiFileText /> {generandoPdf ? "Generando..." : "Ver PDF"}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-1 text-nowrap"
                onClick={handleExportarWord}
                disabled={generandoWord}
              >
                <FiFileText /> {generandoWord ? "Generando..." : "Exportar Word"}
              </button>
            </div>
          </div>

          {/* Franja verde del encabezado, como el PDF y el comprobante de aspersión. */}
          <div className="d-flex align-items-center gap-3 rounded-3 px-3 py-2 mb-2 text-white" style={{ backgroundColor: "#166534" }}>
            <div className="bg-white rounded-2 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40 }}>
              <AppLogo size={30} color="#166534" />
            </div>
            <div className="flex-grow-1">
              <div className="fw-bold">VISITA DE SANIDAD VEGETAL — {String(visita.fincaNombre || "").toUpperCase()}</div>
              <div style={{ fontSize: "0.72rem" }}>EVALUACIÓN DE LABORES</div>
            </div>
            <div className="text-end">
              <div style={{ fontSize: "0.68rem" }}>{visita.revisadoEn ? "APROBADA" : "PENDIENTE DE REVISIÓN"}</div>
              <div className="fw-bold small">{visita.semanaCodigo}</div>
            </div>
          </div>
          <div className="row g-2 mb-3">
            <Dato label="Finca">{visita.fincaNombre}</Dato>
            <Dato label="Semana">{visita.semanaCodigo}</Dato>
            <Dato label="Fecha">{visita.fecha}</Dato>
            <Dato label="Responsable">{visita.usuarioNombre}</Dato>
            <Dato label="Estado">
              {visita.revisadoEn ? (
                <span className="badge rounded-pill" style={{ backgroundColor: "#dcfce7", color: "#166534" }}>
                  Aprobada · {visita.revisadoPorNombre || ""}
                </span>
              ) : (
                <span className="badge rounded-pill" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
                  Pendiente de revisión
                </span>
              )}
            </Dato>
          </div>

          {visita.clima && (
            <section className="mb-4">
              <Seccion>Condiciones climáticas</Seccion>
              <div className="row g-2">
                <Dato label="Lluvia">{`${visita.clima.mm} mm`}</Dato>
                <Dato label="Temperatura">{visita.clima.temperatura != null ? `${visita.clima.temperatura} °C` : "—"}</Dato>
                <Dato label="Humedad relativa">{visita.clima.humedadRelativa != null ? `${visita.clima.humedadRelativa} %` : "—"}</Dato>
              </div>
            </section>
          )}

          <section className="mb-4">
            <Seccion>Estado fitosanitario por lote</Seccion>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead style={{ backgroundColor: "#f0fdf4" }}>
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
                    <div key={l.uuid} className="small mb-3">
                      <div className="fw-bold small rounded-2 px-2 py-1 mb-2" style={{ backgroundColor: "#f0fdf4", color: "#166534" }}>LOTE {l.loteNombre}</div>
                      {/* Párrafos separados, títulos en negrita y viñetas con sangría (mismo formato que el PDF). */}
                      {bloquesObservacion(l.observacion).map((b, i) =>
                        b.tipo === "titulo" ? (
                          <div key={i} className="fw-semibold mt-2 mb-1">
                            {b.texto}
                          </div>
                        ) : b.tipo === "parrafo" ? (
                          <p key={i} className="mb-2 text-secondary" style={{ lineHeight: 1.5, textAlign: "justify" }}>
                            {b.texto}
                          </p>
                        ) : (
                          <div key={i} className="d-flex gap-2 mb-1 text-secondary" style={{ paddingLeft: 4, lineHeight: 1.5 }}>
                            <span>{b.marca}</span>
                            <span style={{ textAlign: "justify" }}>{b.texto}</span>
                          </div>
                        ),
                      )}
                    </div>
                  ))}
              </div>
            )}
          </section>

          <section className="mb-4">
            <Seccion>Hallazgos</Seccion>
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
            <Seccion>Cumplimiento de protocolos de bioseguridad</Seccion>
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
              <Seccion>Observación general de la visita</Seccion>
              <p className="small text-secondary" style={{ whiteSpace: "pre-wrap" }}>
                {visita.checklistObservacion}
              </p>
            </section>
          )}

          {visita.fotos?.length > 0 && (
            <section>
              <Seccion><FiImage /> Fotos</Seccion>
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

          <section className="mt-5">
            <div className="row g-4">
              {[
                { uuid: visita.revisadoEn ? visita.revisadoPorUuid : null, nombre: visita.revisadoEn ? visita.revisadoPorNombre || "—" : "Pendiente de revisión", cargo: visita.revisadoEn ? visita.revisadoPorCargo || "Revisor" : "", rotulo: "REVISÓ" },
                { uuid: visita.usuarioUuid, nombre: visita.usuarioNombre || "—", cargo: visita.usuarioCargo || "Responsable", rotulo: "REGISTRÓ" },
              ].map((f) => (
                <div key={f.rotulo} className="col-md-6">
                  <div className="text-center mx-auto" style={{ maxWidth: 300 }}>
                    <FirmaPerfil userUuid={f.uuid} />
                    <div className="border-top border-dark pt-1 small fw-semibold">{f.nombre}</div>
                    <div className="small text-secondary">{f.cargo}</div>
                    <div className="fw-bold rounded-2 mt-1 py-1" style={{ fontSize: "0.68rem", backgroundColor: "#f0fdf4", color: "#166534" }}>
                      {f.rotulo}
                    </div>
                  </div>
                </div>
              ))}
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
