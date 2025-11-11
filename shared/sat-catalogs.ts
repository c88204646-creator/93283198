/**
 * Catálogos oficiales SAT CFDI 4.0
 * Fuente: http://omawww.sat.gob.mx/tramitesyservicios/Paginas/anexo_20.htm
 * Última actualización: Agosto 2025
 */

export interface SATCatalogItem {
  code: string;
  description: string;
  keywords?: string[];
}

/**
 * c_ClaveUnidad - Catálogo de Unidades de Medida SAT
 * Unidades más comunes utilizadas en México
 */
export const SAT_UNIT_CODES: SATCatalogItem[] = [
  { code: "H87", description: "Pieza", keywords: ["pza", "unidad", "piece"] },
  { code: "E48", description: "Unidad de servicio", keywords: ["servicio", "service"] },
  { code: "ACT", description: "Actividad", keywords: ["actividad", "activity"] },
  { code: "KGM", description: "Kilogramo", keywords: ["kg", "kilo", "kilogram"] },
  { code: "GRM", description: "Gramo", keywords: ["gr", "gram"] },
  { code: "LTR", description: "Litro", keywords: ["lt", "liter"] },
  { code: "MTR", description: "Metro", keywords: ["m", "meter"] },
  { code: "MTK", description: "Metro cuadrado", keywords: ["m2", "square meter"] },
  { code: "MTQ", description: "Metro cúbico", keywords: ["m3", "cubic meter"] },
  { code: "CMT", description: "Centímetro", keywords: ["cm", "centimeter"] },
  { code: "CMK", description: "Centímetro cuadrado", keywords: ["cm2"] },
  { code: "CMQ", description: "Centímetro cúbico", keywords: ["cm3"] },
  { code: "MLT", description: "Mililitro", keywords: ["ml", "milliliter"] },
  { code: "HUR", description: "Hora", keywords: ["hr", "hour"] },
  { code: "MIN", description: "Minuto", keywords: ["min", "minute"] },
  { code: "DAY", description: "Día", keywords: ["day"] },
  { code: "MON", description: "Mes", keywords: ["month"] },
  { code: "ANN", description: "Año", keywords: ["year"] },
  { code: "KWT", description: "Kilowatt", keywords: ["kw", "kilowatt"] },
  { code: "KWH", description: "Kilowatt hora", keywords: ["kwh"] },
  { code: "TNE", description: "Tonelada", keywords: ["ton", "tonne"] },
  { code: "XBX", description: "Caja", keywords: ["box"] },
  { code: "XPK", description: "Paquete", keywords: ["package", "pack"] },
  { code: "XKI", description: "Kit", keywords: ["kit", "set"] },
  { code: "XUN", description: "Unidad", keywords: ["unit"] },
  { code: "AS", description: "Variedad", keywords: ["assortment", "variety"] },
  { code: "AB", description: "Paquete a granel", keywords: ["bulk pack"] },
];

/**
 * c_ObjetoImp - Catálogo de Objeto de Impuesto SAT
 */
export const SAT_TAX_OBJECTS: SATCatalogItem[] = [
  { code: "01", description: "No objeto de impuesto" },
  { code: "02", description: "Sí objeto de impuesto" },
  { code: "03", description: "Sí objeto del impuesto y no obligado al desglose" },
  { code: "04", description: "Sí objeto del impuesto y exento" },
];

/**
 * c_Impuesto - Catálogo de Impuestos SAT
 */
export const SAT_TAX_TYPES: SATCatalogItem[] = [
  { code: "001", description: "ISR - Impuesto Sobre la Renta" },
  { code: "002", description: "IVA - Impuesto al Valor Agregado" },
  { code: "003", description: "IEPS - Impuesto Especial sobre Producción y Servicios" },
];

/**
 * c_TasaOCuota - Tasas comunes de IVA en México
 */
export const SAT_TAX_RATES: SATCatalogItem[] = [
  { code: "0.000000", description: "0% - Tasa 0%" },
  { code: "0.080000", description: "8% - Tasa Fronteriza" },
  { code: "0.160000", description: "16% - Tasa General" },
];

