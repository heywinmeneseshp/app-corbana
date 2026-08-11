"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FiFilter, FiPlus, FiChevronLeft, FiChevronRight, FiTrash2, FiDownload } from "react-icons/fi";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import { COLOR_HEX } from "@/lib/semanaColor";

function nombreCompleto(u) {
  return `${u.nombre} ${u.apellido}`.trim();
}

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
        style={{ width: "0.6rem", height: "0.6rem", backgroundColor: COLOR_HEX[color] || "#94a3b8", border: "1px solid #374151" }}
      />
      <span className="small">{color}</span>
    </span>
  );
}

function SemanaAutocomplete({ semanas, value, onChange }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const semanaMap = useMemo(() => {
    const m = {};
    for (const s of semanas) m[s.uuid] = s;
    return m;
  }, [semanas]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (value) { const s = semanaMap[value]; if (s) setText(s.codigo); }
    else setText("");
  }, [value, semanaMap]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filtered = useMemo(() => {
    if (!text) return semanas.slice(0, 20);
    const q = text.toLowerCase();
    return semanas.filter((s) => s.codigo.toLowerCase().includes(q)).slice(0, 20);
  }, [semanas, text]);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Si el usuario escribe el código exacto de una semana (sin llegar a
  // hacer clic en la sugerencia) y sale del campo, se toma igual como
  // elegida — antes quedaba el texto puesto pero sin valor real
  // seleccionado, así que los filtros y el botón de exportar (que valida
  // el valor, no el texto) lo trataban como si no hubiera nada filtrado.
  function confirmarTexto() {
    const q = text.trim().toLowerCase();
    if (!q) {
      if (value) onChange("");
      return;
    }
    const exacta = semanas.find((s) => s.codigo.toLowerCase() === q);
    if (exacta) {
      if (exacta.uuid !== value) onChange(exacta.uuid);
    } else {
      // No coincide con ninguna semana real: revierte al valor vigente (o
      // lo limpia) para no dejar texto que parezca aplicado sin estarlo.
      const actual = value ? semanaMap[value] : null;
      setText(actual ? actual.codigo : "");
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        type="text"
        className="form-control form-control-sm rounded-3"
        style={{ width: "7rem" }}
        value={text}
        placeholder="Todas"
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={confirmarTexto}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmarTexto();
            setOpen(false);
            e.target.blur();
          }
        }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1050,
            maxHeight: "300px", overflowY: "auto",
            background: "#fff", border: "1px solid #d1d5db",
            borderRadius: "0.5rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          }}
        >
          {filtered.map((s) => (
            <div
              key={s.uuid}
              className="px-2 py-1 small"
              style={{ cursor: "pointer" }}
              onMouseDown={() => { onChange(s.uuid); setText(s.codigo); setOpen(false); }}
              onMouseOver={(e) => { e.target.style.background = "#f3f4f6"; }}
              onMouseOut={(e) => { e.target.style.background = ""; }}
            >
              {s.codigo}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MovimientosPage() {
  const puedeEliminar = hasPermission("racimo_movimiento.eliminar");
  const puedeEliminarMasivo = hasPermission("racimo_movimiento.eliminar_masivo");
  const [fincas, setFincas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [fincaUuid, setFincaUuid] = useState("");
  const [loteUuid, setLoteUuid] = useState("");
  const [semanaEmbolseUuid, setSemanaEmbolseUuid] = useState("");
  const [semanaRegistroDesdeUuid, setSemanaRegistroDesdeUuid] = useState("");
  const [semanaRegistroHastaUuid, setSemanaRegistroHastaUuid] = useState("");
  const [usuarioUuid, setUsuarioUuid] = useState("");

  const semanasDisponibles = useMemo(() => {
    const hoy = new Date();
    return semanas.filter((s) => new Date(s.fechaInicio) <= hoy);
  }, [semanas]);

  const [tipo, setTipo] = useState("");
  const [limit, setLimit] = useState(20);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [eliminandoMasivo, setEliminandoMasivo] = useState(false);

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
      try {
        const usuariosRes = await apiFetch("/users?limit=100");
        setUsuarios(usuariosRes.items);
      } catch {
        setUsuarios([]); // sin permiso para listar usuarios: el filtro queda oculto
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
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      if (loteUuid) params.set("loteUuid", loteUuid);
      if (semanaEmbolseUuid) params.set("semanaEmbolseUuid", semanaEmbolseUuid);
      if (semanaRegistroDesdeUuid) params.set("semanaRegistroDesdeUuid", semanaRegistroDesdeUuid);
      if (semanaRegistroHastaUuid) params.set("semanaRegistroHastaUuid", semanaRegistroHastaUuid);
      if (usuarioUuid) params.set("usuarioUuid", usuarioUuid);
      if (tipo) params.set("tipo", tipo);

      const { items: rows, meta: m } = await apiFetch(`/racimo-movimientos?${params.toString()}`);
      setItems(rows);
      setMeta(m);
      setSeleccionados(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMovimientos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, fincaUuid, loteUuid, semanaEmbolseUuid, semanaRegistroDesdeUuid, semanaRegistroHastaUuid, usuarioUuid, tipo]);

  async function handleDelete(uuid) {
    if (!confirm("¿Eliminar este movimiento? Esto afecta el saldo de la cohorte.")) return;
    try {
      await apiFetch(`/racimo-movimientos/${uuid}`, { method: "DELETE" });
      loadMovimientos();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleSeleccionado(uuid) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }

  const filasSeleccionables = items.filter((item) => !item.esHistorico || meta.puedeEliminarHistorico);
  const todasSeleccionadas =
    filasSeleccionables.length > 0 && filasSeleccionables.every((item) => seleccionados.has(item.uuid));

  function toggleSeleccionarTodas() {
    setSeleccionados((prev) => {
      if (todasSeleccionadas) return new Set();
      return new Set(filasSeleccionables.map((item) => item.uuid));
    });
  }

  async function handleDeleteMasivo() {
    const cantidad = seleccionados.size;
    if (cantidad === 0) return;
    if (!confirm(`¿Eliminar ${cantidad} movimiento(s) seleccionados? Esto afecta el saldo de las cohortes.`)) return;
    setEliminandoMasivo(true);
    setError("");
    try {
      await apiFetch("/racimo-movimientos/eliminar-en-lote", {
        method: "POST",
        body: JSON.stringify({ uuids: [...seleccionados] }),
      });
      loadMovimientos();
    } catch (err) {
      setError(err.message);
    } finally {
      setEliminandoMasivo(false);
    }
  }

  const motivoDe = (item) => item.motivoRepique?.nombre || item.motivoRecuse?.nombre || "—";

  async function exportToExcel() {
    const tieneSemanaRegistro = semanaRegistroDesdeUuid && semanaRegistroHastaUuid;
    const tieneSemanaEmbolse = !!semanaEmbolseUuid;
    if (!tieneSemanaRegistro && !tieneSemanaEmbolse) {
      setError("Debe filtrar por rango de semana de registro o por semana de embolse antes de exportar.");
      return;
    }
    try {
      const params = new URLSearchParams();
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      if (loteUuid) params.set("loteUuid", loteUuid);
      if (semanaEmbolseUuid) params.set("semanaEmbolseUuid", semanaEmbolseUuid);
      if (semanaRegistroDesdeUuid) params.set("semanaRegistroDesdeUuid", semanaRegistroDesdeUuid);
      if (semanaRegistroHastaUuid) params.set("semanaRegistroHastaUuid", semanaRegistroHastaUuid);
      if (usuarioUuid) params.set("usuarioUuid", usuarioUuid);
      if (tipo) params.set("tipo", tipo);

      const blob = await apiFetchBlob(`/racimo-movimientos/exportar?${params.toString()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `movimientos-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="racimo_movimiento.ver">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Movimientos de Racimos</h1>
            <p className="text-secondary mb-0">Historial de embolses, repiques, corte y recuse por cohorte.</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary rounded-3 d-flex align-items-center gap-2"
              onClick={exportToExcel}
            >
              <FiDownload /> Exportar Excel
            </button>
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
          </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Semana registro (desde)</label>
              <SemanaAutocomplete semanas={semanasDisponibles} value={semanaRegistroDesdeUuid} onChange={(uuid) => { setPage(1); setSemanaRegistroDesdeUuid(uuid); }} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Semana registro (hasta)</label>
              <SemanaAutocomplete semanas={semanasDisponibles} value={semanaRegistroHastaUuid} onChange={(uuid) => { setPage(1); setSemanaRegistroHastaUuid(uuid); }} />
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
              <SemanaAutocomplete semanas={semanasDisponibles} value={semanaEmbolseUuid} onChange={(uuid) => { setPage(1); setSemanaEmbolseUuid(uuid); }} />
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
            {usuarios.length > 0 && (
              <div className="col-6 col-md-2">
                <label className="form-label small fw-medium mb-1">Usuario</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={usuarioUuid}
                  onChange={(e) => {
                    setPage(1);
                    setUsuarioUuid(e.target.value);
                  }}
                >
                  <option value="">Todos</option>
                  {usuarios.map((u) => (
                    <option key={u.uuid} value={u.uuid}>
                      {nombreCompleto(u)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Filas por página</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={limit}
                onChange={(e) => {
                  setPage(1);
                  setLimit(Number(e.target.value));
                }}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>
        </div>

        {puedeEliminarMasivo && seleccionados.size > 0 && (
          <div className="alert alert-warning py-2 px-3 mb-3 d-flex align-items-center justify-content-between gap-2">
            <span className="small fw-medium">{seleccionados.size} movimiento(s) seleccionados</span>
            <button
              type="button"
              className="btn btn-sm btn-danger rounded-3 d-flex align-items-center gap-1"
              onClick={handleDeleteMasivo}
              disabled={eliminandoMasivo}
            >
              <FiTrash2 /> {eliminandoMasivo ? "Eliminando..." : "Eliminar seleccionados"}
            </button>
          </div>
        )}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr className="small">
                  {puedeEliminarMasivo && (
                    <th style={{ width: "2rem" }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={todasSeleccionadas}
                        onChange={toggleSeleccionarTodas}
                        disabled={filasSeleccionables.length === 0}
                        title="Seleccionar todas"
                      />
                    </th>
                  )}
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
                    <td colSpan={puedeEliminarMasivo ? 12 : 11} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={puedeEliminarMasivo ? 12 : 11} className="text-center text-secondary py-4">
                      No hay movimientos para los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((item) => {
                    const badge = TIPO_BADGE[item.tipo];
                    const esPositivo = item.tipo === "EMBOLSE";
                    const esSeleccionable = !item.esHistorico || meta.puedeEliminarHistorico;
                    return (
                      <tr key={item.uuid}>
                        {puedeEliminarMasivo && (
                          <td>
                            {esSeleccionable && (
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={seleccionados.has(item.uuid)}
                                onChange={() => toggleSeleccionado(item.uuid)}
                              />
                            )}
                          </td>
                        )}
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
                          {puedeEliminar && (!item.esHistorico || meta.puedeEliminarHistorico) && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(item.uuid)}
                              title="Eliminar"
                            >
                              <FiTrash2 />
                            </button>
                          )}
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
