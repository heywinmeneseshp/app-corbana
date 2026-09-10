"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiPlus, FiTrash2, FiChevronLeft, FiChevronRight, FiClock, FiEye, FiAlertTriangle } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import { esAdministrador } from "@/lib/laborEstados";
import { estadoPruebaInfo } from "@/lib/mezclaEstados";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

// Mezclas ahora es el módulo de PRUEBAS DE LABORATORIO: cada "Mezcla" es una
// prueba, y su primera/única versión (versiones[0]) lleva todo el trabajo
// de laboratorio (componentes, etapas de medición, fotos, resultado) — ver
// [uuid]/page.js. Al crearla solo se pide el almacén de origen (lo único
// que realmente hace falta para empezar a registrar componentes) — el
// código lo asigna el sistema (correlativo) y el nombre + el artículo
// elaborado (producto objetivo) se asignan más adelante, desde la sección
// "Información general" del detalle, antes de finalizar la prueba.
function emptyForm() {
  return { almacenUuid: "" };
}

export default function MezclasPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "100", ...(search ? { search } : {}) });
      const { items: rows, meta: m } = await apiFetch(`/inventarios/mezclas?${qs}`);
      setItems(rows);
      setMeta(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCombos() {
    try {
      const alms = await apiFetch("/inventarios/almacenes?limit=100&estado=true");
      setAlmacenes(alms.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadCombos();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleSearchSubmit() {
    if (page === 1) load();
    else setPage(1);
  }

  function openCreate() {
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const resultado = await apiFetch("/inventarios/mezclas", {
        method: "POST",
        body: JSON.stringify({ almacenUuid: form.almacenUuid, componentes: [] }),
      });
      setModalOpen(false);
      router.push(`/inventarios/mezclas/${resultado.uuid}`);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mezcla) {
    if (!confirm(`¿Eliminar la prueba "${mezcla.nombre || mezcla.codigo}"?`)) return;
    try {
      await apiFetch(`/inventarios/mezclas/${mezcla.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.inventarios.mezclas">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Mezclas — Pruebas de laboratorio</h1>
            <p className="text-secondary mb-0">
              Registra componentes, mide pH y CE por etapa, y determina si una combinación queda válida para
              convertirse en un elaborado.
            </p>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary rounded-3 d-flex align-items-center gap-2"
              onClick={() => router.push("/inventarios/mezclas/historial")}
            >
              <FiClock /> Historial
            </button>
            {hasPermission("inventario.mezclas.crear") && (
              <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
                <FiPlus /> Nueva prueba
              </button>
            )}
          </div>
        </div>

        <div className="mb-3">
          <input
            type="text"
            className="form-control rounded-3"
            style={{ maxWidth: 320 }}
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
          />
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead>
                <tr className="table-light small text-secondary" style={{ borderBottom: "1px solid #e9ecef" }}>
                  <th className="fw-medium text-center">Código</th>
                  <th className="fw-medium text-center">Nombre</th>
                  <th className="fw-medium text-center">Artículo elaborado</th>
                  <th className="fw-medium text-center">Estado</th>
                  <th className="fw-medium text-center">Operador</th>
                  <th className="fw-medium text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-3 small">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-3 small">
                      No hay pruebas de mezcla registradas todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((m) => {
                    const v = (m.versiones || [])[0];
                    const info = estadoPruebaInfo(v?.estadoPrueba);
                    const optimaSinElaborar = v?.estadoPrueba === "OPTIMA" && !m.articuloElaborado;
                    return (
                      <tr key={m.uuid} style={{ cursor: "pointer" }} onClick={() => router.push(`/inventarios/mezclas/${m.uuid}`)}>
                        <td className="small text-secondary text-center">{m.codigo || "—"}</td>
                        <td className="small fw-medium text-center">
                          {m.nombre || <span className="text-secondary fst-italic">Sin nombre asignado</span>}
                        </td>
                        <td className="small text-secondary text-center">
                          {m.articuloElaborado?.nombre ? (
                            m.articuloElaborado.nombre
                          ) : v?.estadoPrueba === "NO_VALIDA" ? (
                            // No válida: nunca va a generar un elaborado — mostrar
                            // "Sin asignar" acá sería ruido, no una tarea pendiente.
                            "—"
                          ) : (
                            <span className={optimaSinElaborar ? "text-warning fw-medium d-inline-flex align-items-center gap-1" : "fst-italic"}>
                              {optimaSinElaborar && (
                                <FiAlertTriangle size={13} title="Prueba óptima sin artículo elaborado — usa 'Crear elaborado'" />
                              )}
                              Sin asignar
                            </span>
                          )}
                        </td>
                        <td className="small text-center">
                          <span className="badge rounded-pill small" style={{ backgroundColor: info.bg, color: info.color }}>
                            {info.label}
                          </span>
                        </td>
                        <td className="small text-secondary text-center">
                          {v?.operador ? v.operador.nombre || v.operador.usuario : "—"}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="d-flex justify-content-center gap-1 flex-nowrap">
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                              title="Ver / continuar prueba"
                              onClick={() => router.push(`/inventarios/mezclas/${m.uuid}`)}
                            >
                              <FiEye size={15} />
                            </button>
                            {esAdministrador() && (
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-1 d-inline-flex"
                                style={{ color: "#dc2626" }}
                                title="Eliminar (solo Administrador)"
                                onClick={() => handleDelete(m)}
                              >
                                <FiTrash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3">
          <span className="small text-secondary">
            Mostrando página {meta.page} de {meta.totalPages} ({meta.total} prueba(s))
          </span>
          {meta.totalPages > 1 && (
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <FiChevronLeft /> Anterior
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              >
                Siguiente <FiChevronRight />
              </button>
            </div>
          )}
        </div>

        {modalOpen && (
          <ModalShell title="Nueva prueba de mezcla" onClose={() => setModalOpen(false)}>
            <form onSubmit={handleCreate}>
              <div className="mb-3">
                <label className="form-label small fw-medium">
                  Almacén de origen <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select rounded-3"
                  required
                  value={form.almacenUuid}
                  onChange={(e) => setForm((f) => ({ ...f, almacenUuid: e.target.value }))}
                >
                  <option value="">Selecciona...</option>
                  {almacenes.map((a) => (
                    <option key={a.uuid} value={a.uuid}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
                <p className="form-text small mb-0">
                  De acá se van a descontar los insumos usados en la prueba al finalizarla.
                </p>
              </div>

              <p className="form-text small text-secondary mb-3">
                El código lo asigna el sistema automáticamente (MEZ-0001, MEZ-0002...). El nombre y el artículo
                elaborado (producto objetivo) se asignan más adelante, desde la pantalla de la prueba.
              </p>

              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand rounded-3" disabled={saving}>
                  {saving ? "Creando..." : "Crear y continuar"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
