import { useRef, useState } from "react";
import { content } from "../content";
import {
  activityText,
  floorStatuses,
  isWarm,
  isStairs,
  occupancy,
  placement,
  slots,
  storageFull,
  type GameState,
  type Room,
} from "../sim";
import { bar, face, tag } from "./text";

/**
 * Fixed tower geometry, in pixels. Every floor space is the same size and rooms never stretch.
 * These are also written to CSS variables on the tower so styles.css stays in sync.
 */
export const G = {
  floorH: 132,
  space: 92,
  labelW: 88,
  wall: 10,
  board: 5,
} as const;

const HOLD_MS = 250; // press and hold this long to pick a minion up
const MOVE_CANCEL_PX = 8; // moving further than this before the hold ends means "scroll", not "grab"

export type Selection = { kind: "room"; id: string } | { kind: "cell"; floor: number; cell: number } | null;

interface Props {
  state: GameState;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onPickUp: (minionId: string) => boolean;
  onDrop: (minionId: string, x: number, y: number, vx: number, vy: number) => void;
  /** Rendered above the roof, e.g. the build-floor button. */
  header?: React.ReactNode;
}

export function Tower({ state, selection, onSelect, onPickUp, onDrop, header }: Props) {
  const width = content.balance.floorWidth;
  const outside = content.balance.movement.outsideWidth;
  const grid = occupancy(content, state);
  const statuses = floorStatuses(content, state);

  const floors = [];
  for (let f = state.floors; f >= 1; f--) {
    const st = statuses[f - 1]!;
    const row = grid[f]!;
    const cells = [];
    for (let c = 0; c < width; c++) {
      const id = row[c];
      if (id === null || id === undefined) {
        const selected = selection?.kind === "cell" && selection.floor === f && selection.cell === c;
        cells.push(
          <button
            key={`e${c}`}
            className={`space${selected ? " selected" : ""}`}
            style={{ gridColumn: `${c + 1} / span 1` }}
            onClick={() => onSelect({ kind: "cell", floor: f, cell: c })}
            aria-label={`Empty space, floor ${f}, position ${c + 1}. Build here.`}
          >
            <span className="plus">+</span>
          </button>,
        );
        continue;
      }
      const room = state.rooms[id];
      if (!room || room.cell !== c) continue; // draw each room once, at its leftmost cell
      cells.push(
        <RoomArea
          key={room.id}
          state={state}
          room={room}
          width={content.rooms[room.type]?.width ?? 1}
          selected={selection?.kind === "room" && selection.id === room.id}
          onSelect={() => onSelect({ kind: "room", id: room.id })}
        />,
      );
    }
    floors.push(
      <div className={`storey${st.warm ? "" : " is-cold"}${f === 1 ? " ground-floor" : ""}`} key={f}>
        <div className="storey-label">
          <span className="floor-num">F{f}</span>
          <span className={st.warm ? "ok" : "cold"} title={st.warm ? "Warm" : "Cold: no lit furnace within 1 floor"}>
            {st.warm ? "warm" : "COLD"}
          </span>
          <span
            className={st.hasToilet ? "ok" : "bad"}
            title={`${st.users} minions here share ${st.toilets} working toilet(s) on the floors joined by stairs. Aim for 1 per ${content.balance.upkeep.minionsPerToilet}.`}
          >
            wc {st.users}/{st.toilets * content.balance.upkeep.minionsPerToilet}
          </span>
          {!st.connectedToGround && <span className="bad" title="No stairs connect this floor to the ground">cut off</span>}
        </div>
        <div className="storey-inside">{cells}</div>
        <div className="outside" aria-hidden="true">
          {f === 1 && <div className="door" />}
        </div>
      </div>,
    );
  }

  const style = {
    "--floor-h": `${G.floorH}px`,
    "--space": `${G.space}px`,
    "--label-w": `${G.labelW}px`,
    "--wall": `${G.wall}px`,
    "--board": `${G.board}px`,
    "--cols": width,
    "--outside": `${outside * G.space}px`,
  } as React.CSSProperties;

  return (
    <div className="tower" style={style}>
      {header && <div className="tower-header">{header}</div>}
      <div className="roof-row">
        <span className="roof-label">
          <span className="floor-num">Roof</span>{" "}
          <span className={isWarm(content, state, state.floors + 1) ? "ok" : "cold"}>
            {isWarm(content, state, state.floors + 1) ? "warm" : "COLD"}
          </span>
        </span>
        <div className="roof" aria-hidden="true" />
      </div>
      <div className="storeys">
        {floors}
        <Crowd state={state} onSelect={onSelect} onPickUp={onPickUp} onDrop={onDrop} />
      </div>
      <div className="ground" aria-hidden="true" />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Minions

interface Drag {
  id: string;
  /** Pointer position relative to the crowd layer, in px (y measured up from the ground floor's boards). */
  px: number;
  py: number;
  samples: { t: number; px: number; py: number }[];
}

function Crowd({
  state,
  onSelect,
  onPickUp,
  onDrop,
}: {
  state: GameState;
  onSelect: (s: Selection) => void;
  onPickUp: (id: string) => boolean;
  onDrop: Props["onDrop"];
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const press = useRef<{ id: string; x: number; y: number; timer: number; picked: boolean } | null>(null);

  const setBoth = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  // Crowd-layer coordinates: x from the inside of the left wall, y up from the ground floor's boards.
  const local = (clientX: number, clientY: number) => {
    const r = layerRef.current!.getBoundingClientRect();
    return { px: clientX - r.left, py: r.bottom - clientY };
  };

  // While a finger or mouse is down on a minion, the page must not select text.
  const lockSelection = (on: boolean) => document.body.classList.toggle("holding-minion", on);

  const onDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault(); // no text selection or native drag from this press
    e.currentTarget.setPointerCapture(e.pointerId);
    lockSelection(true);
    const start = local(e.clientX, e.clientY);
    const timer = window.setTimeout(() => {
      const pr = press.current;
      if (!pr || pr.id !== id || !onPickUp(id)) return;
      pr.picked = true;
      setBoth({ id, ...start, samples: [{ t: performance.now(), ...start }] });
    }, HOLD_MS);
    press.current = { id, x: e.clientX, y: e.clientY, timer, picked: false };
  };

  const onMove = (e: React.PointerEvent) => {
    const pr = press.current;
    if (!pr) return;
    if (!pr.picked) {
      if (Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > MOVE_CANCEL_PX) {
        clearTimeout(pr.timer);
        press.current = null;
        lockSelection(false);
      }
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    const p = local(e.clientX, e.clientY);
    const now = performance.now();
    setBoth({ ...d, ...p, samples: [...d.samples.filter((s) => now - s.t < 100), { t: now, ...p }] });
  };

  const onUp = (e: React.PointerEvent) => {
    const pr = press.current;
    press.current = null;
    lockSelection(false);
    if (!pr) return;
    clearTimeout(pr.timer);
    if (!pr.picked) {
      // A quick tap on a minion opens its home room.
      const m = state.minions[pr.id];
      if (m) onSelect({ kind: "room", id: m.roomId });
      return;
    }
    const d = dragRef.current;
    const p = local(e.clientX, e.clientY);
    let vxPx = 0;
    let vyPx = 0;
    if (d && d.samples.length > 1) {
      const a = d.samples[0]!;
      const b = d.samples[d.samples.length - 1]!;
      const secs = Math.max(0.016, (b.t - a.t) / 1000);
      vxPx = (b.px - a.px) / secs;
      vyPx = (b.py - a.py) / secs;
    }
    setBoth(null);
    // The finger holds the label's middle; the feet are a little lower.
    onDrop(pr.id, p.px / G.space, Math.max(0, p.py - 12) / G.floorH, vxPx / G.space, vyPx / G.floorH);
  };

  const width = content.balance.floorWidth;
  return (
    <div className="crowd" ref={layerRef}>
      {Object.values(state.minions).map((m) => {
        if (m.arrivesIn > 0) return null;
        const p = placement(m);
        const job = content.minions[m.type];
        const dragging = drag?.id === m.id;
        const left = dragging ? drag.px : p.x * G.space;
        const bottom = dragging ? drag.py - 12 : p.y * G.floorH;
        // Inside the tower, shift the label by its share of the width so it never pokes through a wall.
        const shift = dragging || p.x > width ? 50 : (p.x / width) * 100;
        const cls = [
          "walker",
          p.walking && "walking",
          p.running && "running",
          p.climbing && "climbing",
          p.falling && "falling",
          (dragging || p.carried) && "carried",
          m.sick > 0 && "sick",
          p.inToilet && "in-toilet",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <span
            key={m.id}
            className={cls}
            style={{ left: `${left}px`, bottom: `${bottom}px`, transform: `translateX(-${shift}%)`, zIndex: dragging ? 10 : 3 - m.depth }}
            title={`${m.name} the ${job?.name}: ${activityText(m)}. Hold to pick up.`}
            onPointerDown={(e) => onDown(e, m.id)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <span className="job" style={{ color: job?.color }}>
              {job?.name.toLowerCase()}
            </span>
            <span className="who">
              {m.name} <span className={`face mood-${Math.round(m.mood / 20)}`}>{face(m)}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Rooms

function RoomArea({
  state,
  room,
  width,
  selected,
  onSelect,
}: {
  state: GameState;
  room: Room;
  width: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const def = content.rooms[room.type]!;
  const residents = room.minionIds.map((id) => state.minions[id]).filter((m) => m !== undefined);
  const prod = def.production;
  const alert = (room.type === "furnace" && room.fuel <= 0) || (room.type === "toilet" && room.clogged);

  let detail: React.ReactNode = null;
  if (prod?.kind === "goods") {
    const ready = Object.entries(room.stored).filter(([, n]) => n > 0);
    detail = (
      <div className="room-detail">
        {prod.tiers.map((item, i) => (
          <div key={item}>
            {tag(item)} {bar(room.counters[i] ?? 0, 5)}
          </div>
        ))}
        <div className="ready">
          {ready.length ? `ready ${ready.map(([id, n]) => `${n}${tag(id)}`).join(" ")}` : " "}
          {storageFull(content, state, room) && <span className="full"> FULL</span>}
        </div>
      </div>
    );
  } else if (prod?.kind === "gold") {
    detail = (
      <div className="room-detail ready">
        {room.storedGold >= 1 ? `ready ${Math.floor(room.storedGold)}g` : " "}
        {storageFull(content, state, room) && <span className="full"> FULL</span>}
      </div>
    );
  } else if (room.type === "furnace") {
    const burn = content.balance.upkeep.furnaceBurnMinutes;
    detail = <div className="room-detail">{room.fuel > 0 ? `fire\n${bar(room.fuel / burn, 4)}` : "OUT!\ntap to\nrelight"}</div>;
  } else if (room.type === "toilet") {
    const limit = content.balance.toilet.visitsBeforeClog;
    const queue = Object.values(state.minions).filter((m) => m.errand?.toiletId === room.id && m.errand.stage === "queue").length;
    detail = (
      <div className="room-detail">
        {room.clogged ? "CLOGGED\ntap to\nfix" : `${room.occupant ? "busy" : "free"}\n${bar(room.visits / limit, 4)}`}
        {queue > 0 && `\nqueue ${queue}`}
      </div>
    );
  }

  return (
    <button
      className={`room tab-${def.tab} type-${room.type}${selected ? " selected" : ""}${alert ? " alert" : ""}`}
      style={{ gridColumn: `${room.cell + 1} / span ${width}` }}
      onClick={onSelect}
      aria-label={`${def.name}, level ${room.level}${
        residents.length ? `. Residents: ${residents.map((m) => `${m.name} ${face(m)}`).join(", ")}` : ""
      }`}
    >
      {isStairs(content, room) ? (
        <StairsArt facing={def.utility?.facing ?? "right"} />
      ) : (
        <span className="room-name">
          <span>
            {def.name}
            {def.levels.length > 1 && <span className="lvl"> L{room.level}</span>}
          </span>
          {def.resident && (
            <span className="slots">
              {residents.length}/{slots(content, room)}
            </span>
          )}
        </span>
      )}
      {detail}
    </button>
  );
}

const STEPS = 8;

/**
 * A flight of steps filling its whole space, from these floorboards up to the floor above.
 * Its ends match stairEnds(): 10% and 90% across the space.
 */
function StairsArt({ facing }: { facing: "left" | "right" }) {
  const pts: string[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const x = 10 + (80 * i) / STEPS;
    const y = 100 - (100 * i) / STEPS;
    if (i > 0) pts.push(`${x},${100 - (100 * (i - 1)) / STEPS}`);
    pts.push(`${x},${y}`);
  }
  const profile = `0,100 ${pts.join(" ")} 100,0`;
  return (
    <svg className={`stairs-art facing-${facing}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polygon className="stairs-body" points={`10,100 ${pts.join(" ")} 90,100`} />
      <polyline className="stairs-steps" points={profile} vectorEffect="non-scaling-stroke" />
      <line className="stairs-rail" x1="10" y1="88" x2="90" y2="-12" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
