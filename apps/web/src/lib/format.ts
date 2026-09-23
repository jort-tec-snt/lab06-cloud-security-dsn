export const readable = (value: string | null | undefined): string => value ? value.replaceAll("_", " ") : "No asignado";
export const shortId = (value: string): string => value.length > 12 ? `${value.slice(0, 8)}…` : value;
export const formatDate = (value: string): string => new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
