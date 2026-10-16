"use client";

// Importación de perímetros desde un .kmz/.kml con varias fincas y lotes:
// se lee el archivo, se preasigna cada carpeta a una finca y cada polígono
// "Lote N" a su lote por nombre, y el usuario corrige/completa lo que no
// coincida (desplegables) antes de guardar. Nada se escribe hasta confirmar.
import { useState } from "react";
import { FiUploadCloud } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import { leerTextoKml, parseKmlJerarquia, normalizarNombre, numeroDeLote, NOMBRES_CATEGORIA } from "@/lib/kmz";

// Finca de la app cuyo nombre coincide con el de la carpeta (sin tildes ni
// mayúsculas; acepta que uno contenga al otro: "La Palma" ↔ "PALMA").
function buscarFinca(fincas, carpeta) {
  const c = normalizarNombre(carpeta);
  return (
    fincas.find((f) => normalizarNombre(f.nombre) === c) ||
    fincas.find((f) => c && (normalizarNombre(f.nombre).includes(c) || c.includes(normalizarNombre(f.nombre)))) ||
    null
  );
}

function asignarAuto(carpeta, lotesApp) {
  const poligonoFinca =
    carpeta.finca.find((p) => normalizarNombre(p.nombre) === normalizarNombre(carpeta.carpeta)) ||
    carpeta.finca.find((p) => normalizarNombre(p.nombre) === normalizarNombre(`finca ${carpeta.carpeta}`)) ||
    (carpeta.finca.length === 1 ? carpeta.finca[0] : null);
  const usados = new Set();
  const lotesMap = {};
  for (const p of carpeta.lotes) {
    const n = numeroDeLote(p.nombre);
    const lote = n !== null ? lotesApp.find((l) => l.estado && !l.deletedAt && Number(l.nombre) === n && !usados.has(l.uuid)) : null;
    if (lote) usados.add(lote.uuid);
    lotesMap[p.id] = lote ? lote.uuid : "";
  }
  return { perimFinca: poligonoFinca ? poligonoFinca.id : "", lotesMap };
}

// Capas marcadas por defecto: todas menos los puntos sueltos.
const capasPorDefecto = (carpeta) => Object.fromEntries(carpeta.capas.map((k) => [k.categoria, k.categoria !== "PUNTO"]));

// Vía de cable llamada "Lote 3" / "Cable lote 2" → uuid del lote 3 / 2.
function loteDeVia(nombre, lotesApp) {
  const m = /lote\s*0*(\d+)/i.exec(nombre || "");
  if (!m) return null;
  return lotesApp.find((l) => l.estado && !l.deletedAt && Number(l.nombre) === Number(m[1]))?.uuid || null;
}

