const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
  throw new Error("VITE_API_URL environment variable is required.");
}

/**
 * Check for 401 Unauthorized and redirect to login if needed.
 * Returns true if the response is NOT 401 (proceed normally).
 * Returns false if 401 was detected (redirected, caller should stop).
 */
export function checkAuth(res: Response, navigate: (path: string) => void): boolean {
  if (res.status === 401) {
    localStorage.removeItem("dietrace_token");
    navigate("/dietitian/login");
    return false;
  }
  return true;
}

export { API_URL };
