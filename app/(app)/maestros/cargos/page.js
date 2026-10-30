"use client";

import { useEffect, useMemo, useState } from "react";
import { FiEdit2, FiGitMerge, FiPlus, FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

const VACIO = { nombre: "", descripcion: "", estado: true };

const normalizar = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Maestros → Cargos: etiquetas de cargo que se asignan a usuarios y colaboradores (una por persona). Es el cargo que sale en las
// firmas de los documentos. Renombrar actualiza a todos los que lo tienen; para unificar cargos repetidos o mal escritos se
// elimina uno pasando sus personas a otro.
export default function CargosPage() {
  const [cargos, setCargos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({ texto: "", estado: "" });
  const [form, setForm] = useState(null); // null | { ...cargo } en edición o creación
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState("");
  const [fusion, setFusion] = useState(null); // { cargo, destino } al eliminar uno en uso

  async function cargar() {
    setCargando(true);
    try {
      setCargos(await apiFetch("/cargos"));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const visibles = useMemo(() => {
    const t = normalizar(filtros.texto);
    return cargos.filter(
      (c) =>
        (!t || normalizar(`${c.nombre} ${c.descripcion || ""}`).includes(t)) &&
        (!filtros.estado || (filtros.estado === "activos" ? c.estado : !c.estado)),
    );
  }, [cargos, filtros]);

  const personas = (c) => (c.usuarios || 0) + (c.colaboradores || 0);

  function abrir(c) {
    setFormError("");
    setForm(c ? { ...VACIO, ...c, descripcion: c.descripcion || "" } : { ...VACIO });
  }

  async function guardar(e) {
    e.preventDefault();
    setFormError("");
    const original = form.uuid ? cargos.find((c) => c.uuid === form.uuid) : null;
    if (original && original.nombre !== form.nombre.trim() && personas(original) > 0) {
      if (!confirm(`Al renombrar «${original.nombre}» se actualiza en ${personas(original)} persona(s) y en sus firmas. ¿Continuar?`)) return;
    }
    setGuardando(true);
    try {
      const body = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, estado: form.estado };
      await apiFetch(form.uuid ? `/cargos/${form.uuid}` : "/cargos", { method: form.uuid ? "PUT" : "POST", body: JSON.stringify(body) });
      setForm(null);
      cargar();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(c) {
    if (personas(c) > 0) {
      setFusion({ cargo: c, destino: "", error: "" });
      return;
    }
    if (!confirm(`¿Eliminar el cargo «${c.nombre}»?`)) return;
    try {
      await apiFetch(`/cargos/${c.uuid}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmarFusion() {
    try {
      await apiFetch(`/cargos/${fusion.cargo.uuid}?reemplazo=${fusion.destino}`, { method: "DELETE" });
      setFusion(null);
      cargar();
    } catch (err) {
      setFusion((f) => ({ ...f, error: err.message }));
    }
  }

  const hayFiltros = filtros.texto || filtros.estado;

  return (
    <RequirePermission code="menu.maestros.cargos">
      <div className="p-3 p-md-4">
        <div className="mb-4">
          <h1 className="fw-bold h4 mb-1">Cargos</h1>
          <p className="text-secondary mb-0">
            Etiquetas de cargo que se asignan a usuarios y colaboradores (una por persona). Es el cargo que aparece en las firmas de los
            documentos. Si renombras un cargo, se actualiza en todos los que lo tienen.
          </p>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md">
              <label className="form-label small fw-medium">Cargo</label>
              <input
                type="search"
                className="form-control form-control-sm rounded-3"
                placeholder="Nombre o descripción..."
                value={filtros.texto}
                onChange={(e) => setFiltros((f) => ({ ...f, texto: e.target.value }))}
              />
            </div>
            <div className="col-8 col-md-2">
              <label className="form-label small fw-medium">Estado</label>
              <select className="form-select form-select-sm rounded-3" value={filtros.estado} onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}>
                <option value="">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </div>
            <div className="col-4 col-md-auto small text-secondary text-nowrap">
              {hayFiltros && (
                <button type="button" className="btn btn-sm btn-link p-0" onClick={() => setFiltros({ texto: "", estado: "" })}>
                  Quitar filtros
                </button>
              )}
              <div>
                {visibles.length} de {cargos.length}
              </div>
            </div>
            {hasPermission("cargo.crear") && (
              <div className="col-12 col-md-auto">
                <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => abrir(null)}>
                  <FiPlus /> Nuevo cargo
                </button>
              </div>
            )}
          </div>
        </div>

        {cargando ? (
          <p className="text-secondary">Cargando...</p>
        ) : visibles.length === 0 ? (
          <p className="text-secondary">{cargos.length ? "Ningún cargo coincide con los filtros." : "Todavía no hay cargos."}</p>
        ) : (
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle small">
                <thead className="table-light">
                  <tr>
                    <th className="fw-medium">Cargo</th>
                    <th className="fw-medium">Descripción</th>
                    <th className="fw-medium text-center">Usuarios</th>
                    <th className="fw-medium text-center">Colaboradores</th>
                    <th className="fw-medium text-center">Estado</th>
                    {(hasPermission("cargo.editar") || hasPermission("cargo.eliminar")) && <th className="fw-medium text-center">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((c) => (
                    <tr key={c.uuid}>
                      <td className="fw-semibold">{c.nombre}</td>
                      <td className="text-secondary">{c.descripcion || "—"}</td>
                      <td className="text-center">{c.usuarios || <span className="text-secondary">0</span>}</td>
                      <td className="text-center">{c.colaboradores || <span className="text-secondary">0</span>}</td>
                      <td className="text-center">
                        {c.estado ? (
                          <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                            Activo
                          </span>
                        ) : (
                          <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                        )}
                      </td>
                      {(hasPermission("cargo.editar") || hasPermission("cargo.eliminar")) && (
                        <td className="text-center text-nowrap">
                          {hasPermission("cargo.editar") && (
                            <button type="button" className="btn btn-sm btn-link p-1 text-secondary" title="Editar" onClick={() => abrir(c)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("cargo.eliminar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1"
                              style={{ color: personas(c) ? "#b45309" : "#dc2626" }}
                              title={personas(c) ? `Unificar: pasar sus ${personas(c)} persona(s) a otro cargo y eliminarlo` : "Eliminar"}
                              onClick={() => eliminar(c)}
                            >
                              {personas(c) ? <FiGitMerge /> : <FiTrash2 />}
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
          <ModalShell title={form.uuid ? "Editar cargo" : "Nuevo cargo"} onClose={() => setForm(null)} height="auto">
            <form onSubmit={guardar}>
              <label className="form-label small fw-medium">Nombre del cargo</label>
              <input
                className="form-control form-control-sm rounded-3 mb-1"
                required
                minLength={2}
                maxLength={150}
                autoFocus
                placeholder="Ej. Administrador de finca"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
              <div className="form-text small mb-3">Así sale en las firmas de los documentos.</div>
              <label className="form-label small fw-medium">Descripción (opcional)</label>
              <input
                className="form-control form-control-sm rounded-3 mb-3"
                maxLength={300}
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
              <div className="form-check mb-3">
                <input type="checkbox" className="form-check-input" id="cargo-activo" checked={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))} />
                <label className="form-check-label small" htmlFor="cargo-activo">
                  Activo (se puede elegir al asignar). Quienes ya lo tienen lo conservan aunque esté inactivo.
                </label>
              </div>
              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={() => setForm(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}

        {fusion && (
          <ModalShell title={`Unificar «${fusion.cargo.nombre}»`} onClose={() => setFusion(null)} height="auto">
            <p className="small text-secondary">
              «{fusion.cargo.nombre}» lo tienen {fusion.cargo.usuarios} usuario(s) y {fusion.cargo.colaboradores} colaborador(es). Elige a qué cargo
              pasan; después «{fusion.cargo.nombre}» se elimina. Úsalo para unificar cargos repetidos o mal escritos.
            </p>
            <label className="form-label small fw-medium">Pasar sus personas a</label>
            <select className="form-select form-select-sm rounded-3 mb-3" value={fusion.destino} onChange={(e) => setFusion((f) => ({ ...f, destino: e.target.value }))}>
              <option value="">Selecciona un cargo...</option>
              {cargos
                .filter((c) => c.uuid !== fusion.cargo.uuid && c.estado)
                .map((c) => (
                  <option key={c.uuid} value={c.uuid}>
                    {c.nombre}
                  </option>
                ))}
            </select>
            {fusion.error && <div className="alert alert-danger py-2 small">{fusion.error}</div>}
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={() => setFusion(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-sm btn-warning rounded-3" disabled={!fusion.destino} onClick={confirmarFusion}>
                Pasar y eliminar
              </button>
            </div>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
