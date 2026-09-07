"use client";

// Checklist desplegable para elegir QUÉ comparar en un gráfico de reporte:
// fincas sueltas y/o Grupos de Finca completos, cada uno marcable por
// separado (no un <select> de una sola finca). No llama a ninguna API —
// recibe la lista de fincas ya cargada por la página (cada finca ya trae su
// `grupoFinca` embebido, ver finca.repository.js) y arma los grupos
// disponibles agrupando client-side, sin pedir /grupos-finca aparte (ese
// endpoint exige el permiso puntual grupo_finca.ver, que no todo el que ve
// Reportes tiene).
import { useMemo, useRef, useState } from "react";
import { FiChevronDown, FiCheck } from "react-icons/fi";
import { GiFarmTractor } from "react-icons/gi";

export default function SelectorObjetivos({ fincas, seleccionados, onChange, sinEtiqueta = false }) {
  const [abierto, setAbierto] = useState(false);
  const wrapRef = useRef(null);

  const grupos = useMemo(() => {
    const map = new Map();
    for (const f of fincas) {
      if (!f.grupoFinca) continue;
      if (!map.has(f.grupoFinca.uuid)) {
        map.set(f.grupoFinca.uuid, { uuid: f.grupoFinca.uuid, nombre: f.grupoFinca.nombre, fincaIds: [], fincaUuids: [] });
      }
      const g = map.get(f.grupoFinca.uuid);
      g.fincaIds.push(f.id);
      g.fincaUuids.push(f.uuid);
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [fincas]);

  const fincasSueltas = useMemo(
    () => [...fincas].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true })),
    [fincas],
  );

  const seleccionadosSet = useMemo(() => new Set(seleccionados.map((s) => `${s.tipo}-${s.uuid}`)), [seleccionados]);

  function toggle(item) {
    const key = `${item.tipo}-${item.uuid}`;
    if (seleccionadosSet.has(key)) {
      onChange(seleccionados.filter((s) => `${s.tipo}-${s.uuid}` !== key));
    } else {
      onChange([...seleccionados, item]);
    }
  }

  function cerrarSiClickAfuera(e) {
    if (wrapRef.current && !wrapRef.current.contains(e.target)) {
      setAbierto(false);
      document.removeEventListener("mousedown", cerrarSiClickAfuera);
    }
  }

  function abrir() {
    setAbierto(true);
    document.addEventListener("mousedown", cerrarSiClickAfuera);
  }

  const etiqueta =
    seleccionados.length === 0
      ? "Todas las fincas"
      : seleccionados.length === 1
        ? seleccionados[0].nombre
        : `${seleccionados.length} seleccionados`;

  return (
    <div className="position-relative" ref={wrapRef}>
      {!sinEtiqueta && <label className="form-label small fw-medium mb-1 d-block">Fincas / Grupos</label>}
      <button
        type="button"
        className={`btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2 justify-content-between ${sinEtiqueta ? "w-100" : ""}`}
        style={{ minWidth: sinEtiqueta ? undefined : "14rem" }}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
      >
        <span className="text-truncate">{etiqueta}</span>
        <FiChevronDown />
      </button>

      {abierto && (
        <div
          className="card border-0 shadow-lg rounded-3 p-2 position-absolute"
          style={{ top: "100%", left: 0, zIndex: 1060, width: "20rem", maxHeight: "22rem", overflowY: "auto" }}
        >
          {seleccionados.length > 0 && (
            <button type="button" className="btn btn-sm btn-link text-danger p-0 mb-2" onClick={() => onChange([])}>
              Limpiar selección
            </button>
          )}

          {grupos.length > 0 && (
            <>
              <div className="text-secondary fw-semibold px-1" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Grupos de Finca
              </div>
              {grupos.map((g) => {
                const item = { tipo: "grupo", uuid: g.uuid, nombre: g.nombre, fincaIds: g.fincaIds, fincaUuids: g.fincaUuids };
                const checked = seleccionadosSet.has(`grupo-${g.uuid}`);
                return (
                  <label key={g.uuid} className="d-flex align-items-center gap-2 px-1 py-1 rounded-2 opcion-fila" style={{ cursor: "pointer", fontSize: "0.8125rem" }}>
                    <input type="checkbox" className="form-check-input m-0" checked={checked} onChange={() => toggle(item)} />
                    <GiFarmTractor className="text-secondary" />
                    <span className="flex-grow-1">{g.nombre}</span>
                    {checked && <FiCheck className="text-success" />}
                  </label>
                );
              })}
              <hr className="my-2" />
            </>
          )}

          <div className="text-secondary fw-semibold px-1" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Fincas
          </div>
          {fincasSueltas.map((f) => {
            const item = { tipo: "finca", uuid: f.uuid, nombre: f.nombre, fincaIds: [f.id], fincaUuids: [f.uuid] };
            const checked = seleccionadosSet.has(`finca-${f.uuid}`);
            return (
              <label key={f.uuid} className="d-flex align-items-center gap-2 px-1 py-1 rounded-2 opcion-fila" style={{ cursor: "pointer", fontSize: "0.8125rem" }}>
                <input type="checkbox" className="form-check-input m-0" checked={checked} onChange={() => toggle(item)} />
                <span className="text-secondary" style={{ width: "2.5rem" }}>{f.codigo}</span>
                <span className="flex-grow-1 text-truncate">{f.nombre}</span>
                {checked && <FiCheck className="text-success" />}
              </label>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .opcion-fila:hover {
          background-color: #f1f5f9;
        }
      `}</style>
    </div>
  );
}
