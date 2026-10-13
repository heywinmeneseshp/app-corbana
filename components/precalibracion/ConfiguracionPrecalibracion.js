"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiRotateCcw, FiX } from "react-icons/fi";
import { getConfiguracion, guardarConfiguracion, restablecerConfigFinca } from "@/lib/precalibracion/api";

// Chips editables: lista de valores con "x" para quitar y un campo para agregar.
function ListaChips({ titulo, ayuda, valores, onChange, tipo, placeholder }) {
  const [texto, setTexto] = useState("");

  function agregar() {
    const limpio = texto.trim();
    if (!limpio) return;
    if (tipo === "numero") {
      const n = Number(limpio);
      if (!Number.isInteger(n) || n < 8 || n > 12 || valores.includes(n)) return;
      onChange([...valores, n].sort((a, b) => a - b));
    } else {
      if (valores.includes(limpio) || limpio.length > 10) return;
      onChange([...valores, limpio].sort((a, b) => Number(a) - Number(b)));
    }
    setTexto("");
  }

  return (
    <div className="mb-4">
      <label className="form-label small fw-medium mb-1">{titulo}</label>
      <p className="small text-secondary mb-2">{ayuda}</p>
      <div className="d-flex flex-wrap gap-2 mb-2">
        {valores.length === 0 && <span className="small text-danger">Agrega al menos uno.</span>}
        {valores.map((v) => (
          <span key={v} className="badge rounded-pill text-bg-light border d-inline-flex align-items-center gap-1 py-2 px-3 fs-6 fw-medium">
            {v}
            <button type="button" className="btn btn-link p-0 d-inline-flex text-secondary" title="Quitar" onClick={() => onChange(valores.filter((x) => x !== v))}>
              <FiX size={14} />
            </button>
          </span>
        ))}
      </div>
      <div className="d-flex gap-2" style={{ maxWidth: 280 }}>
        <input
          type={tipo === "numero" ? "number" : "text"}
          min={tipo === "numero" ? 8 : undefined}
          max={tipo === "numero" ? 12 : undefined}
          className="form-control form-control-sm rounded-3"
          placeholder={placeholder}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), agregar())}
        />
        <button type="button" className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1" onClick={agregar}>
          <FiPlus /> Agregar
        </button>
      </div>
    </div>
  );
}

const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Configuración de Precalibración: qué edades de cinta se precalibran y qué valores de calibrador existen. Hay una
// configuración global y cada finca puede personalizar la suya (si no, usa la global).
export default function ConfiguracionPrecalibracion({ onCambio }) {
  const [datos, setDatos] = useState(null); // { global, fincas }
  const [seleccion, setSeleccion] = useState("global"); // "global" | uuid de finca
  const [edades, setEdades] = useState([]);
  const [valores, setValores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo, texto }
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setDatos(await getConfiguracion());
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Al elegir otro ámbito (o recargar) se muestran sus valores vigentes.
  const actual = datos ? (seleccion === "global" ? { ...datos.global, personalizada: true, nombre: "Global" } : datos.fincas.find((f) => f.id === seleccion)) : null;
  const claveActual = actual ? JSON.stringify([seleccion, actual.edades, actual.valores]) : "";
  const [claveCargada, setClaveCargada] = useState("");
  if (actual && claveActual !== claveCargada) {
    setClaveCargada(claveActual);
    setEdades(actual.edades);
    setValores(actual.valores);
  }

  const cambio = actual ? !iguales(edades, actual.edades) || !iguales(valores, actual.valores) : false;
  const valido = edades.length > 0 && valores.length > 0;

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      await guardarConfiguracion({ fincaId: seleccion === "global" ? null : seleccion, edades, valores });
      setMensaje({ tipo: "success", texto: seleccion === "global" ? "Configuración global guardada." : `Configuración de ${actual.nombre} guardada.` });
      await cargar();
      onCambio?.();
    } catch (err) {
      setMensaje({ tipo: "danger", texto: err.message });
    } finally {
      setGuardando(false);
    }
  }

  async function usarGlobal() {
    if (!window.confirm(`¿Volver a usar la configuración global en ${actual.nombre}?`)) return;
    setMensaje(null);
    try {
      await restablecerConfigFinca(seleccion);
      setMensaje({ tipo: "success", texto: `${actual.nombre} vuelve a usar la configuración global.` });
      await cargar();
      onCambio?.();
    } catch (err) {
      setMensaje({ tipo: "danger", texto: err.message });
    }
  }

  if (error) return <div className="alert alert-danger py-2 small">{error}</div>;
  if (!datos) return <p className="text-secondary">Cargando...</p>;

  return (
    <div className="row g-3">
      <div className="col-12 col-md-4 col-lg-3">
        <div className="card border-0 shadow-sm rounded-4 p-2">
          <button
            type="button"
            className={`btn btn-sm text-start rounded-3 mb-1 ${seleccion === "global" ? "btn-brand" : "btn-light"}`}
            onClick={() => {
              setSeleccion("global");
              setMensaje(null);
            }}
          >
            Global (todas las fincas)
          </button>
          <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
            {datos.fincas.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`btn btn-sm w-100 text-start rounded-3 mb-1 d-flex justify-content-between align-items-center ${seleccion === f.id ? "btn-brand" : "btn-light"}`}
                onClick={() => {
                  setSeleccion(f.id);
                  setMensaje(null);
                }}
              >
                <span>{f.nombre}</span>
                {f.personalizada && <span className={`badge rounded-pill ${seleccion === f.id ? "text-bg-light" : "text-bg-success"}`}>Propia</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="col-12 col-md-8 col-lg-9">
        <div className="card border-0 shadow-sm rounded-4 p-3">
          <h2 className="h5 fw-bold mb-1">{seleccion === "global" ? "Configuración global" : actual.nombre}</h2>
          <p className="small text-secondary mb-3">
            {seleccion === "global"
              ? "Se aplica a todas las fincas que no tengan una configuración propia."
              : actual.personalizada
                ? "Esta finca usa su propia configuración."
                : "Esta finca usa la configuración global. Si guardas cambios aquí, pasa a tener una propia."}
          </p>

          <ListaChips
            titulo="Edades que se precalibran"
            ayuda="Solo de 8 a 12. Cada edad es una columna de la tabla y un botón en la app de campo (el color y la semana de embolse salen de la edad)."
            valores={edades}
            onChange={setEdades}
            tipo="numero"
            placeholder="Edad (8 a 12)"
          />
          <ListaChips
            titulo="Valores del calibrador"
            ayuda="Medidas del calibrador físico que se entregan al colaborador."
            valores={valores}
            onChange={setValores}
            tipo="texto"
            placeholder="Valor (ej. 34)"
          />

          {mensaje && <div className={`alert alert-${mensaje.tipo} py-2 small`}>{mensaje.texto}</div>}

          <div className="d-flex align-items-center gap-3">
            <button type="button" className="btn btn-brand btn-brand-verde btn-sm rounded-3" disabled={!cambio || !valido || guardando} onClick={guardar}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            {seleccion !== "global" && actual.personalizada && (
              <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none d-inline-flex align-items-center gap-1" onClick={usarGlobal}>
                <FiRotateCcw size={12} /> Usar la configuración global
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
