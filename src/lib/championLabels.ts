// Traducciones al espanol de los enums del backend, solo para pintar el tablero.
// Los valores que no aparecen aqui (sobre todo en Species, que tiene un monton de
// variantes raras) caen en el "fallback" de abajo: no hace falta mantener una lista
// exhaustiva para que la tabla siga siendo legible.

const GENDER: Record<string, string> = {
  MALE: "Masculino",
  FEMALE: "Femenino",
  OTHERS: "Otro",
};

const POSITION: Record<string, string> = {
  TOP: "Superior",
  JUNGLE: "Jungla",
  MIDDLE: "Medio",
  BOTTOM: "Inferior",
  SUPPORT: "Soporte",
};

const RESOURCE: Record<string, string> = {
  MANA: "Mana",
  COURAGE: "Coraje",
  ENERGY: "Energia",
  MANALESS: "Sin recurso",
  RAGE: "Furia",
  HEALTH_COSTS: "Salud",
};

const RANGE_TYPE: Record<string, string> = {
  MELEE: "Cuerpo a cuerpo",
  RANGE: "Distancia",
  MELEE_RANGE: "Mixto",
};

const REGION: Record<string, string> = {
  DEMACIA: "Demacia",
  NOXUS: "Noxus",
  IONIA: "Ionia",
  FRELJORD: "Freljord",
  SHURIMA: "Shurima",
  PILTOVER: "Piltover",
  ZAUN: "Zaun",
  BANDLE_CITY: "Bandle",
  BILGEWATER: "Bilgewater",
  TARGON: "Targon",
  VOID: "El Vacio",
  SHADOW_ISLES: "Islas Sombrias",
  IXTAL: "Ixtal",
  RUNETERRA: "Runaterra",
  UNKNOWN: "Desconocida",
};

function fallback(raw: string): string {
  return raw
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function label(dict: Record<string, string>, raw: string | null | undefined): string {
  if (!raw) return "?";
  return dict[raw] ?? fallback(raw);
}

export function genderLabel(raw: string | null | undefined) {
  return label(GENDER, raw);
}

export function positionLabel(raw: string | null | undefined) {
  return label(POSITION, raw);
}

export function speciesLabel(raw: string | null | undefined) {
  return raw ? fallback(raw) : "?";
}

export function resourceLabel(raw: string | null | undefined) {
  return label(RESOURCE, raw);
}

export function rangeTypeLabel(raw: string | null | undefined) {
  return label(RANGE_TYPE, raw);
}

export function regionLabel(raw: string | null | undefined) {
  return label(REGION, raw);
}
