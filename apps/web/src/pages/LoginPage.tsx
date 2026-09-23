import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { DemoControls } from "../components/DemoControls";
import { InlineAlert } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

const profiles = [
  ["Administrador", "admin@securedocs.test"], ["Gerente", "gerente@securedocs.test"],
  ["Supervisor", "supervisor@securedocs.test"], ["Empleado", "empleado@securedocs.test"],
  ["Auditor", "auditor@securedocs.test"], ["Invitado", "invitado@securedocs.test"]
] as const;
const demoPassword = "SecureDocs-Demo-Only-2026!";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setSubmitting(true);
    try { await login(correo, password); navigate("/", { replace: true }); }
    catch (cause) { setError(cause instanceof ApiError ? cause.error.message : "No se pudo iniciar sesión."); }
    finally { setSubmitting(false); }
  };
  const fill = (email: string) => { setCorreo(email); setPassword(demoPassword); setError(""); };

  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="brand light"><span className="brand-mark">S</span><div><strong>SecureDocs</strong><small>Control de acceso empresarial</small></div></div>
        <div className="intro-copy"><span className="eyebrow">Gestión documental segura</span><h1>Decisiones de acceso claras, trazables y centralizadas.</h1><p>La API valida cada operación mediante JWT, permisos por rol y políticas por atributos.</p></div>
        <div className="security-note"><span aria-hidden="true">✓</span><div><strong>Autoridad central</strong><p>La interfaz presenta la decisión recibida; no reemplaza la autorización del servidor.</p></div></div>
      </section>
      <section className="login-main">
        <div className="login-card">
          <span className="eyebrow">Acceso corporativo</span><h2>Iniciar sesión</h2><p>Usa tus credenciales asignadas para continuar.</p>
          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
          <form onSubmit={event => void submit(event)}>
            <label htmlFor="correo">Correo</label>
            <input id="correo" name="correo" type="email" autoComplete="username" required value={correo} onChange={event => setCorreo(event.target.value)} placeholder="nombre@empresa.com" />
            <label htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
            <button className="button primary wide" disabled={submitting}>{submitting ? "Validando…" : "Iniciar sesión"}</button>
          </form>
          <div className="profile-picker"><div><strong>Perfiles de demostración local</strong><small>Solo completan credenciales semilla públicas. Debes iniciar sesión.</small></div><div className="profile-grid">{profiles.map(([label, email]) => <button type="button" key={email} onClick={() => fill(email)}>{label}</button>)}</div></div>
        </div>
        <DemoControls />
      </section>
    </main>
  );
}
