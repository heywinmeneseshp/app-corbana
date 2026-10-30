"use client";

// Detalle de una aspersión programada (clic en la fila de Programación de Aspersiones): datos de la programación, la
// receta (insumos con su dosis por hectárea y la cantidad) y, al final, los botones «Enviar aviso», «Marcar como revisado»
// (su firma va en el aviso) y «Ejecutar aspersión» si está programada.
// Si ya se ejecutó, las cantidades son las definitivas (las que se descontaron del inventario).
import { FiCheck, FiMail, FiCheckCircle, FiDownload } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import { descargarDetalleAspersionPdf } from "@/lib/aspersionDetallePdf";

const MEDIO_LABEL = { AVION: "Avión", DRON: "Dron" };
const TIPO_LABEL = {
  SIGATOKA_NEGRA: "Sigatoka Negra",
  DEFOLIADOR: "Defoliador",
  FERTILIZACION: "Fertilización",
};
// Mismo flujo que la tabla: Programada → Revisada → Enviada → Ejecutada (o Cancelada).
const ESTADO_INFO = {
  PROGRAMADA: { label: "Programada", bg: "#dbeafe", color: "#2563eb" },
  REVISADA: { label: "Revisada", bg: "#ede9fe", color: "#7c3aed" },
  ENVIADA: { label: "Enviada", bg: "#cffafe", color: "#0e7490" },
  EJECUTADA: { label: "Ejecutada", bg: "#dcfce7", color: "#16a34a" },
  CANCELADA: { label: "Cancelada", bg: "#f3f4f6", color: "#dc2626" },
};

