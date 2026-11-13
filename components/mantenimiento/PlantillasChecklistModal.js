"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiPlus, FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import ModalShell from "@/components/ModalShell";

// Texto del editor <-> secciones: una línea «## Nombre» abre una sección y cada línea siguiente es un ítem.
const aTexto = (secciones) => (secciones || []).map((s) => `## ${s.seccion}\n${s.items.join("\n")}`).join("\n\n");
function aSecciones(texto) {
  const secciones = [];
  for (const crudo of texto.split(/\r?\n/)) {
    const linea = crudo.trim();
    if (!linea) continue;
    if (linea.startsWith("##")) secciones.push({ seccion: linea.replace(/^#+\s*/, "").trim(), items: [] });
    else if (secciones.length === 0) throw new Error("Empieza con una línea «## Nombre de la sección» antes de los ítems.");
    else secciones[secciones.length - 1].items.push(linea);
  }
  const vacia = secciones.find((s) => !s.seccion || s.items.length === 0);
  if (secciones.length === 0 || vacia) throw new Error("Cada sección necesita un nombre y al menos un ítem.");
  return secciones;
}

// Plantillas de checklist de mantenimiento (Planes → Plantillas): secciones e ítems reutilizables. Un plan elige una plantilla y cada orden de ese plan
// copia sus ítems; cambiar la plantilla después no modifica las órdenes ya creadas.
export default function PlantillasChecklistModal({ onClose, onCambio }) {
  const [plantillas, setPlantillas] = useState([]);
  const [sel, setSel] = useState(null); // { uuid|null, nombre, descripcion, texto, estado }
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const puedeEditar = hasPermission("inventario.planes.editar") || hasPermission("inventario.planes.crear");

  async function cargar() {
    try {
      setPlantillas(await apiFetch("/inventarios/checklist-plantillas"));
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, []);

  const abrir = (p) => setSel({ uuid: p.uuid, nombre: p.nombre, descripcion: p.descripcion || "", texto: aTexto(p.secciones), estado: p.estado });
  const nueva = () => setSel({ uuid: null, nombre: "", descripcion: "", texto: "## Sección 1\nPrimer ítem\nSegundo ítem", estado: true });

  async function guardar() {
    setError("");
    if (sel.nombre.trim().length < 2) return setError("Escribe el nombre de la plantilla.");
    let secciones;
    try {
      secciones = aSecciones(sel.texto);
    } catch (err) {
      return setError(err.message);
    }
    setGuardando(true);
    try {
      const cuerpo = { nombre: sel.nombre.trim(), descripcion: sel.descripcion.trim() || null, estado: sel.estado, secciones };
      const r = sel.uuid ? await apiFetch(`/inventarios/checklist-plantillas/${sel.uuid}`, { method: "PUT", body: JSON.stringify(cuerpo) }) : await apiFetch("/inventarios/checklist-plantillas", { method: "POST", body: JSON.stringify(cuerpo) });
      await cargar();
      abrir(r);
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar la plantilla «${sel.nombre}»? Los planes que la usan quedan sin plantilla; las órdenes ya creadas conservan su checklist.`)) return;
    setError("");
    try {
      await apiFetch(`/inventarios/checklist-plantillas/${sel.uuid}`, { method: "DELETE" });
      setSel(null);
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <ModalShell title="Plantillas de checklist" onClose={onClose} size="xl">
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="fw-semibold small">Plantillas</span>
            {puedeEditar && (
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-1 d-inline-flex align-items-center gap-1" onClick={nueva}>
                <FiPlus /> Nueva
              </button>
            )}
          </div>
          <div className="border rounded-1">
            {plantillas.length === 0 && <div className="p-2 small text-secondary">Aún no hay plantillas.</div>}
            {plantillas.map((p) => (
              <button key={p.uuid} type="button" className={`btn btn-link text-start text-decoration-none d-block w-100 px-2 py-2 border-bottom rounded-0 small ${sel?.uuid === p.uuid ? "bg-light fw-semibold" : ""}`} onClick={() => abrir(p)}>
                {p.nombre}
                <div className="text-secondary fw-normal" style={{ fontSize: "0.72rem" }}>
                  {p.secciones.length} secciones · {p.totalItems} ítems · {p.planes} plan(es){p.estado ? "" : " · inactiva"}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="col-12 col-md-8">
          {!sel ? (
            <p className="small text-secondary">Elige una plantilla para verla o editarla, o crea una nueva. Una plantilla es la lista de ítems que se califican en cada mantenimiento.</p>
          ) : (
            <div>
              <div className="row g-2 mb-2">
                <div className="col-12 col-md-7">
                  <label className="form-label small fw-medium mb-1">Nombre</label>
                  <input className="form-control form-control-sm rounded-1" disabled={!puedeEditar} maxLength={150} value={sel.nombre} onChange={(e) => setSel({ ...sel, nombre: e.target.value })} />
                </div>
                <div className="col-12 col-md-5 d-flex align-items-end">
                  <div className="form-check">
                    <input type="checkbox" className="form-check-input" id="plantilla-activa" disabled={!puedeEditar} checked={sel.estado} onChange={(e) => setSel({ ...sel, estado: e.target.checked })} />
                    <label className="form-check-label small" htmlFor="plantilla-activa">
                      Activa
                    </label>
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label small fw-medium mb-1">Descripción (opcional)</label>
                  <input className="form-control form-control-sm rounded-1" disabled={!puedeEditar} maxLength={1000} value={sel.descripcion} onChange={(e) => setSel({ ...sel, descripcion: e.target.value })} />
                </div>
              </div>
              <label className="form-label small fw-medium mb-1">Secciones e ítems</label>
              <p className="form-text small mt-0 mb-1">
                Una línea que empieza con <code>##</code> abre una sección; cada línea siguiente es un ítem.
              </p>
              <textarea className="form-control form-control-sm rounded-1 font-monospace" rows={16} disabled={!puedeEditar} value={sel.texto} onChange={(e) => setSel({ ...sel, texto: e.target.value })} style={{ fontSize: "0.78rem" }} />
              {puedeEditar && (
                <div className="d-flex gap-2 mt-2">
                  <button type="button" className="btn btn-brand btn-sm rounded-1 d-inline-flex align-items-center gap-1" disabled={guardando} onClick={guardar}>
                    <FiCheck /> {guardando ? "Guardando..." : "Guardar"}
                  </button>
                  {sel.uuid && hasPermission("inventario.planes.eliminar") && (
                    <button type="button" className="btn btn-link btn-sm text-danger ms-auto d-inline-flex align-items-center gap-1" onClick={eliminar}>
                      <FiTrash2 /> Eliminar
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
