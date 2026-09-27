import { useRef, useState } from "react";
import { content } from "../content";
import { newGame, population, towerLevel, type Command, type GameState } from "../sim";
import { exportSave, importSave } from "../app/save";
import { ConfirmButton } from "./Panels";
import { playTime, tag } from "./text";

type Dispatch = (cmd: Command) => string | null;

export function Hud({ state, debug, dispatch }: { state: GameState; debug: boolean; dispatch: Dispatch }) {
  const pop = population(state);
  const level = towerLevel(content, state.exp);
  return (
    <header className="hud">
      <div className="hud-title">
        <h1>{state.towerName}</h1>
        <span className="muted">
          level {level} · {state.exp} exp · played {playTime(state)}
        </span>
      </div>
      <dl className="hud-stats">
        <div>
          <dt>gold</dt>
          <dd>{Math.floor(state.gold)}g</dd>
        </div>
        <div>
          <dt>minions</dt>
          <dd>
            {pop.arrived}
            {pop.total > pop.arrived ? ` (+${pop.total - pop.arrived})` : ""}
          </dd>
        </div>
        <div>
          <dt>floors</dt>
          <dd>{state.floors}</dd>
        </div>
        {debug && (
          <div>
            <dt>crystals</dt>
            <dd>{state.crystals}</dd>
          </div>
        )}
      </dl>
      <button className="primary collect-all" onClick={() => dispatch({ type: "collectAll" })}>
        Collect all
      </button>
    </header>
  );
}

export function Inventory({ state }: { state: GameState }) {
  return (
    <ul className="inventory" aria-label="Stock">
      {Object.keys(content.items).map((id) => (
        <li key={id} className={`tier-${content.items[id]!.tier}`}>
          {tag(id)} <strong>{state.inventory[id] ?? 0}</strong>
        </li>
      ))}
    </ul>
  );
}

export function Log({ state }: { state: GameState }) {
  const recent = state.log.slice(-8).reverse();
  return (
    <section className="panel log" aria-label="Messages">
      <h3>Messages</h3>
      <ol>
        {recent.map((e) => (
          <li key={e.id}>{e.text}</li>
        ))}
      </ol>
    </section>
  );
}

export function SaveMenu({ state, onReplace }: { state: GameState; onReplace: (s: GameState) => void }) {
  const [text, setText] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportSave(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `witch-castle-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Save downloaded.");
  };

  const readFile = async (file: File) => {
    try {
      onReplace(importSave(await file.text()));
      setMessage("Save loaded.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  return (
    <section className="panel" aria-label="Save">
      <h3>Save</h3>
      <p className="muted">Progress saves automatically in this browser. Download a copy as a backup.</p>
      <div className="actions">
        <button onClick={download}>Download save</button>
        <button onClick={() => fileRef.current?.click()}>Load save file</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
            e.target.value = "";
          }}
        />
        <button onClick={() => setText(text === null ? exportSave(state) : null)}>{text === null ? "Show as text" : "Hide text"}</button>
        <ConfirmButton
          label="New game"
          confirmLabel="Erase and start over"
          danger
          onConfirm={() => {
            onReplace(newGame(content, state.towerName));
            setMessage("Started a new game.");
          }}
        />
      </div>
      {text !== null && <textarea id="save-text" readOnly value={text} rows={6} onFocus={(e) => e.target.select()} />}
      {message && <p className="muted">{message}</p>}
    </section>
  );
}

export function CheatPanel({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const [skip, setSkip] = useState("30");
  const [err, setErr] = useState<string | null>(null);
  const run = (cmd: Command) => setErr(dispatch(cmd));
  const allItems = (n: number) => Object.fromEntries(Object.keys(content.items).map((id) => [id, n]));

  return (
    <section className="panel cheats" aria-label="Developer cheats">
      <h3>Cheats (debug)</h3>
      <div className="actions">
        <button onClick={() => run({ type: "cheatAddGold", amount: 1000 })}>+1000g</button>
        <button onClick={() => run({ type: "cheatAddItems", items: allItems(50) })}>+50 of every good</button>
        <button onClick={() => run({ type: "cheatAddCrystals", amount: 10 })}>+10 crystals</button>
        <button onClick={() => run({ type: "cheatFinishTimers" })}>Finish arrivals</button>
        <button onClick={() => run({ type: "collectAll" })}>Collect all</button>
      </div>
      <div className="actions">
        <label htmlFor="cheat-skip">Skip minutes</label>
        <input id="cheat-skip" inputMode="numeric" value={skip} onChange={(e) => setSkip(e.target.value)} size={5} />
        <button onClick={() => run({ type: "cheatTimeSkip", minutes: Number(skip) })}>Skip</button>
      </div>
      <div className="actions">
        <span>Mood:</span>
        {[10, 30, 50, 70, 90].map((m) => (
          <button key={m} onClick={() => run({ type: "cheatSetMood", mood: m })}>
            {m}
          </button>
        ))}
      </div>
      <div className="actions">
        <label htmlFor="cheat-floors">Floors</label>
        <input
          id="cheat-floors"
          type="number"
          min={1}
          value={state.floors}
          onChange={(e) => run({ type: "cheatSetFloors", floors: Number(e.target.value) })}
        />
      </div>
      <div className="actions">
        <label htmlFor="cheat-time">Time scale</label>
        <select
          id="cheat-time"
          value={state.tuning.timeScale}
          onChange={(e) => run({ type: "cheatSetTuning", tuning: { timeScale: Number(e.target.value) } })}
        >
          {[0.5, 1, 2, 5, 10, 60].map((v) => (
            <option key={v} value={v}>
              {v}x
            </option>
          ))}
        </select>
        <label htmlFor="cheat-cost">Cost scale</label>
        <select
          id="cheat-cost"
          value={state.tuning.costScale}
          onChange={(e) => run({ type: "cheatSetTuning", tuning: { costScale: Number(e.target.value) } })}
        >
          {[0.1, 0.25, 0.5, 1, 2].map((v) => (
            <option key={v} value={v}>
              {v}x
            </option>
          ))}
        </select>
      </div>
      {err && <p className="bad">{err}</p>}
    </section>
  );
}
