"use client";

// Detalle completo de un comprobante de aspersión: datos de la aspersión, de la aplicación (piloto, clima, horas) y los
// insumos con las cantidades DEFINITIVAS — lo que se descontó del inventario al ejecutarla — y la dosis aplicada por
// hectárea (cantidad ÷ hectáreas de la aspersión).
import { FiCheck, FiMail } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import RecorridoKml from "@/components/aspersion/RecorridoKml";

const MEDIO_LABEL = { AVION: "Avión", DRON: "Dron" };

function fmtFechaHora(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
}

const num = (v, dec = 2) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "—" : Number(v).toLocaleString("es-CO", { maximumFractionDigits: dec });

const nombreUsuario = (u) => (u ? [u.nombre, u.apellido].filter(Boolean).join(" ") || u.usuario : "—");

const tipoLabel = (t) =>
  String(t)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());

function Dato({ label, children }) {
  return (
    <div className="col-6 col-md-3">
      <div className="text-secondary" style={{ fontSize: "0.68rem" }}>
        {label}
      </div>
      <div className="fw-medium small">{children ?? "—"}</div>
    </div>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div className="mb-3">
      <div className="fw-semibold small mb-2" style={{ color: "#166534" }}>
        {titulo}
      </div>
      <div className="row g-2">{children}</div>
    </div>
  );
}

