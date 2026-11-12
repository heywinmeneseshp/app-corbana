"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from "react-leaflet";
import { FiMapPin } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import CapasMapa from "@/components/CapasMapa";

// Recorrido (traza GPS) de los evaluadores en una finca y un día: lo graba la app móvil mientras evalúan. Se elige finca y fecha, y se dibuja el
// recorrido de cada evaluador con su color, con inicio, fin, distancia y tiempo en movimiento.
const COLORES = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#9333ea", "#0891b2", "#db2777", "#65a30d"];
const CAPAS = {
  satelite: {
    nombre: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
  },
  calles: { nombre: "Calles", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 },
};

const hoyBogota = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" }) : "—");
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const min = (n) => (n >= 60 ? `${Math.floor(n / 60)} h ${Math.round(n % 60)} min` : `${Math.round(n)} min`);

export default function MapaRecorridoEvaluadorModal({ fincas, fincaUuidInicial = "", onClose }) {
  const [fincaUuid, setFincaUuid] = useState(fincaUuidInicial);
  const [fecha, setFecha] = useState(hoyBogota());
  const [recorridos, setRecorridos] = useState([]);
  const [trazas, setTrazas] = useState({}); // uuid -> [{ lat, lng, t }]
  const [ocultos, setOcultos] = useState(() => new Set());
  const [capa, setCapa] = useState("satelite");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!fincaUuid || !fecha) return undefined;
    let activo = true;
    setCargando(true);
    setError("");
    apiFetch(`/evaluaciones/recorridos?fincaUuid=${fincaUuid}&fecha=${fecha}`)
      .then(async (d) => {
        const items = d.items || [];
        const puntos = await Promise.all(items.map((r) => apiFetch(`/evaluaciones/recorridos/${r.uuid}/puntos`).then((p) => [r.uuid, p.puntos || []])));
        if (!activo) return;
        setRecorridos(items);
        setTrazas(Object.fromEntries(puntos));
        setOcultos(new Set());
      })
      .catch((err) => activo && setError(err.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [fincaUuid, fecha]);

  const colorDe = useMemo(() => Object.fromEntries(recorridos.map((r, i) => [r.uuid, COLORES[i % COLORES.length]])), [recorridos]);
  const visibles = recorridos.filter((r) => !ocultos.has(r.uuid) && (trazas[r.uuid] || []).length > 0);
  const todos = visibles.flatMap((r) => trazas[r.uuid]);
  const centro = todos.length ? [todos.reduce((s, p) => s + p.lat, 0) / todos.length, todos.reduce((s, p) => s + p.lng, 0) / todos.length] : null;
  const alternar = (uuid) =>
    setOcultos((s) => {
      const n = new Set(s);
      if (n.has(uuid)) n.delete(uuid);
      else n.add(uuid);
      return n;
    });

  return (
    <ModalShell title="Recorrido de los evaluadores" onClose={onClose} fullscreen>
      <div className="d-flex flex-wrap align-items-end gap-3 px-3 py-2 border-bottom bg-light">
        <div>
          <label className="form-label small fw-medium mb-1">Finca</label>
          <select className="form-select form-select-sm" style={{ minWidth: 200 }} value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)}>
            <option value="">Elige una finca</option>
            {fincas.map((f) => (
              <option key={f.uuid} value={f.uuid}>
                {f.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label small fw-medium mb-1">Fecha</label>
          <input type="date" className="form-control form-control-sm" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="form-label small fw-medium mb-1">Mapa</label>
          <select className="form-select form-select-sm" value={capa} onChange={(e) => setCapa(e.target.value)}>
            {Object.entries(CAPAS).map(([k, c]) => (
              <option key={k} value={k}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          {recorridos.map((r) => {
            const oculto = ocultos.has(r.uuid);
            return (
              <button
                key={r.uuid}
                type="button"
                className="btn btn-sm d-flex align-items-center gap-2 rounded-pill border py-0"
                style={{ opacity: oculto ? 0.45 : 1, background: "#fff" }}
                onClick={() => alternar(r.uuid)}
                title={`Puntos: ${r.puntos}`}
              >
                <span className="rounded-circle d-inline-block" style={{ width: 10, height: 10, background: colorDe[r.uuid] }} />
                <span className="small">
                  {r.evaluador?.nombre || "—"} · {hora(r.inicio)}–{r.fin ? hora(r.fin) : "en curso"} · {km(r.distanciaM)} · {min(r.movimientoMin)} en movimiento
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small m-3">{error}</div>}
      {!fincaUuid && <div className="p-4 text-secondary small d-flex align-items-center gap-2"><FiMapPin /> Elige una finca y una fecha para ver el recorrido.</div>}
      {fincaUuid && !cargando && !error && recorridos.length === 0 && (
        <div className="p-4 text-secondary small d-flex align-items-center gap-2">
          <FiMapPin /> No hay recorridos grabados en esta finca para esa fecha.
        </div>
      )}
      {cargando && <div className="p-4 text-secondary small">Cargando...</div>}

      {centro && (
        <div className="flex-grow-1" style={{ minHeight: 0 }}>
          <MapContainer key={`${fincaUuid}-${fecha}`} center={centro} zoom={16} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer key={capa} attribution={CAPAS[capa].attribution} url={CAPAS[capa].url} maxZoom={CAPAS[capa].maxZoom} />
            <CapasMapa fincaUuid={fincaUuid} />
            {visibles.map((r) => {
              const puntos = trazas[r.uuid];
              const color = colorDe[r.uuid];
              const ini = puntos[0];
              const fin = puntos[puntos.length - 1];
              return (
                <div key={r.uuid}>
                  <Polyline positions={puntos.map((p) => [p.lat, p.lng])} pathOptions={{ color, weight: 4, opacity: 0.9 }} />
                  <CircleMarker center={[ini.lat, ini.lng]} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: "#16a34a", fillOpacity: 1 }}>
                    <Popup>
                      <div className="small">
                        <strong>Inicio</strong> · {r.evaluador?.nombre} · {hora(ini.t)}
                      </div>
                    </Popup>
                  </CircleMarker>
                  <CircleMarker center={[fin.lat, fin.lng]} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: "#dc2626", fillOpacity: 1 }}>
                    <Popup>
                      <div className="small">
                        <strong>Fin</strong> · {r.evaluador?.nombre} · {hora(fin.t)}
                      </div>
                    </Popup>
                  </CircleMarker>
                </div>
              );
            })}
          </MapContainer>
        </div>
      )}
    </ModalShell>
  );
}
