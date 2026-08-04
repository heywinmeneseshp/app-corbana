import { FiClipboard } from "react-icons/fi";
import {
  GiFarmTractor,
  GiWateringCan,
  GiSprout,
  GiPlantSeed,
  GiHerbsBundle,
  GiGardeningShears,
  GiShears,
  GiSpade,
  GiRake,
  GiWheelbarrow,
  GiHighGrass,
  GiWaterTank,
  GiChemicalDrop,
  GiPlantWatering,
  GiThreeLeaves,
  GiLeafSwirl,
  GiVineLeaf,
  GiPlantRoots,
  GiFruitTree,
  GiBananaBunch,
  GiFruitBowl,
  GiBasket,
  GiWheat,
  GiCorn,
  GiToolbox,
  GiNotebook,
  GiCalculator,
} from "react-icons/gi";

// Paleta curada de iconos para labores agrícolas — todos ya vienen con
// react-icons (sin dependencia nueva). `key` es lo que se guarda en
// `labor.icono`; nunca se guarda el componente ni un SVG.
export const DEFAULT_LABOR_ICON_KEY = "FiClipboard";

export const LABOR_ICONS = [
  { key: "GiFarmTractor", Icon: GiFarmTractor, label: "Labor de campo" },
  { key: "GiWateringCan", Icon: GiWateringCan, label: "Riego" },
  { key: "GiPlantWatering", Icon: GiPlantWatering, label: "Riego de planta" },
  { key: "GiWaterTank", Icon: GiWaterTank, label: "Tanque de agua" },
  { key: "GiSprout", Icon: GiSprout, label: "Siembra" },
  { key: "GiPlantSeed", Icon: GiPlantSeed, label: "Semilla" },
  { key: "GiPlantRoots", Icon: GiPlantRoots, label: "Raíces" },
  { key: "GiFruitTree", Icon: GiFruitTree, label: "Árbol frutal" },
  { key: "GiThreeLeaves", Icon: GiThreeLeaves, label: "Follaje" },
  { key: "GiLeafSwirl", Icon: GiLeafSwirl, label: "Hoja" },
  { key: "GiVineLeaf", Icon: GiVineLeaf, label: "Hoja de vid" },
  { key: "GiHighGrass", Icon: GiHighGrass, label: "Maleza" },
  { key: "GiHerbsBundle", Icon: GiHerbsBundle, label: "Deshoje" },
  { key: "GiGardeningShears", Icon: GiGardeningShears, label: "Poda" },
  { key: "GiShears", Icon: GiShears, label: "Corte" },
  { key: "GiSpade", Icon: GiSpade, label: "Laboreo de tierra" },
  { key: "GiRake", Icon: GiRake, label: "Rastrillo" },
  { key: "GiWheelbarrow", Icon: GiWheelbarrow, label: "Transporte" },
  { key: "GiChemicalDrop", Icon: GiChemicalDrop, label: "Fitosanitario" },
  { key: "GiBananaBunch", Icon: GiBananaBunch, label: "Racimo / Embolse" },
  { key: "GiFruitBowl", Icon: GiFruitBowl, label: "Cosecha" },
  { key: "GiBasket", Icon: GiBasket, label: "Recolección" },
  { key: "GiWheat", Icon: GiWheat, label: "Grano" },
  { key: "GiCorn", Icon: GiCorn, label: "Cultivo" },
  { key: "GiToolbox", Icon: GiToolbox, label: "Mantenimiento" },
  { key: "GiNotebook", Icon: GiNotebook, label: "Registro" },
  { key: "GiCalculator", Icon: GiCalculator, label: "Administrativo" },
  { key: DEFAULT_LABOR_ICON_KEY, Icon: FiClipboard, label: "General" },
];

const LABOR_ICON_MAP = new Map(LABOR_ICONS.map((entry) => [entry.key, entry.Icon]));

export function getLaborIcon(key) {
  return LABOR_ICON_MAP.get(key) || FiClipboard;
}
