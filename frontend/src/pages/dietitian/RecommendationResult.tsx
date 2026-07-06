import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { API_URL, checkAuth } from "../../lib/api";

interface MenuItem {
  mealTime: string;
  time: string;
  name: string;
  code: string;
  proteinType: string;
  calories: number;
  sugar: string;
  sodium: string;
  fat: string;
  tags: string[];
  status: "ok" | "warning" | "blocked";
  warningReason?: string;
  videoUrl: string;
  bgImage?: string;
}

interface RuleTrace {
  id: string;
  rule: string;
  condition: string;
  action: string;
}

interface RejectedItem {
  menuCode: string;
  name: string;
  reason: string;
}

interface PatientData {
  code: string;
  name: string;
  ward: string;
  age: number;
  gender: string;
  conditions: string[];
  allergies: string[];
  activityLevel: string;
  proteinPreference: string;
  carbPreference: string;
  category: string;
  cycleDay: string;
  patientId: string;
}

interface RecommendationData {
  status: "pending_review" | "approved" | "modified" | "rejected";
  patient: PatientData;
  menuItems: MenuItem[];
  rulesFired: RuleTrace[];
  rejectedItems: RejectedItem[];
  explanation: {
    summary: string;
    points: { icon: string; text: string }[];
  };
  rawCycleDay: number;
  weeklyPlanId: string | null;
}

interface MenuOption {
  id: string;
  menu_code: string;
  menu_name: string;
  meal_time: string;
  calories_kcal: number;
  protein_type: string;
  sugar_level: string;
  sodium_level: string;
  allergy_tags: string[];
  vegetarian: boolean;
}

interface PlanDay {
  day_number: number;
  recommendation_id: string;
  status: string;
}

const mealTimeLabels: Record<string, { icon: string; color: string; gradient: string }> = {
  breakfast: { icon: "wb_sunny", color: "text-amber-500", gradient: "from-amber-500/20 to-amber-600/10" },
  lunch: { icon: "sunny", color: "text-orange-500", gradient: "from-orange-500/20 to-orange-600/10" },
  dinner: { icon: "bedtime", color: "text-indigo-500", gradient: "from-indigo-500/20 to-indigo-600/10" },
};

