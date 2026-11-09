"use client";

import { useCallback, useEffect, useState } from "react";
import { FiDownload, FiEdit2, FiPlus, FiSave, FiTrash2, FiX } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";

export const TIPOS_NOVEDAD = {
  VACACIONES: { nombre: "Vacaciones", estilo: { backgroundColor: "#dbeafe", color: "#1d4ed8" } },
  COMPENSATORIO_GANADO: { nombre: "Compensatorio ganado", estilo: { backgroundColor: "#dcfce7", color: "#166534" } },
  COMPENSATORIO_TOMADO: { nombre: "Compensatorio tomado", estilo: { backgroundColor: "#ede9fe", color: "#6d28d9" } },
  INCAPACIDAD: { nombre: "Incapacidad", estilo: { backgroundColor: "#fee2e2", color: "#b91c1c" } },
  PERMISO_REMUNERADO: { nombre: "Permiso remunerado", estilo: { backgroundColor: "#fef3c7", color: "#b45309" } },
  PERMISO_NO_REMUNERADO: { nombre: "Permiso no remunerado", estilo: { backgroundColor: "#fef3c7", color: "#92400e" } },
  LICENCIA: { nombre: "Licencia", estilo: { backgroundColor: "#e0f2fe", color: "#0369a1" } },
  CALAMIDAD: { nombre: "Calamidad", estilo: { backgroundColor: "#f3f4f6", color: "#374151" } },
};
const COMPENSATORIO = ["COMPENSATORIO_GANADO", "COMPENSATORIO_TOMADO"];

export function EtiquetaNovedad({ tipo }) {
  const t = TIPOS_NOVEDAD[tipo];
  if (!t) return null;
  return (
    <span className="badge rounded-pill fw-medium" style={t.estilo}>
      {t.nombre}
    </span>
  );
}

