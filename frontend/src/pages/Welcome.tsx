import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Welcome() {
  const navigate = useNavigate();

  useEffect(() => {
    const panels = Array.from(
      document.querySelectorAll<HTMLElement>(".liquid-glass-strong")
    );

    const handleMouseMove = (e: MouseEvent) => {
      const xAxis = (window.innerWidth / 2 - e.pageX) / 150;
      const yAxis = (window.innerHeight / 2 - e.pageY) / 150;
      panels.forEach((panel) => {
        panel.style.transform = `perspective(1000px) rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
      });
    };
    document.addEventListener("mousemove", handleMouseMove);

    panels.forEach((p, i) => {
      p.style.opacity = "0";
      p.style.transform = "translateY(20px)";
      setTimeout(() => {
        p.style.transition = "all 1s cubic-bezier(0.16, 1, 0.3, 1)";
        p.style.opacity = "1";
        p.style.transform = "translateY(0px)";
      }, 100 * i);
    });

    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Video Background */}
      <video
        autoPlay
        className="fixed inset-0 w-full h-full object-cover z-0"
        src="https://cdn.sceneai.art/backgrounds/e102a51c-c095-492e-b909-72bb753f83a2.mov"
        loop
        muted
        playsInline
        
        onError={(e) => {
          // Fallback: hide video, show gradient background
          const video = e.currentTarget;
          video.style.display = "none";
          const fallback = document.getElementById("video-fallback");
          if (fallback) fallback.style.display = "block";
        }}
      >
        <source
          src="https://cdn.sceneai.art/backgrounds/e102a51c-c095-492e-b909-72bb753f83a2.mov"
          type="video/quicktime"
        />
        <source
          src="https://cdn.sceneai.art/backgrounds/e102a51c-c095-492e-b909-72bb753f83a2.mov"
          type="video/mp4"
        />
      </video>

      {/* Fallback gradient background */}
      <div
        id="video-fallback"
        className="fixed inset-0 z-0 hidden"
        style={{
          background: "linear-gradient(135deg, #e8f5e9 0%, #f8faf8 50%, #ffffff 100%)",
        }}
      />

      {/* Green-tinted overlay for text readability */}
      <div
        className="fixed inset-0 z-[1]"
        style={{
          background: "linear-gradient(135deg, rgba(46, 125, 50, 0.08), rgba(255, 255, 255, 0.7))",
        }}
      />

      <main className="relative z-10 w-full h-full flex items-center justify-center p-6">
        <section className="w-full max-w-2xl liquid-glass-strong rounded-2xl p-12 md:p-16 flex flex-col items-center text-center transition-all duration-700 ease-out">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 border-2 border-primary flex items-center justify-center rounded-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
              </svg>
            </div>
            <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface">
              Dietrace
            </span>
          </div>

          {/* Title */}
          <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-4 leading-tight">
            Personalized hospital{" "}
            <span className="font-emphasis-italic italic text-primary">
              dietary recommendations
            </span>
          </h1>

          {/* Tagline */}
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-10 max-w-lg">
            Rule-based Expert system menu planning with medical constraints, patient preferences and dietitian approval
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <button
              onClick={() => navigate("/patient/select")}
              className="bg-primary text-white px-8 py-4 rounded-xl font-semibold flex items-center justify-center gap-3 hover-lift shadow-lg shadow-primary/20 group transition-all"
            >
              <span className="material-symbols-outlined">person</span>
              Patient Access
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="group-hover:translate-x-1 transition-transform"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => navigate("/dietitian/login")}
              className="bg-white text-primary border-2 border-primary px-8 py-4 rounded-xl font-semibold flex items-center justify-center gap-3 hover-lift shadow-lg group transition-all hover:bg-primary/5"
            >
              <span className="material-symbols-outlined">stethoscope</span>
              Dietitian Login
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="group-hover:translate-x-1 transition-transform"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Trust indicator */}
          <div className="flex items-center gap-2 text-on-surface-variant/60 text-sm">
            <span className="material-symbols-outlined text-primary text-base">verified</span>
            <span>Trusted by qualified healthcare professionals</span>
          </div>
        </section>
      </main>
    </div>
  );
}