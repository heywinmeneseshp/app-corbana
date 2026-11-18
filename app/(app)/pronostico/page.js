"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiActivity, FiDownload, FiRefreshCw, FiChevronDown, FiChevronUp, FiAlertTriangle, FiBarChart2, FiChevronRight } from "react-icons/fi";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import ProyeccionAnual from "@/components/proyeccion/ProyeccionAnual";
import GraficoRatio from "@/components/precalibracion/GraficoRatio";
import GraficasSemanalModal from "@/components/proyeccion/GraficasSemanalModal";
import ModalShell from "@/components/ModalShell";
import PorProducto from "@/components/proyeccion/PorProducto";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { calcularColorSemana, COLOR_HEX, COLOR_TEXT } from "@/lib/semanaColor";

const SEMANAS_OPCIONES = [4, 8, 12, 26, 52];
const SEMANAS_MAX = 53; // hasta un año calendario completo

const CONFIANZA_ESTILO = {
  Real: { bg: "#e2e8f0", color: "#334155" },
  Alta: { bg: "#dcfce7", color: "#166534" },
  Media: { bg: "#fef3c7", color: "#92400e" },
  Baja: { bg: "#fee2e2", color: "#991b1b" },
};

function rowKey(row) {
  return `${row.fincaUuid}-${row.semanaUuid}`;
}

// Origen de los racimos de cada edad: saldo real de la cinta, embolse real, o estimado por hectáreas × embolse por ha histórico.
const ORIGEN_EDAD = {
  saldo: { color: "#16a34a", texto: "saldo real" },
  embolse: { color: "#16a34a", texto: "embolse real" },
  real: { color: "#16a34a", texto: "real" },
  estimado: { color: "#f59e0b", texto: "estimado por hectáreas" },
  mixto: { color: "#65a30d", texto: "saldo real y estimado" },
};

