"use client";

// Carga manual de la precalibración desde Excel (cuando se hizo en papel). Cada fila es una sesión: un lote en un día, con los racimos
// aptos por edad. Primero se valida (sin guardar) y se muestra el resultado por fila; luego se confirma la importación.
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FiDownload, FiUpload } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import { importarPrecalibracion } from "@/lib/precalibracion/api";

const normaliza = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const pad = (n) => String(n).padStart(2, "0");

// Fecha de la celda → "YYYY-MM-DD" (acepta fecha de Excel, dd/mm/aaaa o aaaa-mm-dd).
function aFecha(v) {
  // Número de serie de Excel (días desde 1899-12-30): se convierte en UTC para que la zona horaria no mueva el día.
  if (typeof v === "number" && v > 20000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const t = String(v ?? "").trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return t;
}

// Hora de la celda → "HH:mm" (acepta hora de Excel o texto).
function aHora(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${pad(v.getHours())}:${pad(v.getMinutes())}`;
  if (typeof v === "number" && v >= 0 && v < 1) {
    const min = Math.round(v * 24 * 60);
    return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  }
  return String(v ?? "").trim();
}

export default function ImportarPrecalibracionModal({ opciones, onClose, onImportado }) {
  const [archivo, setArchivo] = useState("");
  const [filas, setFilas] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState(null);
  const input = useRef(null);

  // Edades de las columnas de la plantilla: las configuradas en las fincas.
  const edades = useMemo(() => {
    const set = new Set();
    Object.values(opciones?.configPorFinca || {}).forEach((c) => c.edades.forEach((e) => set.add(e)));
    return set.size > 0 ? [...set].sort((a, b) => a - b) : [9, 10, 11, 12];
  }, [opciones]);

  function descargarPlantilla() {
    const finca = opciones?.fincas?.[0]?.nombre || "Finca";
    const lote = opciones?.lotes?.find((l) => l.fincaId === opciones?.fincas?.[0]?.id)?.nombre || "1";
    const encabezado = ["Fecha", "Finca", "Lote", "Modalidad", "Calibrador", "Hora inicio", "Hora fin", ...edades.map((e) => `Edad ${e}`)];
    const ejemplo = ["19/10/2026", finca, lote, "Vigente", "34", "07:00", "09:30", ...edades.map((_, i) => (i === 0 ? 120 : 45))];
    const hoja = XLSX.utils.aoa_to_sheet([encabezado, ejemplo]);
    hoja["!cols"] = encabezado.map((h) => ({ wch: Math.max(12, h.length + 2) }));
    const ayuda = XLSX.utils.aoa_to_sheet([
      ["Cómo llenar la plantilla"],
      ["Una fila por lote y día (una sesión de precalibración)."],
      ["Fecha: dd/mm/aaaa. Finca y Lote: tal como aparecen en el sistema."],
      ["Modalidad: Vigente (se cosecha esa semana) o Anticipada (la semana siguiente)."],
      ["Calibrador: el valor del calibrador usado (por ejemplo 34)."],
      ["Hora inicio y Hora fin (HH:mm): opcionales. Con ellas se calcula la duración de la sesión."],
      [`Edad ${edades.join(", Edad ")}: racimos aptos de cada edad. Déjalo vacío o en 0 si no hubo.`],
      ["Los registros quedan a nombre de quien sube el archivo y sin ubicación GPS."],
    ]);
    ayuda["!cols"] = [{ wch: 95 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Precalibracion");
    XLSX.utils.book_append_sheet(libro, ayuda, "Instrucciones");
    XLSX.writeFile(libro, "plantilla-precalibracion.xlsx");
  }

  async function elegirArchivo(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    setResultado(null);
    setHecho(null);
    setFilas([]);
    setArchivo(f.name);
    try {
      const libro = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const crudas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: "" });
      if (crudas.length < 2) throw new Error("El archivo no tiene filas de datos.");
      const cab = crudas[0].map(normaliza);
      const col = (nombre) => cab.indexOf(normaliza(nombre));
      const iEdades = cab.map((h, i) => ({ h, i })).filter(({ h }) => /^edad\s*\d{1,2}$/.test(h)).map(({ h, i }) => ({ edad: Number(h.replace(/\D/g, "")), i }));
      const faltan = ["Fecha", "Finca", "Lote", "Modalidad", "Calibrador"].filter((c) => col(c) < 0);
      if (faltan.length > 0) throw new Error(`Faltan columnas: ${faltan.join(", ")}. Descarga la plantilla.`);
      if (iEdades.length === 0) throw new Error("No hay columnas de edad (Edad 9, Edad 10...). Descarga la plantilla.");
      const lista = [];
      crudas.slice(1).forEach((r, k) => {
        if (r.every((c) => String(c).trim() === "")) return;
        const porEdad = {};
        iEdades.forEach(({ edad, i }) => {
          const n = Number(r[i]);
          if (Number.isFinite(n) && n > 0) porEdad[edad] = Math.round(n);
        });
        lista.push({
          fila: k + 2,
          fecha: aFecha(r[col("Fecha")]),
          finca: String(r[col("Finca")] ?? "").trim(),
          lote: String(r[col("Lote")] ?? "").trim(),
          modalidad: String(r[col("Modalidad")] ?? "").trim(),
          calibrador: String(r[col("Calibrador")] ?? "").trim(),
          horaInicio: col("Hora inicio") >= 0 ? aHora(r[col("Hora inicio")]) : "",
          horaFin: col("Hora fin") >= 0 ? aHora(r[col("Hora fin")]) : "",
          edades: porEdad,
        });
      });
      if (lista.length === 0) throw new Error("No se encontraron filas con datos.");
      if (lista.length > 500) throw new Error("Máximo 500 filas por archivo.");
      setFilas(lista);
      setTrabajando(true);
      setResultado(await importarPrecalibracion({ filas: lista, simular: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando(false);
    }
  }

  async function importar() {
    const ok = new Set(resultado.filas.filter((f) => f.estado === "OK").map((f) => f.fila));
    setTrabajando(true);
    setError("");
    try {
      const r = await importarPrecalibracion({ filas: filas.filter((f) => ok.has(f.fila)), simular: false });
      setHecho(r);
      onImportado?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setTrabajando(false);
    }
  }

  const porFila = new Map((resultado?.filas || []).map((f) => [f.fila, f]));

  return (
    <ModalShell title="Importar precalibración desde Excel" onClose={onClose} size="xl" height="90vh">
      <div className="d-flex flex-column gap-3 h-100">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-1 d-inline-flex align-items-center gap-1" onClick={descargarPlantilla}>
            <FiDownload /> Descargar plantilla
          </button>
          <button type="button" className="btn btn-success btn-sm rounded-1 d-inline-flex align-items-center gap-1" onClick={() => input.current?.click()} disabled={trabajando}>
            <FiUpload /> Elegir archivo Excel
          </button>
          <input ref={input} type="file" accept=".xlsx,.xls" className="d-none" onChange={elegirArchivo} />
          {archivo && <span className="small text-secondary">{archivo}</span>}
        </div>
        <p className="small text-secondary mb-0">
          Una fila por lote y día. Cada fila crea una sesión cerrada con sus racimos aptos por edad, a nombre de quien sube el archivo y sin ubicación GPS. Primero se valida y puedes revisar
          los errores antes de importar.
        </p>

        {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}
        {trabajando && <p className="text-secondary small mb-0">Procesando...</p>}

        {hecho && (
          <div className="alert alert-success py-2 small mb-0">
            Se importaron {hecho.creadas} sesiones de precalibración.{hecho.errores > 0 ? ` ${hecho.errores} fila(s) no se pudieron guardar.` : ""}
          </div>
        )}

        {resultado && !hecho && (
          <>
            <div className="small">
              <span className="fw-semibold text-success">{resultado.validas} filas válidas</span>
              {resultado.errores > 0 && <span className="fw-semibold text-danger ms-3">{resultado.errores} con error (no se importarán)</span>}
            </div>
            <div className="border rounded-2 overflow-auto flex-grow-1" style={{ minHeight: 0 }}>
              <table className="table table-sm table-hover mb-0 small text-nowrap align-middle">
                <thead className="table-light position-sticky top-0">
                  <tr>
                    <th className="text-center">Fila</th>
                    <th>Fecha</th>
                    <th>Finca</th>
                    <th>Lote</th>
                    <th>Modalidad</th>
                    <th className="text-center">Calibrador</th>
                    <th className="text-center">Racimos</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => {
                    const r = porFila.get(f.fila);
                    return (
                      <tr key={f.fila}>
                        <td className="text-center">{f.fila}</td>
                        <td>{f.fecha}</td>
                        <td>{f.finca}</td>
                        <td>{f.lote}</td>
                        <td>{f.modalidad}</td>
                        <td className="text-center">{f.calibrador}</td>
                        <td className="text-center">{Object.values(f.edades).reduce((a, b) => a + b, 0)}</td>
                        <td className={r?.estado === "OK" ? "text-success" : "text-danger"}>{r?.estado === "OK" ? "Listo para importar" : r?.mensaje}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="d-flex justify-content-end gap-2 mt-auto">
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-1" onClick={onClose}>
            {hecho ? "Cerrar" : "Cancelar"}
          </button>
          {!hecho && (
            <button type="button" className="btn btn-success btn-sm rounded-1 px-4" disabled={trabajando || !resultado || resultado.validas === 0} onClick={importar}>
              Importar {resultado ? resultado.validas : 0} filas
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
