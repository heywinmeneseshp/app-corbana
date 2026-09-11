"use client";

import { useRef, useState } from "react";
import { FiUploadCloud, FiCheckCircle, FiXCircle, FiAlertTriangle } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequireAdmin from "@/components/RequireAdmin";

// Nombre del tipo de evaluación en el maestro `tipos_evaluacion`, según la
// acción del outbox (ver app-movil/src/services/outbox.service.ts#procesarItem
// — este importador replica exactamente esos mismos pasos y llamadas, solo
// que desde el navegador en vez de desde el celular).
const TIPO_EVALUACION_POR_ACCION = {
  crear_suma: "Suma Bruta",
  crear_conteo: "Conteo de Hojas",
  crear_infeccion: "Índice de infección",
};

const ACCIONES_SOPORTADAS = Object.keys(TIPO_EVALUACION_POR_ACCION);

// Parser mínimo de las sentencias `INSERT INTO outbox (...) VALUES (...)`
// que exporta la app móvil (botón "Exportar pendientes" en la pantalla de
// Pendientes, cuando algo no logró sincronizar solo). Respeta comillas
// simples SQL escapadas como '' (ej. dentro de observaciones con apóstrofe).
function parseOutboxSql(texto) {
  const filas = [];
  const columnas = ["action", "payload", "latitud", "longitud", "created_at", "error", "intentos", "usuario_uuid"];
  const regexInicio = /INSERT INTO outbox \([^)]*\)\s*VALUES\s*\(/gi;
  let match;
  while ((match = regexInicio.exec(texto))) {
    const inicio = match.index + match[0].length;
    const valores = [];
    let i = inicio;
    let actual = "";
    let enComillas = false;
    let campoEsString = false;
    for (; i < texto.length; i += 1) {
      const c = texto[i];
      if (enComillas) {
        if (c === "'" && texto[i + 1] === "'") {
          actual += "'";
          i += 1;
        } else if (c === "'") {
          enComillas = false;
        } else {
          actual += c;
        }
      } else if (c === "'" && actual.trim() === "") {
        enComillas = true;
        campoEsString = true;
      } else if (c === "," || c === ")") {
        const valor = campoEsString ? actual : actual.trim();
        valores.push(valor.trim() === "NULL" && !campoEsString ? null : campoEsString ? actual : valor);
        actual = "";
        campoEsString = false;
        if (c === ")") break;
      } else {
        actual += c;
      }
    }
    if (valores.length !== columnas.length) continue;
    const fila = {};
    columnas.forEach((col, idx) => {
      fila[col] = valores[idx];
    });
    filas.push(fila);
  }
  return filas;
}

// Cachés en memoria del proceso de importación actual: evitan repetir la
// misma búsqueda (ej. varias filas de la misma planta) y, sobre todo, evitan
// crear la misma planta dos veces si dos filas la referencian antes de que
// la primera búsqueda "encuentre" la que acaba de crear la segunda.
function crearContexto() {
  return {
    tiposEvaluacion: null, // { [nombre]: uuid }
    plantas: new Map(), // `${loteUuid}::${codigo}` -> planta
    evaluaciones: new Map(), // `${plantaUuid}::${tipoEvaluacionUuid}::${semanaUuid}` -> evaluacion
  };
}

async function obtenerTiposEvaluacion(ctx) {
  if (ctx.tiposEvaluacion) return ctx.tiposEvaluacion;
  const { items } = await apiFetch("/tipos-evaluacion?limit=100");
  const mapa = {};
  for (const t of items) mapa[t.nombre] = t.uuid;
  ctx.tiposEvaluacion = mapa;
  return mapa;
}

async function buscarOCrearPlanta(ctx, loteUuid, codigo, categoriaUuid, latitud, longitud) {
  const clave = `${loteUuid}::${codigo}`;
  if (ctx.plantas.has(clave)) return ctx.plantas.get(clave);

  let planta;
  try {
    planta = await apiFetch(`/plantas/by-code?loteUuid=${loteUuid}&codigo=${encodeURIComponent(codigo)}`);
  } catch {
    planta = await apiFetch("/plantas", {
      method: "POST",
      body: JSON.stringify({
        loteUuid,
        codigo,
        categoriaPlantaUuid: categoriaUuid,
        latitud: latitud ?? undefined,
        longitud: longitud ?? undefined,
        estado: true,
      }),
    });
  }
  ctx.plantas.set(clave, planta);
  return planta;
}

