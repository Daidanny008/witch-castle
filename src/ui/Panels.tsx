import { useState } from "react";
import { content, type RoomDef } from "../content";
import {
  activityText,
  canAfford,
  fits,
  missing,
  recruitCost,
  roomLevelCost,
  slots,
  type Command,
  type GameState,
} from "../sim";
import { clock, costText, face, NEED_LABEL, tag } from "./text";

type Dispatch = (cmd: Command) => string | null;

/** A button that asks "Sure?" inline before running. Used for anything that spends or destroys. */
export function ConfirmButton({
  label,
  confirmLabel = "Confirm",
  onConfirm,
  disabled,
  danger,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button className={danger ? "danger" : undefined} disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm">
      <button
        className={danger ? "danger" : "primary"}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button onClick={() => setAsking(false)}>Cancel</button>
    </span>
  );
}

export function RoomPanel({
  state,
  roomId,
  dispatch,
  debug,
  onClose,
}: {
  state: GameState;
  roomId: string;
  dispatch: Dispatch;
  debug: boolean;
  onClose: () => void;
}) {
  const room = state.rooms[roomId];
  if (!room) return null;
  const def = content.rooms[room.type]!;
  const scale = state.tuning.costScale;
  const residents = room.minionIds.map((id) => state.minions[id]).filter((m) => m !== undefined);
  const free = slots(content, room) - residents.length;
  const rCost = def.resident ? recruitCost(content, def.resident, scale) : undefined;
  const nextLevel = room.level < def.levels.length ? roomLevelCost(content, room.type, room.level + 1, scale) : undefined;
  const hasStored = room.storedGold >= 1 || Object.values(room.stored).some((n) => n > 0);

  return (
    <section className="panel" aria-label={`${def.name} details`}>
      <header className="panel-head">
        <h2>
          {def.name} {def.levels.length > 1 && <span className="lvl">L{room.level}</span>}
        </h2>
        <button className="close" onClick={onClose} aria-label="Close">
          x
        </button>
      </header>
      <p className="flavor">{def.flavor}</p>
      <p className="muted">Floor {room.floor}</p>

      {def.production?.kind === "goods" && (
        <p>
          Makes {def.production.tiers.map(tag).join(" ")} at{" "}
          {content.balance.production.tierRatios[room.level - 1]!.join(" : ")}
        </p>
      )}
      {def.production?.kind === "gold" && (
        <p>
          Each resident makes {def.production.goldPerMinute}g a minute, storing up to {def.production.storageMinutes} minutes.
        </p>
      )}

      <div className="actions">
        {def.production && (
          <button className="primary" disabled={!hasStored} onClick={() => dispatch({ type: "collect", roomId })}>
            Collect
          </button>
        )}
        {room.type === "furnace" && room.fuel <= 0 && (
          <button className="primary" onClick={() => dispatch({ type: "relightFurnace", roomId })}>
            Relight ({costText(content.balance.upkeep.furnaceRelightCost)})
          </button>
        )}
        {room.type === "toilet" && room.clogged && (
          <button className="primary" onClick={() => dispatch({ type: "unclogToilet", roomId })}>
            Unclog
          </button>
        )}
      </div>

      {def.resident && (
        <>
          <h3>
            Residents {residents.length}/{slots(content, room)}
          </h3>
          <ul className="residents">
            {residents.map((m) => (
              <li key={m.id}>
                <span className="face">{face(m)}</span>{" "}
                <strong>{m.name}</strong>{" "}
                <span style={{ color: content.minions[m.type]?.color }}>{content.minions[m.type]?.name.toLowerCase()}</span>
                {m.arrivesIn <= 0 && <span className="muted"> · {activityText(m)}</span>}
                {m.arrivesIn > 0 ? (
                  <span className="muted">
                    {" "}
                    arriving in {clock(m.arrivesIn)}
                    {debug && (
                      <button className="small" onClick={() => dispatch({ type: "hurryArrival", minionId: m.id })}>
                        Hurry ({content.balance.cheats.crystalFinishCost} crystal)
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="needs">
                    {(Object.keys(NEED_LABEL) as (keyof typeof NEED_LABEL)[]).map((k) => (
                      <span key={k} className={m.needs[k] ? "ok" : "bad"}>
                        {m.needs[k] ? NEED_LABEL[k] : `not ${NEED_LABEL[k]}`}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {free > 0 && rCost && (
            <ConfirmButton
              label={`Recruit a ${content.minions[def.resident]!.name} (${costText(rCost)})`}
              confirmLabel={`Pay ${costText(rCost)}`}
              disabled={!canAfford(state, rCost)}
              onConfirm={() => dispatch({ type: "recruit", roomId })}
            />
          )}
          {free > 0 && rCost && !canAfford(state, rCost) && <p className="muted">Need {missing(state, rCost).join(", ")}.</p>}
        </>
      )}

      <h3>Room</h3>
      <div className="actions">
        {nextLevel && (
          <ConfirmButton
            label={`Upgrade to L${room.level + 1} (${costText(nextLevel)})`}
            confirmLabel={`Pay ${costText(nextLevel)}`}
            disabled={!canAfford(state, nextLevel)}
            onConfirm={() => dispatch({ type: "upgradeRoom", roomId })}
          />
        )}
        <ConfirmButton
          label="Demolish"
          confirmLabel="Demolish, refund 1/3"
          danger
          onConfirm={() => {
            dispatch({ type: "demolishRoom", roomId });
            onClose();
          }}
        />
      </div>
      {nextLevel && !canAfford(state, nextLevel) && <p className="muted">Upgrade needs {missing(state, nextLevel).join(", ")}.</p>}
    </section>
  );
}

const TABS: RoomDef["tab"][] = ["dwelling", "crafting", "service", "entertain", "tower"];

export function BuildMenu({
  state,
  floor,
  cell,
  dispatch,
  onClose,
  onBuilt,
}: {
  state: GameState;
  floor: number;
  cell: number;
  dispatch: Dispatch;
  onClose: () => void;
  onBuilt: () => void;
}) {
  const [tab, setTab] = useState<RoomDef["tab"]>("dwelling");
  const scale = state.tuning.costScale;
  const options = Object.entries(content.rooms).filter(([, d]) => d.tab === tab);

  return (
    <section className="panel" aria-label="Build a room">
      <header className="panel-head">
        <h2>
          Build on floor {floor}, space {cell + 1}
        </h2>
        <button className="close" onClick={onClose} aria-label="Close">
          x
        </button>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {options.length === 0 && <p className="muted">Nothing in this tab yet. More rooms arrive in later milestones.</p>}
      <ul className="build-list">
        {options.map(([id, d]) => {
          const cost = roomLevelCost(content, id, 1, scale)!;
          const locked = d.unlockFloor > state.floors;
          const fitsHere = fits(content, state, id, floor, cell);
          const short = missing(state, cost);
          const reason = locked
            ? `Unlocks at floor ${d.unlockFloor}`
            : !fitsHere
              ? `Needs ${d.width} free spaces from here`
              : short.length
                ? `Need ${short.join(", ")}`
                : "";
          return (
            <li key={id} className={reason ? "unavailable" : ""}>
              <div className="build-head">
                <strong>{d.name}</strong> <span className="muted">{d.width} wide</span>
              </div>
              <div className="flavor">{d.flavor}</div>
              <div className="build-foot">
                <span className="cost">{costText(cost)}</span>
                <button
                  className="primary"
                  disabled={!!reason}
                  onClick={() => {
                    if (!dispatch({ type: "buildRoom", roomType: id, floor, cell })) onBuilt();
                  }}
                >
                  Build
                </button>
              </div>
              {reason && <div className="muted">{reason}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
