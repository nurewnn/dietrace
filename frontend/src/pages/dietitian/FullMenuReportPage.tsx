import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL, checkAuth } from "../../lib/api";

interface MenuItem {
  meal_time: string;
  menu_name: string;
  calories_kcal?: number;
}

interface RecommendationItem {
  id: string;
  menu_option: MenuItem | null;
}

interface Day {
  day_number: number;
  recommendation: {
    id: string;
    items: RecommendationItem[];
    status: string;
  } | null;
}

interface WeeklyPlan {
  id: string;
  admission_date: string;
  discharge_date: string;
  total_days: number;
  days: Day[];
}

interface PatientInfo {
  full_name: string;
  patient_code: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function FullMenuReportPage() {
  const navigate = useNavigate();
  const { weeklyPlanId } = useParams<{ weeklyPlanId: string }>();
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!weeklyPlanId) return;
      setIsLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("dietrace_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const planRes = await fetch(`${API_URL}/weekly-plans/${weeklyPlanId}`, { headers });
        if (!checkAuth(planRes, navigate)) return;
        if (!planRes.ok) throw new Error("Failed to load weekly plan");
        const planData = await planRes.json();
        setWeeklyPlan(planData);

        // Get patient info from first day's recommendation
        if (planData.days?.[0]?.recommendation?.id) {
          const recRes = await fetch(`${API_URL}/recommendations/${planData.days[0].recommendation.id}`, { headers });
          if (recRes.ok) {
            const recData = await recRes.json();
            setPatient(recData.patient);
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [weeklyPlanId, navigate]);

  const handleApproveAll = async () => {
    if (!weeklyPlanId) return;
    setIsApprovingAll(true);
    try {
      const token = localStorage.getItem("dietrace_token");
      const res = await fetch(`${API_URL}/weekly-plans/${weeklyPlanId}/approve-all`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) throw new Error("Failed to approve all");
      const updatedPlan = await res.json();
      setWeeklyPlan(updatedPlan);
      alert("All days approved successfully!");
    } catch (err: any) {
      alert("Error approving all: " + (err.message || "Unknown error"));
    } finally {
      setIsApprovingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="full-report-page min-h-screen flex items-center justify-center gap-3 text-on-surface-variant">
        <div className="spinner" />
        <span className="text-sm">Loading menu report...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="full-report-page min-h-screen flex flex-col items-center justify-center gap-4 text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl text-error">error</span>
        <p className="text-lg">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  if (!weeklyPlan) return null;

  const startDate = new Date(weeklyPlan.admission_date);

  return (
    <div className="full-report-page font-body-md text-body-md antialiased min-h-screen relative overflow-x-hidden">
      <div
        className="fixed inset-0 z-0"
        style={{ background: "linear-gradient(135deg, #f8faf8 100%, #ffffff 0%)" }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="w-full h-20 sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-black/5 flex justify-between items-center px-margin-desktop">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group"
          >
            <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
            <span className="text-label-md font-medium uppercase tracking-widest">Back</span>
          </button>
          <h1 className="font-bold text-xl tracking-[0.2em] text-on-surface uppercase leading-none">dietrace</h1>
          <div className="flex-1" />
        </header>

        <main className="flex-1 px-margin-desktop py-12 max-w-4xl mx-auto w-full">
          {/* Title */}
          <div className="mb-10 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-caption-bold text-caption-bold text-primary uppercase tracking-widest">Full Menu Report</span>
            </div>
            <h1 className="font-headline-md text-4xl text-on-surface mb-2">
              {patient?.full_name || "Patient"}
            </h1>
            <p className="font-body-md text-on-surface-variant">
              {weeklyPlan.total_days}-day stay • {weeklyPlan.days.length} menus
            </p>
          </div>

          {/* Days */}
          <div className="space-y-8 mb-10">
            {weeklyPlan.days.map((day, idx) => {
              const dayDate = new Date(startDate);
              dayDate.setDate(dayDate.getDate() + idx);
              const rec = day.recommendation;
              return (
                <div key={day.day_number} className="liquid-glass rounded-3xl p-8">
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-black/5">
                    <div>
                      <p className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest mb-1">Day {day.day_number}</p>
                      <h3 className="text-2xl font-bold text-on-surface">{formatDate(dayDate.toISOString())}</h3>
                    </div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${
                      rec?.status === "approved"
                        ? "bg-success/10 text-success border-success/20"
                        : rec?.status === "rejected"
                        ? "bg-error/10 text-error border-error/20"
                        : rec?.status === "modified"
                        ? "bg-info/10 text-info border-info/20"
                        : "bg-warning/10 text-warning border-warning/20"
                    }`}>
                      {rec?.status?.replace("_", " ") || "No Menu"}
                    </div>
                  </div>

                  {/* Meals Grid */}
                  {rec?.items && rec.items.length > 0 ? (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {rec.items.map((item) => (
                        <div key={item.id} className="bg-black/3 p-4 rounded-2xl border border-black/5 text-center">
                          <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">
                            {item.menu_option?.meal_time || "Meal"}
                          </p>
                          <p className="text-sm font-medium text-on-surface mb-2">
                            {item.menu_option?.menu_name || "—"}
                          </p>
                          {item.menu_option?.calories_kcal && (
                            <p className="text-xs text-on-surface-variant">{item.menu_option.calories_kcal} kcal</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-on-surface-variant mb-6">No menu assigned</p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => navigate(`/dietitian/recommendation/${rec?.id}?day=${day.day_number}&total=${weeklyPlan.total_days}`)}
                      className="px-6 py-2 bg-primary/10 border border-primary/20 rounded-xl text-primary font-bold text-xs hover:bg-primary/20 transition-all"
                    >
                      Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => navigate(-1)}
              className="px-8 py-3.5 bg-black/5 border border-black/10 rounded-xl text-on-surface-variant font-medium text-sm hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to Plan
            </button>
            <button
              onClick={handleApproveAll}
              disabled={isApprovingAll}
              className="px-12 py-3.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">{isApprovingAll ? "schedule" : "check_circle"}</span>
              {isApprovingAll ? "Approving..." : "Approve All Days"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