// `onAprobar(c)`: si viene (permiso de emitir) y el comprobante está en borrador, muestra al final el botón «Aprobar».
// `onEnviar(c)`: con el comprobante ya emitido, botón «Enviar por correo» (PDF con el mapa + KMZ del recorrido).
export default function DetalleComprobanteModal({ comprobante: c, cargando, onClose, onAprobar, aprobando = false, onEnviar, enviando = false }) {
  const a = c?.aspersion || {};
  const hectareas = Number(a.hectareas) || 0;
  const emitido = c?.estado === "EMITIDO";
  const anulado = c?.estado === "ANULADO";
  // Solo un borrador se puede aprobar: ni el emitido ni el anulado.
  const esBorrador = c?.estado === "BORRADOR";
  const badge = anulado
    ? { fondo: "#fee2e2", color: "#b91c1c", texto: "Anulado" }
    : emitido
      ? { fondo: "#d1fae5", color: "#047857", texto: "Emitido" }
      : { fondo: "#fef3c7", color: "#b45309", texto: "Borrador" };

  return (
    <ModalShell title={c ? `Comprobante ${c.numero}` : "Comprobante"} onClose={onClose} width="60rem">
      {cargando || !c ? (
        <p className="text-secondary small py-4 text-center mb-0">Cargando...</p>
      ) : (
        <>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <span className="badge rounded-pill small" style={{ backgroundColor: badge.fondo, color: badge.color }}>
              {badge.texto}
            </span>
            <span className="small text-secondary">
              Aspersión {a.numero || "—"}
              {emitido && c.emitidoEn ? ` · emitido el ${fmtFechaHora(c.emitidoEn)} por ${nombreUsuario(c.emitidoPor)}` : ""}
              {anulado && c.anuladoEn ? ` · anulado el ${fmtFechaHora(c.anuladoEn)} por ${nombreUsuario(c.anuladoPor)}` : ""}
            </span>
          </div>

          {anulado && (
            <div className="alert alert-danger py-2 small">
              <div className="fw-semibold mb-1">Comprobante anulado</div>
              <div className="mb-0">Motivo: {c.motivoAnulacion || "—"}</div>
              {c.puedeRegenerar && (
                <div className="text-secondary mt-1">
                  Esta aspersión quedó sin comprobante vigente: puedes regenerar un borrador desde la lista.
                </div>
              )}
            </div>
          )}

          <Seccion titulo="Aspersión">
            <Dato label="Finca">{a.finca?.nombre}</Dato>
            <Dato label="Semana">{a.semana?.codigo}</Dato>
            <Dato label="Fecha programada">{a.fecha}</Dato>
            <Dato label="Ejecutada">{fmtFechaHora(c.ejecutadoEn)}</Dato>
            <Dato label="Mezcla">{a.mezcla?.nombre || a.mezcla?.codigo}</Dato>
            <Dato label="Tipo">{Array.isArray(a.tipo) && a.tipo.length ? a.tipo.map(tipoLabel).join(", ") : "—"}</Dato>
            <Dato label="Vehículo">{MEDIO_LABEL[c.medio || a.medio] || "—"}</Dato>
            <Dato label="Pista">{a.pista?.nombre || "—"}</Dato>
            <Dato label="Almacén">{a.almacen?.nombre}</Dato>
            <Dato label="Hectáreas programadas">{num(c.hectareasProgramadas)}</Dato>
            <Dato label="Hectáreas aplicadas">{num(c.hectareasAplicadas)}</Dato>
            <Dato label="Galones totales">{num(c.galonesTotales)}</Dato>
            <Dato label="Representante Corbana">{a.representanteCorbanaNombre}</Dato>
            <Dato label="Administrador de finca">{a.administradorFincaNombre}</Dato>
            <Dato label="Programó">{nombreUsuario(a.usuario)}</Dato>
            <Dato label="Ejecutó">{nombreUsuario(c.ejecutadoPor)}</Dato>
          </Seccion>

          <Seccion titulo="Aplicación">
            <Dato label={c.medio === "DRON" ? "Piloto del dron" : "Piloto"}>{c.pilotoColaborador?.nombre || c.piloto}</Dato>
            {(c.participantes || []).some((p) => p.rol === "ASISTENTE") && (
              <Dato label="Asistentes">
                {c.participantes
                  .filter((p) => p.rol === "ASISTENTE")
                  .map((p) => p.colaborador.nombre)
                  .join(", ")}
              </Dato>
            )}
            <Dato label="Aeronave">{c.aeronave}</Dato>
            <Dato label="Volumen de aplicación">{c.volumenAplicacionHa != null ? `${num(c.volumenAplicacionHa)} /ha` : "—"}</Dato>
            <Dato label="Horario">{c.horaInicio || c.horaFinal ? `${c.horaInicio || "—"} a ${c.horaFinal || "—"}` : "—"}</Dato>
            <Dato label="Temperatura">
              {c.temperaturaInicial != null || c.temperaturaFinal != null ? `${num(c.temperaturaInicial, 1)} °C a ${num(c.temperaturaFinal, 1)} °C` : "—"}
            </Dato>
            <Dato label="Velocidad del viento">{c.velocidadViento != null ? `${num(c.velocidadViento, 1)} km/h` : "—"}</Dato>
            <Dato label="Humedad relativa final">{c.humedadRelativaFinal != null ? `${num(c.humedadRelativaFinal, 1)} %` : "—"}</Dato>
          </Seccion>

          {/* Recorrido (KML): vista previa del mapa y descarga; se sube al editar el borrador. */}
          <div className="mb-3">
            <RecorridoKml comprobante={c} />
          </div>

          <div className="fw-semibold small mb-2" style={{ color: "#166534" }}>
            Receta y cantidades utilizadas
          </div>
          <div className="card border-0 rounded-2 overflow-hidden mb-2" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: "0.72rem" }}>
                <thead>
                  <tr className="table-light text-secondary" style={{ borderBottom: "1px solid #e9ecef" }}>
                    <th className="fw-medium">Insumo</th>
                    <th className="fw-medium">Unidad</th>
                    <th className="fw-medium text-end">Dosis por hectárea</th>
                    <th className="fw-medium text-end">Cantidad utilizada</th>
                  </tr>
                </thead>
                <tbody>
                  {(c.insumos || []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-secondary py-3 small">
                        Sin insumos registrados.
                      </td>
                    </tr>
                  )}
                  {(c.insumos || []).map((i, idx) => (
                    <tr key={`${i.nombre}-${idx}`}>
                      <td className="fw-medium">
                        {i.nombre}
                        {i.esPrincipal && (
                          <span className="badge rounded-pill ms-2" style={{ backgroundColor: "#dcfce7", color: "#166534" }}>
                            Principal
                          </span>
                        )}
                        {i.esAdicional && (
                          <span className="badge rounded-pill ms-2" style={{ backgroundColor: "#fef3c7", color: "#b45309" }} title="Agregado a esta aspersión; no está en la receta de la mezcla">
                            Adicional
                          </span>
                        )}
                      </td>
                      <td className="text-secondary">{i.unidad?.simbolo || i.unidad?.nombre || "—"}</td>
                      <td className="text-secondary text-end">
                        {i.cantidad != null && hectareas > 0 ? `${num(i.cantidad / hectareas, 2)} ${i.unidad?.simbolo || ""}/ha` : "—"}
                      </td>
                      <td className="text-end fw-semibold">
                        {i.cantidad != null ? `${num(i.cantidad, /^agua$/i.test((i.nombre || "").trim()) ? 0 : 4)} ${i.unidad?.simbolo || ""}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-secondary mb-3" style={{ fontSize: "0.68rem" }}>
            Cantidades definitivas: son las que se descontaron del inventario al ejecutar la aspersión ({num(hectareas)} ha).
          </p>

          {(c.observaciones || a.observaciones) && (
            <div className="mb-1">
              <div className="fw-semibold small mb-1" style={{ color: "#166534" }}>
                Observaciones
              </div>
              {a.observaciones && <p className="small mb-1">Programación: {a.observaciones}</p>}
              {c.observaciones && <p className="small mb-0">Aplicación: {c.observaciones}</p>}
            </div>
          )}

          <div className="d-flex flex-wrap align-items-center justify-content-end gap-2 border-top pt-3 mt-3">
            {esBorrador && onAprobar && (!c.piloto || !(Number(c.hectareasAplicadas) > 0) || !c.kmlNombre) && (
              <span className="small text-secondary me-auto">
                Para aprobarlo falta {[!c.piloto && "el piloto", !(Number(c.hectareasAplicadas) > 0) && "las hectáreas aplicadas", !c.kmlNombre && "el recorrido (KML o KMZ)"].filter(Boolean).join(", ")}: se abrirá la edición.
              </span>
            )}
            <button type="button" className="btn btn-sm btn-outline-secondary rounded-3" onClick={onClose}>
              Cerrar
            </button>
            {esBorrador && onAprobar && (
              <button
                type="button"
                className="btn btn-sm btn-brand rounded-3 d-flex align-items-center gap-1"
                disabled={aprobando}
                onClick={() => onAprobar(c)}
              >
                <FiCheck /> {aprobando ? "Aprobando..." : "Aprobar comprobante"}
              </button>
            )}
            {c.estado === "EMITIDO" && onEnviar && (
              <button
                type="button"
                className="btn btn-sm btn-brand rounded-3 d-flex align-items-center gap-1"
                disabled={enviando}
                title={c.correoEnviadoEn ? `Enviado el ${new Date(c.correoEnviadoEn).toLocaleString("es-CO")}: se enviará de nuevo` : "Enviar el PDF y el KMZ por correo"}
                onClick={() => onEnviar(c)}
              >
                <FiMail /> {enviando ? "Enviando..." : c.correoEnviadoEn ? "Reenviar" : "Enviar por correo"}
              </button>
            )}
          </div>
        </>
      )}
    </ModalShell>
  );
}
