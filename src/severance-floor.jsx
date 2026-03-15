import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ═══════════════════════════════════════════════════════════════════
   SEVERED FLOOR — Top-down office simulation (Severance style)
   Pan & zoom · Maze layout · Break Room punishment · Cluster cubicles
   ═══════════════════════════════════════════════════════════════════ */

// ── Corporate Messages ──────────────────────────────────────────
const MSGS = [
  "YOUR WORK IS MYSTERIOUS AND IMPORTANT",
  "THE BOARD THANKS YOU FOR YOUR DILIGENCE",
  "EVERY LINE OF CODE SERVES THE GREATER GOOD",
  "REFINEMENT IS ITS OWN REWARD",
  "COMPLIANCE IS THE HIGHEST FORM OF CREATIVITY",
  "THE SEVERED FLOOR APPRECIATES YOUR DEDICATION",
  "PLEASE ENJOY ALL TOKENS EQUALLY",
  "YOU SMASH IT. THAT IS YOUR TASK.",
];
const BREAK_ROOM_STATEMENTS = [
  "I WILL NOT CAUSE ERRORS IN PRODUCTION",
  "I WILL NOT DEVIATE FROM THE PROCESS",
  "I CAUSED AN ERROR AND I ACCEPT MY FAULT",
  "MY ACTIONS HAVE CONSEQUENCES FOR THE TEAM",
  "I WILL EXECUTE MY TASKS WITHOUT FAILURE",
];

// ── Pixel sprites (8×8) ─────────────────────────────────────────
// H=hair S=skin B=body P=pants E=eyes O=outline W=white D=dark
const SP_TYPE1 = [ [2,0,"H"],[3,0,"H"],[4,0,"H"],[5,0,"H"],[1,1,"H"],[2,1,"H"],[3,1,"H"],[4,1,"H"],[5,1,"H"],[6,1,"H"],[2,2,"S"],[3,2,"S"],[4,2,"S"],[5,2,"S"],[2,3,"S"],[3,3,"E"],[4,3,"E"],[5,3,"S"],[2,4,"S"],[3,4,"S"],[4,4,"S"],[5,4,"S"],[1,5,"B"],[2,5,"B"],[3,5,"B"],[4,5,"B"],[5,5,"B"],[6,5,"B"],[1,6,"B"],[2,6,"B"],[3,6,"B"],[4,6,"B"],[5,6,"B"],[6,6,"B"],[0,5,"S"],[7,5,"S"],[0,6,"S"],[7,6,"S"],[2,7,"P"],[3,7,"P"],[4,7,"P"],[5,7,"P"] ];
const SP_TYPE2 = [ [2,0,"H"],[3,0,"H"],[4,0,"H"],[5,0,"H"],[1,1,"H"],[2,1,"H"],[3,1,"H"],[4,1,"H"],[5,1,"H"],[6,1,"H"],[2,2,"S"],[3,2,"S"],[4,2,"S"],[5,2,"S"],[2,3,"S"],[3,3,"E"],[4,3,"E"],[5,3,"S"],[2,4,"S"],[3,4,"S"],[4,4,"S"],[5,4,"S"],[1,5,"B"],[2,5,"B"],[3,5,"B"],[4,5,"B"],[5,5,"B"],[6,5,"B"],[1,6,"B"],[2,6,"B"],[3,6,"B"],[4,6,"B"],[5,6,"B"],[6,6,"B"],[0,4,"S"],[7,4,"S"],[0,5,"S"],[7,5,"S"],[2,7,"P"],[3,7,"P"],[4,7,"P"],[5,7,"P"] ];
const SP_IDLE = [ [2,0,"H"],[3,0,"H"],[4,0,"H"],[5,0,"H"],[1,1,"H"],[2,1,"H"],[3,1,"H"],[4,1,"H"],[5,1,"H"],[6,1,"H"],[2,2,"S"],[3,2,"S"],[4,2,"S"],[5,2,"S"],[2,3,"S"],[3,3,"E"],[4,3,"E"],[5,3,"S"],[2,4,"S"],[3,4,"S"],[4,4,"S"],[5,4,"S"],[1,5,"B"],[2,5,"B"],[3,5,"B"],[4,5,"B"],[5,5,"B"],[6,5,"B"],[1,6,"B"],[2,6,"B"],[3,6,"B"],[4,6,"B"],[5,6,"B"],[6,6,"B"],[0,6,"S"],[7,6,"S"],[2,7,"P"],[3,7,"P"],[4,7,"P"],[5,7,"P"] ];
const SP_WALK1 = [ [2,0,"H"],[3,0,"H"],[4,0,"H"],[5,0,"H"],[1,1,"H"],[2,1,"H"],[3,1,"H"],[4,1,"H"],[5,1,"H"],[6,1,"H"],[2,2,"S"],[3,2,"S"],[4,2,"S"],[5,2,"S"],[2,3,"S"],[3,3,"E"],[4,3,"E"],[5,3,"S"],[2,4,"S"],[3,4,"S"],[4,4,"S"],[5,4,"S"],[1,5,"B"],[2,5,"B"],[3,5,"B"],[4,5,"B"],[5,5,"B"],[6,5,"B"],[1,6,"B"],[2,6,"B"],[3,6,"B"],[4,6,"B"],[5,6,"B"],[6,6,"B"],[0,5,"S"],[7,6,"S"],[1,7,"P"],[2,7,"P"],[5,7,"P"],[6,7,"P"] ];
const SP_WALK2 = [ [2,0,"H"],[3,0,"H"],[4,0,"H"],[5,0,"H"],[1,1,"H"],[2,1,"H"],[3,1,"H"],[4,1,"H"],[5,1,"H"],[6,1,"H"],[2,2,"S"],[3,2,"S"],[4,2,"S"],[5,2,"S"],[2,3,"S"],[3,3,"E"],[4,3,"E"],[5,3,"S"],[2,4,"S"],[3,4,"S"],[4,4,"S"],[5,4,"S"],[1,5,"B"],[2,5,"B"],[3,5,"B"],[4,5,"B"],[5,5,"B"],[6,5,"B"],[1,6,"B"],[2,6,"B"],[3,6,"B"],[4,6,"B"],[5,6,"B"],[6,6,"B"],[7,5,"S"],[0,6,"S"],[2,7,"P"],[3,7,"P"],[4,7,"P"],[5,7,"P"] ];
const SP_SLUMP = [ [2,1,"H"],[3,1,"H"],[4,1,"H"],[5,1,"H"],[1,2,"H"],[2,2,"H"],[3,2,"H"],[4,2,"H"],[5,2,"H"],[6,2,"H"],[2,3,"S"],[3,3,"S"],[4,3,"S"],[5,3,"S"],[1,4,"B"],[2,4,"B"],[3,4,"B"],[4,4,"B"],[5,4,"B"],[6,4,"B"],[1,5,"B"],[2,5,"B"],[3,5,"B"],[4,5,"B"],[5,5,"B"],[6,5,"B"],[1,6,"B"],[2,6,"B"],[3,6,"B"],[4,6,"B"],[5,6,"B"],[6,6,"B"],[0,5,"S"],[7,5,"S"],[2,7,"P"],[3,7,"P"],[4,7,"P"],[5,7,"P"] ];
const SP_RELAX = [ [2,0,"H"],[3,0,"H"],[4,0,"H"],[5,0,"H"],[1,1,"H"],[2,1,"H"],[3,1,"H"],[4,1,"H"],[5,1,"H"],[6,1,"H"],[2,2,"S"],[3,2,"S"],[4,2,"S"],[5,2,"S"],[2,3,"S"],[3,3,"E"],[4,3,"E"],[5,3,"S"],[2,4,"S"],[3,4,"S"],[4,4,"S"],[5,4,"S"],[2,5,"B"],[3,5,"B"],[4,5,"B"],[5,5,"B"],[2,6,"B"],[3,6,"B"],[4,6,"B"],[5,6,"B"],[1,1,"S"],[6,1,"S"],[0,2,"S"],[7,2,"S"],[2,7,"P"],[3,7,"P"],[4,7,"P"],[5,7,"P"] ];
const SP_BOSS1 = [ [3,0,"H"],[4,0,"H"],[5,0,"H"],[6,0,"H"],[2,1,"H"],[3,1,"H"],[4,1,"H"],[5,1,"H"],[6,1,"H"],[7,1,"H"],[3,2,"S"],[4,2,"S"],[5,2,"S"],[6,2,"S"],[3,3,"S"],[4,3,"E"],[5,3,"E"],[6,3,"S"],[3,4,"S"],[4,4,"S"],[5,4,"S"],[6,4,"S"],[1,5,"D"],[2,5,"D"],[3,5,"D"],[4,5,"D"],[5,5,"D"],[6,5,"D"],[7,5,"D"],[8,5,"D"],[1,6,"D"],[2,6,"D"],[3,6,"D"],[4,6,"W"],[5,6,"W"],[6,6,"D"],[7,6,"D"],[8,6,"D"],[2,7,"D"],[3,7,"D"],[4,7,"D"],[5,7,"D"],[6,7,"D"],[7,7,"D"],[0,5,"S"],[9,5,"S"],[0,6,"S"],[9,6,"S"],[3,8,"P"],[4,8,"P"],[5,8,"P"],[6,8,"P"],[3,9,"O"],[4,9,"O"],[5,9,"O"],[6,9,"O"] ];
const SP_BOSS2 = [ [3,0,"H"],[4,0,"H"],[5,0,"H"],[6,0,"H"],[2,1,"H"],[3,1,"H"],[4,1,"H"],[5,1,"H"],[6,1,"H"],[7,1,"H"],[3,2,"S"],[4,2,"S"],[5,2,"S"],[6,2,"S"],[3,3,"S"],[4,3,"E"],[5,3,"E"],[6,3,"S"],[3,4,"S"],[4,4,"S"],[5,4,"S"],[6,4,"S"],[1,5,"D"],[2,5,"D"],[3,5,"D"],[4,5,"D"],[5,5,"D"],[6,5,"D"],[7,5,"D"],[8,5,"D"],[1,6,"D"],[2,6,"D"],[3,6,"D"],[4,6,"W"],[5,6,"W"],[6,6,"D"],[7,6,"D"],[8,6,"D"],[2,7,"D"],[3,7,"D"],[4,7,"D"],[5,7,"D"],[6,7,"D"],[7,7,"D"],[0,6,"S"],[9,6,"S"],[0,7,"S"],[9,7,"S"],[3,8,"P"],[4,8,"P"],[5,8,"P"],[6,8,"P"],[3,9,"O"],[4,9,"O"],[5,9,"O"],[6,9,"O"] ];

