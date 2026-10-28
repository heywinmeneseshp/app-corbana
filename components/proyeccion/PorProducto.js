"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowDown, FiArrowUp, FiChevronDown, FiChevronRight, FiDownload, FiPlus, FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import ModalShell from "@/components/ModalShell";

// Miles con punto y decimales con coma (1.234.567,5). Se usa "de-DE" porque "es" no agrupa los números de 4 cifras (1234).
const fmt = (n, d = 0) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }));
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
// Una semana pertenece al mes donde cae la mayoría de sus días: con semanas de lunes a domingo es el mes de su jueves (4.º día).
const mesDe = (fechaInicio) => new Date(new Date(`${String(fechaInicio).slice(0, 10)}T00:00:00Z`).getTime() + 3 * 86400000).getUTCMonth();
const encabezado = { background: "#166534", color: "#fff" };
const primeraCol = "#e8f6ee";
const pie = "#d1ecdc";

// Escenario de cajas que se reparte: el mismo rango de la proyección (conservador = p25, normal, optimista = p75).
const ESCENARIOS = [
  { id: "conservador", label: "Conservador", campo: "cajasBajo" },
  { id: "normal", label: "Normal", campo: "cajas" },
  { id: "optimista", label: "Optimista", campo: "cajasAlto" },
];

const MODOS = [
  { id: "CONTENEDORES", label: "Contenedores por semana" },
  { id: "PORCENTAJE", label: "% de los kilos" },
  { id: "RESTO", label: "Resto (lo que sobra)" },
  { id: "FINCA", label: "Toda la fruta de fincas" },
];
// Cajas por contenedor: palets completos (cajas por palet × palets) más minipalets (cajas por minipalet × cantidad).
const cajasContenedor = (p) => Number(p.cajasPorPalet || 0) * Number(p.cantidadPalets || 0) + Number(p.cajasPorMinipalet || 0) * Number(p.cantidadMinipalets || 0);

// Mismo reparto que el backend (proyeccion.service.js#repartirKilos): primero los contenedores fijos, luego los porcentajes (sobre los
// kilos totales) y el producto «resto» se queda con lo que sobra. Si los kilos no alcanzan, se asigna en ese orden y la semana
// queda marcada como faltante.
// Un producto por contenedores aplica solo en las semanas que le tocan: cada N semanas desde la semana `desdeSemana`.
const aplicaEnSemana = (p, numeroSemana) => {
  const cada = Math.max(1, Number(p.cadaSemanas || 1));
  if (cada === 1 || numeroSemana === undefined) return true;
  const d = Number(numeroSemana) - Number(p.desdeSemana || 1);
  return ((d % cada) + cada) % cada === 0;
};

// FINCA (primero): el producto llena solo los contenedores completos que alcanza con la fruta de sus fincas (`kgPorFinca`); lo que
// sobra de esas fincas entra al reparto general con las demás. Nunca toma fruta de otras fincas.
function repartirKilos(kg, lista, numeroSemana, kgPorFinca = {}) {
  let restante = kg;
  const cajas = {};
  let faltante = false;
  for (const p of lista.filter((x) => x.modo === "FINCA")) {
    const kgFincas = (p.fincaUuids || []).reduce((a, u) => a + (kgPorFinca[u] || 0), 0);
    if (!(p.pesoNeto > 0)) {
      cajas[p.uuid] = null;
      continue;
    }
    const exactas = Math.min(kgFincas, restante) / p.pesoNeto;
    const porCont = Number(p.cajasPorContenedor || 0);
    const n = porCont > 0 ? Math.floor(exactas / porCont + 1e-9) * porCont : exactas;
    cajas[p.uuid] = n;
    restante -= n * p.pesoNeto;
  }
  const asignar = (p, pedido) => {
    const real = Math.max(0, Math.min(restante, pedido));
    if (pedido - real > 0.0001) faltante = true;
    restante -= real;
    cajas[p.uuid] = p.pesoNeto > 0 ? real / p.pesoNeto : null;
  };
  for (const p of lista.filter((x) => x.modo === "CONTENEDORES")) asignar(p, aplicaEnSemana(p, numeroSemana) ? Number(p.contenedores || 0) * Number(p.cajasPorContenedor || 0) * p.pesoNeto : 0);
  for (const p of lista.filter((x) => x.modo === "PORCENTAJE")) asignar(p, (kg * Number(p.porcentaje || 0)) / 100);
  const resto = lista.find((x) => x.modo === "RESTO");
  if (resto) {
    // El producto «resto» se redondea SIEMPRE hacia arriba a contenedores completos (cajas por contenedor × contenedores).
    const exactas = resto.pesoNeto > 0 ? Math.max(0, restante) / resto.pesoNeto : null;
    const porCont = Number(resto.cajasPorContenedor || 0);
    cajas[resto.uuid] = exactas !== null && porCont > 0 ? Math.ceil(exactas / porCont - 1e-9) * porCont : exactas;
    restante = 0;
  }
  return { cajas, sinAsignar: Math.max(0, restante), faltante };
}

