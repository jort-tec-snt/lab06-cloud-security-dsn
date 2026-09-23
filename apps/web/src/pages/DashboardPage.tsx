import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorDialog } from "../components/ErrorDialog";
import { LoadingState } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiRequest } from "../lib/api";
import { demoEnabled, getDemoContext } from "../lib/demo";
import { readable } from "../lib/format";
import type { DocumentRecord } from "../types";

export function DashboardPage() {
  const { user, permissions } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => { apiRequest<{ documentos: DocumentRecord[] }>("/documentos").then(data => setDocuments(data.documentos)).catch(cause => cause instanceof ApiError && setError(cause)).finally(() => setLoading(false)); }, []);
  if (!user) return null;
  const pending = documents.filter(document => document.estado === "PENDIENTE").length;
  const context = getDemoContext();
  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Security posture dashboard</span><h1>Postura de seguridad</h1><p>Identidad vigente, autorizaciones efectivas y documentos visibles para esta sesión.</p></div><Link className="button primary" to="/documentos">Abrir documentos</Link></header>
      <section className="metrics-grid" aria-label="Indicadores de la sesión">
        <article className="metric"><span>Documentos visibles</span><strong>{loading ? "—" : documents.length}</strong><small>Respuesta filtrada por la API</small></article>
        <article className="metric"><span>Pendientes visibles</span><strong>{loading ? "—" : pending}</strong><small>Dentro del acceso autorizado</small></article>
        <article className="metric"><span>Permisos efectivos</span><strong>{permissions.length}</strong><small>Respuesta de /auth/permissions</small></article>
        <article className="metric status"><span>Estado de cuenta</span><strong>{user.estado}</strong><small>Validado en cada solicitud</small></article>
      </section>
      <section className="two-column posture-grid">
        <article className="panel identity-panel"><div className="panel-heading"><div><span className="eyebrow">01 / Identidad</span><h2>Atributos del sujeto</h2></div><span className={`badge ${user.estado === "ACTIVO" ? "success" : "warning"}`}>{user.estado}</span></div><dl className="detail-list"><div><dt>Nombre</dt><dd>{user.nombre}</dd></div><div><dt>Correo</dt><dd>{user.correo}</dd></div><div><dt>Rol</dt><dd>{user.rol}</dd></div><div><dt>Departamento</dt><dd>{readable(user.departamento)}</dd></div><div><dt>Nivel de seguridad</dt><dd>{readable(user.nivelSeguridad)}</dd></div><div><dt>País</dt><dd>{user.pais}</dd></div><div><dt>Contrato</dt><dd>{readable(user.tipoContrato)}</dd></div></dl></article>
        <article className="panel authorization-panel"><div className="panel-heading"><div><span className="eyebrow">02 / Autorización</span><h2>Permisos efectivos</h2></div><Link to="/rbac">Ver matriz →</Link></div><div className="permission-list">{permissions.map(permission => <div key={permission} className="permission-row"><span className="permission-check" aria-hidden="true">✓</span><span>{readable(permission)}</span></div>)}</div>{permissions.length === 0 && <p>No se recibieron permisos efectivos.</p>}
          {demoEnabled && <div className="context-summary"><h3>Contexto de demostración</h3><p><strong>Hora:</strong> {context.hour}:00 · <strong>Ubicación:</strong> {context.location} · <strong>Dispositivo:</strong> {context.device}</p><small>La ubicación contextual no reemplaza la comparación de país del usuario y documento.</small></div>}
        </article>
      </section>
      {loading && <LoadingState message="Consultando resumen documental…" />}
      <ErrorDialog error={error} onClose={() => setError(null)} />
    </>
  );
}
