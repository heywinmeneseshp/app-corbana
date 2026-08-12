"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiMap } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import { hasPermission } from "@/lib/auth";

function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AreaLotesConfigPage() {
  const [configs, setConfigs] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [fincaUuid, setFincaUuid] = useState("");
  const [rolId, setRolId] = useState("");
  const [fechaObjetivo, setFechaObjetivo] = useState(hoyIso());
  const [creando, setCreando] = useState(false);

  const cargarTodo = async () => {
    setLoading(true);
    setError("");
    try {
      const [configData, fincasData, rolesData] = await Promise.all([
        apiFetch("/lote-area-config?limit=50"),
        apiFetch("/fincas?limit=100"),
        apiFetch("/roles?limit=100"),
      ]);
      setConfigs(configData.items);
      setFincas(fincasData.items);
      setRoles(rolesData.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  const handleCrear = async (e) => {
    e.preventDefault();
    setError("");
    setCreando(true);
    try {
      await apiFetch("/lote-area-config", {
        method: "POST",
        body: JSON.stringify({ fincaUuid, rolId: Number(rolId), fechaObjetivo }),
      });
      setFincaUuid("");
      setRolId("");
      setFechaObjetivo(hoyIso());
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  };

  const handleToggle = async (uuid, activo) => {
    try {
      await apiFetch(`/lote-area-config/${uuid}`, { method: "PUT", body: JSON.stringify({ activo: !activo }) });
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEliminar = async (uuid) => {
    if (!confirm("¿Eliminar esta configuración?")) return;
    try {
      await apiFetch(`/lote-area-config/${uuid}`, { method: "DELETE" });
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <RequirePermission code="menu.maestros.area_lotes">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiMap className="text-primary" /> Área de Lotes
          </h1>
          <p className="text-secondary mb-0">
            Programa qué rol debe confirmar el área total y en producción de cada lote de una finca, a partir de qué
            fecha. Desde esa fecha, a los usuarios con ese rol se les va a pedir (con bloqueo) hasta que lo registren
            — no importa cuántos días pasen, con registrarlo una vez alcanza.
          </p>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {hasPermission("area_lote.configurar") && (
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body p-4">
              <h2 className="h6 fw-semibold mb-3">Nueva configuración</h2>
              <form onSubmit={handleCrear} className="row g-2 align-items-end">
                <div className="col-md-4">
                  <label className="form-label small fw-medium">Finca</label>
                  <select className="form-select" value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)} required>
                    <option value="">Selecciona una finca</option>
                    {fincas.map((f) => (
                      <option key={f.uuid} value={f.uuid}>
                        {f.codigo} — {f.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-medium">Rol</label>
                  <select className="form-select" value={rolId} onChange={(e) => setRolId(e.target.value)} required>
                    <option value="">Selecciona un rol</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-medium">Fecha objetivo</label>
                  <input
                    type="date"
                    className="form-control"
                    value={fechaObjetivo}
                    onChange={(e) => setFechaObjetivo(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-2">
                  <button type="submit" className="btn btn-brand w-100 rounded-3 d-flex align-items-center justify-content-center gap-1" disabled={creando}>
                    <FiPlus /> {creando ? "..." : "Agregar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-secondary">Cargando...</p>
        ) : (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4">
              <h2 className="h6 fw-semibold mb-3">Configuración</h2>
              {configs.length === 0 ? (
                <p className="text-secondary small mb-0">Todavía no hay ninguna configuración.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr className="text-secondary small">
                        <th>Finca</th>
                        <th>Rol</th>
                        <th>Fecha objetivo</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {configs.map((c) => (
                        <tr key={c.uuid}>
                          <td>{c.finca?.nombre}</td>
                          <td>{c.rol?.nombre}</td>
                          <td>{c.fechaObjetivo}</td>
                          <td>
                            {hasPermission("area_lote.configurar") ? (
                              <div className="form-check form-switch mb-0">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={!!c.activo}
                                  onChange={() => handleToggle(c.uuid, c.activo)}
                                />
                              </div>
                            ) : (
                              <span className={`badge rounded-pill ${c.activo ? "text-bg-success" : "text-bg-secondary"}`}>
                                {c.activo ? "Activo" : "Inactivo"}
                              </span>
                            )}
                          </td>
                          <td className="text-end">
                            {hasPermission("area_lote.configurar") && (
                              <button
                                type="button"
                                className="btn btn-link btn-sm text-danger p-0"
                                onClick={() => handleEliminar(c.uuid)}
                                title="Eliminar"
                              >
                                <FiTrash2 />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
