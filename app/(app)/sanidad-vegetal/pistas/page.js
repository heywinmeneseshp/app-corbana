"use client";

import { useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

const VACIA = { nombre: "", responsable: "", telefono: "", correos: [], observaciones: "", estado: true };
const esCorreo = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);
const normalizar = (t) =>
  String(t || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// Pistas de aviación (de dónde sale la aspersión aérea). Al enviar el aviso de una aspersión que sale de una pista, sus correos
// reciben el aviso de la pista (el mismo aviso, con la pista y las hectáreas a asperjar).
export default function PistasPage() {
  const [pistas, setPistas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null | { ...VACIA, uuid? }
  const [correoNuevo, setCorreoNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState("");
  const [filtros, setFiltros] = useState({ nombre: "", correo: "", estado: "" }); // estado: "" | "activas" | "inactivas"

  const cargar = () =>
    apiFetch("/pistas")
      .then(setPistas)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));

  useEffect(() => {
    cargar();
  }, []);

  const abrir = (p) => {
    setForm(p ? { ...VACIA, ...p, responsable: p.responsable || "", telefono: p.telefono || "", observaciones: p.observaciones || "" } : VACIA);
    setCorreoNuevo("");
    setFormError("");
  };

  // Agrega uno o varios correos (separados por coma, punto y coma o espacio).
  function agregarCorreos() {
    const nuevos = correoNuevo
      .split(/[\s,;]+/)
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    const malos = nuevos.filter((c) => !esCorreo(c));
    if (malos.length) {
      setFormError(`Correo no válido: ${malos.join(", ")}`);
      return;
    }
    setFormError("");
    setForm((f) => ({ ...f, correos: [...new Set([...f.correos, ...nuevos])] }));
    setCorreoNuevo("");
  }

  async function guardar(e) {
    e.preventDefault();
    // Un correo escrito y no agregado todavía también cuenta.
    const pendientes = correoNuevo.split(/[\s,;]+/).map((c) => c.trim().toLowerCase()).filter(Boolean);
    if (pendientes.some((c) => !esCorreo(c))) {
      setFormError("Revisa el correo escrito: no es válido.");
      return;
    }
    const correos = [...new Set([...form.correos, ...pendientes])];
    setGuardando(true);
    setFormError("");
    try {
      const body = {
        nombre: form.nombre,
        responsable: form.responsable.trim() || null,
        telefono: form.telefono.trim() || null,
        correos,
        observaciones: form.observaciones || null,
        estado: form.estado,
      };
      await apiFetch(form.uuid ? `/pistas/${form.uuid}` : "/pistas", { method: form.uuid ? "PUT" : "POST", body: JSON.stringify(body) });
      setForm(null);
      await cargar();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const fNombre = normalizar(filtros.nombre.trim());
  const fCorreo = normalizar(filtros.correo.trim());
  const visibles = pistas.filter(
    (p) =>
      (!fNombre || normalizar(`${p.nombre} ${p.responsable || ""}`).includes(fNombre)) &&
      (!fCorreo || p.correos.some((c) => normalizar(c).includes(fCorreo))) &&
      (!filtros.estado || (filtros.estado === "activas" ? p.estado : !p.estado)),
  );
  const hayFiltros = Boolean(filtros.nombre || filtros.correo || filtros.estado);

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar la pista «${p.nombre}»? Las aspersiones que ya salieron de ella la conservan. Si solo no se va a usar más, mejor desactívala.`)) return;
    try {
      await apiFetch(`/pistas/${p.uuid}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.sanidad_vegetal.pistas">
      <div className="p-3 p-md-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
          <div>
            <h1 className="fw-bold h4 mb-1">Pistas</h1>
            <p className="text-secondary mb-0">
              Pistas de aviación desde donde sale la aspersión aérea. Sus correos reciben el aviso de aspersión de la pista (con la pista y las hectáreas a
              asperjar) cuando se envía el aviso de la finca.
            </p>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md">
              <label className="form-label small fw-medium">Pista</label>
              <input
                type="search"
                className="form-control form-control-sm rounded-3"
                placeholder="Nombre o responsable..."
                value={filtros.nombre}
                onChange={(e) => setFiltros((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="col-12 col-md">
              <label className="form-label small fw-medium">Correo</label>
              <input
                type="search"
                className="form-control form-control-sm rounded-3"
                placeholder="Buscar por correo..."
                value={filtros.correo}
                onChange={(e) => setFiltros((f) => ({ ...f, correo: e.target.value }))}
              />
            </div>
            <div className="col-8 col-md-2">
              <label className="form-label small fw-medium">Estado</label>
              <select className="form-select form-select-sm rounded-3" value={filtros.estado} onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}>
                <option value="">Todas</option>
                <option value="activas">Activas</option>
                <option value="inactivas">Inactivas</option>
              </select>
            </div>
            <div className="col-4 col-md-auto small text-secondary text-nowrap">
              {hayFiltros && (
                <button type="button" className="btn btn-sm btn-link p-0" onClick={() => setFiltros({ nombre: "", correo: "", estado: "" })}>
                  Quitar filtros
                </button>
              )}
              <div>
                {visibles.length} de {pistas.length}
              </div>
            </div>
            {hasPermission("pista.crear") && (
              <div className="col-12 col-md-auto">
                <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => abrir(null)}>
                  <FiPlus /> Nueva pista
                </button>
              </div>
            )}
          </div>
        </div>

        {cargando ? (
          <p className="text-secondary">Cargando...</p>
        ) : pistas.length === 0 ? (
          <p className="text-secondary">Aún no hay pistas.</p>
        ) : visibles.length === 0 ? (
          <p className="text-secondary">Ninguna pista coincide con los filtros.</p>
        ) : (
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle" style={{ fontSize: "0.82rem" }}>
                <thead className="table-light">
                  <tr>
                    <th className="fw-medium">Pista</th>
                    <th className="fw-medium">Responsable</th>
                    <th className="fw-medium">Correos del aviso</th>
                    <th className="fw-medium">Observaciones</th>
                    <th className="fw-medium text-center">Estado</th>
                    {(hasPermission("pista.editar") || hasPermission("pista.eliminar")) && <th className="fw-medium text-center">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((p) => (
                    <tr key={p.uuid} className={p.estado ? "" : "text-secondary"}>
                      <td className="fw-semibold">{p.nombre}</td>
                      <td>
                        {p.responsable ? (
                          <>
                            <div>{p.responsable}</div>
                            {p.telefono && <div className="text-secondary small">{p.telefono}</div>}
                          </>
                        ) : (
                          <span className="text-warning small">Sin responsable: el aviso sale firmado con el nombre de la pista</span>
                        )}
                      </td>
                      <td>
                        {p.correos.length ? (
                          <div className="d-flex flex-wrap gap-1">
                            {p.correos.map((c) => {
                              const coincide = fCorreo && normalizar(c).includes(fCorreo);
                              return (
                                <span
                                  key={c}
                                  className="badge rounded-pill border fw-normal"
                                  style={coincide ? { backgroundColor: "#fef3c7", color: "#92400e" } : { backgroundColor: "#f8fafc", color: "#334155" }}
                                >
                                  {c}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-warning">Sin correos: no se le enviará aviso</span>
                        )}
                      </td>
                      <td className="text-secondary">{p.observaciones || "—"}</td>
                      <td className="text-center">
                        <span className="badge rounded-pill" style={p.estado ? { backgroundColor: "#d1fae5", color: "#047857" } : { backgroundColor: "#f1f5f9", color: "#64748b" }}>
                          {p.estado ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      {(hasPermission("pista.editar") || hasPermission("pista.eliminar")) && (
                        <td className="text-center text-nowrap">
                          {hasPermission("pista.editar") && (
                            <button type="button" className="btn btn-sm btn-link p-1 text-secondary" title="Editar" onClick={() => abrir(p)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("pista.eliminar") && (
                            <button type="button" className="btn btn-sm btn-link p-1" style={{ color: "#dc2626" }} title="Eliminar" onClick={() => eliminar(p)}>
                              <FiTrash2 />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {form && (
          <ModalShell title={form.uuid ? "Editar pista" : "Nueva pista"} onClose={() => setForm(null)} size="lg" height="auto">
            <form onSubmit={guardar} className="row g-3">
              <div className="col-md-8">
                <label className="form-label small fw-medium">Nombre de la pista</label>
                <input className="form-control form-control-sm rounded-3" required minLength={2} maxLength={120} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="col-md-4 d-flex align-items-end">
                <div className="form-check mb-1">
                  <input type="checkbox" className="form-check-input" id="pista-activa" checked={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))} />
                  <label className="form-check-label small" htmlFor="pista-activa">
                    Activa (se puede elegir al programar)
                  </label>
                </div>
              </div>
              <div className="col-md-8">
                <label className="form-label small fw-medium">Responsable / representante de la pista</label>
                <input
                  className="form-control form-control-sm rounded-3"
                  maxLength={150}
                  placeholder="Nombre de quien firma el aviso de la pista"
                  value={form.responsable}
                  onChange={(e) => setForm((f) => ({ ...f, responsable: e.target.value }))}
                />
                <div className="form-text small">Firma el aviso de aspersión de la pista como «Representante de pista».</div>
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-medium">Teléfono</label>
                <input
                  type="tel"
                  className="form-control form-control-sm rounded-3"
                  maxLength={40}
                  placeholder="Ej. 300 123 4567"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label small fw-medium">Correos que reciben el aviso</label>
                <div className="d-flex gap-2">
                  <input
                    className="form-control form-control-sm rounded-3"
                    placeholder="correo@ejemplo.com (puedes pegar varios separados por coma)"
                    value={correoNuevo}
                    onChange={(e) => setCorreoNuevo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        agregarCorreos();
                      }
                    }}
                  />
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 text-nowrap" onClick={agregarCorreos} disabled={!correoNuevo.trim()}>
                    <FiPlus /> Agregar
                  </button>
                </div>
                <div className="d-flex flex-wrap gap-1 mt-2">
                  {form.correos.length === 0 && <span className="small text-secondary">Sin correos todavía.</span>}
                  {form.correos.map((c) => (
                    <span key={c} className="badge rounded-pill text-bg-light border fw-normal d-inline-flex align-items-center gap-1">
                      {c}
                      <button type="button" className="btn btn-link p-0 text-secondary" style={{ lineHeight: 1 }} title="Quitar" onClick={() => setForm((f) => ({ ...f, correos: f.correos.filter((x) => x !== c) }))}>
                        <FiX size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="col-12">
                <label className="form-label small fw-medium">Observaciones (opcional)</label>
                <input className="form-control form-control-sm rounded-3" maxLength={300} value={form.observaciones} onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))} />
              </div>
              {formError && <div className="col-12 alert alert-danger py-2 small mb-0">{formError}</div>}
              <div className="col-12 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setForm(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={guardando}>
                  {guardando ? "Guardando..." : form.uuid ? "Guardar cambios" : "Crear pista"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
