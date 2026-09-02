"use client";

import { useMemo } from "react";
import SelectAddPicker from "@/components/SelectAddPicker";

// Árbol de navegación: cada sección del menú (nivel 1) tiene sus submenús
// (nivel 2), y cada submenú lista los prefijos de los permisos granulares
// de acción (crear/editar/eliminar/etc.) que viven en esa pantalla (nivel
// 3). Mismo patrón que app-banarica (Nuevo Usuario → Permisos): agregás la
// sección con un desplegable, aparece la lista de submenús para agregar, y
// dentro de cada submenú aparecen los permisos puntuales de esa pantalla —
// en vez de una sola lista plana con checkboxes. Cada nivel se ve más chico
// y suave que el anterior para que la jerarquía se note de un vistazo.
const MENU_TREE = [
  {
    codigo: "menu.maestros",
    nombre: "Maestros",
    submenus: [
      { codigo: "menu.maestros.fincas", nombre: "Fincas", prefijos: ["finca.", "lote.", "planta.", "categoria_planta."] },
      { codigo: "menu.maestros.productos", nombre: "Productos", prefijos: ["producto."] },
      { codigo: "menu.maestros.grupos_finca", nombre: "Grupos de Finca", prefijos: ["grupo_finca."] },
      { codigo: "menu.maestros.area_lotes", nombre: "Área de Lotes", prefijos: ["area_lote."] },
      { codigo: "menu.maestros.usuarios", nombre: "Usuarios", prefijos: ["usuarios."] },
      { codigo: "menu.maestros.roles", nombre: "Roles", prefijos: ["roles.", "permisos."] },
      { codigo: "menu.maestros.semanas", nombre: "Semanas", prefijos: ["semana."] },
      { codigo: "menu.maestros.calendario", nombre: "Calendario", prefijos: [] },
      { codigo: "menu.maestros.motivos_repique", nombre: "Motivos de Repique", prefijos: ["motivo_repique."] },
      { codigo: "menu.maestros.motivos_recuse", nombre: "Motivos de Recuse", prefijos: ["motivo_recuse."] },
      { codigo: "menu.maestros.categorias_labor", nombre: "Categorías de Labor", prefijos: ["categoria_labor."] },
      { codigo: "menu.maestros.labores", nombre: "Labores", prefijos: ["labor."] },
      { codigo: "menu.maestros.colaboradores", nombre: "Colaboradores", prefijos: ["colaborador."] },
      { codigo: "menu.maestros.estadios_sigatoka", nombre: "Estadios de Sigatoka", prefijos: ["estadio_sigatoka."] },
    ],
  },
  {
    codigo: "menu.racimos",
    nombre: "Racimos",
    submenus: [
      {
        codigo: "menu.racimos.movimientos",
        nombre: "Movimientos",
        prefijos: ["racimo_movimiento.ver", "racimo_movimiento.editar", "racimo_movimiento.eliminar", "racimo_movimiento.editar_historico", "racimo_movimiento.eliminar_masivo"],
      },
      { codigo: "menu.racimos.registrar", nombre: "Registrar Embolse/Repique/Corte", prefijos: ["racimo_movimiento.crear", "racimo_movimiento.forzar_saldo_negativo"] },
      { codigo: "menu.racimos.saldos_lotes_cintas", nombre: "Saldos × Lotes y Cintas", prefijos: [] },
      { codigo: "menu.racimos.reporte_embolses", nombre: "Reporte de Embolses", prefijos: [] },
    ],
  },
  {
    codigo: "menu.labores",
    nombre: "Labores",
    submenus: [
      { codigo: "menu.labores.calendario", nombre: "Calendario de Labores", prefijos: ["labor_programacion."] },
      { codigo: "menu.labores.estados", nombre: "Estados de Labores", prefijos: [] },
    ],
  },
  {
    codigo: "menu.sanidad_vegetal",
    nombre: "Sanidad Vegetal",
    submenus: [
      {
        codigo: "menu.sanidad_vegetal.evaluaciones",
        nombre: "Evaluaciones",
        prefijos: ["evaluacion.", "infeccion.", "conteo_hojas.", "suma_bruta.", "tipo_evaluacion.", "estadio_sigatoka."],
      },
      { codigo: "menu.sanidad_vegetal.graficos", nombre: "Gráficos", prefijos: [] },
      { codigo: "menu.sanidad_vegetal.labores", nombre: "Evaluación de Labores", prefijos: ["labor_evaluacion."] },
      { codigo: "menu.sanidad_vegetal.alertas", nombre: "Alertas", prefijos: [] },
    ],
  },
];

