"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiFilter, FiPlus, FiChevronLeft, FiChevronRight, FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import { COLOR_HEX } from "@/lib/semanaColor";

const TIPO_BADGE = {
  EMBOLSE: { label: "EMBOLSE", bg: "#d1fae5", color: "#047857" },
  REPIQUE: { label: "REPIQUE", bg: "#fef3c7", color: "#b45309" },
  PROCESADO: { label: "PROCESADO", bg: "#ede9fe", color: "#6d28d9" },
  RECUSE: { label: "RECUSADO", bg: "#fee2e2", color: "#b91c1c" },
};

function WeekBadge({ semana }) {
  if (!semana) return <span className="text-secondary">—</span>;
  return (
    <span className="badge rounded-pill" style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}>
      {semana.codigo}
    </span>
  );
}

function CintaDot({ color }) {
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <span
        className="d-inline-block rounded-circle"
        style={{ width: "0.6rem", height: "0.6rem", backgroundColor: COLOR_HEX[color] || "#94a3b8" }}
      />
      <span className="small">{color}</span>
    </span>
  );
}

export default function MovimientosPage() {
  const [fincas, setFincas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [semanas, setSemanas] = useState([]);

  const [fincaUuid, setFincaUuid] = useState("");
  const [loteUuid, setLoteUuid] = useState("");
  const [semanaEmbolseUuid, setSemanaEmbolseUuid] = useState("");
  const [semanaRegistroDesdeUuid, setSemanaRegistroDesdeUuid] = useState("");
  const [semanaRegistroHastaUuid, setSemanaRegistroHastaUuid] = useState("");
  const [tipo, setTipo] = useState("");

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nuevoOpen, setNuevoOpen] = useState(false);

  useEffect(() => {
    async function loadFiltros() {
      try {
        const year = new Date().getFullYear();
        const [fincasRes, semanasRes] = await Promise.all([
          apiFetch("/fincas?limit=100"),
          apiFetch(`/semanas?limit=55&anio=${year}`),
        ]);
        setFincas(fincasRes.items);
        setSemanas(semanasRes.items);
      } catch (err) {
        setError(err.message);
      }
    }
    loadFiltros();
  }, []);

  useEffect(() => {
    if (!fincaUuid) {
      setLotes([]);
      setLoteUuid("");
      return;
    }
    apiFetch(`/lotes?fincaUuid=${fincaUuid}&limit=100`)
      .then((res) => setLotes(res.items))
      .catch((err) => setError(err.message));
  }, [fincaUuid]);

  async function loadMovimientos() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      if (loteUuid) params.set("loteUuid", loteUuid);
      if (semanaEmbolseUuid) params.set("semanaEmbolseUuid", semanaEmbolseUuid);
      if (semanaRegistroDesdeUuid) params.set("semanaRegistroDesdeUuid", semanaRegistroDesdeUuid);
      if (semanaRegistroHastaUuid) params.set("semanaRegistroHastaUuid", semanaRegistroHastaUuid);
      if (tipo) params.set("tipo", tipo);

      const { items: rows, meta: m } = await apiFetch(`/racimo-movimientos?${params.toString()}`);
      setItems(rows);
      setMeta(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMovimientos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fincaUuid, loteUuid, semanaEmbolseUuid, semanaRegistroDesdeUuid, semanaRegistroHastaUuid, tipo]);

  async function handleDelete(uuid) {
    if (!confirm("¿Eliminar este movimiento? Esto afecta el saldo de la cohorte.")) return;
    try {
      await apiFetch(`/racimo-movimientos/${uuid}`, { method: "DELETE" });
      loadMovimientos();
    } catch (err) {
      setError(err.message);
    }
  }

  const motivoDe = (item) => item.motivoRepique?.nombre || item.motivoRecuse?.nombre || "—";

  return (
    <RequirePermission code="racimo_movimiento.ver">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Movimientos de Racimos</h1>
            <p className="text-secondary mb-0">Historial de embolses, repiques, corte y recuse por cohorte.</p>
          </div>
          <div className="position-relative">
            <button
              type="button"
              className="btn btn-brand rounded-3 d-flex align-items-center gap-2"
              onClick={() => setNuevoOpen((v) => !v)}
            >
              <FiPlus /> Nuevo Movimiento
            </button>
            {nuevoOpen && (
              <div
                className="position-absolute end-0 mt-1 bg-white rounded-3 shadow border py-1"
                style={{ zIndex: 20, minWidth: "12rem" }}
              >
                <Link href="/racimos/embolses" className="dropdown-item small py-2 px-3 d-block text-decoration-none text-dark">
                  Registrar Embolse
                </Link>
                <Link href="/racimos/repiques" className="dropdown-item small py-2 px-3 d-block text-decoration-none text-dark">
                  Registrar Repiques
                </Link>
                <Link href="/racimos/corte" className="dropdown-item small py-2 px-3 d-block text-decoration-none text-dark">
                  Registrar Corte
                </Link>
              </div>
            )}
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Semana registro (desde)</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={semanaRegistroDesdeUuid}
                onChange={(e) => {
                  setPage(1);
                  setSemanaRegistroDesdeUuid(e.target.value);
                }}
              >
                <option value="">Todas</option>
                {semanas.map((s) => (
                  <option key={s.uuid} value={s.uuid}>
                    {s.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Semana registro (hasta)</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={semanaRegistroHastaUuid}
                onChange={(e) => {
                  setPage(1);
                  setSemanaRegistroHastaUuid(e.target.value);
                }}
              >
                <option value="">Todas</option>
                {semanas.map((s) => (
                  <option key={s.uuid} value={s.uuid}>
                    {s.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Finca</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={fincaUuid}
                onChange={(e) => {
                  setPage(1);
                  setFincaUuid(e.target.value);
                  setLoteUuid("");
                }}
              >
                <option value="">Todas</option>
                {fincas.map((f) => (
                  <option key={f.uuid} value={f.uuid}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Lote</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={loteUuid}
                onChange={(e) => {
                  setPage(1);
                  setLoteUuid(e.target.value);
                }}
                disabled={!fincaUuid}
              >
                <option value="">Todos</option>
                {lotes.map((l) => (
                  <option key={l.uuid} value={l.uuid}>
                    {l.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Semana embolse</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={semanaEmbolseUuid}
                onChange={(e) => {
                  setPage(1);
                  setSemanaEmbolseUuid(e.target.value);
                }}
              >
                <option value="">Todas</option>
                {semanas.map((s) => (
                  <option key={s.uuid} value={s.uuid}>
                    {s.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Tipo de movimiento</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={tipo}
                onChange={(e) => {
                  setPage(1);
                  setTipo(e.target.value);
                }}
              >
                <option value="">Todos</option>
                <option value="EMBOLSE">Embolse</option>
                <option value="REPIQUE">Repique</option>
                <option value="PROCESADO">Procesado</option>
                <option value="RECUSE">Recusado</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr className="small">
                  <th>Fecha registro</th>
                  <th>Semana Registro</th>
                  <th>Semana Embolse</th>
                  <th>Cinta</th>
                  <th>Finca</th>
                  <th>Lote</th>
                  <th>Tipo de movimiento</th>
                  <th>Motivo</th>
                  <th className="text-end">Cantidad</th>
                  <th>Usuario</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={11} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center text-secondary py-4">
                      No hay movimientos para los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((item) => {
                    const badge = TIPO_BADGE[item.tipo];
                    const esPositivo = item.tipo === "EMBOLSE";
                    return (
                      <tr key={item.uuid}>
                        <td className="small">{item.fecha}</td>
                        <td>
                          <WeekBadge semana={item.semanaRegistro} />
                        </td>
                        <td>
                          <WeekBadge semana={item.semanaEmbolse} />
                        </td>
                        <td>
                          <CintaDot color={item.semanaEmbolse?.color} />
                        </td>
                        <td className="small">{item.finca?.nombre}</td>
                        <td className="small">{item.lote?.nombre}</td>
                        <td>
                          <span
                            className="badge rounded-pill small"
                            style={{ backgroundColor: badge.bg, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="small">{motivoDe(item)}</td>
                        <td className="text-end small fw-medium" style={{ color: esPositivo ? "#047857" : "#b91c1c" }}>
                          {esPositivo ? "+" : "-"}
                          {item.cantidad.toLocaleString()}
                        </td>
                        <td className="small">{item.creadoPor?.usuario || "Sistema"}</td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(item.uuid)}
                            title="Eliminar"
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3">
          <span className="small text-secondary">
            Mostrando página {meta.page} de {meta.totalPages} ({meta.total} movimientos)
          </span>
          {meta.totalPages > 1 && (
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <FiChevronLeft /> Anterior
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              >
                Siguiente <FiChevronRight />
              </button>
            </div>
          )}
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mt-3">
          <div className="d-flex align-items-center gap-2 mb-2">
            <FiFilter className="text-secondary" />
            <span className="small fw-medium text-secondary">Reglas de cantidad</span>
          </div>
          <div className="small text-secondary">
            Embolse: positivo (+). Los demás movimientos (repique, corte procesado, corte recusado): negativo (-).
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
