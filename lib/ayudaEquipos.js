// Textos de ayuda («¿Cómo funciona?») de las pantallas de la sección Equipos: Equipos, Piezas y repuestos, Planes, Programaciones y Órdenes de mantenimiento.
// Formato de InfoModulo: [{ titulo, texto?, items? }].

export const AYUDA_FLUJO = {
  titulo: "El recorrido completo de un mantenimiento",
  items: [
    "1. Equipos: registras el equipo (vehículo, dron, tractor, bomba...) y, al usarlo, su lectura de kilometraje u horas.",
    "2. Planes: defines qué mantenimiento necesita y cada cuánto (por días, meses, kilómetros u horas).",
    "3. Programaciones: el calendario de lo que toca hacer. Las crea el sistema al cumplirse un plan, o tú a mano.",
    "4. Órdenes: desde una programación abres la orden de trabajo con los repuestos, la mano de obra y los servicios. Si el plan tiene plantilla, la orden trae un checklist para calificar ítem por ítem; lo que sale mal se vuelve hallazgo. Al cerrarla, los repuestos salen del inventario y el ciclo vuelve a empezar.",
    "5. Hallazgos: cada hallazgo se puede convertir en una programación de corrección y se sigue hasta resolverlo, aunque la orden ya esté cerrada.",
    "6. Informe: de cada orden se descarga el informe del servicio en PDF (Formato de ejecución y Anexo técnico).",
  ],
};

export const AYUDA_EQUIPOS = [
  { titulo: "Para qué sirve", texto: "Es el registro de los equipos de la empresa: tractores, vehículos, maquinaria, bombas, drones. Cada equipo tiene sus datos, sus repuestos compatibles, su lectura de kilometraje u horas y de él cuelgan sus planes, programaciones y órdenes de mantenimiento." },
  {
    titulo: "Datos de un equipo",
    items: [
      "Código (único) y nombre. El tipo sale de un catálogo que puedes ampliar con el botón junto al campo.",
      "Marca, modelo, serie y fecha de adquisición.",
      "Ubicación (almacén físico donde está) y centro de costo (a quién se le cargan sus gastos).",
      "Responsable: el usuario a cargo del equipo.",
      "Estado: Operativo, En mantenimiento, Fuera de servicio, Inactivo o De baja.",
      "Horómetro (horas acumuladas) y Kilometraje: la última lectura registrada.",
    ],
  },
  {
    titulo: "Lecturas de kilometraje y horas (icono del tablero)",
    items: [
      "El conductor o piloto registra lo que marca el tablero al encender el equipo: kilometraje para vehículos y horas para drones y maquinaria. Se puede hacer desde esta pantalla o desde la app móvil (tarjeta «Kilometraje y horas»), que funciona sin internet.",
      "El sistema calcula lo recorrido entre una lectura y la anterior (por ejemplo, 47.000 − 45.200 = 1.800 km) y lo ve en la pestaña Historial.",
      "Cada lectura actualiza el kilometraje u horómetro del equipo. Una lectura atrasada que llega tarde desde la app no pisa la más reciente.",
      "Una lectura menor que la anterior se rechaza para evitar errores de digitación. Si cambiaron el tablero o la lectura anterior estaba mal, quien tiene permiso de editar equipos puede marcar «Es una corrección».",
      "Permiso: quien tenga «Registrar el kilometraje y las horas de los equipos» (o el de editar equipos) puede registrar lecturas.",
    ],
  },
  {
    titulo: "Para qué se usan las lecturas",
    texto: "Los planes de mantenimiento por kilómetros u horas cuentan desde la lectura del último mantenimiento. Cuando faltan 10 % o menos del intervalo, el plan queda «próximo»; al pasarse, «vencido». En ambos casos se crea una programación y llega un correo (una sola vez por estado) a quienes se configuren en Programaciones → tuerca.",
  },
  {
    titulo: "Partes y accesorios con serie (icono de la batería)",
    items: [
      "Registra las baterías, el control remoto, los cargadores y las antenas del equipo, cada uno con su código interno («Batería 01»), serie y estado (Activa, En revisión, Retirada).",
      "Cada parte lleva sus ciclos acumulados y un historial de novedades, mantenimientos y asignaciones. Los ciclos solo pueden subir: si escribes un valor menor que el registrado, se rechaza.",
      "Puedes asignar una parte a una aeronave y moverla a otra; el historial guarda cada cambio. Las partes sin asignar quedan disponibles para asignarlas a cualquier equipo. Así se sabe qué batería se usó dónde y cuál da problemas.",
      "El código de cada parte es único en todo el sistema, porque la parte puede cambiar de equipo.",
    ],
  },
  { titulo: "Configuración instalada", texto: "Campo libre para anotar lo que lleva el equipo (por ejemplo «LS100, Esparcido 4.0»). Sale en la identificación del informe del servicio." },
  {
    titulo: "Repuestos compatibles (icono de la herramienta)",
    texto: "Asocia al equipo las piezas y repuestos que le sirven (filtros, aceite, llantas...). Así, al abrir una orden de mantenimiento de ese equipo, eliges los repuestos entre los compatibles.",
  },
  {
    titulo: "Estado y mantenimiento",
    texto: "Si un equipo está «En mantenimiento», al cerrar la orden de trabajo vuelve solo a «Operativo». En la app móvil solo aparecen para registrar lecturas los equipos Operativos o En mantenimiento: los de baja, inactivos o fuera de servicio no.",
  },
  AYUDA_FLUJO,
];

