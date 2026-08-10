"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCalendar, FiChevronRight, FiAlertTriangle, FiFilter } from "react-icons/fi";
import { GiFarmTractor } from "react-icons/gi";
import { apiFetch } from "@/lib/api";

function nombreCompleto(u) {
  return `${u.nombre} ${u.apellido}`.trim();
}

// Listado de visitas de sanidad y labor cultural registradas desde la app
// móvil. Se muestra como pestaña dentro del módulo de Reportes.
export default function ReporteLabores() {
  const router = useRouter();
  const [fincas, setFincas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [loteUuid, setLoteUuid] = useState("");
  const [semanaUuid, setSemanaUuid] = useState("");
  const [usuarioUuid, setUsuarioUuid] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((data) => setFincas(data.items))
      .catch(() => {});
    apiFetch("/semanas?limit=100")
      .then((data) => setSemanas(data.items))
      .catch(() => {});
    apiFetch("/users?limit=100")
      .then((data) => setUsuarios(data.items))
      .catch(() => setUsuarios([])); // sin permiso para listar usuarios: el filtro queda oculto
  }, []);

  useEffect(() => {
    setLoteUuid("");
    if (!fincaUuid) {
      setLotes([]);
      return;
    }
    apiFetch(`/fincas/${fincaUuid}/lotes?limit=100&incluirGrupo=true`)
      .then((data) => setLotes(data.items))
      .catch(() => setLotes([]));
  }, [fincaUuid]);

  async function loadVisitas() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      if (loteUuid) params.set("loteUuid", loteUuid);
      if (semanaUuid) params.set("semanaUuid", semanaUuid);
      if (usuarioUuid) params.set("usuarioUuid", usuarioUuid);
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      const data = await apiFetch(`/labores-culturales/visitas?${params.toString()}`);
      setVisitas(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVisitas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-6 col-md">
            <label className="form-label small fw-medium">Finca</label>
            <select className="form-select form-select-sm rounded-3" value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)}>
              <option value="">Todas</option>
              {fincas.map((f) => (
                <option key={f.uuid} value={f.uuid}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md">
            <label className="form-label small fw-medium">Lote</label>
            <select
              className="form-select form-select-sm rounded-3"
              value={loteUuid}
              disabled={!fincaUuid}
              onChange={(e) => setLoteUuid(e.target.value)}
            >
              <option value="">Todos</option>
              {lotes.map((l) => (
                <option key={l.uuid} value={l.uuid}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md">
            <label className="form-label small fw-medium">Semana</label>
            <select className="form-select form-select-sm rounded-3" value={semanaUuid} onChange={(e) => setSemanaUuid(e.target.value)}>
              <option value="">Todas</option>
              {semanas.map((s) => (
                <option key={s.uuid} value={s.uuid}>
                  {s.codigo}
                </option>
              ))}
            </select>
          </div>
          {usuarios.length > 0 && (
            <div className="col-6 col-md">
              <label className="form-label small fw-medium">Usuario</label>
              <select className="form-select form-select-sm rounded-3" value={usuarioUuid} onChange={(e) => setUsuarioUuid(e.target.value)}>
                <option value="">Todos</option>
                {usuarios.map((u) => (
                  <option key={u.uuid} value={u.uuid}>
                    {nombreCompleto(u)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="col-6 col-md">
            <label className="form-label small fw-medium">Desde</label>
            <input type="date" className="form-control form-control-sm rounded-3" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div className="col-6 col-md">
            <label className="form-label small fw-medium">Hasta</label>
            <input type="date" className="form-control form-control-sm rounded-3" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
          <div className="col-12 col-md-auto">
            <button type="button" className="btn btn-sm btn-brand rounded-3 w-100 d-flex align-items-center justify-content-center gap-1" onClick={loadVisitas}>
              <FiFilter /> Filtrar
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <p className="text-secondary">Cargando...</p>
      ) : visitas.length === 0 ? (
        <p className="text-secondary">No hay visitas para estos filtros.</p>
      ) : (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr className="text-secondary small">
                  <th className="ps-4">Fecha</th>
                  <th>Finca</th>
                  <th>Semana</th>
                  <th>Lotes</th>
                  <th>Responsable</th>
                  <th>Hallazgos</th>
                  <th className="pe-4"></th>
                </tr>
              </thead>
              <tbody>
                {visitas.map((v) => (
                  <tr
                    key={v.visitaUuid}
                    role="button"
                    onClick={() => router.push(`/sanidad-vegetal/labores/${v.visitaUuid}`)}
                  >
                    <td className="ps-4">
                      <span className="d-flex align-items-center gap-2">
                        <FiCalendar className="text-secondary" size={14} />
                        {v.fecha}
                      </span>
                    </td>
                    <td>
                      <span className="d-flex align-items-center gap-2">
                        <GiFarmTractor className="text-secondary" size={15} />
                        {v.fincaNombre || "—"}
                      </span>
                    </td>
                    <td>{v.semanaCodigo || "—"}</td>
                    <td>{v.totalLotes}</td>
                    <td>{v.usuarioNombre || "—"}</td>
                    <td>
                      {(Number(v.mokoPresente) === 1 || Number(v.fusariumPresente) === 1) ? (
                        <span className="badge rounded-pill text-bg-danger d-inline-flex align-items-center gap-1">
                          <FiAlertTriangle size={11} />
                          {Number(v.mokoPresente) === 1 && "Moko"}
                          {Number(v.mokoPresente) === 1 && Number(v.fusariumPresente) === 1 && " / "}
                          {Number(v.fusariumPresente) === 1 && "Fusarium"}
                        </span>
                      ) : (
                        <span className="badge rounded-pill text-bg-light text-secondary">Sin hallazgos</span>
                      )}
                    </td>
                    <td className="pe-4 text-end">
                      <FiChevronRight className="text-secondary" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}