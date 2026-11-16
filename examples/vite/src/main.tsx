import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "react-smart-rewrite/styles.css";
import "./app.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