export const AYUDA_REPUESTOS = [
  { titulo: "Para qué sirve", texto: "Catálogo de piezas y repuestos de los equipos (filtros, aceites, llantas, correas...). Son artículos de inventario de la categoría «Piezas y repuestos»: también aparecen en Inventarios → Artículos y llevan existencias por almacén como cualquier otro artículo." },
  {
    titulo: "Cómo funciona",
    items: [
      "Creas el repuesto con sus datos (código, nombre, unidad de medida...).",
      "En Equipos asocias los repuestos compatibles de cada equipo.",
      "En una orden de mantenimiento eliges los repuestos que se usan y la cantidad.",
      "Al cerrar la orden, esos repuestos salen del almacén elegido: se genera una salida en el kárdex y baja la existencia. Si no hay stock suficiente, el cierre se rechaza.",
    ],
  },
  { titulo: "Permisos", texto: "Puedes crear y editar repuestos con el permiso de Artículos o con el de Equipos." },
  AYUDA_FLUJO,
];

export const AYUDA_PLANES = [
  { titulo: "Para qué sirve", texto: "Un plan dice qué mantenimiento se le hace a un equipo y cada cuánto. Es la regla que genera las programaciones. Un equipo puede tener varios planes (cambio de aceite, revisión de frenos, calibración...)." },
  {
    titulo: "Campos de un plan",
    items: [
      "Equipo y nombre del mantenimiento, con una descripción opcional.",
      "Tipo: Preventivo, Rutinario, Correctivo, Predictivo, Adecuación u Otro.",
      "Cada: el número y la unidad. La unidad puede ser días, meses, horas de uso, horas de horómetro o kilómetros.",
      "Último mantenimiento a los (solo km y horas): la lectura del equipo desde la que se empieza a contar. Si lo dejas vacío, se usa la lectura actual del equipo.",
      "Activo: un plan inactivo no genera programaciones ni avisos.",
    ],
  },
  {
    titulo: "Planes por días o meses",
    texto: "Al cerrar una orden de trabajo del plan, el sistema agenda sola la siguiente programación contando desde el día del cierre (por ejemplo, plan cada 3 meses → próxima en 3 meses).",
  },
  {
    titulo: "Planes por kilómetros u horas",
    items: [
      "Dependen de las lecturas que registra el conductor (Equipos → icono del tablero, o la app móvil).",
      "Próximo mantenimiento = lectura del último mantenimiento + el intervalo. Ejemplo: último a los 45.200 km, plan cada 5.000 km → toca a los 50.200 km. La columna «Próximo mantenimiento» te muestra a cuántos faltan.",
      "Próximo: faltan 10 % o menos del intervalo (500 km en el ejemplo). Vencido: ya se pasó.",
      "En cuanto pasa a próximo o vencido, el sistema crea una programación (si no hay una abierta) y envía un correo, una sola vez por estado, a los destinatarios configurados en Programaciones → tuerca.",
      "Al cerrar la orden de trabajo, el conteo vuelve a empezar desde la lectura actual del equipo.",
      "Al crear un plan por km u horas se usa como base la lectura actual del equipo (o la que escribas). Los planes antiguos sin base la toman del primer registro de lectura.",
      "Las unidades «horas de uso» y «horas de horómetro» cuentan sobre el horómetro del equipo.",
    ],
  },
  {
    titulo: "Plantilla de checklist",
    items: [
      "Una plantilla es la lista de ítems que se revisan en cada mantenimiento, ordenada por secciones. En el plan eliges la plantilla; todas las órdenes de ese plan nacen con una copia de sus ítems.",
      "El botón «Plantillas de checklist» (arriba) abre el editor: una línea que empieza con ## abre una sección y cada línea siguiente es un ítem. Puedes crear, editar y eliminar plantillas.",
      "Ya viene cargada la plantilla «Mantenimiento 100 h – DJI Agras T100», con las 7 secciones y los 46 ítems del formato de servicio. Úsala o cópiala a tu gusto para otros drones.",
      "Cambiar una plantilla después no modifica las órdenes ya creadas: cada orden conserva su copia.",
    ],
  },
  { titulo: "Botón del calendario", texto: "Programa ese mantenimiento a mano: te lleva a Programaciones con el equipo y el plan ya elegidos." },
  AYUDA_FLUJO,
];