async function buscarOCrearEvaluacion(ctx, plantaUuid, tipoEvaluacionUuid, semanaUuid, fecha, observacion, capturadoEn, usuarioUuid) {
  const clave = `${plantaUuid}::${tipoEvaluacionUuid}::${semanaUuid}`;
  if (ctx.evaluaciones.has(clave)) return ctx.evaluaciones.get(clave);

  const { items } = await apiFetch(`/plantas/${plantaUuid}/evaluaciones?limit=100`);
  let evaluacion = (items || []).find(
    (e) => e.tipoEvaluacion?.uuid === tipoEvaluacionUuid && e.semana?.uuid === semanaUuid,
  );
  if (!evaluacion) {
    evaluacion = await apiFetch("/evaluaciones", {
      method: "POST",
      body: JSON.stringify({
        plantaUuid,
        tipoEvaluacionUuid,
        semanaUuid,
        fecha,
        capturadoEn: capturadoEn || undefined,
        observacion: observacion || undefined,
        usuarioUuid: usuarioUuid || undefined,
      }),
    });
  }
  ctx.evaluaciones.set(clave, evaluacion);
  return evaluacion;
}

async function procesarFila(ctx, fila) {
  if (!ACCIONES_SOPORTADAS.includes(fila.action)) {
    throw new Error(`Acción "${fila.action}" no soportada por este importador todavía`);
  }

  const p = JSON.parse(fila.payload);
  const tipos = await obtenerTiposEvaluacion(ctx);
  const nombreTipo = TIPO_EVALUACION_POR_ACCION[fila.action];
  const tipoEvaluacionUuid = tipos[nombreTipo];
  if (!tipoEvaluacionUuid) throw new Error(`No se encontró el tipo de evaluación "${nombreTipo}" en el servidor`);

  const latitud = fila.latitud != null ? Number(fila.latitud) : null;
  const longitud = fila.longitud != null ? Number(fila.longitud) : null;

  const planta = await buscarOCrearPlanta(ctx, p.loteUuid, p.plantCode, p.categoriaUuid, latitud, longitud);
  const evaluacion = await buscarOCrearEvaluacion(
    ctx,
    planta.uuid,
    tipoEvaluacionUuid,
    p.semanaUuid,
    p.fecha,
    p.observacion,
    fila.created_at,
    fila.usuario_uuid,
  );

  if (fila.action === "crear_suma") {
    await apiFetch(`/evaluaciones/${evaluacion.uuid}/suma-bruta`, {
      method: "POST",
      body: JSON.stringify({ hojasFuncionales: p.hojasFuncionales, candela: p.candela, estadios: p.estadios }),
    });
  } else if (fila.action === "crear_conteo") {
    await apiFetch(`/evaluaciones/${evaluacion.uuid}/conteo-hojas`, {
      method: "POST",
      body: JSON.stringify({ semanaEmbolseUuid: p.semanaEmbolseUuid, hojasFuncionales: p.hojasFuncionales }),
    });
  } else if (fila.action === "crear_infeccion") {
    await apiFetch(`/evaluaciones/${evaluacion.uuid}/infeccion`, {
      method: "POST",
      body: JSON.stringify({ hojasTotales: p.hojasTotales, yli: p.yli, yls: p.yls, hojas: p.hojas }),
    });
  }

  return { plantCode: p.plantCode, loteCodigo: p.loteCodigo, tipo: nombreTipo };
}

