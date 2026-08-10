"use client";

import { useEffect, useRef, useState } from "react";
import { FiFilter, FiPackage, FiTrash2, FiUploadCloud } from "react-icons/fi";
import { apiFetch, apiUpload } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";

export default function ProduccionSemanalPage() {
  const [fincas, setFincas] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [semanaUuid, setSemanaUuid] = useState("");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [actualizando, setActualizando] = useState(false);
  const inputActualizarRef = useRef(null);

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((data) => setFincas(data.items))
      .catch(() => {});
    apiFetch("/semanas?limit=100")
      .then((data) => setSemanas(data.items))
      .catch(() => {});
  }, []);

  async function loadReporte(paginaNueva) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "40", page: String(paginaNueva || 1) });
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      if (semanaUuid) params.set("semanaUuid", semanaUuid);
      const { items: rows, page, totalPages } = await apiFetch(`/produccion-semanal?${params.toString()}`);
      setItems(rows);
      setPagina(page ?? 1);
      setTotalPaginas(totalPages ?? 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReporte(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(registro) {
    if (!confirm(`¿Eliminar el registro de ${registro.finca?.nombre} — ${registro.semana?.codigo} (${registro.cajas20kg} cajas)?`)) return;
    try {
      await apiFetch(`/produccion-semanal/${registro.uuid}`, { method: "DELETE" });
      loadReporte(pagina);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleActualizarMasivo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (
      !confirm(
        "Esto sobrescribe las cajas de finca+semana que ya estén cargadas con el valor del archivo, y crea las que no existan. ¿Continuar?",
      )
    ) {
      return;
    }
    setActualizando(true);
    setError("");
    try {
      const resultado = await apiUpload("/produccion-semanal/bulk-update", file);
      alert(
        `Actualización terminada.\nActualizados: ${resultado.actualizados}\nCreados: ${resultado.creados}` +
          (resultado.errores?.length ? `\nFilas con error: ${resultado.errores.length}` : ""),
      );
      loadReporte(pagina);
    } catch (err) {
      setError(err.message);
    } finally {
      setActualizando(false);
    }
  }

  return (
    <RequirePermission code="produccion.ver">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiPackage className="text-primary" /> Producción Semanal
          </h1>
          <p className="text-secondary mb-0">Cajas de 20kg registradas por finca y semana (cargue masivo o manual).</p>
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-4">
              <label className="form-label small fw-medium">Finca</label>
              <select className="form-select rounded-3" value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)}>
                <option value="">Todas</option>
                {fincas.map((f) => (
                  <option key={f.uuid} value={f.uuid}>
                    {f.codigo} — {f.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label small fw-medium">Semana</label>
              <select className="form-select rounded-3" value={semanaUuid} onChange={(e) => setSemanaUuid(e.target.value)}>
                <option value="">Todas</option>
                {semanas.map((s) => (
                  <option key={s.uuid} value={s.uuid}>
                    {s.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div className={hasPermission("produccion.actualizar_masivo") ? "col-6 col-md-2" : "col-12 col-md-2"}>
              <button type="button" className="btn btn-brand rounded-3 w-100 d-flex align-items-center justify-content-center gap-1" onClick={() => loadReporte(1)}>
                <FiFilter /> Filtrar
              </button>
            </div>
            {hasPermission("produccion.actualizar_masivo") && (
              <div className="col-6 col-md-2">
                <input
                  ref={inputActualizarRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="d-none"
                  onChange={handleActualizarMasivo}
                />
                <button
                  type="button"
                  className="btn btn-outline-warning rounded-3 w-100 d-flex align-items-center justify-content-center gap-1"
                  disabled={actualizando}
                  onClick={() => inputActualizarRef.current?.click()}
                  title="Solo Administrador: sobrescribe cajas ya cargadas de finca+semana con el archivo"
                >
                  <FiUploadCloud /> {actualizando ? "Subiendo..." : "Actualizar masivo"}
                </button>
              </div>
            )}
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle small">
              <thead className="table-light">
                <tr>
                  <th>Finca</th>
                  <th>Semana</th>
                  <th className="text-end">Cajas (20kg)</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-4">
                      No hay registros para estos filtros.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((r) => (
                    <tr key={r.uuid}>
                      <td>{r.finca?.codigo} — {r.finca?.nombre}</td>
                      <td>{r.semana?.codigo}</td>
                      <td className="text-end fw-medium">{r.cajas20kg?.toLocaleString("es")}</td>
                      <td className="text-end">
                        {hasPermission("produccion.eliminar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            title="Eliminar"
                            onClick={() => handleDelete(r)}
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
        </div>

        <div className="d-flex justify-content-between align-items-center mt-2">
          <span className="small text-secondary">
            Página {pagina} de {totalPaginas}
          </span>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3"
              disabled={pagina <= 1 || loading}
              onClick={() => loadReporte(pagina - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3"
              disabled={pagina >= totalPaginas || loading}
              onClick={() => loadReporte(pagina + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
