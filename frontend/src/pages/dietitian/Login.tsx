import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:8000";

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
      card.style.borderColor = "rgba(0, 242, 255, 0.3)";
    };
    const handleBlur = () => {
      card.style.borderColor = "rgba(255, 255, 255, 0.08)";
    };

    document.body.addEventListener("mousemove", handleMouseMove);
    document.body.addEventListener("mouseenter", handleMouseEnter);
    document.body.addEventListener("mouseleave", handleMouseLeave);
    inputs.forEach((el) => {
      el.addEventListener("focus", handleFocus);
      el.addEventListener("blur", handleBlur);
    });

    return () => {
      document.body.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseenter", handleMouseEnter);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
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
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
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
      // Stash the JWT — dashboard/patients pages will read this to authenticate requests
      localStorage.setItem("dietrace_token", data.access_token);

      navigate("/dietitian/dashboard");
    } catch (err) {
      setError("Could not reach the server. Is the backend running on port 8000?");
      setIsLoading(false);
    }
  };

  return (
    <div className="dietitian-login-page min-h-screen overflow-hidden relative flex flex-col items-center justify-center">
      <video autoPlay className="video-bg" loop muted playsInline>
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4"
          type="video/mp4"
        />
      </video>

      <header className="fixed top-0 left-0 w-full z-50 flex justify-center items-center h-20 px-8">
        <div className="w-full max-w-4xl h-14 bg-white/5 border-b border-x border-white/10 rounded-b-xl flex items-center justify-center backdrop-blur-sm">
          <span className="font-bold text-xl tracking-[0.2em] text-white uppercase">DieTrace</span>
        </div>
      </header>

      <main className="relative z-10 p-6 perspective-container w-full max-w-md flex items-center justify-center min-h-screen">
        <div ref={cardRef} className="tilt-card liquid-glass rounded-3xl p-10 md:p-12 w-full">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <span
                className="material-symbols-outlined text-accent-teal text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                shield_person
              </span>
            </div>
            <h1 className="text-3xl font-semibold text-white mb-2">Dietitian Login</h1>
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
                    className="glass-input w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-white/20 transition-all duration-300"
                    id="username"
                    placeholder="Enter username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                  />
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-accent-teal">person</span>
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
                    className="glass-input w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-white/20 transition-all duration-300"
                    id="password"
                    placeholder="••••••••"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-accent-teal">lock</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            <div className="space-y-6">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-white text-black font-bold py-5 px-8 rounded-xl flex items-center justify-center gap-3 hover:bg-accent-teal hover:text-black hover:scale-[1.02] active:scale-95 transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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