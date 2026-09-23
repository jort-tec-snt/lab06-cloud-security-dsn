import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Las lecturas quedan auditadas por la API. Evitamos el doble montaje de StrictMode
// en desarrollo para no generar dos trazas por una sola acción visible del usuario.
createRoot(document.getElementById("root")!).render(<App />);
