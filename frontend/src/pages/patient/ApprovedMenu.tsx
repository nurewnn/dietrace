import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_BASE_URL = "http://localhost:8000";

type MealTime = "breakfast" | "lunch" | "dinner";
type MenuStatus = "approved" | "pending_review" | "rejected" | "modified" | "needs_dietitian_action";

interface MealItem {
  mealTime: MealTime;
  menuName: string;
  tags: string[];
  note: string;
}

interface ApprovedMenuData {
  patientName: string;
  patientCode: string;
  ward: string;
  dietitianName: string;
  status: MenuStatus;
  meals: MealItem[];
}

const mockApprovedData: ApprovedMenuData = {
  patientName: "Julian S. Vance",
  patientCode: "PX-8829-01",
  ward: "Oncology (Wing B)",
  dietitianName: "Dr. Elena Thorne",
  status: "approved",
  meals: [
    {
      mealTime: "breakfast",
      menuName: "Low-Glycemic Power Bowl",
      tags: ["Low Sugar", "High Fiber"],
      note: "Approved for glucose management and sustained morning energy.",
    },
    {
      mealTime: "lunch",
      menuName: "Atlantic Salmon & Quinoa",
      tags: ["Low Sodium", "Omega 3+"],
      note: "Selected for anti-inflammatory properties and blood pressure maintenance.",
    },
    {
      mealTime: "dinner",
      menuName: "Herb-Roasted Lean Protein",
      tags: ["Light Digestion", "Dairy Free"],
      note: "Lighter meal to prevent reflux while meeting protein requirements.",
    },
  ],
};

