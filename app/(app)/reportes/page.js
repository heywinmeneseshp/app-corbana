"use client";

import { useEffect, useState } from "react";
import { FiDownload, FiFilter } from "react-icons/fi";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";

const TABS = [
  { key: "Racimos", label: "Descargas de Racimos" },
  { key: "Precipitaciones", label: "Precipitaciones" },
];

export default function ReportesPage() {
  const [tab, setTab] = useState(TABS[0].key);
  const [puedeVerRacimos, setPuedeVerRacimos] = useState(false);

  useEffect(() => {
    setPuedeVerRacimos(hasPermission("racimo_movimiento.ver"));
  }, []);

  const tabsVisibles = TABS.filter((t) => t.key !== "Racimos" || puedeVerRacimos);

  return (
    <RequirePermission code="menu.reportes">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Reportes</h1>
          <p className="text-secondary mb-0">Descargas semanales de racimos y registro de precipitaciones.</p>
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
        ) : (
          <ReportePrecipitaciones />
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
      const blob = await apiFetchBlob(`/racimo-movimientos/exportar-semanal?${params.toString()}`);
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

function ReportePrecipitaciones() {
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((res) => setFincas(res.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadReporte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReporte() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      const res = await apiFetch(`/precipitaciones?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-6 col-md-3">
            <label className="form-label small fw-medium">Finca</label>
            <select className="form-select rounded-3" value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)}>
              <option value="">Todas</option>
              {fincas.map((f) => (
                <option key={f.uuid} value={f.uuid}>{f.nombre}</option>
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
                <th>Fecha</th>
                <th>Semana</th>
                <th>Finca</th>
                <th className="text-end">Precipitación (mm)</th>
                <th>Registrado por</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">Cargando...</td>
                </tr>
              )}
              {!loading && data?.items?.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">No hay precipitaciones registradas.</td>
                </tr>
              )}
              {!loading && data?.items?.map((p) => (
                <tr key={p.uuid}>
                  <td>{p.fecha}</td>
                  <td>{p.semana_codigo || "—"}</td>
                  <td>{p.finca_nombre || "—"}</td>
                  <td className="text-end fw-semibold">{Number(p.mm).toLocaleString("es")}</td>
                  <td>{p.usuario_nombre || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}