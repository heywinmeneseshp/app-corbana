"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { FiPlus, FiEye, FiX, FiInfo, FiUploadCloud, FiDownload, FiArchive, FiRotateCcw, FiTrash2, FiEdit2, FiSliders } from "react-icons/fi";
import { apiFetch, apiUpload } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import { esAdministrador } from "@/lib/laborEstados";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import { construirGrafoUnidades, convertirCantidad } from "@/lib/unidadConversion";

// Una fila por insumo — varias filas con el mismo "nombre" forman la
// receta completa de una sola mezcla (ver mezcla.service.js#bulkCrearDirectas).
const PLANTILLA_HEADERS = [
  "nombre",
  "codigo",
  "categoria",
  "unidad",
  "cantidadAProducir",
  "almacen",
  "dosisPorHectarea",
  "dosisUnidad",
  "insumoNombre",
  "insumoCantidad",
  "insumoUnidad",
];
const PLANTILLA_EJEMPLO = [
  ["Fungicida Mix 20L", "", "Elaborados", "L", "20", "CORBANA", "4", "GAL", "Bravonil 720 SC", "2", "L"],
  ["Fungicida Mix 20L", "", "", "", "", "", "", "", "ACONDICIONADOR", "0.5", "Kg"],
];

function descargarPlantilla() {
  const worksheet = XLSX.utils.aoa_to_sheet([PLANTILLA_HEADERS, ...PLANTILLA_EJEMPLO]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_mezclas.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

// Exporta el listado actual (ya filtrado) CON su receta — una fila por
// insumo, mismo formato que PLANTILLA_HEADERS (arriba), para que el Excel
// descargado se pueda volver a subir tal cual por "Cargue masivo" (pedido
// explícito: "quiero que se pueda descargar excel o cargar masivo la
// mezcla con su receta"). `detalles` es un arreglo de respuestas de
// GET /inventarios/mezclas/:uuid (con versiones[0].componentes) — se pide
// aparte porque el listado no las trae.
function construirFilasExcelConReceta(mezclas, detalles) {
  const filas = [];
  mezclas.forEach((m, i) => {
    const detalle = detalles[i];
    const componentes = detalle?.versiones?.[0]?.componentes || [];
    const almacen = detalle?.versiones?.[0]?.almacen;
    const base = {
      nombre: m.nombre || "",
      codigo: m.codigo || "",
      categoria: "",
      unidad: detalle?.articuloElaborado?.unidadMedida?.codigo || detalle?.articuloElaborado?.unidadMedida?.simbolo || "",
      cantidadAProducir: detalle?.rendimiento ?? "",
      almacen: almacen?.codigo || almacen?.nombre || "",
      dosisPorHectarea: detalle?.dosisPorHectarea ?? "",
      dosisUnidad: detalle?.dosisPorHectareaUnidad?.codigo || detalle?.dosisPorHectareaUnidad?.simbolo || "",
    };
    if (!componentes.length) {
      filas.push({ ...base, insumoNombre: "", insumoCantidad: "", insumoUnidad: "" });
      return;
    }
    componentes.forEach((c, j) => {
      filas.push({
        ...(j === 0 ? base : { nombre: "", codigo: "", categoria: "", unidad: "", cantidadAProducir: "", almacen: "", dosisPorHectarea: "", dosisUnidad: "" }),
        insumoNombre: c.articulo?.nombre || "",
        insumoCantidad: c.cantidad ?? "",
        insumoUnidad: c.unidad?.codigo || c.unidad?.simbolo || "",
      });
    });
  });
  return filas;
}

function descargarWorkbook(filas, nombreArchivo) {
  const worksheet = XLSX.utils.json_to_sheet(filas, { header: PLANTILLA_HEADERS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Mezclas");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

// Mezclas: maestro de recetas ya convertidas — creadas directo ("Nueva
// mezcla", sin prueba de laboratorio) o a partir de una prueba de
// laboratorio exitosa — cada una con su propio consecutivo MEZ-000X y su
// artículo elaborado activo. Pedido explícito: "eso no debe ser una tabla
// de historial, debe ser solo un maestro de mezclas". Clic en una fila
// (o el ícono de ojo) lleva al detalle de la receta, la misma pantalla que
// usa Mezclas — Pruebas de laboratorio.
function emptyForm() {
  return {
    mezclaUuid: "",
    cantidadElaborada: "1",
    almacenUuid: "",
    fecha: "",
    observaciones: "",
    // Volumen/ha: se usa para mostrar la "Dosis real" de cada insumo en la
    // tabla (igual que en Programar aspersión) Y se guarda con la mezcla
    // al crearla (ver handleCrearDirecta) — después solo se puede volver a
    // editar desde "Editar mezcla", no desde "Insumos y costo". Galones de
    // referencia: solo de pantalla, no se manda al backend.
    volumenPorHectarea: "",
    volumenPorHectareaUnidadUuid: "",
    galonesReferencia: "",
  };
}

function emptyDirectaForm() {
  return { articuloNombre: "", articuloCodigo: "", articuloCategoriaUuid: "", articuloUnidadMedidaUuid: "" };
}

// Sugerencia de código: continúa el correlativo "MEZ-000N" de la última
// mezcla/producto elaborado ya creado, con prefijo "ELAB-" — mismo criterio
// "sugerido pero editable" que ya se usa en mezclas/[uuid]/page.js
// (mezcla.codigo.replace(/^MEZ/, "ELAB")). Como acá la mezcla todavía no
// existe (se crea recién al guardar), se calcula a partir del código MEZ-
// más alto que ya haya en la lista de mezclas cargada.
function siguienteCodigoSugerido(mezclas) {
  let maximo = 0;
  for (const m of mezclas) {
    const match = /^MEZ-(\d+)$/.exec(m.codigo || "");
    if (match) maximo = Math.max(maximo, parseInt(match[1], 10));
  }
  return `ELAB-${String(maximo + 1).padStart(4, "0")}`;
}

function emptyInsumoRow() {
  return {
    key: Math.random().toString(36).slice(2),
    articuloUuid: "",
    cantidad: "1",
    unidadUuid: "",
    esPrincipal: false,
    // Dosis relativa: dos tipos excluyentes (ver utils/dosisRelativa.js en
    // el backend) — PORCENTAJE: X% de otro insumo (ej. 1% del ACEITE
    // BANOLE); POR_VOLUMEN: tasa por unidad de volumen de mezcla total
    // (ej. ANTIFOAM = 1 g por galón — la tasa va en la unidad de la fila y
    // tasaUnidadUuid dice por cada cuánto volumen). FIJA (o vacío) =
    // cantidad fija. dosisPorHectarea/dosisUnidadUuid: dosis de referencia
    // DEL RENGLÓN (manda sobre la del artículo, ej. ACEITE a 2.0/ha en una
    // mezcla y 1.5/ha en la mayoría).
    tipoDosis: "FIJA",
    referenciaArticuloUuid: "",
    porcentajeReferencia: "",
    tasa: "",
    tasaUnidadUuid: "",
    dosisPorHectarea: "",
    dosisUnidadUuid: "",
  };
}

// Regla de dosis completa: PORCENTAJE con % y referencia, POR_VOLUMEN con
// tasa y su unidad de volumen, o POR_LITRO_AGUA con tasa (en la unidad de
// la fila) por litro de agua.
function reglaDosisCompleta(row) {
  if (row.tipoDosis === "POR_VOLUMEN") {
    return row.tasa !== "" && Number(row.tasa) > 0 && Boolean(row.tasaUnidadUuid);
  }
  if (row.tipoDosis === "POR_LITRO_AGUA") {
    return row.tasa !== "" && Number(row.tasa) > 0;
  }
  if (row.tipoDosis === "PORCENTAJE" || (!row.tipoDosis && row.referenciaArticuloUuid)) {
    return Boolean(row.referenciaArticuloUuid) && row.porcentajeReferencia !== "" && Number(row.porcentajeReferencia) > 0;
  }
  return false;
}

// Total de referencia de un formulario (para previsualizar renglones
// POR_VOLUMEN): galones de referencia si los hay, si no el rendimiento con
// su unidad. Null si no hay con qué. Devuelve { cantidad, unidadUuid }.
function totalRefFormulario({ galonesReferencia, rendimiento, unidadRendimientoUuid }, unidades) {
  const g = Number(galonesReferencia);
  if (g > 0) {
    const galon = unidades.find((u) => u.nombre === "Galón");
    if (galon) return { cantidad: g, unidadUuid: galon.uuid };
  }
  const rend = Number(rendimiento);
  if (rend > 0 && unidadRendimientoUuid) return { cantidad: rend, unidadUuid: unidadRendimientoUuid };
  return null;
}

// Vista previa de la cantidad efectiva del seguidor — lo mismo que
// calculará el backend al guardar (PORCENTAJE: referencia × %;
// POR_VOLUMEN: tasa × total de referencia llevado a la unidad de la tasa;
// POR_LITRO_AGUA: tasa × litros de agua estimados).
function vistaPreviaDosisRelativa(row, rows, { grafoUnidades, totalRef = null, aguaLitros = null }) {
  const tipoDosisFila = row.tipoDosis || (row.referenciaArticuloUuid ? "PORCENTAJE" : "FIJA");
  if (tipoDosisFila === "POR_LITRO_AGUA") {
    if (!reglaDosisCompleta(row) || !row.unidadUuid || !(aguaLitros > 0)) return null;
    return Number(row.tasa) * aguaLitros;
  }
  if (tipoDosisFila === "POR_VOLUMEN") {
    if (!reglaDosisCompleta(row) || !row.unidadUuid || !totalRef || !(totalRef.cantidad > 0) || !totalRef.unidadUuid) {
      return null;
    }
    const enTasa =
      totalRef.unidadUuid === row.tasaUnidadUuid
        ? totalRef.cantidad
        : convertirCantidad(grafoUnidades, totalRef.unidadUuid, row.tasaUnidadUuid, totalRef.cantidad);
    if (enTasa == null) return null;
    return Number(row.tasa) * enTasa;
  }
  if (tipoDosisFila !== "PORCENTAJE" || !row.unidadUuid) return null;
  if (!reglaDosisCompleta(row)) return null;
  const ref = rows.find((r) => r.key !== row.key && r.articuloUuid === row.referenciaArticuloUuid);
  if (!ref || !ref.unidadUuid) return null;
  const refCant = Number(ref.cantidad);
  if (!(refCant > 0)) return null;
  const enUnidad =
    ref.unidadUuid === row.unidadUuid ? refCant : convertirCantidad(grafoUnidades, ref.unidadUuid, row.unidadUuid, refCant);
  if (enUnidad == null) return null;
  return enUnidad * (Number(row.porcentajeReferencia) / 100);
}

// Solo el Agua se calcula sola sin admitir regla (rellena el total). El
// ACONDICIONADOR sí admite regla POR_LITRO_AGUA (o queda en el 0.8 legacy).
function esAguaArticulo(articuloUuid, articulos) {
  return articulos.find((a) => a.uuid === articuloUuid)?.nombre === "Agua";
}

// Litros de agua estimados de una receta en edición (para previsualizar
// renglones POR_LITRO_AGUA): total de referencia menos los demás insumos
// convertibles (se excluyen Agua, ACONDICIONADOR y los propios por-litro;
// los por-volumen entran con su vista previa). Null si no hay con qué.
function estimarAguaLitros(rows, { unidades, articulos, grafoUnidades, totalRef }) {
  if (!totalRef || !(totalRef.cantidad > 0) || !totalRef.unidadUuid) return null;
  const litro = unidades.find((u) => u.nombre === "Litro");
  if (!litro) return null;
  const totalL =
    totalRef.unidadUuid === litro.uuid
      ? totalRef.cantidad
      : convertirCantidad(grafoUnidades, totalRef.unidadUuid, litro.uuid, totalRef.cantidad);
  if (totalL == null) return null;
  let sumaL = 0;
  for (const r of rows) {
    const nombre = articulos.find((a) => a.uuid === r.articuloUuid)?.nombre;
    if (!r.articuloUuid || nombre === "Agua" || nombre === "ACONDICIONADOR") continue;
    if ((r.tipoDosis || "") === "POR_LITRO_AGUA") continue;
    let cant = Number(r.cantidad);
    if ((r.tipoDosis || "") === "POR_VOLUMEN") {
      const preview = vistaPreviaDosisRelativa(r, rows, { grafoUnidades, totalRef });
      if (preview != null) cant = preview;
    }
    if (!(cant > 0) || !r.unidadUuid) continue;
    const enL = r.unidadUuid === litro.uuid ? cant : convertirCantidad(grafoUnidades, r.unidadUuid, litro.uuid, cant);
    if (enL != null) sumaL += enL;
  }
  return Math.max(0, totalL - sumaL);
}

// Filas con la cantidad efectiva (vista previa si la regla está completa)
// — para que dosis real/informativa y el ajuste de agua vean lo mismo que
// quedará guardado.
function conCantidadesEfectivas(rows, grafoUnidades, totalRef = null) {
  return rows.map((r) => {
    const preview = vistaPreviaDosisRelativa(r, rows, { grafoUnidades, totalRef });
    return reglaDosisCompleta(r) && preview != null ? { ...r, cantidad: String(preview) } : r;
  });
}

// Celda de dosis relativa — compartida por la tabla de crear y la de
// editar. `patch(key, obj)` actualiza la fila. Tipos: FIJA (cantidad),
// PORCENTAJE (X% de otro) y POR_VOLUMEN (tasa por unidad de volumen).
function celdaDosisRelativa(row, rows, patch, { unidades, articulos, grafoUnidades, totalRef = null, aguaLitros = null, deshabilitado = false }) {
  const tipo = row.tipoDosis || "FIJA";
  const regla = reglaDosisCompleta(row);
  const preview = vistaPreviaDosisRelativa(row, rows, { grafoUnidades, totalRef, aguaLitros });
  const simbolo = unidades.find((u) => u.uuid === row.unidadUuid)?.simbolo || "";
  // Solo el Agua va sin regla (rellena el total).
  if (deshabilitado) {
    return (
      <td>
        <span className="small text-secondary" title="El Agua completa el total y se calcula sola">
          Automático
        </span>
      </td>
    );
  }
  const cambiarTipo = (e) => {
    const t = e.target.value;
    // Al cambiar de modo se limpian los campos del otro para no mandar
    // reglas mezcladas.
    patch(row.key, {
      tipoDosis: t,
      referenciaArticuloUuid: t === "PORCENTAJE" ? row.referenciaArticuloUuid : "",
      porcentajeReferencia: t === "PORCENTAJE" ? row.porcentajeReferencia : "",
      tasa: t === "POR_VOLUMEN" || t === "POR_LITRO_AGUA" ? row.tasa : "",
      tasaUnidadUuid: t === "POR_VOLUMEN" ? row.tasaUnidadUuid : "",
    });
  };
  const unidadesVolumen = unidades.filter((u) => u.tipo === "VOLUMEN");
  const simboloTasa = unidades.find((u) => u.uuid === row.tasaUnidadUuid)?.simbolo || "";
  return (
    <td>
      <select
        className="form-select form-select-sm rounded-3 mb-1"
        value={tipo}
        disabled={!row.articuloUuid}
        onChange={cambiarTipo}
        title="Tipo de dosis: cantidad fija, X% de otro insumo, tasa por unidad de volumen de mezcla total, o tasa por litro de agua"
      >
        <option value="FIJA">Fija</option>
        <option value="PORCENTAJE">% de otro</option>
        <option value="POR_VOLUMEN">Por volumen</option>
        <option value="POR_LITRO_AGUA">Por litro agua</option>
      </select>
      {tipo === "PORCENTAJE" && (
        <div className="d-flex align-items-center gap-1">
          <input
            type="number"
            step="any"
            min="0"
            className="form-control form-control-sm rounded-3"
            style={{ width: "4.2rem" }}
            placeholder="%"
            title="Este insumo será el X% de otro insumo de la receta (ej. 1% del ACEITE BANOLE)."
            value={row.porcentajeReferencia}
            disabled={!row.articuloUuid}
            onChange={(e) => patch(row.key, { porcentajeReferencia: e.target.value })}
          />
          <select
            className="form-select form-select-sm rounded-3"
            style={{ minWidth: "6.5rem" }}
            value={row.referenciaArticuloUuid}
            disabled={!row.porcentajeReferencia}
            onChange={(e) => patch(row.key, { referenciaArticuloUuid: e.target.value })}
            title="Insumo de referencia para la dosis relativa"
          >
            <option value="">de…</option>
            {rows
              .filter((r) => r.key !== row.key && r.articuloUuid)
              .map((r) => (
                <option key={r.key} value={r.articuloUuid}>
                  {articulos.find((a) => a.uuid === r.articuloUuid)?.nombre || "Insumo"}
                </option>
              ))}
          </select>
        </div>
      )}
      {tipo === "POR_VOLUMEN" && (
        <div className="d-flex align-items-center gap-1">
          <input
            type="number"
            step="any"
            min="0"
            className="form-control form-control-sm rounded-3"
            style={{ width: "4.2rem" }}
            placeholder="tasa"
            title="Cantidad (en la unidad de esta fila) por cada unidad de volumen de mezcla total (ej. ANTIFOAM = 1 g por galón, o X ml por litro)."
            value={row.tasa}
            disabled={!row.articuloUuid || !row.unidadUuid}
            onChange={(e) => patch(row.key, { tasa: e.target.value })}
          />
          <span className="small text-secondary text-nowrap">/</span>
          <select
            className="form-select form-select-sm rounded-3"
            style={{ minWidth: "4.5rem" }}
            value={row.tasaUnidadUuid}
            disabled={!row.tasa}
            onChange={(e) => patch(row.key, { tasaUnidadUuid: e.target.value })}
            title="Unidad de volumen de referencia (por galón, por litro, ...)"
          >
            <option value="">por…</option>
            {unidadesVolumen.map((u) => (
              <option key={u.uuid} value={u.uuid}>
                {u.simbolo}
              </option>
            ))}
          </select>
        </div>
      )}
      {tipo === "POR_LITRO_AGUA" && (
        <div className="d-flex align-items-center gap-1">
          <input
            type="number"
            step="any"
            min="0"
            className="form-control form-control-sm rounded-3"
            style={{ width: "4.2rem" }}
            placeholder="tasa"
            title="Cantidad (en la unidad de esta fila) por cada litro de agua de la preparación (ej. ACONDICIONADOR = 0.3 g por litro)."
            value={row.tasa}
            disabled={!row.articuloUuid || !row.unidadUuid}
            onChange={(e) => patch(row.key, { tasa: e.target.value })}
          />
          <span className="small text-secondary text-nowrap">/ L agua</span>
        </div>
      )}
      {regla && preview != null && (
        <div className="form-text small mb-0">
          ≈ {preview.toLocaleString("es-CO", { maximumFractionDigits: 4 })} {simbolo}
          {tipo === "POR_VOLUMEN" && simboloTasa ? ` (${row.tasa} ${simbolo}/${simboloTasa})` : ""}
          {tipo === "POR_LITRO_AGUA" ? ` (${row.tasa} ${simbolo}/L)` : ""}
        </div>
      )}
    </td>
  );
}

// Arma el payload de componentes (crear/editar mezcla): cantidad efectiva
// si la regla está completa + la regla. Devuelve { error, componentes }.
function componentesPayloadDesdeRows(rows, { grafoUnidades, articulos, unidades, totalRef = null }) {
  const aguaLitrosRef = estimarAguaLitros(rows, { unidades, articulos, grafoUnidades, totalRef });
  const previewDe = (r) => vistaPreviaDosisRelativa(r, rows, { grafoUnidades, totalRef, aguaLitros: aguaLitrosRef });
  for (const r of rows) {
    if (!r.articuloUuid || esAguaArticulo(r.articuloUuid, articulos)) continue;
    const tipo = r.tipoDosis || "FIJA";
    if (tipo === "POR_LITRO_AGUA") {
      if (!(Number(r.tasa) > 0) || !r.unidadUuid) {
        const nombre = articulos.find((a) => a.uuid === r.articuloUuid)?.nombre || "El insumo";
        return { error: `${nombre}: la dosis por litro de agua exige tasa mayor a 0 y unidad en la fila.` };
      }
      if (previewDe(r) == null) {
        const nombre = articulos.find((a) => a.uuid === r.articuloUuid)?.nombre || "El insumo";
        return { error: `${nombre}: no se pudo estimar el agua (indica Galones de referencia o un rendimiento con unidad convertible).` };
      }
      continue;
    }
    if (tipo === "POR_VOLUMEN") {
      if (!(Number(r.tasa) > 0) || !r.unidadUuid || !r.tasaUnidadUuid) {
        const nombre = articulos.find((a) => a.uuid === r.articuloUuid)?.nombre || "El insumo";
        return { error: `${nombre}: la dosis por volumen exige tasa mayor a 0, unidad en la fila y unidad de volumen (por galón, por litro, ...).` };
      }
      if (vistaPreviaDosisRelativa(r, rows, { grafoUnidades, totalRef, aguaLitros: aguaLitrosRef }) == null) {
        const nombre = articulos.find((a) => a.uuid === r.articuloUuid)?.nombre || "El insumo";
        return { error: `${nombre}: no se pudo estimar la cantidad (indica Galones de referencia o un rendimiento con unidad convertible).` };
      }
      continue;
    }
    if (!reglaDosisCompleta(r)) continue;
    if (vistaPreviaDosisRelativa(r, rows, { grafoUnidades, totalRef, aguaLitros: aguaLitrosRef }) == null) {
      const nombre = articulos.find((a) => a.uuid === r.articuloUuid)?.nombre || "El insumo";
      return { error: `${nombre}: tiene % de otro insumo pero falta cantidad o unidad en el insumo de referencia.` };
    }
  }
  const componentes = rows
    .filter((r) => r.articuloUuid && (r.cantidad || reglaDosisCompleta(r)))
    .map((r) => {
      // Solo el Agua nunca lleva regla aunque la fila la traiga de un
      // cambio de artículo (el ACONDICIONADOR sí admite POR_LITRO_AGUA).
      // La dosis del renglón sí se guarda siempre que esté completa.
      const esAgua = esAguaArticulo(r.articuloUuid, articulos);
      const dosisFilaCompleta = r.dosisPorHectarea !== "" && Number(r.dosisPorHectarea) > 0 && Boolean(r.dosisUnidadUuid);
      // El tipo manda; por compatibilidad, una fila con referencia pero sin
      // tipo se trata como PORCENTAJE (formato anterior).
      const tipo = esAgua
        ? "FIJA"
        : r.tipoDosis === "POR_VOLUMEN"
          ? "POR_VOLUMEN"
          : r.tipoDosis === "POR_LITRO_AGUA"
            ? "POR_LITRO_AGUA"
            : r.tipoDosis === "PORCENTAJE" || (!r.tipoDosis && r.referenciaArticuloUuid)
              ? "PORCENTAJE"
              : "FIJA";
      const completa = !esAgua && reglaDosisCompleta(r);
      const preview = completa ? vistaPreviaDosisRelativa(r, rows, { grafoUnidades, totalRef, aguaLitros: aguaLitrosRef }) : null;
      return {
        articuloUuid: r.articuloUuid,
        cantidad: completa && preview != null ? Number(preview.toFixed(4)) : Number(r.cantidad),
        unidadUuid: r.unidadUuid || null,
        esPrincipal: Boolean(r.esPrincipal),
        tipoDosis: completa ? tipo : "FIJA",
        referenciaArticuloUuid: completa && tipo === "PORCENTAJE" ? r.referenciaArticuloUuid : null,
        porcentajeReferencia: completa && tipo === "PORCENTAJE" ? Number(r.porcentajeReferencia) : null,
        tasa: completa && (tipo === "POR_VOLUMEN" || tipo === "POR_LITRO_AGUA") ? Number(r.tasa) : null,
        tasaUnidadUuid: completa && tipo === "POR_VOLUMEN" ? r.tasaUnidadUuid : null,
        dosisPorHectarea: dosisFilaCompleta ? Number(r.dosisPorHectarea) : null,
        dosisUnidadUuid: dosisFilaCompleta ? r.dosisUnidadUuid : null,
      };
    });
  return { componentes };
}

// Suma las filas de insumos de una receta (crear/editar mezcla) en Litros y
// en Galones — pedido explícito, para que el operador vea de un vistazo el
// volumen total sin tener que sumar a mano. Cada fila se convierte desde su
// PROPIA unidad (no la unidad base del artículo) usando el mismo grafo BFS
// bidireccional que el resto de la app (lib/unidadConversion.js); las que
// no tienen conversión posible a Litro/Galón (ej. un insumo sólido en Kg)
// simplemente no suman a ese total, en vez de forzar un número sin sentido.
function calcularTotalesReceta(rows, unidades, grafoUnidades) {
  const litro = unidades.find((u) => u.nombre === "Litro");
  const galon = unidades.find((u) => u.nombre === "Galón");
  let totalLitros = 0;
  let totalGalones = 0;
  for (const row of rows) {
    const cantidad = Number(row.cantidad);
    if (!row.articuloUuid || !row.unidadUuid || !cantidad) continue;
    if (litro) {
      const enLitros = row.unidadUuid === litro.uuid ? cantidad : convertirCantidad(grafoUnidades, row.unidadUuid, litro.uuid, cantidad);
      if (enLitros != null) totalLitros += enLitros;
    }
    if (galon) {
      const enGalones = row.unidadUuid === galon.uuid ? cantidad : convertirCantidad(grafoUnidades, row.unidadUuid, galon.uuid, cantidad);
      if (enGalones != null) totalGalones += enGalones;
    }
  }
  return { totalLitros, totalGalones };
}

// Dosis de referencia de una fila: la del RENGLÓN si está configurada
// (manda sobre la del artículo — ej. ACEITE a 2.0/ha en una mezcla y 1.5/ha
// en la mayoría), si no la del artículo. Devuelve también si es del renglón
// para mostrarlo distinto.
function dosisRefFila(row, articulos, unidades) {
  if (row.dosisPorHectarea !== "" && Number(row.dosisPorHectarea) > 0 && row.dosisUnidadUuid) {
    const unidad = unidades.find((u) => u.uuid === row.dosisUnidadUuid);
    if (unidad) return { dosisMaxima: Number(row.dosisPorHectarea), dosisUnidadUuid: unidad.uuid, dosisSimbolo: unidad.simbolo, esDelRenglon: true };
  }
  const articulo = articulos.find((a) => a.uuid === row.articuloUuid);
  if (articulo?.dosisPorHectarea == null || !articulo?.dosisUnidad?.uuid) return null;
  return {
    dosisMaxima: Number(articulo.dosisPorHectarea),
    dosisUnidadUuid: articulo.dosisUnidad.uuid,
    dosisSimbolo: articulo.dosisUnidad?.simbolo || "",
    esDelRenglon: false,
  };
}
// Dosis informativa (referencia del renglón o del artículo) y dosis real
// (la que resulta de la receta actual, si se preparara para cubrir
// "hectareas" hectáreas a razón de "volumenPorHa" de volumen/ha) de un
// insumo — mismo criterio que "Dosis por hectárea"/"% sobre dosis" del
// programador de aspersiones (aspersiones/page.js), simplificado acá
// porque no hay ajustes manuales por fila: dosis real = (cantidad del
// insumo en la receta ÷ rendimiento de la receta) × volumen/ha. El número
// de hectáreas es solo de referencia para mostrar "cuánto se necesitaría"
// — la dosis por hectárea en sí no depende de él (se cancela
// algebraicamente), pero ayuda a visualizar una preparación real como en
// Programar aspersión.
function calcularDosisFila(row, { articulos, unidades, grafoUnidades, rendimiento, unidadRendimientoUuid, volumenPorHa, unidadVolumenPorHaUuid, hectareas }) {
  const ref = dosisRefFila(row, articulos, unidades);
  if (!ref) return { dosisInformativa: null };
  const { dosisMaxima, dosisUnidadUuid } = ref;
  const dosisMaximaSimbolo = ref.dosisSimbolo;
  const articulo = articulos.find((a) => a.uuid === row.articuloUuid);
  if (dosisMaxima == null || !dosisUnidadUuid) return { dosisInformativa: null };

  const cantidad = Number(row.cantidad) || 0;
  const rendimientoNum = Number(rendimiento) || 0;
  const volumenHaNum = Number(volumenPorHa) || 0;
  if (!cantidad || !row.unidadUuid || !rendimientoNum || !volumenHaNum) {
    return { dosisInformativa: dosisMaxima, dosisInformativaSimbolo: dosisMaximaSimbolo };
  }

  const volumenHaEnRendimiento =
    !unidadVolumenPorHaUuid || !unidadRendimientoUuid || unidadVolumenPorHaUuid === unidadRendimientoUuid
      ? volumenHaNum
      : convertirCantidad(grafoUnidades, unidadVolumenPorHaUuid, unidadRendimientoUuid, volumenHaNum) ?? volumenHaNum;
  const factorPorHectarea = volumenHaEnRendimiento / rendimientoNum;
  const cantidadPorHectareaNativa = cantidad * factorPorHectarea;
  const dosisReal =
    row.unidadUuid === dosisUnidadUuid
      ? cantidadPorHectareaNativa
      : convertirCantidad(grafoUnidades, row.unidadUuid, dosisUnidadUuid, cantidadPorHectareaNativa);
  if (dosisReal == null) return { dosisInformativa: dosisMaxima, dosisInformativaSimbolo: dosisMaximaSimbolo };

  const hectareasNum = Number(hectareas) || 0;
  const cantidadNecesaria = hectareasNum > 0 ? cantidad * factorPorHectarea * hectareasNum : null;

  // Compara redondeado a 2 decimales (igual que se muestra en pantalla) —
  // si no, un ajuste "exacto" con el botón de abajo puede quedar marcado
  // en rojo por una diferencia de punto flotante invisible al operador
  // (ej. 0.4000000001 > 0.4).
  const excede = Math.round(dosisReal * 100) / 100 > Math.round(dosisMaxima * 100) / 100;

  return {
    dosisInformativa: dosisMaxima,
    dosisInformativaSimbolo: dosisMaximaSimbolo,
    dosisEsDelRenglon: ref.esDelRenglon,
    dosisReal,
    dosisRealSimbolo: dosisMaximaSimbolo,
    excede,
    cantidadNecesaria,
    cantidadNecesariaSimbolo: unidades.find((u) => u.uuid === row.unidadUuid)?.simbolo || "",
  };
}

// Convierte un volumen de referencia EN GALONES (ej. "cuántos galones se
// van a preparar") a las hectáreas equivalentes, dividiendo por Volumen/ha
// — pedido explícito: es más intuitivo para el operador pensar "voy a
// preparar 412 galones" que "eso cubre 68.7 hectáreas", así que se
// calcula solo apenas escribe los galones, en vez de pedirle que calcule
// las hectáreas a mano.
function calcularHectareasDesdeGalones(galonesReferencia, volumenPorHa, unidadVolumenPorHaUuid, unidades, grafoUnidades) {
  const galones = Number(galonesReferencia) || 0;
  const volumenHaNum = Number(volumenPorHa) || 0;
  if (!galones || !volumenHaNum) return null;
  const galon = unidades.find((u) => u.nombre === "Galón");
  if (!galon) return null;
  const volumenHaEnGalones =
    !unidadVolumenPorHaUuid || unidadVolumenPorHaUuid === galon.uuid
      ? volumenHaNum
      : convertirCantidad(grafoUnidades, unidadVolumenPorHaUuid, galon.uuid, volumenHaNum) ?? volumenHaNum;
  if (!volumenHaEnGalones) return null;
  return galones / volumenHaEnGalones;
}

// Inversa de calcularDosisFila: la cantidad (en la unidad de la fila) que
// haría que la "Dosis real" quedara EXACTO en la "Dosis informativa" del
// artículo — pedido explícito: botón "Ajustar a dosis por ha" en cada fila.
// Devuelve null si falta algo para calcularlo (sin dosis máxima
// configurada, sin Volumen/ha, sin unidad en la fila, etc.) — en ese caso
// el botón no se muestra.
function calcularCantidadParaDosisMaxima(row, { articulos, unidades, grafoUnidades, rendimiento, unidadRendimientoUuid, volumenPorHa, unidadVolumenPorHaUuid }) {
  const ref = dosisRefFila(row, articulos, unidades);
  if (!ref || !row.unidadUuid) return null;
  const { dosisMaxima, dosisUnidadUuid } = ref;

  const rendimientoNum = Number(rendimiento) || 0;
  const volumenHaNum = Number(volumenPorHa) || 0;
  if (!rendimientoNum || !volumenHaNum) return null;

  const volumenHaEnRendimiento =
    !unidadVolumenPorHaUuid || !unidadRendimientoUuid || unidadVolumenPorHaUuid === unidadRendimientoUuid
      ? volumenHaNum
      : convertirCantidad(grafoUnidades, unidadVolumenPorHaUuid, unidadRendimientoUuid, volumenHaNum) ?? volumenHaNum;
  const factorPorHectarea = volumenHaEnRendimiento / rendimientoNum;
  if (!factorPorHectarea) return null;

  const dosisMaximaEnUnidadFila =
    row.unidadUuid === dosisUnidadUuid
      ? dosisMaxima
      : convertirCantidad(grafoUnidades, dosisUnidadUuid, row.unidadUuid, dosisMaxima);
  if (dosisMaximaEnUnidadFila == null) return null;

  return dosisMaximaEnUnidadFila / factorPorHectarea;
}

// Caso especial del insumo "Agua" — pedido explícito: su "Ajustar dosis" no
// usa la dosis máxima del artículo (el Agua no tiene), sino que completa el
// volumen restante: Galones ref. menos la suma de TODOS los demás insumos
// que tengan una unidad de volumen convertible a Galones (los que están en
// unidades de peso, como el ACONDICIONADOR en Kg, no se pueden convertir y
// quedan afuera de esa resta automáticamente). Además, ajusta de una vez el
// "ACONDICIONADOR" a razón de su tasa por litro de esa agua resultante
// (o 0.80 gramos si la fila no trae regla — mismo criterio que
// reguladorPhDosisGL en configuracion.service.js). Devuelve null si falta algo (sin fila de
// Agua, sin su unidad, o sin Galones de referencia).
function calcularAjusteAgua(rows, articulos, unidades, grafoUnidades, galonesReferencia) {
  const galonesNum = Number(galonesReferencia) || 0;
  if (!galonesNum) return null;
  const galon = unidades.find((u) => u.nombre === "Galón");
  const litro = unidades.find((u) => u.nombre === "Litro");
  const kilogramo = unidades.find((u) => u.nombre === "Kilogramo");
  if (!galon || !litro) return null;

  const filasConArticulo = rows.map((r) => ({ ...r, articulo: articulos.find((a) => a.uuid === r.articuloUuid) }));
  const aguaRow = filasConArticulo.find((r) => r.articulo?.nombre === "Agua");
  const reguladorRow = filasConArticulo.find((r) => r.articulo?.nombre === "ACONDICIONADOR");
  if (!aguaRow || !aguaRow.unidadUuid) return null;

  let sumaOtrosGal = 0;
  for (const r of filasConArticulo) {
    if (r === aguaRow || r === reguladorRow) continue;
    const cantidad = Number(r.cantidad);
    if (!cantidad || !r.unidadUuid) continue;
    const enGal = r.unidadUuid === galon.uuid ? cantidad : convertirCantidad(grafoUnidades, r.unidadUuid, galon.uuid, cantidad);
    if (enGal != null) sumaOtrosGal += enGal;
  }

  const aguaGal = Math.max(0, galonesNum - sumaOtrosGal);
  const cantidadAgua = aguaRow.unidadUuid === galon.uuid ? aguaGal : convertirCantidad(grafoUnidades, galon.uuid, aguaRow.unidadUuid, aguaGal);
  if (cantidadAgua == null) return null;

  let cantidadRegulador = null;
  if (reguladorRow?.unidadUuid && kilogramo) {
    const aguaLitros = convertirCantidad(grafoUnidades, galon.uuid, litro.uuid, aguaGal) ?? aguaGal;
    // Si la fila trae regla POR_LITRO_AGUA se usa su tasa; si no, el 0.8
    // legacy (gramos por litro).
    const tasaRegla =
      reguladorRow.tipoDosis === "POR_LITRO_AGUA" && Number(reguladorRow.tasa) > 0 ? Number(reguladorRow.tasa) : null;
    const reguladorEnUnidadFila =
      tasaRegla != null
        ? tasaRegla * aguaLitros
        : (() => {
            const reguladorKg = (0.8 * aguaLitros) / 1000;
            return reguladorRow.unidadUuid === kilogramo.uuid
              ? reguladorKg
              : convertirCantidad(grafoUnidades, kilogramo.uuid, reguladorRow.unidadUuid, reguladorKg);
          })();
    cantidadRegulador = reguladorEnUnidadFila;
  }

  return {
    aguaKey: aguaRow.key,
    cantidadAgua,
    reguladorKey: reguladorRow?.key,
    cantidadRegulador,
  };
}

export default function ElaboracionesPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loadingMezclas, setLoadingMezclas] = useState(true);

  // Maestro de mezclas: una fila por mezcla — creada directo ("Nueva
  // mezcla") o a partir de una prueba de laboratorio exitosa (Mezclas —
  // Pruebas de laboratorio) — que ya tiene su artículo elaborado activo.
  // Pedido explícito: "eso no debe ser una tabla de historial, debe ser
  // solo un maestro de mezclas". Clic en una fila lleva al detalle de la
  // receta (misma pantalla que usa Mezclas — Pruebas de laboratorio).
  const [mezclasDisponibles, setMezclasDisponibles] = useState([]); // solo las que ya tienen articuloElaborado activo
  const [todasLasMezclas, setTodasLasMezclas] = useState([]); // sin filtrar, para sugerir el próximo código
  const [almacenes, setAlmacenes] = useState([]);
  const [categoriasElaborado, setCategoriasElaborado] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [conversiones, setConversiones] = useState([]);
  // Opciones para los filtros "Insumo" e "Ingrediente activo" — insumos son
  // artículos tipo INSUMO (independiente de si tienen o no ingrediente
  // activo asignado); ingredientesActivos viene del catálogo de Sanidad
  // Vegetal.
  const [insumosOpciones, setInsumosOpciones] = useState([]);
  const [ingredientesActivosOpciones, setIngredientesActivosOpciones] = useState([]);

  const [filtros, setFiltros] = useState({ search: "", insumoUuid: "", ingredienteActivoUuid: "" });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [directaForm, setDirectaForm] = useState(emptyDirectaForm());
  const [insumoRows, setInsumoRows] = useState([emptyInsumoRow()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [exportando, setExportando] = useState(false);

  // Trae el detalle (con la receta) de cada mezcla del listado actual y
  // arma el Excel — el listado normal no incluye componentes.
  async function handleDescargarExcel() {
    setExportando(true);
    setError("");
    try {
      const detalles = await Promise.all(
        mezclasFiltradas.map((m) => apiFetch(`/inventarios/mezclas/${m.uuid}`).catch(() => null)),
      );
      const filas = construirFilasExcelConReceta(mezclasFiltradas, detalles);
      descargarWorkbook(filas, "mezclas.xlsx");
    } catch (err) {
      setError(err.message);
    } finally {
      setExportando(false);
    }
  }

  // Detalle de una mezcla: insumos de la receta + costo — se pide en el
  // momento (GET /inventarios/mezclas/:uuid no viene incluido en el
  // listado, que solo trae lo necesario para la tabla).
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleMezcla, setDetalleMezcla] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  // Unidad en la que se muestra la columna "Cantidad" del modal "Insumos y
  // costo" — pedido explícito para poder ver la receta en Litros aunque el
  // artículo elaborado rinda en Galones (o viceversa). Se precarga con la
  // unidad del elaborado, pero el operador la puede cambiar libremente.
  const [unidadVistaUuid, setUnidadVistaUuid] = useState("");
  // Ver la receta escalada a 1 hectárea (en vez de la receta completa) —
  // pedido explícito, mismo cálculo que "Dosis real" en Editar/Nueva
  // mezcla: cantidad × (Volumen/ha ÷ rendimiento). Solo disponible si la
  // mezcla tiene Volumen/ha configurado.
  const [verPorHectarea, setVerPorHectarea] = useState(false);

  // Editar mezcla (código, nombre, volumen por hectárea Y la receta de
  // insumos) — pedido explícito para que el Administrador (único rol con
  // el permiso `inventario.mezclas.editar`, ver hasPermission más abajo)
  // pueda corregir los datos generales de una mezcla ya creada, incluida
  // su receta, todo en el mismo modal. Guardar `componentes` en el PUT
  // reemplaza la receta completa (ver mezcla.service.js#update —
  // `necesitaNuevaVersion` se activa apenas viene `componentes`), por eso
  // siempre se manda la lista completa de filas, no solo las que cambiaron.
  const [editarOpen, setEditarOpen] = useState(false);
  const [editarMezcla, setEditarMezcla] = useState(null);
  const [editarForm, setEditarForm] = useState({
    codigo: "",
    nombre: "",
    dosisPorHectarea: "",
    dosisPorHectareaUnidadUuid: "",
    // Rendimiento actual de la receta — no editable acá (no hay campo para
    // cambiarlo en este modal), solo se usa junto con Volumen/ha para
    // calcular la "Dosis real" de cada insumo, igual que en el modal de
    // crear.
    rendimiento: "",
    unidadRendimientoUuid: "",
    galonesReferencia: "",
  });
  const [editarInsumoRows, setEditarInsumoRows] = useState([]);
  const [editarLoading, setEditarLoading] = useState(false);
  const [editarSaving, setEditarSaving] = useState(false);
  const [editarError, setEditarError] = useState("");

  async function abrirEditar(mezcla) {
    setEditarMezcla(mezcla);
    setEditarForm({
      codigo: mezcla.codigo || "",
      nombre: mezcla.nombre || "",
      dosisPorHectarea: mezcla.dosisPorHectarea != null ? String(mezcla.dosisPorHectarea) : "",
      dosisPorHectareaUnidadUuid: mezcla.dosisPorHectareaUnidad?.uuid || "",
      rendimiento: "",
      unidadRendimientoUuid: "",
      galonesReferencia: "",
    });
    setEditarInsumoRows([]);
    setEditarError("");
    setEditarOpen(true);
    setEditarLoading(true);
    try {
      // El listado no trae los componentes de la receta — hace falta el
      // detalle puntual (mismo endpoint que abrirDetalleMezcla).
      const detalle = await apiFetch(`/inventarios/mezclas/${mezcla.uuid}`);
      const componentes = detalle.versiones?.[0]?.componentes || [];
      // Sugiere como "Galones ref." el rendimiento completo de la receta
      // (convertido a Galones) — así apenas se abre ya se ve cuántas
      // hectáreas cubre el lote completo, que es la pregunta que más
      // confunde (ver feedback: "¿por qué 27.47 L da 0.4 L/ha?").
      const grafoUnidadesInicial = construirGrafoUnidades(conversiones);
      const galon = unidades.find((u) => u.nombre === "Galón");
      const rendimientoUuid = detalle.unidadRendimiento?.uuid;
      const rendimientoEnGalones =
        detalle.rendimiento != null && galon
          ? rendimientoUuid === galon.uuid
            ? Number(detalle.rendimiento)
            : convertirCantidad(grafoUnidadesInicial, rendimientoUuid, galon.uuid, Number(detalle.rendimiento))
          : null;
      setEditarForm((f) => ({
        ...f,
        rendimiento: detalle.rendimiento != null ? String(detalle.rendimiento) : "",
        unidadRendimientoUuid: detalle.unidadRendimiento?.uuid || "",
        galonesReferencia: rendimientoEnGalones != null ? String(Math.round(rendimientoEnGalones * 100) / 100) : "",
      }));
      setEditarInsumoRows(
        componentes.length
          ? (() => {
              const base = componentes.map((c) => ({
                key: c.uuid || Math.random().toString(36).slice(2),
                articuloUuid: c.articulo?.uuid || "",
                cantidad: c.cantidad != null ? String(c.cantidad) : "",
                unidadUuid: c.unidad?.uuid || "",
                esPrincipal: Boolean(c.esPrincipal),
                tipoDosis: c.tipoDosis || (c.referenciaArticuloId ? "PORCENTAJE" : "FIJA"),
                referenciaArticuloUuid: "",
                porcentajeReferencia: c.porcentajeReferencia != null ? String(c.porcentajeReferencia) : "",
                tasa: c.tasa != null ? String(c.tasa) : "",
                // tasaUnidadId/dosisUnidadId (numéricos) → uuid para los
                // selects (unidades ya trae id + uuid del combo sin filtro
                // de atributos).
                tasaUnidadUuid: c.tasaUnidadId ? unidades.find((u) => u.id === c.tasaUnidadId)?.uuid || "" : "",
                dosisPorHectarea: c.dosisPorHectarea != null ? String(c.dosisPorHectarea) : "",
                dosisUnidadUuid: c.dosisUnidadId ? unidades.find((u) => u.id === c.dosisUnidadId)?.uuid || "" : "",
              }));
              // referenciaArticuloId (numérico) → uuid del artículo para el
              // select (se resuelve en segunda pasada porque necesita la
              // lista completa; si el único renglón con ese artículo es él
              // mismo, se deja vacío y el backend lo rechaza al guardar).
              base.forEach((r, i) => {
                const refId = componentes[i].referenciaArticuloId;
                if (refId && componentes[i].porcentajeReferencia != null) {
                  const idx = componentes.findIndex((x, k) => k !== i && x.articulo?.id === refId);
                  r.referenciaArticuloUuid = idx >= 0 ? base[idx]?.articuloUuid || "" : "";
                }
              });
              return base;
            })()
          : [emptyInsumoRow()],
      );
    } catch (err) {
      setEditarError(err.message);
    } finally {
      setEditarLoading(false);
    }
  }

  function updateEditarInsumoRow(key, patch) {
    setEditarInsumoRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // Solo un insumo puede ser "Principal" (mismo criterio que Mezclas —
  // Prueba de laboratorio) — Programación de Aspersiones lo usa para el
  // tope de 100%-110% del "% Aumento" automático, antes solo se podía
  // marcar desde la prueba de laboratorio.
  function marcarPrincipalEditar(key) {
    setEditarInsumoRows((rows) => rows.map((r) => ({ ...r, esPrincipal: r.key === key })));
  }

  function addEditarInsumoRow() {
    setEditarInsumoRows((rows) => [...rows, emptyInsumoRow()]);
  }

  function removeEditarInsumoRow(key) {
    setEditarInsumoRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  async function handleGuardarEdicion(e) {
    e.preventDefault();
    if (!editarMezcla) return;
    setEditarError("");
    const grafoEdicion = construirGrafoUnidades(conversiones);
    const totalRefEdicion = totalRefFormulario(
      {
        galonesReferencia: editarForm.galonesReferencia,
        rendimiento: editarForm.rendimiento,
        unidadRendimientoUuid: editarForm.unidadRendimientoUuid,
      },
      unidades,
    );
    const armadoEdicion = componentesPayloadDesdeRows(editarInsumoRows, { grafoUnidades: grafoEdicion, articulos, unidades, totalRef: totalRefEdicion });
    if (armadoEdicion.error) {
      setEditarError(armadoEdicion.error);
      return;
    }
    const componentes = armadoEdicion.componentes;
    if (!componentes.length) {
      setEditarError("Agrega al menos un insumo a la receta.");
      return;
    }
    setEditarSaving(true);
    try {
      // "Galones ref." es el tamaño del lote al que corresponden las
      // cantidades de la receta: se guarda como rendimiento (convertido a la
      // unidad de rendimiento de la mezcla) para que al reabrir no vuelva
      // al valor anterior.
      let rendimientoNuevo;
      const galonEd = unidades.find((u) => u.nombre === "Galón");
      const galonesEd = Number(editarForm.galonesReferencia) || 0;
      if (galonEd && galonesEd > 0 && editarForm.unidadRendimientoUuid) {
        const enUnidadRend =
          editarForm.unidadRendimientoUuid === galonEd.uuid
            ? galonesEd
            : convertirCantidad(grafoEdicion, galonEd.uuid, editarForm.unidadRendimientoUuid, galonesEd);
        if (enUnidadRend != null && enUnidadRend > 0) rendimientoNuevo = Math.round(enUnidadRend * 1e6) / 1e6;
      }
      await apiFetch(`/inventarios/mezclas/${editarMezcla.uuid}`, {
        method: "PUT",
        body: JSON.stringify({
          ...(rendimientoNuevo !== undefined ? { rendimiento: rendimientoNuevo } : {}),
          codigo: editarForm.codigo || null,
          nombre: editarForm.nombre,
          dosisPorHectarea: editarForm.dosisPorHectarea === "" ? null : Number(editarForm.dosisPorHectarea),
          dosisPorHectareaUnidadUuid: editarForm.dosisPorHectareaUnidadUuid || null,
          componentes,
        }),
      });
      setEditarOpen(false);
      loadMezclas({ insumoUuid: filtros.insumoUuid, ingredienteActivoUuid: filtros.ingredienteActivoUuid });
    } catch (err) {
      setEditarError(err.message);
    } finally {
      setEditarSaving(false);
    }
  }

  const inputCargueRef = useRef(null);
  const [cargueModalOpen, setCargueModalOpen] = useState(false);
  const [cargueArchivo, setCargueArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [cargueError, setCargueError] = useState("");
  const [cargueResultado, setCargueResultado] = useState(null);

  // Papelera de mezclas eliminadas — solo Administrador (backend también lo
  // exige). Reutiliza la misma tabla: al activarse cambia la fuente de
  // datos y las acciones de la última columna (Restaurar en vez de Ver).
  const [esAdmin, setEsAdmin] = useState(false);
  const [verEliminados, setVerEliminados] = useState(false);
  const [eliminados, setEliminados] = useState([]);
  const [eliminadosLoading, setEliminadosLoading] = useState(false);
  const [restaurandoUuid, setRestaurandoUuid] = useState(null);

  useEffect(() => {
    setEsAdmin(esAdministrador());
  }, []);

  async function loadEliminados() {
    setEliminadosLoading(true);
    setError("");
    try {
      const { items: rows } = await apiFetch("/inventarios/mezclas/eliminados?limit=100");
      setEliminados(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setEliminadosLoading(false);
    }
  }

  function toggleEliminados() {
    const next = !verEliminados;
    setVerEliminados(next);
    if (next) loadEliminados();
  }

  async function handleRestore(mezcla) {
    setRestaurandoUuid(mezcla.uuid);
    try {
      await apiFetch(`/inventarios/mezclas/${mezcla.uuid}/restore`, { method: "POST" });
      loadEliminados();
      loadMezclas({ insumoUuid: filtros.insumoUuid, ingredienteActivoUuid: filtros.ingredienteActivoUuid });
    } catch (err) {
      setError(err.message);
    } finally {
      setRestaurandoUuid(null);
    }
  }

  // Eliminar una mezcla queda reservado al rol Administrador (backend
  // también lo exige, ver mezcla.routes.js) — se puede restaurar después
  // desde "Eliminados".
  async function handleDelete(mezcla) {
    if (!confirm(`¿Eliminar la mezcla "${mezcla.nombre || mezcla.codigo}"? Se puede restaurar después desde "Eliminados".`)) return;
    try {
      await apiFetch(`/inventarios/mezclas/${mezcla.uuid}`, { method: "DELETE" });
      loadMezclas({ insumoUuid: filtros.insumoUuid, ingredienteActivoUuid: filtros.ingredienteActivoUuid });
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadMezclas({ insumoUuid, ingredienteActivoUuid } = {}) {
    setLoadingMezclas(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (insumoUuid) params.set("insumoUuid", insumoUuid);
      if (ingredienteActivoUuid) params.set("ingredienteActivoUuid", ingredienteActivoUuid);
      const mezclas = await apiFetch(`/inventarios/mezclas?${params.toString()}`);
      const mezclasItems = mezclas.items || [];
      setMezclasDisponibles(mezclasItems.filter((m) => m.articuloElaborado?.estado));
      setTodasLasMezclas(mezclasItems);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMezclas(false);
    }
  }

  async function loadCombos() {
    try {
      const [alms, categorias, arts, unis, convs, insumos, ingredientesActivos] = await Promise.all([
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
        apiFetch("/inventarios/categorias?limit=100&tipo=ELABORADO&estado=true"),
        apiFetch("/inventarios/articulos?limit=100&estado=true"),
        apiFetch("/inventarios/unidades?limit=100&estado=true"),
        apiFetch("/inventarios/unidades/conversiones"),
        apiFetch("/inventarios/articulos?limit=100&estado=true&tipo=INSUMO"),
        apiFetch("/ingredientes-activos?limit=100&estado=true"),
      ]);
      setAlmacenes(alms.items || []);
      setCategoriasElaborado(categorias.items || []);
      setArticulos(arts.items || []);
      setUnidades(unis.items || []);
      setConversiones(Array.isArray(convs) ? convs : convs.items || []);
      setInsumosOpciones(insumos.items || []);
      setIngredientesActivosOpciones(ingredientesActivos.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadCombos();
  }, []);

  useEffect(() => {
    loadMezclas({ insumoUuid: filtros.insumoUuid, ingredienteActivoUuid: filtros.ingredienteActivoUuid });
  }, [filtros.insumoUuid, filtros.ingredienteActivoUuid]);

  const mezclasFiltradas = mezclasDisponibles.filter((m) => {
    const texto = filtros.search.trim().toLowerCase();
    return !texto || m.nombre?.toLowerCase().includes(texto) || m.codigo?.toLowerCase().includes(texto);
  });

  function limpiarFiltros() {
    setFiltros({ search: "", insumoUuid: "", ingredienteActivoUuid: "" });
  }

  function openCreate() {
    setForm(emptyForm());
    setDirectaForm({ ...emptyDirectaForm(), articuloCodigo: siguienteCodigoSugerido(todasLasMezclas) });
    setInsumoRows([emptyInsumoRow()]);
    setFormError("");
    setModalOpen(true);
  }

  function updateInsumoRow(key, patch) {
    setInsumoRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // Solo un insumo puede ser "Principal" — ver marcarPrincipalEditar.
  function marcarPrincipal(key) {
    setInsumoRows((rows) => rows.map((r) => ({ ...r, esPrincipal: r.key === key })));
  }

  function addInsumoRow() {
    setInsumoRows((rows) => [...rows, emptyInsumoRow()]);
  }

  function removeInsumoRow(key) {
    setInsumoRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  async function handleCrearDirecta() {
    const grafoCrear = construirGrafoUnidades(conversiones);
    const totalRefCrear = totalRefFormulario(
      {
        galonesReferencia: form.galonesReferencia,
        rendimiento: form.cantidadElaborada,
        unidadRendimientoUuid: directaForm.articuloUnidadMedidaUuid,
      },
      unidades,
    );
    const armadoCrear = componentesPayloadDesdeRows(insumoRows, { grafoUnidades: grafoCrear, articulos, unidades, totalRef: totalRefCrear });
    if (armadoCrear.error) {
      setFormError(armadoCrear.error);
      return;
    }
    const componentes = armadoCrear.componentes;
    if (!componentes.length) {
      setFormError("Agrega al menos un insumo a la receta.");
      return;
    }
    const resultado = await apiFetch("/inventarios/mezclas/directo", {
      method: "POST",
      body: JSON.stringify({
        articuloNombre: directaForm.articuloNombre,
        articuloCodigo: directaForm.articuloCodigo || null,
        articuloCategoriaUuid: directaForm.articuloCategoriaUuid,
        articuloUnidadMedidaUuid: directaForm.articuloUnidadMedidaUuid || null,
        almacenUuid: form.almacenUuid,
        rendimiento: Number(form.cantidadElaborada),
        dosisPorHectarea: form.volumenPorHectarea === "" ? null : Number(form.volumenPorHectarea),
        dosisPorHectareaUnidadUuid: form.volumenPorHectareaUnidadUuid || null,
        componentes,
        observaciones: form.observaciones || null,
      }),
    });
    const pendiente = resultado.version?.estadoPrueba === "PENDIENTE_APROBACION";
    setModalOpen(false);
    loadMezclas({ insumoUuid: filtros.insumoUuid, ingredienteActivoUuid: filtros.ingredienteActivoUuid });
    alert(
      pendiente
        ? `Receta creada: "${directaForm.articuloNombre}" queda pendiente de aprobación antes de poder usarse o producirse.`
        : `Receta creada y activa: "${directaForm.articuloNombre}".`,
    );
  }

  async function handleCrearMezcla(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await handleCrearDirecta();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function abrirDetalleMezcla(mezcla) {
    setDetalleOpen(true);
    setDetalleLoading(true);
    setDetalleMezcla(null);
    try {
      const data = await apiFetch(`/inventarios/mezclas/${mezcla.uuid}`);
      setDetalleMezcla(data);
      setUnidadVistaUuid(data.articuloElaborado?.unidadMedida?.uuid || "");
      setVerPorHectarea(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetalleLoading(false);
    }
  }

  function openCargueModal() {
    setCargueArchivo(null);
    setCargueError("");
    setCargueResultado(null);
    setCargueModalOpen(true);
  }

  function handleElegirArchivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargueArchivo(file);
    setCargueError("");
    setCargueResultado(null);
  }

  async function handleSubirCargue() {
    if (!cargueArchivo) return;
    setCargando(true);
    setCargueError("");
    try {
      const resultado = await apiUpload("/inventarios/mezclas/bulk-upload", cargueArchivo);
      setCargueResultado(resultado);
      loadMezclas({ insumoUuid: filtros.insumoUuid, ingredienteActivoUuid: filtros.ingredienteActivoUuid });
    } catch (err) {
      setCargueError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <RequirePermission code="menu.inventarios.elaboraciones">
      <div className="p-4 p-md-5">
        {/* Mezclas vive en Sanidad Vegetal, comparte esta barra de pestañas
            con Insumos e Ingredientes Activos para navegar entre las tres
            sin pasar por el sidebar. */}
        <ul className="nav nav-pills mb-3">
          <li className="nav-item">
            <Link href="/sanidad-vegetal/mezclas" className="nav-link rounded-3 active">
              Mezclas
            </Link>
          </li>
          <li className="nav-item">
            <Link href="/sanidad-vegetal/ingredientes-activos/insumos" className="nav-link rounded-3">
              Insumos
            </Link>
          </li>
          <li className="nav-item">
            <Link href="/sanidad-vegetal/ingredientes-activos" className="nav-link rounded-3">
              Ingredientes Activos
            </Link>
          </li>
        </ul>

        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Mezclas</h1>
            <p className="text-secondary mb-0">
              Maestro de mezclas: cada una tiene su propio consecutivo y su artículo elaborado. El artículo elaborado
              nunca tiene saldo propio — cada vez que se produce un lote se valida stock y se descuentan los insumos
              de la receta.
            </p>
          </div>
          <div className="d-flex gap-2">
            {esAdmin && (
              <button
                type="button"
                className={`btn btn-sm rounded-3 d-flex align-items-center gap-2 ${verEliminados ? "btn-secondary" : "btn-outline-secondary"}`}
                onClick={toggleEliminados}
                title="Ver mezclas eliminadas (solo Administrador)"
              >
                {verEliminados ? <FiX /> : <FiArchive />} {verEliminados ? "Cerrar eliminados" : "Eliminados"}
              </button>
            )}
            {!verEliminados && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
                onClick={handleDescargarExcel}
                disabled={exportando || mezclasFiltradas.length === 0}
                title="Descargar el listado actual en Excel, con la receta de cada mezcla (un archivo que se puede volver a subir por Cargue masivo)"
              >
                <FiDownload /> {exportando ? "Generando..." : "Descargar Excel"}
              </button>
            )}
            {!verEliminados && hasPermission("inventario.mezclas.elaborar") && (
              <>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
                  onClick={openCargueModal}
                  title="Cargar varias mezclas desde un archivo Excel/CSV"
                >
                  <FiUploadCloud /> Cargue masivo
                </button>
                <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
                  <FiPlus /> Nueva mezcla
                </button>
              </>
            )}
          </div>
        </div>

        {verEliminados ? (
          <div className="alert alert-secondary py-2 small mb-3">
            Mostrando mezclas eliminadas — solo visibles para el Administrador. Siguen en la base de datos, sin
            aparecer en el listado normal, hasta que se restauren.
          </div>
        ) : (
        <div className="card border-0 rounded-4 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            <div className="row g-2">
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Buscar por nombre o código</label>
                <input
                  type="text"
                  className="form-control form-control-sm rounded-3"
                  list="mezclas-sugerencias"
                  value={filtros.search}
                  onChange={(e) => setFiltros((f) => ({ ...f, search: e.target.value }))}
                />
                <datalist id="mezclas-sugerencias">
                  {todasLasMezclas.map((m) => (
                    <option key={m.uuid} value={m.nombre || m.codigo} />
                  ))}
                  {todasLasMezclas
                    .filter((m) => m.codigo)
                    .map((m) => (
                      <option key={`${m.uuid}-cod`} value={m.codigo} />
                    ))}
                </datalist>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Insumo en la receta</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={filtros.insumoUuid}
                  onChange={(e) => setFiltros((f) => ({ ...f, insumoUuid: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {insumosOpciones.map((a) => (
                    <option key={a.uuid} value={a.uuid}>
                      {a.codigo ? `${a.codigo} — ${a.nombre}` : a.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Ingrediente activo en la receta</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={filtros.ingredienteActivoUuid}
                  onChange={(e) => setFiltros((f) => ({ ...f, ingredienteActivoUuid: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {ingredientesActivosOpciones.map((ia) => (
                    <option key={ia.uuid} value={ia.uuid}>
                      {ia.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(filtros.search || filtros.insumoUuid || filtros.ingredienteActivoUuid) && (
              <div className="d-flex gap-2 mt-3">
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={limpiarFiltros}>
                  Limpiar
                </button>
              </div>
            )}
          </div>
        </div>
        )}

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead>
                <tr className="table-light small text-secondary" style={{ borderBottom: "1px solid #e9ecef" }}>
                  <th className="fw-medium">Código</th>
                  <th className="fw-medium">Nombre</th>
                  <th className="fw-medium">Artículo elaborado</th>
                  <th className="fw-medium">Volumen por hectárea</th>
                  {verEliminados && <th className="fw-medium">Eliminado</th>}
                  <th className="fw-medium text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(verEliminados ? eliminadosLoading : loadingMezclas) && (
                  <tr>
                    <td colSpan={verEliminados ? 6 : 5} className="text-center text-secondary py-3 small">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!verEliminados && !loadingMezclas && mezclasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-3 small">
                      No hay mezclas registradas todavía.
                    </td>
                  </tr>
                )}
                {verEliminados && !eliminadosLoading && eliminados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-3 small">
                      No hay mezclas eliminadas.
                    </td>
                  </tr>
                )}
                {!verEliminados &&
                  !loadingMezclas &&
                  mezclasFiltradas.map((m) => (
                    <tr key={m.uuid} style={{ cursor: "pointer" }} onClick={() => abrirDetalleMezcla(m)}>
                      <td className="small fw-medium">{m.codigo}</td>
                      <td className="small">{m.nombre || <span className="text-secondary fst-italic">Sin nombre</span>}</td>
                      <td className="small text-secondary">{m.articuloElaborado?.nombre || "—"}</td>
                      <td className="small text-secondary">
                        {m.dosisPorHectarea != null
                          ? `${Number(m.dosisPorHectarea).toFixed(2)} ${m.dosisPorHectareaUnidad?.simbolo || ""}/ha`
                          : "—"}
                      </td>
                      <td onClick={(ev) => ev.stopPropagation()}>
                        <div className="d-flex justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                            title="Ver insumos y costo"
                            onClick={() => abrirDetalleMezcla(m)}
                          >
                            <FiEye size={15} />
                          </button>
                          {hasPermission("inventario.mezclas.editar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                              title="Editar"
                              onClick={() => abrirEditar(m)}
                            >
                              <FiEdit2 size={15} />
                            </button>
                          )}
                          {esAdmin && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex"
                              style={{ color: "#dc2626" }}
                              title="Eliminar"
                              onClick={() => handleDelete(m)}
                            >
                              <FiTrash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                {verEliminados &&
                  !eliminadosLoading &&
                  eliminados.map((m) => (
                    <tr key={m.uuid}>
                      <td className="small fw-medium">{m.codigo}</td>
                      <td className="small">{m.nombre || <span className="text-secondary fst-italic">Sin nombre</span>}</td>
                      <td className="small text-secondary">{m.articuloElaborado?.nombre || "—"}</td>
                      <td className="small text-secondary">
                        {m.dosisPorHectarea != null
                          ? `${Number(m.dosisPorHectarea).toFixed(2)} ${m.dosisPorHectareaUnidad?.simbolo || ""}/ha`
                          : "—"}
                      </td>
                      <td className="small text-secondary">
                        {m.deletedAt ? new Date(m.deletedAt).toLocaleString("es-CO") : "—"}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex"
                            style={{ color: "#16a34a" }}
                            title="Restaurar"
                            disabled={restaurandoUuid === m.uuid}
                            onClick={() => handleRestore(m)}
                          >
                            <FiRotateCcw size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {modalOpen && (
          <ModalShell title="Nueva mezcla" onClose={() => setModalOpen(false)} width="80vw">
            <form onSubmit={handleCrearMezcla}>
              <p className="small text-secondary">
                Elegí los insumos y creá el artículo elaborado directamente, sin pasar por la prueba de laboratorio
                (pH/CE). No se descuenta ningún insumo al crear la receta — la cantidad de acá abajo es solo el
                rendimiento de la receta (cuánto produce un lote).
              </p>
              <div className="row g-2 mb-2">
                <div className="col-3">
                  <label className="form-label small fw-medium mb-1 d-flex align-items-center gap-1">
                    Código
                    <FiInfo size={13} className="text-secondary" title="Sugerido continuando el correlativo — lo podés editar." />
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    className="form-control form-control-sm rounded-3"
                    value={directaForm.articuloCodigo}
                    onChange={(e) => setDirectaForm((f) => ({ ...f, articuloCodigo: e.target.value }))}
                  />
                </div>
                <div className="col-5">
                  <label className="form-label small fw-medium mb-1">
                    Nombre del producto <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    className="form-control form-control-sm rounded-3"
                    value={directaForm.articuloNombre}
                    onChange={(e) => setDirectaForm((f) => ({ ...f, articuloNombre: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium mb-1 d-flex align-items-center gap-1">
                    Volumen / ha
                    <FiInfo
                      size={13}
                      className="text-secondary"
                      title="Se guarda con la mezcla y se usa para calcular la columna 'Dosis real' de cada insumo, igual que en Programar aspersión. Después solo se puede editar desde 'Editar mezcla'."
                    />
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control rounded-start-3"
                      value={form.volumenPorHectarea}
                      onChange={(e) => setForm((f) => ({ ...f, volumenPorHectarea: e.target.value }))}
                    />
                    <select
                      className="form-select flex-grow-0 flex-shrink-0 w-auto"
                      value={form.volumenPorHectareaUnidadUuid}
                      onChange={(e) => setForm((f) => ({ ...f, volumenPorHectareaUnidadUuid: e.target.value }))}
                    >
                      <option value="">Unidad...</option>
                      {unidades.map((u) => (
                        <option key={u.uuid} value={u.uuid}>
                          {u.simbolo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="row g-2 mb-2">
                <div className="col-4">
                  <label className="form-label small fw-medium mb-1">
                    Categoría <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select form-select-sm rounded-3"
                    required
                    value={directaForm.articuloCategoriaUuid}
                    onChange={(e) => setDirectaForm((f) => ({ ...f, articuloCategoriaUuid: e.target.value }))}
                  >
                    <option value="">Selecciona...</option>
                    {categoriasElaborado.map((c) => (
                      <option key={c.uuid} value={c.uuid}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-3">
                  <label className="form-label small fw-medium mb-1">Unidad</label>
                  <select
                    className="form-select form-select-sm rounded-3"
                    value={directaForm.articuloUnidadMedidaUuid}
                    onChange={(e) => setDirectaForm((f) => ({ ...f, articuloUnidadMedidaUuid: e.target.value }))}
                  >
                    <option value="">Sin unidad</option>
                    {unidades.map((u) => (
                      <option key={u.uuid} value={u.uuid}>
                        {u.simbolo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-3">
                  <label className="form-label small fw-medium mb-1">Cantidad a producir</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="form-control form-control-sm rounded-3"
                    value={form.cantidadElaborada}
                    onChange={(e) => setForm((f) => ({ ...f, cantidadElaborada: e.target.value }))}
                  />
                </div>
                <div className="col-2">
                  <label className="form-label small fw-medium mb-1 d-flex align-items-center gap-1">
                    Galones ref.
                    <FiInfo
                      size={13}
                      className="text-secondary"
                      title="Cuántos galones se van a preparar — con Volumen/ha se calculan solas las hectáreas que cubrirían (galones ÷ Volumen/ha)."
                    />
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control form-control-sm rounded-3"
                    value={form.galonesReferencia}
                    onChange={(e) => setForm((f) => ({ ...f, galonesReferencia: e.target.value }))}
                  />
                  {(() => {
                    const grafoUnidades = construirGrafoUnidades(conversiones);
                    const hectareasCalculadas = calcularHectareasDesdeGalones(
                      form.galonesReferencia,
                      form.volumenPorHectarea,
                      form.volumenPorHectareaUnidadUuid,
                      unidades,
                      grafoUnidades,
                    );
                    return hectareasCalculadas != null ? (
                      <p className="form-text small mb-0">≈ {hectareasCalculadas.toLocaleString("es-CO", { maximumFractionDigits: 3 })} ha</p>
                    ) : null;
                  })()}
                </div>
              </div>

              <p className="small fw-medium mb-2">Insumos de la receta</p>
              <div className="table-responsive mb-2">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr className="small text-secondary">
                      <th>Artículo</th>
                      <th style={{ minWidth: "8rem" }}>Unidad</th>
                      <th style={{ width: "7rem" }}>Cantidad</th>
                      <th style={{ minWidth: "10rem" }}>% de otro</th>
                      <th className="text-center" style={{ width: "5rem" }}>
                        Principal
                      </th>
                      <th className="text-center" style={{ minWidth: "7rem" }}>
                        Dosis informativa
                      </th>
                      <th style={{ minWidth: "5rem" }} />
                      <th className="text-center" style={{ minWidth: "7rem" }}>
                        Dosis real
                      </th>
                      <th style={{ width: "2.5rem" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {insumoRows.map((row) => {
                      const grafoUnidades = construirGrafoUnidades(conversiones);
                      const hectareasCalculadas = calcularHectareasDesdeGalones(
                        form.galonesReferencia,
                        form.volumenPorHectarea,
                        form.volumenPorHectareaUnidadUuid,
                        unidades,
                        grafoUnidades,
                      );
                      // Si la fila tiene regla (X% de otra o tasa por volumen),
                      // dosis y vistas usan su cantidad efectiva, no la
                      // digitada.
                      const totalRefCrear = totalRefFormulario(
                        {
                          galonesReferencia: form.galonesReferencia,
                          rendimiento: form.cantidadElaborada,
                          unidadRendimientoUuid: directaForm.articuloUnidadMedidaUuid,
                        },
                        unidades,
                      );
                      const reglaRelativa = reglaDosisCompleta(row) && !esAguaArticulo(row.articuloUuid, articulos);
                      const aguaLitrosCrear = estimarAguaLitros(insumoRows, { unidades, articulos, grafoUnidades, totalRef: totalRefCrear });
                      const previewRelativa = vistaPreviaDosisRelativa(row, insumoRows, { grafoUnidades, totalRef: totalRefCrear, aguaLitros: aguaLitrosCrear });
                      const filaEfectiva =
                        reglaRelativa && previewRelativa != null ? { ...row, cantidad: String(previewRelativa) } : row;
                      const dosis = calcularDosisFila(filaEfectiva, {
                        articulos,
                        unidades,
                        grafoUnidades,
                        rendimiento: form.cantidadElaborada,
                        unidadRendimientoUuid: directaForm.articuloUnidadMedidaUuid,
                        volumenPorHa: form.volumenPorHectarea,
                        unidadVolumenPorHaUuid: form.volumenPorHectareaUnidadUuid,
                        hectareas: hectareasCalculadas,
                      });
                      const cantidadAjustada = calcularCantidadParaDosisMaxima(filaEfectiva, {
                        articulos,
                        unidades,
                        grafoUnidades,
                        rendimiento: form.cantidadElaborada,
                        unidadRendimientoUuid: directaForm.articuloUnidadMedidaUuid,
                        volumenPorHa: form.volumenPorHectarea,
                        unidadVolumenPorHaUuid: form.volumenPorHectareaUnidadUuid,
                      });
                      const esAgua = articulos.find((a) => a.uuid === row.articuloUuid)?.nombre === "Agua";
                      // Solo el Agua va sin columna de regla (rellena el total).
                      const sinRegla = esAgua;
                      const ajusteAgua = esAgua
                        ? calcularAjusteAgua(insumoRows, articulos, unidades, grafoUnidades, form.galonesReferencia)
                        : null;
                      return (
                      <tr key={row.key}>
                        <td>
                          <select
                            className="form-select form-select-sm rounded-3"
                            value={row.articuloUuid}
                            onChange={(e) => updateInsumoRow(row.key, { articuloUuid: e.target.value })}
                          >
                            <option value="">Selecciona...</option>
                            {articulos.map((a) => (
                              <option key={a.uuid} value={a.uuid}>
                                {a.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm rounded-3"
                            value={row.unidadUuid}
                            onChange={(e) => updateInsumoRow(row.key, { unidadUuid: e.target.value })}
                          >
                            <option value="">Sin unidad</option>
                            {unidades.map((u) => (
                              <option key={u.uuid} value={u.uuid}>
                                {u.simbolo}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            className="form-control form-control-sm rounded-3"
                            value={reglaRelativa && previewRelativa != null ? Number(previewRelativa.toFixed(4)) : row.cantidad}
                            disabled={reglaRelativa && previewRelativa != null}
                            title={reglaRelativa ? "La cantidad la define la regla de dosis (X% del insumo de referencia o tasa por galón)" : undefined}
                            onChange={(e) => updateInsumoRow(row.key, { cantidad: e.target.value })}
                          />
                        </td>
                        {celdaDosisRelativa(row, insumoRows, updateInsumoRow, { unidades, articulos, grafoUnidades, totalRef: totalRefCrear, aguaLitros: aguaLitrosCrear, deshabilitado: sinRegla })}
                        <td className="text-center">
                          <input
                            type="radio"
                            name="insumoPrincipal"
                            className="form-check-input"
                            checked={Boolean(row.esPrincipal)}
                            disabled={!row.articuloUuid}
                            onChange={() => marcarPrincipal(row.key)}
                            title="Insumo principal de la receta — lo usa Programación de Aspersiones para el tope de dosis del % Aumento automático"
                          />
                        </td>
                        <td className="small text-center text-secondary">
                          {dosis.dosisInformativa != null
                            ? `${dosis.dosisInformativa.toLocaleString("es-CO", { maximumFractionDigits: 3 })} ${dosis.dosisInformativaSimbolo}/ha`
                            : "—"}
                          {dosis.dosisEsDelRenglon && (
                            <div>
                              <span className="badge bg-info rounded-pill" style={{ fontSize: "0.65rem" }} title="Dosis de referencia de ESTA receta (manda sobre la del artículo)">
                                receta
                              </span>
                            </div>
                          )}
                          <div className="d-flex flex-column gap-1 mt-1">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className="form-control form-control-sm rounded-3 px-1"
                              placeholder="dosis receta"
                              title="Dosis de referencia DE ESTA RECETA (ej. ACEITE a 2.0/ha). Vacío = usar la del artículo."
                              value={row.dosisPorHectarea}
                              disabled={!row.articuloUuid}
                              onChange={(e) => updateInsumoRow(row.key, { dosisPorHectarea: e.target.value })}
                            />
                            {row.dosisPorHectarea !== "" && (
                              <select
                                className="form-select form-select-sm rounded-3 px-1"
                                value={row.dosisUnidadUuid}
                                onChange={(e) => updateInsumoRow(row.key, { dosisUnidadUuid: e.target.value })}
                                title="Unidad de la dosis de esta receta"
                              >
                                <option value="">unidad…</option>
                                {unidades.map((u) => (
                                  <option key={u.uuid} value={u.uuid}>
                                    {u.simbolo}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="text-center">
                          {ajusteAgua != null ? (
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-1 d-inline-flex align-items-center gap-1 text-secondary text-decoration-none"
                              style={{ fontSize: "0.7rem" }}
                              title="Completa el agua con el volumen restante (Galones ref. menos los demás insumos con unidad de volumen) y ajusta de una vez el ACONDICIONADOR a 0.80 g por litro de agua"
                              onClick={() => {
                                updateInsumoRow(ajusteAgua.aguaKey, { cantidad: String(ajusteAgua.cantidadAgua) });
                                if (ajusteAgua.reguladorKey && ajusteAgua.cantidadRegulador != null) {
                                  updateInsumoRow(ajusteAgua.reguladorKey, { cantidad: String(ajusteAgua.cantidadRegulador) });
                                }
                              }}
                            >
                              <FiSliders size={12} /> Ajustar dosis
                            </button>
                          ) : (
                            cantidadAjustada != null && (
                              <button
                                type="button"
                                className="btn btn-link btn-sm p-1 d-inline-flex align-items-center gap-1 text-secondary text-decoration-none"
                                style={{ fontSize: "0.7rem" }}
                                title="Ajustar la cantidad de esta fila para que la dosis real quede exacta en la dosis por hectárea del artículo"
                                onClick={() => updateInsumoRow(row.key, { cantidad: String(cantidadAjustada) })}
                              >
                                <FiSliders size={12} /> Ajustar dosis
                              </button>
                            )
                          )}
                        </td>
                        <td className={`small text-center ${dosis.excede ? "text-danger fw-medium" : "text-secondary"}`}>
                          {dosis.dosisReal != null
                            ? `${dosis.dosisReal.toLocaleString("es-CO", { maximumFractionDigits: 3 })} ${dosis.dosisRealSimbolo}/ha`
                            : "—"}
                          {dosis.cantidadNecesaria != null && (
                            <div className="text-secondary" style={{ fontSize: "0.7rem" }}>
                              ({dosis.cantidadNecesaria.toLocaleString("es-CO", { maximumFractionDigits: 3 })} {dosis.cantidadNecesariaSimbolo}{" "}
                              para {hectareasCalculadas.toLocaleString("es-CO", { maximumFractionDigits: 3 })} ha)
                            </div>
                          )}
                        </td>
                        <td>
                          {insumoRows.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-danger"
                              onClick={() => removeInsumoRow(row.key)}
                            >
                              <FiX size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="btn btn-link btn-sm text-decoration-none d-inline-flex align-items-center gap-1 px-0 mb-3"
                onClick={addInsumoRow}
              >
                <FiPlus size={14} /> Agregar insumo
              </button>
              {(() => {
                const grafoUnidades = construirGrafoUnidades(conversiones);
                const { totalLitros, totalGalones } = calcularTotalesReceta(insumoRows, unidades, grafoUnidades);
                return (
                  <p className="small text-secondary mb-3">
                    Total receta: <strong className="text-body">{totalLitros.toLocaleString("es-CO", { maximumFractionDigits: 3 })} L</strong>
                    {" · "}
                    <strong className="text-body">{totalGalones.toLocaleString("es-CO", { maximumFractionDigits: 3 })} Gal</strong>
                  </p>
                );
              })()}

              <div className="mb-3">
                <label className="form-label small fw-medium">Almacén</label>
                <select
                  className="form-select rounded-3"
                  required
                  value={form.almacenUuid}
                  onChange={(e) => setForm((f) => ({ ...f, almacenUuid: e.target.value }))}
                >
                  <option value="">Selecciona...</option>
                  {almacenes.map((a) => (
                    <option key={a.uuid} value={a.uuid}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-medium">Observaciones</label>
                <textarea
                  className="form-control rounded-3"
                  rows={2}
                  value={form.observaciones}
                  onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                />
              </div>
              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={saving}>
                  {saving ? "Creando..." : "Crear receta"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}

        {detalleOpen && (
          <ModalShell
            title={`Insumos y costo — ${detalleMezcla?.nombre || detalleMezcla?.codigo || ""}`}
            onClose={() => setDetalleOpen(false)}
            width="60vw"
          >
            {detalleLoading ? (
              <p className="text-secondary small mb-0">Cargando...</p>
            ) : !detalleMezcla ? (
              <p className="text-secondary small mb-0">No se pudo cargar el detalle.</p>
            ) : (
              (() => {
                const version = detalleMezcla.versiones?.[0];
                const componentes = version?.componentes || [];
                // Costo en VIVO, con el costoCompra actual de cada insumo —
                // el mismo criterio que usa de verdad elaboracion.service.js
                // al producir (no el snapshot guardado al cargar la receta,
                // que puede quedar desactualizado si el costo del insumo
                // cambió después). costoCompra está expresado en la unidad
                // BASE del artículo (articulo.unidadMedidaId) — si el
                // insumo se cargó en la receta con OTRA unidad (ej. la
                // receta mide en ml pero el artículo cuesta por L), hay que
                // convertir la cantidad a esa unidad base antes de
                // multiplicar, si no el costo queda inflado/reducido por el
                // factor de conversión (ej. 100 ml tratados como si fueran
                // 100 L). Mismo grafo BFS bidireccional que usa la
                // calculadora de Unidades (lib/unidadConversion.js) y que
                // usa el backend para descontar stock.
                const grafoUnidades = construirGrafoUnidades(conversiones);
                const unidadUuidPorId = new Map(unidades.map((u) => [u.id, u.uuid]));
                const cantidadEnUnidadBase = (c) => {
                  const cantidad = Number(c.cantidad);
                  const origenUuid = c.unidad?.uuid;
                  const destinoUuid = unidadUuidPorId.get(c.articulo?.unidadMedidaId);
                  if (!origenUuid || !destinoUuid || origenUuid === destinoUuid) return cantidad;
                  const convertida = convertirCantidad(grafoUnidades, origenUuid, destinoUuid, cantidad);
                  return convertida ?? cantidad;
                };
                // Para MOSTRAR la columna Cantidad: si dos insumos son del
                // mismo tipo de magnitud (ej. volumen) pero se cargaron en
                // unidades distintas (ml vs L), mezclar ambas en la tabla
                // confunde ("100 ml" al lado de "0,9 L"). Se normalizan
                // todas a la unidad elegida en "Ver en" (por defecto la del
                // artículo elaborado, la misma que se muestra en "Rinde",
                // pero el operador la puede cambiar — pedido explícito para
                // poder ver la receta en Litros aunque rinda en Galones o
                // viceversa) cuando la conversión existe; si un insumo es de
                // otra magnitud sin conversión registrada (ej. Kg de un
                // sólido en una mezcla que rinde en L), esa fila se deja en
                // su unidad original en vez de forzar un número sin sentido.
                const unidadMostrarUuid = unidadVistaUuid || detalleMezcla.articuloElaborado?.unidadMedida?.uuid;
                const unidadMostrarSimbolo =
                  unidades.find((u) => u.uuid === unidadMostrarUuid)?.simbolo ||
                  detalleMezcla.articuloElaborado?.unidadMedida?.simbolo ||
                  "";
                const rendimiento = Number(detalleMezcla.rendimiento ?? 1) || 1;
                // Factor para escalar la receta completa a 1 hectárea —
                // mismo criterio que "Dosis real" en Editar/Nueva mezcla:
                // (Volumen/ha convertido a la unidad de rendimiento) ÷
                // rendimiento. Solo aplica si "Ver por hectárea" está
                // activo Y la mezcla tiene Volumen/ha configurado — si no,
                // el factor queda en 1 (receta completa, sin escalar).
                const unidadRendimientoUuid = detalleMezcla.unidadRendimiento?.uuid || detalleMezcla.articuloElaborado?.unidadMedida?.uuid;
                let factorPorHectarea = 1;
                if (verPorHectarea && detalleMezcla.dosisPorHectarea != null && detalleMezcla.dosisPorHectareaUnidad?.uuid && unidadRendimientoUuid) {
                  const volumenHaEnRendimiento =
                    detalleMezcla.dosisPorHectareaUnidad.uuid === unidadRendimientoUuid
                      ? Number(detalleMezcla.dosisPorHectarea)
                      : convertirCantidad(
                          grafoUnidades,
                          detalleMezcla.dosisPorHectareaUnidad.uuid,
                          unidadRendimientoUuid,
                          Number(detalleMezcla.dosisPorHectarea),
                        );
                  if (volumenHaEnRendimiento != null) factorPorHectarea = volumenHaEnRendimiento / rendimiento;
                }
                const cantidadParaMostrar = (c) => {
                  const cantidad = Number(c.cantidad) * factorPorHectarea;
                  const origenUuid = c.unidad?.uuid;
                  if (!origenUuid || !unidadMostrarUuid || origenUuid === unidadMostrarUuid) {
                    return { valor: cantidad, simbolo: c.unidad?.simbolo || "" };
                  }
                  const convertida = convertirCantidad(grafoUnidades, origenUuid, unidadMostrarUuid, cantidad);
                  if (convertida == null) return { valor: cantidad, simbolo: c.unidad?.simbolo || "" };
                  return { valor: convertida, simbolo: unidadMostrarSimbolo };
                };
                const costoTotal = componentes.reduce(
                  (acc, c) => acc + cantidadEnUnidadBase(c) * Number(c.articulo?.costoCompra || 0),
                  0,
                );
                // Volumen por hectárea mostrado en la misma unidad elegida
                // en "Ver en" — pedido explícito: si se cambia la unidad de
                // volumen, también cambia el cálculo del volumen por
                // hectárea mostrado (no se queda fijo en su unidad guardada).
                const volumenPorHaMostrado =
                  detalleMezcla.dosisPorHectarea != null && detalleMezcla.dosisPorHectareaUnidad?.uuid
                    ? detalleMezcla.dosisPorHectareaUnidad.uuid === unidadMostrarUuid || !unidadMostrarUuid
                      ? { valor: Number(detalleMezcla.dosisPorHectarea), simbolo: detalleMezcla.dosisPorHectareaUnidad.simbolo }
                      : (() => {
                          const convertido = convertirCantidad(
                            grafoUnidades,
                            detalleMezcla.dosisPorHectareaUnidad.uuid,
                            unidadMostrarUuid,
                            Number(detalleMezcla.dosisPorHectarea),
                          );
                          return convertido != null
                            ? { valor: convertido, simbolo: unidadMostrarSimbolo }
                            : { valor: Number(detalleMezcla.dosisPorHectarea), simbolo: detalleMezcla.dosisPorHectareaUnidad.simbolo };
                        })()
                    : null;
                return (
                  <div>
                    <p className="small text-secondary mb-3">
                      {detalleMezcla.codigo} — Artículo elaborado:{" "}
                      <strong>{detalleMezcla.articuloElaborado?.nombre || "—"}</strong> — Rinde{" "}
                      {rendimiento.toFixed(2)} {detalleMezcla.articuloElaborado?.unidadMedida?.simbolo || ""}
                    </p>
                    <p className="small text-secondary mb-3">
                      Volumen por hectárea:{" "}
                      <strong className="text-body">
                        {volumenPorHaMostrado
                          ? `${volumenPorHaMostrado.valor.toFixed(2)} ${volumenPorHaMostrado.simbolo}/ha`
                          : "sin configurar"}
                      </strong>
                    </p>
                    <div className="d-flex justify-content-end align-items-center gap-3 mb-2">
                      {detalleMezcla.dosisPorHectarea != null && detalleMezcla.dosisPorHectareaUnidad && (
                        <div className="form-check mb-0">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id="verPorHectarea"
                            checked={verPorHectarea}
                            onChange={(e) => setVerPorHectarea(e.target.checked)}
                          />
                          <label className="form-check-label small text-secondary" htmlFor="verPorHectarea">
                            Ver por hectárea
                          </label>
                        </div>
                      )}
                      <label className="form-label small fw-medium mb-0 text-secondary">Ver en</label>
                      <select
                        className="form-select form-select-sm"
                        style={{ width: "8rem" }}
                        value={unidadVistaUuid}
                        onChange={(e) => setUnidadVistaUuid(e.target.value)}
                      >
                        {unidades
                          .filter((u) => u.tipo === "VOLUMEN")
                          .map((u) => (
                            <option key={u.uuid} value={u.uuid}>
                              {u.nombre}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="table-responsive mb-3">
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr className="small text-secondary">
                            <th>Insumo</th>
                            <th>Cantidad</th>
                            <th>Costo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {componentes.length === 0 && (
                            <tr>
                              <td colSpan={3} className="text-center text-secondary small py-3">
                                Sin insumos registrados.
                              </td>
                            </tr>
                          )}
                          {componentes.map((c) => {
                            const { valor: cantidadMostrada, simbolo: simboloMostrado } = cantidadParaMostrar(c);
                            return (
                              <tr key={c.uuid}>
                                <td className="small">{c.articulo?.nombre || "—"}</td>
                                <td className="small text-secondary">
                                  {cantidadMostrada.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {simboloMostrado}
                                </td>
                                <td className="small text-secondary">
                                  {(cantidadEnUnidadBase(c) * Number(c.articulo?.costoCompra || 0)).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="card border-0 rounded-3" style={{ backgroundColor: "#f0fdf4" }}>
                      <div className="card-body p-3">
                        <p className="mb-0 small text-secondary">
                          Costo total de la receta: <strong>{costoTotal.toFixed(2)}</strong> — Costo por{" "}
                          {detalleMezcla.articuloElaborado?.unidadMedida?.simbolo || "unidad"}:{" "}
                          <strong>{(costoTotal / rendimiento).toFixed(2)}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
            <div className="d-flex justify-content-end gap-2 mt-3">
              {/* Solo tiene sentido para mezclas que sí pasaron por la prueba
                  de laboratorio (esDirecta: false) — una receta creada con
                  "Nueva mezcla" (crearDirecta) nunca generó una prueba, no
                  hay nada que ver en /inventarios/mezclas/[uuid]. */}
              {detalleMezcla?.versiones?.[0]?.esDirecta === false && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-3"
                  onClick={() => router.push(`/inventarios/mezclas/${detalleMezcla.uuid}`)}
                >
                  Ver prueba de laboratorio
                </button>
              )}
              <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={() => setDetalleOpen(false)}>
                Cerrar
              </button>
            </div>
          </ModalShell>
        )}

        {editarOpen && (
          <ModalShell title="Editar mezcla" onClose={() => setEditarOpen(false)} width="80vw">
            <form onSubmit={handleGuardarEdicion}>
              {editarError && <div className="alert alert-danger py-2 small">{editarError}</div>}
              <div className="row g-2 mb-2">
                <div className="col-2">
                  <label className="form-label small fw-medium mb-1">Código</label>
                  <input
                    type="text"
                    className="form-control form-control-sm rounded-3"
                    value={editarForm.codigo}
                    onChange={(e) => setEditarForm((f) => ({ ...f, codigo: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium mb-1">
                    Nombre <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="form-control form-control-sm rounded-3"
                    value={editarForm.nombre}
                    onChange={(e) => setEditarForm((f) => ({ ...f, nombre: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium mb-1 d-flex align-items-center gap-1">
                    Volumen / ha
                    <FiInfo
                      size={13}
                      className="text-secondary"
                      title="Solo para calcular la columna 'Dosis real' de cada insumo, igual que en Programar aspersión."
                    />
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control rounded-start-3"
                      value={editarForm.dosisPorHectarea}
                      onChange={(e) => setEditarForm((f) => ({ ...f, dosisPorHectarea: e.target.value }))}
                    />
                    <select
                      className="form-select flex-grow-0 flex-shrink-0 w-auto"
                      value={editarForm.dosisPorHectareaUnidadUuid}
                      onChange={(e) => setEditarForm((f) => ({ ...f, dosisPorHectareaUnidadUuid: e.target.value }))}
                    >
                      <option value="">Unidad...</option>
                      {unidades.map((u) => (
                        <option key={u.uuid} value={u.uuid}>
                          {u.simbolo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-2">
                  <label className="form-label small fw-medium mb-1 d-flex align-items-center gap-1">
                    Galones ref.
                    <FiInfo
                      size={13}
                      className="text-secondary"
                      title="Cuántos galones se van a preparar — con Volumen/ha se calculan solas las hectáreas que cubrirían (galones ÷ Volumen/ha). Se sugiere con el rendimiento completo de la receta."
                    />
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control form-control-sm rounded-3"
                    value={editarForm.galonesReferencia}
                    onChange={(e) => setEditarForm((f) => ({ ...f, galonesReferencia: e.target.value }))}
                  />
                  {(() => {
                    const grafoUnidades = construirGrafoUnidades(conversiones);
                    const hectareasCalculadas = calcularHectareasDesdeGalones(
                      editarForm.galonesReferencia,
                      editarForm.dosisPorHectarea,
                      editarForm.dosisPorHectareaUnidadUuid,
                      unidades,
                      grafoUnidades,
                    );
                    return hectareasCalculadas != null ? (
                      <p className="form-text small mb-0">≈ {hectareasCalculadas.toLocaleString("es-CO", { maximumFractionDigits: 3 })} ha</p>
                    ) : null;
                  })()}
                </div>
              </div>

              <p className="small fw-medium mb-2">Insumos de la receta</p>
              {editarLoading ? (
                <p className="small text-secondary">Cargando receta...</p>
              ) : (
                <>
                  <div className="table-responsive mb-2">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr className="small text-secondary">
                          <th>Artículo</th>
                          <th style={{ minWidth: "8rem" }}>Unidad</th>
                          <th style={{ width: "7rem" }}>Cantidad</th>
                      <th style={{ minWidth: "10rem" }}>% de otro</th>
                          <th className="text-center" style={{ width: "5rem" }}>
                            Principal
                          </th>
                          <th className="text-center" style={{ minWidth: "7rem" }}>
                            Dosis informativa
                          </th>
                          <th style={{ minWidth: "5rem" }} />
                          <th className="text-center" style={{ minWidth: "7rem" }}>
                            Dosis real
                          </th>
                          <th style={{ width: "2.5rem" }} />
                        </tr>
                      </thead>
                      <tbody>
                        {editarInsumoRows.map((row) => {
                          const grafoUnidades = construirGrafoUnidades(conversiones);
                          const hectareasCalculadas = calcularHectareasDesdeGalones(
                            editarForm.galonesReferencia,
                            editarForm.dosisPorHectarea,
                            editarForm.dosisPorHectareaUnidadUuid,
                            unidades,
                            grafoUnidades,
                          );
                          // Si la fila tiene regla (X% de otra o tasa por galón),
                          // dosis y vistas usan su cantidad efectiva, no la
                          // digitada.
                          const totalRefEditar = totalRefFormulario(
                            {
                              galonesReferencia: editarForm.galonesReferencia,
                              rendimiento: editarForm.rendimiento,
                              unidadRendimientoUuid: editarForm.unidadRendimientoUuid,
                            },
                            unidades,
                          );
                          const reglaRelativa = reglaDosisCompleta(row) && !esAguaArticulo(row.articuloUuid, articulos);
                          const aguaLitrosEditar = estimarAguaLitros(editarInsumoRows, { unidades, articulos, grafoUnidades, totalRef: totalRefEditar });
                          const previewRelativa = vistaPreviaDosisRelativa(row, editarInsumoRows, { grafoUnidades, totalRef: totalRefEditar, aguaLitros: aguaLitrosEditar });
                          const filaEfectiva =
                            reglaRelativa && previewRelativa != null ? { ...row, cantidad: String(previewRelativa) } : row;
                          // Con "Galones ref." el lote comparado es ese (dosis real
                          // y "Ajustar dosis"); si no, el rendimiento guardado.
                          const galonRef = unidades.find((u) => u.nombre === "Galón");
                          const loteRef = Number(editarForm.galonesReferencia) > 0 && galonRef
                            ? { rendimiento: editarForm.galonesReferencia, unidadUuid: galonRef.uuid }
                            : { rendimiento: editarForm.rendimiento, unidadUuid: editarForm.unidadRendimientoUuid };
                          const dosis = calcularDosisFila(filaEfectiva, {
                            articulos,
                            unidades,
                            grafoUnidades,
                            rendimiento: loteRef.rendimiento,
                            unidadRendimientoUuid: loteRef.unidadUuid,
                            volumenPorHa: editarForm.dosisPorHectarea,
                            unidadVolumenPorHaUuid: editarForm.dosisPorHectareaUnidadUuid,
                            hectareas: hectareasCalculadas,
                          });
                          const cantidadAjustada = calcularCantidadParaDosisMaxima(filaEfectiva, {
                            articulos,
                            unidades,
                            grafoUnidades,
                            rendimiento: loteRef.rendimiento,
                            unidadRendimientoUuid: loteRef.unidadUuid,
                            volumenPorHa: editarForm.dosisPorHectarea,
                            unidadVolumenPorHaUuid: editarForm.dosisPorHectareaUnidadUuid,
                          });
                      const esAgua = articulos.find((a) => a.uuid === row.articuloUuid)?.nombre === "Agua";
                      // Solo el Agua va sin columna de regla (rellena el total).
                      const sinRegla = esAgua;
                          const ajusteAgua = esAgua
                            ? calcularAjusteAgua(editarInsumoRows, articulos, unidades, grafoUnidades, editarForm.galonesReferencia)
                            : null;
                          return (
                          <tr key={row.key}>
                            <td>
                              <select
                                className="form-select form-select-sm rounded-3"
                                value={row.articuloUuid}
                                onChange={(e) => updateEditarInsumoRow(row.key, { articuloUuid: e.target.value })}
                              >
                                <option value="">Selecciona...</option>
                                {articulos.map((a) => (
                                  <option key={a.uuid} value={a.uuid}>
                                    {a.nombre}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm rounded-3"
                                value={row.unidadUuid}
                                onChange={(e) => updateEditarInsumoRow(row.key, { unidadUuid: e.target.value })}
                              >
                                <option value="">Sin unidad</option>
                                {unidades.map((u) => (
                                  <option key={u.uuid} value={u.uuid}>
                                    {u.simbolo}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                className="form-control form-control-sm rounded-3"
                                value={reglaRelativa && previewRelativa != null ? Number(previewRelativa.toFixed(4)) : row.cantidad}
                                disabled={reglaRelativa && previewRelativa != null}
                                title={reglaRelativa ? "La cantidad la define la regla de dosis (X% del insumo de referencia o tasa por galón)" : undefined}
                                onChange={(e) => updateEditarInsumoRow(row.key, { cantidad: e.target.value })}
                              />
                            </td>
                            {celdaDosisRelativa(row, editarInsumoRows, updateEditarInsumoRow, { unidades, articulos, grafoUnidades, totalRef: totalRefEditar, aguaLitros: aguaLitrosEditar, deshabilitado: sinRegla })}
                            <td className="text-center">
                              <input
                                type="radio"
                                name="editarInsumoPrincipal"
                                className="form-check-input"
                                checked={Boolean(row.esPrincipal)}
                                disabled={!row.articuloUuid}
                                onChange={() => marcarPrincipalEditar(row.key)}
                                title="Insumo principal de la receta — lo usa Programación de Aspersiones para el tope de dosis del % Aumento automático"
                              />
                            </td>
                            <td className="small text-center text-secondary">
                              {dosis.dosisInformativa != null
                                ? `${dosis.dosisInformativa.toLocaleString("es-CO", { maximumFractionDigits: 3 })} ${dosis.dosisInformativaSimbolo}/ha`
                                : "—"}
                              {dosis.dosisEsDelRenglon && (
                                <div>
                                  <span className="badge bg-info rounded-pill" style={{ fontSize: "0.65rem" }} title="Dosis de referencia de ESTA receta (manda sobre la del artículo)">
                                    receta
                                  </span>
                                </div>
                              )}
                              <div className="d-flex flex-column gap-1 mt-1">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  className="form-control form-control-sm rounded-3 px-1"
                                  placeholder="dosis receta"
                                  title="Dosis de referencia DE ESTA RECETA (ej. ACEITE a 2.0/ha). Vacío = usar la del artículo."
                                  value={row.dosisPorHectarea}
                                  disabled={!row.articuloUuid}
                                  onChange={(e) => updateEditarInsumoRow(row.key, { dosisPorHectarea: e.target.value })}
                                />
                                {row.dosisPorHectarea !== "" && (
                                  <select
                                    className="form-select form-select-sm rounded-3 px-1"
                                    value={row.dosisUnidadUuid}
                                    onChange={(e) => updateEditarInsumoRow(row.key, { dosisUnidadUuid: e.target.value })}
                                    title="Unidad de la dosis de esta receta"
                                  >
                                    <option value="">unidad…</option>
                                    {unidades.map((u) => (
                                      <option key={u.uuid} value={u.uuid}>
                                        {u.simbolo}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </td>
                            <td className="text-center">
                              {ajusteAgua != null ? (
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-1 d-inline-flex align-items-center gap-1 text-secondary text-decoration-none"
                                  style={{ fontSize: "0.7rem" }}
                                  title="Completa el agua con el volumen restante (Galones ref. menos los demás insumos con unidad de volumen) y ajusta de una vez el ACONDICIONADOR a 0.80 g por litro de agua"
                                  onClick={() => {
                                    updateEditarInsumoRow(ajusteAgua.aguaKey, { cantidad: String(ajusteAgua.cantidadAgua) });
                                    if (ajusteAgua.reguladorKey && ajusteAgua.cantidadRegulador != null) {
                                      updateEditarInsumoRow(ajusteAgua.reguladorKey, { cantidad: String(ajusteAgua.cantidadRegulador) });
                                    }
                                  }}
                                >
                                  <FiSliders size={12} /> Ajustar dosis
                                </button>
                              ) : (
                                cantidadAjustada != null && (
                                  <button
                                    type="button"
                                    className="btn btn-link btn-sm p-1 d-inline-flex align-items-center gap-1 text-secondary text-decoration-none"
                                    style={{ fontSize: "0.7rem" }}
                                    title="Ajustar la cantidad de esta fila para que la dosis real quede exacta en la dosis por hectárea del artículo"
                                    onClick={() => updateEditarInsumoRow(row.key, { cantidad: String(cantidadAjustada) })}
                                  >
                                    <FiSliders size={12} /> Ajustar dosis
                                  </button>
                                )
                              )}
                            </td>
                            <td className={`small text-center ${dosis.excede ? "text-danger fw-medium" : "text-secondary"}`}>
                              {dosis.dosisReal != null
                                ? `${dosis.dosisReal.toLocaleString("es-CO", { maximumFractionDigits: 3 })} ${dosis.dosisRealSimbolo}/ha`
                                : "—"}
                              {dosis.cantidadNecesaria != null && (
                                <div className="text-secondary" style={{ fontSize: "0.7rem" }}>
                                  ({dosis.cantidadNecesaria.toLocaleString("es-CO", { maximumFractionDigits: 3 })} {dosis.cantidadNecesariaSimbolo}{" "}
                                  para {hectareasCalculadas.toLocaleString("es-CO", { maximumFractionDigits: 3 })} ha)
                                </div>
                              )}
                            </td>
                            <td>
                              {editarInsumoRows.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link p-1 d-inline-flex text-danger"
                                  onClick={() => removeEditarInsumoRow(row.key)}
                                >
                                  <FiX size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-decoration-none d-inline-flex align-items-center gap-1 px-0 mb-3"
                    onClick={addEditarInsumoRow}
                  >
                    <FiPlus size={14} /> Agregar insumo
                  </button>
                  {(() => {
                    const grafoUnidades = construirGrafoUnidades(conversiones);
                    const { totalLitros, totalGalones } = calcularTotalesReceta(editarInsumoRows, unidades, grafoUnidades);
                    return (
                      <p className="small text-secondary mb-3">
                        Total receta: <strong className="text-body">{totalLitros.toLocaleString("es-CO", { maximumFractionDigits: 3 })} L</strong>
                        {" · "}
                        <strong className="text-body">{totalGalones.toLocaleString("es-CO", { maximumFractionDigits: 3 })} Gal</strong>
                      </p>
                    );
                  })()}
                </>
              )}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setEditarOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={editarSaving || editarLoading}>
                  {editarSaving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}

        {cargueModalOpen && (
          <ModalShell title="Cargue masivo de mezclas" onClose={() => setCargueModalOpen(false)} width="60vw">
            <p className="small text-secondary mb-3">
              Sube un archivo .xlsx o .csv con <strong>una fila por insumo</strong> — varias filas con el mismo{" "}
              <strong>nombre</strong> forman la receta completa de una mezcla (los datos de la mezcla como{" "}
              <strong>categoria</strong>, <strong>almacen</strong> y <strong>cantidadAProducir</strong> solo hacen
              falta en la primera fila de cada grupo). Columnas: <strong>nombre</strong> (obligatoria),{" "}
              <strong>codigo</strong>, <strong>categoria</strong> (nombre de una categoría tipo Elaborado),{" "}
              <strong>unidad</strong> (código, del producto), <strong>cantidadAProducir</strong>,{" "}
              <strong>almacen</strong> (código o nombre), <strong>dosisPorHectarea</strong>,{" "}
              <strong>dosisUnidad</strong> (código), <strong>insumoNombre</strong> (obligatoria),{" "}
              <strong>insumoCantidad</strong> (obligatoria) e <strong>insumoUnidad</strong> (código). Si ya existe
              una mezcla con ese nombre, esa fila/grupo se omite y queda reportado como error.
            </p>

            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2 mb-3"
              onClick={descargarPlantilla}
            >
              <FiDownload /> Descargar plantilla de ejemplo (.xlsx)
            </button>

            <input
              ref={inputCargueRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="form-control rounded-3 mb-1"
              onChange={handleElegirArchivo}
            />
            <p className="small text-secondary mb-3">
              {cargueArchivo ? (
                <>
                  Archivo seleccionado: <strong className="text-body">{cargueArchivo.name}</strong>
                </>
              ) : (
                "Ningún archivo seleccionado."
              )}
            </p>

            {cargueError && <div className="alert alert-danger py-2 small">{cargueError}</div>}

            {cargueResultado && (
              <div className="alert alert-success py-2 small">
                Cargue terminado — mezclas creadas: {cargueResultado.mezclasCreadas}
                {cargueResultado.errores?.length > 0 && (
                  <>
                    <div className="mt-2 fw-medium" style={{ color: "#b45309" }}>
                      {cargueResultado.errores.length} fila(s) con error:
                    </div>
                    <ul className="mb-0 ps-3">
                      {cargueResultado.errores.map((err, idx) => (
                        <li key={idx}>
                          Fila {err.fila}: {err.mensaje}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            <div className="d-flex justify-content-end gap-2 mt-3">
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setCargueModalOpen(false)}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-brand btn-sm rounded-3"
                disabled={!cargueArchivo || cargando}
                onClick={handleSubirCargue}
              >
                {cargando ? "Subiendo..." : "Subir archivo"}
              </button>
            </div>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}