const FILTROS_VACIOS = { search: "", tipo: "", desde: "", hasta: "" };
const FORM_VACIO = { colaboradorUuid: "", tipo: "VACACIONES", fechaDesde: "", fechaHasta: "", horas: "", referencia: "", observaciones: "" };
const fecha = (f) => (f ? new Date(`${f}T12:00:00Z`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

// Novedades de asistencia: vacaciones, compensatorios (en horas), incapacidades, permisos y licencias. `modulo`: solo los
// colaboradores de ese módulo.
export default function NovedadesAsistencia({ modulo = null }) {
  const puedeGestionar = hasPermission("asistencia.novedades.gestionar");
  const [vista, setVista] = useState("registro"); // registro | saldos
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState(FILTROS_VACIOS);
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ items: [], meta: null });
  const [saldos, setSaldos] = useState([]);
  const [horasJornada, setHorasJornada] = useState(8);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null | { ...FORM_VACIO, uuid? }
  const [colaboradores, setColaboradores] = useState([]);
  const [saldoActual, setSaldoActual] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");

  // Filtra a medida que se escribe.
  useEffect(() => {
    const t = setTimeout(() => {
      setAplicados((a) => {
        if (JSON.stringify(a) === JSON.stringify(filtros)) return a;
        setPagina(1);
        return filtros;
      });
    }, 300);
    return () => clearTimeout(t);
  }, [filtros]);

  const qs = useCallback(
    (extra = {}) => {
      const p = new URLSearchParams({ page: String(pagina), limit: "50", ...extra });
      for (const [k, v] of Object.entries(aplicados)) if (v) p.set(k, v);
      if (modulo) p.set("modulo", modulo);
      return p;
    },
    [aplicados, pagina, modulo],
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      if (vista === "registro") {
        const d = await apiFetch(`/asistencia/novedades?${qs()}`);
        setDatos(d);
        setHorasJornada(d.horasJornada || 8);
      } else {
        const p = new URLSearchParams();
        if (aplicados.search) p.set("search", aplicados.search);
        if (modulo) p.set("modulo", modulo);
        const d = await apiFetch(`/asistencia/novedades/saldos?${p}`);
        setSaldos(d.items || []);
        setHorasJornada(d.horasJornada || 8);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [vista, qs, aplicados.search, modulo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!form || colaboradores.length) return;
    apiFetch("/asistencia/novedades/colaboradores")
      .then(setColaboradores)
      .catch((err) => setErrorForm(err.message));
  }, [form, colaboradores.length]);

  // Saldo del colaborador elegido: horas de compensatorio, días de vacaciones disponibles y días hábiles del rango.
  useEffect(() => {
    if (!form?.colaboradorUuid || !["COMPENSATORIO_TOMADO", "VACACIONES"].includes(form.tipo)) {
      setSaldoActual(null);
      return;
    }
    const p = new URLSearchParams();
    if (form.fechaDesde) p.set("desde", form.fechaDesde);
    if (form.fechaDesde) p.set("hasta", form.fechaHasta || form.fechaDesde);
    if (form.uuid) p.set("excluirUuid", form.uuid);
    apiFetch(`/asistencia/novedades/saldo/${form.colaboradorUuid}?${p}`)
      .then(setSaldoActual)
      .catch(() => setSaldoActual(null));
  }, [form?.colaboradorUuid, form?.tipo, form?.fechaDesde, form?.fechaHasta, form?.uuid]);

  const campo = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const filtrar = (k, v) => setFiltros((f) => ({ ...f, [k]: v }));

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setErrorForm("");
    try {
      const esComp = COMPENSATORIO.includes(form.tipo);
      const body = {
        tipo: form.tipo,
        fechaDesde: form.fechaDesde,
        fechaHasta: form.fechaHasta || form.fechaDesde,
        horas: esComp ? Number(String(form.horas).replace(",", ".")) : null,
        referencia: form.referencia || null,
        observaciones: form.observaciones || null,
      };
      if (form.uuid) await apiFetch(`/asistencia/novedades/${form.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      else await apiFetch("/asistencia/novedades", { method: "POST", body: JSON.stringify({ ...body, colaboradorUuid: form.colaboradorUuid }) });
      setForm(null);
      cargar();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(n) {
    if (!confirm(`¿Eliminar la novedad de ${n.colaborador?.nombre} (${TIPOS_NOVEDAD[n.tipo]?.nombre})?`)) return;
    try {
      await apiFetch(`/asistencia/novedades/${n.uuid}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      alert(err.message);
    }
  }

  async function exportarSaldos() {
    const ExcelJS = (await import("exceljs")).default;
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("Saldos");
    hoja.columns = [
      { header: "Colaborador", key: "nombre", width: 32 },
      { header: "Identificación", key: "documento", width: 16 },
      { header: "Cargo", key: "cargo", width: 22 },
      { header: "Fecha de ingreso", key: "ingreso", width: 16 },
      { header: "Vacaciones causadas (días)", key: "vCausadas", width: 22 },
      { header: "Vacaciones tomadas (días)", key: "vTomadas", width: 22 },
      { header: "Vacaciones disponibles (días)", key: "vDisponibles", width: 24 },
      { header: "Horas ganadas", key: "ganadas", width: 14 },
      { header: "Horas tomadas", key: "tomadas", width: 14 },
      { header: "Saldo (h)", key: "saldo", width: 12 },
      { header: `Saldo (días de ${horasJornada} h)`, key: "saldoDias", width: 18 },
    ];
    hoja.getRow(1).font = { bold: true };
    for (const s of saldos)
      hoja.addRow({
        ...s,
        nombre: s.colaborador.nombre,
        documento: s.colaborador.documento || "",
        cargo: s.colaborador.cargo || "",
        ingreso: s.vacaciones?.ingreso || "",
        vCausadas: s.vacaciones?.causadas ?? "",
        vTomadas: s.vacaciones?.tomadas ?? "",
        vDisponibles: s.vacaciones?.disponibles ?? "",
      });
    const blob = new Blob([await libro.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "saldos-vacaciones-compensatorio.xlsx";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const items = datos.items || [];
  const meta = datos.meta;
  const esComp = form && COMPENSATORIO.includes(form.tipo);

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <div className="btn-group btn-group-sm">
          <button type="button" className={`btn ${vista === "registro" ? "btn-brand" : "btn-outline-secondary"}`} onClick={() => setVista("registro")}>
            Registro
          </button>
          <button type="button" className={`btn ${vista === "saldos" ? "btn-brand" : "btn-outline-secondary"}`} onClick={() => setVista("saldos")}>
            Saldos
          </button>
        </div>
        <div className="d-flex gap-2">
          {vista === "saldos" && (
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2" disabled={!saldos.length} onClick={exportarSaldos}>
              <FiDownload /> Excel
            </button>
          )}
          {puedeGestionar && (
            <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => (setErrorForm(""), setForm({ ...FORM_VACIO }))}>
              <FiPlus /> Nueva novedad
            </button>
          )}
        </div>
      </div>

      <div className="card border-0 rounded-2 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md">
              <input type="search" className="form-control form-control-sm rounded-3" placeholder="Buscar nombre o identificación" value={filtros.search} onChange={(e) => filtrar("search", e.target.value)} />
            </div>
            {vista === "registro" && (
              <>
                <div className="col-12 col-md">
                  <select className="form-select form-select-sm rounded-3" value={filtros.tipo} onChange={(e) => filtrar("tipo", e.target.value)} title="Tipo de novedad">
                    <option value="">Todos los tipos</option>
                    {Object.entries(TIPOS_NOVEDAD).map(([k, t]) => (
                      <option key={k} value={k}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-md">
                  <input type="date" className="form-control form-control-sm rounded-3" title="Desde" value={filtros.desde} onChange={(e) => filtrar("desde", e.target.value)} />
                </div>
                <div className="col-6 col-md">
                  <input type="date" className="form-control form-control-sm rounded-3" title="Hasta" value={filtros.hasta} onChange={(e) => filtrar("hasta", e.target.value)} />
                </div>
              </>
            )}
            {Object.values(filtros).some(Boolean) && (
              <div className="col-12 col-md-auto">
                <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => setFiltros(FILTROS_VACIOS)}>
                  Limpiar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          {vista === "registro" ? (
            <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: "0.72rem" }}>
              <thead className="table-light">
                <tr>
                  <th className="fw-medium">Colaborador</th>
                  <th className="fw-medium">Tipo</th>
                  <th className="fw-medium text-center">Desde</th>
                  <th className="fw-medium text-center">Hasta</th>
                  <th className="fw-medium text-center">Días / Horas</th>
                  <th className="fw-medium">Referencia</th>
                  <th className="fw-medium">Observaciones</th>
                  {puedeGestionar && <th className="fw-medium text-end">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={8} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-secondary py-4">
                      No hay novedades para estos filtros.
                    </td>
                  </tr>
                ) : (
                  items.map((n) => (
                    <tr key={n.uuid}>
                      <td className="fw-medium text-nowrap">
                        {n.colaborador?.nombre}
                        {n.colaborador?.cargo && <div className="text-secondary fw-normal">{n.colaborador.cargo}</div>}
                      </td>
                      <td>
                        <EtiquetaNovedad tipo={n.tipo} />
                      </td>
                      <td className="text-center text-nowrap">{fecha(n.fechaDesde)}</td>
                      <td className="text-center text-nowrap">{fecha(n.fechaHasta)}</td>
                      <td className="text-center text-nowrap fw-semibold">
                        {n.horas !== null
                          ? `${n.tipo === "COMPENSATORIO_TOMADO" ? "−" : "+"}${n.horas} h`
                          : n.diasHabiles !== null && n.diasHabiles !== undefined
                            ? `${n.diasHabiles} hábiles`
                            : `${n.dias} ${n.dias === 1 ? "día" : "días"}`}
                      </td>
                      <td className="text-secondary">{n.referencia || "—"}</td>
                      <td className="text-secondary" style={{ maxWidth: 260 }}>
                        {n.observaciones || "—"}
                      </td>
                      {puedeGestionar && (
                        <td className="text-end text-nowrap">
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-secondary p-1 d-inline-flex"
                            title="Editar"
                            onClick={() => (setErrorForm(""), setForm({ ...FORM_VACIO, ...n, colaboradorUuid: n.colaborador?.uuid, horas: n.horas ?? "", referencia: n.referencia || "", observaciones: n.observaciones || "" }))}
                          >
                            <FiEdit2 />
                          </button>
                          <button type="button" className="btn btn-sm btn-link text-danger p-1 d-inline-flex" title="Eliminar" onClick={() => eliminar(n)}>
                            <FiTrash2 />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: "0.72rem" }}>
              <thead className="table-light">
                <tr>
                  <th className="fw-medium" rowSpan={2}>Colaborador</th>
                  <th className="fw-medium" rowSpan={2}>Cargo</th>
                  <th className="fw-medium text-center border-start" colSpan={4}>Vacaciones (días hábiles)</th>
                  <th className="fw-medium text-center border-start" colSpan={3}>Compensatorio (horas)</th>
                </tr>
                <tr>
                  <th className="fw-medium text-center border-start">Ingreso</th>
                  <th className="fw-medium text-center">Causadas</th>
                  <th className="fw-medium text-center">Tomadas</th>
                  <th className="fw-medium text-center">Disponibles</th>
                  <th className="fw-medium text-center border-start">Ganadas</th>
                  <th className="fw-medium text-center">Tomadas</th>
                  <th className="fw-medium text-center">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={9} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                ) : saldos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-secondary py-4">
                      No hay colaboradores para estos filtros.
                    </td>
                  </tr>
                ) : (
                  saldos.map((s) => (
                    <tr key={s.colaborador.uuid}>
                      <td className="fw-medium text-nowrap">{s.colaborador.nombre}</td>
                      <td className="text-secondary">{s.colaborador.cargo || "—"}</td>
                      {s.vacaciones ? (
                        <>
                          <td className="text-center border-start text-nowrap">{fecha(s.vacaciones.ingreso)}</td>
                          <td className="text-center">{s.vacaciones.causadas}</td>
                          <td className="text-center">{s.vacaciones.tomadas}</td>
                          <td className="text-center fw-semibold" style={{ color: s.vacaciones.disponibles < 0 ? "#b91c1c" : "#166534" }}>
                            {s.vacaciones.disponibles}
                          </td>
                        </>
                      ) : (
                        <td colSpan={4} className="text-center text-secondary border-start">
                          Sin fecha de ingreso
                        </td>
                      )}
                      <td className="text-center border-start">{s.ganadas ? `${s.ganadas} h` : "—"}</td>
                      <td className="text-center">{s.tomadas ? `${s.tomadas} h` : "—"}</td>
                      <td className="text-center fw-semibold" style={{ color: s.saldo > 0 ? "#166534" : undefined }}>
                        {s.saldo ? (
                          <>
                            {s.saldo} h <span className="text-secondary fw-normal">({s.saldoDias} días)</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {vista === "registro" && meta && meta.totalPages > 1 && (
        <div className="d-flex justify-content-center align-items-center gap-3 mt-3 small">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </button>
          <span>
            Página {meta.page} de {meta.totalPages}
          </span>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={pagina >= meta.totalPages} onClick={() => setPagina((p) => p + 1)}>
            Siguiente
          </button>
        </div>
      )}

      {form && (
        <ModalShell title={form.uuid ? "Editar novedad" : "Nueva novedad"} onClose={() => setForm(null)}>
          <form onSubmit={guardar} className="row g-2">
            {errorForm && (
              <div className="col-12">
                <div className="alert alert-danger py-2 small mb-0">{errorForm}</div>
              </div>
            )}
            <div className="col-12">
              <label className="form-label small fw-medium">Colaborador</label>
              {form.uuid ? (
                <input className="form-control form-control-sm rounded-3" value={form.colaborador?.nombre || ""} disabled />
              ) : (
                <>
                  <input
                    list="novedad-colaboradores"
                    className="form-control form-control-sm rounded-3"
                    placeholder="Escribe el nombre o la identificación"
                    required
                    onChange={(e) => campo("colaboradorUuid", colaboradores.find((c) => `${c.nombre}${c.documento ? ` · ${c.documento}` : ""}` === e.target.value)?.uuid || "")}
                  />
                  <datalist id="novedad-colaboradores">
                    {colaboradores.map((c) => (
                      <option key={c.uuid} value={`${c.nombre}${c.documento ? ` · ${c.documento}` : ""}`} />
                    ))}
                  </datalist>
                </>
              )}
            </div>
            <div className="col-12">
              <label className="form-label small fw-medium">Tipo</label>
              <select className="form-select form-select-sm rounded-3" value={form.tipo} onChange={(e) => campo("tipo", e.target.value)}>
                {Object.entries(TIPOS_NOVEDAD).map(([k, t]) => (
                  <option key={k} value={k}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small fw-medium">{form.tipo === "COMPENSATORIO_GANADO" ? "Día trabajado (desde)" : "Desde"}</label>
              <input type="date" required className="form-control form-control-sm rounded-3" value={form.fechaDesde} onChange={(e) => campo("fechaDesde", e.target.value)} />
            </div>
            <div className="col-6">
              <label className="form-label small fw-medium">Hasta</label>
              <input type="date" className="form-control form-control-sm rounded-3" value={form.fechaHasta} min={form.fechaDesde || undefined} onChange={(e) => campo("fechaHasta", e.target.value)} />
            </div>
            {esComp && (
              <div className="col-12">
                <label className="form-label small fw-medium">Horas</label>
                <div className="d-flex gap-2 align-items-center">
                  <input type="number" min="0.5" step="0.5" required className="form-control form-control-sm rounded-3" style={{ maxWidth: 140 }} value={form.horas} onChange={(e) => campo("horas", e.target.value)} />
                  <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => campo("horas", String(horasJornada))}>
                    Un día ({horasJornada} h)
                  </button>
                </div>
                {form.tipo === "COMPENSATORIO_TOMADO" && saldoActual && (
                  <div className="small mt-1" style={{ color: saldoActual.saldo > 0 ? "#166534" : "#b91c1c" }}>
                    Saldo disponible: {saldoActual.saldo} h
                  </div>
                )}
              </div>
            )}
            {form.tipo === "VACACIONES" && saldoActual && (
              <div className="col-12 small">
                {saldoActual.diasHabiles !== null && (
                  <div>
                    Días hábiles en el rango: <strong>{saldoActual.diasHabiles}</strong> (lunes a viernes, sin festivos)
                  </div>
                )}
                {saldoActual.vacaciones ? (
                  <div style={{ color: saldoActual.vacaciones.disponibles - (saldoActual.diasHabiles || 0) < 0 ? "#b91c1c" : "#166534" }}>
                    Disponibles: {saldoActual.vacaciones.disponibles} días
                    {saldoActual.diasHabiles ? ` · quedarían ${Math.round((saldoActual.vacaciones.disponibles - saldoActual.diasHabiles) * 100) / 100}` : ""}
                  </div>
                ) : (
                  <div className="text-secondary">El colaborador no tiene fecha de ingreso: no se puede calcular su saldo.</div>
                )}
              </div>
            )}
            <div className="col-12">
              <label className="form-label small fw-medium">Referencia (opcional)</label>
              <input className="form-control form-control-sm rounded-3" maxLength={100} placeholder={form.tipo === "INCAPACIDAD" ? "Número de la incapacidad" : ""} value={form.referencia} onChange={(e) => campo("referencia", e.target.value)} />
            </div>
            <div className="col-12">
              <label className="form-label small fw-medium">Observaciones (opcional)</label>
              <textarea className="form-control form-control-sm rounded-3" rows={2} maxLength={1000} value={form.observaciones} onChange={(e) => campo("observaciones", e.target.value)} />
            </div>
            <div className="col-12 d-flex justify-content-end gap-2 mt-2">
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-1" onClick={() => setForm(null)}>
                <FiX /> Cancelar
              </button>
              <button type="submit" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-1" disabled={guardando || (!form.uuid && !form.colaboradorUuid)}>
                <FiSave /> {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </>
  );
}