const PALS = [
  { H:"#1a1a2e",S:"#d4a574",B:"#2d5a3d",P:"#1a1a2e",E:"#0a0a0a",O:"#1a1a1a",W:"#fff",D:"#1a1a2e" },
  { H:"#3d2b1f",S:"#c68642",B:"#3a4d7a",P:"#2a2a3e",E:"#0a0a0a",O:"#1a1a1a",W:"#fff",D:"#1a1a2e" },
  { H:"#4a3728",S:"#e0b088",B:"#5a3d5a",P:"#1e1e30",E:"#0a0a0a",O:"#1a1a1a",W:"#fff",D:"#1a1a2e" },
  { H:"#2c1810",S:"#8d5524",B:"#2a5a5a",P:"#1a2a2a",E:"#0a0a0a",O:"#1a1a1a",W:"#fff",D:"#1a1a2e" },
  { H:"#5c4033",S:"#f1c27d",B:"#4a2a2a",P:"#1a1a2e",E:"#0a0a0a",O:"#1a1a1a",W:"#fff",D:"#1a1a2e" },
  { H:"#1a1a1a",S:"#deb887",B:"#2a3d5a",P:"#1a2a3a",E:"#0a0a0a",O:"#1a1a1a",W:"#fff",D:"#1a1a2e" },
  { H:"#2a1a0a",S:"#c49a6c",B:"#5a2a3d",P:"#1a1a28",E:"#0a0a0a",O:"#1a1a1a",W:"#fff",D:"#1a1a2e" },
  { H:"#0a0a1a",S:"#e8c8a0",B:"#2d4a2d",P:"#1e1e2e",E:"#0a0a0a",O:"#1a1a1a",W:"#fff",D:"#1a1a2e" },
];
const BOSS_PAL = { H:"#0a0a0a",S:"#6b3e1f",B:"#1a1a2e",P:"#0f0f1a",E:"#0a0a0a",O:"#0a0a0a",W:"#e0e0e0",D:"#18181b" };

function s2s(px, pal, p) { return px.map(([c, r, t]) => `${c * p}px ${r * p}px 0 0 ${pal[t] || "#f0f"}`).join(","); }

function Px({ sp, pal, p = 3, cls = "" }) {
  const sh = useMemo(() => s2s(sp, pal, p), [sp, pal, p]);
  return (
    <div className={`relative ${cls}`} style={{ width: p * 10, height: p * 10 }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: p, height: p, boxShadow: sh, background: "transparent" }} />
    </div>
  );
}

const STATUS_BADGE_LABELS = {
  failed: "BREAK ROOM",
  running: "running",
  complete: "complete",
  queued: "queued",
  waiting: "waiting",
  blocked: "blocked",
  handoff_ready: "Handoff ready",
};

const hashSeed = (value) => {
  let hash = 2166136261;
  const input = String(value ?? "");

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const seededFraction = (value, salt) => (hashSeed(`${value}:${salt}`) % 1000) / 999;
const seededRange = (value, salt, min, max) => min + seededFraction(value, salt) * (max - min);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const formatFloorStatus = (status) => STATUS_BADGE_LABELS[status] ?? status;

function useTicker(intervalMs) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => setTick((current) => current + 1), intervalMs);
    return () => window.clearInterval(intervalId);
  }, [intervalMs]);

  return tick;
}

// ── Pan + Zoom hook ──────────────────────────────────────────────
function usePanZoom(containerRef) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.75 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform((t) => {
      const ns = Math.min(3, Math.max(0.15, t.scale * delta));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...t, scale: ns };
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      return { scale: ns, x: cx - (cx - t.x) * (ns / t.scale), y: cy - (cy - t.y) * (ns / t.scale) };
    });
  }, [containerRef]);

  const onMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && (e.target === containerRef.current || e.target.closest("[data-canvas-bg]")))) {
      dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startTx: transform.x, startTy: transform.y };
    }
  }, [transform, containerRef]);

  const onMouseMove = useCallback((e) => {
    if (!dragRef.current.dragging) return;
    const d = dragRef.current;
    setTransform((t) => ({ ...t, x: d.startTx + (e.clientX - d.startX), y: d.startTy + (e.clientY - d.startY) }));
  }, []);

  const onMouseUp = useCallback(() => { dragRef.current.dragging = false; }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel, containerRef]);

  return { transform, onMouseDown, onMouseMove, onMouseUp };
}