function fmtFechaHora(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const num = (v, dec = 2) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("es-CO", { maximumFractionDigits: dec });

const nombreUsuario = (u) =>
  u ? [u.nombre, u.apellido].filter(Boolean).join(" ") || u.usuario : "—";

function Dato({ label, children, ancho = "col-6 col-md-3" }) {
  return (
    <div className={ancho}>
      <div className="text-secondary" style={{ fontSize: "0.68rem" }}>
        {label}
      </div>
      <div className="fw-medium small">{children ?? "—"}</div>
    </div>
  );
}

export default function DetalleAspersionModal({
  aspersion: a,
  cargando,
  onClose,
  onEjecutar,
  onEnviar,
  enviando = false,
  onRevisar,
  revisando = false,
}) {
  const hectareas = Number(a?.hectareas) || 0;
  const revisada = Boolean(a?.revisadoPor || a?.revisadoPorId);
  const estadoVisible = a?.estado !== "PROGRAMADA" ? a?.estado : a?.correoEnviadoEn ? "ENVIADA" : revisada ? "REVISADA" : "PROGRAMADA";
  const info = ESTADO_INFO[estadoVisible] || ESTADO_INFO.PROGRAMADA;
  // Flujo: se envía el aviso solo de una programada revisada, y se ejecuta solo con el aviso enviado. Ejecutada o cancelada ya no
  // muestra enviar ni revisar.
  const puedeEnviar = a?.estado === "PROGRAMADA" && revisada;
  const puedeEjecutar = a?.estado === "PROGRAMADA" && Boolean(a?.correoEnviadoEn);
  const ejecutada = a?.estado === "EJECUTADA";
  const componentes = a?.componentes || [];

  return (
    <ModalShell
      title={a ? `Aspersión ${a.numero}` : "Aspersión"}
      onClose={onClose}
      width="60rem"
      acciones={
        a && !cargando ? (
          <button
            type="button"
            className="btn btn-sm btn-link text-danger text-decoration-none border-0 d-flex align-items-center gap-1 p-1 me-3"
            title="Descargar este detalle en PDF"
            onClick={() => descargarDetalleAspersionPdf(a)}
          >
            <FiDownload /> PDF
          </button>
        ) : null
      }
    >
      {cargando || !a ? (
        <p className="text-secondary small py-4 text-center mb-0">
          Cargando...
        </p>
      ) : (
        <>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <span
              className="badge rounded-pill small"
              style={{ backgroundColor: info.bg, color: info.color }}
            >
              {info.label}
            </span>
            {a.partesCiclo > 1 && (
              <span className="small text-secondary">
                Parte {a.cicloParte}/{a.partesCiclo} del ciclo
              </span>
            )}
            {a.correoEnviadoEn && (
              <span className="small text-secondary">
                · Aviso enviado el {fmtFechaHora(a.correoEnviadoEn)}
              </span>
            )}
            {a.revisadoPor ? (
              <span
                className="badge rounded-pill small d-inline-flex align-items-center gap-1"
                style={{ backgroundColor: "#dcfce7", color: "#166534" }}
              >
                <FiCheckCircle size={11} /> Revisado por{" "}
                {nombreUsuario(a.revisadoPor)} · {fmtFechaHora(a.revisadoEn)}
              </span>
            ) : null}
          </div>

          <div className="fw-semibold small mb-2" style={{ color: "#166534" }}>
            Programación
          </div>
          <div className="row g-2 mb-3">
            <Dato label="Finca">{a.finca?.nombre}</Dato>
            <Dato label="Semana">{a.semana?.codigo}</Dato>
            <Dato label="Fecha programada">{a.fecha}</Dato>
            <Dato label="Fecha de ejecución">{a.fechaEjecucion || "—"}</Dato>
            <Dato label="Mezcla" ancho="col-12 col-md-9">
              {a.mezcla?.nombre || a.mezcla?.codigo}
            </Dato>
            <Dato label="Tipo">
              {Array.isArray(a.tipo) && a.tipo.length
                ? a.tipo.map((t) => TIPO_LABEL[t] || t).join(", ")
                : "—"}
            </Dato>
            <Dato label="Vehículo">{MEDIO_LABEL[a.medio] || "—"}</Dato>
            <Dato label="Pista">{a.pista?.nombre || "—"}</Dato>
            <Dato label="Hectáreas">{`${num(hectareas)} ha`}</Dato>
            <Dato label="Cantidad a preparar">
              {a.cantidadCalculada != null
                ? `${num(a.cantidadCalculada)} ${a.mezcla?.unidadRendimiento?.simbolo || ""}`
                : "—"}
            </Dato>
            <Dato label="Almacén" ancho="col-6">
              {a.almacen?.nombre}
            </Dato>
            <Dato label="Intervalo desde la anterior" ancho="col-6">
              {a.diasDesdeUltima != null ? `${a.diasDesdeUltima} días` : "—"}
            </Dato>
          </div>

          <div className="fw-semibold small mb-2" style={{ color: "#166534" }}>
            Responsables
          </div>
          <div className="row g-2 mb-3">
            <Dato label="Representante Corbana">
              {a.representanteCorbanaNombre}
            </Dato>
            <Dato label="Administrador de finca">
              {a.administradorFincaNombre}
            </Dato>
            <Dato label="Programó">{nombreUsuario(a.usuario)}</Dato>
            <Dato label="Revisado por">
              {a.revisadoPor
                ? `${nombreUsuario(a.revisadoPor)} · ${fmtFechaHora(a.revisadoEn)}`
                : "Sin revisar"}
            </Dato>
          </div>

          <div className="fw-semibold small mb-2" style={{ color: "#166534" }}>
            Receta y cantidades {ejecutada ? "utilizadas" : "a utilizar"}
          </div>
          <div
            className="card border-0 rounded-2 overflow-hidden mb-2"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}
          >
            <div className="table-responsive">
              <table
                className="table table-sm table-hover mb-0 align-middle"
                style={{ fontSize: "0.72rem" }}
              >
                <thead>
                  <tr
                    className="table-light text-secondary"
                    style={{ borderBottom: "1px solid #e9ecef" }}
                  >
                    <th className="fw-medium">Insumo</th>
                    <th className="fw-medium">Unidad</th>
                    <th className="fw-medium text-end">Dosis por hectárea</th>
                    <th className="fw-medium text-end">
                      {ejecutada ? "Cantidad utilizada" : "Cantidad"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {componentes.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center text-secondary py-3 small"
                      >
                        Sin insumos guardados.
                      </td>
                    </tr>
                  )}
                  {componentes.map((c, idx) => (
                    <tr key={c.uuid || idx}>
                      <td className="fw-medium">
                        {c.articulo?.nombre || "—"}
                        {c.esAdicional && (
                          <span
                            className="badge rounded-pill ms-2"
                            style={{
                              backgroundColor: "#fef3c7",
                              color: "#b45309",
                            }}
                            title="Agregado a esta aspersión; no está en la receta de la mezcla"
                          >
                            Adicional
                          </span>
                        )}
                      </td>
                      <td className="text-secondary">
                        {c.unidad?.simbolo || c.unidad?.nombre || "—"}
                      </td>
                      <td className="text-secondary text-end">
                        {c.cantidad != null && hectareas > 0
                          ? `${num(Number(c.cantidad) / hectareas, 2)} ${c.unidad?.simbolo || ""}/ha`
                          : "—"}
                      </td>
                      <td className="text-end fw-semibold">
                        {c.cantidad != null
                          ? `${num(c.cantidad, /^agua$/i.test((c.articulo?.nombre || "").trim()) ? 0 : 4)} ${c.unidad?.simbolo || ""}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-secondary mb-3" style={{ fontSize: "0.68rem" }}>
            {ejecutada
              ? `Cantidades definitivas: las que se descontaron del inventario al ejecutar (${num(hectareas)} ha).`
              : `Cantidades para ${num(hectareas)} ha; se descuentan del inventario al ejecutar.`}
          </p>

          {a.observaciones && (
            <div className="mb-1">
              <div
                className="fw-semibold small mb-1"
                style={{ color: "#166534" }}
              >
                Observaciones
              </div>
              <p className="small mb-0">{a.observaciones}</p>
            </div>
          )}

          {/* Acciones al final (sin «Cerrar»: el modal se cierra con la X de arriba). Solo se muestra si hay alguna. */}
          {((puedeEnviar && onEnviar) ||
            (a.estado === "PROGRAMADA" && onRevisar) ||
            (puedeEjecutar && onEjecutar)) && (
            <div className="d-flex flex-wrap align-items-center justify-content-end gap-2 border-top pt-3 mt-3">
              {a.estado === "PROGRAMADA" &&
                onRevisar &&
                (a.revisadoPor ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-secondary text-decoration-none"
                    disabled={revisando}
                    onClick={() => onRevisar(true)}
                  >
                    Quitar revisado
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-success rounded-3 d-flex align-items-center gap-1"
                    disabled={revisando}
                    onClick={() => onRevisar(false)}
                    title="Tu firma saldrá en el aviso como quien revisó"
                  >
                    <FiCheckCircle />{" "}
                    {revisando ? "Guardando..." : "Marcar como revisado"}
                  </button>
                ))}
              {puedeEnviar && onEnviar && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success rounded-3 d-flex align-items-center gap-1"
                  disabled={enviando}
                  onClick={onEnviar}
                  title={
                    a.correoEnviadoEn
                      ? "El aviso ya se envió: se enviará de nuevo"
                      : "Enviar el aviso por correo"
                  }
                >
                  <FiMail />{" "}
                  {enviando
                    ? "Enviando..."
                    : a.correoEnviadoEn
                      ? "Reenviar aviso"
                      : "Enviar aviso"}
                </button>
              )}
              {puedeEjecutar && onEjecutar && (
                <button
                  type="button"
                  className="btn btn-sm btn-brand rounded-3 d-flex align-items-center gap-1"
                  onClick={() => onEjecutar(a)}
                >
                  <FiCheck /> Ejecutar aspersión
                </button>
              )}
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}
