// ApprovedMenu.tsx - Updated version
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "../../lib/api";

type MealTime = "breakfast" | "lunch" | "dinner";

// FIX: Tambah status tambahan yang API boleh return
type MenuStatus = "approved" | "pending_review" | "rejected" | "modified" | "needs_dietitian_action" | "discharged" | "not_started" | "no_plan" | "error";

interface MealItem {
  mealTime: MealTime;
  menuName: string;
  tags: string[];
  note: string;
  calories?: number;
  sugar?: string;
  sodium?: string;
  fat?: string;
  imageUrl?: string;
  friendlyNote?: string;
}

interface ApprovedMenuData {
  patientName: string;
  patientCode: string;
  ward: string;
  dietitianName: string;
  status: MenuStatus;
  meals: MealItem[];
  message?: string;
}

const mealStyles: Record<MealTime, { icon: string; textColor: string; borderColor: string; bgGradient: string; accentColor: string; iconBg: string }> = {
  breakfast: { 
    icon: "wb_sunny", 
    textColor: "text-amber-600", 
    borderColor: "border-amber-400", 
    bgGradient: "from-amber-50/80 to-orange-50/80",
    accentColor: "#F59E0B",
    iconBg: "bg-amber-100",
  },
  lunch: { 
    icon: "sunny", 
    textColor: "text-green-600", 
    borderColor: "border-green-400", 
    bgGradient: "from-green-50/80 to-emerald-50/80",
    accentColor: "#22C55E",
    iconBg: "bg-green-100",
  },
  dinner: { 
    icon: "bedtime", 
    textColor: "text-indigo-600", 
    borderColor: "border-indigo-400", 
    bgGradient: "from-indigo-50/80 to-purple-50/80",
    accentColor: "#6366F1",
    iconBg: "bg-indigo-100",
  },
};

