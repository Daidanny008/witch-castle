import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameStore } from "./app/store";
import { load, requestPersistence } from "./app/save";
import { App } from "./ui/App";
import "./ui/styles.css";

/** Cheats show with ?debug in the URL, and always in development unless ?debug=0. */
function debugEnabled(): boolean {
  const p = new URLSearchParams(location.search).get("debug");
  if (p === "0") return false;
  return p !== null || import.meta.env.DEV;
}

async function boot() {
  const root = createRoot(document.getElementById("root")!);
  const loaded = await load();
  const store = new GameStore(loaded.state);
  store.start();
  void requestPersistence();
  root.render(
    <StrictMode>
      <App
        store={store}
        debug={debugEnabled()}
        startupNotice={
          loaded.problem
            ? `Your saved game couldn't be loaded (${loaded.problem}). A copy was kept in this browser as "${loaded.keptAs}", and a new game has started.`
            : null
        }
      />
    </StrictMode>,
  );
}

void boot();
