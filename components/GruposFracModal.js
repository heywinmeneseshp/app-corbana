"use client";

import { useEffect, useState } from "react";
import { FiTrash2, FiEdit2, FiCheck, FiX, FiPlus } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import ModalShell from "@/components/ModalShell";

// Catálogo de clasificación FRAC en UNA sola lista: cada fila es un grupo químico con su código FRAC y el modo
// de acción de ese código. El ingrediente activo elige su grupo químico; de ahí salen el código y el modo de
// acción. Las reglas de uso por código se configuran en "Límites FRAC".
const lista = (r) => (Array.isArray(r) ? r : r?.data || []);
const NUEVO_CODIGO = "__nuevo__";

export default function GruposFracModal({ onClose, onCambio, embebido = false }) {
  const [codigos, setCodigos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] = useState(null); // { uuid?, nombre, fracCodigo, codigoNuevo, modoAccion }
  const puedeCrear = hasPermission("ingrediente_activo.crear");
  const puedeEditar = hasPermission("ingrediente_activo.editar");
  const puedeEliminar = hasPermission("ingrediente_activo.eliminar");

  const traer = () => Promise.all([apiFetch("/frac-limites"), apiFetch("/frac-limites/grupos")]);
  const aplicar = ([c, g]) => {
    setCodigos(lista(c));
    setGrupos(lista(g));
  };

  useEffect(() => {
    traer()
      .then(aplicar)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const modoDe = (codigo) => codigos.find((c) => c.fracCodigo === codigo)?.modoAccion || "";

  async function guardar() {
    setError("");
    try {
      let codigo = form.fracCodigo;
      if (codigo === NUEVO_CODIGO) {
        codigo = form.codigoNuevo.trim().toUpperCase();
        if (!codigo) throw new Error("Escribe el nuevo código FRAC");
        await apiFetch("/frac-limites", { method: "POST", body: JSON.stringify({ codigo, modoAccion: form.modoAccion }) });
      } else if (form.modoAccion.trim() !== modoDe(codigo)) {
        // Se editó el modo de acción de un código existente.
        await apiFetch(`/frac-limites/${encodeURIComponent(codigo)}`, { method: "PUT", body: JSON.stringify({ modoAccion: form.modoAccion }) });
      }
      const body = JSON.stringify({ nombre: form.nombre, fracCodigo: codigo });
      if (form.uuid) await apiFetch(`/frac-limites/grupos/${form.uuid}`, { method: "PUT", body });
      else await apiFetch("/frac-limites/grupos", { method: "POST", body });
      setForm(null);
      aplicar(await traer());
      onCambio?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(g) {
    if (!confirm(`¿Eliminar el grupo "${g.nombre}"?`)) return;
    setError("");
    try {
      await apiFetch(`/frac-limites/grupos/${g.uuid}`, { method: "DELETE" });
      aplicar(await traer());
      onCambio?.();
    } catch (err) {
      setError(err.message);
    }
  }

  function abrirNuevo() {
    setForm({ nombre: "", fracCodigo: codigos[0]?.fracCodigo || NUEVO_CODIGO, codigoNuevo: "", modoAccion: codigos[0]?.modoAccion || "" });
  }

  function abrirEditar(g) {
    setForm({ uuid: g.uuid, nombre: g.nombre, fracCodigo: g.fracCodigo, codigoNuevo: "", modoAccion: g.modoAccion || "" });
  }

  function cambiarCodigo(valor) {
    setForm((f) => ({ ...f, fracCodigo: valor, modoAccion: valor === NUEVO_CODIGO ? "" : modoDe(valor) }));
  }

  const esNuevoCodigo = form?.fracCodigo === NUEVO_CODIGO;
  const q = busqueda.trim().toLowerCase();
  const gruposFiltrados = q
    ? grupos.filter((g) => [g.fracCodigo, g.nombre, g.modoAccion].some((v) => String(v || "").toLowerCase().includes(q)))
    : grupos;

  const contenido = (
    <>
      <p className="small text-secondary mb-3">
        Cada ingrediente activo pertenece a un <strong>grupo químico</strong>, y cada grupo a un <strong>código FRAC</strong> (que define su
        modo de acción). Aquí administras esa lista.
      </p>
      {error && <div className="small text-danger mb-2">{error}</div>}

      {form && (
        <ModalShell title={form.uuid ? "Editar grupo químico" : "Nuevo grupo químico"} onClose={() => setForm(null)} width="40rem" height="auto">
        <div>
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small text-secondary mb-1">Grupo químico</label>
              <input
                className="form-control form-control-sm"
                placeholder="Ej. Triazoles"
                maxLength={150}
                autoFocus
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small text-secondary mb-1">Código FRAC</label>
              <select className="form-select form-select-sm" value={form.fracCodigo} onChange={(e) => cambiarCodigo(e.target.value)}>
                {codigos.map((c) => (
                  <option key={c.fracCodigo} value={c.fracCodigo}>
                    {c.fracCodigo}
                  </option>
                ))}
                <option value={NUEVO_CODIGO}>+ Otro código…</option>
              </select>
            </div>
            {esNuevoCodigo && (
              <div className="col-6 col-md-2">
                <label className="form-label small text-secondary mb-1">Nuevo código</label>
                <input
                  className="form-control form-control-sm"
                  placeholder="Ej. 4"
                  maxLength={10}
                  value={form.codigoNuevo}
                  onChange={(e) => setForm((f) => ({ ...f, codigoNuevo: e.target.value }))}
                />
              </div>
            )}
            <div className={esNuevoCodigo ? "col-12 col-md-4" : "col-12 col-md-6"}>
              <label className="form-label small text-secondary mb-1">Modo de acción del código</label>
              <input
                className="form-control form-control-sm"
                placeholder="Ej. Inhibidores de la desmetilación C14"
                maxLength={255}
                disabled={!puedeEditar && !esNuevoCodigo}
                value={form.modoAccion}
                onChange={(e) => setForm((f) => ({ ...f, modoAccion: e.target.value }))}
              />
            </div>
          </div>
          {!esNuevoCodigo && <div className="small text-secondary mt-1">Cambiar el modo de acción lo cambia para todos los grupos de ese código.</div>}
          <div className="d-flex justify-content-end gap-3 mt-3">
            <button
              type="button"
              className="btn btn-brand btn-brand-verde btn-sm rounded-3 d-inline-flex align-items-center gap-1"
              disabled={!form.nombre.trim() || (esNuevoCodigo && !form.codigoNuevo.trim())}
              onClick={guardar}
            >
              <FiCheck size={15} /> Guardar
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1" onClick={() => setForm(null)}>
              <FiX size={15} /> Cancelar
            </button>
          </div>
        </div>
        </ModalShell>
      )}

      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-6">
            <label className="form-label small fw-medium">Buscar por código, grupo o modo de acción</label>
            <input type="text" className="form-control form-control-sm rounded-3" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          {puedeCrear && (
            <div className="col-12 col-md-auto ms-md-auto">
              <button type="button" className="btn btn-brand btn-brand-verde btn-sm rounded-3 d-inline-flex align-items-center gap-1" onClick={abrirNuevo}>
                <FiPlus size={15} /> Nuevo grupo químico
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-secondary">Cargando...</p>
      ) : (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <table className="table table-hover mb-0 align-middle" style={{ fontSize: "0.78rem" }}>
            <thead className="table-light">
              <tr>
                <th className="fw-medium text-center" style={{ width: "1%" }}>
                  FRAC
                </th>
                <th className="fw-medium text-start">Grupo químico</th>
                <th className="fw-medium text-start">Modo de acción</th>
                <th className="fw-medium text-center" style={{ width: "1%" }} title="Ingredientes activos que usan este grupo">
                  Ingredientes
                </th>
                <th className="fw-medium text-center" style={{ width: "1%" }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {gruposFiltrados.map((g) => (
                <tr key={g.uuid}>
                  <td className="text-center">
                    <span className="badge bg-success-subtle text-success-emphasis border border-success-subtle">{g.fracCodigo}</span>
                  </td>
                  <td className="fw-medium">{g.nombre}</td>
                  <td className="text-secondary">{g.modoAccion || "—"}</td>
                  <td className="text-center">{g.ingredientes}</td>
                  <td className="text-center text-nowrap">
                    {puedeEditar && (
                      <button type="button" className="btn btn-sm btn-link p-1 text-secondary" title="Editar" onClick={() => abrirEditar(g)}>
                        <FiEdit2 size={15} />
                      </button>
                    )}
                    {puedeEliminar && g.ingredientes === 0 && (
                      <button type="button" className="btn btn-sm btn-link p-1" style={{ color: "#dc2626" }} title="Eliminar (ningún ingrediente lo usa)" onClick={() => eliminar(g)}>
                        <FiTrash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
  return embebido ? contenido : (
    <ModalShell title="Grupos FRAC" onClose={onClose} width="64rem">
      {contenido}
    </ModalShell>
  );
}
