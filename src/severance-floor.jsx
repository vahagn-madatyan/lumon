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
function WanderingAgent({ agent, palIdx, target }) {
  const [pos, setPos] = useState(() => ({ x: target.x + Math.random() * 40, y: target.y + Math.random() * 40 }));
  const [frame, setFrame] = useState(0);
  const [facing, setFacing] = useState(1);
  const [atTarget, setAtTarget] = useState(false);
  const [waitTicks, setWaitTicks] = useState(0);
  const targetRef = useRef(target);

  useEffect(() => { targetRef.current = target; }, [target]);

  useEffect(() => {
    const iv = setInterval(() => {
      setFrame((f) => (f + 1) % 2);
      if (atTarget) {
        setWaitTicks((w) => {
          if (w <= 0) {
            setAtTarget(false);
            targetRef.current = { x: target.x + (Math.random() - 0.5) * 60, y: target.y + (Math.random() - 0.5) * 40 };
            return 0;
          }
          return w - 1;
        });
        return;
      }
      setPos((p) => {
        const t = targetRef.current;
        const dx = t.x - p.x, dy = t.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 4) { setAtTarget(true); setWaitTicks(20 + Math.floor(Math.random() * 40)); return p; }
        const speed = 1.2 + Math.random() * 0.5;
        if (dx !== 0) setFacing(dx > 0 ? 1 : -1);
        return { x: p.x + (dx / dist) * speed, y: p.y + (dy / dist) * speed };
      });
    }, 120);
    return () => clearInterval(iv);
  }, [atTarget, target]);

  const pal = PALS[palIdx % PALS.length];
  const sp = atTarget ? SP_IDLE : (frame ? SP_WALK2 : SP_WALK1);

  return (
    <div className="absolute z-20 pointer-events-none" style={{ left: pos.x, top: pos.y, transform: `scaleX(${facing})`, transition: "left 120ms linear, top 120ms linear" }}>
      <Px sp={sp} pal={pal} p={2} />
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap" style={{ transform: `scaleX(${facing})` }}>
        <span className="font-mono text-[5px] text-zinc-600">{agent.name}</span>
      </div>
    </div>
  );
}

// ── Break Room Agent (punishment — reading the statement) ────────
function BreakRoomAgent({ agent, palIdx, seatIndex }) {
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
function Boss({ canvasW, canvasH }) {
  const [pos, setPos] = useState({ x: 400, y: 200 });
  const [dir, setDir] = useState({ dx: 1.1, dy: 0.5 });
  const [paused, setPaused] = useState(false);
  const [pt, setPt] = useState(0);
  const [facing, setFacing] = useState(1);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setFrame((f) => (f + 1) % 2);
      if (paused) { setPt((t) => { if (t <= 0) { setPaused(false); return 0; } return t - 1; }); return; }
      setPos((p) => {
        let nx = p.x + dir.dx, ny = p.y + dir.dy, ndx = dir.dx, ndy = dir.dy;
        if (nx < 40 || nx > canvasW - 60) { ndx = -ndx; setFacing(ndx > 0 ? 1 : -1); }
        if (ny < 40 || ny > canvasH - 60) ndy = -ndy;
        nx = Math.max(40, Math.min(canvasW - 60, nx));
        ny = Math.max(40, Math.min(canvasH - 60, ny));
        if (Math.random() > 0.98) { ndx = (Math.random() - 0.5) * 2; ndy = (Math.random() - 0.5) * 1.5; setFacing(ndx > 0 ? 1 : -1); }
        if (Math.random() > 0.97) { setPaused(true); setPt(12 + Math.floor(Math.random() * 20)); }
        setDir({ dx: ndx, dy: ndy });
        return { x: nx, y: ny };
      });
    }, 100);
    return () => clearInterval(iv);
  }, [dir, paused, canvasW, canvasH]);

  return (
    <div className="absolute z-30 pointer-events-none" style={{ left: pos.x, top: pos.y, transform: `scaleX(${facing})`, transition: "left 100ms linear, top 100ms linear" }}>
      <Px sp={frame ? SP_BOSS2 : SP_BOSS1} pal={BOSS_PAL} p={3} />
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap" style={{ transform: `scaleX(${facing})` }}>
        <span className="font-mono text-[6px] text-amber-400/60 tracking-wider font-bold">MR. MILCHICK</span>
      </div>
      {paused && <div className="absolute -top-2 left-1/2 -translate-x-1/2" style={{ transform: `scaleX(${facing})` }}><div className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse" /></div>}
    </div>
  );
}