/**
 * c_UsoCFDI - Catálogo de Uso del CFDI
 */
export const SAT_CFDI_USE: SATCatalogItem[] = [
  { code: "G01", description: "Adquisición de mercancías" },
  { code: "G02", description: "Devoluciones, descuentos o bonificaciones" },
  { code: "G03", description: "Gastos en general" },
  { code: "I01", description: "Construcciones" },
  { code: "I02", description: "Mobiliario y equipo de oficina por inversiones" },
  { code: "I03", description: "Equipo de transporte" },
  { code: "I04", description: "Equipo de cómputo y accesorios" },
  { code: "I05", description: "Dados, troqueles, moldes, matrices y herramental" },
  { code: "I06", description: "Comunicaciones telefónicas" },
  { code: "I07", description: "Comunicaciones satelitales" },
  { code: "I08", description: "Otra maquinaria y equipo" },
  { code: "D01", description: "Honorarios médicos, dentales y gastos hospitalarios" },
  { code: "D02", description: "Gastos médicos por incapacidad o discapacidad" },
  { code: "D03", description: "Gastos funerales" },
  { code: "D04", description: "Donativos" },
  { code: "D05", description: "Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)" },
  { code: "D06", description: "Aportaciones voluntarias al SAR" },
  { code: "D07", description: "Primas por seguros de gastos médicos" },
  { code: "D08", description: "Gastos de transportación escolar obligatoria" },
  { code: "D09", description: "Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones" },
  { code: "D10", description: "Pagos por servicios educativos (colegiaturas)" },
  { code: "S01", description: "Sin efectos fiscales" },
  { code: "CP01", description: "Pagos" },
  { code: "CN01", description: "Nómina" },
];

/**
 * c_RegimenFiscal - Catálogo de Régimen Fiscal (Personas Morales y Físicas)
 */
