import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../lib/api";

export default function SelectPatient() {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [patientId, setPatientId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    const input = inputRef.current;
    if (!card || !input) return;

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
    input.addEventListener("focus", handleFocus);
    input.addEventListener("blur", handleBlur);

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseenter", handleMouseEnter);
      card.removeEventListener("mouseleave", handleMouseLeave);
      input.removeEventListener("focus", handleFocus);
      input.removeEventListener("blur", handleBlur);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!patientId.trim()) {
      setError("Please enter your Patient ID.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/patient-view/${encodeURIComponent(patientId.trim())}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Patient not found. Please check your ID.");
        } else {
          setError("Unable to verify patient. Please try again.");
        }
        setIsLoading(false);
        return;
      }
      navigate(`/patient/menu?id=${encodeURIComponent(patientId.trim())}`);
    } catch {
      setError("Cannot connect to server. Please ensure the system is online.");
      setIsLoading(false);
    }
  };

  return (
    <div className="patient-access-page min-h-screen overflow-hidden relative flex flex-col items-center justify-center">
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
            <h1 className="text-3xl font-semibold text-on-surface mb-2">Patient Access</h1>
            <p className="text-on-surface-variant text-base">Clinical dietary verification portal</p>
          </div>

          <form className="space-y-8" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <label
                className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block ml-1"
                htmlFor="patient_id"
              >
                Patient ID
              </label>
              <div className="relative group">
                <input
                  ref={inputRef}
                  className="glass-input w-full px-5 py-4 text-on-surface placeholder:text-black/30 transition-all duration-300"
                  id="patient_id"
                  placeholder="e.g. PN-7842"
                  type="text"
                  value={patientId}
                  onChange={(e) => {
                    setPatientId(e.target.value);
                    setError("");
                  }}
                  disabled={isLoading}
                />
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-primary">fingerprint</span>
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
                <span className="text-lg">{isLoading ? "Verifying..." : "View Approved Menu"}</span>
                {!isLoading && (
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                )}
              </button>

              <div className="flex gap-3 p-4 rounded-xl bg-black/5 border border-black/5">
                <span className="material-symbols-outlined text-primary/60 text-xl shrink-0">info</span>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  Patients can only view menus already approved by an on-duty dietitian.
                </p>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}