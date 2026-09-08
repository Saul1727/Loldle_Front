// Cliente minimo para hablar con el backend. En desarrollo, "/api/..." se queda
// relativo y el proxy de Vite lo redirige a localhost:8080 (ver vite.config.ts).
// En produccion no hay proxy (el frontend se sirve como archivos estaticos desde
// un dominio y el backend vive en otro), asi que ahi hace falta la URL completa:
// se coge de VITE_API_BASE_URL, una variable de entorno que se configura al
// desplegar (nunca hardcodeada aqui) y que en desarrollo se deja vacia.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

// Base para construir la URL del WebSocket (mismo host que la API REST): ws.ts la
// reutiliza para no duplicar la logica de "en dev es relativo, en produccion no".
export const WS_BASE_URL = API_BASE_URL;
export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("loldle_token");

  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let code = "UNKNOWN";
    let message = "Ha ocurrido un error inesperado";
    try {
      const body = await response.json();
      code = body.code ?? code;
      message = body.message ?? message;
    } catch {
      // El cuerpo no era JSON (por ejemplo un 401 sin ErrorDto); se deja el mensaje generico.
    }
    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export type AuthResponse = { token: string; username: string };

export function registerUser(username: string, password: string) {
  return request<{ username: string }>("/api/user/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function loginUser(username: string, password: string) {
  return request<AuthResponse>("/api/user/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export type GameMode = "CLASSIC" | "ABILITY" | "SPLASH_ART";

export type Room = {
  code: string;
  hostUsername: string;
  guestUsername: string | null;
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "ABANDONED";
  gameMode: GameMode;
  winnerUsername: string | null;
  currentTurnUsername: string | null;
  solo: boolean;
};

export type MatchResult = "CORRECT" | "PARTIAL" | "INCORRECT";

export type FieldResult<T> = {
  value: T;
  result: MatchResult;
};

export type YearHint = "HIGHER" | "LOWER";

// Resultado completo de un intento, tal y como lo manda el backend: cada campo ya
// trae su valor Y su color (ver FieldResult), asi el frontend no compara nada.
export type GuessResult = {
  guessedChampion: string;
  correctGuess: boolean;
  gender: FieldResult<string> | null;
  positions: FieldResult<string[]> | null;
  species: FieldResult<string> | null;
  resource: FieldResult<string> | null;
  rangeType: FieldResult<string> | null;
  region: FieldResult<string> | null;
  year: FieldResult<number> | null;
  yearHint: YearHint | null;
};

// Lo que llega a /topic/rooms/{code} cada vez que alguien intenta un campeon.
export type GuessBroadcast = {
  username: string;
  result: GuessResult | null;
  roomFinished: boolean;
  winnerUsername: string | null;
  nextTurnUsername: string | null;
};

export type RoomState = {
  room: Room;
  guesses: GuessBroadcast[];
};

export function createRoom(mode: GameMode, solo = false) {
  return request<Room>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ mode, solo }),
  });
}

export function joinRoom(code: string) {
  return request<Room>(`/api/rooms/${code}/join`, { method: "POST" });
}

export function getRoom(code: string) {
  return request<Room>(`/api/rooms/${code}`);
}

export function getRoomState(code: string) {
  return request<RoomState>(`/api/rooms/${code}/state`);
}

// Rendirse a mitad de partida (gana el rival en 1v1; en solitario simplemente
// termina la ronda sin ganador, para poder pedir otra con rematchRoom).
export function abandonRoom(code: string) {
  return request<Room>(`/api/rooms/${code}/abandon`, { method: "POST" });
}

// Misma sala, campeon nuevo. Es lo que usa tanto "Revancha" en el 1v1 como
// "Otra partida" en el modo solo infinito.
export function rematchRoom(code: string) {
  return request<Room>(`/api/rooms/${code}/rematch`, { method: "POST" });
}

export function leaveRoom(code: string) {
  return request<void>(`/api/rooms/${code}/leave`, { method: "POST" });
}

// Solo nombres, para el autocompletado del campo de intento.
export function getChampionNames() {
  return request<string[]>("/api/champion/names");
}

// Icono cuadrado de un campeon ya nombrado (el que se acaba de adivinar, nunca el
// secreto de una sala): es publico y sin JWT, asi que se puede usar directamente
// como src de un <img> normal y dejar que el navegador lo cachee por URL.
export function championIconUrl(name: string) {
  return apiUrl(`/api/champion/${encodeURIComponent(name)}/icon`);
}

// La imagen "pista" (icono de habilidad o splash art) va protegida por JWT, asi que
// no se puede usar directamente como src de un <img>: se pide con fetch y se
// convierte en un object URL. Devuelve null si el modo no tiene pista (404, p.ej.
// Clasico) para que el componente no trate eso como un error real.
export async function fetchRoomMediaUrl(code: string): Promise<string | null> {
  const token = localStorage.getItem("loldle_token");
  const response = await fetch(apiUrl(`/api/rooms/${code}/media`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ApiError(response.status, "MEDIA_ERROR", "No se pudo cargar la pista");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