// ── Cubicle (single desk + worker) ──────────────────────────────
function Cub({ agent, pi, hov, onE, onL, facing = "down" }) {
  const [f, sF] = useState(0);
  useEffect(() => {
    if (agent.status !== "running") return;
    const iv = setInterval(() => sF((v) => (v + 1) % 2), 400);
    return () => clearInterval(iv);
  }, [agent.status]);

  const pal = PALS[pi % PALS.length];
  const glow = agent.status === "running" ? "rgba(0,229,155,0.35)" : "transparent";
  const scr = agent.status === "running" ? "#0a2a1a" : "#0f0f0f";
  const sp = agent.status === "running" ? (f ? SP_TYPE2 : SP_TYPE1) : SP_RELAX;

  // Rotation for different facing directions
  const rot = facing === "up" ? 180 : facing === "left" ? 90 : facing === "right" ? -90 : 0;

  return (
    <div
      className={`relative cursor-pointer ${hov ? "z-20" : ""}`}
      onMouseEnter={onE} onMouseLeave={onL}
      style={{ width: 72, height: 80, transform: `rotate(${rot}deg)` }}
    >
      {/* Cubicle partition walls — 3-sided */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0" style={{ height: 4, background: "#52525b", borderRadius: 1 }} />
        <div className="absolute top-0 left-0 bottom-0" style={{ width: 4, background: "#52525b", borderRadius: 1 }} />
        <div className="absolute top-0 right-0 bottom-0" style={{ width: 4, background: "#52525b", borderRadius: 1 }} />
      </div>
      <div className="absolute" style={{ top: 4, left: 4, right: 4, bottom: 0, background: hov ? "rgba(39,39,42,0.5)" : "rgba(24,24,27,0.3)" }} />

      {/* Status glow */}
      {agent.status === "running" && <div className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-0.5 z-10"><div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /><div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: "0.3s" }} /></div>}

      {/* Desk */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-sm border" style={{ top: 10, width: 40, height: 14, background: "linear-gradient(180deg,#3f3f46,#27272a)", borderColor: "#27272a" }}>
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-sm border border-zinc-600" style={{ width: 12, height: 8, background: scr, boxShadow: `0 0 5px ${glow}` }}>
          {agent.status === "running" && <div className="p-px space-y-px"><div className="h-px bg-emerald-500/60 rounded" style={{ width: "65%" }} /><div className="h-px bg-emerald-500/40 rounded" style={{ width: "45%" }} /></div>}
        </div>
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2" style={{ width: 8, height: 2, background: "#18181b" }} />
      </div>

      {/* Character — counter-rotate so sprite is always upright */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 24, transform: `rotate(${-rot}deg)` }}>
        <Px sp={sp} pal={pal} p={2} />
      </div>

      {/* Name — counter-rotate */}
      <div className="absolute bottom-1 left-0 right-0 text-center" style={{ transform: `rotate(${-rot}deg)` }}>
        <div className="text-[5px] font-mono font-bold text-zinc-500 truncate px-0.5">{agent.name}</div>
      </div>

      {/* Progress */}
      {agent.status === "running" && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-zinc-800 overflow-hidden" style={{ width: 32, transform: `rotate(${-rot}deg)` }}>
          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${agent.progress}%` }} />
        </div>
      )}
    </div>
  );
}

// ── Cubicle Cluster — arranges desks in 2x2, 2x3, etc facing inward ──
function CubCluster({ agents, pi, hId, onH, onUH }) {
  const n = agents.length;
  // Determine cluster layout: pairs of rows facing each other
  // 1-2 agents: 1x2 (or 1x1) facing each other
  // 3-4 agents: 2x2 cluster
  // 5-6 agents: 2x3 cluster
  // 7+ agents: 4x2 cluster (two rows of 4 facing each other)
  let rows, cols;
  if (n <= 2) { rows = 1; cols = 2; }
  else if (n <= 4) { rows = 2; cols = 2; }
  else if (n <= 6) { rows = 2; cols = 3; }
  else { rows = 2; cols = Math.min(4, Math.ceil(n / 2)); }

  // Total cluster width/height — desks are 72x80, gap=4
  const dW = 72, dH = 80, gap = 4;
  const clusterW = cols * (dW + gap);
  const clusterH = rows * (dH + gap) + 8; // 8px for center aisle

  // Arrange: top row faces down, bottom row faces up
  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= n) continue;
      const facing = r === 0 ? "down" : "up";
      const x = c * (dW + gap);
      const y = r === 0 ? 0 : dH + gap + 8;
      slots.push({ agent: agents[idx], x, y, facing, pi: pi + idx });
    }
  }

  return (
    <div className="relative" style={{ width: clusterW, height: clusterH }}>
      {/* Center aisle divider between facing rows */}
      {rows >= 2 && (
        <div className="absolute" style={{ top: dH + gap, left: 0, right: 0, height: 8, background: "rgba(63,63,70,0.1)" }} />
      )}
      {slots.map((s) => (
        <div key={s.agent.id} className="absolute" style={{ left: s.x, top: s.y }}>
          <Cub agent={s.agent} pi={s.pi} hov={hId === s.agent.id} onE={(e) => onH(s.agent.id, e)} onL={onUH} facing={s.facing} />
        </div>
      ))}
    </div>
  );
}

// ── Empty Desk Cluster (for away agents) ────────────────────────
function EmptyDeskCluster({ agents }) {
  if (agents.length === 0) return null;
  const cols = Math.min(agents.length, 3);
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
function Dept({ project, agents, x, y, w, h, po, hId, onH, onUH }) {
  const sc = agents.some((a) => a.status === "running") ? "#00e59b"
    : agents.every((a) => a.status === "complete") ? "#3fb950" : "#52525b";
  // Only running agents sit at desks (failed go to break room)
  const deskAgents = agents.filter((a) => a.status === "running");
  const awayAgents = agents.filter((a) => a.status !== "running" && a.status !== "failed");

  return (
    <div className="absolute" style={{ left: x, top: y, width: w, height: h }}>
      {/* Room fill */}
      <div className="absolute inset-0 rounded" style={{ background: "rgba(9,9,11,0.7)", border: "2px solid rgba(63,63,70,0.4)" }} />
      {/* Fluorescent light strip */}
      <div className="absolute h-px" style={{ top: 6, left: 20, right: 20, background: "rgba(34,211,238,0.18)", boxShadow: "0 0 10px rgba(34,211,238,0.1)", animation: "flicker 6s ease-in-out infinite" }} />
      {/* Door */}
      <div className="absolute bottom-[-2px] left-1/2 -translate-x-1/2" style={{ width: 24, height: 4, background: "#09090b", borderRadius: "0 0 2px 2px" }} />
      {/* Department label */}
      <div className="absolute -top-5 left-2 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ background: sc, boxShadow: `0 0 5px ${sc}80` }} />
        <span className="font-mono text-[8px] font-bold text-zinc-300 tracking-[0.12em] uppercase">{project}</span>
        <span className="font-mono text-[6px] text-zinc-600 ml-1">{agents.length} agents</span>
      </div>
      {/* Cubicle cluster */}
      <div className="absolute" style={{ top: 16, left: 14 }}>
        {deskAgents.length > 0 && (
          <CubCluster agents={deskAgents} pi={po} hId={hId} onH={onH} onUH={onUH} />
        )}
        <EmptyDeskCluster agents={awayAgents} />
      </div>
    </div>
  );
}

// ── Break Room (Punishment room — dark, narrow, ominous) ────────
function BreakRoom({ failedAgents, x, y, w, h }) {
  const [statementIdx, setStatementIdx] = useState(0);
  const statements = [
    "I WILL NOT CAUSE ERRORS IN PRODUCTION",
    "I WILL NOT DEVIATE FROM THE PROCESS",
    "I CAUSED AN ERROR AND I ACCEPT MY FAULT",
    "MY ACTIONS HAVE CONSEQUENCES FOR THE TEAM",
    "I WILL EXECUTE MY TASKS WITHOUT FAILURE",
  ];

  useEffect(() => {
    const iv = setInterval(() => setStatementIdx((i) => (i + 1) % statements.length), 3000);
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
          {statements[statementIdx]}
        </div>
      </div>

      {/* Table in center */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 45, width: Math.min(w - 30, failedAgents.length * 55 + 20), height: 16, background: "#1a0a0a", border: "1px solid #2a1a1a", borderRadius: 2 }} />

      {/* Failed agents seated at table */}
      <div className="absolute flex gap-2 left-1/2 -translate-x-1/2" style={{ top: 50 }}>
        {failedAgents.map((a, i) => (
          <BreakRoomAgent key={a.id} agent={a} palIdx={i + 3} seatIndex={i} />
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
// Positions departments irregularly like a maze/floor plan
// Also places amenity rooms (cafeteria, break room, vending) among departments
function layoutMaze(departments) {
  const placed = [];

  // Pre-defined irregular positions — like an actual office building floor plan
  // Not aligned to grid, staggered, some areas denser, some sparser
  // Amenity rooms are slotted in between departments
  const positions = [
    // Cluster A — upper left area
    { x: 80, y: 100 },
    { x: 440, y: 80 },
    { x: 820, y: 130 },
    // Cluster B — middle-left, shifted down and right
    { x: 180, y: 400 },
    { x: 580, y: 360 },
    { x: 980, y: 320 },
    // Cluster C — lower section, offset
    { x: 60, y: 680 },
    { x: 460, y: 640 },
    { x: 860, y: 700 },
    // Cluster D — further down, irregular spacing
    { x: 300, y: 940 },
    { x: 720, y: 900 },
    { x: 1100, y: 960 },
    // Cluster E — deep section
    { x: 120, y: 1200 },
    { x: 540, y: 1160 },
    { x: 920, y: 1220 },
    // Overflow
    { x: 320, y: 1460 },
    { x: 740, y: 1420 },
    { x: 1140, y: 1480 },
    { x: 180, y: 1700 },
    { x: 600, y: 1660 },
  ];

  // Amenity room positions — scattered among the departments, not at the bottom
  // These are fixed positions mixed into the floor
  const AMENITY_POSITIONS = {
    cafeteria:  { x: 1220, y: 140, rW: 300, rH: 160 },
    breakroom:  { x: 1240, y: 680, rW: 260, rH: 150 },
    vending:    { x: 1200, y: 440, rW: 180, rH: 130 },
  };

  departments.forEach((dept, i) => {
    const pos = positions[i % positions.length];
    const yOff = Math.floor(i / positions.length) * 1800;
    const agents = dept.agents;
    const deskCount = agents.filter((a) => a.status === "running").length;
    // Room size based on agent count
    const cols = Math.min(Math.max(deskCount, 1), 4);
    const rows = Math.max(1, Math.ceil(deskCount / Math.max(cols, 1)));
    const rW = Math.max(cols * 76 + 40, 200);
    const rH = Math.max(rows * 90 + 60, 140);

    placed.push({ ...dept, x: pos.x, y: pos.y + yOff, rW, rH });
  });

  return { departments: placed, amenityPositions: AMENITY_POSITIONS };
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

// ── Main Component ──────────────────────────────────────────────
export default function SeveranceFloor({ agents = [] }) {
  const [hId, setHId] = useState(null);
  const [ttPos, setTtPos] = useState({ x: 0, y: 0 });
  const [msgI, setMsgI] = useState(0);
  const [time, setTime] = useState(new Date());
  const [msgF, setMsgF] = useState(true);
  const containerRef = useRef(null);

  const departments = useMemo(() => {
    const m = new Map();
    agents.forEach((a) => { const k = a.project || "?"; if (!m.has(k)) m.set(k, []); m.get(k).push(a); });
    return Array.from(m.entries()).map(([project, agts]) => ({ project, agents: agts }));
  }, [agents]);

  // Separate failed agents for Break Room
  const failedAgents = useMemo(() => agents.filter((a) => a.status === "failed"), [agents]);

  const layout = useMemo(() => layoutMaze(departments), [departments]);
  const laid = layout.departments;
  const amenityPos = layout.amenityPositions;

  // Break Room position — from layout engine, sized to fit failed agents
  const breakRoomPos = useMemo(() => {
    const base = amenityPos.breakroom;
    const brW = Math.max(base.rW, failedAgents.length * 55 + 60);
    return { x: base.x, y: base.y, w: brW, h: base.rH };
  }, [amenityPos, failedAgents.length]);

  // Amenity positions — from layout engine (integrated into the floor)
  const amenities = useMemo(() => ({
    cafeteria: { x: amenityPos.cafeteria.x, y: amenityPos.cafeteria.y, w: amenityPos.cafeteria.rW, h: amenityPos.cafeteria.rH },
    vending: { x: amenityPos.vending.x, y: amenityPos.vending.y, w: amenityPos.vending.rW, h: amenityPos.vending.rH },
  }), [amenityPos]);

  // Compute canvas size from ALL rooms (departments + amenities)
  const cs = useMemo(() => {
    let mx = 1400, my = 900;
    laid.forEach((d) => {
      mx = Math.max(mx, d.x + d.rW + 200);
      my = Math.max(my, d.y + d.rH + 200);
    });
    // Include amenity rooms
    [amenities.cafeteria, amenities.vending, breakRoomPos].forEach((r) => {
      mx = Math.max(mx, r.x + r.w + 200);
      my = Math.max(my, r.y + r.h + 200);
    });
    return { w: mx, h: my };
  }, [laid, amenities, breakRoomPos]);

  // Build allRooms list for corridor routing (departments + amenities)
  const allRooms = useMemo(() => {
    const rooms = laid.map((d) => ({ x: d.x, y: d.y, rW: d.rW, rH: d.rH }));
    // Insert amenity rooms at strategic positions so corridors connect to them
    rooms.splice(3, 0, { x: amenities.cafeteria.x, y: amenities.cafeteria.y, rW: amenities.cafeteria.w, rH: amenities.cafeteria.h });
    rooms.splice(7, 0, { x: amenities.vending.x, y: amenities.vending.y, rW: amenities.vending.w, rH: amenities.vending.h });
    rooms.splice(10, 0, { x: breakRoomPos.x, y: breakRoomPos.y, rW: breakRoomPos.w, rH: breakRoomPos.h });
    return rooms;
  }, [laid, amenities, breakRoomPos]);

  // Wandering agents — idle/queued/complete walk to cafeteria or vending
  const wanderers = useMemo(() => {
    const areas = [amenities.cafeteria, amenities.vending];
    return agents
      .filter((a) => a.status === "queued" || a.status === "complete")
      .map((a, i) => {
        const area = areas[i % areas.length];
        return { agent: a, target: { x: area.x + 20 + Math.random() * (area.w - 60), y: area.y + 30 + Math.random() * (area.h - 60) }, palIdx: i };
      });
  }, [agents, amenities]);

  const { transform, onMouseDown, onMouseMove, onMouseUp } = usePanZoom(containerRef);

  useEffect(() => {
    const iv = setInterval(() => { setMsgF(false); setTimeout(() => { setMsgI((i) => (i + 1) % MSGS.length); setMsgF(true); }, 400); }, 5000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { const iv = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(iv); }, []);

  const handleH = useCallback((id, e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setTtPos({ x: (e.clientX - rect.left - transform.x) / transform.scale, y: (e.clientY - rect.top - transform.y) / transform.scale });
    setHId(id);
  }, [transform]);

  const hAgent = agents.find((a) => a.id === hId);
  let po = 0;

  return (
    <div className="relative w-full h-full bg-zinc-950 font-mono select-none flex flex-col overflow-hidden">
      <style>{`
        @keyframes flicker{0%,100%{opacity:.9}5%{opacity:.85}50%{opacity:.88}55%{opacity:.95}}
        @keyframes dust{0%,100%{transform:translateY(0) translateX(0);opacity:.1}33%{transform:translateY(-10px) translateX(4px);opacity:.22}66%{transform:translateY(-5px) translateX(-3px);opacity:.13}}
        @keyframes redpulse{0%,100%{opacity:.3}50%{opacity:.6}}
      `}</style>

      {/* Top bar */}
      <div className="flex-shrink-0 z-40" style={{ background: "rgba(9,9,11,0.92)" }}>
        <div className="flex items-center justify-between px-5 py-2 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center w-7 h-7 rounded border border-zinc-700 bg-zinc-900">
              <span className="font-mono text-[6px] text-zinc-500 leading-none">LVL</span>
              <span className="font-mono text-xs font-bold text-zinc-300 leading-none">B</span>
            </div>
            <div>
              <div className="font-mono text-[10px] font-bold text-zinc-300 tracking-[0.15em]">SEVERED FLOOR</div>
              <div className="font-mono text-[7px] text-zinc-600 tracking-wider">MACRODATA REFINEMENT · {departments.length} DEPTS · {agents.length} AGENTS</div>
            </div>
          </div>
          <div className="transition-opacity duration-400 max-w-lg text-center" style={{ opacity: msgF ? 1 : 0 }}>
            <p className="font-mono text-[9px] text-zinc-400 tracking-[0.2em] font-bold">{MSGS[msgI]}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="font-mono text-[8px] text-zinc-500">{agents.filter((a) => a.status === "running").length} RUN</span></div>
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /><span className="font-mono text-[8px] text-red-400">{failedAgents.length} BREAK ROOM</span></div>
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-zinc-500" /><span className="font-mono text-[8px] text-zinc-600">{agents.filter((a) => a.status === "queued" || a.status === "complete").length} IDLE</span></div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded" style={{ animation: "flicker 8s ease-in-out infinite" }}>
              <span className="font-mono text-[10px] text-emerald-400 font-bold tabular-nums tracking-widest">{time.toLocaleTimeString("en-US", { hour12: false })}</span>
            </div>
            <div className="font-mono text-[8px] text-zinc-600">{Math.round(transform.scale * 100)}%</div>
          </div>
        </div>
      </div>

      {/* Canvas — pan/zoom container */}
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
            width: cs.w,
            height: cs.h,
            position: "absolute",
            backgroundImage: "linear-gradient(rgba(39,39,42,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(39,39,42,0.07) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        >
          {/* Scanlines */}
          <div className="absolute inset-0 pointer-events-none z-[45] opacity-[0.02]" style={{ background: "repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,255,255,0.08) 2px,rgba(255,255,255,0.08) 4px)" }} />

          {/* Dust particles */}
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={`d${i}`} className="absolute pointer-events-none rounded-full bg-zinc-400" style={{ width: 2, height: 2, left: 40 + (i * 73) % (cs.w - 80), top: 60 + (i * 97) % (cs.h - 120), animation: `dust ${5 + (i % 3) * 2}s ease-in-out infinite`, animationDelay: `${i * 0.5}s` }} />
          ))}

          {/* Floor labels */}
          <div className="absolute font-mono text-[7px] text-zinc-800 tracking-[0.4em] pointer-events-none" style={{ left: 20, top: 30 }}>FLOOR PLAN — SUBLEVEL B</div>
          <div className="absolute font-mono text-[7px] text-zinc-800 tracking-[0.4em] pointer-events-none" style={{ right: 30, top: 30 }}>SCROLL TO ZOOM · CLICK + DRAG TO PAN</div>

          {/* Corporate poster */}
          <div className="absolute pointer-events-none border border-zinc-800/40 rounded-sm px-4 py-2" style={{ left: cs.w / 2 - 100, top: 20, width: 200, background: "rgba(24,24,27,0.5)", textAlign: "center" }}>
            <div className="font-mono text-[6px] text-zinc-600 tracking-[0.15em] mb-0.5">LUMON INDUSTRIES</div>
            <div className="font-mono text-[7px] text-zinc-500 tracking-wider font-bold leading-tight">THE WORK IS<br />MYSTERIOUS AND IMPORTANT</div>
          </div>

          {/* Maze corridors — connects departments + amenity rooms */}
          <MazeCorridors allRooms={allRooms} canvasW={cs.w} canvasH={cs.h} />

          {/* Department rooms */}
          {laid.map((dept) => {
            const off = po;
            po += dept.agents.length;
            return <Dept key={dept.project} project={dept.project} agents={dept.agents} x={dept.x} y={dept.y} w={dept.rW} h={dept.rH} po={off} hId={hId} onH={handleH} onUH={() => setHId(null)} />;
          })}

          {/* ── BREAK ROOM (punishment for failed agents) ── */}
          <BreakRoom failedAgents={failedAgents} x={breakRoomPos.x} y={breakRoomPos.y} w={breakRoomPos.w} h={breakRoomPos.h} />

          {/* ── CAFETERIA ── */}
          <AmenityRoom
            label="CAFETERIA" sublabel="LUMON DINING"
            x={amenities.cafeteria.x} y={amenities.cafeteria.y}
            w={amenities.cafeteria.w} h={amenities.cafeteria.h}
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

          {/* ── VENDING MACHINES ── */}
          <AmenityRoom
            label="VENDING" sublabel=""
            x={amenities.vending.x} y={amenities.vending.y}
            w={amenities.vending.w} h={amenities.vending.h}
            color="#58a6ff"
            items={[
              { label: "Snacks", w: 28, h: 40, bg: "#1a2a3a", bc: "#2a3a4a" },
              { label: "Drinks", w: 28, h: 40, bg: "#1a2a2a", bc: "#2a3a3a" },
              { label: "Coffee", w: 22, h: 30, bg: "#2a1a1a", bc: "#3a2a2a" },
            ]}
          />

          {/* Elevator area */}
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

          {/* Boss roaming */}
          <Boss canvasW={cs.w} canvasH={cs.h} />

          {/* Wandering idle agents */}
          {wanderers.map((w) => (
            <WanderingAgent key={w.agent.id} agent={w.agent} palIdx={w.palIdx} target={w.target} />
          ))}

          {/* Tooltip */}
          {hAgent && (
            <div className="absolute z-[60] pointer-events-none" style={{ left: ttPos.x, top: ttPos.y - 10, transform: "translate(-50%,-100%)" }}>
              <Card className="bg-zinc-900/95 border-zinc-700 shadow-2xl shadow-black/50 backdrop-blur">
                <CardContent className="p-2.5 space-y-1" style={{ minWidth: 170 }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-zinc-200">{hAgent.name}</span>
                    <Badge variant="outline" className={`font-mono text-[7px] font-bold tracking-widest uppercase ${
                      hAgent.status === "running" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                      hAgent.status === "complete" ? "bg-green-500/15 text-green-400 border-green-500/30" :
                      hAgent.status === "failed" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                      "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                    }`}>{hAgent.status === "failed" ? "BREAK ROOM" : hAgent.status}</Badge>
                  </div>
                  <div className="font-mono text-[8px] text-zinc-500">{hAgent.type === "claude" ? "Claude Code" : "Codex CLI"} · {hAgent.project}</div>
                  <div className="font-mono text-[8px] text-zinc-400 leading-snug">{hAgent.task}</div>
                  {hAgent.status === "running" && (
                    <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${hAgent.progress}%` }} />
                    </div>
                  )}
                  {hAgent.status === "failed" && (
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
