import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SelectPatient() {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [patientId, setPatientId] = useState("");

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
      card.style.borderColor = "rgba(0, 242, 255, 0.3)";
    };
    const handleBlur = () => {
      card.style.borderColor = "rgba(255, 255, 255, 0.08)";
    };

    document.body.addEventListener("mousemove", handleMouseMove);
    document.body.addEventListener("mouseenter", handleMouseEnter);
    document.body.addEventListener("mouseleave", handleMouseLeave);
    input.addEventListener("focus", handleFocus);
    input.addEventListener("blur", handleBlur);

    return () => {
      document.body.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseenter", handleMouseEnter);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
      input.removeEventListener("focus", handleFocus);
      input.removeEventListener("blur", handleBlur);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId.trim()) return;
    // TODO: once /patient-view/{patient_code} backend route is ready, verify patient exists before navigating
    navigate(`/patient/menu?id=${encodeURIComponent(patientId.trim())}`);
  };

  return (
    <div className="patient-access-page min-h-screen overflow-hidden relative flex flex-col items-center justify-center">
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
            <h1 className="text-3xl font-semibold text-white mb-2">Patient Access</h1>
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
                  className="glass-input w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-white/20 transition-all duration-300"
                  id="patient_id"
                  placeholder="e.g. PN-7842"
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                />
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-accent-teal">fingerprint</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <button
                type="submit"
                className="w-full bg-white text-black font-bold py-5 px-8 rounded-xl flex items-center justify-center gap-3 hover:bg-accent-teal hover:text-black hover:scale-[1.02] active:scale-95 transition-all duration-300 group"
              >
                <span className="text-lg">View Approved Menu</span>
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </button>

              <div className="flex gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="material-symbols-outlined text-accent-teal/60 text-xl shrink-0">info</span>
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