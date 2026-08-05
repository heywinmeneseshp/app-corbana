"use client";

import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { esOcurrenciaRetrasada, diasRetraso } from "@/lib/laborEstados";

const FILTROS_ESTADO = [
  { value: "TODAS", label: "Todas" },
  { value: "PROGRAMADA", label: "Programadas" },
  { value: "COMPLETADA", label: "Completadas" },
  { value: "RETRASADA", label: "Con retraso" },
];

function EstadoBadge({ oc }) {
  const retrasada = esOcurrenciaRetrasada(oc);
  if (oc.estado === "COMPLETADA") {
    return <span className="badge rounded-pill text-bg-success">Completada</span>;
  }
  if (oc.estado === "CANCELADA") {
    return <span className="badge rounded-pill text-bg-secondary">Cancelada</span>;
  }
  if (retrasada) {
    return <span className="badge rounded-pill text-bg-warning">Con retraso</span>;
  }
  return <span className="badge rounded-pill text-bg-primary">Programada</span>;
}

export default function EstadosLabores() {
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [filtroEstado, setFiltroEstado] = useState("TODAS");
  const [filtroLaborUuid, setFiltroLaborUuid] = useState("");
  const [labores, setLabores] = useState([]);
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [{ items: fincasData }, { items: laboresData }] = await Promise.all([
          apiFetch("/fincas?limit=100"),
          apiFetch("/labores?limit=100"),
        ]);
        setFincas(fincasData);
        setLabores(laboresData);
        if (fincasData.length > 0) setFincaUuid((prev) => prev || fincasData[0].uuid);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!fincaUuid) return;
    let cancelado = false;
    setLoading(true);
    setError("");
    apiFetch(`/labor-ocurrencias?fincaUuid=${fincaUuid}&anio=${anio}`)
      .then((res) => {
        if (cancelado) return;
        setItems(res.items || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelado) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [fincaUuid, anio]);

  const filtradas = useMemo(() => {
    if (!items) return [];
    return items.filter((oc) => {
      if (filtroLaborUuid && oc.labor?.uuid !== filtroLaborUuid) return false;
      if (filtroEstado === "RETRASADA") return esOcurrenciaRetrasada(oc);
      if (filtroEstado !== "TODAS" && oc.estado !== filtroEstado) return false;
      return true;
    });
  }, [items, filtroEstado, filtroLaborUuid]);

  const conteos = useMemo(() => {
    if (!items) return { programadas: 0, completadas: 0, retrasadas: 0, canceladas: 0 };
    return items.reduce(
      (acc, oc) => {
        if (oc.estado === "COMPLETADA") acc.completadas += 1;
        else if (oc.estado === "CANCELADA") acc.canceladas += 1;
        else if (esOcurrenciaRetrasada(oc)) acc.retrasadas += 1;
        else acc.programadas += 1;
        return acc;
      },
      { programadas: 0, completadas: 0, retrasadas: 0, canceladas: 0 }
    );
  }, [items]);

  const fincaNombre = fincas.find((f) => f.uuid === fincaUuid)?.nombre || "—";

  return (
    <div>
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <h2 className="h6 fw-bold mb-0">Labores de {fincaNombre}</h2>
          <p className="text-secondary small mb-0">
            {items ? `${items.length} programaciones en ${anio}` : "—"}
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2 align-items-end">
          <div>
            <label className="form-label small fw-medium mb-1">Finca</label>
            <select className="form-select form-select-sm rounded-3" style={{ width: "auto" }} value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)}>
              <option value="">Seleccioná una finca</option>
              {fincas.map((f) => (
                <option key={f.uuid} value={f.uuid}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small fw-medium mb-1">Año</label>
            <input type="number" className="form-control form-control-sm rounded-3" style={{ width: "auto" }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
          </div>
          <div>
            <label className="form-label small fw-medium mb-1">Estado</label>
            <select className="form-select form-select-sm rounded-3" style={{ width: "auto" }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              {FILTROS_ESTADO.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small fw-medium mb-1">Labor</label>
            <select className="form-select form-select-sm rounded-3" style={{ width: "auto" }} value={filtroLaborUuid} onChange={(e) => setFiltroLaborUuid(e.target.value)}>
              <option value="">Todas las labores</option>
              {labores.map((l) => (
                <option key={l.uuid} value={l.uuid}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!loading && !error && items && (
        <div className="d-flex flex-wrap gap-2 mb-3">
          <span className="badge rounded-pill text-bg-primary">Programadas: {conteos.programadas}</span>
          <span className="badge rounded-pill text-bg-success">Completadas: {conteos.completadas}</span>
          <span className="badge rounded-pill text-bg-warning">Con retraso: {conteos.retrasadas}</span>
          <span className="badge rounded-pill text-bg-secondary">Canceladas: {conteos.canceladas}</span>
        </div>
      )}

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading && <p className="text-secondary small py-4 text-center mb-0">Cargando labores...</p>}

      {!loading && !error && filtradas.length === 0 && (
        <p className="text-secondary small py-4 text-center mb-0">No hay labores para los filtros seleccionados.</p>
      )}

      {!loading && !error && filtradas.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle small">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Finca</th>
                  <th>Labor</th>
                  <th>Lote</th>
                  <th>Categoría</th>
                  <th>Ejecutada</th>
                  <th>Retraso</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th>Serie</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((oc) => (
                  <tr key={oc.uuid} className={oc.estado === "CANCELADA" ? "text-secondary" : ""}>
                    <td className="text-nowrap">
                      <span className="d-inline-flex align-items-center gap-1">
                        <span>
                          {oc.fecha}
                          {oc.hora && <span className="text-secondary"> {oc.hora.slice(0, 5)}</span>}
                        </span>
                        {oc.estado === "PROGRAMADA" && esOcurrenciaRetrasada(oc) && (
                          <FiAlertTriangle color="#d97706" size={14} title="Retrasada" className="flex-shrink-0" />
                        )}
                      </span>
                    </td>
                    <td className="text-nowrap">{oc.finca?.nombre || oc.lote?.finca?.nombre || "—"}</td>
                    <td>{oc.labor?.nombre || "—"}</td>
                    <td>{oc.lote?.nombre || "—"}</td>
                    <td>{oc.labor?.categoria?.nombre || "—"}</td>
                    <td className="text-nowrap">
                      {oc.ejecutadaEl
                        ? `${oc.ejecutadaEl}${oc.ejecutadaHora ? ` ${oc.ejecutadaHora.slice(0, 5)}` : ""}`
                        : "—"}
                    </td>
                    <td className="text-nowrap">
                      {diasRetraso(oc) > 0 ? `${diasRetraso(oc)} día${diasRetraso(oc) === 1 ? "" : "s"}` : "—"}
                    </td>
                    <td>{oc.responsable?.nombre ? `${oc.responsable.nombre} ${oc.responsable.apellido || ""}` : "—"}</td>
                    <td><EstadoBadge oc={oc} /></td>
                    <td>{oc.serie?.esRecurrente ? "Recurrente" : "Puntual"}</td>
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