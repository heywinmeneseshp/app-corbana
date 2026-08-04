"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";

// Creación rápida de una categoría de labor, embebida dentro del flujo de
// "Nueva labor" para no obligar a salir a Maestros → Categorías de Labor.
export default function CreateCategoryQuickModal({ onClose, onCreated }) {
  const [nombre, setNombre] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const nuevaCategoria = await apiFetch("/categorias-labor", { method: "POST", body: JSON.stringify({ nombre }) });
      onCreated(nuevaCategoria);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Nueva categoría de labor" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-medium">
            Nombre <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="form-control rounded-3"
            required
            maxLength={100}
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
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
    </ModalShell>
  );
}