// Ítems planos del menú (sin submenú propio) — se agregan como tag al mismo
// nivel que las secciones, y al agregarlos muestran directo sus permisos
// granulares (sin el paso intermedio de submenú).
const ITEMS_PLANOS = [
  { codigo: "menu.precipitacion_diaria", nombre: "Precipitación Diaria", prefijos: ["precipitacion_diaria."] },
  { codigo: "menu.produccion_semanal", nombre: "Producción Semanal", prefijos: ["produccion."] },
  { codigo: "menu.estimaciones", nombre: "Estimaciones de Fincas", prefijos: ["estimacion."] },
  { codigo: "menu.pronostico", nombre: "Pronóstico de Cajas", prefijos: ["pronostico."] },
  { codigo: "menu.programacion_corte", nombre: "Programación de Corte", prefijos: ["programacion_corte."] },
  { codigo: "menu.reportes", nombre: "Reportes", prefijos: [] },
];

const TODOS_LOS_CODIGOS_DE_MENU = new Set([
  ...MENU_TREE.map((m) => m.codigo),
  ...MENU_TREE.flatMap((m) => m.submenus.map((s) => s.codigo)),
  ...ITEMS_PLANOS.map((i) => i.codigo),
]);

/**
 * Selector de permisos en cascada Menú → Submenú → Permisos de la pantalla,
 * con una lista desplegable + botón "Agregar" en cada nivel (ver
 * SelectAddPicker) — pensado específicamente para la pantalla de
 * Roles → Permisos.
 * `items` / `selected`: arreglos de { uuid, label, sublabel }, donde
 * `sublabel` es el código del permiso (finca.ver, menu.maestros.fincas,
 * etc.) — mismo contrato que ya usaba este componente.
 */
export default function PermisosGroupedPicker({ items, selected, onChange }) {
  const itemPorCodigo = useMemo(() => new Map(items.map((i) => [i.sublabel, i])), [items]);
  const selectedCodigos = useMemo(() => new Set(selected.map((s) => s.sublabel)), [selected]);

  // Items del "picker" de nivel 1: secciones del menú + ítems planos, en el
  // mismo desplegable (misma UX que app-banarica: un solo campo "Habilitar
  // menú" donde se agregan tanto secciones como accesos directos).
  const nivel1Items = useMemo(() => {
    const codigos = [...MENU_TREE.map((m) => m.codigo), ...ITEMS_PLANOS.map((i) => i.codigo)];
    return codigos.map((c) => itemPorCodigo.get(c)).filter(Boolean);
  }, [itemPorCodigo]);
  const nivel1Selected = selected.filter((s) => nivel1Items.some((i) => i.uuid === s.uuid));

  const toggleNivel1 = (nuevaLista) => {
    // Si se quita una sección/ítem plano, se quitan en cascada todos sus
    // submenús y permisos granulares ya agregados (no tiene sentido dejar
    // un permiso de submenú suelto sin la sección que lo contiene).
    const codigosNuevos = new Set(nuevaLista.map((i) => i.sublabel));
    const quitados = nivel1Selected.filter((s) => !codigosNuevos.has(s.sublabel));
    if (quitados.length === 0) {
      onChange([...selected.filter((s) => !nivel1Items.some((i) => i.uuid === s.uuid)), ...nuevaLista]);
      return;
    }
    let resultado = [...selected.filter((s) => !nivel1Items.some((i) => i.uuid === s.uuid)), ...nuevaLista];
    for (const q of quitados) {
      const seccion = MENU_TREE.find((m) => m.codigo === q.sublabel);
      if (!seccion) continue;
      const codigosHijos = new Set(seccion.submenus.map((s) => s.codigo));
      const prefijosNietos = seccion.submenus.flatMap((s) => s.prefijos);
      resultado = resultado.filter(
        (s) => !codigosHijos.has(s.sublabel) && !prefijosNietos.some((p) => s.sublabel?.startsWith(p)),
      );
    }
    onChange(resultado);
  };

  const seccionesSeleccionadas = MENU_TREE.filter((m) => selectedCodigos.has(m.codigo));
  const itemsPlanosSeleccionados = ITEMS_PLANOS.filter((i) => selectedCodigos.has(i.codigo));

  return (
    <div>
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <label className="form-label small fw-semibold text-secondary text-uppercase mb-2" style={{ fontSize: "0.7rem", letterSpacing: "0.03em" }}>
          Paso 1 · Habilitar menú
        </label>
        <SelectAddPicker items={nivel1Items} selected={nivel1Selected} onChange={toggleNivel1} placeholder="Selecciona una sección o ítem del menú..." />
      </div>

      {seccionesSeleccionadas.map((seccion) => (
        <SubmenuBlock key={seccion.codigo} seccion={seccion} items={items} selected={selected} onChange={onChange} />
      ))}

      {itemsPlanosSeleccionados.map((item) => {
        const permisosItem = items.filter((i) => item.prefijos.some((p) => i.sublabel?.startsWith(p)));
        if (permisosItem.length === 0) return null;
        return (
          <div key={item.codigo} className="card border-0 shadow-sm rounded-4 p-3 mb-3">
            <div className="fw-semibold small mb-2">{item.nombre}</div>
            <PermisosSubBlock
              permisos={permisosItem}
              selected={selected}
              onChange={onChange}
              prefijos={item.prefijos}
            />
          </div>
        );
      })}

      {/* Permisos que no calzan en ningún menú/submenú (ej. sistema.reset_datos,
          los legacy menu.ver/crear/editar/eliminar de gestión de menú tipo CMS) —
          quedan disponibles al final para no dejar nada inalcanzable. */}
      <OtrosPermisos items={items} selected={selected} onChange={onChange} />
    </div>
  );
}

