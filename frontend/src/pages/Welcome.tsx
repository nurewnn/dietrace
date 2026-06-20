import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Welcome() {
  const navigate = useNavigate();

  useEffect(() => {
    const panels = Array.from(
      document.querySelectorAll<HTMLElement>(".liquid-glass-strong, .liquid-glass-clear")
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
      <video autoPlay className="fixed inset-0 w-full h-full object-cover z-0" loop muted playsInline>
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4"
          type="video/mp4"
        />
      </video>
      <div className="fixed inset-0 bg-black/20 z-[1]"></div>

      <main className="relative z-10 w-full h-full flex flex-col md:flex-row p-4 md:p-6 gap-6">
        {/* Left Panel */}
        <section className="w-full md:w-[60%] h-full liquid-glass-strong rounded-xl p-8 md:p-12 flex flex-col justify-between transition-all duration-700 ease-out">
          <nav className="flex justify-between items-center w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border-2 border-white flex items-center justify-center rounded-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
                  <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"></path>
                </svg>
              </div>
              <span className="font-headline-sm text-headline-sm tracking-tight text-white">Dietrace</span>
            </div>
          </nav>

          <div className="flex-grow flex flex-col justify-center max-w-2xl">
            <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-white mb-6 leading-tight">
              Personalized hospital{" "}
              <span className="font-emphasis-italic italic opacity-90">dietary recommendations</span>
            </h1>
            <p className="font-body-lg text-body-lg text-white/70 mb-10 max-w-lg">
              Rule-based Expert system menu planning with medical constraints, patient preferences and dietitian approval
            </p>
            <div className="flex flex-wrap gap-6 items-center">
              <button onClick={() => navigate("/patient/select")} className="bg-white text-background px-8 py-4 rounded-lg font-semibold flex items-center gap-3 hover-lift shadow-xl group transition-all">
                Patients
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 group-hover:translate-x-1 transition-transform">
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </button>
              <button onClick={() => navigate("/dietitian/login")} className="bg-white text-background px-8 py-4 rounded-lg font-semibold flex items-center gap-3 hover-lift shadow-xl group transition-all">
                Dietitian
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 group-hover:translate-x-1 transition-transform">
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </button>
              <div className="flex flex-wrap gap-2">
                <span className="px-4 py-2 rounded-full liquid-glass text-label-md text-white/80 text-sm hover:text-white transition-colors cursor-default">Expert System</span>
                <span className="px-4 py-2 rounded-full liquid-glass text-label-md text-white/80 text-sm hover:text-white transition-colors cursor-default">Dietitian Approval</span>
                <span className="px-4 py-2 rounded-full liquid-glass text-label-md text-white/80 text-sm hover:text-white transition-colors cursor-default">Safe Menu Planning</span>
              </div>
            </div>
          </div>

          <footer className="pt-8 border-t border-white/10 flex flex-col gap-4">
            <span className="text-xs font-bold tracking-[0.2em] text-white/40 uppercase">EXPLAINABLE CARE</span>
            <div className="flex flex-col gap-2">
              <blockquote className="font-headline-sm text-headline-sm text-white/90">
                "Every recommendation should show the rules behind it."
              </blockquote>
              <cite className="not-italic text-sm text-white/40 font-semibold uppercase">HOSPITAL DIETARY SUPPORT</cite>
            </div>
          </footer>
        </section>

        {/* Right Panel */}
        <section className="hidden md:flex flex-col w-[40%] h-full gap-6">
          <div className="flex justify-between items-center w-full">
            <button className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg flex items-center gap-2 hover-lift text-xs text-white font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <circle cx="12" cy="8" r="5"></circle>
                <path d="M20 21a8 8 0 0 0-16 0"></path>
              </svg>
              Account
            </button>
          </div>

          <div className="p-6 rounded-xl flex flex-col gap-4 hover-lift transition-all group">
            <div className="flex justify-between items-center">
              <h2 className="font-headline-sm text-white text-lg">System Health</h2>
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Live</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Processing Capacity</span>
                <span className="text-white font-bold">75%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-white w-3/4"></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 rounded-xl flex flex-col gap-2 hover-lift transition-all">
              <div className="w-8 h-8 rounded-full bg-error-container/20 flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-error">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" x2="12" y1="8" y2="12"></line>
                  <line x1="12" x2="12.01" y1="16" y2="16"></line>
                </svg>
              </div>
              <span className="text-2xl font-bold text-white">12</span>
              <span className="text-xs text-white/50 uppercase tracking-wider">Pending Review</span>
            </div>
            <div className="p-6 rounded-xl flex flex-col gap-2 hover-lift transition-all">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="m9 12 2 2 4-4"></path>
                </svg>
              </div>
              <span className="text-2xl font-bold text-white">148</span>
              <span className="text-xs text-white/50 uppercase tracking-wider">Approved</span>
            </div>
          </div>

          <div className="p-6 rounded-xl flex flex-col gap-4 hover-lift transition-all">
            <h3 className="font-headline-sm text-white text-lg">Recent Checks</h3>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-white/80">Sodium Restriction</span>
                <span className="text-[10px] px-2 py-1 bg-white/20 rounded text-white font-bold">PASSED</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-white/80">Allergy Cross-Check</span>
                <span className="text-[10px] px-2 py-1 bg-white/20 rounded text-white font-bold">PASSED</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-white/80">Caloric Target</span>
                <span className="text-[10px] px-2 py-1 bg-white/20 rounded text-white font-bold">PASSED</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] tracking-widest text-center text-white/30 uppercase font-medium">
            Final menu approval remains under dietitian responsibility. © 2024 LuminaMed.
          </p>
        </section>
      </main>
    </div>
  );
}