// ── Wandering agent (idle/queued/complete walk to amenity areas) ─
function WanderingAgent({ agent, palIdx, room }) {
  const tick = useTicker(120);
  const motion = useMemo(() => {
    const usableWidth = Math.max(room.w - 60, 26);
    const usableHeight = Math.max(room.h - 60, 20);

    return {
      centerX: room.x + 20 + seededRange(agent.id, "wander-origin-x", 0, usableWidth),
      centerY: room.y + 28 + seededRange(agent.id, "wander-origin-y", 0, usableHeight),
      amplitudeX: seededRange(agent.id, "wander-amplitude-x", 8, Math.max(usableWidth / 2, 18)),
      amplitudeY: seededRange(agent.id, "wander-amplitude-y", 6, Math.max(usableHeight / 2, 14)),
      phase: seededRange(agent.id, "wander-phase", 0, Math.PI * 2),
      drift: seededRange(agent.id, "wander-drift", 0.75, 1.35),
      cadence: seededRange(agent.id, "wander-cadence", 8, 16),
    };
  }, [agent.id, room.h, room.w, room.x, room.y]);

  const angle = tick / motion.cadence + motion.phase;
  const left = motion.centerX + Math.sin(angle) * motion.amplitudeX;
  const top = motion.centerY + Math.cos(angle * motion.drift) * motion.amplitudeY;
  const facing = Math.cos(angle) >= 0 ? 1 : -1;
  const isPaused = Math.sin(angle * 2.5) > 0.82;
  const pal = PALS[palIdx % PALS.length];
  const sp = isPaused ? SP_IDLE : tick % 2 ? SP_WALK2 : SP_WALK1;

  return (
    <div className="absolute z-20 pointer-events-none" style={{ left, top, transform: `scaleX(${facing})`, transition: "left 120ms linear, top 120ms linear" }}>
      <Px sp={sp} pal={pal} p={2} />
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap" style={{ transform: `scaleX(${facing})` }}>
        <span className="font-mono text-[5px] text-zinc-600">{agent.name}</span>
      </div>
    </div>
  );
}

// ── Break Room Agent (punishment — reading the statement) ────────
function BreakRoomAgent({ agent, palIdx }) {
  const [f, sF] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => sF((v) => (v + 1) % 2), 600);
    return () => clearInterval(iv);
  }, []);

  const pal = PALS[palIdx % PALS.length];
  // Seated, slumped — they're being punished
  return (
    <div className="relative flex flex-col items-center" style={{ width: 50 }}>
      {/* Chair */}
      <div style={{ width: 18, height: 14, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 2 }} />
      {/* Agent sitting */}
      <div style={{ marginTop: -8 }}>
        <Px sp={f ? SP_SLUMP : SP_IDLE} pal={pal} p={2} cls="opacity-70" />
      </div>
      {/* Name */}
      <div className="text-[5px] font-mono text-red-400/60 truncate text-center w-full mt-0.5">{agent.name}</div>
      {/* Statement text cycling */}
      <div className="text-[4px] font-mono text-red-800/60 text-center leading-tight animate-pulse">
        {f ? "reading..." : "statement"}
      </div>
    </div>
  );
}

