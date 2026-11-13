"use client";

import { Fragment, useMemo, useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";

// Vista «Embolses, aprovechamiento, racimos, ratio y cajas»: una fila por semana (o mes); cada finca (y el total) es un grupo de cinco columnas que
// se lee de izquierda a derecha como el cálculo: embolses × aprovechamiento = racimos; racimos × ratio = cajas.
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const VERDE = "#166534";
const BORDE = "#b9c9be";

const DATOS = [
  { id: "ha", titulo: "Hectáreas", corto: "Hectáreas", ayuda: "Hectáreas en producción teóricas: las reales más las entradas del plan al 100 % (en un mes o en el total del año, el promedio de sus semanas)", color: "#0d9488" },
  { id: "ephs", titulo: "Embolses por hectárea", corto: "Emb./ha", ayuda: "Embolses por hectárea efectiva: embolses ÷ hectáreas en producción que se usan para el embolse (con la rampa de arranque)", color: "#0e7490", derivado: true },
  { id: "embolses", titulo: "Embolses", corto: "Embolses", ayuda: "Embolses de la semana (real si ya pasó, proyectado si no)", color: "#0891b2" },
  { id: "aprov", titulo: "Aprovechamiento", corto: "Aprovech.", ayuda: "Cosechado ÷ (cosechado + repique + recusado) de la cinta que cumple 12 semanas en esta semana", color: "#7c3aed", derivado: true },
  { id: "racimos", titulo: "Racimos", corto: "Racimos", ayuda: "Racimos cosechados", color: "#d97706" },
  { id: "ratio", titulo: "Ratio", corto: "Ratio", ayuda: "Cajas por racimo (cajas ÷ racimos)", color: "#64748b", derivado: true },
  { id: "cajas", titulo: "Cajas", corto: "Cajas", ayuda: "Racimos × ratio", color: VERDE, resultado: true },
];

const num = (n, d = 0) => Number(n ?? 0).toLocaleString("es", { minimumFractionDigits: d, maximumFractionDigits: d });
const mesDe = (fecha) => new Date(new Date(`${fecha}T00:00:00Z`).getTime() + 3 * 86400000).getUTCMonth(); // mes del jueves
const razon = (a, b) => (b > 0 ? a / b : null);
const pct = (v) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`);
const haTxt = (v) => (v === null || v === undefined ? "—" : num(v, 1));
const ratioTxt = (v) => (v === null || v === undefined ? "—" : num(v, 4));

// Acumula, por finca y periodo, lo que hace falta para mostrar las cinco cifras (el ratio y el aprovechamiento salen de cocientes de sumas).
function acumular(resultado, periodo, ocultas) {
  const nombres = new Map();
  const celdas = new Map(); // `${uuid}|${clave}` -> { embolses, racimos, cajas, an, ad, estimado }
  for (const f of resultado.filas) {
    if (ocultas.has(f.fincaUuid)) continue;
    nombres.set(f.fincaUuid, f.fincaNombre);
    const clave = periodo === "semana" ? f.semanaCodigo : mesDe(f.fechaInicio);
    const k = `${f.fincaUuid}|${clave}`;
    const c = celdas.get(k) || { embolses: 0, racimos: 0, cajas: 0, an: 0, ad: 0, real: 0, filas: 0, realF: 0, manual: 0, ha: 0, hae: 0, haeS: 0, haN: 0 };
    c.embolses += f.embolses || 0;
    c.ha += f.hectareas || 0; // teóricas: las reales más las entradas del plan al 100 %
    c.haeS += f.hectareasEfectivas || 0; // suma de hectáreas efectivas por semana: base del embolse por hectárea
    c.hae += f.hectareasEfectivas || 0; // efectivas: con la rampa de arranque (de ahí sale el embolse)
    c.haN += 1;
    c.racimos += f.racimos || 0;
    c.cajas += f.cajas || 0;
    c.an += f.aprovechamientoNum || 0;
    c.ad += f.aprovechamientoDen || 0;
    c.filas += 1;
    if (f.aprovechamientoCintaReal) c.real += 1;
    if (f.fuente === "real") c.realF += 1; // semana con cosecha y cajas reales: su ratio no se edita
    if (f.ratioManual) c.manual += 1;
    celdas.set(k, c);
  }
  const fincas = [...nombres.entries()].map(([uuid, nombre]) => ({ uuid, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const CLAVES = ["embolses", "racimos", "cajas", "an", "ad", "real", "filas", "realF", "manual", "ha", "hae", "haeS", "haN"];
  const vacia = () => Object.fromEntries(CLAVES.map((k) => [k, 0]));
  // Entre fincas (mismo periodo) todo se suma, también las hectáreas de cada finca (su promedio si la celda abarca varias semanas).
  const sumaFincas = (lista) =>
    lista.reduce((t, c) => {
      for (const k of CLAVES) if (k !== "ha" && k !== "hae" && k !== "haN") t[k] += c[k];
      t.ha += c.haN > 0 ? c.ha / c.haN : 0;
      t.hae += c.haN > 0 ? c.hae / c.haN : 0;
      t.haN = 1;
      return t;
    }, vacia());
  // Entre periodos (misma finca) todo se suma salvo las hectáreas, que son un nivel: se promedian (ha / haN).
  const sumaPeriodos = (lista) =>
    lista.reduce((t, c) => {
      for (const k of CLAVES) t[k] += c[k];
      return t;
    }, vacia());
  return { fincas, celdas, sumaFincas, sumaPeriodos };
}

// Valor de una de las cinco cifras en una celda ya acumulada.
function valorDe(dato, c) {
  if (!c) return null;
  if (dato === "aprov") return razon(c.an, c.ad);
  if (dato === "ratio") return razon(c.cajas, c.racimos);
  if (dato === "ha") return c.haN > 0 ? c.ha / c.haN : null;
  if (dato === "ephs") return razon(c.embolses, c.haeS);
  return c[dato];
}
const texto = (dato, v) => (v === null || v === undefined ? "—" : dato === "aprov" ? pct(v) : dato === "ratio" ? ratioTxt(v) : dato === "ha" || dato === "ephs" ? haTxt(v) : num(v));
// El aprovechamiento es «estimado» cuando ninguna cinta de la celda tiene movimientos reales (se usó el % aplicado de la finca).
const esEstimado = (dato, c) => dato === "aprov" && c && c.real === 0;

export default function TablaJuntos({ resultado, periodo, ocultas, onGraficas, params, onParamsChange, puedeEditar = false }) {
  // Semanas desplegadas: debajo de la semana se ve de dónde salen sus racimos, edad por edad.
  const [abiertas, setAbiertas] = useState(() => new Set());
  const alternar = (clave) =>
    setAbiertas((prev) => {
      const n = new Set(prev);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });
  const filaDe = useMemo(() => new Map(resultado.filas.map((f) => [`${f.fincaUuid}|${f.semanaCodigo}`, f])), [resultado]);
  const [editando, setEditando] = useState(null); // `${fincaUuid}|${semana}` de la celda de ratio que se está editando
  const { fincas, celdas, sumaFincas, sumaPeriodos } = useMemo(() => acumular(resultado, periodo, ocultas), [resultado, periodo, ocultas]);
  const periodos = periodo === "semana" ? resultado.porSemana.map((s) => ({ clave: s.semanaCodigo, titulo: s.semanaCodigo, real: s.real })) : MESES.map((m, i) => ({ clave: i, titulo: m }));
  const totalPeriodo = (clave) => sumaFincas(fincas.map((f) => celdas.get(`${f.uuid}|${clave}`)).filter(Boolean));
  const totalFinca = (uuid) => sumaPeriodos(periodos.map((p) => celdas.get(`${uuid}|${p.clave}`)).filter(Boolean));
  const totalGeneral = sumaFincas(fincas.map((f) => totalFinca(f.uuid)));

  const W1 = periodo === "semana" ? 92 : 64; // ancho de la columna de periodo
  const ANCHO = { ha: 78, ephs: 66, embolses: 74, aprov: 78, racimos: 72, ratio: 66, cajas: 78 };
  const encabezado = { background: VERDE, color: "#fff" };
  // Cada finca es un grupo de cinco columnas; el borde izquierdo del grupo lo separa del siguiente.
  const grupo = { borderLeft: `2px solid ${BORDE}` };

  const celdaDe = (dato, c, extra = {}) => {
    const v = valorDe(dato, c);
    const estimado = esEstimado(dato, c);
    const def = DATOS.find((d) => d.id === dato);
    return {
      contenido: texto(dato, v),
      title: estimado
        ? "Sin movimientos reales en esta cinta: se usa el % de aprovechamiento aplicado a la finca"
        : dato === "ha" && c && c.haN > 0 && Math.abs(c.hae - c.ha) / c.haN > 0.05
          ? `Hectáreas teóricas (las reales más las entradas del plan al 100 %). Con la rampa de arranque, el embolse se calcula sobre ${haTxt(c.hae / c.haN)} ha efectivas.`
          : undefined,
      style: {
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        padding: "0.25rem 0.55rem",
        minWidth: ANCHO[dato],
        color: def.derivado ? "#5b6b61" : "#1f2937",
        fontSize: def.derivado ? "0.78rem" : "0.84rem",
        fontWeight: def.resultado ? 700 : 500,
        fontStyle: estimado ? "italic" : undefined,
        ...(def.resultado ? { background: "#eef7f1" } : {}),
        ...extra,
      },
    };
  };

  // Ratio fijado a mano (por finca y semana). Se guarda en los parámetros del escenario y se aplica al pulsar «Guardar y calcular».
  const manualDe = (uuid, clave) => params?.ratioManual?.[uuid]?.[clave];
  const fijarRatio = (uuid, clave, texto) => {
    const n = Number(String(texto).replace(",", "."));
    const todos = { ...(params?.ratioManual || {}) };
    const deFinca = { ...(todos[uuid] || {}) };
    if (String(texto).trim() === "" || !Number.isFinite(n) || n <= 0) delete deFinca[clave];
    else deFinca[clave] = Math.round(Math.min(5, n) * 10000) / 10000;
    if (Object.keys(deFinca).length) todos[uuid] = deFinca;
    else delete todos[uuid];
    onParamsChange({ ...params, ratioManual: todos });
    setEditando(null);
  };
  const editable = puedeEditar && periodo === "semana" && typeof onParamsChange === "function";
  const celdaRatio = (f, clave, base) => {
    const k = `${f.uuid}|${clave}`;
    const c = celdas.get(k);
    if (!editable || !c || c.realF > 0) return base; // semana real o sin dato: solo lectura
    const m = manualDe(f.uuid, clave);
    const fijado = m !== undefined || c.manual > 0;
    if (editando === k) {
      return {
        ...base,
        contenido: (
          <input
            autoFocus
            type="number"
            step="0.0001"
            min="0"
            max="5"
            className="form-control form-control-sm text-end p-0 px-1"
            style={{ width: 78, fontSize: "0.78rem" }}
            defaultValue={m ?? (valorDe("ratio", c) ? Number(valorDe("ratio", c).toFixed(4)) : "")}
            placeholder="automático"
            onBlur={(e) => fijarRatio(f.uuid, clave, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditando(null);
            }}
          />
        ),
        editando: true,
      };
    }
    return {
      ...base,
      contenido: m !== undefined ? ratioTxt(m) : base.contenido,
      title: m !== undefined ? "Ratio fijado a mano (sin guardar aún si cambió). Clic para editar; déjalo vacío para volver al automático." : c.manual > 0 ? "Ratio fijado a mano. Clic para editar; déjalo vacío para volver al automático." : "Clic para fijar el ratio a mano",
      style: { ...base.style, cursor: "text", ...(fijado ? { color: "#b45309", fontWeight: 700, background: "#fff7ed", boxShadow: "inset 0 -2px 0 #f59e0b" } : { textDecoration: "underline dotted #9ca3af", textUnderlineOffset: 3 }) },
      onClick: () => setEditando(k),
    };
  };

  // Ratio TOTAL de una semana: se reparte entre las fincas con semana proyectada, escalando el ratio de cada una por el mismo factor para que el total
  // de la semana (cajas / racimos) quede en el valor escrito. Las fincas con semana real no se tocan. Vacío = vuelve al automático.
  const fijarRatioTotal = (clave, texto) => {
    setEditando(null);
    const todos = { ...(params?.ratioManual || {}) };
    const filasSemana = fincas.map((f) => ({ f, c: celdas.get(`${f.uuid}|${clave}`) })).filter((x) => x.c);
    const proyectadas = filasSemana.filter((x) => x.c.realF === 0 && x.c.racimos > 0 && x.c.cajas > 0);
    if (proyectadas.length === 0) return;
    const poner = (uuid, valor) => {
      const deFinca = { ...(todos[uuid] || {}) };
      if (valor === null) delete deFinca[clave];
      else deFinca[clave] = valor;
      if (Object.keys(deFinca).length) todos[uuid] = deFinca;
      else delete todos[uuid];
    };
    const n = Number(String(texto).replace(",", "."));
    if (String(texto).trim() === "" || !Number.isFinite(n) || n <= 0) {
      for (const { f } of proyectadas) poner(f.uuid, null);
    } else {
      const racimosTotal = filasSemana.reduce((t, x) => t + x.c.racimos, 0);
      const cajasReal = filasSemana.filter((x) => x.c.realF > 0).reduce((t, x) => t + x.c.cajas, 0);
      const cajasProy = proyectadas.reduce((t, x) => t + x.c.cajas, 0);
      const k = (n * racimosTotal - cajasReal) / cajasProy;
      const nuevos = proyectadas.map(({ f, c }) => [f.uuid, Math.round((c.cajas / c.racimos) * k * 10000) / 10000]);
      if (!(k > 0) || nuevos.some(([, v]) => !(v >= 0.0001 && v <= 5))) return; // valor imposible para esta semana: se ignora
      for (const [uuid, v] of nuevos) poner(uuid, v);
    }
    onParamsChange({ ...params, ratioManual: todos });
  };
  const celdaRatioTotal = (clave, tot, base) => {
    if (!editable || !tot || tot.realF >= tot.filas || tot.filas === 0) return base; // todas las fincas con semana real: solo lectura
    const k = `total|${clave}`;
    const fijado = tot.manual > 0;
    if (editando === k) {
      return {
        ...base,
        contenido: (
          <input
            autoFocus
            type="number"
            step="0.0001"
            min="0"
            max="5"
            className="form-control form-control-sm text-end p-0 px-1"
            style={{ width: 78, fontSize: "0.78rem" }}
            defaultValue={valorDe("ratio", tot) ? Number(valorDe("ratio", tot).toFixed(4)) : ""}
            placeholder="automático"
            onBlur={(e) => fijarRatioTotal(clave, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditando(null);
            }}
          />
        ),
      };
    }
    return {
      ...base,
      title: "Clic para fijar el ratio total de la semana: se reparte entre las fincas con semana proyectada, manteniendo sus diferencias. Déjalo vacío para volver al automático.",
      style: { ...base.style, cursor: "text", ...(fijado ? { color: "#b45309", boxShadow: "inset 0 -2px 0 #f59e0b" } : { textDecoration: "underline dotted #9ca3af", textUnderlineOffset: 3 }) },
      onClick: () => setEditando(k),
    };
  };

  // Una fila de celdas (cinco por finca + cinco del total) para un periodo o para el pie.
  const celdasFila = (obtener, totalFila, { fondo, borde = {}, color, fondoTotal, colorTotal, clave } = {}) => [
    ...fincas.flatMap((f) =>
      DATOS.map((d, di) => {
        let c = celdaDe(d.id, obtener(f.uuid), { ...(di === 0 ? grupo : {}), ...borde, ...(fondo ? { background: fondo } : {}), ...(color ? { color } : {}) });
        if (d.id === "ratio" && clave !== undefined) c = celdaRatio(f, clave, c);
        return (
          <td key={`${f.uuid}-${d.id}`} style={c.style} title={c.title} onClick={c.onClick}>
            {c.contenido}
          </td>
        );
      }),
    ),
    ...DATOS.map((d, di) => {
      let c = celdaDe(d.id, totalFila, { ...(di === 0 ? grupo : {}), ...borde, fontWeight: 700, background: fondoTotal || "#e3efe7", ...(colorTotal ? { color: colorTotal } : {}) });
      if (d.id === "ratio" && clave !== undefined) c = celdaRatioTotal(clave, totalFila, c);
      return (
        <td key={`total-${d.id}`} style={c.style} title={c.title} onClick={c.onClick}>
          {c.contenido}
        </td>
      );
    }),
  ];

  return (
    <div>
      <p className="small text-secondary mb-2">
        Cada finca se lee de izquierda a derecha: <strong>embolses × aprovechamiento = racimos</strong>, y <strong>racimos × ratio = cajas</strong>. En cursiva, un aprovechamiento sin dato real
        todavía (usa el % aplicado a la finca). Haz clic en una semana para ver de qué cintas y edades salen sus racimos.{puedeEditar && periodo === "semana" && " Haz clic en el ratio de una semana proyectada para fijarlo a mano y luego pulsa Guardar y calcular."}
      </p>
      <div className="table-responsive border rounded-3" style={{ maxHeight: "68vh" }}>
        <table className="table table-sm align-middle mb-0" style={{ whiteSpace: "nowrap", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 3 }}>
            <tr>
              <th rowSpan={2} style={{ position: "sticky", left: 0, zIndex: 4, minWidth: W1, width: W1, ...encabezado, padding: "0.45rem 0.6rem", verticalAlign: "middle", boxShadow: "2px 0 0 #cfdcd3" }}>
                {periodo === "semana" ? "Semana" : "Mes"}
              </th>
              {fincas.map((f) => (
                <th
                  key={f.uuid}
                  colSpan={DATOS.length}
                  role="button"
                  title="Clic para ver las gráficas de esta finca"
                  className="text-center"
                  style={{ ...encabezado, ...grupo, padding: "0.4rem 0.6rem", cursor: "pointer", fontWeight: 700 }}
                  onClick={() => onGraficas({ uuids: [f.uuid], titulo: `Gráficas · ${f.nombre}` })}
                >
                  {f.nombre}
                </th>
              ))}
              <th
                colSpan={DATOS.length}
                role="button"
                title="Clic para ver las gráficas del total de las fincas visibles"
                className="text-center"
                style={{ background: "#14532d", color: "#fff", ...grupo, padding: "0.4rem 0.6rem", cursor: "pointer", fontWeight: 700 }}
                onClick={() => onGraficas({ uuids: fincas.map((f) => f.uuid), titulo: "Gráficas · Total de las fincas visibles" })}
              >
                Total
              </th>
            </tr>
            <tr>
              {[...fincas, { uuid: "total", total: true }].flatMap((f) =>
                DATOS.map((d, di) => (
                  <th
                    key={`${f.uuid}-${d.id}`}
                    title={d.ayuda}
                    className="text-end"
                    style={{
                      background: f.total ? "#1e6b43" : "#2f7a4d",
                      color: "#fff",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      padding: "0.25rem 0.55rem",
                      minWidth: ANCHO[d.id],
                      borderBottom: `3px solid ${d.color}`,
                      ...(di === 0 ? grupo : {}),
                    }}
                  >
                    {d.corto}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {periodos.map((pr, bi) => {
              const fondo = bi % 2 === 0 ? "#ffffff" : "#f6faf7"; // filas alternas
              const desplegable = periodo === "semana";
              const abierta = desplegable && abiertas.has(pr.clave);
              const bordeAbierta = abierta ? { borderTop: `2px solid ${VERDE}` } : { borderTop: "1px solid #e5ece7" };
              // Desglose de los racimos de esta semana: cada edad de corte (8 a 12) viene de una cinta (semana de embolse) distinta.
              const detalle = abierta ? [0, 1, 2, 3, 4] : [];
              const detalleDe = (uuid, idx) => filaDe.get(`${uuid}|${pr.clave}`)?.detalleEdades?.[idx];
              const origen = (idx) => fincas.map((f) => detalleDe(f.uuid, idx)).find((d) => d?.semanaCodigo);
              return (
                <Fragment key={pr.clave}>
                <tr>
                  <td
                    className="fw-bold"
                    role={desplegable ? "button" : undefined}
                    onClick={desplegable ? () => alternar(pr.clave) : undefined}
                    title={desplegable ? "Clic para ver de qué cintas y edades salen los racimos de esta semana" : undefined}
                    style={{ position: "sticky", left: 0, zIndex: 2, background: fondo, minWidth: W1, width: W1, padding: "0.25rem 0.6rem", color: "#14532d", boxShadow: "2px 0 0 #cfdcd3", cursor: desplegable ? "pointer" : undefined, whiteSpace: "nowrap", ...bordeAbierta }}
                  >
                    {desplegable && (abierta ? <FiChevronDown className="me-1" /> : <FiChevronRight className="me-1" />)}
                    {pr.titulo}
                    {pr.real && (
                      <span className="badge rounded-1 ms-1" style={{ background: "#dcfce7", color: "#166534", fontWeight: 600, fontSize: "0.62rem" }} title="Semana ya transcurrida: usa el dato real">
                        Real
                      </span>
                    )}
                  </td>
                  {celdasFila((uuid) => celdas.get(`${uuid}|${pr.clave}`), totalPeriodo(pr.clave), { fondo, borde: bordeAbierta, clave: pr.clave })}
                </tr>
                {detalle.map((idx) => {
                  const o = origen(idx);
                  const fondoDet = "#eef5f0";
                  const base = { background: fondoDet, fontSize: "0.76rem", color: "#374151", padding: "0.15rem 0.55rem", textAlign: "right", fontVariantNumeric: "tabular-nums", borderTop: "1px solid #dfe9e2" };
                  const fin = idx === detalle.length - 1 ? { borderBottom: `2px solid ${VERDE}` } : {};
                  const sumaEmb = fincas.reduce((t, f) => t + (detalleDe(f.uuid, idx)?.embolse || 0), 0);
                  const sumaRac = fincas.reduce((t, f) => t + (detalleDe(f.uuid, idx)?.descartado ? 0 : detalleDe(f.uuid, idx)?.racimos || 0), 0);
                  const sumaEmbValido = fincas.reduce((t, f) => t + (detalleDe(f.uuid, idx)?.descartado ? 0 : detalleDe(f.uuid, idx)?.embolse || 0), 0);
                  const celdaDet = (id, d, esTotal = false) => {
                    if (id === "embolses") return d ? num(d.embolse) : "—";
                    if (id === "aprov") return d ? `${(d.tasa * 100).toFixed(2)}%` : "—";
                    if (id === "racimos") return d ? (d.descartado ? "—" : num(d.racimos)) : "—";
                    return "";
                  };
                  return (
                    <tr key={`det-${idx}`}>
                      <td style={{ position: "sticky", left: 0, zIndex: 2, background: fondoDet, minWidth: W1, width: W1, padding: "0.15rem 0.6rem 0.15rem 1.5rem", fontSize: "0.74rem", color: "#14532d", boxShadow: "2px 0 0 #cfdcd3", whiteSpace: "nowrap", borderTop: "1px solid #dfe9e2", ...fin }} title={o ? `Embolsado en ${o.semanaCodigo}: a esta semana tiene ${o.edad} semanas de edad` : undefined}>
                        Edad {[8, 9, 10, 11, 12][idx]} <span className="text-secondary">· {o?.semanaCodigo || "—"}</span>
                      </td>
                      {fincas.flatMap((f) => {
                        const d = detalleDe(f.uuid, idx);
                        return DATOS.map((dd, di) => (
                          <td
                            key={`${f.uuid}-${dd.id}`}
                            title={d ? (dd.id === "embolses" ? `${d.embolseReal ? "Embolse real" : "Embolse proyectado"} de la cinta ${d.semanaCodigo}` : dd.id === "aprov" ? `Porcentaje de la cinta que se corta a la edad ${d.edad}` : dd.id === "racimos" ? (d.descartado ? "Cinta embolsada antes de un cierre: no se cosecha" : `Embolse × porcentaje de corte`) : undefined) : undefined}
                            style={{ ...base, ...(di === 0 ? grupo : {}), ...fin, ...(dd.id === "embolses" && d && !d.embolseReal ? { fontStyle: "italic", color: "#6b7280" } : {}) }}
                          >
                            {celdaDet(dd.id, d)}
                          </td>
                        ));
                      })}
                      {DATOS.map((dd, di) => (
                        <td key={`t-${dd.id}`} style={{ ...base, background: "#e3efe7", fontWeight: 600, ...(di === 0 ? grupo : {}), ...fin }}>
                          {dd.id === "embolses" ? num(sumaEmb) : dd.id === "aprov" ? (sumaEmbValido > 0 ? `${((sumaRac / sumaEmbValido) * 100).toFixed(2)}%` : "—") : dd.id === "racimos" ? num(sumaRac) : ""}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {abierta && pr.real && (
                  <tr>
                    <td colSpan={1 + DATOS.length * (fincas.length + 1)} style={{ background: "#f8fafc", fontSize: "0.72rem", color: "#6b7280", padding: "0.2rem 0.6rem 0.2rem 1.5rem", borderBottom: `2px solid ${VERDE}` }}>
                      Semana real: los racimos de la fila de arriba son los realmente cosechados; este desglose usa los porcentajes de corte del modelo y puede no coincidir con ellos.
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot style={{ position: "sticky", bottom: 0, zIndex: 3 }}>
            <tr>
              <td style={{ position: "sticky", left: 0, zIndex: 4, ...encabezado, minWidth: W1, width: W1, padding: "0.4rem 0.6rem", fontWeight: 700, boxShadow: "2px 0 0 #cfdcd3" }}>Total</td>
              {celdasFila((uuid) => totalFinca(uuid), totalGeneral, { fondo: "#d1ecdc", color: "#14532d", borde: { borderTop: `2px solid ${VERDE}`, fontWeight: 700 }, fondoTotal: "#14532d", colorTotal: "#fff" })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Excel con la misma disposición: una fila por semana (o mes); las cinco cifras en columnas bajo cada finca y bajo el total.
export async function exportarJuntos({ resultado, periodo, ocultas, nombreEscenario }) {
  const { fincas, celdas, sumaFincas, sumaPeriodos } = acumular(resultado, periodo, ocultas);
  const periodos = periodo === "semana" ? resultado.porSemana.map((s) => ({ clave: s.semanaCodigo, titulo: s.real ? `${s.semanaCodigo} *` : s.semanaCodigo })) : MESES.map((m, i) => ({ clave: i, titulo: m }));
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet(periodo === "semana" ? "Por semana y finca" : "Por mes y finca");
  hoja.addRow([`Proyección ${resultado.meta.anio}${nombreEscenario ? ` · ${nombreEscenario}` : ""} · Embolses, aprovechamiento, racimos, ratio y cajas`]).font = { bold: true, size: 12 };
  hoja.addRow(["Embolses × aprovechamiento = racimos; racimos × ratio = cajas." + (periodo === "semana" ? " * Semana ya transcurrida: dato real." : "")]).font = { italic: true, color: { argb: "FF6B7280" } };
  hoja.addRow([]);
  const grupos = [...fincas.map((f) => f.nombre), "Total"];
  const verde = (cell, argb = "FF166534") => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } });
  const fila1 = hoja.addRow([periodo === "semana" ? "Semana" : "Mes", ...grupos.flatMap((g) => [g, ...Array(DATOS.length - 1).fill("")])]);
  const fila2 = hoja.addRow(["", ...grupos.flatMap(() => DATOS.map((d) => d.corto))]);
  grupos.forEach((_, gi) => hoja.mergeCells(fila1.number, 2 + gi * DATOS.length, fila1.number, 1 + (gi + 1) * DATOS.length));
  hoja.mergeCells(fila1.number, 1, fila2.number, 1);
  for (const fila of [fila1, fila2]) {
    fila.font = { bold: true, color: { argb: "FFFFFFFF" } };
    fila.alignment = { horizontal: "center", vertical: "middle" };
    fila.eachCell((c) => verde(c));
  }
  const redondeo = (v, d) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d);
  const valores = (c) => DATOS.map((d) => redondeo(valorDe(d.id, c), d.id === "aprov" || d.id === "ratio" ? 4 : d.id === "ha" || d.id === "ephs" ? 2 : 0));
  const formatear = (fila) =>
    fila.eachCell({ includeEmpty: false }, (cell, n) => {
      if (n === 1) return;
      const d = DATOS[(n - 2) % DATOS.length];
      cell.numFmt = d.id === "aprov" ? "0.0%" : d.id === "ratio" ? "0.0000" : d.id === "ha" || d.id === "ephs" ? "#,##0.0" : "#,##0";
    });
  for (const pr of periodos) {
    const por = fincas.map((f) => celdas.get(`${f.uuid}|${pr.clave}`));
    formatear(hoja.addRow([pr.titulo, ...por.flatMap(valores), ...valores(sumaFincas(por.filter(Boolean)))]));
  }
  const porFinca = fincas.map((f) => sumaPeriodos(periodos.map((p) => celdas.get(`${f.uuid}|${p.clave}`)).filter(Boolean)));
  const pie = hoja.addRow(["Total", ...porFinca.flatMap(valores), ...valores(sumaFincas(porFinca))]);
  formatear(pie);
  pie.font = { bold: true };
  hoja.getColumn(1).width = 14;
  for (let i = 2; i <= 1 + grupos.length * DATOS.length; i += 1) hoja.getColumn(i).width = 12;
  hoja.views = [{ state: "frozen", xSplit: 1, ySplit: fila2.number }];

  const blob = new Blob([await libro.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `proyeccion-${resultado.meta.anio}-${periodo === "semana" ? "semana" : "mes"}-finca-juntos.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
