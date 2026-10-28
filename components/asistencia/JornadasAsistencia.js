"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { FiChevronDown, FiChevronRight, FiDownload } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { EtiquetaLugar, SelectorUbicacion, aParametros } from "./ubicaciones";
import MapaUbicacionModal from "./MapaUbicacionModal";

const ZONA = "America/Bogota";
const hoyBogota = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const restarDias = (fecha, n) => new Date(new Date(`${fecha}T12:00:00Z`).getTime() - n * 86400000).toISOString().slice(0, 10);

const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: ZONA }) : "—");
const fechaCorta = (f) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
export const duracion = (min) => {
  if (min === null || min === undefined) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
};

const etiquetaColaborador = (c) => `${c.nombre} ${c.apellido || ""}${c.documento ? ` · ${c.documento}` : ""}`.replace(/\s+·/, " ·").trim();

const ESTADO = {
  SIN_SALIDA: { texto: "Sin salida", estilo: { backgroundColor: "#fef3c7", color: "#b45309" } },
  SIN_ENTRADA: { texto: "Sin entrada", estilo: { backgroundColor: "#fef3c7", color: "#b45309" } },
  EN_CURSO: { texto: "En curso", estilo: { backgroundColor: "#dbeafe", color: "#1d4ed8" } },
};

// Hora de una marcación: si tiene GPS es un botón que abre el mapa con el punto donde se marcó.
function HoraMapa({ iso, gps, titulo, detalle, ubicacion, onMapa }) {
  if (!iso) return "—";
  if (!gps) return <span title="Sin ubicación GPS">{hora(iso)}</span>;
  return (
    <button
      type="button"
      className="btn btn-link btn-sm p-0 align-baseline text-decoration-none"
      style={{ fontSize: "inherit" }}
      title="Ver en el mapa"
      onClick={(e) => {
        e.stopPropagation();
        // Finca: el mapa dibuja su perímetro (KML) y su punto guardado; oficina u otro lugar: su punto guardado.
        const esFinca = ubicacion?.tipo === "FINCA";
        onMapa({ ...gps, titulo, detalle, fincaUuid: esFinca ? ubicacion.uuid : null, lugarUuid: ubicacion && !esFinca ? ubicacion.uuid : null });
      }}
    >
      {hora(iso)}
    </button>
  );
}

function Tramos({ tramos, colaborador, onMapa }) {
  return (
    <div className="d-flex flex-column gap-1 py-1">
      {tramos.map((t, i) =>
        t.tipo === "ESTANCIA" ? (
          <div key={i} className="d-flex align-items-center gap-2 flex-wrap">
            <span className="rounded-circle flex-shrink-0" style={{ width: 9, height: 9, backgroundColor: t.estado === "COMPLETA" ? "#16a34a" : "#f59e0b" }} />
            <span className="fw-semibold">{t.finca.nombre}</span>
            {t.finca.tipo && t.finca.tipo !== "FINCA" && <EtiquetaLugar tipo={t.finca.tipo} />}
            <span className="text-secondary">
              <HoraMapa iso={t.entrada} gps={t.entradaGps} ubicacion={t.finca} titulo={`Entrada · ${t.finca.nombre}`} detalle={`${colaborador} · ${hora(t.entrada)}`} onMapa={onMapa} /> –{" "}
              <HoraMapa iso={t.salida} gps={t.salidaGps} ubicacion={t.finca} titulo={`Salida · ${t.finca.nombre}`} detalle={`${colaborador} · ${hora(t.salida)}`} onMapa={onMapa} />
            </span>
            {t.minutos !== null && <span className="fw-medium">· {duracion(t.minutos)}</span>}
            {ESTADO[t.estado] && (
              <span className="badge rounded-pill" style={ESTADO[t.estado].estilo}>
                {ESTADO[t.estado].texto}
              </span>
            )}
          </div>
        ) : (
          <div key={i} className="d-flex align-items-center gap-2 text-secondary ps-1" style={{ fontStyle: "italic" }}>
            <span style={{ width: 9, textAlign: "center" }}>↓</span>
            {t.mismaFinca ? <span>Salió y volvió a {t.desde.nombre}</span> : <span>Tránsito {t.desde.nombre} → {t.hasta.nombre}</span>}
            <span className="fw-medium" style={{ color: t.mismaFinca ? undefined : "#7c3aed" }}>
              · {duracion(t.minutos)}
            </span>
          </div>
        ),
      )}
    </div>
  );
}

