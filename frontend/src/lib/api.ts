// Thin fetch wrapper for the FairShare backend. Centralizes the base URL,
// JSON handling, auth header injection, and error shape so pages/components
// never touch `fetch` directly.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let authToken: string | null = null;

// Called by AuthContext whenever the token changes (login, signup, logout,
// restore-from-storage) so every subsequent request picks it up without
// each call site having to pass it explicitly.
export function setAuthToken(token: string | null) {
  authToken = token;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?", 0);
  }

  // 204 No Content (e.g. DELETE /api/chores/:id) has no body to parse.
  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // The backend's error shape is `{ success: false, message }` (see
    // backend/src/utils/apiError.ts); `error` is read as a fallback in
    // case a response ever uses the older shape.
    throw new ApiError(data.message || data.error || "Something went wrong", res.status);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
