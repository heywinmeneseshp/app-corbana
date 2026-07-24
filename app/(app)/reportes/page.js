"use client";

import { useEffect, useState } from "react";
import { FiFilter, FiEye, FiDownload } from "react-icons/fi";
import { apiFetch, API_URL } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

const TABS = [
  { key: "Índice de infección", label: "Índice de Infección" },
  { key: "Conteo de Hojas", label: "Conteo de Hojas" },
  { key: "Suma Bruta", label: "Suma Bruta" },
  { key: "Racimos", label: "Descargas de Racimos" },
];

export default function ReportesPage() {
  const [tiposEvaluacion, setTiposEvaluacion] = useState([]);
  const [tab, setTab] = useState(TABS[0].key);
  const [puedeVerRacimos, setPuedeVerRacimos] = useState(false);

  useEffect(() => {
    apiFetch("/tipos-evaluacion?limit=100")
      .then((data) => setTiposEvaluacion(data.items))
      .catch(() => {});
    setPuedeVerRacimos(hasPermission("racimo_movimiento.ver"));
  }, []);

  const tipoActual = tiposEvaluacion.find((t) => t.nombre === tab);
  const tabsVisibles = TABS.filter((t) => t.key !== "Racimos" || puedeVerRacimos);

  return (
    <RequirePermission code="evaluacion.ver">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Reportes</h1>
          <p className="text-secondary mb-0">Un reporte detallado por cada tipo de evaluación.</p>
        </div>

        <ul className="nav nav-pills mb-4 gap-2">
          {tabsVisibles.map((t) => (
            <li className="nav-item" key={t.key}>
              <button
                type="button"
                className={`nav-link rounded-3 ${tab === t.key ? "btn-brand text-white" : "btn btn-outline-secondary"}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>

        {tab === "Racimos" ? (
          <ReporteSemanalRacimos />
        ) : tipoActual ? (
          <ReporteEvaluacion tipoEvaluacionUuid={tipoActual.uuid} tab={tab} />
        ) : (
          <p className="text-secondary small">Cargando tipos de evaluación...</p>
        )}
      </div>
    </RequirePermission>
  );
}

const FORMATOS_RACIMOS = [
  { tipo: "EMBOLSE", label: "Embolse", archivo: "embolsados" },
  { tipo: "REPIQUE", label: "Repique", archivo: "repicados" },
  { tipo: "RECUSE", label: "Recusados", archivo: "recusados" },
  { tipo: "PROCESADO", label: "Procesado", archivo: "procesados" },
];

function ReporteSemanalRacimos() {
  const [semanas, setSemanas] = useState([]);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [semanaUuid, setSemanaUuid] = useState("");
  const [descargando, setDescargando] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/semanas?limit=55&anio=${anio}`)
      .then((res) => setSemanas(res.items))
      .catch((err) => setError(err.message));
  }, [anio]);

  async function descargar(tipo, archivo) {
    if (!semanaUuid) {
      setError("Seleccioná primero la semana a descargar.");
      return;
    }
    setError("");
    setDescargando(tipo);
    try {
      const params = new URLSearchParams({ semanaUuid, tipo });
      const token = localStorage.getItem("corbana_access_token");
      const res = await fetch(`${API_URL}/racimo-movimientos/exportar-semanal?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) {
        localStorage.removeItem("corbana_access_token");
        localStorage.removeItem("corbana_refresh_token");
        window.location.href = "/login";
        throw new Error("Sesión expirada");
      }
      if (!res.ok) {
        let msg = "Error al exportar";
        try {
          const j = await res.json();
          msg = j.message || msg;
        } catch {
          try {
            msg = await res.text();
          } catch {}
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `registro-${archivo}-${semanaUuid}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDescargando("");
    }
  }

  return (
    <div className="card border-0 shadow-sm rounded-4 p-4">
      <p className="text-secondary mb-4">
        Descarga semanal en el formato exacto que espera el sistema externo (Semana, Año, Finca, Lote, Edad,
        Novedad, Cantidad). La Edad se calcula como la diferencia entre la semana descargada y la semana de embolse
        de cada cohorte, más uno.
      </p>

      <div className="row g-2 align-items-end mb-4">
        <div className="col-6 col-md-3">
          <label className="form-label small fw-medium">Año</label>
          <input
            type="number"
            className="form-control rounded-3"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
          />
        </div>
        <div className="col-6 col-md-4">
          <label className="form-label small fw-medium">Semana a descargar</label>
          <select className="form-select rounded-3" value={semanaUuid} onChange={(e) => setSemanaUuid(e.target.value)}>
            <option value="">Seleccioná una semana</option>
            {semanas.map((s) => (
              <option key={s.uuid} value={s.uuid}>
                {s.codigo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="row g-3">
        {FORMATOS_RACIMOS.map((f) => (
          <div className="col-6 col-md-3" key={f.tipo}>
            <button
              type="button"
              className="btn btn-outline-success rounded-3 w-100 d-flex align-items-center justify-content-center gap-2 py-3"
              disabled={!semanaUuid || descargando === f.tipo}
              onClick={() => descargar(f.tipo, f.archivo)}
            >
              <FiDownload /> {descargando === f.tipo ? "Descargando..." : f.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReporteEvaluacion({ tipoEvaluacionUuid, tab }) {
  const [fincas, setFincas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [loteUuid, setLoteUuid] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detalleModal, setDetalleModal] = useState(null); // null | evaluacion

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((data) => setFincas(data.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoteUuid("");
    if (!fincaUuid) {
      setLotes([]);
      return;
    }
    apiFetch(`/fincas/${fincaUuid}/lotes?limit=100`)
      .then((data) => setLotes(data.items))
      .catch(() => setLotes([]));
  }, [fincaUuid]);

  async function loadReporte() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100", tipoEvaluacionUuid });
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      if (loteUuid) params.set("loteUuid", loteUuid);
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      const { items: evaluaciones } = await apiFetch(`/evaluaciones?${params.toString()}`);
      setItems(evaluaciones);
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
          <div className="col-6 col-md-3">
            <label className="form-label small fw-medium">Finca</label>
            <select className="form-select rounded-3" value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)}>
              <option value="">Todas</option>
              {fincas.map((f) => (
                <option key={f.uuid} value={f.uuid}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small fw-medium">Lote</label>
            <select
              className="form-select rounded-3"
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
          <div className="col-6 col-md-2">
            <label className="form-label small fw-medium">Desde</label>
            <input type="date" className="form-control rounded-3" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-medium">Hasta</label>
            <input type="date" className="form-control rounded-3" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
          <div className="col-12 col-md-2">
            <button type="button" className="btn btn-brand rounded-3 w-100 d-flex align-items-center justify-content-center gap-1" onClick={loadReporte}>
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
                  </>
                )}
                {tab === "Conteo de Hojas" && <th>Hojas Funcionales</th>}
                {tab === "Suma Bruta" && (
                  <>
                    <th>Hojas Funcionales</th>
                    <th>Candela</th>
                  </>
                )}
                {(tab === "Índice de infección" || tab === "Suma Bruta") && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center text-secondary py-4">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-secondary py-4">
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
                      </>
                    )}
                    {tab === "Conteo de Hojas" && <td>{ev.conteoHojas?.hojasFuncionales ?? "—"}</td>}
                    {tab === "Suma Bruta" && (
                      <>
                        <td>{ev.sumaBruta?.hojasFuncionales ?? "—"}</td>
                        <td>{ev.sumaBruta?.candela ?? "—"}</td>
                      </>
                    )}
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

      {detalleModal && (
        <DetalleModal
          evaluacion={detalleModal}
          tab={tab}
          onClose={() => setDetalleModal(null)}
        />
      )}
    </div>
  );
}

function DetalleModal({ evaluacion, tab, onClose }) {
  const esInfeccion = tab === "Índice de infección";
  const filas = esInfeccion ? evaluacion.infeccion?.hojas || [] : evaluacion.sumaBruta?.estadios || [];

  return (
    <ModalShell title={`Detalle de hojas — Planta ${evaluacion.planta?.codigo || ""}`} onClose={onClose}>
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
