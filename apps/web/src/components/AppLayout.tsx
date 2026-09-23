import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { DemoControls } from "./DemoControls";

const groups = [
  { label: "Espacio de trabajo", items: [["/", "Dashboard", "▣", null], ["/documentos", "Documentos", "▤", null]] },
  { label: "Control y trazabilidad", items: [["/rbac", "Inspector RBAC", "▦", null], ["/auditoria", "Auditoría", "◎", "VER_AUDITORIA"], ["/usuarios", "Usuarios", "♙", "GESTIONAR_USUARIOS"]] }
] as const;

export function AppLayout() {
  const { user, permissions, logout } = useAuth();
  const navigate = useNavigate();
  const endSession = async () => { await logout(); navigate("/login", { replace: true }); };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">S</span><div><strong>SecureDocs</strong><small>Gobierno documental</small></div></div>
        <nav aria-label="Navegación principal">
          {groups.map(group => <div className="nav-group" key={group.label}><span className="nav-group-label">{group.label}</span>{group.items.filter(([, , , permission]) => !permission || permissions.includes(permission)).map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === "/"}><span className="nav-icon" aria-hidden="true">{icon}</span><span>{label}</span></NavLink>
          ))}</div>)}
        </nav>
        <div className="sidebar-foot"><span>SECUREDOCS / CONSOLE</span><small>Control de acceso · RBAC + ABAC</small></div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="session-identity"><span className="session-avatar" aria-hidden="true">{user?.nombre?.charAt(0).toUpperCase()}</span><div><span className="eyebrow">Sesión activa</span><strong>{user?.nombre}</strong></div></div>
          <div className="topbar-actions"><span className="session-status"><span className={`status-dot ${user?.estado === "ACTIVO" ? "is-active" : ""}`} />{user?.estado}</span><span className="role-badge">{user?.rol}</span><span className="level-badge">{user?.nivelSeguridad.replace("NIVEL_", "N")}</span><button className="button ghost" onClick={() => void endSession()}>Cerrar sesión</button></div>
        </header>
        <DemoControls compact />
        <main className="main-content"><Outlet /></main>
      </div>
    </div>
  );
}