export const AYUDA_PROGRAMACIONES = [
  { titulo: "Para qué sirve", texto: "Es el calendario de mantenimientos por equipo: lo que toca hacer y cuándo. De aquí se abre la orden de trabajo; el sistema también las crea solo cuando un plan se cumple." },
  {
    titulo: "De dónde salen las programaciones",
    items: [
      "A mano: con «Nueva programación» eliges equipo, plan, fecha, tipo, prioridad y responsable.",
      "Automáticas por tiempo: al cerrar una orden de un plan por días o meses, se agenda la siguiente.",
      "Desde un hallazgo: en la pestaña Hallazgos de una orden, «Programar corrección» crea una programación con el hallazgo, el repuesto pendiente y la recomendación, para la fecha que elijas.",
      "Automáticas por kilometraje u horas: cuando un plan queda próximo o vencido tras registrar una lectura, se crea una programación para hoy, con una observación como «Por kilometraje: faltan 500 km (próxima a 50.200 km, lectura actual 49.700 km)». Solo se crea una mientras haya otra abierta del mismo plan.",
    ],
  },
  {
    titulo: "Estados",
    items: [
      "Pendiente y Programada: falta hacerla. En curso: ya se está trabajando.",
      "Completada: se cierra sola cuando se cierra la orden de trabajo que la originó.",
      "Cancelada y Vencida: se marcan a mano al editar.",
      "Por defecto la lista muestra solo las abiertas; desmarca el filtro o elige un estado para ver el resto.",
    ],
  },
  { titulo: "Prioridad", texto: "Baja, Media, Alta o Crítica. Las automáticas por kilometraje u horas nacen Media cuando está próximo y Alta cuando está vencido." },
  { titulo: "Abrir la orden de trabajo", texto: "El botón de la fila abre una orden nueva con el equipo, el plan y la programación ya cargados. Al cerrar esa orden, la programación queda Completada." },
  {
    titulo: "Avisos por correo (tuerca, solo Administrador)",
    texto: "Eliges los roles, usuarios o correos que reciben el aviso cuando un plan por kilómetros u horas queda próximo o vencido. Llega un correo una sola vez por cada estado y plan. Si no configuras a nadie, no se envía ningún correo (la programación sí se crea).",
  },
  AYUDA_FLUJO,
];

