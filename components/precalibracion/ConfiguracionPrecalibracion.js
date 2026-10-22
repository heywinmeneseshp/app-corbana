"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiGlobe, FiMapPin, FiPlus, FiRotateCcw, FiSearch, FiX } from "react-icons/fi";
import { getConfiguracion, guardarConfiguracion, restablecerConfigFinca } from "@/lib/precalibracion/api";

const MODALIDADES = [
  { id: "VIGENTE", titulo: "Vigente", detalle: "Se cosecha la misma semana de la precalibración." },
  { id: "ANTICIPADA", titulo: "Anticipada", detalle: "Se cosecha la semana siguiente." },
];

// Tarjeta de sección: título + ayuda + contenido.
function Seccion({ titulo, ayuda, children }) {
  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 h-100">
      <h3 className="h6 fw-bold mb-1">{titulo}</h3>
      {ayuda && <p className="small text-secondary mb-3">{ayuda}</p>}
      {children}
    </div>
  );
}

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
      <label className="form-label small fw-bold text-dark mb-0">{titulo}</label>
      <p className="small text-secondary mb-2">{ayuda}</p>
      <div className="input-group input-group-sm gap-1 mb-2" style={{ width: 170 }}>
        <input
          type={tipo === "numero" ? "number" : "text"}
          min={tipo === "numero" ? 8 : undefined}
          max={tipo === "numero" ? 12 : undefined}
          className="form-control rounded-1"
          placeholder={placeholder}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), agregar())}
        />
        <button type="button" className="btn btn-success rounded-1 d-inline-flex align-items-center justify-content-center p-0" style={{ width: 31, flex: "none" }} title="Agregar" onClick={agregar}>
          <FiPlus size={16} />
        </button>
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2">
        {valores.map((v) => (
          <span key={v} className="d-inline-flex align-items-center gap-1 rounded-1 bg-success bg-opacity-10 text-success ps-2 pe-1 fw-semibold small">
            {v}
            <button type="button" className="btn btn-link p-0 d-inline-flex text-success" title="Quitar" onClick={() => onChange(valores.filter((x) => x !== v))}>
              <FiX size={13} />
            </button>
          </span>
        ))}
      </div>
      {valores.length === 0 && <div className="small text-danger mt-2">Agrega al menos uno.</div>}
    </div>
  );
}

