"use client";

import { Fragment, useMemo, useState } from "react";
import { FiAlertTriangle, FiChevronDown, FiChevronRight, FiSearch, FiSmartphone } from "react-icons/fi";

// Matriz de permisos de un rol: secciones y pantallas en el mismo orden del menú lateral (catálogo de la API,
// GET /permisos/catalogo). Trabaja con códigos de permiso (`seleccion`: Set) y aplica las reglas para que no queden
// permisos sueltos: una acción marca el acceso a la pantalla y su "Ver"; quitar el acceso limpia la pantalla; el permiso
// de la sección del menú se marca solo cuando alguna de sus pantallas tiene acceso.

export const COLUMNAS = [
  { id: "ver", nombre: "Ver" },
  { id: "crear", nombre: "Crear" },
  { id: "editar", nombre: "Editar" },
  { id: "eliminar", nombre: "Eliminar" },
];

export const codigosDePantalla = (p) => [
  ...(p.acceso ? [p.acceso] : []),
  ...p.filas.flatMap((f) => COLUMNAS.map((c) => f[c.id]).filter(Boolean)),
  ...(p.especiales || []).map((e) => e.codigo),
  ...(p.acompanantes || []),
];

const codigosDeFila = (f) => COLUMNAS.map((c) => f[c.id]).filter(Boolean);
const tieneAcceso = (p, sel) => (p.acceso ? sel.has(p.acceso) : codigosDePantalla(p).some((c) => sel.has(c)));
const normalizar = (t) =>
  (t || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// El permiso de cada sección del menú (menu.maestros, menu.racimos...) se deriva de sus pantallas.
export function recalcularSecciones(secciones, sel) {
  const n = new Set(sel);
  for (const s of secciones) {
    if (!s.codigo) continue;
    if (s.pantallas.some((p) => p.acceso && n.has(p.acceso))) n.add(s.codigo);
    else n.delete(s.codigo);
  }
  return n;
}

function Casilla({ codigo, sel, original, existe, disabled, onChange, titulo }) {
  if (!codigo) return <span className="text-secondary opacity-50">—</span>;
  if (!existe) return <span className="text-secondary opacity-50" title={`El permiso ${codigo} no existe en la base`}>?</span>;
  const marcado = sel.has(codigo);
  const cambio = marcado !== original.has(codigo);
  return (
    <span className="d-inline-flex rounded-2 px-1" style={cambio ? { backgroundColor: "#fef3c7" } : undefined} title={titulo || codigo}>
      <input type="checkbox" className="form-check-input m-0" checked={marcado} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </span>
  );
}

export default function PermisosMatriz({ catalogo, seleccion, original, onChange, disabled = false }) {
  const { secciones, permisos } = catalogo;
  const [busqueda, setBusqueda] = useState("");
  const [abiertas, setAbiertas] = useState(() => new Set(secciones.filter((s) => s.pantallas.some((p) => tieneAcceso(p, seleccion))).map((s) => s.id)));

  const existe = (c) => Boolean(permisos[c]);
  const aplicar = (fn) => {
    const n = new Set(seleccion);
    fn(n);
    onChange(recalcularSecciones(secciones, n));
  };
  const darAcceso = (n, p) => {
    if (p.acceso && existe(p.acceso)) n.add(p.acceso);
    for (const c of p.acompanantes || []) if (existe(c)) n.add(c);
  };

  const cambiarAcceso = (p, on) =>
    aplicar((n) => {
      if (on) darAcceso(n, p);
      else for (const c of codigosDePantalla(p)) n.delete(c);
    });

  const cambiarAccion = (p, fila, col, on) =>
    aplicar((n) => {
      const codigo = fila[col];
      if (on) {
        n.add(codigo);
        darAcceso(n, p);
        if (col !== "ver" && fila.ver && existe(fila.ver)) n.add(fila.ver);
      } else if (col === "ver") {
        for (const c of codigosDeFila(fila)) n.delete(c); // sin "Ver" no tiene sentido crear/editar/eliminar
      } else {
        n.delete(codigo);
      }
    });

  const cambiarEspecial = (p, e, on) => {
    if (on && e.sensible && !window.confirm(`«${e.etiqueta}» es un permiso delicado. ¿Dárselo a este rol?`)) return;
    aplicar((n) => {
      if (on) {
        n.add(e.codigo);
        darAcceso(n, p);
      } else n.delete(e.codigo);
    });
  };

  // Marcar sección: todo menos los especiales delicados (esos se dan uno a uno, a conciencia).
  const marcarSeccion = (s, on) =>
    aplicar((n) => {
      for (const p of s.pantallas) {
        if (!on) {
          for (const c of codigosDePantalla(p)) n.delete(c);
          continue;
        }
        darAcceso(n, p);
        for (const f of p.filas) for (const c of codigosDeFila(f)) if (existe(c)) n.add(c);
        for (const e of p.especiales || []) if (!e.sensible && existe(e.codigo)) n.add(e.codigo);
      }
    });

  const q = normalizar(busqueda.trim());
  const coincide = (s, p) =>
    !q ||
    [s.nombre, p.nombre, p.ayuda, ...p.filas.map((f) => f.nombre), ...(p.especiales || []).map((e) => e.etiqueta)].some((t) => normalizar(t).includes(q));

  const resumen = useMemo(() => {
    const pantallas = secciones.flatMap((s) => s.pantallas);
    const conAcceso = pantallas.filter((p) => p.acceso && seleccion.has(p.acceso)).length;
    const cambios = [...new Set([...seleccion, ...original])].filter((c) => seleccion.has(c) !== original.has(c)).length;
    return { permisos: seleccion.size, conAcceso, total: pantallas.filter((p) => p.acceso).length, cambios };
  }, [secciones, seleccion, original]);

  const alternarSeccion = (id) =>
    setAbiertas((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div className="input-group input-group-sm" style={{ maxWidth: "20rem" }}>
          <span className="input-group-text bg-white">
            <FiSearch />
          </span>
          <input
            type="search"
            className="form-control"
            placeholder="Buscar pantalla o permiso..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <span className="small text-secondary">
          <strong className="text-dark">{resumen.conAcceso}</strong> de {resumen.total} pantallas · <strong className="text-dark">{resumen.permisos}</strong>{" "}
          permisos
          {resumen.cambios > 0 && (
            <span className="badge rounded-pill ms-2" style={{ backgroundColor: "#fef3c7", color: "#b45309" }}>
              {resumen.cambios} cambio{resumen.cambios === 1 ? "" : "s"} sin guardar
            </span>
          )}
        </span>
        <div className="ms-auto d-flex gap-2">
          <button type="button" className="btn btn-sm btn-link p-0" onClick={() => setAbiertas(new Set(secciones.map((s) => s.id)))}>
            Expandir todo
          </button>
          <button type="button" className="btn btn-sm btn-link p-0" onClick={() => setAbiertas(new Set())}>
            Contraer todo
          </button>
        </div>
      </div>

      {secciones.map((s) => {
        const pantallas = s.pantallas.filter((p) => coincide(s, p));
        if (!pantallas.length) return null;
        const abierta = Boolean(q) || abiertas.has(s.id);
        const conAcceso = s.pantallas.filter((p) => tieneAcceso(p, seleccion)).length;
        return (
          <div key={s.id} className="card border-0 shadow-sm rounded-4 mb-2 overflow-hidden">
            <div className="bg-brand text-white px-3 py-2 d-flex align-items-center gap-2" role="button" onClick={() => alternarSeccion(s.id)}>
              {abierta ? <FiChevronDown /> : <FiChevronRight />}
              <span className="fw-semibold small">{s.nombre}</span>
              <span className="small opacity-75">
                {conAcceso} de {s.pantallas.length} pantalla{s.pantallas.length === 1 ? "" : "s"}
              </span>
              {!disabled && (
                <span className="ms-auto d-flex gap-3 small" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="btn btn-link btn-sm p-0 text-white text-decoration-none" onClick={() => marcarSeccion(s, true)} title="Marca todo menos los permisos delicados (⚠)">
                    Marcar todo
                  </button>
                  <button type="button" className="btn btn-link btn-sm p-0 text-white text-decoration-none opacity-75" onClick={() => marcarSeccion(s, false)}>
                    Quitar todo
                  </button>
                </span>
              )}
            </div>
            {abierta && (
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle" style={{ fontSize: "0.8rem" }}>
                  <thead className="table-light">
                    <tr>
                      <th className="fw-medium ps-3">Pantalla</th>
                      <th className="fw-medium text-center" style={{ width: "5.5rem" }}>
                        Acceso
                      </th>
                      {COLUMNAS.map((c) => (
                        <th key={c.id} className="fw-medium text-center" style={{ width: "5rem" }}>
                          {c.nombre}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pantallas.map((p) => {
                      const acceso = tieneAcceso(p, seleccion);
                      const unaFila = p.filas.length === 1 && !p.filas[0].nombre;
                      const filaCeldas = (f) =>
                        COLUMNAS.map((c) => (
                          <td key={c.id} className="text-center">
                            <Casilla
                              codigo={f[c.id]}
                              sel={seleccion}
                              original={original}
                              existe={existe(f[c.id])}
                              disabled={disabled}
                              titulo={permisos[f[c.id]]?.nombre}
                              onChange={(on) => cambiarAccion(p, f, c.id, on)}
                            />
                          </td>
                        ));
                      return (
                        <Fragment key={p.nombre}>
                          <tr style={{ backgroundColor: acceso ? undefined : "#fafafa" }}>
                            <td className="ps-3">
                              <span className={acceso ? "fw-semibold" : "text-secondary"}>{p.nombre}</span>
                              {p.app === "campo" && (
                                <span className="badge rounded-pill text-bg-light border ms-2 fw-normal" title="También se usa en la app de campo">
                                  <FiSmartphone size={10} /> App de campo
                                </span>
                              )}
                              {p.ayuda && <div className="text-secondary" style={{ fontSize: "0.72rem" }}>{p.ayuda}</div>}
                            </td>
                            <td className="text-center">
                              {p.acceso ? (
                                <Casilla
                                  codigo={p.acceso}
                                  sel={seleccion}
                                  original={original}
                                  existe={existe(p.acceso)}
                                  disabled={disabled}
                                  titulo="Ver la pantalla en el menú"
                                  onChange={(on) => cambiarAcceso(p, on)}
                                />
                              ) : (
                                <span className="text-secondary opacity-50">—</span>
                              )}
                            </td>
                            {unaFila ? filaCeldas(p.filas[0]) : COLUMNAS.map((c) => <td key={c.id} />)}
                          </tr>
                          {!unaFila &&
                            p.filas.map((f) => (
                              <tr key={f.nombre} style={{ backgroundColor: acceso ? undefined : "#fafafa" }}>
                                <td className="ps-4 text-secondary">↳ {f.nombre}</td>
                                <td />
                                {filaCeldas(f)}
                              </tr>
                            ))}
                          {(p.especiales || []).length > 0 && (
                            <tr style={{ backgroundColor: acceso ? undefined : "#fafafa" }}>
                              <td colSpan={2 + COLUMNAS.length} className="ps-4 pt-0 pb-2 border-bottom">
                                <div className="d-flex flex-wrap gap-3">
                                  {p.especiales.map((e) => (
                                    <label key={e.codigo} className="d-inline-flex align-items-center gap-1 text-secondary" title={permisos[e.codigo]?.nombre || e.codigo}>
                                      <Casilla
                                        codigo={e.codigo}
                                        sel={seleccion}
                                        original={original}
                                        existe={existe(e.codigo)}
                                        disabled={disabled}
                                        titulo={permisos[e.codigo]?.nombre}
                                        onChange={(on) => cambiarEspecial(p, e, on)}
                                      />
                                      <span style={{ color: seleccion.has(e.codigo) ? "#111827" : undefined }}>{e.etiqueta}</span>
                                      {e.sensible && <FiAlertTriangle size={12} style={{ color: "#d97706" }} title="Permiso delicado" />}
                                    </label>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      {q && secciones.every((s) => !s.pantallas.some((p) => coincide(s, p))) && (
        <p className="text-secondary small text-center py-3 mb-0">Ninguna pantalla coincide con «{busqueda}».</p>
      )}
    </div>
  );
}
