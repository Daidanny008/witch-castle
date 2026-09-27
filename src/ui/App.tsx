import { useEffect, useState } from "react";
import { content } from "../content";
import { canAfford, floorCost, type GameState } from "../sim";
import { GameStore, useGame } from "../app/store";
import { BuildMenu, ConfirmButton, RoomPanel } from "./Panels";
import { CheatPanel, Hud, Inventory, Log, SaveMenu } from "./Side";
import { costText } from "./text";
import { Tower, type Selection } from "./Tower";

export function App({ store, debug, startupNotice }: { store: GameStore; debug: boolean; startupNotice: string | null }) {
  const state = useGame(store);
  const [selection, setSelection] = useState<Selection>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(startupNotice);

  const dispatch = (cmd: Parameters<GameStore["dispatch"]>[0]) => {
    const err = store.dispatch(cmd);
    setNotice(err);
    return err;
  };

  // Clear a stale error after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // Tapping a broken furnace or toilet fixes it right away; everything else opens its panel.
  const onSelect = (sel: Selection) => {
    if (sel?.kind === "room") {
      const r = state.rooms[sel.id];
      if (r?.type === "furnace" && r.fuel <= 0) dispatch({ type: "relightFurnace", roomId: r.id });
      if (r?.type === "toilet" && r.clogged) dispatch({ type: "unclogToilet", roomId: r.id });
    }
    setSelection(sel);
  };

  const replace = (s: GameState) => {
    store.replace(s);
    setSelection(null);
  };

  const latest = state.log[state.log.length - 1];
  const next = floorCost(content, state.floors + 1, state.tuning.costScale);

  return (
    <div className="app">
      <Hud state={state} debug={debug} dispatch={dispatch} />
      <Inventory state={state} />
      {warning && (
        <div className="status error" role="alert">
          {warning}{" "}
          <button className="small" onClick={() => setWarning(null)}>
            Dismiss
          </button>
        </div>
      )}
      <div className={`status${notice ? " error" : ""}`} role="status" aria-live="polite">
        {notice ?? latest?.text ?? " "}
      </div>
      <main className="layout">
        <div className="tower-wrap">
          <Tower
            state={state}
            selection={selection}
            onSelect={onSelect}
            onPickUp={(id) => dispatch({ type: "pickUp", minionId: id }) === null}
            onDrop={(id, x, y, vx, vy) => dispatch({ type: "drop", minionId: id, x, y, vx, vy })}
            header={
              <ConfirmButton
                label={`+ Build floor ${state.floors + 1} (${costText(next)})`}
                confirmLabel={`Pay ${costText(next)}`}
                disabled={!canAfford(state, next)}
                onConfirm={() => dispatch({ type: "buildFloor" })}
              />
            }
          />
        </div>
        <aside className="side">
          {selection?.kind === "room" && (
            <RoomPanel
              state={state}
              roomId={selection.id}
              dispatch={dispatch}
              debug={debug}
              onClose={() => setSelection(null)}
            />
          )}
          {selection?.kind === "cell" && (
            <BuildMenu
              state={state}
              floor={selection.floor}
              cell={selection.cell}
              dispatch={dispatch}
              onClose={() => setSelection(null)}
              onBuilt={() => setSelection(null)}
            />
          )}
          {!selection && (
            <section className="panel">
              <h3>How to play</h3>
              <p>Tap a room to see it. Tap an empty + to build. Collect goods, recruit minions, and keep your minions warm and fed, with toilets they can reach.</p>
              <p className="muted">
                Moods: :D happy · :) content · :| meh · :( sad · &gt;:( angry · ... arriving
              </p>
            </section>
          )}
          <Log state={state} />
          {debug && <CheatPanel state={state} dispatch={dispatch} />}
          <SaveMenu state={state} onReplace={replace} />
        </aside>
      </main>
    </div>
  );
}
