import { useAuth } from "../context/AuthContext";
import { readable } from "../lib/format";
import type { Permission, Role } from "../types";

const roles: Role[] = ["ADMINISTRADOR", "GERENTE", "SUPERVISOR", "EMPLEADO", "AUDITOR", "INVITADO"];
const rows: Array<[Permission, Role[]]> = [
  ["CREAR_DOCUMENTO", ["ADMINISTRADOR", "GERENTE", "SUPERVISOR", "EMPLEADO"]],
  ["CONSULTAR_DOCUMENTO", roles],
  ["MODIFICAR_DOCUMENTO", ["ADMINISTRADOR", "GERENTE", "SUPERVISOR", "EMPLEADO"]],
  ["ELIMINAR_DOCUMENTO", ["ADMINISTRADOR", "GERENTE"]],
  ["APROBAR_DOCUMENTO", ["ADMINISTRADOR", "GERENTE", "SUPERVISOR"]],
  ["VER_AUDITORIA", ["ADMINISTRADOR", "GERENTE", "AUDITOR"]],
  ["GESTIONAR_USUARIOS", ["ADMINISTRADOR"]],
  ["ASIGNAR_ROLES", ["ADMINISTRADOR"]]
];

export function RbacPage() {
  const { user, permissions } = useAuth();
  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Inspector RBAC</span><h1>Matriz de permisos</h1><p>La fila destacada corresponde al rol informado por la API para esta sesión.</p></div><span className="role-badge large">{user?.rol}</span></header>
      <article className="panel"><div className="panel-heading"><div><span className="eyebrow">Respuesta en vivo</span><h2>Permisos efectivos del usuario</h2></div><span className="badge success">{permissions.length} activos</span></div><div className="permission-list">{permissions.map(permission => <span key={permission}>✓ {readable(permission)}</span>)}</div></article>
      <article className="panel table-panel"><div className="table-scroll"><table><caption className="sr-only">Matriz informativa de roles y permisos</caption><thead><tr><th>Permiso</th>{roles.map(role => <th className={role === user?.rol ? "current-column" : ""} key={role}>{role.slice(0, 5)}</th>)}</tr></thead><tbody>{rows.map(([permission, allowed]) => <tr key={permission}><th>{readable(permission)}</th>{roles.map(role => <td className={role === user?.rol ? "current-column" : ""} key={role}><span className={allowed.includes(role) ? "matrix-yes" : "matrix-no"} aria-label={allowed.includes(role) ? "Permitido" : "Sin permiso"}>{allowed.includes(role) ? "✓" : "—"}</span></td>)}</tr>)}</tbody></table></div><p className="table-note">Matriz informativa de los seis roles y ocho permisos. Los permisos efectivos mostrados arriba provienen de <code>GET /auth/permissions</code>.</p></article>
    </>
  );
}
