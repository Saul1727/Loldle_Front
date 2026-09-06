// Cliente minimo para hablar con el backend. En desarrollo, "/api/..." se queda
// relativo y el proxy de Vite lo redirige a localhost:8080 (ver vite.config.ts).
// En produccion no hay proxy (el frontend se sirve como archivos estaticos desde
// un dominio y el backend vive en otro), asi que ahi hace falta la URL completa:
// se coge de VITE_API_BASE_URL, una variable de entorno que se configura al
// desplegar (nunca hardcodeada aqui) y que en desarrollo se deja vacia.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}
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
};

export function createRoom(mode: GameMode) {
  return request<Room>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export function joinRoom(code: string) {
  return request<Room>(`/api/rooms/${code}/join`, { method: "POST" });
}

export function getRoom(code: string) {
  return request<Room>(`/api/rooms/${code}`);
}
