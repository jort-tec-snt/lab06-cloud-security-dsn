import { useEffect, useRef } from "react";
import { ApiError } from "../lib/api";

function category(error: ApiError): { title: string; label: string; detail: string } {
  if (error.error.code === "RBAC_DENIED") return {
    title: "Operación denegada por rol",
    label: "RBAC · permiso funcional",
    detail: error.error.permisoFaltante ? `Permiso requerido: ${error.error.permisoFaltante}` : error.error.message
  };
  if (error.error.code === "ABAC_DENIED") return {
    title: "Operación denegada por política",
    label: "ABAC · atributos y contexto",
    detail: error.error.politica ? `Política: ${error.error.politica}` : error.error.message
  };
  if (error.status === 401 || ["UNAUTHORIZED", "INVALID_CREDENTIALS"].includes(error.error.code)) return {
    title: "Autenticación requerida",
    label: "AUTH · sesión o credenciales",
    detail: error.error.message
  };
  return { title: "No se pudo completar la operación", label: error.error.code, detail: error.error.message };
}

export function ErrorDialog({ error, onClose }: { error: ApiError | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (error && !dialog.current?.open) dialog.current?.showModal();
    if (!error && dialog.current?.open) dialog.current.close();
  }, [error]);
  if (!error) return null;
  const info = category(error);
  return (
    <dialog ref={dialog} className="error-dialog" onCancel={onClose} aria-labelledby="error-title">
      <div className="dialog-accent" />
      <div className="dialog-body">
        <span className="error-kicker">{error.status ? `HTTP ${error.status}` : "Error de conexión"}</span>
        <h2 id="error-title">{info.title}</h2>
        <span className="decision-badge">{info.label}</span>
        <p>{info.detail}</p>
        {error.error.motivo && <p><strong>Motivo:</strong> {error.error.motivo}</p>}
        {error.error.valorEsperado !== undefined && <dl className="comparison"><div><dt>Esperado</dt><dd>{JSON.stringify(error.error.valorEsperado)}</dd></div><div><dt>Detectado</dt><dd>{JSON.stringify(error.error.valorDetectado)}</dd></div></dl>}
        {error.error.fields?.length ? <p>Revisa: {error.error.fields.join(", ")}.</p> : null}
        <button className="button primary" onClick={onClose}>Entendido</button>
      </div>
    </dialog>
  );
}