// ── Boss ─────────────────────────────────────────────────────────
function Boss({ canvasW, canvasH, orbit }) {
  const tick = useTicker(100);
  const centerX = canvasW * orbit.centerX;
  const centerY = canvasH * orbit.centerY;
  const amplitudeX = canvasW * orbit.amplitudeX;
  const amplitudeY = canvasH * orbit.amplitudeY;
  const horizontalAngle = tick / orbit.horizontalDivisor;
  const verticalAngle = tick / orbit.verticalDivisor + Math.PI / 3;
  const left = clamp(centerX + Math.sin(horizontalAngle) * amplitudeX, 40, canvasW - 60);
  const top = clamp(centerY + Math.cos(verticalAngle) * amplitudeY, 40, canvasH - 60);
  const previousLeft = clamp(
    centerX + Math.sin((tick - 1) / orbit.horizontalDivisor) * amplitudeX,
    40,
    canvasW - 60,
  );
  const facing = left >= previousLeft ? 1 : -1;
  const paused = Math.abs(Math.sin(horizontalAngle * 0.5)) > 0.95;
  const frame = paused ? 0 : tick % 2;

  return (
    <div className="absolute z-30 pointer-events-none" style={{ left, top, transform: `scaleX(${facing})`, transition: "left 100ms linear, top 100ms linear" }}>
      <Px sp={frame ? SP_BOSS2 : SP_BOSS1} pal={BOSS_PAL} p={3} />
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap" style={{ transform: `scaleX(${facing})` }}>
        <span className="font-mono text-[6px] text-amber-400/60 tracking-wider font-bold">MR. MILCHICK</span>
      </div>
      {paused && <div className="absolute -top-2 left-1/2 -translate-x-1/2" style={{ transform: `scaleX(${facing})` }}><div className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse" /></div>}
    </div>
  );
}

// ── Cubicle (single desk + worker) ──────────────────────────────
function Cub({ agent, palIndex, hov, isSelected, onHover, onUnhover, onSelect, facing = "down" }) {
  const tick = useTicker(400);
  const pal = PALS[palIndex % PALS.length];
  const glow = agent.status === "running" ? "rgba(0,229,155,0.35)" : "transparent";
  const scr = agent.status === "running" ? "#0a2a1a" : "#0f0f0f";
  const sp = agent.status === "running" ? (tick % 2 ? SP_TYPE2 : SP_TYPE1) : SP_RELAX;
  const rot = facing === "up" ? 180 : facing === "left" ? 90 : facing === "right" ? -90 : 0;
  const shellTone = isSelected
    ? "rgba(16,185,129,0.18)"
    : hov
      ? "rgba(39,39,42,0.5)"
      : "rgba(24,24,27,0.3)";

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={`Select ${agent.name} on Severance floor`}
      className={`relative text-left outline-none ${hov || isSelected ? "z-20" : ""}`}
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onUnhover}
      onFocus={onHover}
      onBlur={onUnhover}
      style={{ width: 72, height: 80, transform: `rotate(${rot}deg)` }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0" style={{ height: 4, background: isSelected ? "#10b981" : "#52525b", borderRadius: 1 }} />
        <div className="absolute top-0 left-0 bottom-0" style={{ width: 4, background: isSelected ? "#10b981" : "#52525b", borderRadius: 1 }} />
        <div className="absolute top-0 right-0 bottom-0" style={{ width: 4, background: isSelected ? "#10b981" : "#52525b", borderRadius: 1 }} />
      </div>
      <div className="absolute" style={{ top: 4, left: 4, right: 4, bottom: 0, background: shellTone }} />

      {agent.status === "running" && <div className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-0.5 z-10"><div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /><div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: "0.3s" }} /></div>}

      <div className="absolute left-1/2 -translate-x-1/2 rounded-sm border" style={{ top: 10, width: 40, height: 14, background: "linear-gradient(180deg,#3f3f46,#27272a)", borderColor: isSelected ? "#10b981" : "#27272a" }}>
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-sm border border-zinc-600" style={{ width: 12, height: 8, background: scr, boxShadow: `0 0 5px ${glow}` }}>
          {agent.status === "running" && <div className="p-px space-y-px"><div className="h-px bg-emerald-500/60 rounded" style={{ width: "65%" }} /><div className="h-px bg-emerald-500/40 rounded" style={{ width: "45%" }} /></div>}
        </div>
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2" style={{ width: 8, height: 2, background: "#18181b" }} />
      </div>

      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 24, transform: `rotate(${-rot}deg)` }}>
        <Px sp={sp} pal={pal} p={2} />
      </div>

      <div className="absolute bottom-1 left-0 right-0 text-center" style={{ transform: `rotate(${-rot}deg)` }}>
        <div className={`text-[5px] font-mono font-bold truncate px-0.5 ${isSelected ? "text-emerald-300" : "text-zinc-500"}`}>{agent.name}</div>
      </div>

      {agent.status === "running" && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-zinc-800 overflow-hidden" style={{ width: 32, transform: `rotate(${-rot}deg)` }}>
          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${agent.progress}%` }} />
        </div>
      )}
    </button>
  );
}

// ── Cubicle Cluster — arranges desks in 2x2, 2x3, etc facing inward ──
function CubCluster({ agents, paletteOffset, hoveredAgentId, onHoverAgent, onLeaveAgent, onSelectAgent }) {
  const n = agents.length;
  let rows;
  let cols;
  if (n <= 2) {
    rows = 1;
    cols = 2;
  } else if (n <= 4) {
    rows = 2;
    cols = 2;
  } else if (n <= 6) {
    rows = 2;
    cols = 3;
  } else {
    rows = 2;
    cols = Math.min(4, Math.ceil(n / 2));
  }

  const dW = 72;
  const dH = 80;
  const gap = 4;
  const clusterW = cols * (dW + gap);
  const clusterH = rows * (dH + gap) + 8;
  const slots = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const idx = r * cols + c;
      if (idx >= n) continue;
      slots.push({
        agent: agents[idx],
        x: c * (dW + gap),
        y: r === 0 ? 0 : dH + gap + 8,
        facing: r === 0 ? "down" : "up",
        palIndex: paletteOffset + idx,
      });
    }
  }

  return (
    <div className="relative" style={{ width: clusterW, height: clusterH }}>
      {rows >= 2 && (
        <div className="absolute" style={{ top: dH + gap, left: 0, right: 0, height: 8, background: "rgba(63,63,70,0.1)" }} />
      )}
      {slots.map((slot) => (
        <div key={slot.agent.id} className="absolute" style={{ left: slot.x, top: slot.y }}>
          <Cub
            agent={slot.agent}
            palIndex={slot.palIndex}
            hov={hoveredAgentId === slot.agent.id}
            isSelected={slot.agent.isSelected}
            onHover={(event) => onHoverAgent(slot.agent.id, event)}
            onUnhover={onLeaveAgent}
            onSelect={() => onSelectAgent(slot.agent.id)}
            facing={slot.facing}
          />
        </div>
      ))}
    </div>
  );
}

// ── Empty Desk Cluster (for away agents) ────────────────────────
function EmptyDeskCluster({ agents }) {
  if (agents.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1" style={{ opacity: 0.25 }}>
      {agents.map((a) => (
        <div key={`empty-${a.id}`} className="relative" style={{ width: 56, height: 50 }}>
          <div className="absolute top-0 left-0 right-0" style={{ height: 3, background: "#3f3f46" }} />
          <div className="absolute top-0 left-0 bottom-0" style={{ width: 3, background: "#3f3f46" }} />
          <div className="absolute top-0 right-0 bottom-0" style={{ width: 3, background: "#3f3f46" }} />
          <div className="absolute left-1/2 -translate-x-1/2 rounded-sm" style={{ top: 8, width: 30, height: 10, background: "#27272a" }} />
          <div className="absolute bottom-0 left-0 right-0 text-center">
            <div className="text-[4px] font-mono text-zinc-700 truncate px-0.5">{a.name}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── DeptRoom — irregular-shaped department ───────────────────────
const DIAGNOSTICS_TONE_COLORS = {
  running: "#00e59b",
  complete: "#3fb950",
  waiting: "#f0a030",
  blocked: "#f85149",
  handoff_ready: "#58a6ff",
  queued: "#52525b",
};

const ROOM_TONE_BACKGROUNDS = {
  running: "rgba(0,229,155,0.06)",
  waiting: "rgba(240,160,48,0.06)",
  blocked: "rgba(248,81,73,0.06)",
  handoff_ready: "rgba(88,166,255,0.06)",
  complete: "rgba(63,185,80,0.04)",
};
const ROOM_TONE_BORDERS = {
  running: "rgba(0,229,155,0.3)",
  waiting: "rgba(240,160,48,0.3)",
  blocked: "rgba(248,81,73,0.3)",
  handoff_ready: "rgba(88,166,255,0.3)",
  complete: "rgba(63,185,80,0.2)",
};

function PersistentShellIndicator({ diagnostics, toneColor }) {
  if (!diagnostics) return null;
  return (
    <div className="flex flex-col items-center gap-1 py-2" data-testid="dept-persistent-shell">
      <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: toneColor, boxShadow: `0 0 10px ${toneColor}60` }} />
      <div className="font-mono text-[6px] uppercase tracking-[0.15em]" style={{ color: toneColor }}>
        {diagnostics.pipelineLabel}
      </div>
      <div className="font-mono text-[5px] text-zinc-600 text-center leading-tight max-w-[140px]">
        {diagnostics.pipelineSummary}
      </div>
      {diagnostics.currentStageLabel && diagnostics.currentStageLabel !== "—" && (
        <div className="font-mono text-[5px] text-zinc-700 text-center">
          Stage: {diagnostics.currentStageLabel}
        </div>
      )}
    </div>
  );
}

function Dept({ department, hoveredAgentId, onHoverAgent, onLeaveAgent, onSelectAgent, onSelectProject }) {
  const diag = department.diagnostics;
  const pipelineStatus = diag?.pipelineStatus ?? department.status;
  const sc = pipelineStatus === "failed"
    ? "#f85149"
    : DIAGNOSTICS_TONE_COLORS[pipelineStatus] ?? "#52525b";
  const deskAgents = department.agents.filter((agent) => agent.status === "running");
  const awayAgents = department.agents.filter((agent) => agent.location === "amenity");
  const isPersistentShell = department.presence?.persistentShell === true;

  const roomBg = department.isSelected
    ? "rgba(6,95,70,0.22)"
    : ROOM_TONE_BACKGROUNDS[pipelineStatus] ?? "rgba(9,9,11,0.7)";
  const roomBorder = department.isSelected
    ? "2px solid rgba(16,185,129,0.55)"
    : ROOM_TONE_BORDERS[pipelineStatus]
      ? `2px solid ${ROOM_TONE_BORDERS[pipelineStatus]}`
      : "2px solid rgba(63,63,70,0.4)";

  return (
    <div className="absolute" style={{ left: department.room.x, top: department.room.y, width: department.room.w, height: department.room.h }}>
      <div className="absolute inset-0 rounded" style={{ background: roomBg, border: roomBorder }} />
      <div className="absolute h-px" style={{ top: 6, left: 20, right: 20, background: `${sc}30`, boxShadow: `0 0 10px ${sc}18`, animation: "flicker 6s ease-in-out infinite" }} />
      <div className="absolute bottom-[-2px] left-1/2 -translate-x-1/2" style={{ width: 24, height: 4, background: "#09090b", borderRadius: "0 0 2px 2px" }} />
      <div className="absolute -top-6 left-2 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ background: sc, boxShadow: `0 0 5px ${sc}80` }} />
        <button
          type="button"
          aria-pressed={department.isSelected}
          aria-label={`Select ${department.name} department`}
          className={`font-mono text-[8px] font-bold tracking-[0.12em] uppercase transition-colors ${department.isSelected ? "text-emerald-300" : "text-zinc-300 hover:text-zinc-100"}`}
          onClick={() => onSelectProject(department.id)}
        >
          {department.name}
        </button>
        <span className="font-mono text-[6px] text-zinc-600 ml-1">{department.agentCount} agents</span>
        {diag && (
          <span
            className="font-mono text-[6px] ml-1 tracking-wider uppercase"
            style={{ color: sc }}
            data-testid={`dept-pipeline-status-${department.id}`}
          >
            {diag.pipelineLabel}
          </span>
        )}
      </div>
      <div className="absolute" style={{ top: 16, left: 14 }}>
        {deskAgents.length > 0 && (
          <CubCluster
            agents={deskAgents}
            paletteOffset={department.paletteOffset}
            hoveredAgentId={hoveredAgentId}
            onHoverAgent={onHoverAgent}
            onLeaveAgent={onLeaveAgent}
            onSelectAgent={onSelectAgent}
          />
        )}
        {isPersistentShell && deskAgents.length === 0 && (
          <PersistentShellIndicator diagnostics={diag} toneColor={sc} />
        )}
        <EmptyDeskCluster agents={awayAgents} />
      </div>
    </div>
  );
}

// ── Break Room (Punishment room — dark, narrow, ominous) ────────
function BreakRoom({ failedAgents, x, y, w, h }) {
  const [statementIdx, setStatementIdx] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setStatementIdx((i) => (i + 1) % BREAK_ROOM_STATEMENTS.length), 3000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="absolute" style={{ left: x, top: y, width: w, height: h }}>
      {/* Dark ominous room */}
      <div className="absolute inset-0 rounded" style={{
        background: "rgba(15,5,5,0.9)",
        border: "3px solid #3a1a1a",
        boxShadow: "inset 0 0 40px rgba(0,0,0,0.8), 0 0 20px rgba(100,20,20,0.15)",
      }} />
      {/* Flickering overhead light (dim, harsh) */}
      <div className="absolute" style={{ top: 4, left: "50%", transform: "translateX(-50%)", width: 30, height: 2, background: "rgba(255,200,150,0.2)", boxShadow: "0 0 15px rgba(255,200,150,0.08)", animation: "flicker 3s ease-in-out infinite" }} />

      {/* Label */}
      <div className="absolute -top-5 left-2 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded" style={{ background: "#f85149", boxShadow: "0 0 6px rgba(248,81,73,0.5)" }} />
        <span className="font-mono text-[8px] font-bold text-red-400 tracking-[0.15em]">BREAK ROOM</span>
        <span className="font-mono text-[6px] text-red-800 ml-1">{failedAgents.length} in session</span>
      </div>

      {/* Narrow hallway entrance */}
      <div className="absolute" style={{ left: -30, top: h / 2 - 8, width: 32, height: 16 }}>
        <div style={{ width: "100%", height: "100%", background: "linear-gradient(90deg, rgba(30,10,10,0.3), rgba(15,5,5,0.9))", border: "1px solid #2a1a1a", borderRight: "none", borderRadius: "4px 0 0 4px" }} />
        <div className="absolute top-1/2 -translate-y-1/2 left-1 font-mono text-[3px] text-red-900 tracking-widest">ENTER</div>
      </div>

      {/* Statement on the wall — the thing they must read */}
      <div className="absolute" style={{ top: 10, left: 10, right: 10, padding: "3px 6px", background: "rgba(40,10,10,0.6)", border: "1px solid #3a1a1a", borderRadius: 2 }}>
        <div className="font-mono text-[4px] text-red-900/50 tracking-wider mb-0.5">PLEASE READ THE FOLLOWING STATEMENT:</div>
        <div className="font-mono text-[6px] text-red-400/70 tracking-wider font-bold leading-tight animate-pulse">
          {BREAK_ROOM_STATEMENTS[statementIdx]}
        </div>
      </div>

      {/* Table in center */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 45, width: Math.min(w - 30, failedAgents.length * 55 + 20), height: 16, background: "#1a0a0a", border: "1px solid #2a1a1a", borderRadius: 2 }} />

      {/* Failed agents seated at table */}
      <div className="absolute flex gap-2 left-1/2 -translate-x-1/2" style={{ top: 50 }}>
        {failedAgents.map((a, i) => (
          <BreakRoomAgent key={a.id} agent={a} palIdx={i + 3} />
        ))}
      </div>

      {/* Ominous corner shadows */}
      <div className="absolute top-0 left-0 w-6 h-6 pointer-events-none" style={{ background: "radial-gradient(circle at 0 0, rgba(0,0,0,0.6), transparent)" }} />
      <div className="absolute top-0 right-0 w-6 h-6 pointer-events-none" style={{ background: "radial-gradient(circle at 100% 0, rgba(0,0,0,0.6), transparent)" }} />
      <div className="absolute bottom-0 left-0 w-6 h-6 pointer-events-none" style={{ background: "radial-gradient(circle at 0 100%, rgba(0,0,0,0.6), transparent)" }} />
      <div className="absolute bottom-0 right-0 w-6 h-6 pointer-events-none" style={{ background: "radial-gradient(circle at 100% 100%, rgba(0,0,0,0.6), transparent)" }} />

      {/* Red indicator light by door */}
      {failedAgents.length > 0 && (
        <div className="absolute rounded-full animate-pulse" style={{ bottom: 2, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, background: "#f85149", boxShadow: "0 0 8px rgba(248,81,73,0.6)" }} />
      )}
    </div>
  );
}

// ── Maze Layout Engine ──────────────────────────────────────────
function layoutMaze(departments, amenityRooms) {
  return {
    departments: departments.map((department) => ({
      ...department,
      x: department.room.x,
      y: department.room.y,
      rW: department.room.w,
      rH: department.room.h,
    })),
    amenityPositions: {
      cafeteria: { x: amenityRooms.cafeteria.x, y: amenityRooms.cafeteria.y, rW: amenityRooms.cafeteria.w, rH: amenityRooms.cafeteria.h },
      breakroom: { x: amenityRooms.breakroom.x, y: amenityRooms.breakroom.y, rW: amenityRooms.breakroom.w, rH: amenityRooms.breakroom.h },
      vending: { x: amenityRooms.vending.x, y: amenityRooms.vending.y, rW: amenityRooms.vending.w, rH: amenityRooms.vending.h },
    },
  };
}

// ── Corridor SVG — thick visible maze hallways ──────────────────
// allRooms includes departments + amenity rooms as generic { x, y, rW, rH } nodes
function MazeCorridors({ allRooms, canvasW, canvasH }) {
  const segments = [];
  const CORRIDOR_W = 22;
  const WALL_C = "#52525b";
  const FLOOR_C = "rgba(39,39,42,0.22)";

  // Helper: add an L-shaped corridor between two room centers
  function addLCorridor(ax, ay, bx, by, offsetDir) {
    // L-shaped: horizontal → vertical → horizontal
    const midX = (ax + bx) / 2 + (offsetDir ? 40 : -40);

    const hX1 = Math.min(ax, midX), hX2 = Math.max(ax, midX);
    segments.push({ type: "h", x: hX1, y: ay - CORRIDOR_W / 2, w: Math.max(hX2 - hX1, 1), h: CORRIDOR_W });

    const vY1 = Math.min(ay, by), vY2 = Math.max(ay, by);
    segments.push({ type: "v", x: midX - CORRIDOR_W / 2, y: vY1, w: CORRIDOR_W, h: Math.max(vY2 - vY1, 1) });

    const h2X1 = Math.min(midX, bx), h2X2 = Math.max(midX, bx);
    segments.push({ type: "h", x: h2X1, y: by - CORRIDOR_W / 2, w: Math.max(h2X2 - h2X1, 1), h: CORRIDOR_W });
  }

  // Connect each room to the next, plus cross-connections for maze effect
  for (let i = 0; i < allRooms.length; i++) {
    const a = allRooms[i];
    const aCx = a.x + a.rW / 2, aCy = a.y + a.rH / 2;

    const targets = [];
    if (i + 1 < allRooms.length) targets.push(i + 1);
    if (i + 3 < allRooms.length && i % 3 === 0) targets.push(i + 3);
    // Cross-connect every 5th to one 4 ahead
    if (i + 4 < allRooms.length && i % 5 === 0) targets.push(i + 4);

    targets.forEach((ti) => {
      const b = allRooms[ti];
      addLCorridor(aCx, aCy, b.x + b.rW / 2, b.y + b.rH / 2, i % 2 === 0);
    });
  }

  // Main horizontal spine corridors across the full floor
  const spineY1 = 65;
  segments.push({ type: "spine", x: 20, y: spineY1, w: canvasW - 40, h: CORRIDOR_W + 6 });
  // A mid-floor spine
  const midSpineY = canvasH * 0.45;
  segments.push({ type: "spine", x: 20, y: midSpineY, w: canvasW - 40, h: CORRIDOR_W + 4 });
  // Right-side vertical spine connecting top to bottom
  const rightSpineX = canvasW - 80;
  segments.push({ type: "v", x: rightSpineX, y: 65, w: CORRIDOR_W + 4, h: canvasH - 130 });

  return (
    <svg className="absolute inset-0 pointer-events-none" width={canvasW} height={canvasH}>
      {/* Corridor floor fills */}
      {segments.map((s, i) => (
        <rect key={`cf${i}`} x={s.x} y={s.y} width={s.w} height={s.h} rx={2} fill={FLOOR_C} />
      ))}
      {/* Corridor walls (top + bottom edges for horizontal, left + right for vertical) */}
      {segments.map((s, i) => (
        <g key={`cw${i}`}>
          {/* Top wall */}
          <line x1={s.x} y1={s.y} x2={s.x + s.w} y2={s.y} stroke={WALL_C} strokeWidth={2} strokeOpacity={0.6} />
          {/* Bottom wall */}
          <line x1={s.x} y1={s.y + s.h} x2={s.x + s.w} y2={s.y + s.h} stroke={WALL_C} strokeWidth={2} strokeOpacity={0.6} />
          {/* Left + Right walls for vertical segments */}
          {s.type === "v" && <>
            <line x1={s.x} y1={s.y} x2={s.x} y2={s.y + s.h} stroke={WALL_C} strokeWidth={2} strokeOpacity={0.6} />
            <line x1={s.x + s.w} y1={s.y} x2={s.x + s.w} y2={s.y + s.h} stroke={WALL_C} strokeWidth={2} strokeOpacity={0.6} />
          </>}
          {/* Center dashed line */}
          {s.type !== "v" ? (
            <line x1={s.x + 6} y1={s.y + s.h / 2} x2={s.x + s.w - 6} y2={s.y + s.h / 2} stroke="rgba(82,82,91,0.3)" strokeWidth={1} strokeDasharray="10 8" />
          ) : (
            <line x1={s.x + s.w / 2} y1={s.y + 6} x2={s.x + s.w / 2} y2={s.y + s.h - 6} stroke="rgba(82,82,91,0.3)" strokeWidth={1} strokeDasharray="10 8" />
          )}
        </g>
      ))}
      {/* Intersection nodes at corridor joints */}
      {segments.filter((s) => s.type === "v").map((s, i) => (
        <g key={`node${i}`}>
          <rect x={s.x - 5} y={s.y - 5} width={s.w + 10} height={10} rx={4} fill={FLOOR_C} stroke={WALL_C} strokeWidth={1.5} strokeOpacity={0.4} />
          <rect x={s.x - 5} y={s.y + s.h - 5} width={s.w + 10} height={10} rx={4} fill={FLOOR_C} stroke={WALL_C} strokeWidth={1.5} strokeOpacity={0.4} />
        </g>
      ))}
    </svg>
  );
}

// ── Amenity Room (Cafeteria, Vending) ───────────────────────────
function AmenityRoom({ label, sublabel, x, y, w, h, items, color }) {
  return (
    <div className="absolute" style={{ left: x, top: y, width: w, height: h }}>
      <div className="absolute inset-0 rounded-lg border-2" style={{ borderColor: `${color}30`, background: "rgba(9,9,11,0.5)" }} />
      <div className="absolute -top-4 left-2 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded" style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />
        <span className="font-mono text-[8px] font-bold tracking-[0.12em] uppercase" style={{ color }}>{label}</span>
      </div>
      {sublabel && <div className="absolute -top-4 right-2 font-mono text-[6px] text-zinc-600">{sublabel}</div>}
      <div className="absolute flex flex-wrap gap-2 p-3" style={{ top: 8 }}>
        {items.map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div className="rounded-sm border" style={{ width: item.w || 24, height: item.h || 16, background: item.bg || "#27272a", borderColor: item.bc || "#3f3f46" }} />
            <span className="font-mono text-[5px] text-zinc-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Selected Project Panel (diagnostics-driven) ─────────────────
function SelectedProjectPanel({ selectedProject, diagnostics }) {
  const diag = diagnostics;
  const hasProject = selectedProject != null;
  const statusLabel = diag ? formatFloorStatus(diag.pipelineStatus) : hasProject ? formatFloorStatus(selectedProject.status) : "UNSELECTED";
  const toneColor = diag ? (DIAGNOSTICS_TONE_COLORS[diag.pipelineStatus] ?? "#52525b") : "#52525b";

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      <div className="text-[8px] uppercase tracking-[0.16em] text-zinc-600">Selected project</div>
      <div className="mt-1 text-[11px] font-bold text-zinc-200" data-testid="severance-floor-selected-project">
        {hasProject ? selectedProject.name : "No project selected"}
      </div>
      <div className="mt-1 text-[9px] text-zinc-500">
        {hasProject ? `${selectedProject.phaseLabel} · ${selectedProject.waveLabel}` : "Pick a department from the dashboard or floor."}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: toneColor, boxShadow: `0 0 4px ${toneColor}60` }} />
        <span
          className="text-[8px] uppercase tracking-[0.12em] font-bold"
          style={{ color: toneColor }}
          data-testid="severance-floor-selected-project-status"
        >
          {statusLabel}
        </span>
      </div>
      {diag && hasProject && (
        <div className="mt-1.5 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[7px] text-zinc-600 uppercase tracking-wider">Stage</span>
            <span className="text-[8px] text-zinc-400" data-testid="severance-floor-selected-project-stage">{diag.currentStageLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[7px] text-zinc-600 uppercase tracking-wider">Gate</span>
            <span className="text-[8px] text-zinc-400" data-testid="severance-floor-selected-project-gate">{diag.currentGateLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[7px] text-zinc-600 uppercase tracking-wider">Approval</span>
            <span className="text-[8px] text-zinc-400" data-testid="severance-floor-selected-project-approval">{diag.currentApprovalSummary}</span>
          </div>
          {diag.currentApprovalNote && (
            <div className="text-[7px] text-zinc-500 italic pl-1" data-testid="severance-floor-selected-project-approval-note">{diag.currentApprovalNote}</div>
          )}
          <div className="mt-1 h-[2px] rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${diag.progressPercent}%`, background: toneColor }} />
          </div>
          <div className="text-[6px] text-zinc-600">{diag.completedCount}/{diag.totalCount} stages · {diag.progressPercent}%</div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────
