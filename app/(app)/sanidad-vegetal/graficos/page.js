"use client";

import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { esAdministrador } from "@/lib/laborEstados";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import BotonConfiguracion from "@/components/BotonConfiguracion";
import InfoTooltip from "@/components/reportes/InfoTooltip";
import GraficoSemanalComparable from "@/components/reportes/GraficoSemanalComparable";
import { BarraSelecciones, useSelecciones } from "@/components/reportes/SeleccionesEvaluacion";
import { ClimaGraficos, ConteoGraficos, InfeccionGraficos } from "@/components/reportes/SanidadGraficosTabs";

const LIMITES_SB_SEMANA = [{ valor: 1200, color: "#dc2626" }];
const LINEAS_SB_SEMANA = [{ key: "promedio", label: "Promedio", color: "#16a34a" }];
const LINEAS_SB_HOJA = [
  { key: "h3", label: "Suma Bruta Hoja 3", color: "#2563eb", filtro: (i) => i.hoja === 3 },
  { key: "h5", label: "Suma Bruta Hoja 5", color: "#f59e0b", filtro: (i) => i.hoja === 5 },
];

const INFO_SB_SEMANA = (
  <>
    <p className="fw-semibold mb-1">Suma Bruta por planta</p>
    <p className="mb-2">SB_planta = Hoja_3_val + Hoja_4_val + Hoja_5_val</p>
    <p className="fw-semibold mb-1">Promedio de la finca</p>
    <p className="mb-2">SB_Finca = (Σ SB_planta) / N.° de lotes evaluados</p>
    <p className="mb-0 fst-italic">
      No se divide entre la cantidad de plantas: cada lote suma todas sus plantas evaluadas y ese total
      es lo que se promedia entre lotes — así un lote con más plantas evaluadas no pesa más que uno con
      menos.
    </p>
  </>
);

const INFO_SB_HOJA = (
  <>
    <p className="fw-semibold mb-1">Corrección por candela</p>
    <p className="mb-2">CC_hoja = Candela × 10 (solo si esa hoja fue evaluada; si está vacía, CC = 0)</p>
    <p className="fw-semibold mb-1">Indicador por hoja</p>
    <p className="mb-1">SB_H3 = 10 × [(Σ Hoja_3_val − Σ CC_H3) / N.° de plantas evaluadas]</p>
    <p className="mb-2">SB_H5 = 10 × [(Σ Hoja_5_val − Σ CC_H5) / N.° de plantas evaluadas]</p>
    <p className="mb-0 fst-italic">
      N.° de plantas es siempre la cantidad real de plantas del grupo (finca + semana), nunca un valor
      fijo — normaliza el resultado a una base equivalente de 10 plantas sin importar cuántas se hayan
      evaluado en realidad.
    </p>
  </>
);

// Los dos gráficos de Suma Bruta (por semana y por hoja) usan el filtro de
// selecciones de la página (fincas/grupos y años), con slider de semanas y
// pantalla completa.
function SumaBrutaGraficos({ sel }) {
  const [umbralesSbHoja, setUmbralesSbHoja] = useState({ advertencia: 450, alerta: 650 });
  const [modalUmbrales, setModalUmbrales] = useState(false);
  const esAdmin = esAdministrador();

  useEffect(() => {
    apiFetch("/evaluaciones/sb-hoja-umbrales")
      .then(setUmbralesSbHoja)
      .catch(() => {});
  }, []);

  const limitesSbHoja = [
    { valor: umbralesSbHoja.advertencia, color: "#f59e0b" },
    { valor: umbralesSbHoja.alerta, color: "#dc2626" },
  ];

  return (
    <>
      <GraficoSemanalComparable
        titulo="Promedio de Suma Bruta por Semana"
        info={<InfoTooltip texto={INFO_SB_SEMANA} />}
        endpoint="/evaluaciones/suma-bruta-promedio"
        series={sel.series}
        lineas={LINEAS_SB_SEMANA}
        limites={LIMITES_SB_SEMANA}
        mensajeVacio="No hay evaluaciones de Suma Bruta para mostrar."
        ayuda="Cada punto es el promedio de Suma Bruta de esa semana de registro."
      />
      <GraficoSemanalComparable
        titulo="Promedio de Suma Bruta por Hoja"
        info={<InfoTooltip texto={INFO_SB_HOJA} />}
        endpoint="/evaluaciones/suma-bruta-promedio-por-hoja"
        series={sel.series}
        lineas={LINEAS_SB_HOJA}
        limites={limitesSbHoja}
        mensajeVacio="No hay evaluaciones de Suma Bruta para mostrar."
        acciones={esAdmin ? <BotonConfiguracion compacto title="Configurar líneas de referencia" onClick={() => setModalUmbrales(true)} /> : undefined}
      />

      {modalUmbrales && (
        <ModalUmbralesSbHoja
          umbrales={umbralesSbHoja}
          onClose={() => setModalUmbrales(false)}
          onGuardado={(nuevos) => {
            setUmbralesSbHoja(nuevos);
            setModalUmbrales(false);
          }}
        />
      )}
    </>
  );
}

