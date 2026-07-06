import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL, checkAuth } from "../../lib/api";

interface MenuItemSummary {
  meal_time: string;
  menu_name: string;
  calories: number | null;
}

interface WeeklyPlanDay {
  id: string;
  day_number: number;
  cycle_day: number;
  recommendation_id: string | null;
  status: string;
  menu_items: MenuItemSummary[];
}

interface WeeklyPlan {
  id: string;
  patient_id: string;
  admission_date: string;
  discharge_date: string;
  total_days: number;
  overall_status: string;
  days: WeeklyPlanDay[];
}

interface PatientInfo {
  patient_code: string;
  full_name: string;
}

const statusConfig: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  pending_review: { label: "Pending", icon: "hourglass_empty", color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
  approved: { label: "Approved", icon: "check_circle", color: "text-success", bg: "bg-success/10", border: "border-success/20" },
  modified: { label: "Modified", icon: "edit", color: "text-info", bg: "bg-info/10", border: "border-info/20" },
  rejected: { label: "Rejected", icon: "block", color: "text-error", bg: "bg-error/10", border: "border-error/20" },
};

const overallStatusConfig: Record<string, { label: string; color: string }> = {
  pending_review: { label: "Pending Review", color: "text-warning" },
  approved: { label: "Fully Approved", color: "text-success" },
  partially_approved: { label: "Partially Approved", color: "text-info" },
  rejected: { label: "Rejected", color: "text-error" },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getDayDate(admissionDate: string, dayNumber: number): string {
  const d = new Date(admissionDate + "T00:00:00");
  d.setDate(d.getDate() + dayNumber - 1);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" });
}

export default function WeeklyPlanPage() {
  const navigate = useNavigate();
  const { patient_id } = useParams<{ patient_id: string }>();

  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  async function loadWeeklyPlan() {
    if (!patient_id) return;
    setIsLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("dietrace_token");
      const res = await fetch(`${API_URL}/weekly-plans/${patient_id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) {
        if (res.status === 404) {
          // No weekly plan yet
          setPlan(null);
          // Load patient info anyway
          const pRes = await fetch(`${API_URL}/patients/${patient_id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (pRes.ok) {
            const pData = await pRes.json();
            setPatient({ patient_code: pData.patient_code, full_name: pData.full_name });
          }
          setIsLoading(false);
          return;
        }
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setPlan(data);
      setPatient({ patient_code: data.patient?.patient_code, full_name: data.patient?.full_name });
    } catch (err: any) {
      setError(err.message || "Failed to load weekly plan.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadWeeklyPlan();
  }, [patient_id]);

  const handleGeneratePlan = async () => {
    if (!patient_id) return;
    setIsGenerating(true);
    setError("");
    try {
      const token = localStorage.getItem("dietrace_token");
      const res = await fetch(`${API_URL}/weekly-plans/generate/${patient_id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Generate failed (${res.status})`);
      }
      await loadWeeklyPlan();
    } catch (err: any) {
      setError(err.message || "Failed to generate weekly plan.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveAll = async () => {
    if (!plan) return;
    setIsApprovingAll(true);
    try {
      const token = localStorage.getItem("dietrace_token");
      const res = await fetch(`${API_URL}/weekly-plans/${plan.id}/approve-all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) throw new Error(`Approve all failed (${res.status})`);
      await loadWeeklyPlan();
    } catch (err: any) {
      setError(err.message || "Approve all failed.");
    } finally {
      setIsApprovingAll(false);
    }
  };

  const handleDayClick = (day: WeeklyPlanDay) => {
    if (!day.recommendation_id) return;
    navigate(`/dietitian/recommendation/${day.recommendation_id}?day=${day.day_number}&total=${plan?.total_days || 1}`);
  };

  const summary = plan
    ? {
        approved: plan.days.filter((d) => d.status === "approved").length,
        pending: plan.days.filter((d) => d.status === "pending_review").length,
        rejected: plan.days.filter((d) => d.status === "rejected").length,
        modified: plan.days.filter((d) => d.status === "modified").length,
      }
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-3 text-on-surface-variant">
        <div className="spinner" />
        <span className="text-sm">Loading weekly plan...</span>
      </div>
    );
  }

  return (
    <div className="weekly-plan-page min-h-screen relative overflow-x-hidden font-body-md">
      <div className="fixed inset-0 z-0" style={{ background: "linear-gradient(135deg, #f8faf8 100%, #ffffff 0%)" }} />
      <div className="fixed top-20 left-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-float z-0" />
      <div className="fixed bottom-20 right-10 w-96 h-96 rounded-full bg-tertiary/5 blur-3xl animate-float z-0" style={{ animationDelay: "-3s" }} />

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="w-full h-20 sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-black/5 flex justify-between items-center px-margin-desktop">
          <div className="flex-1 flex justify-start">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group">
              <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
              <span className="text-label-md font-medium uppercase tracking-widest">Back</span>
            </button>
          </div>
          <div className="flex-1 flex justify-center">
            <h1 className="font-bold text-xl tracking-[0.2em] text-on-surface uppercase leading-none">dietrace</h1>
          </div>
          <div className="flex-1 flex justify-end items-center gap-6">
            <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/5 border border-black/10 hover:border-primary/30 transition-all cursor-pointer group">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary group-hover:scale-105 transition-transform">DR</div>
              <span className="text-label-md font-medium">Account</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-margin-desktop py-12 max-w-7xl mx-auto w-full">
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-caption-bold text-caption-bold text-primary uppercase tracking-widest">Weekly Menu Plan</span>
            </div>
            <h2 className="font-headline-md text-4xl text-on-surface mb-2">
              {patient?.full_name || "Patient"}
            </h2>
            <p className="text-on-surface-variant max-w-2xl">
              {plan ? (
                <>
                  Admission: <strong>{formatDate(plan.admission_date)}</strong> → Discharge: <strong>{formatDate(plan.discharge_date)}</strong>
                  {" "}•{" "}
                  <span className="text-primary font-bold">{plan.total_days} days stay</span>
                </>
              ) : (
                "Generate a weekly plan for this patient's admission duration."
              )}
            </p>
          </section>

          {error && (
            <div className="liquid-glass px-6 py-4 rounded-xl flex items-center gap-3 border-l-4 border-l-error mb-8">
              <span className="material-symbols-outlined text-error text-lg">error</span>
              <span className="text-sm text-on-surface">{error}</span>
              <button onClick={() => setError("")} className="ml-auto text-xs text-on-surface-variant hover:text-on-surface">Dismiss</button>
            </div>
          )}

          {!plan && (
            <div className="liquid-glass p-12 rounded-3xl text-center max-w-lg mx-auto">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block">calendar_month</span>
              <h3 className="text-xl font-bold text-on-surface mb-2">No Weekly Plan Yet</h3>
              <p className="text-sm text-on-surface-variant mb-6">
                Generate a weekly menu plan based on the patient's admission and discharge dates.
              </p>
              <button
                onClick={handleGeneratePlan}
                disabled={isGenerating}
                className="px-8 py-4 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                {isGenerating ? "Generating..." : "Generate Weekly Plan"}
              </button>
            </div>
          )}

          {plan && summary && (
            <>
              {/* Summary Bar */}
              <div className="liquid-glass p-6 rounded-2xl mb-8 flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  <span className="text-sm font-bold text-on-surface">Plan Summary</span>
                </div>
                <div className="flex flex-wrap gap-4">
                  <span className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-bold border border-success/20">
                    {summary.approved} Approved
                  </span>
                  <span className="px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-bold border border-warning/20">
                    {summary.pending} Pending
                  </span>
                  <span className="px-3 py-1 rounded-full bg-error/10 text-error text-xs font-bold border border-error/20">
                    {summary.rejected} Rejected
                  </span>
                  <span className="px-3 py-1 rounded-full bg-info/10 text-info text-xs font-bold border border-info/20">
                    {summary.modified} Modified
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Overall</span>
                  <span className={`text-xs font-bold ${overallStatusConfig[plan.overall_status]?.color || "text-on-surface-variant"}`}>
                    {overallStatusConfig[plan.overall_status]?.label || plan.overall_status}
                  </span>
                </div>
              </div>

              {/* Day Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {plan.days.map((day) => {
                  const cfg = statusConfig[day.status] || statusConfig.pending_review;
                  return (
                    <button
                      key={day.id}
                      onClick={() => handleDayClick(day)}
                      disabled={!day.recommendation_id}
                      className={`liquid-glass p-5 rounded-2xl text-left transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group ${cfg.border}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                          Day {day.day_number}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-on-surface mb-2">
                        {getDayDate(plan.admission_date, day.day_number)}
                      </p>
                      <p className="text-[10px] text-on-surface-variant mb-2">
                        Cycle Day {day.cycle_day}
                      </p>
                      <div className="space-y-1">
                        {day.menu_items.slice(0, 3).map((item) => (
                          <p key={item.meal_time} className="text-xs text-on-surface-variant truncate">
                            <span className="capitalize font-medium">{item.meal_time}:</span>{" "}
                            {item.menu_name}
                          </p>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-1 text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        Review Day
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap justify-between items-center gap-4">
                <button
                  onClick={() => navigate(`/dietitian/patients/${patient_id}`)}
                  className="px-6 py-3 rounded-xl border border-black/10 text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-all text-sm font-medium flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Back to Patient
                </button>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => navigate(`/dietitian/weekly-plan/${plan.id}/full-report`)}
                    className="px-6 py-3 rounded-xl bg-black/5 border border-black/10 text-on-surface font-medium text-sm hover:bg-black/10 transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">description</span>
                    View Full Menu Report
                  </button>
                  <button
                    onClick={handleApproveAll}
                    disabled={isApprovingAll || summary.pending === 0}
                    className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {isApprovingAll ? "Approving..." : `Approve All (${summary.pending})`}
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