export const SAT_TAX_REGIMES: SATCatalogItem[] = [
  { code: "601", description: "General de Ley Personas Morales" },
  { code: "603", description: "Personas Morales con Fines no Lucrativos" },
  { code: "605", description: "Sueldos y Salarios e Ingresos Asimilados a Salarios" },
  { code: "606", description: "Arrendamiento" },
  { code: "607", description: "Régimen de Enajenación o Adquisición de Bienes" },
  { code: "608", description: "Demás ingresos" },
  { code: "610", description: "Residentes en el Extranjero sin Establecimiento Permanente en México" },
  { code: "611", description: "Ingresos por Dividendos (socios y accionistas)" },
  { code: "612", description: "Personas Físicas con Actividades Empresariales y Profesionales" },
  { code: "614", description: "Ingresos por intereses" },
  { code: "615", description: "Régimen de los ingresos por obtención de premios" },
  { code: "616", description: "Sin obligaciones fiscales" },
  { code: "620", description: "Sociedades Cooperativas de Producción que optan por diferir sus ingresos" },
  { code: "621", description: "Incorporación Fiscal" },
  { code: "622", description: "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
  { code: "623", description: "Opcional para Grupos de Sociedades" },
  { code: "624", description: "Coordinados" },
  { code: "625", description: "Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas" },
  { code: "626", description: "Régimen Simplificado de Confianza" },
];

/**
 * c_MetodoPago - Catálogo de Método de Pago
 */
export const SAT_PAYMENT_METHODS: SATCatalogItem[] = [
  { code: "PUE", description: "Pago en una sola exhibición" },
  { code: "PPD", description: "Pago en parcialidades o diferido" },
];

/**
 * c_FormaPago - Catálogo de Forma de Pago (selección)
 */
export const SAT_PAYMENT_FORMS: SATCatalogItem[] = [
  { code: "01", description: "Efectivo" },
  { code: "02", description: "Cheque nominativo" },
  { code: "03", description: "Transferencia electrónica de fondos" },
  { code: "04", description: "Tarjeta de crédito" },
  { code: "05", description: "Monedero electrónico" },
  { code: "06", description: "Dinero electrónico" },
  { code: "08", description: "Vales de despensa" },
  { code: "12", description: "Dación en pago" },
  { code: "13", description: "Pago por subrogación" },
  { code: "14", description: "Pago por consignación" },
  { code: "15", description: "Condonación" },
  { code: "17", description: "Compensación" },
  { code: "23", description: "Novación" },
  { code: "24", description: "Confusión" },
  { code: "25", description: "Remisión de deuda" },
  { code: "26", description: "Prescripción o caducidad" },
  { code: "27", description: "A satisfacción del acreedor" },
  { code: "28", description: "Tarjeta de débito" },
  { code: "29", description: "Tarjeta de servicios" },
  { code: "30", description: "Aplicación de anticipos" },
  { code: "31", description: "Intermediario pagos" },
  { code: "99", description: "Por definir" },
];

/**
 * c_Exportacion - Catálogo de Exportación
 */
export const SAT_EXPORT_TYPES: SATCatalogItem[] = [
  { code: "01", description: "No aplica" },
  { code: "02", description: "Definitiva" },
  { code: "03", description: "Temporal" },
  { code: "04", description: "Definitiva con clave A1" },
];

/**
 * c_ClaveProdServ - Catálogo de Productos y Servicios (selección de los más comunes)
 * Catálogo completo: ~52,000 claves en http://pys.sat.gob.mx/PyS/catPyS.aspx
 */
export const SAT_PRODUCT_CODES_COMMON: SATCatalogItem[] = [
  { code: "01010101", description: "No existe en el catálogo", keywords: ["generico", "general", "default"] },
  { code: "78101500", description: "Servicios de transporte", keywords: ["transporte", "envio", "logistica", "flete"] },
  { code: "78101501", description: "Servicios de transporte de carga", keywords: ["carga", "freight"] },
  { code: "78101502", description: "Servicios de transporte de pasajeros", keywords: ["pasajeros", "passenger"] },
  { code: "78101800", description: "Servicios de carga y descarga", keywords: ["carga", "descarga", "loading"] },
  { code: "78102200", description: "Servicios de almacenamiento", keywords: ["almacen", "bodega", "warehouse"] },
  { code: "80141600", description: "Servicios de consultoría de negocios y administración corporativa", keywords: ["consultoria", "asesoria"] },
  { code: "80141604", description: "Servicios de asesoramiento empresarial", keywords: ["asesoria", "consulting"] },
  { code: "81112000", description: "Servicios de contabilidad y teneduría de libros", keywords: ["contabilidad", "accounting"] },
  { code: "81101500", description: "Servicios de asesoría y consultoría en sistemas", keywords: ["sistemas", "IT", "software"] },
  { code: "81101600", description: "Servicios de desarrollo de software o programación de computadoras", keywords: ["desarrollo", "software", "programacion"] },
  { code: "43230000", description: "Computadoras", keywords: ["computadora", "pc", "computer"] },
  { code: "44101500", description: "Papel para impresión y escritura", keywords: ["papel", "paper"] },
  { code: "44121700", description: "Artículos de papelería", keywords: ["papeleria", "stationery"] },
  { code: "46181500", description: "Relojes", keywords: ["reloj", "watch", "clock"] },
  { code: "47131600", description: "Prendas de vestir", keywords: ["ropa", "vestido", "clothing"] },
  { code: "50202300", description: "Artículos de oficina", keywords: ["oficina", "office supplies"] },
  { code: "55101500", description: "Películas cinematográficas y de video", keywords: ["video", "pelicula"] },
  { code: "60104500", description: "Instrumentos musicales", keywords: ["musica", "instrumento"] },
];

/**
 * Función de búsqueda en catálogos SAT
 */
export function searchSATCatalog(
  catalog: SATCatalogItem[],
  query: string
): SATCatalogItem[] {
  const normalizedQuery = query.toLowerCase().trim();
  
  if (!normalizedQuery) {
    return catalog;
  }

  return catalog.filter(item => {
    const codeMatch = item.code.toLowerCase().includes(normalizedQuery);
    const descMatch = item.description.toLowerCase().includes(normalizedQuery);
    const keywordMatch = item.keywords?.some(k => 
      k.toLowerCase().includes(normalizedQuery)
    );
    
    return codeMatch || descMatch || keywordMatch;
  });
}
