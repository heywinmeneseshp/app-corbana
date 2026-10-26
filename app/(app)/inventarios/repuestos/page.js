import CatalogoArticulos from "@/components/inventario/CatalogoArticulos";

// Piezas y repuestos (menú Equipos): el catálogo de artículos limitado a la categoría de repuestos.
export default function RepuestosPage() {
  return <CatalogoArticulos modo="repuestos" />;
}