const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Configuración de Precalibración. Hay una configuración global y cada finca puede personalizar la suya (si no, usa la global):
// edades de cinta, valores del calibrador, modalidad (vigente/anticipada) y segundos de espera entre racimos en la app de campo.
export default function ConfiguracionPrecalibracion({ onCambio }) {
  const [datos, setDatos] = useState(null); // { global, fincas }
  const [seleccion, setSeleccion] = useState("global"); // "global" | uuid de finca
  const [busqueda, setBusqueda] = useState("");
  const [edades, setEdades] = useState([]);
  const [valores, setValores] = useState([]);
  const [segundos, setSegundos] = useState(10);
  const [modalidad, setModalidad] = useState("VIGENTE");
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
  const claveActual = actual ? JSON.stringify([seleccion, actual.edades, actual.valores, actual.segundosEspera, actual.modalidad]) : "";
  const [claveCargada, setClaveCargada] = useState("");
  if (actual && claveActual !== claveCargada) {
    setClaveCargada(claveActual);
    setEdades(actual.edades);
    setValores(actual.valores);
    setSegundos(actual.segundosEspera ?? 10);
    setModalidad(actual.modalidad || "VIGENTE");
  }

  const cambio = actual ? !iguales(edades, actual.edades) || !iguales(valores, actual.valores) || segundos !== (actual.segundosEspera ?? 10) || modalidad !== (actual.modalidad || "VIGENTE") : false;
  const segundosValidos = Number.isInteger(segundos) && segundos >= 0 && segundos <= 120;
  const valido = edades.length > 0 && valores.length > 0 && segundosValidos;

  function descartar() {
    setEdades(actual.edades);
    setValores(actual.valores);
    setSegundos(actual.segundosEspera ?? 10);
    setModalidad(actual.modalidad || "VIGENTE");
  }

  function elegir(id) {
    setSeleccion(id);
    setMensaje(null);
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      await guardarConfiguracion({ fincaId: seleccion === "global" ? null : seleccion, edades, valores, segundosEspera: segundos, modalidad });
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

  const fincasVisibles = datos.fincas.filter((f) => f.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));
  const esGlobal = seleccion === "global";

  return (
    <div className="row g-3">
      <div className="col-12 col-lg-3">
        <div className="card border-0 shadow-sm rounded-4 p-2">
          <button
            type="button"
            className={`btn text-start rounded-3 mb-2 d-flex align-items-center gap-2 ${esGlobal ? "btn-brand btn-brand-verde" : "btn-light"}`}
            onClick={() => elegir("global")}
          >
            <FiGlobe />
            <span className="flex-grow-1">
              <span className="d-block fw-semibold lh-sm">Global</span>
              <span className="d-block small opacity-75 lh-sm">Todas las fincas</span>
            </span>
          </button>

          <div className="position-relative mb-2 px-1">
            <FiSearch className="position-absolute text-secondary" style={{ left: 14, top: 10 }} />
            <input className="form-control form-control-sm rounded-1 ps-4" placeholder="Buscar finca" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>

          <div className="small text-secondary px-2 mb-1">Fincas ({fincasVisibles.length})</div>
          <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
            {fincasVisibles.map((f) => {
              const activa = seleccion === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`btn btn-sm w-100 text-start rounded-3 mb-1 d-flex align-items-center gap-2 ${activa ? "btn-brand btn-brand-verde" : "btn-light"}`}
                  onClick={() => elegir(f.id)}
                >
                  <FiMapPin className="flex-shrink-0" />
                  <span className="flex-grow-1 text-truncate">{f.nombre}</span>
                  <span className={`badge rounded-1 ${activa ? "text-bg-light" : f.personalizada ? "text-bg-success" : "bg-success bg-opacity-10 text-success"}`}>
                    {f.personalizada ? "Propia" : "Global"}
                  </span>
                </button>
              );
            })}
            {fincasVisibles.length === 0 && <div className="small text-secondary px-2 py-2">Sin resultados.</div>}
          </div>
        </div>
      </div>

      <div className="col-12 col-lg-9">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <h2 className="h5 fw-bold mb-0">{esGlobal ? "Configuración global" : actual.nombre}</h2>
          {!esGlobal && <span className={`badge rounded-1 ${actual.personalizada ? "text-bg-success" : "bg-success bg-opacity-10 text-success"}`}>{actual.personalizada ? "Configuración propia" : "Usa la global"}</span>}
        </div>
        <p className="small text-secondary mb-3">
          {esGlobal
            ? "Se aplica a todas las fincas que no tengan una configuración propia."
            : actual.personalizada
              ? "Esta finca usa su propia configuración."
              : "Esta finca usa la configuración global. Si guardas cambios aquí, pasa a tener una propia."}
        </p>

        <div className="row g-3 mb-3">
          <div className="col-12 col-xl-6">
            <Seccion titulo="Qué se precalibra" ayuda="Define las columnas de las tablas y las cintas que ve el precalibrador en la app de campo.">
              <ListaChips
                titulo="Edades de cinta"
                ayuda="De 8 a 12 semanas. El color y la semana de embolse salen de la edad."
                valores={edades}
                onChange={setEdades}
                tipo="numero"
                placeholder="Edad (8 a 12)"
              />
              <ListaChips titulo="Valores del calibrador" ayuda="Medidas del calibrador físico que se entregan al colaborador." valores={valores} onChange={setValores} tipo="texto" placeholder="Valor (ej. 34)" />
            </Seccion>
          </div>

          <div className="col-12 col-xl-6">
            <Seccion titulo="Cómo se trabaja en campo" ayuda="La app de campo usa estos ajustes al iniciar y durante la sesión.">
              <label className="form-label small fw-bold text-dark mb-1">Modalidad de la precalibración</label>
              <div className="row g-2 mb-4">
                {MODALIDADES.map((m) => {
                  const activa = modalidad === m.id;
                  return (
                    <div key={m.id} className="col-6">
                      <button
                        type="button"
                        className={`w-100 h-100 text-start rounded-3 border p-3 d-flex gap-2 ${activa ? "border-success bg-success bg-opacity-10" : "bg-white"}`}
                        style={{ borderWidth: activa ? 2 : 1 }}
                        onClick={() => setModalidad(m.id)}
                      >
                        <span className={`rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0 ${activa ? "bg-success text-white" : "border"}`} style={{ width: 20, height: 20, marginTop: 2 }}>
                          {activa && <FiCheck size={12} />}
                        </span>
                        <span>
                          <span className="d-block fw-semibold">{m.titulo}</span>
                          <span className="d-block small text-secondary">{m.detalle}</span>
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <label className="form-label small fw-bold text-dark mb-0">Espera entre racimos</label>
              <p className="small text-secondary mb-2">Tras contar un racimo, las cintas se bloquean este tiempo con cuenta regresiva. Evita contar dos veces el mismo racimo. Con 0 no hay espera.</p>
              <div className="input-group input-group-sm" style={{ width: 120 }}>
                <input
                  type="number"
                  min={0}
                  max={120}
                  className={`form-control text-center fw-semibold rounded-1 ${segundosValidos ? "" : "is-invalid"}`}
                  value={Number.isNaN(segundos) ? "" : segundos}
                  onChange={(e) => setSegundos(e.target.value === "" ? NaN : Number(e.target.value))}
                />
                <span className="input-group-text rounded-1 ms-1">s</span>
              </div>
              {!segundosValidos && <div className="small text-danger mt-2">Usa un número entero de 0 a 120.</div>}
            </Seccion>
          </div>
        </div>

        {mensaje && <div className={`alert alert-${mensaje.tipo} py-2 small`}>{mensaje.texto}</div>}

        <div className="card border-0 shadow-sm rounded-4 px-3 py-2 d-flex flex-row flex-wrap align-items-center gap-3 position-sticky" style={{ bottom: 12, zIndex: 5 }}>
          <div className="d-flex align-items-center gap-2 small">
            <span className="rounded-circle d-inline-block" style={{ width: 9, height: 9, backgroundColor: cambio ? "#f59e0b" : "#22c55e" }} />
            <span className="text-secondary">{cambio ? "Tienes cambios sin guardar" : "Todo guardado"}</span>
          </div>
          {!esGlobal && actual.personalizada && (
            <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none d-inline-flex align-items-center gap-1" onClick={usarGlobal}>
              <FiRotateCcw size={12} /> Usar la configuración global
            </button>
          )}
          <div className="ms-auto d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" disabled={!cambio || guardando} onClick={descartar}>
              Descartar
            </button>
            <button type="button" className="btn btn-success btn-sm rounded-1 px-4" disabled={!cambio || !valido || guardando} onClick={guardar}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
