"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiTrendingUp,
  FiUsers,
  FiMap,
  FiChevronRight,
  FiArrowLeft,
  FiCheck,
  FiCloudRain,
  FiActivity,
  FiLayers,
  FiBarChart2,
  FiFilter,
  FiPackage,
  FiMapPin,
} from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import { COLORES_CINTA } from "@/components/reportes/PromedioPorSemanaChart";
import MapaEvaluacionesModal from "@/components/reportes/MapaEvaluacionesModal";

const TIPOS_COLUMNA = ["Índice de infección", "Conteo de Hojas", "Suma Bruta"];
const LABELS = {
  "Índice de infección": "Índice",
  "Conteo de Hojas": "Conteo",
  "Suma Bruta": "Suma",
};

const ESTILO_INFECCION = {
  fondo: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)",
  borde: "#fecdd3",
  color: "#be123c",
  iconoFondo: "#ffe4e6",
};

const ESTILO_SUMA = {
  fondo: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
  borde: "#bfdbfe",
  color: "#1d4ed8",
  iconoFondo: "#dbeafe",
};

const ESTILO_LLUVIA = {
  fondo: "linear-gradient(135deg, #effdf5 0%, #d1fae5 100%)",
  borde: "#a7f3d0",
  color: "#047857",
  iconoFondo: "#d1fae5",
};

