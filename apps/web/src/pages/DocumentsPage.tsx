import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ErrorDialog } from "../components/ErrorDialog";
import { EmptyState, InlineAlert, LoadingState } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiRequest } from "../lib/api";
import { formatDate, readable, shortId } from "../lib/format";
import type { Department, DocumentRecord, SecurityLevel } from "../types";

type DocumentInput = { titulo: string; descripcion: string; departamentoId: string; nivelConfidencialidad: SecurityLevel; pais: string };
const blank: DocumentInput = { titulo: "", descripcion: "", departamentoId: "", nivelConfidencialidad: "NIVEL_1", pais: "PERU" };

export function DocumentsPage() {
  const { user, permissions } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const [editing, setEditing] = useState<DocumentRecord | "new" | null>(null);
  const [form, setForm] = useState<DocumentInput>(blank);
  const [search, setSearch] = useState("");
  const [probeId, setProbeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docs, catalogs] = await Promise.all([
        apiRequest<{ documentos: DocumentRecord[] }>("/documentos"),
        apiRequest<{ departamentos: Department[] }>("/catalogos/departamentos")
      ]);
      setDocuments(docs.documentos); setDepartments(catalogs.departamentos);
    } catch (cause) { if (cause instanceof ApiError) setError(cause); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => documents.filter(document => `${document.titulo} ${document.descripcion} ${document.estado}`.toLowerCase().includes(search.toLowerCase())), [documents, search]);
  const departmentName = (id: string) => departments.find(item => item.id === id)?.nombre ?? shortId(id);
  const showError = (cause: unknown) => setError(cause instanceof ApiError ? cause : new ApiError(0, { code: "UNEXPECTED", message: "Ocurrió un error inesperado." }));

  const view = async (id: string) => {
    setNotice("");
    try { const result = await apiRequest<{ documento: DocumentRecord }>(`/documentos/${id}`); setSelected(result.documento); }
    catch (cause) { showError(cause); }
  };
  const startCreate = () => {
    setForm({ ...blank, departamentoId: departments.find(item => item.nombre === user?.departamento)?.id ?? departments[0]?.id ?? "", pais: user?.pais ?? "PERU" });
    setEditing("new"); setSelected(null); setNotice("");
  };
  const startEdit = (document: DocumentRecord) => {
    setForm({ titulo: document.titulo, descripcion: document.descripcion, departamentoId: document.departamentoId, nivelConfidencialidad: document.nivelConfidencialidad, pais: document.pais });
    setEditing(document); setSelected(null); setNotice("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setNotice("");
    try {
      const path = editing === "new" ? "/documentos" : `/documentos/${editing?.id}`;
      const result = await apiRequest<{ documento: DocumentRecord }>(path, { method: editing === "new" ? "POST" : "PUT", body: form });
      setEditing(null); setSelected(result.documento); setNotice(editing === "new" ? "Documento creado. La API lo registró como PENDIENTE." : "Cambios guardados por la API."); await load();
    } catch (cause) { showError(cause); }
    finally { setSaving(false); }
  };
  const approve = async (document: DocumentRecord) => {
    setNotice("");
    try { await apiRequest(`/documentos/${document.id}/aprobar`, { method: "POST", body: {} }); setNotice("Documento aprobado y publicado."); await load(); }
    catch (cause) { showError(cause); }
  };
  const remove = async (document: DocumentRecord) => {
    if (!window.confirm(`¿Eliminar “${document.titulo}”? Esta acción modifica los datos del laboratorio.`)) return;
    setNotice("");
    try { await apiRequest(`/documentos/${document.id}`, { method: "DELETE" }); setSelected(null); setNotice("Documento eliminado por la API."); await load(); }
    catch (cause) { showError(cause); }
  };

  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Repositorio</span><h1>Documentos visibles</h1><p>La lista contiene exclusivamente los documentos que la API autorizó para esta sesión.</p></div><button className="button primary" onClick={startCreate}>+ Crear documento</button></header>
      {notice && <InlineAlert tone="success">{notice}</InlineAlert>}
      <section className="toolbar"><label className="search-field"><span className="sr-only">Buscar documentos</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por título, contenido o estado" /></label><span className="result-count">{filtered.length} resultados visibles</span></section>
      {loading ? <LoadingState message="Solicitando documentos autorizados…" /> : filtered.length === 0 ? <EmptyState title="Sin documentos visibles" detail="La API no devolvió documentos para el filtro o contexto actual." /> : (
        <article className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Documento</th><th>Departamento</th><th>Nivel</th><th>Estado</th><th>País</th><th>Acciones</th></tr></thead><tbody>{filtered.map(document => <tr key={document.id}><td><strong>{document.titulo}</strong><small>{shortId(document.id)} · {formatDate(document.fechaCreacion)}</small></td><td>{departmentName(document.departamentoId)}</td><td><span className="badge neutral">{readable(document.nivelConfidencialidad)}</span></td><td><span className={`badge ${document.estado === "PUBLICADO" ? "success" : "warning"}`}>{document.estado}</span></td><td>{document.pais}</td><td><div className="action-row"><button onClick={() => void view(document.id)}>Ver</button><button onClick={() => startEdit(document)}>Editar</button><button onClick={() => void approve(document)}>Aprobar</button><button className="danger-text" onClick={() => void remove(document)}>Eliminar</button></div></td></tr>)}</tbody></table></div></article>
      )}
      <section className="evidence-panel"><div><span className="eyebrow">Flujo de evidencia</span><h2>Consultar un recurso por ID</h2><p>Permite ejecutar un caso autorizado o denegado contra la API y capturar su respuesta real.</p></div><form onSubmit={event => { event.preventDefault(); if (probeId) void view(probeId); }}><label htmlFor="document-id">UUID del documento</label><div><input id="document-id" required value={probeId} onChange={event => setProbeId(event.target.value)} placeholder="00000000-0000-4000-8000-…" /><button className="button secondary">Consultar</button></div></form></section>
      {selected && <section className="panel detail-panel"><div className="panel-heading"><div><span className="eyebrow">Detalle autorizado</span><h2>{selected.titulo}</h2></div><button className="icon-button" aria-label="Cerrar detalle" onClick={() => setSelected(null)}>×</button></div><p className="document-copy">{selected.descripcion}</p><dl className="detail-list compact"><div><dt>ID</dt><dd>{selected.id}</dd></div><div><dt>Propietario</dt><dd>{selected.propietarioId}</dd></div><div><dt>Departamento</dt><dd>{departmentName(selected.departamentoId)}</dd></div><div><dt>Confidencialidad</dt><dd>{readable(selected.nivelConfidencialidad)}</dd></div><div><dt>Estado</dt><dd>{selected.estado}</dd></div><div><dt>País</dt><dd>{selected.pais}</dd></div></dl></section>}
      {editing && <section className="panel form-panel"><div className="panel-heading"><div><span className="eyebrow">{editing === "new" ? "Nuevo expediente" : "Edición"}</span><h2>{editing === "new" ? "Crear documento" : `Editar ${editing.titulo}`}</h2></div><button className="icon-button" aria-label="Cerrar formulario" onClick={() => setEditing(null)}>×</button></div><p className="form-hint">El propietario y el estado los asigna el backend. Guardar ejecuta la validación RBAC y ABAC real.</p><form className="form-grid" onSubmit={event => void save(event)}><label className="full">Título<input required maxLength={200} value={form.titulo} onChange={event => setForm({ ...form, titulo: event.target.value })} /></label><label className="full">Descripción<textarea required maxLength={5000} rows={5} value={form.descripcion} onChange={event => setForm({ ...form, descripcion: event.target.value })} /></label><label>Departamento<select required value={form.departamentoId} onChange={event => setForm({ ...form, departamentoId: event.target.value })}><option value="">Selecciona…</option>{departments.map(department => <option key={department.id} value={department.id}>{department.nombre}</option>)}</select></label><label>Nivel de confidencialidad<select value={form.nivelConfidencialidad} onChange={event => setForm({ ...form, nivelConfidencialidad: event.target.value as SecurityLevel })}>{[1,2,3,4,5].map(level => <option key={level} value={`NIVEL_${level}`}>Nivel {level}</option>)}</select></label><label>País<input required pattern="[A-ZÁÉÍÓÚÜÑ]+( [A-ZÁÉÍÓÚÜÑ]+)*" value={form.pais} onChange={event => setForm({ ...form, pais: event.target.value.toUpperCase() })} /></label><div className="form-actions full"><button type="button" className="button ghost" onClick={() => setEditing(null)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? "Guardando…" : "Guardar mediante API"}</button></div></form></section>}
      <footer className="authority-note"><strong>Controles visibles para demostración</strong><span>Cada acción se envía al backend. La presencia del botón no concede el permiso.</span><span>Permisos reportados: {permissions.length}</span></footer>
      <ErrorDialog error={error} onClose={() => setError(null)} />
    </>
  );
}