// Config de las líneas de referencia del gráfico "Promedio de Suma Bruta
// por Hoja" — la línea roja (alerta) además dispara la alerta por finca en
// Sanidad Vegetal → Alertas cuando el promedio semanal la supera.
function ModalUmbralesSbHoja({ umbrales, onClose, onGuardado }) {
  const [advertencia, setAdvertencia] = useState(String(umbrales.advertencia));
  const [alerta, setAlerta] = useState(String(umbrales.alerta));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const nuevos = await apiFetch("/evaluaciones/sb-hoja-umbrales", {
        method: "PUT",
        body: JSON.stringify({ advertencia: Number(advertencia), alerta: Number(alerta) }),
      });
      onGuardado(nuevos);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalShell title="Líneas de referencia — Suma Bruta por Hoja" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="small text-secondary mb-3">
          La línea roja (alerta) además genera una alerta por finca en Sanidad Vegetal → Alertas cuando el
          promedio semanal de Suma Bruta Hoja 3 o Hoja 5 la supera.
        </p>

        <div className="mb-3">
          <label className="form-label small fw-medium" style={{ color: "#f59e0b" }}>
            Línea de advertencia (amarilla)
          </label>
          <input
            type="number"
            min={0}
            className="form-control rounded-3"
            required
            value={advertencia}
            onChange={(e) => setAdvertencia(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label small fw-medium" style={{ color: "#dc2626" }}>
            Línea de alerta (roja)
          </label>
          <input
            type="number"
            min={0}
            className="form-control rounded-3"
            required
            value={alerta}
            onChange={(e) => setAlerta(e.target.value)}
          />
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-light btn-sm rounded-3" onClick={onClose}>
            <FiX className="me-1" /> Cancelar
          </button>
          <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// Quien puede abrir este submenú (menu.sanidad_vegetal.graficos) ve todas
// sus pestañas: el backend ya acepta ese permiso de menú para leer los
// promedios de evaluaciones, así que no hace falta `evaluacion.ver` aparte.
// (Clima además es visible para cualquier usuario autenticado.)
const TIPOS = [
  { key: "Índice de infección", label: "Índice de Infección" },
  { key: "Conteo de Hojas", label: "Conteo de Hojas" },
  { key: "Suma Bruta", label: "Suma Bruta" },
  { key: "Clima", label: "Clima" },
];

export default function SanidadGraficosPage() {
  const tabsVisibles = TIPOS;
  // Filtro de selecciones compartido por todas las pestañas.
  const sel = useSelecciones();
  // El tab por defecto tiene que ser uno que el usuario efectivamente pueda
  // ver — antes siempre arrancaba en "Índice de infección" porque la página
  // entera exigía ese permiso; ahora alguien sin permisos de Sanidad Vegetal
  // puede entrar (por Clima) y ese tab ya no existiría para él.
  const [tab, setTab] = useState(() => tabsVisibles[0]?.key);

  // El gate de página ahora es el submenú de navegación
  // (menu.sanidad_vegetal.graficos), no un permiso granular de Sanidad
  // Vegetal — así alguien con acceso al submenú pero sin evaluacion.ver
  // igual puede entrar y ver (solo) Clima.
  return (
    <RequirePermission code="menu.sanidad_vegetal.graficos">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Gráficos</h1>
          <p className="text-secondary mb-0">Promedios semanales de infección, conteo de hojas, suma bruta y clima.</p>
        </div>

        <ul className="nav nav-pills mb-4 gap-2">
          {tabsVisibles.map((t) => (
            <li className="nav-item" key={t.key}>
              <button
                type="button"
                className={`nav-link rounded-3 ${tab === t.key ? "btn-brand text-white" : "btn btn-outline-secondary btn-sm"}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>

        <BarraSelecciones sel={sel} />

        {tab === "Índice de infección" ? (
          <InfeccionGraficos sel={sel} />
        ) : tab === "Conteo de Hojas" ? (
          <ConteoGraficos sel={sel} />
        ) : tab === "Suma Bruta" ? (
          <SumaBrutaGraficos sel={sel} />
        ) : tab === "Clima" ? (
          <ClimaGraficos sel={sel} />
        ) : null}
      </div>
    </RequirePermission>
  );
}