function PermisosSubBlock({ permisos, selected, onChange, prefijos }) {
  return (
    <div className="ps-3 border-start border-3 border-brand">
      <span className="text-secondary" style={{ fontSize: "0.7rem" }}>
        Permisos de esta pantalla
      </span>
      <SelectAddPicker
        items={permisos}
        selected={selected.filter((s) => prefijos.some((p) => s.sublabel?.startsWith(p)))}
        onChange={(nuevaLista) => {
          const codigosDelGrupo = new Set(permisos.map((i) => i.uuid));
          onChange([...selected.filter((s) => !codigosDelGrupo.has(s.uuid)), ...nuevaLista]);
        }}
        placeholder="Selecciona un permiso..."
        variante="outline"
        compact
      />
    </div>
  );
}

function SubmenuBlock({ seccion, items, selected, onChange }) {
  const submenuItems = useMemo(
    () => seccion.submenus.map((s) => items.find((i) => i.sublabel === s.codigo)).filter(Boolean),
    [seccion, items],
  );
  const submenuSelected = selected.filter((s) => submenuItems.some((i) => i.uuid === s.uuid));
  const selectedCodigos = new Set(selected.map((s) => s.sublabel));

  const toggleSubmenu = (nuevaLista) => {
    const codigosNuevos = new Set(nuevaLista.map((i) => i.sublabel));
    const quitados = submenuSelected.filter((s) => !codigosNuevos.has(s.sublabel));
    let resultado = [...selected.filter((s) => !submenuItems.some((i) => i.uuid === s.uuid)), ...nuevaLista];
    for (const q of quitados) {
      const submenu = seccion.submenus.find((s) => s.codigo === q.sublabel);
      if (!submenu) continue;
      resultado = resultado.filter((s) => !submenu.prefijos.some((p) => s.sublabel?.startsWith(p)));
    }
    onChange(resultado);
  };

  const submenusSeleccionados = seccion.submenus.filter((s) => selectedCodigos.has(s.codigo));

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden">
      <div className="bg-brand px-3 py-2 fw-semibold small text-white">{seccion.nombre}</div>
      <div className="p-3">
        <label className="form-label small text-secondary mb-2">Habilitar submenú</label>
        <SelectAddPicker
          items={submenuItems}
          selected={submenuSelected}
          onChange={toggleSubmenu}
          placeholder="Selecciona un submenú..."
          variante="suave"
          compact
        />

        {submenusSeleccionados.map((submenu) => {
          const permisosSubmenu = items.filter((i) => submenu.prefijos.some((p) => i.sublabel?.startsWith(p)));
          if (permisosSubmenu.length === 0) return null;
          return (
            <div key={submenu.codigo} className="mt-3">
              <div className="fw-medium small mb-1">{submenu.nombre}</div>
              <PermisosSubBlock permisos={permisosSubmenu} selected={selected} onChange={onChange} prefijos={submenu.prefijos} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OtrosPermisos({ items, selected, onChange }) {
  const otros = items.filter((i) => !TODOS_LOS_CODIGOS_DE_MENU.has(i.sublabel) && !esGranularCubierto(i.sublabel));
  if (otros.length === 0) return null;
  const otrosSelected = selected.filter((s) => otros.some((i) => i.uuid === s.uuid));

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3">
      <div className="fw-semibold small mb-2">Otros permisos</div>
      <SelectAddPicker
        items={otros}
        selected={otrosSelected}
        onChange={(nuevaLista) => {
          const codigosDelGrupo = new Set(otros.map((i) => i.uuid));
          onChange([...selected.filter((s) => !codigosDelGrupo.has(s.uuid)), ...nuevaLista]);
        }}
        placeholder="Selecciona un permiso..."
        variante="outline"
        compact
      />
    </div>
  );
}

const TODOS_LOS_PREFIJOS_GRANULARES = [
  ...MENU_TREE.flatMap((m) => m.submenus.flatMap((s) => s.prefijos)),
  ...ITEMS_PLANOS.flatMap((i) => i.prefijos),
];

const esGranularCubierto = (codigo) => TODOS_LOS_PREFIJOS_GRANULARES.some((p) => codigo?.startsWith(p));