export default function ImportarPendientesPage() {
  const [filas, setFilas] = useState([]);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [indiceActual, setIndiceActual] = useState(0);
  const [resultados, setResultados] = useState([]); // { fila, accion, plantCode, estado: 'ok'|'error', mensaje }
  const inputRef = useRef(null);
  const ctxRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    const texto = await file.text();
    const parseadas = parseOutboxSql(texto);
    setFilas(parseadas);
    setNombreArchivo(file.name);
    setResultados([]);
    setIndiceActual(0);
  };

  const importar = async (filasAImportar, offsetFila = 0) => {
    setProcesando(true);
    if (!ctxRef.current) ctxRef.current = crearContexto();
    const ctx = ctxRef.current;
    const nuevosResultados = [];

    for (let i = 0; i < filasAImportar.length; i += 1) {
      const fila = filasAImportar[i];
      setIndiceActual(offsetFila + i + 1);
      try {
        const info = await procesarFila(ctx, fila);
        nuevosResultados.push({
          fila: offsetFila + i + 1,
          accion: fila.action,
          plantCode: info.plantCode,
          loteCodigo: info.loteCodigo,
          estado: "ok",
          mensaje: `Importada (${info.tipo})`,
        });
      } catch (err) {
        nuevosResultados.push({
          fila: offsetFila + i + 1,
          accion: fila.action,
          plantCode: (() => {
            try {
              return JSON.parse(fila.payload)?.plantCode;
            } catch {
              return "";
            }
          })(),
          estado: "error",
          mensaje: err.message,
        });
      }
    }

    setResultados((prev) => (offsetFila === 0 ? nuevosResultados : [...prev, ...nuevosResultados]));
    setProcesando(false);
  };

  const handleImportarTodo = () => importar(filas, 0);

  const handleReintentarFallidas = () => {
    const indicesFallidos = resultados
      .map((r, i) => (r.estado === "error" ? i : -1))
      .filter((i) => i >= 0);
    const filasFallidas = indicesFallidos.map((i) => filas[i]);
    // Reintenta solo esas filas, reemplazando sus resultados en su misma posición.
    (async () => {
      setProcesando(true);
      const ctx = ctxRef.current || crearContexto();
      ctxRef.current = ctx;
      const nuevos = [...resultados];
      for (let k = 0; k < filasFallidas.length; k += 1) {
        const idxOriginal = indicesFallidos[k];
        const fila = filasFallidas[k];
        setIndiceActual(idxOriginal + 1);
        try {
          const info = await procesarFila(ctx, fila);
          nuevos[idxOriginal] = {
            fila: idxOriginal + 1,
            accion: fila.action,
            plantCode: info.plantCode,
            loteCodigo: info.loteCodigo,
            estado: "ok",
            mensaje: `Importada (${info.tipo})`,
          };
        } catch (err) {
          nuevos[idxOriginal] = { ...nuevos[idxOriginal], mensaje: err.message };
        }
        setResultados([...nuevos]);
      }
      setProcesando(false);
    })();
  };

  const totalOk = resultados.filter((r) => r.estado === "ok").length;
  const totalError = resultados.filter((r) => r.estado === "error").length;

  return (
    <RequireAdmin>
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Importar Pendientes de App Móvil</h1>
          <p className="text-secondary mb-0">
            Cuando la app móvil no logra sincronizar solo, ofrece exportar los pendientes a un archivo <code>.sql</code>.
            Súbelo aquí para crear esas evaluaciones (Suma Bruta, Conteo de Hojas, Índice de Infección) directamente en el
            servidor, quedando a nombre del usuario que las capturó originalmente en el celular.
          </p>
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-4">
          <label
            className="d-flex flex-column align-items-center justify-content-center text-center rounded-4 py-4 px-3 mb-3"
            style={{
              border: "2px dashed rgba(21,128,61,0.4)",
              backgroundColor: "var(--brand-50)",
              cursor: procesando ? "not-allowed" : "pointer",
              opacity: procesando ? 0.6 : 1,
            }}
          >
            <div className="mb-2 text-brand">
              <FiUploadCloud size={36} />
            </div>
            <p className="fw-medium mb-1 small">{nombreArchivo || "Haz clic para elegir el archivo .sql exportado"}</p>
            <p className="small text-secondary mb-0">Solo archivos .sql generados por la app móvil</p>
            <input
              ref={inputRef}
              type="file"
              accept=".sql"
              className="d-none"
              disabled={procesando}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>

          {filas.length > 0 && resultados.length === 0 && !procesando && (
            <>
              <p className="small mb-3">
                Se detectaron <strong>{filas.length}</strong> pendiente(s) en el archivo. Se procesarán en orden, uno por
                uno.
                {filas.some((f) => !ACCIONES_SOPORTADAS.includes(f.action)) && (
                  <span className="text-warning d-block mt-1">
                    <FiAlertTriangle className="me-1" />
                    Algunas filas son de un tipo que este importador todavía no soporta (labores culturales, clima) —
                    quedarán marcadas con error y no afectarán al resto.
                  </span>
                )}
              </p>
              <button type="button" className="btn btn-brand rounded-3" onClick={handleImportarTodo}>
                <FiUploadCloud className="me-2" /> Importar {filas.length} pendiente(s)
              </button>
            </>
          )}

          {procesando && (
            <div className="mt-2">
              <div className="d-flex justify-content-between small text-secondary mb-1">
                <span>Procesando fila {indiceActual} de {filas.length}...</span>
              </div>
              <div className="progress rounded-3" style={{ height: "0.5rem" }}>
                <div
                  className="progress-bar bg-brand"
                  style={{ width: `${(indiceActual / filas.length) * 100}%`, transition: "width .3s" }}
                />
              </div>
            </div>
          )}

          {resultados.length > 0 && (
            <div className="mt-3">
              <p className="fw-medium mb-2">
                <span className="text-success">{totalOk} importada(s) correctamente</span>
                {totalError > 0 && <span className="text-danger ms-2">{totalError} con error</span>}
              </p>
              <div className="table-responsive" style={{ maxHeight: "24rem", overflowY: "auto" }}>
                <table className="table table-sm table-bordered small mb-0">
                  <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>
                      <th>#</th>
                      <th>Acción</th>
                      <th>Planta</th>
                      <th>Lote</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((r) => (
                      <tr key={r.fila}>
                        <td>{r.fila}</td>
                        <td>{r.accion}</td>
                        <td>{r.plantCode || "—"}</td>
                        <td>{r.loteCodigo || "—"}</td>
                        <td className={r.estado === "ok" ? "text-success" : "text-danger"}>
                          {r.estado === "ok" ? <FiCheckCircle className="me-1" /> : <FiXCircle className="me-1" />}
                          {r.mensaje}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalError > 0 && !procesando && (
                <button type="button" className="btn btn-outline-danger btn-sm rounded-3 mt-3" onClick={handleReintentarFallidas}>
                  Reintentar las {totalError} fila(s) con error
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </RequireAdmin>
  );
}
