import { useState } from "react";
import { demoEnabled, getDemoContext, setDemoContext, type DemoContext } from "../lib/demo";

export function DemoControls({ compact = false }: { compact?: boolean }) {
  const [values, setValues] = useState<DemoContext>(getDemoContext());
  if (!demoEnabled) return null;
  const update = (next: DemoContext) => { setValues(next); setDemoContext(next); };
  return (
    <section className={`demo-panel ${compact ? "compact" : ""}`} aria-label="Contexto de demostración">
      <div className="demo-banner">MODO DEMOSTRACIÓN - SOLO DESARROLLO LOCAL</div>
      <div className="demo-fields">
        <label>Hora en Lima
          <input type="number" min="0" max="23" value={values.hour} onChange={event => update({ ...values, hour: event.target.value })} />
        </label>
        <label>Ubicación
          <select value={values.location} onChange={event => update({ ...values, location: event.target.value })}>
            <option value="PERU">PERÚ</option><option value="CHILE">CHILE</option><option value="COLOMBIA">COLOMBIA</option>
          </select>
        </label>
        <label>Dispositivo
          <select value={values.device} onChange={event => update({ ...values, device: event.target.value as DemoContext["device"] })}>
            <option value="CORPORATIVO">CORPORATIVO</option><option value="PERSONAL">PERSONAL</option>
          </select>
        </label>
      </div>
      {!compact && <p>Estas cabeceras solo tienen efecto si la API usa <code>DEMO_MODE=true</code> fuera de producción. La ubicación se registra como contexto; <code>PAIS_PERMITIDO</code> compara el país del usuario con el del documento.</p>}
    </section>
  );
}
