import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    const inputs = [usernameRef.current, passwordRef.current].filter(
      (el): el is HTMLInputElement => el !== null
    );
    if (!card || inputs.length === 0) return;

    const handleMouseMove = (e: MouseEvent) => {
      const xAxis = (window.innerWidth / 2 - e.pageX) / 45;
      const yAxis = (window.innerHeight / 2 - e.pageY) / 45;
      card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
    };
    const handleMouseEnter = () => {
      card.style.transition = "none";
    };
    const handleMouseLeave = () => {
      card.style.transition = "transform 0.5s ease";
      card.style.transform = "rotateY(0deg) rotateX(0deg)";
    };
    const handleFocus = () => {
      card.style.borderColor = "rgba(46, 125, 50, 0.3)";
    };
    const handleBlur = () => {
      card.style.borderColor = "rgba(0, 0, 0, 0.08)";
    };

    card.addEventListener("mouseenter", handleMouseEnter);
    card.addEventListener("mouseleave", handleMouseLeave);
    inputs.forEach((el) => {
      el.addEventListener("focus", handleFocus);
      el.addEventListener("blur", handleBlur);
    });

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseenter", handleMouseEnter);
      card.removeEventListener("mouseleave", handleMouseLeave);
      inputs.forEach((el) => {
        el.removeEventListener("focus", handleFocus);
        el.removeEventListener("blur", handleBlur);
      });
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        setError(errData?.detail || "Invalid username or password.");
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      localStorage.setItem("dietrace_token", data.access_token);
      navigate("/dietitian/dashboard");
    } catch {
      setError("Could not reach the server. Is the backend running on port 8000?");
      setIsLoading(false);
    }
  };

  return (
    <div className="dietitian-login-page min-h-screen overflow-hidden relative flex flex-col items-center justify-center">
      {/* Background */}
        <video
        autoPlay
        className="fixed inset-0 w-full h-full object-cover z-0"
        src="https://cdn.sceneai.art/backgrounds/e102a51c-c095-492e-b909-72bb753f83a2.mov"
        loop
        muted
        playsInline
      
      />

      {/* Back button - floating top left */}
      <button
        onClick={() => navigate("/")}
        className="fixed top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-black/10 text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all text-sm font-medium shadow-sm"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Back to Home
      </button>

      <main className="relative z-10 p-6 perspective-container w-full max-w-md flex items-center justify-center min-h-screen">
        <div ref={cardRef} className="tilt-card liquid-glass rounded-3xl p-10 md:p-12 w-full">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
              <span
                className="material-symbols-outlined text-primary text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                shield_person
              </span>
            </div>
            <h1 className="text-3xl font-semibold text-on-surface mb-2">Dietitian Login</h1>
            <p className="text-on-surface-variant text-base">Secure clinical access portal</p>
          </div>

          <form className="space-y-8" onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div className="space-y-3">
                <label
                  className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block ml-1"
                  htmlFor="username"
                >
                  Username
                </label>
                <div className="relative group">
                  <input
                    ref={usernameRef}
                    className="glass-input w-full px-5 py-4 text-on-surface placeholder:text-black/30 transition-all duration-300"
                    id="username"
                    placeholder="Enter username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError("");
                    }}
                    disabled={isLoading}
                  />
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-primary">person</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label
                  className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block ml-1"
                  htmlFor="password"
                >
                  Password
                </label>
                <div className="relative group">
                  <input
                    ref={passwordRef}
                    className="glass-input w-full px-5 py-4 text-on-surface placeholder:text-black/30 transition-all duration-300"
                    id="password"
                    placeholder="••••••••"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    disabled={isLoading}
                  />
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-primary">lock</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
                <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
                {error}
              </div>
            )}

            <div className="space-y-6">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white font-bold py-5 px-8 rounded-xl flex items-center justify-center gap-3 hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-lg">{isLoading ? "Logging in..." : "Login"}</span>
                {!isLoading && (
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}