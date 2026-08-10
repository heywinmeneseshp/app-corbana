"use client";

import { useEffect, useState } from "react";
import { FiFilter, FiEye } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";

function nombreCompleto(u) {
  return `${u.nombre} ${u.apellido}`.trim();
}

// Tabla paginada de evaluaciones (una fila por planta). El tipo de
// evaluación llega como `tipoEvaluacionUuid` y `tab` (nombre) define qué
// columnas se muestran.
export default function ReporteEvaluacion({ tipoEvaluacionUuid, tab }) {
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

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detalleModal, setDetalleModal] = useState(null); // null | evaluacion
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);

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

  async function loadReporte(paginaNueva) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "40", page: String(paginaNueva || 1), tipoEvaluacionUuid });
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      if (loteUuid) params.set("loteUuid", loteUuid);
      if (semanaUuid) params.set("semanaUuid", semanaUuid);
      if (usuarioUuid) params.set("usuarioUuid", usuarioUuid);
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      const { items: evaluaciones, meta } = await apiFetch(`/evaluaciones?${params.toString()}`);
      setItems(evaluaciones);
      setPagina(meta?.page ?? 1);
      setTotalPaginas(meta?.totalPages ?? 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReporte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoEvaluacionUuid]);

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
            <button type="button" className="btn btn-sm btn-brand rounded-3 w-100 d-flex align-items-center justify-content-center gap-1" onClick={() => loadReporte(1)}>
              <FiFilter /> Filtrar
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle small">
            <thead className="table-light">
              <tr>
                <th>Finca</th>
                <th>Lote</th>
                <th>Planta</th>
                <th>Semana</th>
                <th>Fecha</th>
                {tab === "Índice de infección" && (
                  <>
                    <th>Hojas Totales</th>
                    <th>YLI</th>
                    <th>YLS</th>
                    <th>Índice de Infección</th>
                  </>
                )}
                {tab === "Conteo de Hojas" && <th>Hojas Funcionales</th>}
                {tab === "Suma Bruta" && (
                  <>
                    <th>Hojas Funcionales</th>
                    <th>Candela</th>
                    <th>Suma Bruta</th>
                  </>
                )}
                {(tab === "Índice de infección" || tab === "Conteo de Hojas" || tab === "Suma Bruta") && <th>Registrado por</th>}
                {(tab === "Índice de infección" || tab === "Suma Bruta") && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="text-center text-secondary py-4">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-secondary py-4">
                    No hay evaluaciones para estos filtros.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((ev) => (
                  <tr key={ev.uuid}>
                    <td>{ev.planta?.lote?.finca?.nombre || "—"}</td>
                    <td>{ev.planta?.lote?.nombre || "—"}</td>
                    <td>{ev.planta?.codigo || "—"}</td>
                    <td>{ev.semana?.codigo || "—"}</td>
                    <td>{ev.fecha}</td>
                    {tab === "Índice de infección" && (
                      <>
                        <td>{ev.infeccion?.hojasTotales ?? "—"}</td>
                        <td>{ev.infeccion?.yli ?? "—"}</td>
                        <td>{ev.infeccion?.yls ?? "—"}</td>
                        <td className="fw-medium">
                          {ev.infeccion?.indiceInfeccion != null ? `${ev.infeccion.indiceInfeccion.toFixed(2)}%` : "—"}
                        </td>
                      </>
                    )}
                    {tab === "Conteo de Hojas" && (
                      <>
                        <td>{ev.conteoHojas?.hojasFuncionales ?? "—"}</td>
                        <td>{ev.usuario?.usuario || "—"}</td>
                      </>
                    )}
                    {tab === "Suma Bruta" && (
                      <>
                        <td>{ev.sumaBruta?.hojasFuncionales ?? "—"}</td>
                        <td>{ev.sumaBruta?.candela ?? "—"}</td>
                        <td className="fw-medium">{ev.sumaBruta?.total ?? "—"}</td>
                      </>
                    )}
                    {(tab === "Índice de infección" || tab === "Suma Bruta") && <td>{ev.usuario?.usuario || "—"}</td>}
                    {(tab === "Índice de infección" || tab === "Suma Bruta") && (
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 text-nowrap"
                          onClick={() => setDetalleModal(ev)}
                        >
                          <FiEye /> Ver detalle
                        </button>
                      </td>
                    )}
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

      {detalleModal && (
        <DetalleModal evaluacion={detalleModal} tab={tab} onClose={() => setDetalleModal(null)} />
      )}
    </div>
  );
}

function DetalleModal({ evaluacion, tab, onClose }) {
  const esInfeccion = tab === "Índice de infección";
  const filas = esInfeccion ? evaluacion.infeccion?.hojas || [] : evaluacion.sumaBruta?.estadios || [];

  return (
    <ModalShell title={`Detalle de hojas — Planta ${evaluacion.planta?.codigo || ""}`} onClose={onClose}>
      <div className="mb-3 p-3 rounded-3" style={{ backgroundColor: "#f0fdf4" }}>
        <span className="small text-secondary me-2">{esInfeccion ? "Índice de Infección:" : "Suma Bruta:"}</span>
        <span className="fw-bold">
          {esInfeccion
            ? evaluacion.infeccion?.indiceInfeccion != null
              ? `${evaluacion.infeccion.indiceInfeccion.toFixed(2)}%`
              : "—"
            : (evaluacion.sumaBruta?.total ?? "—")}
        </span>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-hover mb-0">
          <thead className="table-light">
            <tr>
              <th>N° de Hoja</th>
              <th>{esInfeccion ? "Severidad" : "Estadio"}</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={2} className="text-center text-secondary py-3">
                  Sin datos de hojas registrados.
                </td>
              </tr>
            )}
            {filas.map((fila, i) => (
              <tr key={fila.uuid || i}>
                <td>{fila.numeroHoja}</td>
                <td>{esInfeccion ? fila.severidad : fila.estadio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}