const friendlyNotes: Record<string, string[]> = {
  breakfast: [
    "A gentle start to your day with balanced nutrition.",
    "Chosen to provide steady morning energy without sugar spikes.",
    "Light yet nourishing — perfect for your recovery.",
  ],
  lunch: [
    "A wholesome midday meal to support your healing journey.",
    "Carefully selected to meet your dietary needs with great taste.",
    "Packed with nutrients to keep you strong through the afternoon.",
  ],
  dinner: [
    "A comforting evening meal designed for restful recovery.",
    "Easy to digest while delivering essential nutrients.",
    "The perfect way to end your day on a healthy note.",
  ],
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

function getFriendlyNote(mealTime: string, index: number): string {
  const notes = friendlyNotes[mealTime.toLowerCase()] || friendlyNotes.breakfast;
  return notes[index % notes.length];
}

export default function ApprovedMenu() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("id");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ApprovedMenuData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadApprovedMenu() {
      if (!patientId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_URL}/weekly-plans/patient-view/${encodeURIComponent(patientId)}/today`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Patient not found.");
          throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        }
        const apiData = await res.json();

        // Handle special messages
        if (apiData.message) {
          setData({
            patientName: apiData.patient_name,
            patientCode: apiData.patient_code,
            ward: apiData.ward,
            dietitianName: "On-duty Dietitian",
            status: apiData.status as MenuStatus,
            meals: [],
            message: apiData.message,
          });
          setIsLoading(false);
          return;
        }

        setData({
          patientName: apiData.patient_name,
          patientCode: apiData.patient_code,
          ward: apiData.ward,
          dietitianName: apiData.dietitian_name || "On-duty Dietitian",
          status: apiData.status as MenuStatus,
          meals: (apiData.items ?? []).map((item: any, idx: number) => ({
            mealTime: item.meal_time,
            menuName: item.menu_name,
            tags: item.tags ?? [],
            note: item.reason || getFriendlyNote(item.meal_time, idx),
            calories: item.calories,
            sugar: item.sugar,
            sodium: item.sodium,
            fat: item.fat,
            imageUrl: item.image_url,
            friendlyNote: item.friendly_note || getFriendlyNote(item.meal_time, idx),
          })),
        });
      } catch (err: any) {
        setError(err.message || "Failed to load menu.");
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
    <div ref={wrapperRef} className="approved-menu-page text-on-surface font-body-md min-h-screen relative overflow-x-hidden selection:bg-primary selection:text-white">
      {/* background */}
      <video
        autoPlay
        className="fixed inset-0 w-full h-full object-cover z-0"
        src="https://cdn.sceneai.art/backgrounds/e102a51c-c095-492e-b909-72bb753f83a2.mov"
        loop
        muted
        playsInline
      />
      
      {/* Floating Orbs for depth */}
      <div className="fixed top-20 left-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-float z-0" />
      <div className="fixed bottom-20 right-10 w-96 h-96 rounded-full bg-tertiary/5 blur-3xl animate-float z-0" style={{ animationDelay: "-3s" }} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/3 blur-3xl animate-pulse-soft z-0" />

      <header className="w-full h-20 sticky top-0 z-50 backdrop-blur-xl bg-white/60 border-b border-white/20 flex justify-between items-center px-5 md:px-16">
        <div className="flex-1 flex justify-start">
          <button onClick={() => navigate("/patient/select")} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group">
            <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
            <span className="text-label-md font-medium">Back</span>
          </button>
        </div>
        <div className="flex-1 flex justify-center">
          <h1 className="font-bold text-xl tracking-[0.2em] text-on-surface uppercase leading-none">dietrace</h1>
        </div>
        <div className="flex-1 flex justify-end items-center gap-6">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <button title="Not available for patient view" className="material-symbols-outlined p-2 rounded-full opacity-40 cursor-default">notifications</button>
            <button title="Not available for patient view" className="material-symbols-outlined p-2 rounded-full opacity-40 cursor-default">settings</button>
          </div>
          {data && (
            <div className="flex items-center gap-3 px-4 py-1.5 rounded-full liquid-glass">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {getInitials(data.patientName)}
              </div>
              <span className="text-label-md font-medium">Account</span>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 max-w-[1280px] mx-auto px-5 md:px-16 py-12 flex flex-col items-center">
        {isLoading && (
          <div className="flex items-center justify-center gap-3 text-on-surface-variant py-20">
            <div className="spinner" />
            <span className="text-sm">Loading your menu...</span>
          </div>
        )}

        {!isLoading && !patientId && (
          <div className="liquid-glass p-10 rounded-3xl max-w-lg text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4 block">badge</span>
            <p className="text-on-surface-variant">No patient ID provided. Please go back and enter your ID.</p>
            <button onClick={() => navigate("/patient/select")} className="mt-6 px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
              Back to Patient Access
            </button>
          </div>
        )}

        {!isLoading && error && (
          <div className="liquid-glass p-10 rounded-3xl max-w-lg text-center">
            <span className="material-symbols-outlined text-4xl text-error mb-4 block">error</span>
            <p className="text-on-surface mb-2">{error}</p>
            <button onClick={() => navigate("/patient/select")} className="mt-6 px-6 py-3 rounded-xl border border-white/20 text-on-surface-variant hover:text-primary hover:bg-primary/5 text-sm font-medium transition-all">
              Back to Patient Access
            </button>
          </div>
        )}

        {!isLoading && patientId && data && (data.status === "discharged" || data.status === "not_started" || data.status === "no_plan" || data.status === "error" || data.message) && (
          <div className="liquid-glass p-10 rounded-3xl max-w-lg text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4 block">
              {data.status === "discharged" ? "logout" : data.status === "not_started" ? "event_busy" : "info"}
            </span>
            <p className="text-on-surface font-semibold text-lg mb-2">{data.message || "No menu available."}</p>
            <button onClick={() => navigate("/patient/select")} className="mt-6 px-6 py-3 rounded-xl border border-white/20 text-on-surface-variant hover:text-primary hover:bg-primary/5 text-sm font-medium transition-all">
              Back to Patient Access
            </button>
          </div>
        )}

        {!isLoading && patientId && data && data.status !== "approved" && data.status !== "modified" && !data.message && (
          <div className="liquid-glass p-10 rounded-3xl max-w-lg text-center">
            <span className="material-symbols-outlined text-4xl text-warning mb-4 block">hourglass_empty</span>
            <p className="text-on-surface font-semibold text-lg mb-2">Your menu is currently pending dietitian review.</p>
            <p className="text-on-surface-variant text-sm">Please check again later.</p>
            <button onClick={() => navigate("/patient/select")} className="mt-6 px-6 py-3 rounded-xl border border-white/20 text-on-surface-variant hover:text-primary hover:bg-primary/5 text-sm font-medium transition-all">
              Back to Patient Access
            </button>
          </div>
        )}

        {!isLoading && patientId && data && (data.status === "approved" || data.status === "modified") && (
          <>
            {/* Patient Summary */}
            <div className="w-full max-w-4xl liquid-glass-strong p-8 rounded-3xl mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">fingerprint</span>
                  <h3 className="text-lg font-semibold text-on-surface">Patient Summary</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">verified</span>
                  <span className="status-badge status-badge--approved">Approved</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Patient Name</label>
                  <p className="text-xl font-bold text-on-surface">{data.patientName}</p>
                  <p className="text-sm text-on-surface-variant">
                    ID: {data.patientCode} • Ward: {data.ward}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Clinical Oversight</label>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm text-primary">medical_services</span>
                    </div>
                    <p className="text-sm font-medium text-on-surface">{data.dietitianName}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Meal Cards - NO IMAGES, Icon-based design */}
            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ perspective: "1000px" }}>
              {data.meals.map((meal) => {
                const style = mealStyles[meal.mealTime];
                return (
                  <div
                    key={meal.mealTime}
                    className={`tilt-card liquid-glass rounded-3xl overflow-hidden flex flex-col border-t-4 ${style.borderColor}`}
                  >
                    {/* Icon Header (replaces ugly photo) */}
                    <div className="relative h-40 overflow-hidden flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${style.accentColor}08, ${style.accentColor}15)` }}>
                      {/* Decorative circles */}
                      <div className="absolute top-4 right-4 w-20 h-20 rounded-full border border-white/20" />
                      <div className="absolute bottom-4 left-4 w-12 h-12 rounded-full border border-white/10" />
                      
                      {/* Large Icon */}
                      <div className={`w-20 h-20 rounded-2xl ${style.iconBg} flex items-center justify-center shadow-lg`}>
                        <span className={`material-symbols-outlined ${style.textColor} text-5xl`}>{style.icon}</span>
                      </div>
                      
                      {/* Meal label */}
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <span className={`text-label-md font-bold ${style.textColor} uppercase tracking-widest bg-white/60 backdrop-blur-sm px-3 py-1 rounded-full`}>
                          {meal.mealTime}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex flex-col gap-4 flex-1">
                      <h4 className="font-headline-sm text-headline-sm text-on-surface">{meal.menuName}</h4>

                      <div className="flex flex-wrap gap-2">
                        {meal.tags.map((tag) => (
                          <span key={tag} className="bg-primary/10 px-3 py-1 rounded-lg text-[10px] font-bold uppercase text-primary border border-primary/20">
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Nutrition Info */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="liquid-glass-clear p-2 rounded-xl text-center">
                          <p className="text-[10px] text-on-surface-variant uppercase font-bold">Calories</p>
                          <p className="text-sm font-bold text-on-surface">{meal.calories || "—"}</p>
                        </div>
                        <div className="liquid-glass-clear p-2 rounded-xl text-center">
                          <p className="text-[10px] text-on-surface-variant uppercase font-bold">Sugar</p>
                          <p className="text-sm font-bold text-on-surface">{meal.sugar || "—"}</p>
                        </div>
                        <div className="liquid-glass-clear p-2 rounded-xl text-center">
                          <p className="text-[10px] text-on-surface-variant uppercase font-bold">Sodium</p>
                          <p className="text-sm font-bold text-on-surface">{meal.sodium || "—"}</p>
                        </div>
                        <div className="liquid-glass-clear p-2 rounded-xl text-center">
                          <p className="text-[10px] text-on-surface-variant uppercase font-bold">Fat</p>
                          <p className="text-sm font-bold text-on-surface">{meal.fat || "—"}</p>
                        </div>
                      </div>

                      {/* Friendly Note */}
                      <div className="p-4 liquid-glass-clear rounded-xl border border-primary/10 mt-auto">
                        <p className="text-sm text-on-surface leading-relaxed">
                          <span className="font-medium text-primary">Why this meal: </span>
                          {meal.friendlyNote || meal.note}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="w-full max-w-4xl flex flex-col md:flex-row justify-center items-center gap-6 mt-16 pb-12">
              <button onClick={() => navigate("/patient/select")} className="px-10 py-4 rounded-xl liquid-glass text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-all text-sm font-medium flex items-center gap-2">
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