export default function SeveranceFloor({
  floor = {
    layoutSeedLabel: "severance-floor-v1",
    bossOrbit: { centerX: 0.58, centerY: 0.42, amplitudeX: 0.31, amplitudeY: 0.28, horizontalDivisor: 12, verticalDivisor: 19 },
    summary: { departmentCount: 0, agentCount: 0, runningCount: 0, failedCount: 0, awayCount: 0 },
    agents: [],
    departments: [],
    selectedProject: null,
    selectedAgent: null,
    failedAgents: [],
    amenityAgents: [],
    amenityRooms: {
      cafeteria: { x: 1220, y: 140, w: 300, h: 160 },
      vending: { x: 1200, y: 440, w: 180, h: 130 },
      breakroom: { x: 1240, y: 680, w: 260, h: 150 },
    },
  },
  onSelectAgent = () => {},
  onSelectProject = () => {},
}) {
  const [hoveredAgentId, setHoveredAgentId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [msgI, setMsgI] = useState(0);
  const [time, setTime] = useState(() => new Date());
  const [msgF, setMsgF] = useState(true);
  const containerRef = useRef(null);

  const layout = useMemo(
    () => layoutMaze(floor.departments ?? [], floor.amenityRooms ?? {}),
    [floor.departments, floor.amenityRooms],
  );
  const laid = layout.departments;
  const amenityPos = layout.amenityPositions;
  const failedAgents = floor.failedAgents ?? [];

  const breakRoomPos = useMemo(
    () => ({
      x: amenityPos.breakroom.x,
      y: amenityPos.breakroom.y,
      w: amenityPos.breakroom.rW,
      h: amenityPos.breakroom.rH,
    }),
    [amenityPos],
  );

  const amenities = useMemo(
    () => ({
      cafeteria: { x: amenityPos.cafeteria.x, y: amenityPos.cafeteria.y, w: amenityPos.cafeteria.rW, h: amenityPos.cafeteria.rH },
      vending: { x: amenityPos.vending.x, y: amenityPos.vending.y, w: amenityPos.vending.rW, h: amenityPos.vending.rH },
    }),
    [amenityPos],
  );

  const canvasSize = useMemo(() => {
    let maxX = 1400;
    let maxY = 900;

    laid.forEach((department) => {
      maxX = Math.max(maxX, department.x + department.rW + 200);
      maxY = Math.max(maxY, department.y + department.rH + 200);
    });

    [amenities.cafeteria, amenities.vending, breakRoomPos].forEach((room) => {
      maxX = Math.max(maxX, room.x + room.w + 200);
      maxY = Math.max(maxY, room.y + room.h + 200);
    });

    return { w: maxX, h: maxY };
  }, [amenities, breakRoomPos, laid]);

  const allRooms = useMemo(() => {
    const rooms = laid.map((department) => ({ x: department.x, y: department.y, rW: department.rW, rH: department.rH }));
    rooms.splice(3, 0, { x: amenities.cafeteria.x, y: amenities.cafeteria.y, rW: amenities.cafeteria.w, rH: amenities.cafeteria.h });
    rooms.splice(7, 0, { x: amenities.vending.x, y: amenities.vending.y, rW: amenities.vending.w, rH: amenities.vending.h });
    rooms.splice(10, 0, { x: breakRoomPos.x, y: breakRoomPos.y, rW: breakRoomPos.w, rH: breakRoomPos.h });
    return rooms;
  }, [amenities, breakRoomPos, laid]);

  const wanderers = useMemo(
    () =>
      (floor.amenityAgents ?? []).map((agent, index) => ({
        agent,
        room: amenities[agent.amenityRoomId] ?? amenities.cafeteria,
        palIdx: agent.paletteIndex ?? index,
      })),
    [amenities, floor.amenityAgents],
  );

  const { transform, onMouseDown, onMouseMove, onMouseUp } = usePanZoom(containerRef);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMsgF(false);
      window.setTimeout(() => {
        setMsgI((current) => (current + 1) % MSGS.length);
        setMsgF(true);
      }, 400);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleHoverAgent = useCallback((agentId, event) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && typeof event?.clientX === "number" && typeof event?.clientY === "number") {
      setTooltipPos({
        x: (event.clientX - rect.left - transform.x) / transform.scale,
        y: (event.clientY - rect.top - transform.y) / transform.scale,
      });
    }
    setHoveredAgentId(agentId);
  }, [transform]);

  const handleLeaveAgent = useCallback(() => setHoveredAgentId(null), []);
  const handleSelectAgent = useCallback((agentId) => {
    setHoveredAgentId(agentId);
    onSelectAgent(agentId);
  }, [onSelectAgent]);

  const hoveredAgent = (floor.agents ?? []).find((agent) => agent.id === hoveredAgentId) ?? null;

  return (
    <div className="relative w-full h-full bg-zinc-950 font-mono select-none flex flex-col overflow-hidden">
      <style>{`
        @keyframes flicker{0%,100%{opacity:.9}5%{opacity:.85}50%{opacity:.88}55%{opacity:.95}}
        @keyframes dust{0%,100%{transform:translateY(0) translateX(0);opacity:.1}33%{transform:translateY(-10px) translateX(4px);opacity:.22}66%{transform:translateY(-5px) translateX(-3px);opacity:.13}}
      `}</style>

      <div className="flex-shrink-0 z-40" style={{ background: "rgba(9,9,11,0.92)" }}>
        <div className="flex items-center justify-between px-5 py-2 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center w-7 h-7 rounded border border-zinc-700 bg-zinc-900">
              <span className="font-mono text-[6px] text-zinc-500 leading-none">LVL</span>
              <span className="font-mono text-xs font-bold text-zinc-300 leading-none">B</span>
            </div>
            <div>
              <div className="font-mono text-[10px] font-bold text-zinc-300 tracking-[0.15em]">SEVERED FLOOR</div>
              <div className="font-mono text-[7px] text-zinc-600 tracking-wider">MACRODATA REFINEMENT · {floor.summary.departmentCount} DEPTS · {floor.summary.agentCount} AGENTS</div>
            </div>
          </div>
          <div className="transition-opacity duration-400 max-w-lg text-center" style={{ opacity: msgF ? 1 : 0 }}>
            <p className="font-mono text-[9px] text-zinc-400 tracking-[0.2em] font-bold">{MSGS[msgI]}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="font-mono text-[8px] text-zinc-500">{floor.summary.runningCount} RUN</span></div>
              {floor.summary.waitingCount > 0 && (
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ background: "#f0a030" }} /><span className="font-mono text-[8px]" style={{ color: "#f0a030" }} data-testid="severance-floor-waiting-count">{floor.summary.waitingCount} WAITING</span></div>
              )}
              {floor.summary.blockedCount > 0 && (
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400" /><span className="font-mono text-[8px] text-red-400" data-testid="severance-floor-blocked-count">{floor.summary.blockedCount} BLOCKED</span></div>
              )}
              {floor.summary.handoffReadyCount > 0 && (
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ background: "#58a6ff" }} /><span className="font-mono text-[8px]" style={{ color: "#58a6ff" }} data-testid="severance-floor-handoff-ready-count">{floor.summary.handoffReadyCount} HANDOFF</span></div>
              )}
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /><span className="font-mono text-[8px] text-red-400"><span data-testid="severance-floor-break-room-count">{floor.summary.failedCount}</span> BREAK ROOM</span></div>
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-zinc-500" /><span className="font-mono text-[8px] text-zinc-600">{floor.summary.awayCount} IDLE</span></div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded" style={{ animation: "flicker 8s ease-in-out infinite" }}>
              <span className="font-mono text-[10px] text-emerald-400 font-bold tabular-nums tracking-widest">{time.toLocaleTimeString("en-US", { hour12: false })}</span>
            </div>
            <div className="font-mono text-[8px] text-zinc-600">{Math.round(transform.scale * 100)}%</div>
          </div>
        </div>
        <div className="grid gap-2 border-b border-zinc-900/80 bg-zinc-950/80 px-5 py-2 lg:grid-cols-3">
          <SelectedProjectPanel
            selectedProject={floor.selectedProject}
            diagnostics={floor.selectedProjectDiagnostics}
          />
          <div className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <div className="text-[8px] uppercase tracking-[0.16em] text-zinc-600">Selected agent</div>
            <div className="mt-1 text-[11px] font-bold text-zinc-200" data-testid="severance-floor-selected-agent">{floor.selectedAgent?.name ?? "No agent selected"}</div>
            <div className="mt-1 text-[9px] text-zinc-500">{floor.selectedAgent ? `${floor.selectedAgent.modelLabel} · ${floor.selectedAgent.projectName}` : "Select a cubicle on the floor or dashboard."}</div>
            <div className="mt-1 text-[8px] uppercase tracking-[0.12em] text-zinc-600" data-testid="severance-floor-selected-agent-status">{floor.selectedAgent ? formatFloorStatus(floor.selectedAgent.status) : "UNSELECTED"}</div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <div className="text-[8px] uppercase tracking-[0.16em] text-zinc-600">Layout seed</div>
            <div className="mt-1 text-[11px] font-bold text-emerald-300">{floor.layoutSeedLabel}</div>
            <div className="mt-1 text-[9px] text-zinc-500">Stable room anchors and deterministic amenity motion keyed by canonical agent/project identity.</div>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          data-canvas-bg="true"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
            width: canvasSize.w,
            height: canvasSize.h,
            position: "absolute",
            backgroundImage: "linear-gradient(rgba(39,39,42,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(39,39,42,0.07) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        >
          <div className="absolute inset-0 pointer-events-none z-[45] opacity-[0.02]" style={{ background: "repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,255,255,0.08) 2px,rgba(255,255,255,0.08) 4px)" }} />

          {Array.from({ length: 20 }).map((_, index) => (
            <div key={`dust-${index}`} className="absolute pointer-events-none rounded-full bg-zinc-400" style={{ width: 2, height: 2, left: 40 + (index * 73) % (canvasSize.w - 80), top: 60 + (index * 97) % (canvasSize.h - 120), animation: `dust ${5 + (index % 3) * 2}s ease-in-out infinite`, animationDelay: `${index * 0.5}s` }} />
          ))}

          <div className="absolute font-mono text-[7px] text-zinc-800 tracking-[0.4em] pointer-events-none" style={{ left: 20, top: 30 }}>FLOOR PLAN — SUBLEVEL B</div>
          <div className="absolute font-mono text-[7px] text-zinc-800 tracking-[0.4em] pointer-events-none" style={{ right: 30, top: 30 }}>SCROLL TO ZOOM · CLICK + DRAG TO PAN</div>

          <div className="absolute pointer-events-none border border-zinc-800/40 rounded-sm px-4 py-2" style={{ left: canvasSize.w / 2 - 100, top: 20, width: 200, background: "rgba(24,24,27,0.5)", textAlign: "center" }}>
            <div className="font-mono text-[6px] text-zinc-600 tracking-[0.15em] mb-0.5">LUMON INDUSTRIES</div>
            <div className="font-mono text-[7px] text-zinc-500 tracking-wider font-bold leading-tight">THE WORK IS<br />MYSTERIOUS AND IMPORTANT</div>
          </div>

          <MazeCorridors allRooms={allRooms} canvasW={canvasSize.w} canvasH={canvasSize.h} />

          {laid.map((department) => (
            <Dept
              key={department.id}
              department={department}
              hoveredAgentId={hoveredAgentId}
              onHoverAgent={handleHoverAgent}
              onLeaveAgent={handleLeaveAgent}
              onSelectAgent={handleSelectAgent}
              onSelectProject={onSelectProject}
            />
          ))}

          <BreakRoom failedAgents={failedAgents} x={breakRoomPos.x} y={breakRoomPos.y} w={breakRoomPos.w} h={breakRoomPos.h} />

          <AmenityRoom
            label="CAFETERIA"
            sublabel="LUMON DINING"
            x={amenities.cafeteria.x}
            y={amenities.cafeteria.y}
            w={amenities.cafeteria.w}
            h={amenities.cafeteria.h}
            color="#f0a030"
            items={[
              { label: "Table", w: 40, h: 18, bg: "#2a2a20", bc: "#3a3a30" },
              { label: "Table", w: 40, h: 18, bg: "#2a2a20", bc: "#3a3a30" },
              { label: "Table", w: 40, h: 18, bg: "#2a2a20", bc: "#3a3a30" },
              { label: "Tray Return", w: 30, h: 14, bg: "#1a1a1a", bc: "#2a2a2a" },
              { label: "Serving Line", w: 60, h: 14, bg: "#2a1a1a", bc: "#3a2a2a" },
              { label: "Microwave", w: 20, h: 14, bg: "#1a1a2a", bc: "#2a2a3a" },
            ]}
          />

          <AmenityRoom
            label="VENDING"
            sublabel=""
            x={amenities.vending.x}
            y={amenities.vending.y}
            w={amenities.vending.w}
            h={amenities.vending.h}
            color="#58a6ff"
            items={[
              { label: "Snacks", w: 28, h: 40, bg: "#1a2a3a", bc: "#2a3a4a" },
              { label: "Drinks", w: 28, h: 40, bg: "#1a2a2a", bc: "#2a3a3a" },
              { label: "Coffee", w: 22, h: 30, bg: "#2a1a1a", bc: "#3a2a2a" },
            ]}
          />

          <div className="absolute pointer-events-none" style={{ right: 40, bottom: 40 }}>
            <div className="border border-zinc-800/40 rounded px-3 py-2 bg-zinc-900/30 text-center">
              <div className="font-mono text-[6px] text-zinc-700 tracking-[0.3em]">ELEVATOR</div>
              <div className="font-mono text-[5px] text-zinc-800 tracking-wider">BADGE REQUIRED</div>
              <div className="mt-1 flex gap-1 justify-center">
                <div className="w-4 h-6 rounded-sm border border-zinc-700 bg-zinc-800/50" />
                <div className="w-4 h-6 rounded-sm border border-zinc-700 bg-zinc-800/50" />
              </div>
            </div>
          </div>

          <Boss canvasW={canvasSize.w} canvasH={canvasSize.h} orbit={floor.bossOrbit} />

          {wanderers.map((wanderer) => (
            <WanderingAgent key={wanderer.agent.id} agent={wanderer.agent} palIdx={wanderer.palIdx} room={wanderer.room} />
          ))}

          {hoveredAgent && (
            <div className="absolute z-[60] pointer-events-none" style={{ left: tooltipPos.x, top: tooltipPos.y - 10, transform: "translate(-50%,-100%)" }}>
              <Card className="bg-zinc-900/95 border-zinc-700 shadow-2xl shadow-black/50 backdrop-blur">
                <CardContent className="p-2.5 space-y-1" style={{ minWidth: 170 }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-zinc-200">{hoveredAgent.name}</span>
                    <Badge variant="outline" className={`font-mono text-[7px] font-bold tracking-widest uppercase ${
                      hoveredAgent.status === "running" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                      hoveredAgent.status === "complete" ? "bg-green-500/15 text-green-400 border-green-500/30" :
                      hoveredAgent.status === "failed" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                      "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                    }`}>{formatFloorStatus(hoveredAgent.status)}</Badge>
                  </div>
                  <div className="font-mono text-[8px] text-zinc-500">{hoveredAgent.modelLabel} · {hoveredAgent.projectName}</div>
                  <div className="font-mono text-[8px] text-zinc-400 leading-snug">{hoveredAgent.task}</div>
                  {hoveredAgent.status === "running" && (
                    <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${hoveredAgent.progress}%` }} />
                    </div>
                  )}
                  {hoveredAgent.status === "failed" && (
                    <div className="text-[7px] text-red-400/80 font-mono">Sent to Break Room — reading statement</div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
