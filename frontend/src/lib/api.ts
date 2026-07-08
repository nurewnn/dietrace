// src/lib/api.ts

// src/lib/api.ts

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
  throw new Error("VITE_API_URL environment variable is required.");
}

export function checkAuth(res: Response, navigate: (path: string) => void): boolean {
  if (res.status === 401) {
    localStorage.removeItem("dietrace_token");
    navigate("/dietitian/login");
    return false;
  }
  return true;
}

// TAMBAH INI:
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem("dietrace_token");
  const url = `${API_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  return res;
}

export { API_URL };