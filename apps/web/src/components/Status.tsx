export function LoadingState({ message = "Cargando información…" }: { message?: string }) {
  return <div className="state-panel" role="status"><span className="spinner" aria-hidden="true" />{message}</div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="state-panel empty"><strong>{title}</strong><span>{detail}</span></div>;
}

export function InlineAlert({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "success" | "danger" | "warning" }) {
  return <div className={`inline-alert ${tone}`} role={tone === "danger" ? "alert" : "status"}>{children}</div>;
}