// Jornadas: por colaborador y día, cuánto estuvo en cada lugar (finca u oficina: ENTRADA → SALIDA) y cuánto tardó entre uno y otro.
export default function JornadasAsistencia({ fincas, lugares = [], colaboradores, veTodo = true }) {
  const vacios = () => ({ ubicacion: "", colaboradorUuid: "", desde: restarDias(hoyBogota(), 6), hasta: hoyBogota() });
  const [filtros, setFiltros] = useState(vacios);
  const [aplicados, setAplicados] = useState(filtros);
  const [textoColaborador, setTextoColaborador] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ items: [], meta: null });
  const [abiertas, setAbiertas] = useState(() => new Set());
  const [mapa, setMapa] = useState(null); // punto GPS que se muestra en el mapa
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");

  const qsDe = useCallback((f, page, limit) => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    const { ubicacion, ...resto } = f;
    for (const [k, v] of Object.entries({ ...resto, ...aParametros(ubicacion) })) if (v) qs.set(k, v);
    return qs;
  }, []);

  useEffect(() => {
    let activo = true;
    apiFetch(`/asistencia/jornadas?${qsDe(aplicados, pagina, 50)}`)
      .then((d) => activo && (setDatos(d), setError("")))
      .catch((err) => activo && setError(err.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [aplicados, pagina, qsDe]);

  const cambiar = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }));
  const aplicar = () => {
    setCargando(true);
    setPagina(1);
    setAbiertas(new Set());
    setAplicados({ ...filtros });
  };
  const alternar = (clave) =>
    setAbiertas((s) => {
      const n = new Set(s);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });

  async function exportar() {
    setExportando(true);
    try {
      const todas = [];
      for (let page = 1; ; page += 1) {
        const d = await apiFetch(`/asistencia/jornadas?${qsDe(aplicados, page, 200)}`);
        todas.push(...d.items);
        if (!d.meta || page >= d.meta.totalPages) break;
      }
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Jornadas");
      ws.columns = [
        { header: "Fecha", key: "fecha", width: 12 },
        { header: "Colaborador", key: "colaborador", width: 28 },
        { header: "Documento", key: "documento", width: 14 },
        { header: "Cargo", key: "cargo", width: 22 },
        { header: "Tramo", key: "tramo", width: 12 },
        { header: "Lugar", key: "lugar", width: 30 },
        { header: "Desde", key: "desde", width: 11 },
        { header: "Hasta", key: "hasta", width: 11 },
        { header: "Minutos", key: "minutos", width: 10 },
        { header: "Duración", key: "duracion", width: 14 },
        { header: "Estado", key: "estado", width: 12 },
      ];
      for (const j of todas) {
        for (const t of j.tramos) {
          const estancia = t.tipo === "ESTANCIA";
          ws.addRow({
            fecha: j.fecha,
            colaborador: j.colaborador.nombre,
            documento: j.colaborador.documento || "",
            cargo: j.colaborador.cargo || "",
            tramo: estancia ? "Estancia" : t.mismaFinca ? "Fuera" : "Tránsito",
            lugar: estancia ? t.finca.nombre : `${t.desde.nombre} → ${t.hasta.nombre}`,
            desde: hora(estancia ? t.entrada : t.salida),
            hasta: hora(estancia ? t.salida : t.entrada),
            minutos: t.minutos,
            duracion: duracion(t.minutos),
            estado: estancia ? ESTADO[t.estado]?.texto || "Completa" : "",
          });
        }
      }
      const cab = ws.getRow(1);
      cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15803D" } };
      ws.views = [{ state: "frozen", ySplit: 1 }];
      const buffer = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `jornadas-${aplicados.desde}-a-${aplicados.hasta}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportando(false);
    }
  }

  const { items, meta } = datos;

  return (
    <>
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-6 col-md-2">
            <label className="form-label small fw-medium">Ubicación</label>
            <SelectorUbicacion fincas={fincas} lugares={lugares} value={filtros.ubicacion} onChange={(v) => cambiar("ubicacion", v)} />
          </div>
          {veTodo && (
            <div className="col-6 col-md-3">
              <label className="form-label small fw-medium">Colaborador</label>
              <input
                list="colaboradores-jornadas"
                className="form-control form-control-sm rounded-3"
                placeholder="Todos (nombre, apellido o identificación)"
                value={textoColaborador}
                onChange={(e) => {
                  setTextoColaborador(e.target.value);
                  cambiar("colaboradorUuid", colaboradores.find((c) => etiquetaColaborador(c) === e.target.value)?.uuid || "");
                }}
              />
              <datalist id="colaboradores-jornadas">
                {colaboradores.map((c) => (
                  <option key={c.uuid} value={etiquetaColaborador(c)} />
                ))}
              </datalist>
            </div>
          )}
          <div className="col-6 col-md-2">
            <label className="form-label small fw-medium">Desde</label>
            <input type="date" className="form-control form-control-sm rounded-3" value={filtros.desde} onChange={(e) => cambiar("desde", e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-medium">Hasta</label>
            <input type="date" className="form-control form-control-sm rounded-3" value={filtros.hasta} onChange={(e) => cambiar("hasta", e.target.value)} />
          </div>
          <div className="col-6 col-md-1 d-grid">
            <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={aplicar}>
              Aplicar
            </button>
          </div>
          <div className="col-6 col-md-2 d-flex justify-content-end">
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2" disabled={exportando || !items.length} onClick={exportar}>
              <FiDownload /> {exportando ? "Generando..." : "Excel"}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {cargando ? (
        <p className="text-secondary">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="text-secondary">No hay jornadas para estos filtros.</p>
      ) : (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle" style={{ fontSize: "0.78rem" }}>
              <thead className="table-light">
                <tr>
                  <th style={{ width: 28 }} />
                  <th className="fw-medium text-start">Colaborador</th>
                  <th className="fw-medium text-center">Cargo</th>
                  <th className="fw-medium text-center">Fecha</th>
                  <th className="fw-medium text-center">Entrada</th>
                  <th className="fw-medium text-center">Salida</th>
                  <th className="fw-medium text-center">Tiempo en lugares</th>
                  <th className="fw-medium text-center">Tránsito</th>
                  <th className="fw-medium text-center">Lugares</th>
                </tr>
              </thead>
              <tbody>
                {items.map((j) => {
                  const clave = `${j.colaborador.uuid}|${j.fecha}`;
                  const abierta = abiertas.has(clave);
                  return (
                    <Fragment key={clave}>
                      <tr role="button" onClick={() => alternar(clave)}>
                        <td className="text-secondary text-center">{abierta ? <FiChevronDown /> : <FiChevronRight />}</td>
                        <td className="fw-medium">
                          {j.colaborador.nombre}
                          {j.enCurso && (
                            <span className="badge rounded-pill ms-2" style={ESTADO.EN_CURSO.estilo}>
                              En curso
                            </span>
                          )}
                          {j.incompleta && (
                            <span className="badge rounded-pill ms-2" style={ESTADO.SIN_SALIDA.estilo} title="Falta una entrada o una salida">
                              Incompleta
                            </span>
                          )}
                        </td>
                        <td className="text-center text-secondary">{j.colaborador.cargo || "—"}</td>
                        <td className="text-center text-nowrap">{fechaCorta(j.fecha)}</td>
                        <td className="text-center text-nowrap">
                          <HoraMapa iso={j.primeraEntrada} gps={j.primeraEntradaGps} ubicacion={j.primeraEntradaLugar} titulo={`Entrada · ${j.primeraEntradaLugar?.nombre || ""}`} detalle={`${j.colaborador.nombre} · ${fechaCorta(j.fecha)} ${hora(j.primeraEntrada)}`} onMapa={setMapa} />
                        </td>
                        <td className="text-center text-nowrap">
                          <HoraMapa iso={j.ultimaSalida} gps={j.ultimaSalidaGps} ubicacion={j.ultimaSalidaLugar} titulo={`Salida · ${j.ultimaSalidaLugar?.nombre || ""}`} detalle={`${j.colaborador.nombre} · ${fechaCorta(j.fecha)} ${hora(j.ultimaSalida)}`} onMapa={setMapa} />
                        </td>
                        <td className="text-center text-nowrap fw-semibold">{duracion(j.minutosEnFincas)}</td>
                        <td className="text-center text-nowrap" style={{ color: j.minutosTransito ? "#7c3aed" : undefined }}>
                          {j.minutosTransito ? duracion(j.minutosTransito) : "—"}
                        </td>
                        <td className="text-center">{j.lugares}</td>
                      </tr>
                      {abierta && (
                        <tr>
                          <td />
                          <td colSpan={8} className="bg-light">
                            <Tramos tramos={j.tramos} colaborador={j.colaborador.nombre} onMapa={setMapa} />
                            {j.minutosFuera > 0 && <div className="small text-secondary mt-1">Fuera del lugar (salió y volvió): {duracion(j.minutosFuera)}</div>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="d-flex justify-content-center align-items-center gap-3 mt-3 small">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={pagina <= 1} onClick={() => (setCargando(true), setPagina((p) => p - 1))}>
            Anterior
          </button>
          <span>
            Página {meta.page} de {meta.totalPages}
          </span>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={pagina >= meta.totalPages} onClick={() => (setCargando(true), setPagina((p) => p + 1))}>
            Siguiente
          </button>
        </div>
      )}
      {mapa && <MapaUbicacionModal punto={mapa} onClose={() => setMapa(null)} />}
    </>
  );
}
