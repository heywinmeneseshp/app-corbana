"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiTarget, FiSave, FiX } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import TagPicker from "@/components/TagPicker";

const CONTEO_HOJAS_NOMBRE = "Conteo de Hojas";

function emptyDatosForm() {
  return { tipoEvaluacionUuid: "", cantidad: "", edadMinima: "", edadMaxima: "", estado: true };
}

export default function ObjetivosEvaluacionPage() {
  const [items, setItems] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creando, setCreando] = useState(false);
  const [editModal, setEditModal] = useState(null); // null | objetivo

  async function loadObjetivos() {
    setLoading(true);
    setError("");
    try {
      const { items: rows } = await apiFetch("/evaluaciones/objetivos?limit=100");
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalogos() {
    try {
      const [{ items: tiposRows }, { items: fincasRows }] = await Promise.all([
        apiFetch("/tipos-evaluacion?limit=100"),
        apiFetch("/fincas?limit=100"),
      ]);
      setTipos(tiposRows);
      setFincas(fincasRows);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadObjetivos();
    loadCatalogos();
  }, []);

  async function handleDelete(objetivo) {
    if (!confirm("¿Eliminar este objetivo?")) return;
    try {
      await apiFetch(`/evaluaciones/objetivos/${objetivo.uuid}`, { method: "DELETE" });
      loadObjetivos();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.sanidad_vegetal.objetivos">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-medium h4 mb-1">Objetivos de Evaluación</h1>
            <p className="text-secondary small mb-0">
              Meta semanal de cantidad de evaluaciones por finca o lote. Para Conteo de Hojas, además se define un
              rango de edad de la planta (semanas desde su embolse) — la cantidad se exige por cada edad del
              rango, no como un total combinado.
            </p>
          </div>
          {hasPermission("objetivo_evaluacion.crear") && (
            <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={() => setCreando(true)}>
              <FiPlus size={15} /> Nuevo objetivo
            </button>
          )}
        </div>

        {error && <div className="alert alert-danger py-2 small border-0 rounded-3">{error}</div>}

        <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead>
                <tr className="small text-secondary" style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <th className="fw-medium">Tipo</th>
                  <th className="fw-medium">Ámbito</th>
                  <th className="fw-medium">Edad</th>
                  <th className="fw-medium text-center">Cantidad/semana</th>
                  <th className="fw-medium text-center">Acciones</th>
                  <th className="fw-medium text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-4">
                      No hay objetivos configurados todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((o) => (
                    <tr key={o.uuid}>
                      <td className="fw-medium">{o.tipoEvaluacion?.nombre}</td>
                      <td className="small text-secondary">
                        {o.finca ? `Finca: ${o.finca.nombre}` : `Lote: ${o.lote?.nombre} (${o.lote?.finca?.nombre ?? "—"})`}
                      </td>
                      <td className="small text-secondary">
                        {o.edadMinima != null && o.edadMaxima != null
                          ? `${o.edadMinima} a ${o.edadMaxima} sem. (c/u)`
                          : o.edadMinima != null || o.edadMaxima != null
                            ? `${o.edadMinima ?? "…"} a ${o.edadMaxima ?? "…"} semanas`
                            : "—"}
                      </td>
                      <td className="text-center">
                        <span className="d-inline-flex align-items-center gap-1">
                          <FiTarget size={13} className="text-secondary" /> {o.cantidad}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-1 flex-nowrap">
                          {hasPermission("objetivo_evaluacion.editar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                              title="Editar"
                              onClick={() => setEditModal(o)}
                            >
                              <FiEdit2 size={15} />
                            </button>
                          )}
                          {hasPermission("objetivo_evaluacion.eliminar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex"
                              style={{ color: "#dc2626" }}
                              title="Eliminar"
                              onClick={() => handleDelete(o)}
                            >
                              <FiTrash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="text-center">
                        <span className="d-inline-flex align-items-center gap-1 small text-secondary">
                          <span
                            className="rounded-circle d-inline-block"
                            style={{ width: 6, height: 6, background: o.estado ? "#16a34a" : "#cbd5e1" }}
                          />
                          {o.estado ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {creando && (
          <CrearObjetivosModal
            tipos={tipos}
            fincas={fincas}
            onClose={() => setCreando(false)}
            onCreado={() => {
              setCreando(false);
              loadObjetivos();
            }}
          />
        )}

        {editModal && (
          <EditarObjetivoModal
            objetivo={editModal}
            tipos={tipos}
            onClose={() => setEditModal(null)}
            onGuardado={() => {
              setEditModal(null);
              loadObjetivos();
            }}
          />
        )}
      </div>
    </RequirePermission>
  );
}

// ─── Modal: crear objetivos en lote — se eligen varias fincas de una vez,
// luego si el objetivo es "toda la finca" (un objetivo por finca) o "por
// cada lote" (eligiendo qué lotes de cada finca) ───
function CrearObjetivosModal({ tipos, fincas, onClose, onCreado }) {
  const [datos, setDatos] = useState(emptyDatosForm());
  const [fincasSeleccionadas, setFincasSeleccionadas] = useState([]);
  const [modo, setModo] = useState("finca"); // 'finca' | 'lote'
  const [lotesPorFinca, setLotesPorFinca] = useState({}); // fincaUuid -> lote[]
  const [cargandoLotes, setCargandoLotes] = useState(new Set());
  const [lotesElegidos, setLotesElegidos] = useState({}); // fincaUuid -> Set(loteUuid)
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fincaItems = fincas.map((f) => ({ uuid: f.uuid, label: f.nombre, sublabel: f.codigo }));
  const tipoSeleccionado = tipos.find((t) => t.uuid === datos.tipoEvaluacionUuid);
  const esConteoHojas = tipoSeleccionado?.nombre === CONTEO_HOJAS_NOMBRE;

  useEffect(() => {
    if (modo !== "lote") return;
    fincasSeleccionadas.forEach((f) => {
      if (lotesPorFinca[f.uuid] || cargandoLotes.has(f.uuid)) return;
      setCargandoLotes((prev) => new Set(prev).add(f.uuid));
      apiFetch(`/lotes?fincaUuid=${f.uuid}&limit=100`)
        .then(({ items: rows }) => setLotesPorFinca((prev) => ({ ...prev, [f.uuid]: rows })))
        .catch((err) => setFormError(err.message))
        .finally(() =>
          setCargandoLotes((prev) => {
            const next = new Set(prev);
            next.delete(f.uuid);
            return next;
          }),
        );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, fincasSeleccionadas]);

  function toggleLote(fincaUuid, loteUuid) {
    setLotesElegidos((prev) => {
      const set = new Set(prev[fincaUuid] || []);
      if (set.has(loteUuid)) set.delete(loteUuid);
      else set.add(loteUuid);
      return { ...prev, [fincaUuid]: set };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (fincasSeleccionadas.length === 0) {
      setFormError("Agrega al menos una finca");
      return;
    }

    let targets = [];
    if (modo === "finca") {
      targets = fincasSeleccionadas.map((f) => ({ fincaUuid: f.uuid }));
    } else {
      fincasSeleccionadas.forEach((f) => {
        const elegidos = lotesElegidos[f.uuid];
        if (elegidos) elegidos.forEach((loteUuid) => targets.push({ loteUuid }));
      });
      if (targets.length === 0) {
        setFormError("Selecciona al menos un lote de las fincas elegidas");
        return;
      }
    }

    setSaving(true);
    try {
      const base = {
        tipoEvaluacionUuid: datos.tipoEvaluacionUuid,
        cantidad: Number(datos.cantidad),
        edadMinima: esConteoHojas && datos.edadMinima !== "" ? Number(datos.edadMinima) : null,
        edadMaxima: esConteoHojas && datos.edadMaxima !== "" ? Number(datos.edadMaxima) : null,
        estado: datos.estado,
      };
      await Promise.all(
        targets.map((t) =>
          apiFetch("/evaluaciones/objetivos", {
            method: "POST",
            body: JSON.stringify({ ...base, fincaUuid: t.fincaUuid ?? null, loteUuid: t.loteUuid ?? null }),
          }),
        ),
      );
      onCreado();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Nuevo objetivo" onClose={onClose} size="lg" height="90vh" minHeight="70vh">
      <form onSubmit={handleSubmit} className="d-flex flex-column h-100">
        <div className="mb-3">
          <label className="form-label small fw-medium">
            Tipo de evaluación <span className="text-danger">*</span>
          </label>
          <select
            className="form-select rounded-3"
            required
            value={datos.tipoEvaluacionUuid}
            onChange={(e) => setDatos((d) => ({ ...d, tipoEvaluacionUuid: e.target.value }))}
          >
            <option value="">Selecciona...</option>
            {tipos.map((t) => (
              <option key={t.uuid} value={t.uuid}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label small fw-medium">
            Cantidad por semana <span className="text-danger">*</span>
          </label>
          <input
            type="number"
            min={1}
            className="form-control rounded-3"
            required
            value={datos.cantidad}
            onChange={(e) => setDatos((d) => ({ ...d, cantidad: e.target.value }))}
          />
        </div>

        {esConteoHojas && (
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label small fw-medium">Edad mínima (semanas)</label>
              <input
                type="number"
                min={1}
                className="form-control rounded-3"
                value={datos.edadMinima}
                onChange={(e) => setDatos((d) => ({ ...d, edadMinima: e.target.value }))}
              />
            </div>
            <div className="col-6">
              <label className="form-label small fw-medium">Edad máxima (semanas)</label>
              <input
                type="number"
                min={1}
                className="form-control rounded-3"
                value={datos.edadMaxima}
                onChange={(e) => setDatos((d) => ({ ...d, edadMaxima: e.target.value }))}
              />
            </div>
            {datos.edadMinima !== "" && datos.edadMaxima !== "" && (
              <div className="col-12">
                <p className="small text-secondary mb-0">
                  La cantidad ({datos.cantidad || "…"}) se exige en cada edad del rango por separado: edad{" "}
                  {datos.edadMinima} necesita {datos.cantidad || "…"}, edad {datos.edadMaxima} necesita{" "}
                  {datos.cantidad || "…"}, etc. — no es un total combinado.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mb-3">
          <label className="form-label small fw-medium">
            Fincas que tienen este objetivo <span className="text-danger">*</span>
          </label>
          <TagPicker
            items={fincaItems}
            selected={fincasSeleccionadas}
            onChange={setFincasSeleccionadas}
            placeholder="Buscar finca para agregar..."
          />
        </div>

        <div className="mb-3">
          <label className="form-label small fw-medium">¿El objetivo es para toda la finca o por cada lote?</label>
          <div className="d-flex gap-3">
            <div className="form-check">
              <input
                type="radio"
                className="form-check-input"
                id="modo-finca"
                checked={modo === "finca"}
                onChange={() => setModo("finca")}
              />
              <label className="form-check-label small" htmlFor="modo-finca">
                Toda la finca
              </label>
            </div>
            <div className="form-check">
              <input
                type="radio"
                className="form-check-input"
                id="modo-lote"
                checked={modo === "lote"}
                onChange={() => setModo("lote")}
              />
              <label className="form-check-label small" htmlFor="modo-lote">
                Por cada lote
              </label>
            </div>
          </div>
        </div>

        {modo === "lote" && (
          <div className="mb-3 flex-grow-1 overflow-y-auto">
            {fincasSeleccionadas.length === 0 && (
              <p className="small text-secondary fst-italic">Agrega primero las fincas arriba.</p>
            )}
            {fincasSeleccionadas.map((f) => (
              <div key={f.uuid} className="border rounded-3 p-2 mb-2">
                <p className="small fw-medium mb-2">{f.label}</p>
                {cargandoLotes.has(f.uuid) && <p className="small text-secondary mb-0">Cargando lotes...</p>}
                {!cargandoLotes.has(f.uuid) && (lotesPorFinca[f.uuid]?.length ?? 0) === 0 && (
                  <p className="small text-secondary mb-0">Esta finca no tiene lotes.</p>
                )}
                <div className="d-flex flex-wrap gap-3">
                  {(lotesPorFinca[f.uuid] || []).map((l) => (
                    <div className="form-check" key={l.uuid}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`lote-${l.uuid}`}
                        checked={lotesElegidos[f.uuid]?.has(l.uuid) || false}
                        onChange={() => toggleLote(f.uuid, l.uuid)}
                      />
                      <label className="form-check-label small" htmlFor={`lote-${l.uuid}`}>
                        {l.nombre}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="form-check mb-3">
          <input
            type="checkbox"
            className="form-check-input"
            id="objetivo-estado-crear"
            checked={datos.estado}
            onChange={(e) => setDatos((d) => ({ ...d, estado: e.target.checked }))}
          />
          <label className="form-check-label small" htmlFor="objetivo-estado-crear">
            Activo
          </label>
        </div>

        {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-light rounded-3" onClick={onClose}>
            <FiX className="me-1" /> Cancelar
          </button>
          <button type="submit" className="btn btn-brand rounded-3" disabled={saving}>
            <FiSave className="me-1" /> {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: editar un objetivo puntual ya existente (una sola finca o
// lote — el bulk-create solo aplica a la creación) ───
function EditarObjetivoModal({ objetivo, tipos, onClose, onGuardado }) {
  const [datos, setDatos] = useState({
    tipoEvaluacionUuid: objetivo.tipoEvaluacion?.uuid || "",
    cantidad: String(objetivo.cantidad ?? ""),
    edadMinima: objetivo.edadMinima != null ? String(objetivo.edadMinima) : "",
    edadMaxima: objetivo.edadMaxima != null ? String(objetivo.edadMaxima) : "",
    estado: objetivo.estado,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const tipoSeleccionado = tipos.find((t) => t.uuid === datos.tipoEvaluacionUuid);
  const esConteoHojas = tipoSeleccionado?.nombre === CONTEO_HOJAS_NOMBRE;

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await apiFetch(`/evaluaciones/objetivos/${objetivo.uuid}`, {
        method: "PUT",
        body: JSON.stringify({
          tipoEvaluacionUuid: datos.tipoEvaluacionUuid,
          cantidad: Number(datos.cantidad),
          edadMinima: esConteoHojas && datos.edadMinima !== "" ? Number(datos.edadMinima) : null,
          edadMaxima: esConteoHojas && datos.edadMaxima !== "" ? Number(datos.edadMaxima) : null,
          estado: datos.estado,
        }),
      });
      onGuardado();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Editar objetivo" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="small text-secondary mb-3">
          {objetivo.finca ? `Finca: ${objetivo.finca.nombre}` : `Lote: ${objetivo.lote?.nombre} (${objetivo.lote?.finca?.nombre ?? "—"})`}
        </p>

        <div className="mb-3">
          <label className="form-label small fw-medium">
            Tipo de evaluación <span className="text-danger">*</span>
          </label>
          <select
            className="form-select rounded-3"
            required
            value={datos.tipoEvaluacionUuid}
            onChange={(e) => setDatos((d) => ({ ...d, tipoEvaluacionUuid: e.target.value }))}
          >
            <option value="">Selecciona...</option>
            {tipos.map((t) => (
              <option key={t.uuid} value={t.uuid}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label small fw-medium">
            Cantidad por semana <span className="text-danger">*</span>
          </label>
          <input
            type="number"
            min={1}
            className="form-control rounded-3"
            required
            value={datos.cantidad}
            onChange={(e) => setDatos((d) => ({ ...d, cantidad: e.target.value }))}
          />
        </div>

        {esConteoHojas && (
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label small fw-medium">Edad mínima (semanas)</label>
              <input
                type="number"
                min={1}
                className="form-control rounded-3"
                value={datos.edadMinima}
                onChange={(e) => setDatos((d) => ({ ...d, edadMinima: e.target.value }))}
              />
            </div>
            <div className="col-6">
              <label className="form-label small fw-medium">Edad máxima (semanas)</label>
              <input
                type="number"
                min={1}
                className="form-control rounded-3"
                value={datos.edadMaxima}
                onChange={(e) => setDatos((d) => ({ ...d, edadMaxima: e.target.value }))}
              />
            </div>
            {datos.edadMinima !== "" && datos.edadMaxima !== "" && (
              <div className="col-12">
                <p className="small text-secondary mb-0">
                  La cantidad ({datos.cantidad || "…"}) se exige en cada edad del rango por separado: edad{" "}
                  {datos.edadMinima} necesita {datos.cantidad || "…"}, edad {datos.edadMaxima} necesita{" "}
                  {datos.cantidad || "…"}, etc. — no es un total combinado.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="form-check mb-3">
          <input
            type="checkbox"
            className="form-check-input"
            id="objetivo-estado-editar"
            checked={datos.estado}
            onChange={(e) => setDatos((d) => ({ ...d, estado: e.target.checked }))}
          />
          <label className="form-check-label small" htmlFor="objetivo-estado-editar">
            Activo
          </label>
        </div>

        {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-light rounded-3" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-brand rounded-3" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
