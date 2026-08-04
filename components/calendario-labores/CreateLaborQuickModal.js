"use client";

import { useState } from "react";
import { FiPlus } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import ModalShell from "@/components/ModalShell";
import IconPicker from "./IconPicker";
import CreateCategoryQuickModal from "./CreateCategoryQuickModal";
import { DEFAULT_LABOR_ICON_KEY } from "@/lib/laborIcons";

// Creación rápida de una labor (maestro), embebida dentro de CreateLaborDialog
// para no obligar a salir a Maestros → Labores a mitad del flujo.
export default function CreateLaborQuickModal({ categorias, onClose, onCreated, onCategoriaCreada }) {
  const [nombre, setNombre] = useState("");
  const [categoriaLaborUuid, setCategoriaLaborUuid] = useState(categorias[0]?.uuid || "");
  const [color, setColor] = useState("#16a34a");
  const [icono, setIcono] = useState(DEFAULT_LABOR_ICON_KEY);
  const [duracionDefaultMinutos, setDuracionDefaultMinutos] = useState("");
  const [crearCategoriaAbierta, setCrearCategoriaAbierta] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function handleCategoriaCreada(nuevaCategoria) {
    onCategoriaCreada(nuevaCategoria);
    setCategoriaLaborUuid(nuevaCategoria.uuid);
    setCrearCategoriaAbierta(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const nuevaLabor = await apiFetch("/labores", {
        method: "POST",
        body: JSON.stringify({
          nombre,
          categoriaLaborUuid,
          color,
          icono,
          duracionDefaultMinutos: duracionDefaultMinutos === "" ? null : Number(duracionDefaultMinutos),
        }),
      });
      // El POST no trae la categoría anidada — se completa en el cliente con
      // la categoría ya seleccionada para que se vea igual que el resto del select.
      const categoria = categorias.find((c) => c.uuid === categoriaLaborUuid);
      onCreated({ ...nuevaLabor, categoria });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (categorias.length === 0) {
    return (
      <ModalShell title="Nueva labor" onClose={onClose}>
        <div className="alert alert-warning py-2 small mb-3">
          Todavía no hay categorías de labor creadas. Crea una primero para poder asignarle la labor.
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose}>
            Cerrar
          </button>
          {hasPermission("categoria_labor.crear") && (
            <button type="button" className="btn btn-brand rounded-3" onClick={() => setCrearCategoriaAbierta(true)}>
              Crear categoría de labor
            </button>
          )}
        </div>
        {crearCategoriaAbierta && (
          <CreateCategoryQuickModal onClose={() => setCrearCategoriaAbierta(false)} onCreated={handleCategoriaCreada} />
        )}
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Nueva labor (maestro)" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-medium">
            Nombre <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="form-control rounded-3"
            required
            maxLength={150}
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <div className="d-flex align-items-center justify-content-between">
            <label className="form-label small fw-medium mb-0">
              Categoría <span className="text-danger">*</span>
            </label>
            {hasPermission("categoria_labor.crear") && (
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-decoration-none d-flex align-items-center gap-1"
                onClick={() => setCrearCategoriaAbierta(true)}
              >
                <FiPlus size={12} /> Nueva categoría
              </button>
            )}
          </div>
          <select
            className="form-select rounded-3 mt-1"
            required
            value={categoriaLaborUuid}
            onChange={(e) => setCategoriaLaborUuid(e.target.value)}
          >
            {categorias.map((c) => (
              <option key={c.uuid} value={c.uuid}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label small fw-medium d-block">Icono</label>
          <IconPicker value={icono} onChange={setIcono} />
        </div>
        <div className="mb-3">
          <label className="form-label small fw-medium">Color</label>
          <div className="d-flex align-items-center gap-2">
            <input type="color" className="form-control form-control-color" value={color} onChange={(e) => setColor(e.target.value)} />
            <span className="small text-secondary">{color}</span>
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label small fw-medium">Duración por defecto (minutos)</label>
          <input
            type="number"
            min={1}
            className="form-control rounded-3"
            placeholder="Opcional"
            value={duracionDefaultMinutos}
            onChange={(e) => setDuracionDefaultMinutos(e.target.value)}
          />
        </div>

        {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-brand rounded-3" disabled={saving}>
            {saving ? "Guardando..." : "Crear y usar"}
          </button>
        </div>
      </form>

      {crearCategoriaAbierta && (
        <CreateCategoryQuickModal onClose={() => setCrearCategoriaAbierta(false)} onCreated={handleCategoriaCreada} />
      )}
    </ModalShell>
  );
}
