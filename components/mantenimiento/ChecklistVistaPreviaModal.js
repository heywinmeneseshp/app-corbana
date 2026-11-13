"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheckCircle, FiInfo, FiRotateCcw } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import { CALIFICACIONES } from "@/components/mantenimiento/OrdenChecklist";

const porValor = Object.fromEntries(CALIFICACIONES.map((c) => [c.value, c]));
const NO_SATISFACTORIAS = ["OBSERVACION", "INSATISFACTORIO"];

// Vista previa de una plantilla de checklist, como se verá dentro de una orden y con el mismo funcionamiento: se califica cada ítem y se escribe su
// observación. Es una práctica: nada de esto se guarda. Sirve para revisar la plantilla y para entender cómo se diligencia.
export default function ChecklistVistaPreviaModal({ nombre, secciones, onClose }) {
  const [valores, setValores] = useState({}); // "s-i" -> { calificacion, observaciones }
  const clave = (si, ii) => `${si}-${ii}`;
  const valor = (si, ii) => ({ calificacion: "PENDIENTE", observaciones: "", ...valores[clave(si, ii)] });
  const cambiar = (si, ii, patch) => setValores((v) => ({ ...v, [clave(si, ii)]: { ...valor(si, ii), ...patch } }));

  const resumen = useMemo(() => {
    const conteo = Object.fromEntries(CALIFICACIONES.map((c) => [c.value, 0]));
    let total = 0;
    secciones.forEach((s, si) =>
      s.items.forEach((_, ii) => {
        total += 1;
        conteo[({ calificacion: "PENDIENTE", ...valores[`${si}-${ii}`] }).calificacion] += 1;
      }),
    );
    return { conteo, total };
  }, [secciones, valores]);

  const hallazgos = secciones.flatMap((s, si) => s.items.map((descripcion, ii) => ({ s: s.seccion, descripcion, v: valor(si, ii) }))).filter((x) => NO_SATISFACTORIAS.includes(x.v.calificacion));
  const marcarSeccion = (si) =>
    secciones[si].items.forEach((_, ii) => {
      if (valor(si, ii).calificacion === "PENDIENTE") cambiar(si, ii, { calificacion: "SATISFACTORIO" });
    });

  return createPortal(
    <ModalShell title={`Vista previa · ${nombre || "Plantilla"}`} onClose={onClose} size="xl">
      <div className="alert alert-info py-2 small d-flex gap-2 align-items-start">
        <FiInfo className="flex-shrink-0 mt-1" />
        <div>
          <strong>Así se diligencia el checklist en una orden.</strong> Prueba aquí: califica cada ítem con la lista de la derecha (Satisfactorio, Observación, Insatisfactorio, N/A o Pendiente) y escribe lo encontrado. Lo que
          marques como <strong>Observación</strong> o <strong>Insatisfactorio</strong> crea un <strong>hallazgo</strong> en la orden. «Pendientes → satisfactorio» marca de una vez lo que quede pendiente en una sección.
          <span className="d-block text-secondary">Es una práctica: lo que escribas aquí no se guarda.</span>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
        {CALIFICACIONES.map((c) => (
          <span key={c.value} className="badge rounded-1 fw-normal" style={{ background: c.bg, color: c.color }}>
            {c.label}: {resumen.conteo[c.value]}
          </span>
        ))}
        <span className="small text-secondary">de {resumen.total} ítems</span>
        <span className="small ms-2" style={{ color: hallazgos.length ? "#b45309" : "#64748b" }}>
          Hallazgos que se crearían: <strong>{hallazgos.length}</strong>
        </span>
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-1 ms-auto d-inline-flex align-items-center gap-1" onClick={() => setValores({})} disabled={Object.keys(valores).length === 0}>
          <FiRotateCcw /> Limpiar
        </button>
      </div>

      {secciones.map((s, si) => (
        <div key={`${si}-${s.seccion}`} className="border rounded-1 mb-2">
          <div className="d-flex align-items-center justify-content-between px-2 py-1" style={{ background: "#166534", color: "#fff" }}>
            <span className="fw-semibold small">
              {si + 1}. {s.seccion}
            </span>
            <button type="button" className="btn btn-link btn-sm p-0 text-white" style={{ fontSize: "0.75rem" }} onClick={() => marcarSeccion(si)} title="Marca como Satisfactorio lo que siga Pendiente en esta sección">
              <FiCheckCircle /> Pendientes → satisfactorio
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0 small">
              <tbody>
                {s.items.map((descripcion, ii) => {
                  const v = valor(si, ii);
                  const c = porValor[v.calificacion];
                  return (
                    <tr key={`${ii}-${descripcion}`}>
                      <td style={{ width: "42%" }}>
                        <span className="text-secondary me-1">
                          {si + 1}.{ii + 1}
                        </span>
                        {descripcion}
                      </td>
                      <td style={{ width: "11rem" }}>
                        <select className="form-select form-select-sm rounded-1" style={{ background: c.bg, color: c.color, fontWeight: 600 }} value={v.calificacion} onChange={(e) => cambiar(si, ii, { calificacion: e.target.value })}>
                          {CALIFICACIONES.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm rounded-1"
                          maxLength={3000}
                          placeholder={NO_SATISFACTORIAS.includes(v.calificacion) ? "Describe lo encontrado" : "Observaciones / evidencia"}
                          value={v.observaciones}
                          onChange={(e) => cambiar(si, ii, { observaciones: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {hallazgos.length > 0 && (
        <div className="border rounded-1 p-2 mt-2" style={{ background: "#fffbeb" }}>
          <div className="fw-semibold small mb-1">Hallazgos que se crearían en la orden</div>
          <ul className="small mb-0 ps-3">
            {hallazgos.map((h, i) => (
              <li key={i}>
                <span style={{ color: porValor[h.v.calificacion].color, fontWeight: 600 }}>{porValor[h.v.calificacion].label}</span> · {h.v.observaciones || h.descripcion}
                <span className="text-secondary"> ({h.s})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ModalShell>,
    document.body,
  );
}
