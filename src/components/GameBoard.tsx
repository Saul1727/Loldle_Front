import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Crown, Flag, Loader2, LogOut, RotateCcw } from "lucide-react";
import { HextechPanel } from "./HextechPanel";
import { HextechButton } from "./HextechButton";
import { ChampionAutocomplete } from "./ChampionAutocomplete";
import {
  ApiError,
  abandonRoom,
  fetchRoomMediaUrl,
  getChampionNames,
  getRoomState,
  leaveRoom,
  rematchRoom,
  type FieldResult,
  type GuessBroadcast,
  type MatchResult,
  type Room,
  type YearHint,
} from "../lib/api";
import { RoomSocket } from "../lib/ws";
import {
  genderLabel,
  positionLabel,
  rangeTypeLabel,
  regionLabel,
  resourceLabel,
  speciesLabel,
} from "../lib/championLabels";

// El tablero real de una partida (1v1 o solo): historial de intentos en vivo por
// WebSocket, mas el estado inicial por REST para poder reconstruirlo si se recarga
// la pagina o se entra despues de que ya haya intentos hechos.
export function GameBoard({ room: initialRoom, username, onExit }: { room: Room; username: string; onExit: () => void }) {
  const code = initialRoom.code;
  const gameMode = initialRoom.gameMode;
  const isSolo = initialRoom.solo;

  const [room, setRoom] = useState(initialRoom);
  const [guesses, setGuesses] = useState<GuessBroadcast[]>([]);
  const [championNames, setChampionNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [hintUrl, setHintUrl] = useState<string | null>(null);
  const socketRef = useRef<RoomSocket | null>(null);
  const hintUrlRef = useRef<string | null>(null);

  async function loadHint() {
    if (gameMode === "CLASSIC") return;
    try {
      const url = await fetchRoomMediaUrl(code);
      if (hintUrlRef.current) URL.revokeObjectURL(hintUrlRef.current);
      hintUrlRef.current = url;
      setHintUrl(url);
    } catch {
      // Sin pista disponible no es un fallo critico: se puede seguir jugando a ciegas.
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [state, names] = await Promise.all([getRoomState(code), getChampionNames()]);
        if (cancelled) return;
        setRoom(state.room);
        setGuesses([...state.guesses].reverse());
        setChampionNames(names);
        await loadHint();
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "No se pudo cargar la partida");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line
  }, [code]);

  useEffect(() => {
    const socket = new RoomSocket(code, {
      onRoomUpdate: (updated) => {
        setRoom((prev) => {
          const wasTerminal = prev.status === "FINISHED" || prev.status === "ABANDONED";
          if (wasTerminal && updated.status === "IN_PROGRESS") {
            setGuesses([]);
            setError(null);
            void loadHint();
          }
          return updated;
        });
      },
      onGuess: (guess) => {
        setPending(false);
        setGuesses((prev) => [guess, ...prev]);
        setRoom((prev) => ({
          ...prev,
          status: guess.roomFinished ? "FINISHED" : prev.status,
          winnerUsername: guess.winnerUsername ?? prev.winnerUsername,
          currentTurnUsername: guess.nextTurnUsername ?? prev.currentTurnUsername,
        }));
      },
      onError: (message) => {
        setPending(false);
        setError(message);
      },
    });
    socketRef.current = socket;
    socket.connect();
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line
  }, [code]);

  useEffect(() => {
    return () => {
      if (hintUrlRef.current) URL.revokeObjectURL(hintUrlRef.current);
    };
  }, []);

  const isMyTurn =
    room.status === "IN_PROGRESS" &&
    (isSolo || (room.currentTurnUsername?.toLowerCase() ?? "") === username.toLowerCase());
  const opponentUsername = isSolo
    ? null
    : room.hostUsername.toLowerCase() === username.toLowerCase()
      ? room.guestUsername
      : room.hostUsername;
  const isTerminal = room.status === "FINISHED" || room.status === "ABANDONED";

  function handleGuess(name: string) {
    if (!socketRef.current || pending || !isMyTurn) return;
    setError(null);
    setPending(true);
    socketRef.current.guess(code, name);
  }

  async function handleAbandon() {
    setError(null);
    setPending(true);
    try {
      await abandonRoom(code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo rendir la partida");
    } finally {
      setPending(false);
    }
  }

  async function handleRematch() {
    setError(null);
    setPending(true);
    try {
      await rematchRoom(code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo pedir otra partida");
      setPending(false);
    }
  }

  async function handleLeave() {
    setPending(true);
    try {
      await leaveRoom(code);
    } catch {
      // Si la sala ya no existe (el rival tambien salio y se borro), da igual: salimos.
    } finally {
      socketRef.current?.disconnect();
      onExit();
    }
  }

  function endMessage(): string {
    if (room.status === "FINISHED") {
      if (isSolo) {
        const revealed = guesses.find((g) => g.result?.correctGuess)?.result?.guessedChampion;
        return revealed ? `Acertaste. Era ${revealed}.` : "Acertaste.";
      }
      return room.winnerUsername?.toLowerCase() === username.toLowerCase()
        ? "Has ganado el duelo."
        : `Ha ganado ${room.winnerUsername ?? "tu rival"}.`;
    }
    if (isSolo) return "Te has rendido.";
    if (room.winnerUsername?.toLowerCase() === username.toLowerCase()) {
      return "Tu rival ha abandonado: has ganado.";
    }
    return "Has abandonado la partida.";
  }

  const won = room.status === "FINISHED" && (isSolo || room.winnerUsername?.toLowerCase() === username.toLowerCase());

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gold-300" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="mx-auto flex max-w-3xl flex-col gap-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold-200/50">
            {isSolo ? "Solo infinito" : `${room.hostUsername} vs ${room.guestUsername ?? "?"}`}
          </p>
          <p className="font-display text-lg font-semibold text-gold-100">
            {gameMode === "CLASSIC" ? "Clasico" : gameMode === "ABILITY" ? "Habilidad" : "Splash Art"}
          </p>
        </div>
        {!isSolo && room.status === "IN_PROGRESS" && (
          <p className="text-sm uppercase tracking-widest">
            {isMyTurn ? (
              <span className="text-teal-300">Tu turno</span>
            ) : (
              <span className="text-gold-200/60">Turno de {opponentUsername ?? "tu rival"}</span>
            )}
          </p>
        )}
      </div>

      {gameMode !== "CLASSIC" && (
        <HextechPanel className="mx-auto flex w-full max-w-xs flex-col items-center gap-3 p-4">
          <p className="text-xs uppercase tracking-widest text-gold-200/60">
            {gameMode === "ABILITY" ? "Icono de habilidad" : "Splash art"}
          </p>
          <div className="h-40 w-40 overflow-hidden border border-gold-700/50 bg-void-950/70">
            {hintUrl ? (
              <img
                src={hintUrl}
                alt="Pista del campeon secreto"
                className="h-full w-full object-cover"
                style={
                  gameMode === "SPLASH_ART"
                    ? { transform: `scale(${Math.max(1, 3.2 - guesses.length * 0.4)})`, transition: "transform 0.4s ease-out" }
                    : undefined
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gold-300" />
              </div>
            )}
          </div>
        </HextechPanel>
      )}

      {isTerminal && (
        <HextechPanel className="flex flex-col items-center gap-4 p-6 text-center">
          {won ? (
            <Crown className="h-7 w-7 text-teal-300" strokeWidth={1.5} />
          ) : (
            <Flag className="h-7 w-7 text-gold-300" strokeWidth={1.5} />
          )}
          <p className="font-display text-lg font-semibold text-gold-100">{endMessage()}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <HextechButton onClick={handleRematch} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {isSolo ? "Otra partida" : "Revancha"}
            </HextechButton>
            <HextechButton variant="ghost" onClick={handleLeave} disabled={pending}>
              <LogOut className="h-4 w-4" /> Salir
            </HextechButton>
          </div>
        </HextechPanel>
      )}

      {room.status === "IN_PROGRESS" && (
        <HextechPanel className="flex flex-col gap-3 p-4">
          <ChampionAutocomplete names={championNames} disabled={!isMyTurn || pending} onGuess={handleGuess} />
          <div className="flex items-center justify-between">
            {!isMyTurn && !isSolo && <p className="text-xs text-gold-200/50">Espera tu turno...</p>}
            <button
              type="button"
              onClick={handleAbandon}
              disabled={pending}
              className="ml-auto flex items-center gap-1.5 text-xs text-gold-200/40 transition-colors duration-150 hover:text-blood-500 disabled:opacity-40"
            >
              <Flag className="h-3.5 w-3.5" /> Rendirse
            </button>
          </div>
        </HextechPanel>
      )}

      {error && (
        <p className="border border-blood-500/40 bg-blood-500/10 px-4 py-2 text-center text-sm text-blood-500">{error}</p>
      )}

      {guesses.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex min-w-[640px] flex-col gap-1.5">
            {gameMode === "CLASSIC" && (
              <div className="grid grid-cols-8 gap-1.5 px-1 text-[10px] uppercase tracking-wider text-gold-200/50">
                <span>Campeon</span>
                <span>Genero</span>
                <span>Posicion</span>
                <span>Especie</span>
                <span>Recurso</span>
                <span>Alcance</span>
                <span>Region</span>
                <span>Año</span>
              </div>
            )}
            {guesses.map((guess, index) => (
              <GuessRow key={`${guess.username}-${index}`} guess={guess} mode={gameMode} showUsername={!isSolo} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function cellClasses(result?: MatchResult) {
  switch (result) {
    case "CORRECT":
      return "border-teal-400/60 bg-teal-400/15 text-teal-100";
    case "PARTIAL":
      return "border-gold-300/60 bg-gold-300/15 text-gold-100";
    case "INCORRECT":
      return "border-blood-500/50 bg-blood-500/10 text-blood-400";
    default:
      return "border-gold-700/40 bg-void-950/60 text-gold-200/60";
  }
}

function Cell({ label, result, bold }: { label: string; result?: MatchResult; bold?: boolean }) {
  return (
    <div
      className={`flex min-h-[3rem] items-center justify-center border px-1.5 py-1 text-center text-xs ${cellClasses(result)} ${
        bold ? "font-display font-semibold" : ""
      }`}
    >
      {label}
    </div>
  );
}

function YearCell({ fieldResult, hint }: { fieldResult?: FieldResult<number> | null; hint?: YearHint | null }) {
  if (!fieldResult) return <Cell label="?" />;
  return (
    <div className={`flex min-h-[3rem] items-center justify-center gap-1 border px-1.5 py-1 text-xs ${cellClasses(fieldResult.result)}`}>
      <span>{fieldResult.value}</span>
      {hint === "HIGHER" && <ArrowUp className="h-3.5 w-3.5" />}
      {hint === "LOWER" && <ArrowDown className="h-3.5 w-3.5" />}
    </div>
  );
}

function GuessRow({
  guess,
  mode,
  showUsername,
}: {
  guess: GuessBroadcast;
  mode: Room["gameMode"];
  showUsername: boolean;
}) {
  const r = guess.result;

  if (mode !== "CLASSIC") {
    return (
      <div
        className={`flex items-center justify-between border px-4 py-2.5 text-sm ${
          r?.correctGuess
            ? "border-teal-400/60 bg-teal-400/15 text-teal-100"
            : "border-blood-500/40 bg-blood-500/10 text-blood-400"
        }`}
      >
        <span>{r?.guessedChampion ?? "?"}</span>
        {showUsername && <span className="text-xs text-gold-200/50">{guess.username}</span>}
      </div>
    );
  }

  if (!r) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {showUsername && <span className="px-1 text-[10px] uppercase tracking-wider text-gold-200/40">{guess.username}</span>}
      <div className="grid grid-cols-8 gap-1.5">
        <Cell label={r.guessedChampion} result={r.correctGuess ? "CORRECT" : "INCORRECT"} bold />
        <Cell label={genderLabel(r.gender?.value)} result={r.gender?.result} />
        <Cell label={(r.positions?.value ?? []).map(positionLabel).join(" / ") || "?"} result={r.positions?.result} />
        <Cell label={speciesLabel(r.species?.value)} result={r.species?.result} />
        <Cell label={resourceLabel(r.resource?.value)} result={r.resource?.result} />
        <Cell label={rangeTypeLabel(r.rangeType?.value)} result={r.rangeType?.result} />
        <Cell label={regionLabel(r.region?.value)} result={r.region?.result} />
        <YearCell fieldResult={r.year} hint={r.yearHint} />
      </div>
    </div>
  );
}