function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function MiniCard({ icono, etiqueta, valor, unidad, n, estilo }) {
  return (
    <div
      className="rounded-4 shadow-sm h-100 p-3 d-flex flex-column"
      style={{ background: estilo.fondo, border: `1px solid ${estilo.borde}` }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span
          className="text-uppercase fw-semibold"
          style={{ fontSize: 10.5, letterSpacing: "0.08em", color: estilo.color }}
        >
          {etiqueta}
        </span>
        <span
          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
          style={{ width: 30, height: 30, background: "rgba(255,255,255,0.75)", color: estilo.color }}
        >
          {icono}
        </span>
      </div>
      <div className="d-flex align-items-end gap-1">
        <span className="fw-bold lh-1" style={{ fontSize: 26, color: "#1e293b" }}>
          {valor}
        </span>
        {unidad && (
          <span className="fw-semibold lh-1 mb-1" style={{ fontSize: 13, color: estilo.color }}>
            {unidad}
          </span>
        )}
      </div>
      <span
        className="badge rounded-pill align-self-start mt-2"
        style={{ background: "rgba(255,255,255,0.75)", color: "#475569", fontWeight: 500 }}
      >
        {n} evaluación(es)
      </span>
    </div>
  );
}

// Panel de indicadores de la página de evaluaciones: promedios de la semana
// seleccionada (infección, suma bruta, precipitación) y conteos por finca /
// lote con navegación por niveles que también filtra todo el panel.
export default function IndicadoresEvaluaciones() {
  const [fincas, setFincas] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [usuarioUuid, setUsuarioUuid] = useState("");
  const [loteUuid, setLoteUuid] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [semanaUuid, setSemanaUuid] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ruta, setRuta] = useState([]);
  const [edadModal, setEdadModal] = useState(null);
  const [mapaFinca, setMapaFinca] = useState(null);

  useEffect(() => {
    Promise.all([apiFetch("/fincas?limit=100"), apiFetch(`/semanas?anio=${anio}&limit=100`)])
      .then(([fincasData, semanasData]) => {
        setFincas(fincasData.items || []);
        const semanasAnio = (semanasData.items || []).sort((a, b) => a.numeroSemana - b.numeroSemana);
        setSemanas(semanasAnio);
        const hoy = hoyIso();
        const actual = semanasAnio.find((s) => hoy >= s.fechaInicio && hoy <= s.fechaFin);
        if (actual) setSemanaUuid((prev) => prev || actual.uuid);
      })
      .catch((err) => setError(err.message));
  }, [anio]);

  useEffect(() => {
    if (!semanaUuid) return;
    let cancelado = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ semanaUuid });
    if (fincaUuid) params.set("fincaUuid", fincaUuid);
    if (usuarioUuid) params.set("usuarioUuid", usuarioUuid);
    if (loteUuid) params.set("loteUuid", loteUuid);
    apiFetch(`/evaluaciones/indicadores?${params.toString()}`)
      .then((res) => {
        if (cancelado) return;
        setData(res);
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
  }, [semanaUuid, fincaUuid, usuarioUuid, loteUuid]);

  useEffect(() => {
    setRuta([]);
    setLoteUuid("");
    setEdadModal(null);
  }, [semanaUuid, usuarioUuid]);

  const fincaNombre = fincas.find((f) => f.uuid === fincaUuid)?.nombre;
  const usuarioNombre = data?.evaluadores?.find((u) => u.uuid === usuarioUuid);
  const usuarioNombreCompleto = usuarioNombre
    ? `${usuarioNombre.nombre || ""} ${usuarioNombre.apellido || ""}`.trim() || usuarioNombre.usuario
    : "";
  const semanaNombre = semanas.find((s) => s.uuid === semanaUuid)?.codigo || "";
  const loteActivo = (data?.porFinca || [])
    .flatMap((f) => f.lotes || [])
    .find((l) => l.uuid === loteUuid);
  const evaluadores = (data?.evaluadores || []).sort((a, b) =>
    `${a.nombre || ""} ${a.apellido || ""}`.localeCompare(`${b.nombre || ""} ${b.apellido || ""}`),
  );

  const resumen = useMemo(() => {
    if (!data) return null;
    const { promedios, porFinca, totalEvaluaciones } = data;
    const porTipo = {};
    (porFinca || []).forEach((f) => {
      Object.entries(f.tipos || {}).forEach(([tipo, n]) => {
        porTipo[tipo] = (porTipo[tipo] || 0) + n;
      });
    });
    return { promedios, totalEvaluaciones, porTipo };
  }, [data]);

  const nivel = useMemo(() => {
    if (!data?.porFinca) return { filas: [], tipo: "finca" };
    const [finca] = ruta;
    if (finca) {
      const f = data.porFinca.find((x) => x.finca === finca);
      return { filas: f?.lotes || [], tipo: "lote", finca: f };
    }
    return { filas: data.porFinca, tipo: "finca" };
  }, [data, ruta]);

  const tiposVisibles = useMemo(() => {
    const set = new Set();
    nivel.filas.forEach((f) => Object.keys(f.tipos || {}).forEach((t) => set.add(t)));
    if (nivel.tipo === "lote" && nivel.finca) {
      Object.keys(nivel.finca.tipos || {}).forEach((t) => set.add(t));
    }
    return [...set].sort((a, b) => {
      const ia = TIPOS_COLUMNA.indexOf(a);
      const ib = TIPOS_COLUMNA.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [nivel]);

  const tituloNivel = nivel.tipo === "finca" ? "Fincas" : `Lotes de ${ruta[0]}`;

  return (
    <div className="rounded-4 border shadow-sm p-3 p-lg-4 mb-3" style={{ background: "#ffffff" }}>
      {/* Cabecera + filtros */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div className="d-flex align-items-center gap-2">
          <span
            className="rounded-circle d-flex align-items-center justify-content-center text-white"
            style={{ width: 38, height: 38, background: "linear-gradient(135deg,#16a34a,#0d9488)" }}
          >
            <FiTrendingUp size={19} />
          </span>
          <div>
            <h2 className="h6 fw-bold mb-0" style={{ color: "#0f172a" }}>
              Indicadores de Evaluaciones
            </h2>
            <p className="text-secondary small mb-0">Promedios y conteos de la semana seleccionada</p>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <div>
            <label className="form-label small fw-medium text-secondary mb-1">Año</label>
            <input
              type="number"
              className="form-control form-control-sm rounded-3 shadow-sm"
              style={{ width: 90, borderColor: "#e2e8f0" }}
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
            />
          </div>
          {[
            {
              label: "Semana",
              value: semanaUuid,
              onChange: setSemanaUuid,
              placeholder: "Seleccioná una semana",
              options: semanas.map((s) => ({ value: s.uuid, text: s.codigo })),
            },
            {
              label: "Finca",
              value: fincaUuid,
              onChange: (v) => {
                setFincaUuid(v);
                setLoteUuid("");
                setRuta([]);
              },
              placeholder: "Todas",
              options: fincas.map((f) => ({ value: f.uuid, text: f.nombre })),
            },
            {
              label: "Usuario",
              value: usuarioUuid,
              onChange: setUsuarioUuid,
              placeholder: "Todos",
              options: evaluadores.map((u) => ({
                value: u.uuid,
                text: `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario,
              })),
            },
          ].map((sel) => (
            <div key={sel.label}>
              <label className="form-label small fw-medium text-secondary mb-1">{sel.label}</label>
              <select
                className="form-select form-select-sm rounded-3 shadow-sm"
                style={{ width: 150, borderColor: "#e2e8f0" }}
                value={sel.value}
                onChange={(e) => sel.onChange(e.target.value)}
              >
                <option value="">{sel.placeholder}</option>
                {sel.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.text}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger py-2 small rounded-3" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="d-flex justify-content-center align-items-center py-5 text-secondary">
          <div className="spinner-border spinner-border-sm me-2" role="status"></div>
          <span className="small">Cargando indicadores...</span>
        </div>
      )}

      {!loading && !error && !semanaUuid && (
        <p className="text-secondary small py-5 text-center mb-0">Seleccioná una semana para ver los indicadores.</p>
      )}

      {!loading && !error && semanaUuid && resumen && (
        <>
          {/* Filtro activo en migas */}
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <span className="badge rounded-pill border bg-light text-dark px-3 py-2 fw-medium">
              <FiBarChart2 className="me-1" style={{ marginTop: -2 }} />
              Semana {semanaNombre}
            </span>
            {fincaNombre && (
              <span className="badge rounded-pill border bg-light text-dark px-3 py-2 fw-medium">
                <FiMap className="me-1" />
                {fincaNombre}
              </span>
            )}
            {loteActivo && (
              <span className="badge rounded-pill border bg-light text-dark px-3 py-2 fw-medium">
                Lote {loteActivo.lote}
              </span>
            )}
            {usuarioNombreCompleto && (
              <span className="badge rounded-pill border bg-light text-dark px-3 py-2 fw-medium">
                <FiUsers className="me-1" />
                {usuarioNombreCompleto}
              </span>
            )}
            <span className="badge rounded-pill text-bg-success px-3 py-2 ms-auto">
              <FiLayers className="me-1" style={{ marginTop: -2 }} />
              {resumen.totalEvaluaciones} evaluación(es)
            </span>
          </div>

          {/* Tarjetas de promedios */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-4 col-xl-2">
              <MiniCard
                icono={<FiActivity size={15} />}
                etiqueta="Índice de infección promedio"
                valor={resumen.promedios.indiceInfeccion != null ? resumen.promedios.indiceInfeccion.toFixed(2) : "—"}
                unidad="%"
                n={resumen.porTipo["Índice de infección"] || 0}
                estilo={ESTILO_INFECCION}
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <MiniCard
                icono={<FiActivity size={15} />}
                etiqueta="YLI promedio"
                valor={resumen.promedios.yli != null ? resumen.promedios.yli.toFixed(2) : "—"}
                unidad=""
                n={resumen.porTipo["Índice de infección"] || 0}
                estilo={ESTILO_INFECCION}
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <MiniCard
                icono={<FiActivity size={15} />}
                etiqueta="YLS promedio"
                valor={resumen.promedios.yls != null ? resumen.promedios.yls.toFixed(2) : "—"}
                unidad=""
                n={resumen.porTipo["Índice de infección"] || 0}
                estilo={ESTILO_INFECCION}
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <MiniCard
                icono={<FiActivity size={15} />}
                etiqueta="Hojas totales (Índice)"
                valor={resumen.promedios.hojasTotales != null ? resumen.promedios.hojasTotales.toFixed(2) : "—"}
                unidad=""
                n={resumen.porTipo["Índice de infección"] || 0}
                estilo={ESTILO_INFECCION}
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <MiniCard
                icono={<FiBarChart2 size={15} />}
                etiqueta="Suma bruta"
                valor={resumen.promedios.sumaBruta != null ? resumen.promedios.sumaBruta.toFixed(2) : "—"}
                unidad=""
                n={resumen.porTipo["Suma Bruta"] || 0}
                estilo={ESTILO_SUMA}
              />
            </div>
            <div className="col-6 col-md-4 col-xl-2">
              <MiniCard
                icono={<FiCloudRain size={15} />}
                etiqueta="Precipitación"
                valor={data.precipitacion != null ? data.precipitacion.toFixed(1) : "—"}
                unidad="mm"
                n={data.precipitacion != null ? "semana" : "—"}
                estilo={ESTILO_LLUVIA}
              />
            </div>
          </div>

          {/* Detalle por finca / lote + hojas por edad */}
          <div className="row g-3">
            <div className="col-12 col-lg-7">
              <div className="d-flex align-items-center justify-content-between gap-2 mb-2 flex-wrap">
                <h3 className="h6 fw-semibold mb-0 d-flex align-items-center gap-2" style={{ color: "#0f172a" }}>
                  <span
                    className="rounded-circle d-inline-flex align-items-center justify-content-center"
                    style={{ width: 26, height: 26, background: "#ecfdf5", color: "#059669" }}
                  >
                    <FiUsers size={14} />
                  </span>
                  {tituloNivel}
                </h3>
                {nivel.tipo !== "finca" && (
                  <button
                    type="button"
                    className="btn btn-sm btn-light rounded-pill px-3 shadow-sm fw-medium"
                    style={{ borderColor: "#e2e8f0" }}
                    onClick={() => {
                      setRuta([]);
                      setFincaUuid("");
                      setLoteUuid("");
                    }}
                  >
                    <FiArrowLeft className="me-1" /> Volver
                  </button>
                )}
              </div>
              <div className="table-responsive rounded-4 border overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
                <table className="table table-hover mb-0 align-middle">
                  <thead
                    style={{
                      background: "linear-gradient(135deg,#f8fafc,#f1f5f9)",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <tr>
                      <th className="small fw-semibold text-secondary py-2">{tituloNivel}</th>
                      {tiposVisibles.map((t) => (
                        <th key={t} className="small fw-semibold text-secondary text-end py-2">
                          {LABELS[t] || t}
                        </th>
                      ))}
                      <th className="small fw-semibold text-secondary text-end py-2" style={{ width: 70 }}>
                        Total
                      </th>
                      <th className="text-end py-2" style={{ width: 44 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {nivel.filas.length === 0 && (
                      <tr>
                        <td colSpan={tiposVisibles.length + 3} className="text-center text-secondary py-4">
                          Sin evaluaciones en este nivel.
                        </td>
                      </tr>
                    )}
                    {nivel.filas.map((fila) => (
                      <FilaNivel
                        key={fila.uuid}
                        fila={fila}
                        tipoNivel={nivel.tipo}
                        tipos={tiposVisibles}
                        activa={fila.uuid === loteUuid}
                        onOpen={() => {
                          setFincaUuid(fila.uuid);
                          setLoteUuid("");
                          setRuta([fila.finca]);
                        }}
                        onToggleLote={() => setLoteUuid(loteUuid === fila.uuid ? "" : fila.uuid)}
                        onVerMapa={() => setMapaFinca({ uuid: fila.uuid, nombre: fila.finca })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-secondary small mb-0 mt-2">
                {nivel.tipo === "finca"
                  ? "Hacé clic en una finca para ver sus lotes."
                  : "Hacé clic en un lote para filtrar todo el panel por ese lote."}
              </p>
            </div>

            <div className="col-12 col-lg-5">
              <h3 className="h6 fw-semibold mb-2 d-flex align-items-center gap-2" style={{ color: "#0f172a" }}>
                <span
                  className="rounded-circle d-inline-flex align-items-center justify-content-center"
                  style={{ width: 26, height: 26, background: "#ecfdf5", color: "#059669" }}
                >
                  <FiMap size={14} />
                </span>
                Hojas promedio por edad de la planta
              </h3>
              <div className="table-responsive rounded-4 border overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
                <table className="table table-hover mb-0 align-middle">
                  <thead
                    style={{
                      background: "linear-gradient(135deg,#f8fafc,#f1f5f9)",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <tr>
                      <th className="small fw-semibold text-secondary py-2">Edad (semanas)</th>
                      <th className="small fw-semibold text-secondary py-2">Embolse</th>
                      <th className="small fw-semibold text-secondary text-end py-2">Hojas</th>
                      <th className="small fw-semibold text-secondary text-end py-2">N°</th>
                      <th className="small fw-semibold text-secondary text-end py-2" style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.promedios.hojasPorEdad.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-secondary py-4">
                          Sin conteos de hojas en esta semana.
                        </td>
                      </tr>
                    )}
                    {resumen.promedios.hojasPorEdad.map((e) => (
                      <FilaEdad key={e.edad} edad={e} onOpen={() => setEdadModal(e)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {edadModal && (
        <ModalEdad edad={edadModal} onClose={() => setEdadModal(null)} />
      )}

      {mapaFinca && (
        <MapaEvaluacionesModal
          fincaUuid={mapaFinca.uuid}
          fincaNombre={mapaFinca.nombre}
          semanaUuid={semanaUuid}
          semanaCodigo={semanaNombre}
          usuarioUuid={usuarioUuid}
          loteUuid={loteUuid}
          onClose={() => setMapaFinca(null)}
        />
      )}
    </div>
  );
}

function FilaEdad({ edad, onOpen }) {
  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="bg-white"
      title="Ver evaluaciones"
      style={{ cursor: "pointer" }}
    >
      <td className="py-2 fw-semibold" style={{ color: "#0f172a" }}>
        {edad.edad}
      </td>
      <td className="py-2">
        {edad.semanaEmbolseCodigo && (
          <span className="d-inline-flex align-items-center gap-2 small text-secondary">
            <span
              className="d-inline-block rounded-circle"
              style={{ width: 10, height: 10, backgroundColor: COLORES_CINTA[edad.cintaEmbolse] || "#94a3b8" }}
              title={edad.cintaEmbolse}
            />
            {edad.semanaEmbolseCodigo}
          </span>
        )}
      </td>
      <td className="text-end py-2">
        <span className="d-inline-flex align-items-center gap-2 justify-content-end w-100">
          <span className="rounded-pill" style={{ height: 6, width: 64, background: "#e2e8f0", overflow: "hidden" }}>
            <span
              className="d-block rounded-pill"
              style={{
                height: "100%",
                width: `${Math.min(100, (edad.promedio / 12) * 100)}%`,
                background: "linear-gradient(90deg,#10b981,#059669)",
              }}
            />
          </span>
          <span className="fw-semibold">{edad.promedio}</span>
        </span>
      </td>
      <td className="text-end text-secondary py-2">
        <span
          className="badge rounded-pill"
          style={{ background: "#f1f5f9", color: "#475569", fontWeight: 500 }}
        >
          {edad.n}
        </span>
      </td>
      <td className="text-end text-secondary py-2">
        <span
          className="rounded-circle d-inline-flex align-items-center justify-content-center"
          style={{ width: 26, height: 26, background: "#059669", color: "#fff" }}
        >
          <FiChevronRight size={14} />
        </span>
      </td>
    </tr>
  );
}

function ModalEdad({ edad, onClose }) {
  return (
    <ModalShell title={`Evaluaciones — Edad ${edad.edad} semanas (${edad.n} conteos)`} onClose={onClose} size="lg">
      <div className="rounded-3 border overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
        <table className="table table-sm table-hover mb-0 align-middle">
          <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <tr>
              <th className="small fw-semibold text-secondary py-2">Lote</th>
              <th className="small fw-semibold text-secondary py-2">Finca</th>
              <th className="small fw-semibold text-secondary py-2">Fecha</th>
              <th className="small fw-semibold text-secondary text-end py-2">Hojas</th>
            </tr>
          </thead>
          <tbody>
            {(edad.evaluaciones ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-secondary py-3">
                  Sin detalle de evaluaciones en esta edad.
                </td>
              </tr>
            )}
            {(edad.evaluaciones ?? []).map((ev) => (
              <tr key={ev.uuid}>
                <td className="py-2">{ev.lote || "—"}</td>
                <td className="py-2">{ev.finca || "—"}</td>
                <td className="py-2">{ev.fecha}</td>
                <td className="text-end py-2 fw-semibold">{ev.hojas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}

function FilaNivel({ fila, tipoNivel, tipos, activa, onOpen, onToggleLote, onVerMapa }) {
  const nombre = fila.finca || fila.lote;
  const primero = (
    <td className="fw-semibold" style={{ color: "#0f172a" }}>
      {nombre}
    </td>
  );
  const columnas = tipos.map((t) => (
    <td key={t} className="text-end text-secondary">
      {fila.tipos?.[t] ?? "—"}
    </td>
  ));
  const total = (
    <td className="text-end">
      <span
        className="badge rounded-pill fw-semibold"
        style={{ background: activa ? "#16a34a" : "#f1f5f9", color: activa ? "#fff" : "#334155" }}
      >
        {fila.total}
      </span>
    </td>
  );
  if (tipoNivel === "lote") {
    return (
      <tr
        role="button"
        tabIndex={0}
        onClick={onToggleLote}
        onKeyDown={(e) => e.key === "Enter" && onToggleLote()}
        className={activa ? "table-success" : "bg-white"}
        title={activa ? "Quitar filtro de lote" : "Filtrar por este lote"}
        style={{ cursor: "pointer" }}
      >
        {primero}
        {columnas}
        {total}
        <td className="text-end">
          <span
            className="rounded-circle d-inline-flex align-items-center justify-content-center"
            style={{
              width: 26,
              height: 26,
              background: activa ? "#16a34a" : "#f1f5f9",
              color: activa ? "#fff" : "#64748b",
            }}
          >
            {activa ? <FiCheck size={14} /> : <FiChevronRight size={15} />}
          </span>
        </td>
      </tr>
    );
  }
  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="bg-white"
      title="Filtrar por esta finca"
      style={{ cursor: "pointer" }}
    >
      <td className="fw-semibold d-flex align-items-center gap-2" style={{ color: "#0f172a" }}>
        <FiPackage size={15} className="text-success" />
        {nombre}
      </td>
      {columnas}
      {total}
      <td className="text-end">
        <div className="d-inline-flex align-items-center gap-1">
          <button
            type="button"
            className="btn btn-sm rounded-circle d-inline-flex align-items-center justify-content-center p-0 border-0"
            style={{ width: 26, height: 26, background: "#eff6ff", color: "#1d4ed8" }}
            title="Ver ubicación de las evaluaciones en el mapa"
            onClick={(e) => {
              e.stopPropagation();
              onVerMapa();
            }}
          >
            <FiMapPin size={13} />
          </button>
          <span
            className="rounded-circle d-inline-flex align-items-center justify-content-center"
            style={{ width: 26, height: 26, background: "#f1f5f9", color: "#64748b" }}
          >
            <FiChevronRight size={15} />
          </span>
        </div>
      </td>
    </tr>
  );
}
