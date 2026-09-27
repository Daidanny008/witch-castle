import { useSyncExternalStore } from "react";
import { content } from "../content";
import { apply, newGame, stepInPlace, type Command, type GameState } from "../sim";
import { save, saveNow } from "./save";

type Listener = () => void;

/** Holds the live game state, runs the game loop and saves continuously. */
export class GameStore {
  private state: GameState;
  private listeners = new Set<Listener>();
  private lastError: { text: string; at: number } | null = null;
  private frame = 0;
  private last = 0;
  private notifyAcc = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private autosave: ReturnType<typeof setInterval> | null = null;

  constructor(initial?: GameState) {
    this.state = initial ?? newGame(content);
  }

  get = (): GameState => this.state;
  error = () => this.lastError;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private notify() {
    for (const fn of this.listeners) fn();
  }

  /** Applies a command. Returns the error text if it was refused. */
  dispatch = (cmd: Command): string | null => {
    const r = apply(content, this.state, cmd);
    this.state = r.state;
    this.lastError = r.ok ? null : { text: r.error, at: Date.now() };
    this.notify();
    if (r.ok) this.scheduleSave();
    return r.ok ? null : r.error;
  };

  /** Replaces the whole state, for example after importing a save or starting over. */
  replace(state: GameState) {
    this.state = state;
    this.lastError = null;
    this.notify();
    void save(state);
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void save(this.state), 400);
  }

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      // Clamp so a backgrounded tab doesn't jump ahead: no time passes while the game isn't running.
      const realDt = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      stepInPlace(content, this.state, realDt * this.state.tuning.timeScale);
      this.notifyAcc += realDt;
      if (this.notifyAcc >= 0.1) {
        this.notifyAcc = 0;
        // New object identity so React sees the change; the sim mutated in place for speed.
        this.state = { ...this.state };
        this.notify();
      }
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
    this.autosave = setInterval(() => void save(this.state), 5000);
    document.addEventListener("visibilitychange", this.onHide);
    window.addEventListener("pagehide", this.onPageHide);
  }

  stop() {
    cancelAnimationFrame(this.frame);
    if (this.autosave) clearInterval(this.autosave);
    document.removeEventListener("visibilitychange", this.onHide);
    window.removeEventListener("pagehide", this.onPageHide);
  }

  private onHide = () => {
    if (document.visibilityState === "hidden") saveNow(this.state);
  };

  private onPageHide = () => saveNow(this.state);
}

export function useGame(store: GameStore): GameState {
  return useSyncExternalStore(store.subscribe, store.get);
}
