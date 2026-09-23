import type { ApiErrorBody } from "../types";
import { demoHeaders } from "./demo";

const TOKEN_KEY = "securedocs.accessToken";
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, public error: ApiErrorBody) {
    super(error.message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null { return sessionStorage.getItem(TOKEN_KEY); }
export function setToken(token: string): void { sessionStorage.setItem(TOKEN_KEY, token); }
export function clearToken(): void { sessionStorage.removeItem(TOKEN_KEY); }

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown; auth?: boolean };

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  Object.entries(demoHeaders()).forEach(([name, value]) => headers.set(name, value));
  const token = getToken();
  if (options.auth !== false && token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    throw new ApiError(0, { code: "NETWORK_ERROR", message: "No se pudo conectar con la API. Verifica que el backend esté iniciado." });
  }

  if (!response.ok) {
    let error: ApiErrorBody = { code: "HTTP_ERROR", message: "La solicitud no pudo completarse." };
    try {
      const payload = await response.json() as { error?: ApiErrorBody };
      if (payload.error) error = payload.error;
    } catch { /* respuesta sin JSON */ }
    if (response.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event("securedocs:unauthorized"));
      if (window.location.pathname !== "/login") window.location.replace("/login");
    }
    throw new ApiError(response.status, error);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
