import axios from "axios";

/**
 * The single axios instance every feature imports.
 *
 * The JWT request/refresh interceptor is story 06 — deliberately absent here.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

export type Health = { status: string; database: string };

export const getHealth = () => api.get<Health>("/health/").then((r) => r.data);