// Casillas desplegables para elegir las fincas de un producto FINCA. `ocupadas`: fincas que ya están en otro producto FINCA.
function SelectorFincas({ fincas, valor, ocupadas, onChange, disabled }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => ref.current && !ref.current.contains(e.target) && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);
  const nombres = fincas.filter((f) => valor.includes(f.fincaUuid)).map((f) => f.fincaNombre);
  return (
    <div className="position-relative" ref={ref}>
      <button type="button" className="form-select form-select-sm text-start text-truncate" style={{ minWidth: 160 }} disabled={disabled} onClick={() => setAbierto((v) => !v)} title={nombres.join(", ")}>
        {nombres.length ? nombres.join(", ") : <span className="text-secondary">Elige las fincas...</span>}
      </button>
      {abierto && (
        <div className="card shadow position-absolute p-2 mt-1" style={{ zIndex: 30, minWidth: 220, maxHeight: 260, overflowY: "auto" }}>
          {fincas.map((f) => {
            const enOtro = ocupadas.has(f.fincaUuid);
            return (
              <label key={f.fincaUuid} className={`d-flex align-items-center gap-2 small py-1 ${enOtro ? "text-secondary" : ""}`} title={enOtro ? "Ya está en otro producto" : undefined}>
                <input
                  type="checkbox"
                  className="form-check-input m-0"
                  disabled={enOtro}
                  checked={valor.includes(f.fincaUuid)}
                  onChange={(e) => onChange(e.target.checked ? [...valor, f.fincaUuid] : valor.filter((u) => u !== f.fincaUuid))}
                />
                {f.fincaNombre}
                {enOtro && <span className="ms-auto" style={{ fontSize: "0.7rem" }}>en otro producto</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Crear un producto nuevo desde el reparto (p. ej. «Fruta orgánica»); se guarda en Maestros → Productos.
function NuevoProductoModal({ onClose, onCreado }) {
  const [f, setF] = useState({ nombre: "", codigo: "", pesoNeto: "", cajasPorPalet: "", cantidadPalets: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const campo = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const num = (v) => (v === "" ? null : Number(String(v).replace(",", ".")));

  async function guardar(e) {
    e.preventDefault();
    if (!(num(f.pesoNeto) > 0)) return setError("Escribe el peso neto de la caja en kg.");
    setGuardando(true);
    setError("");
    try {
      const creado = await apiFetch("/productos", {
        method: "POST",
        body: JSON.stringify({
          nombre: f.nombre.trim(),
          codigo: f.codigo.trim() || null,
          pesoNeto: num(f.pesoNeto),
          cajasPorPalet: num(f.cajasPorPalet),
          cantidadPalets: num(f.cantidadPalets),
        }),
      });
      onCreado(creado);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalShell title="Nuevo producto" onClose={onClose} height="auto">
      <form onSubmit={guardar} className="row g-2">
        <div className="col-12">
          <label className="form-label small fw-medium">Nombre</label>
          <input className="form-control form-control-sm rounded-3" required minLength={2} maxLength={150} placeholder="Ej. Fruta orgánica" value={f.nombre} onChange={(e) => campo("nombre", e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label small fw-medium">Código (opcional)</label>
          <input className="form-control form-control-sm rounded-3" maxLength={20} value={f.codigo} onChange={(e) => campo("codigo", e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label small fw-medium">Peso neto por caja (kg)</label>
          <input type="number" min="0" step="0.001" className="form-control form-control-sm rounded-3" required value={f.pesoNeto} onChange={(e) => campo("pesoNeto", e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label small fw-medium">Cajas por palet</label>
          <input type="number" min="0" step="1" className="form-control form-control-sm rounded-3" value={f.cajasPorPalet} onChange={(e) => campo("cajasPorPalet", e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label small fw-medium">Palets por contenedor</label>
          <input type="number" min="0" step="1" className="form-control form-control-sm rounded-3" value={f.cantidadPalets} onChange={(e) => campo("cantidadPalets", e.target.value)} />
        </div>
        <div className="col-12 small text-secondary">Cajas por palet × palets = cajas por contenedor (se pueden cambiar luego en Maestros → Productos).</div>
        {error && <div className="col-12 alert alert-danger py-2 small mb-0">{error}</div>}
        <div className="col-12 d-flex justify-content-end gap-2 mt-2">
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={guardando}>
            {guardando ? "Guardando..." : "Crear producto"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// Reparto de las cajas proyectadas por producto. El total de cajas de cada semana (suma de las fincas visibles) se convierte a kilos con
// el peso de la caja de referencia (tasa de conversión, hoy 18.6) y se reparte entre productos: contenedores fijos por semana, % de
// los kilos y un producto que se queda con el resto. Cada producto convierte sus kilos en cajas con su peso neto. Una sola mezcla para todas las fincas.
export default function PorProducto({ resultado, ocultas, productos, onChange, puedeEditar, nombreEscenario = "" }) {
  const tasa = resultado.meta.tasaConversion ?? 18.6;
  const [catalogo, setCatalogo] = useState([]);
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState("CONTENEDORES");
  const [valor, setValor] = useState("");
  const [error, setError] = useState("");
  const [periodo, setPeriodo] = useState("semana"); // semana | mes
  const [escenario, setEscenario] = useState("normal"); // conservador | normal | optimista
  const campoCajas = ESCENARIOS.find((e) => e.id === escenario).campo;
  const nombreEscenarioCajas = ESCENARIOS.find((e) => e.id === escenario).label;
  const [abierto, setAbierto] = useState(true); // panel de productos desplegado o colapsado
  const [fincasNuevo, setFincasNuevo] = useState([]); // fincas del producto que se va a agregar en modo FINCA
  const [nuevoProducto, setNuevoProducto] = useState(false);
  const fincasLista = resultado.aprovechamiento || [];
  const fincasOcupadas = (excepto) => new Set(productos.filter((x) => x.modo === "FINCA" && x.uuid !== excepto).flatMap((x) => x.fincaUuids || []));
  const nombreFinca = useMemo(() => new Map((resultado.aprovechamiento || []).map((f) => [f.fincaUuid, f.fincaNombre])), [resultado]);

  useEffect(() => {
    apiFetch("/productos?limit=100")
      .then(({ items }) => setCatalogo((items || []).filter((p) => p.estado !== false && Number(p.pesoNeto) > 0)))
      .catch(() => {});
  }, []);

  const etiqueta = (p) => (p.codigo ? `${p.nombre} (${p.codigo})` : p.nombre);
  const porEtiqueta = useMemo(() => new Map(catalogo.map((p) => [etiqueta(p), p])), [catalogo]);
  const disponibles = catalogo.filter((p) => !productos.some((x) => x.uuid === p.uuid) && (modo !== "CONTENEDORES" || cajasContenedor(p) > 0));
  // Mezcla general = todo menos los productos FINCA (esos solo toman la fruta de sus fincas).
  const generales = productos.filter((p) => p.modo !== "FINCA");
  const hayResto = generales.some((p) => p.modo === "RESTO");
  const hayContenedores = generales.some((p) => p.modo === "CONTENEDORES");
  // Con fincas dedicadas los % (sobre el total) no pueden sumar 100: hace falta un «resto» que se quede con lo que queda.
  const hayFinca = productos.some((p) => p.modo === "FINCA");
  const sumaPct = Math.round(generales.filter((p) => p.modo === "PORCENTAJE").reduce((a, p) => a + Number(p.porcentaje || 0), 0) * 100) / 100;
  // Válido: con «resto» basta que los % no pasen de 100; sin «resto» todo debe ser por % y sumar 100. Solo productos FINCA también vale.
  const valido =
    productos.length > 0 &&
    productos.filter((p) => p.modo === "FINCA").every((p) => (p.fincaUuids || []).length > 0) &&
    (generales.length === 0 || (hayResto ? sumaPct <= 100.01 : !hayContenedores && !hayFinca && Math.abs(sumaPct - 100) < 0.01));

  function agregar() {
    setError("");
    const prod = porEtiqueta.get(texto);
    const num = Number(String(valor).replace(",", "."));
    if (!prod) return setError("Elige un producto de la lista de sugerencias (solo aparecen productos con peso neto).");
    if (modo === "RESTO" && hayResto) return setError("Solo un producto puede quedarse con el resto.");
    if (modo === "PORCENTAJE" && !(num > 0 && num <= 100)) return setError("Escribe un porcentaje entre 0 y 100.");
    if (modo === "CONTENEDORES" && !(num > 0)) return setError("Escribe cuántos contenedores por semana.");
    if (modo === "FINCA" && fincasNuevo.length === 0) return setError("Elige las fincas cuya fruta va a este producto.");
    onChange([
      ...productos,
      {
        uuid: prod.uuid,
        codigo: prod.codigo,
        nombre: prod.nombre,
        pesoNeto: Number(prod.pesoNeto),
        cajasPorContenedor: cajasContenedor(prod),
        cajasCatalogo: cajasContenedor(prod),
        cajasContenedor: null,
        modo,
        porcentaje: modo === "PORCENTAJE" ? num : null,
        contenedores: modo === "CONTENEDORES" ? num : null,
        cadaSemanas: 1,
        desdeSemana: 1,
        fincaUuids: modo === "FINCA" ? fincasNuevo : [],
      },
    ]);
    setTexto("");
    setValor("");
    setFincasNuevo([]);
  }

  // Orden de las columnas de la tabla: se mueve el producto una posición arriba (-1) o abajo (+1).
  const mover = (uuid, delta) => {
    const i = productos.findIndex((p) => p.uuid === uuid);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= productos.length) return;
    const copia = [...productos];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onChange(copia);
  };
  const cambiar = (uuid, cambios) => onChange(productos.map((p) => (p.uuid === uuid ? { ...p, ...cambios } : p)));
  const cambiarModo = (p, nuevo) => {
    if (nuevo === "RESTO" && productos.some((x) => x.modo === "RESTO" && x.uuid !== p.uuid)) return setError("Solo un producto puede quedarse con el resto.");
    setError("");
    cambiar(p.uuid, {
      modo: nuevo,
      porcentaje: nuevo === "PORCENTAJE" ? p.porcentaje || "" : null,
      contenedores: nuevo === "CONTENEDORES" ? p.contenedores || "" : null,
      fincaUuids: nuevo === "FINCA" ? (p.fincaUuids || []).filter((u) => !fincasOcupadas(p.uuid).has(u)) : [],
    });
  };

  // Cajas 18.6 de cada semana del escenario elegido (en semanas reales los tres valen lo mismo), sumando solo las fincas visibles.
  const semanas = useMemo(() => {
    const m = new Map();
    for (const f of resultado.filas) {
      if (ocultas.has(f.fincaUuid)) continue;
      const cajasFila = Number(f[campoCajas] ?? f.cajas) || 0;
      const t = m.get(f.semanaCodigo) || { semanaCodigo: f.semanaCodigo, numeroSemana: f.numeroSemana, fechaInicio: f.fechaInicio, real: f.real, cajas: 0, porFinca: {} };
      t.cajas += cajasFila;
      t.porFinca[f.fincaUuid] = (t.porFinca[f.fincaUuid] || 0) + cajasFila;
      m.set(f.semanaCodigo, t);
    }
    return [...m.values()];
  }, [resultado, ocultas, campoCajas]);

  const filasSemana = semanas.map((s) => {
    const kg = s.cajas * tasa;
    const kgPorFinca = Object.fromEntries(Object.entries(s.porFinca).map(([u, c]) => [u, c * tasa]));
    const rep = repartirKilos(kg, productos, s.numeroSemana, kgPorFinca);
    return { ...s, titulo: s.semanaCodigo, kg, faltante: rep.faltante, sinAsignar: rep.sinAsignar, productos: rep.cajas };
  });
  // Totales por mes: cada semana suma al mes donde está la mayoría de sus días.
  const filasMes = (() => {
    const m = new Map();
    for (const f of filasSemana) {
      const idx = mesDe(f.fechaInicio);
      const t = m.get(idx) || { clave: idx, semanasN: 0, real: true, cajas: 0, kg: 0, faltante: false, productos: Object.fromEntries(productos.map((p) => [p.uuid, 0])) };
      t.semanasN += 1;
      t.real = t.real && f.real;
      t.cajas += f.cajas;
      t.kg += f.kg;
      t.faltante = t.faltante || f.faltante;
      for (const p of productos) t.productos[p.uuid] += f.productos[p.uuid] || 0;
      m.set(idx, t);
    }
    return [...m.values()].sort((a, b) => a.clave - b.clave).map((t) => ({ ...t, semanaCodigo: MESES[t.clave], titulo: MESES[t.clave] }));
  })();
  const filas = periodo === "mes" ? filasMes : filasSemana; // base de los totales del año (no incluye subtotales)
  // Fila de semestre: suma de los meses del semestre (I = enero a junio, II = julio a diciembre).
  const filaSemestre = (n) => {
    const meses = filasMes.filter((m) => (n === 1 ? m.clave <= 5 : m.clave >= 6));
    if (meses.length === 0) return null;
    const t = { esSemestre: true, esSubtotal: true, clave: `sem-${n}`, semanasN: 0, real: false, cajas: 0, kg: 0, faltante: false, productos: Object.fromEntries(productos.map((p) => [p.uuid, 0])) };
    for (const m of meses) {
      t.semanasN += m.semanasN;
      t.cajas += m.cajas;
      t.kg += m.kg;
      t.faltante = t.faltante || m.faltante;
      for (const p of productos) t.productos[p.uuid] += m.productos[p.uuid] || 0;
    }
    return { ...t, titulo: `Total semestre ${n === 1 ? "I" : "II"}` };
  };
  // Después de junio se inserta el total del semestre I y después de diciembre el del semestre II.
  const conSemestre = (idx) => (idx === 5 ? filaSemestre(1) : idx === 11 ? filaSemestre(2) : null);
  // Vista semanal: después de la última semana de cada mes va el total de ese mes (y el del semestre al cerrar junio y diciembre).
  const construirVista = (per) => {
    const out = [];
    if (per === "mes") {
      for (const m of filasMes) {
        out.push(m);
        const sem = conSemestre(m.clave);
        if (sem) out.push(sem);
      }
      return out;
    }
    const porMes = new Map(filasMes.map((m) => [m.clave, m]));
    filasSemana.forEach((f, i) => {
      out.push(f);
      const idx = mesDe(f.fechaInicio);
      const sig = filasSemana[i + 1];
      if (!sig || mesDe(sig.fechaInicio) !== idx) {
        out.push({ ...porMes.get(idx), esSubtotal: true, titulo: `Total ${MESES[idx]}` });
        const sem = conSemestre(idx);
        if (sem) out.push(sem);
      }
    });
    return out;
  };
  const filasVista = construirVista(periodo);
  const totales = { cajas: 0, kg: 0, productos: Object.fromEntries(productos.map((p) => [p.uuid, 0])) };
  for (const f of filas) {
    totales.cajas += f.cajas;
    totales.kg += f.kg;
    for (const p of productos) totales.productos[p.uuid] += f.productos[p.uuid] || 0;
  }
  // Total de cajas reales (una a una, sin convertir a cajas de referencia): suma de las cajas de todos los productos.
  const sumaCajas = (mapa) => productos.reduce((a, p) => a + (mapa[p.uuid] || 0), 0);
  const totalCajasReales = sumaCajas(totales.productos);
  // Lo asignado a los productos (ya redondeado) convertido a cajas de referencia: kilos de los productos ÷ tasa. La diferencia con lo
  // proyectado es lo que sobra (+) o falta (−) por redondear a contenedores completos.
  const pesoDe = Object.fromEntries(productos.map((p) => [p.uuid, p.pesoNeto]));
  const kgAsignados = (mapa) => productos.reduce((a, p) => a + (mapa[p.uuid] || 0) * pesoDe[p.uuid], 0);
  const asignado18 = (mapa) => kgAsignados(mapa) / tasa;
  const semanasFaltantes = filas.filter((f) => f.faltante).length;
  const periodoNombre = (per) => (per === "mes" ? "Mes" : "Semana");
  const detalleModo = (p) =>
    p.modo === "CONTENEDORES"
      ? `${fmt(p.contenedores, 2)} cont.${p.cadaSemanas > 1 ? ` cada ${p.cadaSemanas} sem. desde S${p.desdeSemana}` : "/sem."}`
      : p.modo === "RESTO"
        ? "resto"
        : p.modo === "FINCA"
          ? `fincas: ${(p.fincaUuids || []).map((u) => nombreFinca.get(u) || "?").join(", ")}`
          : `${fmt(p.porcentaje, 2)} %`;
  // Kilos que no quedaron en ningún producto (p. ej. solo hay productos FINCA y sobran fincas).
  const kgSinAsignar = filasSemana.reduce((a, f) => a + (f.sinAsignar || 0), 0);

  // Descarga el informe en Excel con el mismo estilo de la pantalla: encabezados verdes, datos centrados, filas de total por mes,
  // semestre y año resaltadas, hoja semanal y hoja mensual.
  async function descargarExcel() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const verde = "FF166534";
    const relleno = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
    const borde = (grosor) => ({ top: { style: grosor, color: { argb: "FF14532D" } }, bottom: { style: grosor, color: { argb: "FF14532D" } } });
    const fino = { style: "thin", color: { argb: "FFB9C9BE" } };
    const todosFinos = { top: fino, bottom: fino, left: fino, right: fino };
    const centrado = { horizontal: "center", vertical: "middle", wrapText: true };
    const titulosProd = productos.map((p) => p.nombre); // solo el nombre del producto
    const cabeceras = [periodoNombre("semana"), `Cajas ${fmt(tasa, 1)}`, "Kilos", ...titulosProd, "Total cajas\nuna a una", `Asignado ${fmt(tasa, 1)}\nconvertido`, `Diferencia ${fmt(tasa, 1)}\nasignado − proyectado`];

    const hoja = (nombre, per) => {
      const ws = wb.addWorksheet(nombre, { views: [{ state: "frozen", xSplit: 1, ySplit: 4 }] });
      const ncol = cabeceras.length;
      ws.mergeCells(1, 1, 1, ncol);
      ws.getCell(1, 1).value = `Proyección ${resultado.meta.anio}${nombreEscenario ? ` · ${nombreEscenario}` : ""} · Cajas por producto · Escenario ${nombreEscenarioCajas}`;
      ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: verde } };
      ws.getCell(1, 1).alignment = { horizontal: "center" };
      ws.mergeCells(2, 1, 2, ncol);
      ws.getCell(2, 1).value = `Cajas ${fmt(tasa, 1)} × ${fmt(tasa, 1)} kg = kilos, repartidos entre productos (contenedores fijos, % de los kilos y resto redondeado hacia arriba a contenedores completos).`;
      ws.getCell(2, 1).font = { size: 9, color: { argb: "FF64748B" } };
      ws.getCell(2, 1).alignment = { horizontal: "center" };
      const cab = ws.getRow(4);
      cabeceras.forEach((t, i) => {
        const c = cab.getCell(i + 1);
        c.value = i === 0 ? periodoNombre(per) : t;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = relleno(verde);
        c.alignment = centrado;
        c.border = todosFinos;
      });
      cab.height = 42;
      let fila = 5;
      for (const f of construirVista(per)) {
        const r = ws.getRow(fila++);
        const asign = asignado18(f.productos);
        const valores = [f.titulo, Math.round(f.cajas), Math.round(f.kg), ...productos.map((p) => (f.productos[p.uuid] === null || f.productos[p.uuid] === undefined ? null : Math.round(f.productos[p.uuid]))), Math.round(sumaCajas(f.productos)), Math.round(asign), Math.round((asign - f.cajas) * 10) / 10];
        const colorFila = f.esSemestre ? "FFA8CDB5" : f.esSubtotal ? "FFCFE5D6" : f.faltante ? "FFFFF4E5" : null;
        valores.forEach((v, i) => {
          const c = r.getCell(i + 1);
          c.value = v;
          c.alignment = centrado;
          c.border = f.esSubtotal ? { ...todosFinos, ...borde(f.esSemestre ? "medium" : "thin") } : todosFinos;
          if (i === 0) {
            c.font = { bold: true, color: { argb: "FF14532D" } };
            c.fill = relleno(f.esSemestre ? "FF8FBFA0" : f.esSubtotal ? "FFB7D8C2" : "FFE8F6EE");
          } else {
            c.numFmt = i === valores.length - 1 ? "#,##0.0" : "#,##0";
            if (f.esSubtotal) c.font = { bold: true };
            if (colorFila) c.fill = relleno(colorFila);
          }
        });
        const cajasTotal = r.getCell(cabeceras.length - 2);
        cajasTotal.font = { bold: true };
        if (!colorFila) cajasTotal.fill = relleno("FFD1ECDC");
      }
      // Total del año
      const rt = ws.getRow(fila);
      const asignT = asignado18(totales.productos);
      const valoresT = ["Total año", Math.round(totales.cajas), Math.round(totales.kg), ...productos.map((p) => Math.round(totales.productos[p.uuid])), Math.round(totalCajasReales), Math.round(asignT), Math.round((asignT - totales.cajas) * 10) / 10];
      valoresT.forEach((v, i) => {
        const c = rt.getCell(i + 1);
        c.value = v;
        c.alignment = centrado;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = relleno(verde);
        c.border = todosFinos;
        if (i > 0) c.numFmt = i === valoresT.length - 1 ? "#,##0.0" : "#,##0";
      });
      ws.columns = cabeceras.map((_, i) => ({ width: i === 0 ? (per === "mes" ? 26 : 24) : i >= 3 && i < 3 + productos.length ? 22 : 16 }));
      ws.getCell(fila + 2, 1).value = `* Un mes suma las semanas con la mayoría de sus días en él. Fincas incluidas: ${resultado.aprovechamiento.length - ocultas.size} de ${resultado.aprovechamiento.length}.`;
      ws.getCell(fila + 2, 1).font = { size: 9, color: { argb: "FF64748B" } };
    };
    hoja("Por semana", "semana");
    hoja("Total por mes", "mes");
    const buffer = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `proyeccion-${resultado.meta.anio}-${(nombreEscenario || "escenario").replace(/[^a-zA-Z0-9-_]+/g, "_")}-por-producto-${escenario}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="border rounded-3 p-3 mb-3">
        <div className={`d-flex flex-wrap align-items-center justify-content-between gap-2 ${abierto ? "mb-2" : ""}`}>
          <button type="button" className="btn btn-link text-decoration-none p-0 fw-semibold d-inline-flex align-items-center gap-1" style={{ color: "inherit" }} aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} title={abierto ? "Colapsar" : "Desplegar"}>
            {abierto ? <FiChevronDown /> : <FiChevronRight />} Productos del reparto
            {!abierto && <span className="text-secondary fw-normal small ms-2">{productos.length} producto(s)</span>}
          </button>
          <div className="d-flex gap-2">
            {sumaPct > 0 && <span className="badge text-bg-light border fw-normal">% asignado: {fmt(sumaPct, 2)} %</span>}
            <span className={`badge ${valido ? "text-bg-success" : "text-bg-danger"} fw-normal`}>{valido
                ? "Reparto válido"
                : productos.some((p) => p.modo === "FINCA" && !(p.fincaUuids || []).length)
                  ? "Falta elegir fincas"
                  : (hayContenedores || hayFinca) && !hayResto
                    ? "Falta un producto «resto»"
                    : "Los % deben sumar 100"}</span>
          </div>
        </div>
        {abierto && (
          <>
        <p className="small text-secondary mb-2">
          Total de cajas de cada semana × {fmt(tasa, 1)} kg = kilos. Primero, cada producto de <strong>toda la fruta de fincas</strong> llena los contenedores completos que alcanza con la fruta de sus fincas (lo que sobra pasa a la mezcla general). Luego se asignan los <strong>contenedores por semana</strong> (palets completos más minipalets
          del producto), luego los <strong>% de los kilos</strong>, y el producto <strong>resto</strong> se queda con lo que sobra. El orden de las filas de este panel es el orden de las columnas de la tabla (usa las flechas para cambiarlo). Se guarda con
          «Guardar y calcular».
        </p>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-2 small" style={{ maxWidth: 900 }}>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="text-end">Peso neto (kg)</th>
                <th className="text-end">Cajas / contenedor</th>
                <th style={{ width: 210 }}>Tipo</th>
                <th style={{ width: 190 }} title="Solo para contenedores: cada cuántas semanas se asignan">Frecuencia</th>
                <th style={{ width: 190 }}>Valor</th>
                <th style={{ width: 96 }} className="text-end" title="Orden en que aparecen las columnas de la tabla">
                  Orden
                </th>
              </tr>
            </thead>
            <tbody>
              {productos.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-2">
                    Aún no hay productos: agrégalos abajo.
                  </td>
                </tr>
              )}
              {productos.map((p) => (
                <tr key={p.uuid}>
                  <td className="fw-medium">{etiqueta(p)}</td>
                  <td className="text-end">{fmt(p.pesoNeto, 3)}</td>
                  <td className="text-end">
                    {p.modo === "CONTENEDORES" || p.modo === "FINCA" ? (
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="form-control form-control-sm text-end"
                        style={{ width: 100, marginLeft: "auto" }}
                        disabled={!puedeEditar}
                        title={p.cajasCatalogo > 0 ? `Catálogo: ${fmt(p.cajasCatalogo)} (cajas por palet × palets más minipalets). Escribe otro valor para usarlo solo en este escenario.` : "Sin dato en el catálogo: escríbelo aquí"}
                        value={p.cajasPorContenedor || ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? 0 : Number(e.target.value);
                          cambiar(p.uuid, { cajasPorContenedor: v, cajasContenedor: v > 0 && v !== p.cajasCatalogo ? v : null });
                        }}
                      />
                    ) : p.cajasPorContenedor > 0 ? (
                      fmt(p.cajasPorContenedor)
                    ) : (
                      "—"
                    )}
                    {(p.modo === "CONTENEDORES" || p.modo === "FINCA") && p.cajasContenedor && p.cajasCatalogo > 0 && <div className="text-secondary" style={{ fontSize: "0.7rem" }}>catálogo: {fmt(p.cajasCatalogo)}</div>}
                  </td>
                  <td>
                    <select className="form-select form-select-sm" disabled={!puedeEditar} value={p.modo} onChange={(e) => cambiarModo(p, e.target.value)}>
                      {MODOS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {p.modo === "CONTENEDORES" ? (
                      <div className="d-flex align-items-center gap-1">
                        <select className="form-select form-select-sm" disabled={!puedeEditar} value={p.cadaSemanas || 1} onChange={(e) => cambiar(p.uuid, { cadaSemanas: Number(e.target.value) })}>
                          <option value={1}>Cada semana</option>
                          <option value={2}>Una sí, una no</option>
                          <option value={3}>Cada 3 semanas</option>
                          <option value={4}>Cada 4 semanas</option>
                        </select>
                        {(p.cadaSemanas || 1) > 1 && (
                          <input type="number" min="1" max="53" className="form-control form-control-sm" style={{ width: 62 }} disabled={!puedeEditar} title="Primera semana del año con contenedores" value={p.desdeSemana || 1} onChange={(e) => cambiar(p.uuid, { desdeSemana: Number(e.target.value) || 1 })} />
                        )}
                      </div>
                    ) : (
                      <span className="text-secondary">—</span>
                    )}
                  </td>
                  <td>
                    {p.modo === "PORCENTAJE" && <input type="number" min="0" max="100" step="0.01" className="form-control form-control-sm" disabled={!puedeEditar} value={p.porcentaje ?? ""} onChange={(e) => cambiar(p.uuid, { porcentaje: e.target.value === "" ? "" : Number(e.target.value) })} />}
                    {p.modo === "CONTENEDORES" && <input type="number" min="0" step="0.5" className="form-control form-control-sm" disabled={!puedeEditar} value={p.contenedores ?? ""} onChange={(e) => cambiar(p.uuid, { contenedores: e.target.value === "" ? "" : Number(e.target.value) })} />}
                    {p.modo === "RESTO" && <span className="text-secondary">lo que sobra</span>}
                    {p.modo === "FINCA" && (
                      <SelectorFincas fincas={fincasLista} valor={p.fincaUuids || []} ocupadas={fincasOcupadas(p.uuid)} disabled={!puedeEditar} onChange={(v) => cambiar(p.uuid, { fincaUuids: v })} />
                    )}
                  </td>
                  <td className="text-end text-nowrap">
                    {puedeEditar && (
                      <button type="button" className="btn btn-sm btn-link text-secondary p-0 me-1" title="Subir (la columna se mueve a la izquierda)" disabled={productos[0]?.uuid === p.uuid} onClick={() => mover(p.uuid, -1)}>
                        <FiArrowUp />
                      </button>
                    )}
                    {puedeEditar && (
                      <button type="button" className="btn btn-sm btn-link text-secondary p-0 me-2" title="Bajar (la columna se mueve a la derecha)" disabled={productos[productos.length - 1]?.uuid === p.uuid} onClick={() => mover(p.uuid, 1)}>
                        <FiArrowDown />
                      </button>
                    )}
                    {puedeEditar && (
                      <button type="button" className="btn btn-sm btn-link text-danger p-0" title="Quitar" onClick={() => onChange(productos.filter((x) => x.uuid !== p.uuid))}>
                        <FiTrash2 />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {puedeEditar && (
          <div className="d-flex flex-wrap align-items-end gap-2">
            <div style={{ flex: "1 1 240px", maxWidth: 380 }}>
              <label className="form-label small mb-1">Agregar producto</label>
              <input list="proy-productos" className="form-control form-control-sm" placeholder="Escribe para buscar..." value={texto} onChange={(e) => setTexto(e.target.value)} />
              <datalist id="proy-productos">
                {disponibles.map((p) => (
                  <option key={p.uuid} value={etiqueta(p)} />
                ))}
              </datalist>
            </div>
            <div style={{ width: 200 }}>
              <label className="form-label small mb-1">Tipo</label>
              <select className="form-select form-select-sm" value={modo} onChange={(e) => setModo(e.target.value)}>
                {MODOS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            {modo === "FINCA" && (
              <div style={{ width: 220 }}>
                <label className="form-label small mb-1">Fincas</label>
                <SelectorFincas fincas={fincasLista} valor={fincasNuevo} ocupadas={fincasOcupadas(null)} onChange={setFincasNuevo} />
              </div>
            )}
            {modo !== "RESTO" && modo !== "FINCA" && (
              <div style={{ width: 110 }}>
                <label className="form-label small mb-1">{modo === "CONTENEDORES" ? "Contenedores" : "% de kilos"}</label>
                <input type="number" min="0" step={modo === "CONTENEDORES" ? "0.5" : "0.01"} className="form-control form-control-sm" value={valor} onChange={(e) => setValor(e.target.value)} />
              </div>
            )}
            <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={agregar}>
              <FiPlus /> Agregar
            </button>
            {hasPermission("producto.crear") && (
              <button type="button" className="btn btn-sm btn-link text-decoration-none" onClick={() => setNuevoProducto(true)} title="Crear un producto nuevo (se guarda en Maestros → Productos)">
                + Nuevo producto
              </button>
            )}
          </div>
        )}
        {error && <div className="alert alert-danger py-2 small mt-2 mb-0">{error}</div>}
        {kgSinAsignar > 1 && (
          <div className="alert alert-warning py-2 small mt-2 mb-0">
            Quedan {fmt(kgSinAsignar)} kg ({fmt(kgSinAsignar / tasa)} cajas {fmt(tasa, 1)}) sin producto en el año: agrega un producto «resto» para la fruta de las demás fincas y lo que sobra de las dedicadas.
          </div>
        )}
        {nuevoProducto && (
          <NuevoProductoModal
            onClose={() => setNuevoProducto(false)}
            onCreado={(prod) => {
              setNuevoProducto(false);
              setCatalogo((c) => [...c, prod]);
              setTexto(etiqueta(prod));
            }}
          />
        )}
          </>
        )}
      </div>

      {productos.length === 0 ? (
        <p className="text-secondary small">Agrega los productos para ver el reparto de cajas por semana.</p>
      ) : (
        <>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <div className="d-inline-flex gap-1 p-1" style={{ background: "#e6eee8", borderRadius: 8 }}>
            {[
              ["semana", "Por semana"],
              ["mes", "Total por mes"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="btn btn-sm border-0"
                style={{ borderRadius: 6, fontSize: "0.78rem", padding: "2px 10px", background: periodo === id ? "#fff" : "transparent", color: periodo === id ? "#166534" : "#4b6354", fontWeight: periodo === id ? 700 : 500, boxShadow: periodo === id ? "0 1px 2px rgba(20,83,45,0.18)" : "none" }}
                onClick={() => setPeriodo(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="small text-secondary">Escenario</span>
            <div className="d-inline-flex gap-1 p-1" style={{ background: "#e6eee8", borderRadius: 8 }} title="Conservador = p25 y optimista = p75 del rango de la proyección">
              {ESCENARIOS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="btn btn-sm border-0"
                  style={{ borderRadius: 6, fontSize: "0.78rem", padding: "2px 10px", background: escenario === e.id ? "#fff" : "transparent", color: escenario === e.id ? "#166534" : "#4b6354", fontWeight: escenario === e.id ? 700 : 500, boxShadow: escenario === e.id ? "0 1px 2px rgba(20,83,45,0.18)" : "none" }}
                  onClick={() => setEscenario(e.id)}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={descargarExcel}>
            <FiDownload /> Descargar Excel
          </button>
          </div>
          {periodo === "mes" && <p className="small text-secondary mb-2">Cada semana cuenta en el mes donde caen la mayoría de sus días (4 o más de sus 7 días).</p>}
          {!valido && <div className="alert alert-warning py-2 small">El reparto no es válido todavía: con contenedores fijos agrega un producto «resto»; sin «resto», los porcentajes deben sumar 100 %.</div>}
          {semanasFaltantes > 0 && (
            <div className="alert alert-warning py-2 small">En {semanasFaltantes} semana(s) los kilos no alcanzan para los contenedores y porcentajes pedidos: se asignan en ese orden hasta agotarlos y el resto queda en 0.</div>
          )}
          <div className="table-responsive" style={{ maxHeight: "60vh" }}>
            <table className="table table-sm table-hover table-bordered align-middle mb-0 small" style={{ whiteSpace: "nowrap", "--bs-table-border-color": "#b9c9be" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th className="text-center" style={{ position: "sticky", left: 0, ...encabezado, zIndex: 3, minWidth: periodo === "mes" ? 140 : 90 }}>{periodo === "mes" ? "Mes" : "Semana"}</th>
                  <th className="text-center" style={encabezado}>
                    Cajas {fmt(tasa, 1)}
                  </th>
                  <th className="text-center" style={encabezado}>
                    Kilos
                  </th>
                  {productos.map((p) => (
                    <th key={p.uuid} className="text-center" style={{ ...encabezado, minWidth: 120 }} title={`${detalleModo(p)} · ${fmt(p.pesoNeto, 3)} kg por caja`}>
                      {p.nombre}
                      <div className="fw-normal" style={{ fontSize: "0.7rem" }}>
                        {detalleModo(p)} · {fmt(p.pesoNeto, 2)} kg
                      </div>
                    </th>
                  ))}
                  <th className="text-center" style={{ ...encabezado, minWidth: 120 }} title="Suma de las cajas de todos los productos, una a una, sin convertir">
                    Total cajas
                    <div className="fw-normal" style={{ fontSize: "0.7rem" }}>
                      una a una
                    </div>
                  </th>
                  <th className="text-center" style={{ ...encabezado, minWidth: 120 }} title="Lo asignado a los productos (con el redondeo a contenedores) convertido a cajas de referencia: kilos de los productos ÷ tasa">
                    Asignado {fmt(tasa, 1)}
                    <div className="fw-normal" style={{ fontSize: "0.7rem" }}>
                      convertido
                    </div>
                  </th>
                  <th className="text-center" style={{ ...encabezado, minWidth: 120 }} title="Asignado − proyectado, en cajas de referencia: positivo = se asigna de más; negativo = se asigna de menos (por el redondeo a contenedores)">
                    Diferencia {fmt(tasa, 1)}
                    <div className="fw-normal" style={{ fontSize: "0.7rem" }}>
                      asignado − proyectado
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filasVista.map((f) => {
                  const colorSub = f.esSemestre ? "#a8cdb5" : "#cfe5d6";
                  const bordeSub = f.esSemestre ? "3px solid #14532d" : "2px solid #14532d";
                  const sub = f.esSubtotal ? { background: colorSub, fontWeight: 700, borderTop: bordeSub, borderBottom: bordeSub } : {};
                  return (
                  <tr key={f.esSubtotal ? `mes-${f.clave}` : f.semanaCodigo} style={f.esSubtotal ? { background: colorSub } : f.faltante ? { background: "#fff4e5" } : undefined}>
                    <td className="fw-semibold text-center" style={{ position: "sticky", left: 0, background: f.esSubtotal ? (f.esSemestre ? "#8fbfa0" : "#b7d8c2") : primeraCol, color: "#14532d", zIndex: 1, ...(f.esSubtotal ? { borderTop: bordeSub, borderBottom: bordeSub } : {}) }}>
                      {f.titulo}
                      {f.real && periodo === "semana" ? "*" : ""}
                    </td>
                    <td className="text-center" style={sub}>{fmt(f.cajas)}</td>
                    <td className="text-center" style={sub}>{fmt(f.kg)}</td>
                    {productos.map((p) => (
                      <td key={p.uuid} className="text-center fw-semibold" style={sub} title={p.cajasPorContenedor > 0 && f.productos[p.uuid] !== null ? `${fmt(f.productos[p.uuid] / p.cajasPorContenedor, 2)} contenedores` : undefined}>
                        {fmt(f.productos[p.uuid])}
                      </td>
                    ))}
                    <td className="text-center fw-bold" style={{ background: f.esSubtotal ? colorSub : pie, ...(f.esSubtotal ? { borderTop: bordeSub, borderBottom: bordeSub } : {}) }}>
                      {fmt(sumaCajas(f.productos))}
                    </td>
                    <td className="text-center" style={sub}>{fmt(asignado18(f.productos))}</td>
                    <td style={sub} className={`text-center fw-semibold ${asignado18(f.productos) - f.cajas < -0.5 ? "text-danger" : asignado18(f.productos) - f.cajas > 0.5 ? "text-success" : ""}`} title={`${fmt(kgAsignados(f.productos) - f.kg)} kg`}>
                      {asignado18(f.productos) - f.cajas > 0 ? "+" : ""}
                      {fmt(asignado18(f.productos) - f.cajas, 1)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ position: "sticky", bottom: 0 }}>
                <tr className="fw-bold" style={{ background: pie }}>
                  <td className="text-center" style={{ position: "sticky", left: 0, ...encabezado }}>Total año</td>
                  <td className="text-center" style={{ background: pie }}>{fmt(totales.cajas)}</td>
                  <td className="text-center" style={{ background: pie }}>{fmt(totales.kg)}</td>
                  {productos.map((p) => (
                    <td key={p.uuid} className="text-center" style={{ background: pie }}>
                      {fmt(totales.productos[p.uuid])}
                    </td>
                  ))}
                  <td className="text-center" style={{ ...encabezado }}>
                    {fmt(totalCajasReales)}
                  </td>
                  <td className="text-center" style={{ background: pie }}>{fmt(asignado18(totales.productos))}</td>
                  <td className="text-center" style={{ background: pie }} title={`${fmt(kgAsignados(totales.productos) - totales.kg)} kg`}>
                    {asignado18(totales.productos) - totales.cajas > 0 ? "+" : ""}
                    {fmt(asignado18(totales.productos) - totales.cajas, 1)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="small text-secondary mt-2 mb-0">* Semana ya transcurrida. Las cajas de cada producto son cajas reales de ese producto (kilos ÷ su peso neto); pasa el ratón sobre una cifra para ver los contenedores. El producto «resto» se redondea hacia arriba a contenedores completos. Las semanas en naranja no alcanzan para el reparto pedido.</p>
        </>
      )}
    </div>
  );
}
