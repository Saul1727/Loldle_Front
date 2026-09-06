import { useEffect, useRef } from "react";

// Fondo animado con tema de energia hextech: motas de polvo magico ascendiendo
// despacio sobre dos halos de color (oro y cian) que respiran muy lentamente.
// Se dibuja en canvas en vez de con decenas de divs animados por CSS porque el
// numero de particulas (varias decenas) hace que un bucle de canvas rinda mejor
// que animar igual cantidad de nodos DOM por separado.
//
// Si el usuario tiene activado "reducir movimiento", se dibuja un unico frame
// estatico y no se arranca el bucle de animacion.
export function RiftBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Mote = {
      x: number;
      y: number;
      radius: number;
      speed: number;
      drift: number;
      phase: number;
      hue: "gold" | "teal";
    };

    const motes: Mote[] = [];
    const MOTE_COUNT = 46;

    function resize() {
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      width = canvasEl.clientWidth;
      height = canvasEl.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasEl.width = width * dpr;
      canvasEl.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seedMotes() {
      motes.length = 0;
      for (let i = 0; i < MOTE_COUNT; i++) {
        motes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 0.6 + Math.random() * 1.8,
          speed: 6 + Math.random() * 14,
          drift: (Math.random() - 0.5) * 10,
          phase: Math.random() * Math.PI * 2,
          hue: Math.random() > 0.65 ? "teal" : "gold",
        });
      }
    }

    function drawGlows(time: number) {
      const breathe = Math.sin(time / 4000) * 0.5 + 0.5;

      const teal = ctx!.createRadialGradient(
        width * 0.78,
        height * 0.22,
        0,
        width * 0.78,
        height * 0.22,
        Math.max(width, height) * 0.5
      );
      teal.addColorStop(0, `rgba(10, 200, 185, ${0.14 + breathe * 0.05})`);
      teal.addColorStop(1, "rgba(10, 200, 185, 0)");
      ctx!.fillStyle = teal;
      ctx!.fillRect(0, 0, width, height);

      const gold = ctx!.createRadialGradient(
        width * 0.18,
        height * 0.85,
        0,
        width * 0.18,
        height * 0.85,
        Math.max(width, height) * 0.55
      );
      gold.addColorStop(0, `rgba(200, 155, 60, ${0.12 + (1 - breathe) * 0.05})`);
      gold.addColorStop(1, "rgba(200, 155, 60, 0)");
      ctx!.fillStyle = gold;
      ctx!.fillRect(0, 0, width, height);
    }

    function drawMotes(time: number) {
      for (const mote of motes) {
        mote.y -= mote.speed / 60;
        mote.x += Math.sin(time / 1800 + mote.phase) * (mote.drift / 600);

        if (mote.y < -10) {
          mote.y = height + 10;
          mote.x = Math.random() * width;
        }

        const twinkle = 0.35 + Math.sin(time / 900 + mote.phase) * 0.25;
        const color = mote.hue === "teal" ? "10, 200, 185" : "216, 180, 120";

        ctx!.beginPath();
        ctx!.fillStyle = `rgba(${color}, ${Math.max(0, twinkle)})`;
        ctx!.arc(mote.x, mote.y, mote.radius, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function render(time: number) {
      ctx!.clearRect(0, 0, width, height);
      drawGlows(time);
      drawMotes(time);
      frame = requestAnimationFrame(render);
    }

    let frame = 0;
    resize();
    seedMotes();

    if (reduceMotion) {
      drawGlows(0);
      // Frame estatico: motas quietas, sin bucle de requestAnimationFrame.
      for (const mote of motes) {
        ctx.beginPath();
        ctx.fillStyle = mote.hue === "teal" ? "rgba(10, 200, 185, 0.3)" : "rgba(216, 180, 120, 0.3)";
        ctx.arc(mote.x, mote.y, mote.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      frame = requestAnimationFrame(render);
    }

    function handleResize() {
      resize();
      seedMotes();
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-void-950">
      <canvas ref={canvasRef} className="h-full w-full" />
      {/* Rejilla hexagonal muy tenue, estatica: aporta textura sin coste de animacion. */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(30deg, transparent 24%, rgba(200,170,110,0.6) 25%, rgba(200,170,110,0.6) 26%, transparent 27%, transparent 73%, rgba(200,170,110,0.6) 74%, rgba(200,170,110,0.6) 75%, transparent 76%)",
          backgroundSize: "64px 110px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-void-950/40 via-transparent to-void-950" />
    </div>
  );
}
