import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ErrorDialog } from "../components/ErrorDialog";
import { EmptyState, InlineAlert, LoadingState } from "../components/Status";
import { ApiError, apiRequest } from "../lib/api";
import { readable, shortId } from "../lib/format";
import type { ContractType, Department, Role, SecurityLevel, User, UserStatus } from "../types";

type UserForm = { nombre: string; correo: string; password: string; rol: Role; departamento: string; nivelSeguridad: SecurityLevel; pais: string; tipoContrato: ContractType; estado: UserStatus };
const initial: UserForm = { nombre: "", correo: "", password: "", rol: "EMPLEADO", departamento: "", nivelSeguridad: "NIVEL_1", pais: "PERU", tipoContrato: "INDEFINIDO", estado: "ACTIVO" };
const roles: Role[] = ["ADMINISTRADOR", "GERENTE", "SUPERVISOR", "EMPLEADO", "AUDITOR", "INVITADO"];

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [form, setForm] = useState<UserForm>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [people, catalogs] = await Promise.all([apiRequest<{ users: User[] }>("/usuarios"), apiRequest<{ departamentos: Department[] }>("/catalogos/departamentos")]);
      setUsers(people.users); setDepartments(catalogs.departamentos);
    } catch (cause) { if (cause instanceof ApiError) setError(cause); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = (user?: User) => {
    setNotice(""); setEditing(user ?? "new");
    setForm(user ? { nombre: user.nombre, correo: user.correo, password: "", rol: user.rol, departamento: user.departamento ?? "", nivelSeguridad: user.nivelSeguridad, pais: user.pais, tipoContrato: user.tipoContrato, estado: user.estado } : initial);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setNotice("");
    const body: Record<string, string | null> = { ...form, departamento: form.departamento || null };
    if (editing !== "new" && !form.password) delete body.password;
    try {
      await apiRequest(editing === "new" ? "/usuarios" : `/usuarios/${editing?.id}`, { method: editing === "new" ? "POST" : "PUT", body });
      setEditing(null); setNotice(editing === "new" ? "Usuario creado por la API." : "Usuario actualizado por la API."); await load();
    } catch (cause) { if (cause instanceof ApiError) setError(cause); }
    finally { setSaving(false); }
  };
  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Gobierno de identidades</span><h1>Gestión de usuarios</h1><p>Esta vista carga únicamente si la API concede <code>GESTIONAR_USUARIOS</code>.</p></div><button className="button primary" onClick={() => open()}>+ Crear usuario</button></header>
      {notice && <InlineAlert tone="success">{notice}</InlineAlert>}
      {loading ? <LoadingState message="Verificando permiso y cargando usuarios…" /> : users.length === 0 ? <EmptyState title="Sin usuarios" detail="La API no devolvió cuentas." /> : <article className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Departamento</th><th>Nivel</th><th>Contrato</th><th>Estado</th><th></th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><strong>{user.nombre}</strong><small>{user.correo} · {shortId(user.id)}</small></td><td>{user.rol}</td><td>{readable(user.departamento)}</td><td>{readable(user.nivelSeguridad)}</td><td>{user.tipoContrato}</td><td><span className={`badge ${user.estado === "ACTIVO" ? "success" : "danger"}`}>{user.estado}</span></td><td><button onClick={() => open(user)}>Editar</button></td></tr>)}</tbody></table></div></article>}
      {editing && <section className="panel form-panel"><div className="panel-heading"><div><span className="eyebrow">{editing === "new" ? "Alta" : "Actualización"}</span><h2>{editing === "new" ? "Registrar usuario" : `Editar ${editing.nombre}`}</h2></div><button className="icon-button" aria-label="Cerrar formulario" onClick={() => setEditing(null)}>×</button></div><form className="form-grid" onSubmit={event => void submit(event)}><label>Nombre<input required maxLength={120} value={form.nombre} onChange={event => setForm({ ...form, nombre: event.target.value })} /></label><label>Correo<input required type="email" value={form.correo} onChange={event => setForm({ ...form, correo: event.target.value })} /></label><label>Contraseña {editing !== "new" && <small>(vacía conserva la actual)</small>}<input required={editing === "new"} minLength={12} type="password" autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label><label>Rol<select value={form.rol} onChange={event => setForm({ ...form, rol: event.target.value as Role })}>{roles.map(role => <option key={role}>{role}</option>)}</select></label><label>Departamento<select value={form.departamento} onChange={event => setForm({ ...form, departamento: event.target.value })}><option value="">Sin departamento</option>{departments.map(department => <option key={department.id} value={department.nombre}>{department.nombre}</option>)}</select></label><label>Nivel<select value={form.nivelSeguridad} onChange={event => setForm({ ...form, nivelSeguridad: event.target.value as SecurityLevel })}>{[1,2,3,4,5].map(level => <option key={level} value={`NIVEL_${level}`}>Nivel {level}</option>)}</select></label><label>País<input required value={form.pais} onChange={event => setForm({ ...form, pais: event.target.value.toUpperCase() })} /></label><label>Contrato<select value={form.tipoContrato} onChange={event => setForm({ ...form, tipoContrato: event.target.value as ContractType })}>{["INDEFINIDO","TEMPORAL","CONSULTOR","EXTERNO"].map(value => <option key={value}>{value}</option>)}</select></label><label>Estado<select value={form.estado} onChange={event => setForm({ ...form, estado: event.target.value as UserStatus })}>{["ACTIVO","INACTIVO","SUSPENDIDO"].map(value => <option key={value}>{value}</option>)}</select></label><div className="form-actions full"><button type="button" className="button ghost" onClick={() => setEditing(null)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? "Guardando…" : "Guardar mediante API"}</button></div></form></section>}
      <ErrorDialog error={error} onClose={() => setError(null)} />
    </>
  );
}