function DistribucionEdad({ ageBreakdown }) {
  const max = Math.max(1, ...ageBreakdown.map((a) => a.racimos));
  return (
    <div className="d-flex align-items-end justify-content-center gap-1" style={{ height: 28 }} title={
      ageBreakdown.map((a) => `Edad ${a.edad}: ${a.racimos.toLocaleString("es")} racimos${a.origen ? ` (${ORIGEN_EDAD[a.origen]?.texto || a.origen})` : ""}`).join(" · ")
    }>
      {ageBreakdown.map((a) => (
        <div
          key={a.edad}
          style={{
            width: 6,
            height: Math.max(2, Math.round((a.racimos / max) * 24)),
            backgroundColor: ORIGEN_EDAD[a.origen]?.color || "#16a34a",
            opacity: 0.85,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}

const EDADES_COSECHA = [8, 9, 10, 11, 12];
const SIN_OCULTAS = new Set();

// Cajas por producto de la proyección semanal: reparte las Cajas Proyectadas de cada semana con la misma lógica de la proyección anual.
// Usa su propia configuración si está guardada; si no, la del escenario anual (y se puede volver a ella).
function ProductosSemanal({ data, puedeEditar }) {
  const [cfg, setCfg] = useState(null); // { origen, escenario, productos }
  const [productos, setProductos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    apiFetch("/pronostico/productos")
      .then((r) => {
        setCfg(r);
        setProductos(r.productos || []);
      })
      .catch((err) => setError(err.message));
  }, []);
  const resultado = useMemo(() => {
    const cajasDe = (r, extra) => (extra ?? r.cajas20kg) + (r.cajasAdicionales || 0);
    const grupos = new Map();
    const filas = data.rows.map((r) => {
      const fincaUuid = r.fincaUuid ?? "GLOBAL";
      grupos.set(fincaUuid, r.fincaNombre || "Todas las fincas");
      const normal = r.cajasProyectada ?? r.cajasTotal ?? r.cajas20kg;
      return {
        fincaUuid,
        fincaNombre: r.fincaNombre || "Todas las fincas",
        semanaCodigo: r.semanaCodigo,
        numeroSemana: r.numeroSemana,
        fechaInicio: r.fechaInicio,
        real: r.real,
        cajas: normal,
        cajasBajo: r.cajasProyectadaManual ? normal : cajasDe(r, r.cajasCiLow),
        cajasAlto: r.cajasProyectadaManual ? normal : cajasDe(r, r.cajasCiHigh),
      };
    });
    return {
      meta: { tasaConversion: data.meta?.tasaConversion ?? 18.6, anio: data.meta?.semanaInicio?.anio },
      filas,
      aprovechamiento: [...grupos.entries()].map(([fincaUuid, fincaNombre]) => ({ fincaUuid, fincaNombre })),
    };
  }, [data]);
  const sucio = cfg && JSON.stringify(productos) !== JSON.stringify(cfg.productos);

  async function guardar() {
    setError("");
    setGuardando(true);
    try {
      const items = productos.map((x) => ({
        productoUuid: x.uuid,
        modo: x.modo || "PORCENTAJE",
        porcentaje: x.modo === "PORCENTAJE" || !x.modo ? Number(x.porcentaje) : null,
        contenedores: x.modo === "CONTENEDORES" ? Number(x.contenedores) : null,
        cajasContenedor: x.modo === "CONTENEDORES" || x.modo === "FINCA" ? x.cajasContenedor ?? null : null,
        cadaSemanas: x.modo === "CONTENEDORES" ? x.cadaSemanas || 1 : 1,
        desdeSemana: x.modo === "CONTENEDORES" ? x.desdeSemana || 1 : 1,
        fincaUuids: x.modo === "FINCA" ? x.fincaUuids || [] : [],
      }));
      const r = await apiFetch("/pronostico/productos", { method: "PUT", body: JSON.stringify({ productos: items }) });
      setCfg(r);
      setProductos(r.productos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }
  async function usarAnual() {
    if (!window.confirm("¿Volver a usar el reparto por producto del escenario anual? Se borra la configuración propia de la proyección semanal.")) return;
    setError("");
    try {
      const r = await apiFetch("/pronostico/productos", { method: "DELETE" });
      setCfg(r);
      setProductos(r.productos || []);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 mt-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <button type="button" className="btn btn-link p-0 text-decoration-none text-dark fw-semibold d-flex align-items-center gap-1" onClick={() => setAbierto((v) => !v)}>
          {abierto ? <FiChevronDown /> : <FiChevronRight />} Cajas por producto
        </button>
        {cfg && (
          <span className="small text-secondary">
            {cfg.origen === "propia" ? "Configuración propia de la proyección semanal" : cfg.origen === "anual" ? `Tomada del escenario anual «${cfg.escenario?.nombre}»` : "Sin configuración de productos"}
          </span>
        )}
      </div>
      {abierto && (
        <div className="mt-2">
          {error && <div className="alert alert-danger py-2 small">{error}</div>}
          <p className="small text-secondary mb-2">
            Reparte las <strong>Cajas Proyectadas</strong> de cada semana entre productos, igual que en la Proyección anual. Al editar los productos aquí y guardar, la
            proyección semanal usa su propia configuración; mientras no la tenga, usa la del escenario anual.
          </p>
          {puedeEditar && (
            <div className="d-flex flex-wrap gap-2 mb-2">
              <button type="button" className="btn btn-brand btn-sm" disabled={!sucio || guardando} onClick={guardar}>
                {guardando ? "Guardando..." : "Guardar distribución"}
              </button>
              {sucio && (
                <button type="button" className="btn btn-link btn-sm text-secondary" onClick={() => setProductos(cfg.productos || [])}>
                  Descartar cambios
                </button>
              )}
              {cfg?.origen === "propia" && (
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={usarAnual}>
                  Usar la del escenario anual
                </button>
              )}
            </div>
          )}
          {cfg && <PorProducto resultado={resultado} ocultas={SIN_OCULTAS} productos={productos} onChange={setProductos} puedeEditar={puedeEditar} nombreEscenario="Proyección semanal" soloNormal />}
        </div>
      )}
    </div>
  );
}

// Detalle de la columna "Estimación Finca": lo que estimó cada finca (propias y luego externas) en cada semana de la tabla, con totales.
function EstimacionFincasModal({ detalle, onClose }) {
  const { fincas = [], semanas = [], valores = {} } = detalle || {};
  const fmt0 = (v) => (v == null ? "—" : Number(v).toLocaleString("es", { maximumFractionDigits: 0 }));
  const totalSemana = (sc) => fincas.reduce((a, f) => a + (valores[f.uuid]?.[sc] || 0), 0);
  const totalFinca = (u) => semanas.reduce((a, sc) => a + (valores[u]?.[sc] || 0), 0);
  return (
    <ModalShell title="Estimación de las fincas por semana" onClose={onClose} size="xl">
      {fincas.length === 0 ? (
        <p className="small text-secondary mb-0">No hay estimaciones registradas para estas semanas.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0 align-middle text-center" style={{ fontSize: "0.82rem" }}>
            <thead className="table-light">
              <tr>
                <th className="text-start">Finca</th>
                {semanas.map((sc) => (
                  <th key={sc}>{sc}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {fincas.map((f) => (
                <tr key={f.uuid}>
                  <td className="text-start text-nowrap">
                    {f.nombre}
                    {f.externa && <span className="badge rounded-1 ms-1 fw-normal" style={{ background: "#e2e8f0", color: "#334155", fontSize: "0.65rem" }}>externa</span>}
                  </td>
                  {semanas.map((sc) => (
                    <td key={sc}>{fmt0(valores[f.uuid]?.[sc])}</td>
                  ))}
                  <td className="fw-semibold">{fmt0(totalFinca(f.uuid))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-light fw-bold">
                <td className="text-start">Total</td>
                {semanas.map((sc) => (
                  <td key={sc}>{fmt0(totalSemana(sc))}</td>
                ))}
                <td>{fmt0(semanas.reduce((a, sc) => a + totalSemana(sc), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </ModalShell>
  );
}

// Patrón de corte de las últimas 5 semanas liquidadas: cada fila es la cinta que cumplió 12 semanas en esa semana liquidada (cosecha terminada): % de lo procesado en cada edad y
// aprovechamiento ((procesado + recusado) ÷ embolsado), como en el panel inicial y Estimaciones. `porGrupo`: { [fincaUuid | "GLOBAL"]: filas }.
function PatronCorteCard({ porGrupo, grupos }) {
  const [grupo, setGrupo] = useState(grupos[0]?.clave);
  const filas = porGrupo?.[grupo] || [];
  const promedio = EDADES_COSECHA.map((e) => {
    const v = filas.map((f) => f.porEdad.find((p) => p.edad === e)?.porcentaje).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });
  const aprov = filas.map((f) => f.aprovechamiento).filter((x) => x != null);
  const aprovProm = aprov.length ? aprov.reduce((a, b) => a + b, 0) / aprov.length : null;
  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
        <div className="fw-semibold small">Patrón de corte</div>
        {grupos.length > 1 && (
          <select className="form-select form-select-sm rounded-1" style={{ width: "auto" }} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
            {grupos.map((g) => (
              <option key={g.clave} value={g.clave}>
                {g.nombre}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="small text-secondary mb-2">Cada fila es la cinta (semana de embolse) que cumplió 12 semanas en la semana liquidada indicada (últimas 5 liquidadas); muestra el % de sus racimos procesados que se cortó en cada edad.</div>
      {filas.length === 0 ? (
        <div className="small text-secondary">Todavía no hay semanas liquidadas.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm mb-0 text-center" style={{ fontSize: "0.8rem" }}>
            <thead className="table-light">
              <tr>
                <th>Liquidada</th>
                <th>Cinta</th>
                {EDADES_COSECHA.map((e) => (
                  <th key={e}>{e} sem.</th>
                ))}
                <th>Aprov.</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const nombre = calcularColorSemana(f.cinta.anio, f.cinta.numeroSemana);
                return (
                  <tr key={f.cinta.codigo}>
                    <td className="text-secondary">{f.semanaLiquidada}</td>
                    <td>
                      <span className="badge rounded-pill" style={{ backgroundColor: COLOR_HEX[nombre], color: COLOR_TEXT[nombre] }} title={`${nombre} · ${f.edadHoy} semanas de edad`}>
                        {f.cinta.codigo}
                      </span>
                    </td>
                    {f.porEdad.map((p) => (
                      <td key={p.edad}>{p.porcentaje == null ? "—" : `${p.porcentaje.toFixed(1)}%`}</td>
                    ))}
                    <td className="fw-semibold">{f.aprovechamiento == null ? "—" : `${(f.aprovechamiento * 100).toFixed(1)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="table-light fw-bold">
                <td colSpan={2}>Promedio</td>
                {promedio.map((v, i) => (
                  <td key={i}>{v == null ? "—" : `${v.toFixed(1)}%`}</td>
                ))}
                <td>{aprovProm == null ? "—" : `${(aprovProm * 100).toFixed(1)}%`}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// Encabezado de columna que abre las gráficas de ese indicador (como en Proyección anual).
function ThGrafica({ metrica, onGraficas, children, className = "" }) {
  return (
    <th className={className}>
      <span role="button" className="text-nowrap" style={{ cursor: "pointer", borderBottom: "1px dashed #94a3b8" }} title="Clic para ver las gráficas" onClick={() => onGraficas(metrica)}>
        {children} <FiBarChart2 size={11} className="text-secondary" />
      </span>
    </th>
  );
}

// Resumen de una simulación: error de las cajas y del ratio contra lo que realmente ocurrió, por total y por horizonte.
function ResumenSimulacion({ data }) {
  const filas = data.rows.filter((r) => r.cajasReales != null);
  if (filas.length === 0) {
    return <div className="alert alert-info py-2 small">Simulación al {data.meta.simulacion.fecha}: todavía no hay datos reales para comparar.</div>;
  }
  const porSemana = new Map();
  for (const r of filas) {
    const acc = porSemana.get(r.semanaCodigo) || { proy: 0, real: 0, ratioP: 0, ratioR: 0, n: 0 };
    acc.proy += r.cajas20kg;
    acc.real += r.cajasReales;
    if (r.ratioReal != null) {
      acc.ratioP += r.ratio;
      acc.ratioR += r.ratioReal;
      acc.n += 1;
    }
    porSemana.set(r.semanaCodigo, acc);
  }
  const semanas = [...porSemana.values()];
  const mape = (semanas.reduce((a, s) => a + Math.abs(s.proy - s.real) / s.real, 0) / semanas.length) * 100;
  const sesgo = (semanas.reduce((a, s) => a + (s.proy - s.real) / s.real, 0) / semanas.length) * 100;
  const totalProy = semanas.reduce((a, s) => a + s.proy, 0);
  const totalReal = semanas.reduce((a, s) => a + s.real, 0);
  return (
    <div className="alert alert-info py-2 small">
      <strong>Simulación al {data.meta.simulacion.fecha}</strong> (semana {data.meta.simulacion.semana}): se pronosticó con lo que se sabía ese día y se
      comparó con lo real en {semanas.length} semanas. Error medio de las cajas por semana: <strong>{mape.toFixed(1)}%</strong>, sesgo{" "}
      <strong>{sesgo > 0 ? "+" : ""}{sesgo.toFixed(1)}%</strong> ({sesgo > 0 ? "sobreestima" : "subestima"}). Total proyectado{" "}
      {totalProy.toLocaleString("es", { maximumFractionDigits: 0 })} cajas contra {totalReal.toLocaleString("es", { maximumFractionDigits: 0 })} reales (
      {((totalProy / totalReal - 1) * 100).toFixed(1)}%).
    </div>
  );
}

function PronosticoSemanal() {
  const [fincas, setFincas] = useState([]);
  const [fincaUuidsSeleccionadas, setFincaUuidsSeleccionadas] = useState([]);
  const [todasFincas, setTodasFincas] = useState(true);

  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [semanasDelAnio, setSemanasDelAnio] = useState([]);
  const [semanaInicioUuid, setSemanaInicioUuid] = useState("");
  // "Semanas a proyectar" se recuerda por usuario en este navegador, para no tener que elegirlo cada vez.
  const claveSemanas = () => {
    const u = typeof window !== "undefined" ? getCurrentUser() : null;
    return `pronostico.semanas.${u?.uuid || u?.id || u?.usuario || "anon"}`;
  };
  const [semanasProyectar, setSemanasProyectar] = useState(() => {
    try {
      const v = Number(localStorage.getItem(claveSemanas()));
      return v >= 1 && v <= SEMANAS_MAX ? v : 8;
    } catch {
      return 8;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(claveSemanas(), String(semanasProyectar));
    } catch {
      // sin almacenamiento local: dura mientras la página esté abierta
    }
  }, [semanasProyectar]);
  // Simulación: pronosticar como si hoy fuera una fecha pasada, para compararlo con lo que realmente ocurrió.
  const [simularDesde, setSimularDesde] = useState("");
  // Ventana de la gráfica del ratio (semanas antes y después de hoy); se aplica al pulsar Enter o salir del campo.
  const [ratioPasadas, setRatioPasadas] = useState(26);
  const [ratioFuturas, setRatioFuturas] = useState(26);
  // Año en particular para comparar en el gráfico de ratio ("" = ninguno).
  const [anioRatio, setAnioRatio] = useState("");

  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [pctNoCosechadoInput, setPctNoCosechadoInput] = useState("");
  const [pctNoCosechadoAplicado, setPctNoCosechadoAplicado] = useState(null);

  const [editandoRatio, setEditandoRatio] = useState(null);
  const [editandoAdicional, setEditandoAdicional] = useState(null);
  const [editandoProyectada, setEditandoProyectada] = useState(null);
  const [verEstimacionFincas, setVerEstimacionFincas] = useState(false);
  // El ratio editado se guarda para todos (solo en semanas proyectadas) y se refleja en la tabla, las cajas y el gráfico de ratio.
  const puedeEditarRatio = hasPermission("proyeccion.editar");
  // Indicador cuyas gráficas se muestran (null = cerrado).
  const [graficas, setGraficas] = useState(null);
  // Semanas desplegadas (detalle de racimos por edad).
  const [abiertas, setAbiertas] = useState(new Set());
  const alternarSemana = (key) =>
    setAbiertas((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((res) => setFincas(res.items))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    apiFetch(`/semanas?limit=55&anio=${anio}`)
      .then((res) => setSemanasDelAnio(res.items))
      .catch((err) => setError(err.message));
  }, [anio]);

  function toggleFinca(uuid) {
    setTodasFincas(false);
    setFincaUuidsSeleccionadas((prev) =>
      prev.includes(uuid) ? prev.filter((u) => u !== uuid) : [...prev, uuid]
    );
  }

  function seleccionarTodas() {
    setTodasFincas(true);
    setFincaUuidsSeleccionadas([]);
  }

  function buildParams() {
    const params = new URLSearchParams({ semanas: String(semanasProyectar) });
    if (!todasFincas && fincaUuidsSeleccionadas.length > 0) {
      params.set("fincaUuids", fincaUuidsSeleccionadas.join(","));
    }
    params.set("ratioPasadas", String(ratioPasadas));
    params.set("ratioFuturas", String(ratioFuturas));
    if (simularDesde) params.set("simularDesde", simularDesde);
    else if (semanaInicioUuid) params.set("semanaInicioUuid", semanaInicioUuid);
    if (pctNoCosechadoAplicado !== null) params.set("pctNoCosechado", String(pctNoCosechadoAplicado));
    return params;
  }

  async function handleConsultar() {
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch(`/pronostico?${buildParams().toString()}`);
      setData(res);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const filtrosKey = JSON.stringify({
    todasFincas,
    fincaUuidsSeleccionadas,
    semanaInicioUuid,
    semanasProyectar,
    pctNoCosechadoAplicado,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleConsultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosKey]);

  async function handleExportar() {
    try {
      const blob = await apiFetchBlob(`/pronostico/exportar?${buildParams().toString()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pronostico-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  function aplicarOverride() {
    if (pctNoCosechadoInput === "") {
      setPctNoCosechadoAplicado(null);
      return;
    }
    const valor = Number(pctNoCosechadoInput) / 100;
    if (Number.isNaN(valor) || valor < 0 || valor > 0.9) {
      setError("El % no cosechado debe estar entre 0 y 90.");
      return;
    }
    setPctNoCosechadoAplicado(valor);
  }

  function restablecerOverride() {
    setPctNoCosechadoInput("");
    setPctNoCosechadoAplicado(null);
  }

  // Cajas adicionales: por defecto la estimación de las fincas externas. Editarlas guarda el valor (también 0); `null` (botón ↺ o dejar el
  // campo vacío) vuelve a la estimación. Se actualiza solo esa fila, sin recargar.
  async function guardarAdicional(row, texto) {
    const limpio = texto === null ? "" : String(texto).trim().replace(",", ".");
    const cajas = limpio === "" ? null : Number(limpio);
    if (cajas !== null && (Number.isNaN(cajas) || cajas < 0)) {
      setError("Las cajas adicionales deben ser un número mayor o igual a 0.");
      return;
    }
    if (cajas === null && !row.cajasAdicionalesManual) return;
    if (cajas !== null && row.cajasAdicionalesManual && Math.abs(cajas - (row.cajasAdicionales || 0)) < 0.005) return;
    if (cajas !== null && !row.cajasAdicionalesManual && Math.abs(cajas - (row.cajasAdicionalesEstimado || 0)) < 0.005) return;
    try {
      await apiFetch("/pronostico/cajas-adicionales", { method: "PUT", body: JSON.stringify({ fincaUuid: row.fincaUuid || null, semanaCodigo: row.semanaCodigo, cajas }) });
      setData((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((r) => {
                if (r.fincaUuid !== row.fincaUuid || r.semanaCodigo !== row.semanaCodigo) return r;
                const v = cajas === null ? r.cajasAdicionalesEstimado || 0 : cajas;
                const total = Math.round((r.cajas20kg + v) * 100) / 100;
                return { ...r, cajasAdicionales: v, cajasAdicionalesManual: cajas !== null, cajasTotal: total, cajasProyectada: r.cajasProyectadaManual ? r.cajasProyectada : total };
              }),
            }
          : prev,
      );
    } catch (err) {
      setError(err.message);
    }
  }

  // "Cajas Proyectadas": por defecto la Estimación; editarla guarda el valor, `null` (↺ o campo vacío) la devuelve a la Estimación. Sin recargar.
  async function guardarProyectada(row, texto) {
    const limpio = texto === null ? "" : String(texto).trim().replace(",", ".");
    const cajas = limpio === "" ? null : Number(limpio);
    if (cajas !== null && (Number.isNaN(cajas) || cajas < 0)) {
      setError("Las cajas proyectadas deben ser un número mayor o igual a 0.");
      return;
    }
    if (cajas === null && !row.cajasProyectadaManual) return;
    if (cajas !== null && Math.abs(cajas - (row.cajasProyectada ?? 0)) < 0.005) return;
    try {
      await apiFetch("/pronostico/cajas-proyectada", { method: "PUT", body: JSON.stringify({ fincaUuid: row.fincaUuid || null, semanaCodigo: row.semanaCodigo, cajas }) });
      setData((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((r) =>
                r.fincaUuid === row.fincaUuid && r.semanaCodigo === row.semanaCodigo
                  ? { ...r, cajasProyectadaManual: cajas !== null, cajasProyectada: cajas === null ? r.cajasTotal : cajas }
                  : r,
              ),
            }
          : prev,
      );
    } catch (err) {
      setError(err.message);
    }
  }

  // Guarda el ratio editado de una semana proyectada (vacío = volver al calculado) y recarga la proyección.
  async function guardarRatio(row, texto) {
    const limpio = String(texto).trim().replace(",", ".");
    const ratio = limpio === "" ? null : Number(limpio);
    if (ratio !== null && (Number.isNaN(ratio) || ratio < 0 || ratio > 5)) {
      setError("El ratio debe ser un número entre 0 y 5.");
      return;
    }
    if (ratio !== null && Math.abs(ratio - row.ratio) < 0.00005) return;
    if (ratio === null && !row.ratioManual) return;
    try {
      await apiFetch("/pronostico/ratio-manual", { method: "PUT", body: JSON.stringify({ fincaUuid: row.fincaUuid || null, semanaCodigo: row.semanaCodigo, ratio }) });
      if (ratio === null) {
        // Volver al calculado: el valor lo calcula el servidor, se trae en segundo plano sin recargar la tabla.
        const res = await apiFetch(`/pronostico?${buildParams().toString()}`);
        setData(res);
        return;
      }
      // Ratio nuevo: se actualiza solo esa fila (cajas, marca de editado) y el punto del gráfico de ratio, sin recargar la página.
      setData((prev) => {
        if (!prev) return prev;
        const rows = prev.rows.map((r) => {
          if (r.fincaUuid !== row.fincaUuid || r.semanaCodigo !== row.semanaCodigo) return r;
          const factor = r.ratio > 0 ? ratio / r.ratio : null;
          return {
            ...r,
            ratio,
            cajas20kg: Math.round(r.racimosCosechados * ratio * 100) / 100,
            cajasTotal: Math.round((r.racimosCosechados * ratio + (r.cajasAdicionales || 0)) * 100) / 100,
            cajasProyectada: r.cajasProyectadaManual ? r.cajasProyectada : Math.round((r.racimosCosechados * ratio + (r.cajasAdicionales || 0)) * 100) / 100,
            cajasCiLow: factor != null && r.cajasCiLow != null ? Math.round(r.cajasCiLow * factor * 100) / 100 : r.cajasCiLow,
            cajasCiHigh: factor != null && r.cajasCiHigh != null ? Math.round(r.cajasCiHigh * factor * 100) / 100 : r.cajasCiHigh,
            ratioManual: true,
          };
        });
        const deLaSemana = rows.filter((r) => !r.real && r.semanaCodigo === row.semanaCodigo).map((r) => r.ratio);
        const ratioSerie = prev.ratioSerie
          ? {
              ...prev.ratioSerie,
              serie: prev.ratioSerie.serie.map((pt) =>
                pt.anio === row.anio && pt.numeroSemana === row.numeroSemana && deLaSemana.length
                  ? { ...pt, ratioProyectado: Math.round((deLaSemana.reduce((a, b) => a + b, 0) / deLaSemana.length) * 1000) / 1000 }
                  : pt,
              ),
            }
          : prev.ratioSerie;
        return { ...prev, rows, ratioSerie };
      });
    } catch (err) {
      setError(err.message);
    }
  }

  // Basado en las filas (no en meta.fincas): "Todas" produce un solo grupo
  // global agregado por semana, no una fila por finca — meta.fincas sigue
  // listando todas las fincas incluidas en la suma, pero eso no debe
  // decidir si se muestra la columna Finca.
  const mostrarColumnaFinca = new Set((data?.rows || []).map((r) => r.fincaCodigo)).size > 1;
  const pctHistoricoLabel = useMemo(() => {
    const v = data?.meta?.pctNoCosechadoHistoricoPromedio;
    return v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;
  }, [data]);

  return (
    <>
      <div>
        <div className="mb-4 d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
              <FiActivity /> Proyección semanal
            </h1>
            <p className="text-secondary mb-0">Proyección de cajas 20kg por finca: saldos reales por cinta y, donde no hay saldo, embolse estimado con hectáreas productivas y el comportamiento de años pasados.</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={handleExportar}
              disabled={!data || data.rows.length === 0}
            >
              <FiDownload /> Exportar Excel
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={handleConsultar}
              disabled={loading}
              title="Actualizar"
            >
              <FiRefreshCw className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {data?.meta?.calendarioIncompleto && (
          <div className="alert alert-warning py-2 small d-flex align-items-start gap-2">
            <FiAlertTriangle className="flex-shrink-0 mt-1" />
            <span>
              Se pidieron {data.meta.semanas} semanas pero el calendario solo llega hasta{" "}
              <strong>{data.meta.ultimaSemanaCalendario?.codigo}</strong> — se muestran {data.meta.semanasDisponibles} semana(s) por finca.
              Genera el año siguiente en{" "}
              <Link href="/maestros/semanas" className="alert-link">Maestros → Semanas</Link> para proyectar más adelante.
            </span>
          </div>
        )}

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-3 align-items-end">
            <div className="col-12">
              <label className="form-label small fw-medium mb-1">Finca</label>
              <div className="d-flex flex-wrap gap-1">
                <label className={`btn btn-sm rounded-3 ${todasFincas ? "btn-brand" : "btn-outline-secondary"}`}>
                  <input type="checkbox" className="d-none" checked={todasFincas} onChange={seleccionarTodas} />
                  Todas
                </label>
                {fincas.map((f) => (
                  <label
                    key={f.uuid}
                    className={`btn btn-sm rounded-3 ${!todasFincas && fincaUuidsSeleccionadas.includes(f.uuid) ? "btn-brand" : "btn-outline-secondary"}`}
                  >
                    <input
                      type="checkbox"
                      className="d-none"
                      checked={!todasFincas && fincaUuidsSeleccionadas.includes(f.uuid)}
                      onChange={() => toggleFinca(f.uuid)}
                    />
                    {f.nombre}
                  </label>
                ))}
              </div>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Año</label>
              <select className="form-select form-select-sm rounded-3" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                {[anioActual - 1, anioActual, anioActual + 1].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-medium mb-1">Semana inicial</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={semanaInicioUuid}
                onChange={(e) => setSemanaInicioUuid(e.target.value)}
              >
                <option value="">Semana actual</option>
                {semanasDelAnio.map((s) => (
                  <option key={s.uuid} value={s.uuid}>S{s.numeroSemana} - {s.anio}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small fw-medium mb-1">Semanas a proyectar</label>
              <div className="d-flex flex-wrap align-items-center gap-1">
                {SEMANAS_OPCIONES.map((n) => (
                  <label key={n} className={`btn btn-sm rounded-3 ${semanasProyectar === n ? "btn-brand" : "btn-outline-secondary"}`}>
                    <input type="radio" className="d-none" checked={semanasProyectar === n} onChange={() => setSemanasProyectar(n)} />
                    {n}
                  </label>
                ))}
                <input
                  type="number"
                  className="form-control form-control-sm rounded-3"
                  style={{ width: "5rem" }}
                  min="1"
                  max={SEMANAS_MAX}
                  value={semanasProyectar}
                  onChange={(e) => {
                    const valor = Math.max(1, Math.min(SEMANAS_MAX, Number(e.target.value) || 1));
                    setSemanasProyectar(valor);
                  }}
                  title={`Personalizado (máximo ${SEMANAS_MAX}, un año calendario)`}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 d-flex flex-wrap align-items-end gap-2">
            <div>
              <label className="form-label small fw-medium mb-1">Simular desde (fecha pasada)</label>
              <input
                type="date"
                className="form-control form-control-sm rounded-3"
                style={{ width: "10rem" }}
                max={new Date().toISOString().slice(0, 10)}
                value={simularDesde}
                onChange={(e) => setSimularDesde(e.target.value)}
              />
            </div>
            {simularDesde && (
              <button type="button" className="btn btn-link btn-sm text-decoration-none" onClick={() => setSimularDesde("")}>
                Quitar simulación
              </button>
            )}
            <span className="text-secondary small mb-1">
              Pronostica como si hoy fuera esa fecha, usando solo lo que se sabía entonces, y lo compara con lo que pasó. Pulsa actualizar para aplicarlo.
            </span>
          </div>

          <div className="mt-2">
            <button
              type="button"
              className="btn btn-link btn-sm text-decoration-none px-0 d-flex align-items-center gap-1"
              onClick={() => setAjustesAbiertos((v) => !v)}
            >
              {ajustesAbiertos ? <FiChevronUp /> : <FiChevronDown />}
              Ajustes avanzados
            </button>
            {ajustesAbiertos && (
              <div className="d-flex align-items-end gap-2 mt-2">
                <div>
                  <label className="form-label small fw-medium mb-1">% no cosechado (opcional)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm rounded-3"
                    style={{ width: "8rem" }}
                    min="0"
                    max="90"
                    step="0.5"
                    placeholder={pctHistoricoLabel}
                    value={pctNoCosechadoInput}
                    onChange={(e) => setPctNoCosechadoInput(e.target.value)}
                  />
                </div>
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={aplicarOverride}>
                  Aplicar
                </button>
                <button type="button" className="btn btn-link btn-sm text-decoration-none" onClick={restablecerOverride}>
                  Restablecer
                </button>
                <span className="text-secondary small mb-2">Histórico calculado: {pctHistoricoLabel}</span>
              </div>
            )}
          </div>
        </div>

        {data?.meta?.simulacion && <ResumenSimulacion data={data} />}

        {data?.ratioSerie?.serie?.length > 0 && (
          <div className="row g-3 mb-3">
          <div className="col-12 col-xl-7">
            <GraficoRatio
              datos={anioRatio ? data.ratioSerie.serie.map((p) => ({ ...p, ratioAnio: p.porAnio?.[anioRatio] ?? null })) : data.ratioSerie.serie}
              lineasExtra={anioRatio ? [{ dataKey: "ratioAnio", name: `Ratio ${anioRatio} (misma semana)`, color: "#ea580c" }] : []}
              alcance={`${data.ratioSerie.pasadas} semanas pasadas y ${data.ratioSerie.futuras} futuras, vs. promedio de ${data.ratioSerie.aniosHistoricos} años anteriores`}
              controles={
                <div className="d-flex align-items-center gap-2 ms-auto me-1 small">
                  <label className="d-flex align-items-center gap-1 mb-0">
                    Año
                    <select className="form-select form-select-sm rounded-3" style={{ width: "6.5rem" }} value={anioRatio} onChange={(e) => setAnioRatio(e.target.value)} title="Agrega la línea del ratio de un año en particular (misma semana)">
                      <option value="">Ninguno</option>
                      {[...new Set(data.ratioSerie.serie.flatMap((p) => Object.keys(p.porAnio || {})))]
                        .sort((a, b) => b - a)
                        .map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="d-flex align-items-center gap-1 mb-0">
                    Pasadas
                    <input
                      type="number"
                      className="form-control form-control-sm rounded-3"
                      style={{ width: "4.5rem" }}
                      min="0"
                      max="156"
                      value={ratioPasadas}
                      onChange={(e) => setRatioPasadas(Math.max(0, Math.min(156, Number(e.target.value) || 0)))}
                      onBlur={handleConsultar}
                      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    />
                  </label>
                  <label className="d-flex align-items-center gap-1 mb-0">
                    Futuras
                    <input
                      type="number"
                      className="form-control form-control-sm rounded-3"
                      style={{ width: "4.5rem" }}
                      min="0"
                      max="53"
                      value={ratioFuturas}
                      onChange={(e) => setRatioFuturas(Math.max(0, Math.min(53, Number(e.target.value) || 0)))}
                      onBlur={handleConsultar}
                      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    />
                  </label>
                </div>
              }
            />
          </div>
          <div className="col-12 col-xl-5">
            <PatronCorteCard
              key={Object.keys(data.patronCorte || {}).join(",")}
              porGrupo={data.patronCorte}
              grupos={[...new Map(data.rows.map((r) => [r.fincaUuid ?? "GLOBAL", { clave: r.fincaUuid ?? "GLOBAL", nombre: r.fincaNombre || "Todas las fincas" }])).values()]}
            />
          </div>
          </div>
        )}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle tabla-pronostico" style={{ fontSize: "0.84rem" }}>
              <thead className="table-light">
                <tr>
                  <th style={{ width: 24 }} />
                  <th>Semana</th>
                  {mostrarColumnaFinca && <th>Finca</th>}
                  <ThGrafica metrica="hectareas" onGraficas={setGraficas} className="text-end">Hectáreas</ThGrafica>
                  <ThGrafica metrica="edades" onGraficas={setGraficas}>Distribución por edad</ThGrafica>
                  <th className="text-end">Racimos cosechados</th>
                  <ThGrafica metrica="ratio" onGraficas={setGraficas} className="text-end">Ratio</ThGrafica>
                  <ThGrafica metrica="aprovechamiento" onGraficas={setGraficas} className="text-end">Aprovechamiento</ThGrafica>
                  <ThGrafica metrica="cajas" onGraficas={setGraficas} className="text-end">Cajas 20k</ThGrafica>
                  <th className="text-end" title="Por defecto, la estimación de cajas de las fincas externas; se puede editar">Cajas adicionales</th>
                  <th className="text-end" title="Cajas 20k + cajas adicionales">Estimación</th>
                  <th className="text-end">
                    <span
                      role="button"
                      className="text-nowrap"
                      style={{ cursor: "pointer", borderBottom: "1px dashed #94a3b8" }}
                      title="Suma de lo que estimaron las fincas para esa semana (incluidas las externas). Clic para ver la estimación de cada finca."
                      onClick={() => setVerEstimacionFincas(true)}
                    >
                      Estimación Finca
                    </span>
                  </th>
                  <th className="text-end" title="Por defecto la Estimación; se puede editar">Cajas Proyectadas</th>
                  {data?.meta?.simulacion && <th className="text-end">Cajas reales</th>}
                  {data?.meta?.simulacion && <th className="text-end">Dif.</th>}
                  <th>Confianza</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={data?.meta?.simulacion ? 16 : 14} className="text-center text-secondary py-4">Cargando...</td></tr>
                )}
                {!loading && (!data || data.rows.length === 0) && (
                  <tr><td colSpan={data?.meta?.simulacion ? 16 : 14} className="text-center text-secondary py-4">No hay datos para los filtros seleccionados.</td></tr>
                )}
                {!loading && data && data.rows.map((row, idx) => {
                  const key = rowKey(row);
                  const ratioMostrado = row.ratio;
                  const cajasMostradas = row.cajas20kg;
                  const ratioEditable = puedeEditarRatio && !row.real && !data?.meta?.simulacion;
                  const estilo = CONFIANZA_ESTILO[row.confianza] || CONFIANZA_ESTILO.Media;
                  const esNuevaFinca = mostrarColumnaFinca && (idx === 0 || data.rows[idx - 1].fincaUuid !== row.fincaUuid);
                  return (
                    <Fragment key={key}>
                    {esNuevaFinca && (
                      <tr>
                        <td colSpan={data?.meta?.simulacion ? 16 : 14} className="bg-light fw-bold small py-2" style={{ borderTop: "2px solid #cbd5e1" }}>
                          {row.fincaCodigo} — {row.fincaNombre}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="text-secondary" role="button" style={{ cursor: "pointer" }} title="Ver los racimos por edad de esta semana" onClick={() => alternarSemana(key)}>
                        {abiertas.has(key) ? <FiChevronDown /> : <FiChevronRight />}
                      </td>
                      <td role="button" style={{ cursor: "pointer" }} onClick={() => alternarSemana(key)}>{row.semanaCodigo}</td>
                      {mostrarColumnaFinca && <td>{row.fincaNombre}</td>}
                      <td className="text-end">{row.hectareas != null ? row.hectareas.toLocaleString("es", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}</td>
                      <td><DistribucionEdad ageBreakdown={row.ageBreakdown} /></td>
                      <td className="text-end">{row.racimosCosechados.toLocaleString("es")}</td>
                      <td className="text-end" style={{ minWidth: "5rem" }}>
                        {editandoRatio === key ? (
                          <input
                            type="number"
                            autoFocus
                            className="form-control form-control-sm text-end rounded-3"
                            defaultValue={ratioMostrado}
                            step="0.01"
                            min="0"
                            onBlur={(e) => {
                              setEditandoRatio(null);
                              guardarRatio(row, e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.target.blur();
                              if (e.key === "Escape") setEditandoRatio(null);
                            }}
                          />
                        ) : (
                          <span
                            role={ratioEditable ? "button" : undefined}
                            title={
                              row.ratioManual
                                ? "Ratio editado a mano (guardado). Haz clic para cambiarlo; borra el valor para volver al calculado."
                                : ratioEditable
                                  ? "Clic para editar el ratio: se guarda y cambia las cajas y el gráfico de ratio"
                                  : row.real
                                    ? "Semana real: el ratio no se edita"
                                    : undefined
                            }
                            onClick={() => ratioEditable && setEditandoRatio(key)}
                            style={{ cursor: ratioEditable ? "pointer" : "default", borderBottom: ratioEditable ? "1px dashed #94a3b8" : undefined, color: row.ratioManual ? "#b45309" : undefined, fontWeight: row.ratioManual ? 600 : undefined }}
                          >
                            {ratioMostrado.toFixed(2)}
                            {row.ratioManual && " ✎"}
                          </span>
                        )}
                      </td>
                      <td className="text-end">{(row.aprovechamiento * 100).toFixed(1)}%</td>
                      <td className="text-end fw-bold">{cajasMostradas.toLocaleString("es", { maximumFractionDigits: 0 })}</td>
                      <td className="text-end" style={{ minWidth: "6rem" }}>
                        {editandoAdicional === key ? (
                          <input
                            type="number"
                            autoFocus
                            className="form-control form-control-sm text-end rounded-3"
                            defaultValue={row.cajasAdicionales ?? ""}
                            step="1"
                            min="0"
                            onBlur={(e) => {
                              setEditandoAdicional(null);
                              guardarAdicional(row, e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.target.blur();
                              if (e.key === "Escape") setEditandoAdicional(null);
                            }}
                          />
                        ) : (
                          <span className="d-inline-flex align-items-center gap-1">
                            <span
                              role={puedeEditarRatio ? "button" : undefined}
                              title={`${row.cajasAdicionalesManual ? "Editado a mano" : "Estimación de las fincas externas"} · estimación: ${(row.cajasAdicionalesEstimado || 0).toLocaleString("es", { maximumFractionDigits: 0 })}${puedeEditarRatio ? " · clic para editar" : ""}`}
                              onClick={() => puedeEditarRatio && setEditandoAdicional(key)}
                              style={{ cursor: puedeEditarRatio ? "pointer" : "default", borderBottom: puedeEditarRatio ? "1px dashed #94a3b8" : undefined, color: row.cajasAdicionalesManual ? "#b45309" : row.cajasAdicionales ? undefined : "#94a3b8", fontWeight: row.cajasAdicionalesManual ? 600 : undefined }}
                            >
                              {(row.cajasAdicionales || 0).toLocaleString("es", { maximumFractionDigits: 0 })}
                              {row.cajasAdicionalesManual && " ✎"}
                            </span>
                            {row.cajasAdicionalesManual && puedeEditarRatio && (
                              <button type="button" className="btn btn-link btn-sm p-0 text-secondary" style={{ lineHeight: 1 }} title="Volver a la estimación de las fincas externas" onClick={() => guardarAdicional(row, null)}>
                                ↺
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="text-end fw-bold">{(row.cajasTotal ?? cajasMostradas).toLocaleString("es", { maximumFractionDigits: 0 })}</td>
                      <td className="text-end" title={row.estimacionFinca != null ? `Diferencia con la Estimación: ${(row.estimacionFinca - (row.cajasTotal ?? cajasMostradas)).toLocaleString("es", { maximumFractionDigits: 0 })} cajas` : "Sin estimación registrada para esta semana"}>
                        {row.estimacionFinca != null ? row.estimacionFinca.toLocaleString("es", { maximumFractionDigits: 0 }) : "—"}
                      </td>
                      <td className="text-end" style={{ minWidth: "6.5rem" }}>
                        {editandoProyectada === key ? (
                          <input
                            type="number"
                            autoFocus
                            className="form-control form-control-sm text-end rounded-3"
                            defaultValue={Math.round(row.cajasProyectada ?? row.cajasTotal ?? cajasMostradas)}
                            step="1"
                            min="0"
                            onBlur={(e) => {
                              setEditandoProyectada(null);
                              guardarProyectada(row, e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.target.blur();
                              if (e.key === "Escape") setEditandoProyectada(null);
                            }}
                          />
                        ) : (
                          <span className="d-inline-flex align-items-center gap-1">
                            <span
                              role={puedeEditarRatio ? "button" : undefined}
                              title={`${row.cajasProyectadaManual ? "Fijada a mano" : "Igual a la Estimación"}${puedeEditarRatio ? " · clic para editar" : ""}`}
                              onClick={() => puedeEditarRatio && setEditandoProyectada(key)}
                              style={{ cursor: puedeEditarRatio ? "pointer" : "default", borderBottom: puedeEditarRatio ? "1px dashed #94a3b8" : undefined, color: row.cajasProyectadaManual ? "#b45309" : undefined, fontWeight: 700 }}
                            >
                              {(row.cajasProyectada ?? row.cajasTotal ?? cajasMostradas).toLocaleString("es", { maximumFractionDigits: 0 })}
                              {row.cajasProyectadaManual && " ✎"}
                            </span>
                            {row.cajasProyectadaManual && puedeEditarRatio && (
                              <button type="button" className="btn btn-link btn-sm p-0 text-secondary" style={{ lineHeight: 1 }} title="Volver a la Estimación" onClick={() => guardarProyectada(row, null)}>
                                ↺
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                      {data?.meta?.simulacion && (
                        <>
                          <td className="text-end">{row.cajasReales != null ? row.cajasReales.toLocaleString("es", { maximumFractionDigits: 0 }) : "—"}</td>
                          <td className="text-end small" style={{ color: row.cajasReales ? (Math.abs(cajasMostradas / row.cajasReales - 1) > 0.1 ? "#dc2626" : "#16a34a") : undefined }}>
                            {row.cajasReales ? `${((cajasMostradas / row.cajasReales - 1) * 100).toFixed(1)}%` : "—"}
                          </td>
                        </>
                      )}
                      <td>
                        <span
                          className="badge rounded-pill"
                          style={{ backgroundColor: estilo.bg, color: estilo.color, fontWeight: 600 }}
                          title={row.detalle}
                        >
                          {row.confianza}
                        </span>
                      </td>
                    </tr>
                    {abiertas.has(key) && (
                      <tr>
                        <td />
                        <td colSpan={data?.meta?.simulacion ? 15 : 13} className="py-2" style={{ background: "#f8fafc" }}>
                          <table className="table table-sm mb-0" style={{ fontSize: "0.72rem", maxWidth: 560, background: "transparent" }}>
                            <thead>
                              <tr className="text-secondary">
                                <th>Edad</th>
                                <th>Cinta (semana de embolse)</th>
                                <th className="text-end">Racimos</th>
                                <th className="text-end">% de la semana</th>
                                <th>Origen</th>
                              </tr>
                            </thead>
                            <tbody>
                              {EDADES_COSECHA.map((e) => {
                                const a = (row.ageBreakdown || []).find((x) => x.edad === e);
                                const n = ((row.numeroSemana - e) % 52 + 52) % 52 + 1;
                                return (
                                  <tr key={e}>
                                    <td>{e} semanas</td>
                                    <td className="text-secondary">S{n}</td>
                                    <td className="text-end fw-medium">{a ? a.racimos.toLocaleString("es") : "—"}</td>
                                    <td className="text-end text-secondary">{a && row.racimosCosechados > 0 ? `${((a.racimos / row.racimosCosechados) * 100).toFixed(1)}%` : "—"}</td>
                                    <td>
                                      {a?.origen ? (
                                        <span className="d-inline-flex align-items-center gap-1">
                                          <span style={{ width: 8, height: 8, borderRadius: 2, background: ORIGEN_EDAD[a.origen]?.color || "#16a34a", display: "inline-block" }} />
                                          {ORIGEN_EDAD[a.origen]?.texto || a.origen}
                                        </span>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
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

        {data && data.rows.length > 0 && !data.meta?.simulacion && <ProductosSemanal data={data} puedeEditar={puedeEditarRatio} />}
      </div>

      {verEstimacionFincas && data && <EstimacionFincasModal detalle={data.estimacionPorFinca} onClose={() => setVerEstimacionFincas(false)} />}

      {graficas && data && (
        <GraficasSemanalModal
          filas={data.rows}
          seriesAnuales={data.seriesAnuales || {}}
          metrica={graficas}
          onClose={() => setGraficas(null)}
        />
      )}

      <style jsx>{`
        :global(.tabla-pronostico th),
        :global(.tabla-pronostico td) {
          text-align: center !important;
        }
        .spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .btn-brand {
          background-color: #16a34a;
          border-color: #16a34a;
          color: #fff;
        }
        .btn-brand:hover {
          background-color: #15803d;
          border-color: #15803d;
          color: #fff;
        }
      `}</style>
    </>
  );
}

// Pestañas: el pronóstico semanal de siempre y la proyección anual con escenarios (hectáreas nuevas, % no cosechado).
export default function PronosticoPage() {
  const puedeProyeccion = hasPermission("proyeccion.ver");
  const [vista, setVista] = useState("pronostico");
  return (
    <RequirePermission code="menu.pronostico">
      <div className="p-4 p-md-5">
        {puedeProyeccion && (
          <ul className="nav nav-pills gap-1 mb-3">
            <li className="nav-item">
              <button type="button" className={`nav-link btn-sm py-1 px-3 ${vista === "pronostico" ? "active" : ""}`} onClick={() => setVista("pronostico")}>
                Proyección semanal
              </button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link btn-sm py-1 px-3 ${vista === "anual" ? "active" : ""}`} onClick={() => setVista("anual")}>
                Proyección anual
              </button>
            </li>
          </ul>
        )}
        {vista === "anual" && puedeProyeccion ? <ProyeccionAnual /> : <PronosticoSemanal />}
      </div>
    </RequirePermission>
  );
}
