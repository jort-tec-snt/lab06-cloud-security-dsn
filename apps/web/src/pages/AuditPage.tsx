import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ErrorDialog } from "../components/ErrorDialog";
import { EmptyState, LoadingState } from "../components/Status";
import { ApiError, apiRequest } from "../lib/api";
import { formatDate, shortId } from "../lib/format";
import type { AuditRecord } from "../types";

type Filters = { resultado: string; usuario: string; accion: string; capa: string };

export function AuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [filters, setFilters] = useState<Filters>({ resultado: "", usuario: "", accion: "", capa: "" });
  const [applied, setApplied] = useState<Filters>(filters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const limit = 20;
  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ pagina: String(page), limite: String(limit) });
    if (applied.resultado) params.set("resultado", applied.resultado);
    if (applied.usuario) params.set("usuario", applied.usuario);
    if (applied.accion) params.set("accion", applied.accion);
    try { const result = await apiRequest<{ auditorias: AuditRecord[]; total: number }>(`/auditoria?${params}`); setRecords(result.auditorias); setTotal(result.total); }
    catch (cause) { if (cause instanceof ApiError) setError(cause); }
    finally { setLoading(false); }
  }, [applied, page]);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => records.filter(record => !applied.capa || record.motivo.startsWith(`${applied.capa}:`)), [records, applied.capa]);
  const pages = Math.max(1, Math.ceil(total / limit));
  const apply = (event: FormEvent) => { event.preventDefault(); setPage(1); setApplied(filters); };
  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Trazabilidad / Eventos</span><h1>Registro de auditoría</h1><p>Eventos reales de <code>GET /auditoria</code> para inspección y seguimiento.</p></div><span className="readonly-badge">Solo lectura</span></header>
      <form className="filter-bar" onSubmit={apply} aria-label="Consultar eventos de auditoría"><div className="filter-heading"><span className="eyebrow">Consulta de eventos</span><strong>Filtros</strong></div><label>Resultado<select value={filters.resultado} onChange={event => setFilters({ ...filters, resultado: event.target.value })}><option value="">Todos</option><option>PERMITIDO</option><option>DENEGADO</option><option>ERROR</option></select></label><label>Capa<select value={filters.capa} onChange={event => setFilters({ ...filters, capa: event.target.value })}><option value="">Todas</option><option value="AUTH">AUTH</option><option value="RBAC">RBAC</option><option value="ABAC">ABAC</option></select></label><label>Usuario UUID<input value={filters.usuario} onChange={event => setFilters({ ...filters, usuario: event.target.value })} placeholder="UUID del sujeto" /></label><label>Acción<input value={filters.accion} onChange={event => setFilters({ ...filters, accion: event.target.value.toUpperCase() })} placeholder="CONSULTAR_DOCUMENTO" /></label><button className="button secondary">Aplicar filtros</button></form>
      <section className="audit-metrics" aria-label="Resumen de resultados"><div><span>Total de la consulta API</span><strong>{total}</strong></div><div><span>Permitidos en esta página</span><strong className="green">{visible.filter(item => item.resultado === "PERMITIDO").length}</strong></div><div><span>Denegados en esta página</span><strong className="red">{visible.filter(item => item.resultado === "DENEGADO").length}</strong></div></section>
      {loading ? <LoadingState message="Consultando trazas de auditoría…" /> : visible.length === 0 ? <EmptyState title="Sin eventos" detail="No hay registros para los filtros seleccionados en esta página." /> : <article className="panel table-panel audit-panel"><div className="table-scroll"><table className="audit-table"><thead><tr><th>Fecha / evento</th><th>Sujeto</th><th>Acción / recurso</th><th>Contexto</th><th>Resultado</th><th>Capa / motivo técnico</th></tr></thead><tbody>{visible.map(record => { const layer = record.motivo.match(/^(AUTH|RBAC|ABAC):/)?.[1]; return <tr key={record.id}><td className="date-cell">{formatDate(record.fecha)}<small title={record.id}>ID {shortId(record.id)}</small></td><td className="subject-cell" title={record.usuarioId ?? undefined}>{record.usuarioId ? shortId(record.usuarioId) : "Anónimo"}</td><td className="action-cell"><strong>{record.accion}</strong><small>{record.recurso}</small></td><td className="context-cell"><span>{record.ubicacion}</span><small>{record.direccionIp} · {record.dispositivo}</small></td><td><span className={`badge ${record.resultado === "PERMITIDO" ? "success" : record.resultado === "DENEGADO" ? "danger" : "warning"}`}>{record.resultado}</span></td><td className="reason-cell"><div className="reason-content">{layer && <span className="layer-badge">{layer}</span>}<details className="reason-detail"><summary title={record.motivo}><span>{record.motivo}</span></summary><p>{record.motivo}</p></details></div></td></tr>; })}</tbody></table></div></article>}
      <nav className="pagination" aria-label="Paginación de auditoría"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>← Anterior</button><span>Página {page} de {pages}</span><button disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Siguiente →</button></nav>
      <p className="table-note">El filtro de capa refina los 20 eventos de la página actual según el prefijo del motivo. Resultado, usuario, acción y paginación se envían a la API.</p>
      <ErrorDialog error={error} onClose={() => setError(null)} />
    </>
  );
}