export default function RecommendationResult() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const dayNumber = Number(searchParams.get("day")) || 1;
  const totalDays = Number(searchParams.get("total")) || 1;

  const [data, setData] = useState<RecommendationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState("");
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [planTotalDays, setPlanTotalDays] = useState(totalDays);

  // Swap modal state
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapMealTime, setSwapMealTime] = useState("");
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([]);
  const [isLoadingMenus, setIsLoadingMenus] = useState(false);
  const [swapError, setSwapError] = useState("");

  async function loadRecommendation() {
    setIsLoading(true);
    setError("");
    setSwapSuccess("");
    try {
      const token = localStorage.getItem("dietrace_token");
      const res = await fetch(`${API_URL}/recommendations/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      const api = await res.json();
      setData(mapApiToFrontend(api));

      // Load weekly plan days for selector if available
      if (api.weekly_plan_id) {
        const planRes = await fetch(`${API_URL}/weekly-plans/by-id/${api.weekly_plan_id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (planRes.ok) {
          const planData = await planRes.json();
          setPlanDays(planData.days || []);
          setPlanTotalDays(planData.total_days || totalDays);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load recommendation.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRecommendation();
  }, [id]);

  function mapApiToFrontend(api: any): RecommendationData {
    const patient = api.patient || {};
    const healthProfile = patient.health_profile || {};

    const conditions: string[] = [];
    if (healthProfile.has_diabetes) conditions.push("Diabetes");
    if (healthProfile.has_hypertension) conditions.push("Hypertension");
    if (healthProfile.has_high_cholesterol) conditions.push("High Cholesterol");

    const menuItems: MenuItem[] = (api.items || []).map((item: any) => {
      const menu = item.menu_option || {};
      const isBlocked = !item.menu_option_id;
      const mealTime = item.meal_time || "unknown";

      return {
        mealTime: mealTime.charAt(0).toUpperCase() + mealTime.slice(1),
        time: getMealTime(mealTime),
        name: menu.menu_name || "No Suitable Menu",
        code: menu.menu_code || "—",
        proteinType: menu.protein_type || "—",
        calories: menu.calories_kcal || 0,
        sugar: menu.sugar_level || "—",
        sodium: menu.sodium_level || "—",
        fat: menu.fat_level || "—",
        tags: menu.allergy_tags || [],
        status: isBlocked ? "blocked" : "ok",
        warningReason: isBlocked ? item.selection_reason : undefined,
        videoUrl: "",
        bgImage: undefined,
      };
    });

    const rulesFired: RuleTrace[] = (api.rule_trace_json || []).map((trace: any) => ({
      id: trace.rule_id || "R???",
      rule: trace.message || "Unknown rule",
      condition: trace.condition_matched || "Unknown",
      action: trace.conclusion || "Unknown",
    }));

    const rawRejected = api.explanation_json?.rejected_explanations || [];
    const rejectedItems: RejectedItem[] = rawRejected.map((rej: any) => ({
      menuCode: rej.menu_code || "—",
      name: rej.menu_name || "Unknown",
      reason: rej.reason || "Unknown",
    }));

    const explanation = {
      summary: api.explanation_json?.summary || "No explanation available.",
      points: [
        { icon: "check_circle", text: `Recommendation generated for cycle day ${api.cycle_day}` },
        { icon: "info", text: `Status: ${api.status}` },
      ],
    };

    return {
      status: api.status || "pending_review",
      patient: {
        code: patient.patient_code || "UNKNOWN",
        name: patient.full_name || "Unknown Patient",
        ward: patient.ward || "—",
        age: patient.age || 0,
        gender: patient.gender || "—",
        conditions,
        allergies: healthProfile.allergies || [],
        activityLevel: healthProfile.activity_level || "—",
        proteinPreference: healthProfile.preferred_protein || "None",
        carbPreference: healthProfile.preferred_carbohydrate || "None",
        category: healthProfile.patient_category || "normal",
        cycleDay: `Day ${api.cycle_day} of 14`,
        patientId: patient.id || "",
      },
      menuItems,
      rulesFired,
      rejectedItems,
      explanation,
      rawCycleDay: api.cycle_day || 0,
      weeklyPlanId: api.weekly_plan_id || null,
    };
  }

  function getMealTime(mealTime: string): string {
    const times: Record<string, string> = {
      breakfast: "07:30 AM",
      lunch: "12:30 PM",
      dinner: "06:30 PM",
    };
    return times[mealTime?.toLowerCase()] || "—";
  }

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem("dietrace_token");
      const res = await fetch(`${API_URL}/recommendations/${id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ review_note: reviewNote }),
      });
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) throw new Error(`Approve failed (${res.status})`);
      // Navigate back to weekly plan if available
      if (data?.weeklyPlanId) {
        navigate(`/dietitian/weekly-plan/${data.patient.patientId || data.patient.code}`);
      } else {
        navigate("/dietitian/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Approve failed. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem("dietrace_token");
      const res = await fetch(`${API_URL}/recommendations/${id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ review_note: reviewNote }),
      });
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) throw new Error(`Reject failed (${res.status})`);
      if (data?.weeklyPlanId) {
        navigate(`/dietitian/weekly-plan/${data.patient.patientId || data.patient.code}`);
      } else {
        navigate("/dietitian/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Reject failed. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const openSwapModal = async (mealTime: string) => {
    setSwapMealTime(mealTime);
    setShowSwapModal(true);
    setIsLoadingMenus(true);
    setSwapError("");
    try {
      const token = localStorage.getItem("dietrace_token");
      const res = await fetch(`${API_URL}/menus?meal_time=${mealTime.toLowerCase()}&cycle_day=${data?.rawCycleDay ?? 0}&is_active=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) throw new Error("Failed to load menu options");
      const menus = await res.json();
      setMenuOptions(menus);
    } catch (err: any) {
      setSwapError(err.message || "Failed to load menu options.");
    } finally {
      setIsLoadingMenus(false);
    }
  };

  const handleSwap = async (menu: MenuOption) => {
    setActionLoading(true);
    setError("");
    setSwapSuccess("");
    try {
      const token = localStorage.getItem("dietrace_token");
      const res = await fetch(`${API_URL}/recommendations/${id}/modify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          review_note: reviewNote || `Swapped ${swapMealTime} to ${menu.menu_name}`,
          new_menu_option_id: menu.id,
          meal_time: swapMealTime,
          new_menu_name: menu.menu_name,
        }),
      });
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Swap failed (${res.status})`);
      }
      setShowSwapModal(false);
      setSwapSuccess(`Successfully swapped ${swapMealTime} to ${menu.menu_name}`);
      await loadRecommendation();
    } catch (err: any) {
      setError(err.message || "Swap failed. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const navigateToDay = (recId: string) => {
    if (!recId) return;
    navigate(`/dietitian/recommendation/${recId}?day=${dayNumber}&total=${planTotalDays}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-3 text-on-surface-variant">
        <div className="spinner" />
        <span className="text-sm">Loading recommendation...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl text-error">error</span>
        <p className="text-lg">{error}</p>
        <button onClick={() => navigate("/dietitian/dashboard")} className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { patient, menuItems, rulesFired, rejectedItems, explanation } = data;

  return (
    <div className="recommendation-review-page min-h-screen relative overflow-x-hidden font-body-md">
      <div className="fixed inset-0 z-0 mesh-gradient-bg" />
      <div className="fixed top-20 left-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-float z-0" />
      <div className="fixed bottom-20 right-10 w-96 h-96 rounded-full bg-tertiary/5 blur-3xl animate-float z-0" style={{ animationDelay: "-3s" }} />

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="w-full h-20 sticky top-0 z-50 backdrop-blur-xl bg-white/60 border-b border-white/20 flex justify-between items-center px-margin-desktop">
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
            <div className="flex items-center gap-2 text-on-surface-variant">
              <button title="Coming soon" className="material-symbols-outlined p-2 rounded-full opacity-40 cursor-default">notifications</button>
              <button title="Coming soon" className="material-symbols-outlined p-2 rounded-full opacity-40 cursor-default">settings</button>
            </div>
            <div className="flex items-center gap-3 px-4 py-1.5 rounded-full liquid-glass">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">DR</div>
              <span className="text-label-md font-medium">Account</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-margin-desktop py-12 max-w-7xl mx-auto w-full space-y-6">
          {/* Page Header */}
          <section className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="font-caption-bold text-caption-bold text-primary uppercase tracking-widest">Expert Clinical Review</span>
              </div>
              <h2 className="font-headline-md text-4xl text-on-surface">Recommendation Review</h2>
              <p className="font-body-md text-on-surface-variant max-w-2xl">
                Review rule based menu recommendations before patient release.
              </p>
              {/* Day X of Y header */}
              <div className="flex items-center gap-2 mt-2">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                  Day {dayNumber} of {planTotalDays}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => navigate(`/dietitian/patients/${patient.code}`)}
                className="px-4 py-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">patient_list</span>
                Patient Details
              </button>
              {([
                { key: "pending_review", label: "Pending Review", activeClasses: "bg-warning/10 border-warning/20 text-warning" },
                { key: "approved", label: "Approved", activeClasses: "bg-success/10 border-success/20 text-success" },
                { key: "modified", label: "Modified", activeClasses: "bg-info/10 border-info/20 text-info" },
                { key: "rejected", label: "Rejected", activeClasses: "bg-error/10 border-error/20 text-error" },
              ] as const).map((pill) => {
                const isActive = data.status === pill.key;
                return (
                  <span key={pill.key} className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${isActive ? pill.activeClasses : "bg-black/5 border-black/10 text-on-surface-variant/60"}`}>
                    {pill.label}
                  </span>
                );
              })}
            </div>
          </section>

          {/* Success Banner */}
          {swapSuccess && (
            <div className="liquid-glass px-6 py-4 rounded-xl flex items-center gap-3 border-l-4 border-l-success mb-6 animate-fade-in">
              <span className="material-symbols-outlined text-success text-lg">check_circle</span>
              <span className="text-sm text-on-surface font-medium">{swapSuccess}</span>
              <button onClick={() => setSwapSuccess("")} className="ml-auto text-xs text-on-surface-variant hover:text-on-surface">Dismiss</button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="liquid-glass px-6 py-4 rounded-xl flex items-center gap-3 border-l-4 border-l-error mb-6">
              <span className="material-symbols-outlined text-error text-lg">error</span>
              <span className="text-sm text-on-surface">{error}</span>
              <button onClick={() => setError("")} className="ml-auto text-xs text-on-surface-variant hover:text-on-surface">Dismiss</button>
            </div>
          )}

          <div className="grid grid-cols-12 gap-6">
            {/* Patient Summary */}
            <div className="col-span-12 liquid-glass-strong p-8 rounded-3xl flex flex-col gap-8 relative overflow-hidden">
              <div className="flex items-center gap-3 border-b border-white/10 pb-6">
                <span className="material-symbols-outlined text-primary">patient_list</span>
                <h2 className="text-xl font-semibold text-on-surface">Patient Summary</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Patient Code</span>
                  <span className="block text-on-surface font-bold">{patient.code}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Full Name</span>
                  <span className="block text-on-surface font-bold text-lg">{patient.name}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Ward</span>
                  <span className="block text-on-surface font-bold">{patient.ward}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Age</span>
                  <span className="block text-on-surface font-bold">{patient.age}y</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Gender</span>
                  <span className="block text-on-surface font-bold text-lg">{patient.gender}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Conditions</span>
                  <div className="flex gap-1 flex-wrap pt-1">
                    {patient.conditions.map((c) => (
                      <span key={c} className="px-2 py-0.5 bg-error/10 text-error text-[10px] font-bold rounded uppercase border border-error/20">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Allergies</span>
                  <span className="block text-error font-bold text-lg">{patient.allergies.join(", ") || "None"}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Activity Level</span>
                  <span className="block text-on-surface font-bold">{patient.activityLevel}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Protein Preference</span>
                  <span className="block text-on-surface font-bold">{patient.proteinPreference}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Carb Preference</span>
                  <span className="block text-on-surface font-bold">{patient.carbPreference}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Category</span>
                  <span className="block text-primary font-bold">{patient.category}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Cycle Day</span>
                  <span className="block text-on-surface font-bold">{patient.cycleDay}</span>
                </div>
              </div>

              {/* Day Selector Tabs */}
              {planDays.length > 0 && (
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Day Selector</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {planDays.map((day) => {
                      const isCurrent = day.day_number === dayNumber;
                      const statusColor =
                        day.status === "approved" ? "bg-success/10 text-success border-success/20" :
                        day.status === "rejected" ? "bg-error/10 text-error border-error/20" :
                        day.status === "modified" ? "bg-info/10 text-info border-info/20" :
                        "bg-warning/10 text-warning border-warning/20";
                      return (
                        <button
                          key={day.day_number}
                          onClick={() => navigateToDay(day.recommendation_id)}
                          disabled={!day.recommendation_id || isCurrent}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            isCurrent
                              ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                              : `${statusColor} hover:scale-105`
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          Day {day.day_number}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Menu Cards */}
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              {menuItems.map((item) => {
                const mealStyle = mealTimeLabels[item.mealTime.toLowerCase()] || mealTimeLabels.dinner;
                return (
                  <div key={item.mealTime} className={`liquid-glass rounded-3xl flex flex-col relative overflow-hidden ${item.status === "blocked" ? "border-error/30" : ""}`}>
                    <div className={`relative h-48 overflow-hidden flex items-center justify-center bg-gradient-to-br ${mealStyle.gradient}`}>
                      <div className="absolute top-4 right-4 w-20 h-20 rounded-full border border-white/20" />
                      <div className="absolute bottom-4 left-4 w-12 h-12 rounded-full border border-white/10" />
                      <div className="w-20 h-20 rounded-2xl bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-lg">
                        <span className={`material-symbols-outlined ${mealStyle.color} text-5xl`}>{mealStyle.icon}</span>
                      </div>
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <span className={`text-label-md font-bold ${mealStyle.color} uppercase tracking-widest bg-white/60 backdrop-blur-sm px-3 py-1 rounded-full`}>
                          {item.mealTime}
                        </span>
                      </div>
                      <div className="absolute top-4 right-4">
                        <span className="px-3 py-1 bg-white/60 backdrop-blur-sm border border-white/30 text-[10px] font-bold rounded uppercase text-on-surface">
                          {item.code}
                        </span>
                      </div>
                    </div>
                    <div className="p-6 flex flex-col gap-4 flex-1">
                      <h3 className={`text-2xl font-bold text-on-surface ${item.status === "blocked" ? "text-on-surface/50" : ""}`}>
                        {item.name}
                      </h3>
                      {item.proteinType !== "—" && (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-on-surface-variant text-sm">restaurant</span>
                          <span className="text-sm text-on-surface-variant font-medium">{item.proteinType}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {item.tags.map((tag) => (
                          <span key={tag} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            item.status === "blocked"
                              ? "bg-error/10 text-error border border-error/20"
                              : "bg-primary/10 text-primary border border-primary/20"
                          }`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="space-y-3">
                        {item.status === "blocked" && item.warningReason && (
                          <div className="bg-error/10 p-4 rounded-2xl border border-error/20">
                            <p className="text-[10px] text-error font-bold mb-1 uppercase tracking-widest">System Blocked</p>
                            <p className="text-xs text-error leading-relaxed">{item.warningReason}</p>
                          </div>
                        )}
                        {item.status === "ok" && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="liquid-glass-clear p-3 rounded-xl text-center">
                              <p className="text-[10px] text-on-surface-variant uppercase font-bold">Calories</p>
                              <p className="text-lg font-bold text-on-surface">{item.calories}</p>
                              <p className="text-[10px] text-on-surface-variant">kcal</p>
                            </div>
                            <div className="liquid-glass-clear p-3 rounded-xl text-center">
                              <p className="text-[10px] text-on-surface-variant uppercase font-bold">Sugar</p>
                              <p className="text-lg font-bold text-on-surface">{item.sugar}</p>
                            </div>
                            <div className="liquid-glass-clear p-3 rounded-xl text-center">
                              <p className="text-[10px] text-on-surface-variant uppercase font-bold">Sodium</p>
                              <p className="text-lg font-bold text-on-surface">{item.sodium}</p>
                            </div>
                            <div className="liquid-glass-clear p-3 rounded-xl text-center">
                              <p className="text-[10px] text-on-surface-variant uppercase font-bold">Fat</p>
                              <p className="text-lg font-bold text-on-surface">{item.fat}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => openSwapModal(item.mealTime.toLowerCase())}
                        disabled={actionLoading}
                        className="w-full py-3 rounded-xl liquid-glass-clear text-on-surface text-xs font-bold uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">swap_horiz</span>
                        Swap Menu
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Left Column: Rules + Rejected */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <div className="liquid-glass rounded-3xl overflow-hidden">
                <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">account_tree</span>
                    <h2 className="text-xl font-semibold text-on-surface">Rules Fired</h2>
                  </div>
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">Trace v1.9.0</span>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rulesFired.map((rule) => (
                    <div key={rule.id} className="p-5 rounded-2xl liquid-glass-clear flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[10px] text-primary">{rule.id}</span>
                        <span className="material-symbols-outlined text-sm text-on-surface-variant/40">lock</span>
                      </div>
                      <p className="text-xs leading-relaxed text-on-surface">
                        <span className="font-bold text-primary">IF</span> {rule.condition} <span className="font-bold text-primary">THEN</span> {rule.action}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="liquid-glass rounded-3xl overflow-hidden">
                <details className="group" open>
                  <summary className="px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors list-none">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-error">cancel</span>
                      <h2 className="text-xl font-semibold text-on-surface">Rejected Menu Reasons</h2>
                    </div>
                    <span className="material-symbols-outlined transition-transform group-open:rotate-180 text-on-surface-variant">expand_more</span>
                  </summary>
                  <div className="px-8 pb-8">
                    {rejectedItems.length === 0 ? (
                      <p className="text-sm text-on-surface-variant">No rejected items</p>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-white/10">
                        <table className="w-full text-left">
                          <thead className="liquid-glass-clear">
                            <tr>
                              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Menu Code</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Menu Name</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Rejection Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-sm">
                            {rejectedItems.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-6 py-4 text-on-surface-variant font-medium">{item.menuCode}</td>
                                <td className="px-6 py-4 font-bold text-on-surface">{item.name}</td>
                                <td className="px-6 py-4 text-error font-medium">{item.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>

            {/* Right Column: Explanation + Decision */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <div className="liquid-glass p-8 rounded-3xl flex flex-col gap-6">
                <div className="flex items-center gap-3 border-b border-white/10 pb-5">
                  <span className="material-symbols-outlined text-primary">lightbulb</span>
                  <h2 className="text-xl font-semibold text-on-surface">Explanation</h2>
                </div>
                <div className="space-y-6">
                  <p className="text-sm leading-relaxed text-on-surface-variant">{explanation.summary}</p>
                  <div className="space-y-4">
                    {explanation.points.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 liquid-glass-clear rounded-2xl">
                        <span className="material-symbols-outlined text-primary text-sm mt-0.5">{point.icon}</span>
                        <p className="text-xs text-on-surface-variant leading-relaxed">{point.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="liquid-glass p-8 rounded-3xl flex flex-col gap-6 border-t-2 border-primary/30 shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">clinical_notes</span>
                  <h2 className="text-xl font-semibold text-on-surface">Dietitian Decision</h2>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Review Notes</label>
                  <textarea
                    className="w-full liquid-glass-clear border border-white/10 rounded-2xl p-4 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-h-[140px] transition-all resize-none"
                    placeholder="Enter clinical observations or notes..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-3 pt-4">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="w-full py-4 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                    {actionLoading ? "Processing..." : "Approve & Release"}
                  </button>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="py-3.5 rounded-xl bg-error/10 border border-error/20 text-error font-bold flex items-center justify-center gap-2 hover:bg-error/20 active:scale-95 transition-all text-xs"
                    >
                      <span className="material-symbols-outlined text-sm">block</span>
                      Reject
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-on-surface-variant/60 text-center leading-relaxed">
                  Use <strong>Swap Menu</strong> on each card to modify individual meals. Status will auto-change to Modified.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-12 flex flex-col md:flex-row justify-between items-center gap-4">
            <button onClick={() => navigate("/dietitian/dashboard")} className="px-8 py-3.5 liquid-glass rounded-xl text-on-surface-variant font-medium text-sm hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Dashboard
            </button>
            <div className="flex gap-4">
              <button onClick={() => data?.weeklyPlanId ? navigate(`/dietitian/weekly-plan/${data.patient.patientId || data.patient.code}`) : navigate(`/dietitian/patients/${patient.code}`)} className="px-8 py-3.5 liquid-glass rounded-xl text-primary font-bold text-sm hover:bg-primary/10 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-base">calendar_view_week</span>
                Back to Weekly Plan
              </button>
              <button onClick={() => navigate(`/dietitian/patients/${patient.code}`)} className="px-8 py-3.5 liquid-glass rounded-xl text-primary font-bold text-sm hover:bg-primary/10 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-base">patient_list</span>
                Patient Details
              </button>
              <button onClick={() => window.print()} className="px-8 py-3.5 liquid-glass rounded-xl text-on-surface font-medium text-sm hover:bg-white/10 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-base">print</span>
                Print Record
              </button>
            </div>
          </footer>
        </main>
      </div>

      {/* Swap Menu Modal */}
      {showSwapModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSwapModal(false)} />
          <div className="relative liquid-glass-strong rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">swap_horiz</span>
                <h3 className="text-xl font-bold text-on-surface">Swap {swapMealTime.charAt(0).toUpperCase() + swapMealTime.slice(1)} Menu</h3>
              </div>
              <button onClick={() => setShowSwapModal(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingMenus ? (
                <div className="flex items-center justify-center gap-3 py-12">
                  <div className="spinner" />
                  <span className="text-sm text-on-surface-variant">Loading menus...</span>
                </div>
              ) : swapError ? (
                <div className="text-center py-12 text-error">{swapError}</div>
              ) : menuOptions.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant">No menu options available.</div>
              ) : (
                <div className="space-y-3">
                  {menuOptions.map((menu) => (
                    <div key={menu.id} className="p-4 rounded-2xl border border-white/10 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-between group">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-on-surface">{menu.menu_name}</span>
                          <span className="text-[10px] text-on-surface-variant font-mono">{menu.menu_code}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                          <span>{menu.calories_kcal} kcal</span>
                          <span>•</span>
                          <span>Protein: {menu.protein_type}</span>
                          <span>•</span>
                          <span>Sugar: {menu.sugar_level}</span>
                          <span>•</span>
                          <span>Sodium: {menu.sodium_level}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSwap(menu)}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      >
                        {actionLoading ? "..." : "Select"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