export const AYUDA_ORDENES = [
  { titulo: "Para qué sirve", texto: "La orden de trabajo es el registro de un mantenimiento realizado sobre un equipo: qué repuestos se usaron, cuánta mano de obra y qué servicios externos hubo, con su costo total. Cada orden recibe un número consecutivo con prefijo OM." },
  {
    titulo: "Cómo se crea",
    items: [
      "Desde una programación, con el botón «Abrir orden de trabajo»: ya trae el equipo, el plan y la programación.",
      "O con «Nueva orden», eligiendo el equipo y describiendo el trabajo (por ejemplo, un mantenimiento correctivo sin programación).",
      "Defines tipo, prioridad, responsable y el almacén de donde saldrán los repuestos.",
    ],
  },
  {
    titulo: "Qué lleva la orden",
    items: [
      "Repuestos: artículo y cantidad, con su costo.",
      "Mano de obra: quién trabajó, horas y costo por hora (costo = horas × costo por hora).",
      "Servicios externos: proveedor, descripción y costo.",
      "El total de la orden suma repuestos, mano de obra y servicios.",
    ],
  },
  { titulo: "Estados", texto: "Abierta → En proceso → Cerrada. También puede quedar Cancelada. Mientras no esté cerrada puedes editarla; una orden cerrada ya no se puede editar ni eliminar (el seguimiento de hallazgos, el servicio y las evidencias sí se pueden completar después)." },
  {
    titulo: "Pestañas de una orden",
    items: [
      "General: el formulario con equipo, fechas, repuestos, mano de obra y servicios.",
      "Checklist: si el plan tiene plantilla, la orden trae su lista de ítems. Califica cada uno (Satisfactorio, Observación, Insatisfactorio, N/A, Pendiente) y escribe lo encontrado. «Pendientes → satisfactorio» marca de una vez lo que sigue pendiente en una sección. Sin plantilla en el plan, puedes elegir una con «Generar checklist». Con la orden cerrada, el checklist queda de solo lectura.",
      "Hallazgos: cada ítem en Observación o Insatisfactorio crea solo un hallazgo con prioridad. Completa la acción ejecutada, el repuesto pendiente y la recomendación, y cámbialo a En seguimiento o Resuelto. «Programar corrección» lo convierte en una programación. Los hallazgos siguen abiertos aunque la orden se cierre; en Equipos se ven los pendientes.",
      "Servicio y evidencias: si lo hace un proveedor externo, registra el proveedor, el técnico responsable, las fechas, quién recibió y los participantes (por ejemplo, colaboradores en entrenamiento). Aquí también subes fotos, la carta de autorización y los informes: se guardan en Google Drive y se abren desde el sistema.",
    ],
  },
  {
    titulo: "Informe del servicio (PDF)",
    texto: "El botón «Informe del servicio (PDF)» descarga dos documentos en uno: el Formato de ejecución (identificación del equipo, checklist por secciones con su calificación, observaciones y firmas) y el Anexo técnico (hallazgos con acción ejecutada, repuesto pendiente y recomendación, partes registradas, repuestos y costos, y evidencias).",
  },
  {
    titulo: "Qué pasa al cerrarla",
    items: [
      "Los repuestos salen del inventario del almacén elegido: se genera una salida por cada uno en el kárdex y baja la existencia. Si algún repuesto no tiene stock suficiente, el cierre se rechaza y no se descuenta nada.",
      "La programación de origen queda Completada.",
      "Plan por días o meses: se agenda sola la siguiente programación contando desde hoy.",
      "Plan por kilómetros u horas: el conteo vuelve a empezar desde la lectura actual del equipo, y se limpia el aviso para que avise de nuevo en el siguiente ciclo.",
      "Si el equipo estaba «En mantenimiento», vuelve a «Operativo».",
    ],
  },
  { titulo: "Permiso", texto: "Cerrar una orden requiere un permiso propio («cerrar»), distinto del de crear o editar." },
  AYUDA_FLUJO,
];