const mealStyles: Record<MealTime, { icon: string; textColor: string; borderColor: string; glow: string }> = {
  breakfast: { icon: "wb_sunny", textColor: "text-amber-400", borderColor: "border-amber-400/50", glow: "rgba(251,191,36,0.1)" },
  lunch: { icon: "sunny", textColor: "text-blue-400", borderColor: "border-blue-400/50", glow: "rgba(96,165,250,0.1)" },
  dinner: { icon: "bedtime", textColor: "text-purple-400", borderColor: "border-purple-400/50", glow: "rgba(192,132,252,0.1)" },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ApprovedMenu() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("id");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ApprovedMenuData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    async function loadApprovedMenu() {
      if (!patientId) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/patient-view/${encodeURIComponent(patientId)}`);
        if (!res.ok) throw new Error(`Endpoint returned ${res.status}`);
        const apiData = await res.json();
        // TODO: confirm real field names once /patient-view/{patient_code} exists.
        // Assumed shape: { patient_name, patient_code, ward, dietitian_name, status,
        // items: [{ meal_time, menu_name, tags, reason }] }
        setData({
          patientName: apiData.patient_name,
          patientCode: apiData.patient_code,
          ward: apiData.ward,
          dietitianName: apiData.dietitian_name,
          status: apiData.status,
          meals: (apiData.items ?? []).map((item: any) => ({
            mealTime: item.meal_time,
            menuName: item.menu_name,
            tags: item.tags ?? [],
            note: item.reason ?? "",
          })),
        });
        setUsingMockData(false);
      } catch (err) {
        console.warn("/patient-view not available yet, showing demo data:", err);
        setData(mockApprovedData);
        setUsingMockData(true);
      } finally {
        setIsLoading(false);
      }
    }
    loadApprovedMenu();
  }, [patientId]);

  useEffect(() => {
    const cards = wrapperRef.current?.querySelectorAll<HTMLElement>(".tilt-card");
    if (!cards) return;
    const handlers: Array<{ el: HTMLElement; move: (e: MouseEvent) => void; leave: () => void }> = [];

    cards.forEach((card) => {
      const move = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
      };
      const leave = () => {
        card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)";
      };
      card.addEventListener("mousemove", move);
      card.addEventListener("mouseleave", leave);
      handlers.push({ el: card, move, leave });
    });

    return () => {
      handlers.forEach(({ el, move, leave }) => {
        el.removeEventListener("mousemove", move);
        el.removeEventListener("mouseleave", leave);
      });
    };
  }, [data]);

  return (
    <div
      ref={wrapperRef}
      className="approved-menu-page text-on-surface font-body-md min-h-screen relative overflow-x-hidden selection:bg-primary selection:text-on-primary"
    >
      <video autoPlay className="fixed top-0 left-0 w-full h-full object-cover -z-10 brightness-[0.4] grayscale-[0.5]" loop muted playsInline>
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4"
          type="video/mp4"
        />
      </video>

      <header className="w-full h-20 sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/10 flex justify-between items-center px-5 md:px-16">
        <div className="flex-1 flex justify-start">
          <button
            type="button"
            onClick={() => navigate("/patient/select")}
            className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group"
          >
            <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
            <span className="text-label-md font-medium">Back</span>
          </button>
        </div>
        <div className="flex-1 flex justify-center">
          <h1 className="font-bold text-xl tracking-[0.2em] text-white uppercase leading-none">dietrace</h1>
        </div>
        <div className="flex-1 flex justify-end items-center gap-6">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <button type="button" title="Not available for patient view" className="material-symbols-outlined p-2 rounded-full opacity-40 cursor-default">
              notifications
            </button>
            <button type="button" title="Not available for patient view" className="material-symbols-outlined p-2 rounded-full opacity-40 cursor-default">
              settings
            </button>
          </div>
          {data && (
            <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-primary">
                {getInitials(data.patientName)}
              </div>
              <span className="text-label-md font-medium">Account</span>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 max-w-[1280px] mx-auto px-5 md:px-16 py-12 flex flex-col items-center">
        {isLoading && <div className="text-on-surface-variant text-sm py-20">Loading your menu...</div>}

        {!isLoading && !patientId && (
          <div className="liquid-glass p-10 rounded-3xl max-w-lg text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4 block">badge</span>
            <p className="text-on-surface-variant">No patient ID provided. Please go back and enter your ID.</p>
            <button
              onClick={() => navigate("/patient/select")}
              className="mt-6 px-6 py-3 rounded-xl bg-white text-background text-sm font-bold hover:scale-105 transition-transform"
            >
              Back to Patient Access
            </button>
          </div>
        )}

        {!isLoading && patientId && data && data.status !== "approved" && (
          <div className="liquid-glass p-10 rounded-3xl max-w-lg text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4 block">hourglass_empty</span>
            <p className="text-primary font-semibold text-lg mb-2">Your menu is currently pending dietitian review.</p>
            <p className="text-on-surface-variant text-sm">Please check again later.</p>
            <button
              onClick={() => navigate("/patient/select")}
              className="mt-6 px-6 py-3 rounded-xl border border-white/10 text-on-surface-variant hover:text-primary hover:bg-white/5 text-sm font-medium transition-all"
            >
              Back to Patient Access
            </button>
          </div>
        )}

        {!isLoading && patientId && data && data.status === "approved" && (
          <>
            {usingMockData && (
              <div className="w-full max-w-4xl liquid-glass px-6 py-3 rounded-xl flex items-center gap-3 mb-6 border-l-4 border-l-amber-400/60">
                <span className="material-symbols-outlined text-amber-400 text-lg">info</span>
                <span className="text-xs text-on-surface-variant">
                  Showing demo data — <code className="text-white">/patient-view/{"{id}"}</code> endpoint not reachable yet.
                </span>
              </div>
            )}

            <div className="w-full max-w-4xl liquid-glass p-8 rounded-3xl mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">fingerprint</span>
                  <h3 className="text-lg font-semibold text-primary">Patient Summary</h3>
                </div>
                <span className="status-badge-approved px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  Approved
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Patient Name</label>
                  <p className="text-xl font-bold text-primary">{data.patientName}</p>
                  <p className="text-sm text-on-surface-variant">
                    ID: {data.patientCode} • Ward: {data.ward}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Clinical Oversight</label>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">medical_services</span>
                    </div>
                    <p className="text-sm font-medium text-primary">{data.dietitianName}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ perspective: "1000px" }}>
              {data.meals.map((meal) => {
                const style = mealStyles[meal.mealTime];
                return (
                  <div
                    key={meal.mealTime}
                    className={`tilt-card liquid-glass rounded-3xl p-8 flex flex-col gap-4 border-l-4 ${style.borderColor}`}
                    style={{ boxShadow: `0 0 30px ${style.glow}` }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`material-symbols-outlined ${style.textColor}`}>{style.icon}</span>
                      <span className={`text-label-md font-bold ${style.textColor} uppercase tracking-widest`}>{meal.mealTime}</span>
                    </div>
                    <h4 className="font-headline-sm text-headline-sm text-primary">{meal.menuName}</h4>
                    <div className="flex flex-wrap gap-2">
                      {meal.tags.map((tag) => (
                        <span key={tag} className="bg-white/5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase text-on-surface-variant border border-white/10">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 mt-2">
                      <p className="text-sm text-on-surface-variant leading-relaxed">
                        <span className="italic text-primary">Dietitian's Note:</span> {meal.note}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="w-full max-w-4xl flex flex-col md:flex-row justify-center items-center gap-6 mt-16 pb-12">
              <button
                type="button"
                onClick={() => navigate("/patient/select")}
                className="px-10 py-4 rounded-xl border border-white/10 text-on-surface-variant hover:text-primary hover:bg-white/5 transition-all text-sm font-medium flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back to Patient Access
              </button>
            </div>
          </>
        )}

        <div className="w-full max-w-2xl text-center pt-8 border-t border-white/10 mt-4">
          <p className="font-caption-bold text-caption-bold text-on-surface-variant/60 uppercase leading-relaxed tracking-[0.2em]">
            Menu recommendations are reviewed by qualified healthcare staff. Please contact your dietitian for changes or concerns.
          </p>
        </div>
      </main>
    </div>
  );
}