export default function ImportarKmzModal({ onClose, onDone }) {
  const [paso, setPaso] = useState("archivo"); // archivo | revisar | guardando | listo
  const [error, setError] = useState("");
  const [fincasApp, setFincasApp] = useState([]);
  const [carpetas, setCarpetas] = useState([]); // [{ ...parseado, fincaUuid, lotesApp, perimFinca, lotes }]
  const [resultado, setResultado] = useState(null);

  async function cargarLotes(fincaUuid) {
    if (!fincaUuid) return [];
    const res = await apiFetch(`/fincas/${fincaUuid}/lotes?limit=100`);
    return res.items || [];
  }

  async function handleArchivo(file) {
    if (!file) return;
    setError("");
    try {
      const [texto, fincasRes] = await Promise.all([leerTextoKml(file), apiFetch("/fincas?limit=100")]);
      const parseado = parseKmlJerarquia(texto);
      if (parseado.length === 0) throw new Error("No se encontraron fincas con polígonos en el archivo.");
      setFincasApp(fincasRes.items || []);
      const listas = [];
      for (const c of parseado) {
        const finca = buscarFinca(fincasRes.items || [], c.carpeta);
        const lotesApp = finca ? await cargarLotes(finca.uuid) : [];
        listas.push({ ...c, fincaUuid: finca?.uuid || "", lotesApp, capasSel: capasPorDefecto(c), ...asignarAuto(c, lotesApp) });
      }
      setCarpetas(listas);
      setPaso("revisar");
    } catch (err) {
      setError(err.message);
    }
  }

  function actualizar(idx, cambios) {
    setCarpetas((prev) => prev.map((c, i) => (i === idx ? { ...c, ...cambios } : c)));
  }

  async function cambiarFinca(idx, fincaUuid) {
    const lotesApp = await cargarLotes(fincaUuid);
    setCarpetas((prev) => prev.map((c, i) => (i === idx ? { ...c, fincaUuid, lotesApp, ...asignarAuto(c, lotesApp) } : c)));
  }

  function asignarLote(idx, polyId, loteUuid) {
    setCarpetas((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        // Un lote recibe un solo polígono: si ya estaba en otro, ese queda sin asignar.
        const lotesMap = Object.fromEntries(Object.entries(c.lotesMap).map(([k, v]) => [k, loteUuid && v === loteUuid ? "" : v]));
        lotesMap[polyId] = loteUuid;
        return { ...c, lotesMap };
      }),
    );
  }

  // Lo que se va a guardar (para el resumen y para el guardado).
  const totalFincas = carpetas.filter((c) => c.fincaUuid && c.perimFinca).length;
  const totalCapas = carpetas.reduce(
    (a, c) => a + (c.fincaUuid ? c.capas.filter((k) => c.capasSel[k.categoria]).reduce((n, k) => n + k.elementos.length, 0) : 0),
    0,
  );
  const totalLotes = carpetas.reduce((a, c) => a + (c.fincaUuid ? Object.values(c.lotesMap).filter(Boolean).length : 0), 0);

  async function guardar() {
    setPaso("guardando");
    const errores = [];
    let fincasOk = 0;
    let lotesOk = 0;
    let capasOk = 0;
    for (const c of carpetas) {
      if (!c.fincaUuid) continue;
      const poligonoFinca = c.finca.find((p) => p.id === c.perimFinca);
      if (poligonoFinca) {
        try {
          await apiFetch(`/fincas/${c.fincaUuid}`, { method: "PUT", body: JSON.stringify({ perimetro: poligonoFinca.perimetro }) });
          fincasOk++;
        } catch (err) {
          errores.push(`${c.carpeta} (finca): ${err.message}`);
        }
      }
      for (const [pid, loteUuid] of Object.entries(c.lotesMap)) {
        if (!loteUuid) continue;
        const poli = c.lotes.find((p) => p.id === pid);
        if (!poli) continue;
        try {
          await apiFetch(`/lotes/${loteUuid}`, { method: "PUT", body: JSON.stringify({ perimetro: poli.perimetro }) });
          lotesOk++;
        } catch (err) {
          errores.push(`${c.carpeta} / ${poli.nombre}: ${err.message}`);
        }
      }
      for (const k of c.capas) {
        if (!c.capasSel[k.categoria]) continue;
        try {
          const elementos = k.elementos.map((e) => ({
            nombre: e.nombre || null,
            subtipo: e.subtipo || null,
            loteUuid: k.categoria === "VIA_CABLE" ? loteDeVia(e.nombre, c.lotesApp) : null,
            geometria: e.geometria,
            coordenadas: e.coordenadas,
          }));
          await apiFetch(`/fincas/${c.fincaUuid}/capas-mapa`, { method: "PUT", body: JSON.stringify({ categoria: k.categoria, elementos }) });
          capasOk += elementos.length;
        } catch (err) {
          errores.push(`${c.carpeta} / ${NOMBRES_CATEGORIA[k.categoria]}: ${err.message}`);
        }
      }
    }
    setResultado({ fincasOk, lotesOk, capasOk, errores });
    setPaso("listo");
    onDone?.();
  }

  return (
    <ModalShell title="Importar KMZ" onClose={onClose} size="xl" height="90vh">
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {paso === "archivo" && (
        <div className="text-center py-4">
          <p className="text-secondary small">
            Sube un archivo con las fincas como carpetas y, dentro de cada una, una subcarpeta “Lotes” con polígonos
            llamados “Lote 1”, “Lote 2”… Antes de guardar podrás revisar y corregir a qué finca y lote va cada polígono.
          </p>
          <label className="btn btn-brand btn-sm rounded-3 d-inline-flex align-items-center gap-2">
            <FiUploadCloud /> Elegir archivo
            <input type="file" accept=".kmz,.kml" className="d-none" onChange={(e) => handleArchivo(e.target.files?.[0])} />
          </label>
        </div>
      )}

      {paso === "revisar" && (
        <>
          <p className="small text-secondary">
            Se guardarán <strong>{totalFincas}</strong> perímetros de finca y <strong>{totalLotes}</strong> de lote, más <strong>{totalCapas}</strong> elementos de mapa (vías, canales…). Lo que
            elijas “— no importar —” se omite. Si la finca o el lote ya tenían perímetro, se reemplaza.
          </p>
          {carpetas.map((c, idx) => (
            <div key={c.carpeta + idx} className="border rounded-3 p-3 mb-3">
              <div className="d-flex flex-wrap align-items-end gap-3 mb-2">
                <div>
                  <div className="small text-secondary">Carpeta del archivo</div>
                  <div className="fw-bold">{c.carpeta}</div>
                </div>
                <div>
                  <label className="form-label small mb-1">Finca en la app</label>
                  <select className="form-select form-select-sm" value={c.fincaUuid} onChange={(e) => cambiarFinca(idx, e.target.value)}>
                    <option value="">— no importar —</option>
                    {fincasApp.map((f) => (
                      <option key={f.uuid} value={f.uuid}>{f.codigo} — {f.nombre}</option>
                    ))}
                  </select>
                </div>
                {c.finca.length > 0 && (
                  <div>
                    <label className="form-label small mb-1">Polígono de la finca</label>
                    <select className="form-select form-select-sm" value={c.perimFinca} onChange={(e) => actualizar(idx, { perimFinca: e.target.value })} disabled={!c.fincaUuid}>
                      <option value="">— ninguno —</option>
                      {c.finca.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre || "(sin nombre)"} · {p.perimetro.length} pts</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {c.lotes.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0 small">
                    <thead className="table-light">
                      <tr><th>Polígono del archivo</th><th>Puntos</th><th>Lote en la app</th></tr>
                    </thead>
                    <tbody>
                      {c.lotes.map((p) => (
                        <tr key={p.id}>
                          <td>{p.nombre || "(sin nombre)"}</td>
                          <td>{p.perimetro.length}</td>
                          <td style={{ minWidth: "14rem" }}>
                            <select className="form-select form-select-sm" value={c.lotesMap?.[p.id] ?? ""} onChange={(e) => asignarLote(idx, p.id, e.target.value)} disabled={!c.fincaUuid}>
                              <option value="">— no importar —</option>
                              {c.lotesApp.filter((l) => l.estado && !l.deletedAt).map((l) => (
                                <option key={l.uuid} value={l.uuid}>{l.codigo} — Lote {l.nombre}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {c.capas.length > 0 && (
                <div className="mt-3">
                  <div className="small text-secondary mb-1">Otras capas del archivo</div>
                  <div className="d-flex flex-wrap gap-3">
                    {c.capas.map((k) => (
                      <div className="form-check small" key={k.categoria}>
                        <input
                          id={`capa-${idx}-${k.categoria}`}
                          type="checkbox"
                          className="form-check-input"
                          checked={!!c.capasSel[k.categoria]}
                          disabled={!c.fincaUuid}
                          onChange={(e) => actualizar(idx, { capasSel: { ...c.capasSel, [k.categoria]: e.target.checked } })}
                        />
                        <label className="form-check-label" htmlFor={`capa-${idx}-${k.categoria}`}>
                          {NOMBRES_CATEGORIA[k.categoria]} ({k.elementos.length}) <span className="text-secondary">· {k.carpetas.join(", ")}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose}>Cancelar</button>
            <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={guardar} disabled={totalFincas + totalLotes + totalCapas === 0}>
              Guardar {totalFincas + totalLotes + totalCapas} elementos
            </button>
          </div>
        </>
      )}

      {paso === "guardando" && <p className="text-secondary text-center py-4">Guardando perímetros…</p>}

      {paso === "listo" && resultado && (
        <div className="py-3">
          <div className="alert alert-success py-2 small">
            Listo: {resultado.fincasOk} perímetros de finca y {resultado.lotesOk} de lote y {resultado.capasOk} elementos de mapa guardados.
          </div>
          {resultado.errores.length > 0 && (
            <div className="alert alert-warning py-2 small">
              <div className="fw-medium mb-1">No se pudieron guardar:</div>
              {resultado.errores.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          <div className="text-end"><button type="button" className="btn btn-brand btn-sm rounded-3" onClick={onClose}>Cerrar</button></div>
        </div>
      )}
    </ModalShell>
  );
}
