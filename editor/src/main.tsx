import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@nicklaj/knotwork/knotwork.css";
import "./index.css";
import { startAutosave } from "./io/autosave";
import { startValidation } from "./validation";

startValidation();
startAutosave();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
