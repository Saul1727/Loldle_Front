import { Client } from "@stomp/stompjs";
import type { IMessage, StompSubscription } from "@stomp/stompjs";
import * as SockJS from "sockjs-client";
import { WS_BASE_URL, type GuessBroadcast, type Room } from "./api";

// Un mensaje en /topic/rooms/{code} es o bien una actualizacion de la sala (alguien
// se une, abandona o pide revancha: forma de RoomDto) o bien el resultado de un
// intento (forma de GuessBroadcastDto). Se distinguen por "result", que solo tiene
// el segundo (siempre presente ahi, nunca en RoomDto).
function isGuessBroadcast(payload: object): payload is GuessBroadcast {
  return "result" in payload;
}

export type RoomSocketHandlers = {
  onRoomUpdate: (room: Room) => void;
  onGuess: (guess: GuessBroadcast) => void;
  onError: (message: string) => void;
  onConnected?: () => void;
};

// Conexion en vivo a una sala: STOMP sobre SockJS, igual que el backend expone el
// endpoint (ver WebSocketConfig.withSockJS()). El JWT va como header nativo STOMP en
// el CONNECT, tal y como espera JwtChannelInterceptor.
export class RoomSocket {
  private client: Client;
  private roomSub: StompSubscription | null = null;
  private errorSub: StompSubscription | null = null;

  constructor(code: string, handlers: RoomSocketHandlers) {
    const token = localStorage.getItem("loldle_token") ?? "";

    this.client = new Client({
      webSocketFactory: () => new (SockJS as unknown as { new (url: string): WebSocket })(`${WS_BASE_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 3000,
      onConnect: () => {
        this.roomSub = this.client.subscribe(`/topic/rooms/${code}`, (message: IMessage) => {
          const payload = JSON.parse(message.body) as object;
          if (isGuessBroadcast(payload)) {
            handlers.onGuess(payload);
          } else {
            handlers.onRoomUpdate(payload as Room);
          }
        });
        this.errorSub = this.client.subscribe("/user/queue/errors", (message: IMessage) => {
          const payload = JSON.parse(message.body) as { code: string; message: string };
          handlers.onError(payload.message);
        });
        handlers.onConnected?.();
      },
    });
  }

  connect() {
    this.client.activate();
  }

  // Manda un intento a /app/rooms/{code}/guess (ver GameController); el resultado
  // llega de vuelta por el topic de la sala, no como respuesta directa de esto.
  guess(code: string, championName: string) {
    this.client.publish({
      destination: `/app/rooms/${code}/guess`,
      body: JSON.stringify({ championName }),
    });
  }

  disconnect() {
    this.roomSub?.unsubscribe();
    this.errorSub?.unsubscribe();
    this.roomSub = null;
    this.errorSub = null;
    void this.client.deactivate();
  }
}
