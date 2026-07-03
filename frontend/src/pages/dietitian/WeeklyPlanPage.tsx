import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL, checkAuth } from "../../lib/api";

interface WeeklyPlanDay {
  day_number: number;
  cycle_day: number;
  status: string;
  recommendation_id: string;
  created_at: string;
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
  full_name: string;
  patient_code: string;
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case "approved":
      return "bg-success/10 text-success border-success/20";
    case "rejected":
      return "bg-error/10 text-error border-error/20";
    case "modified":
      return "bg-info/10 text-info border-info/20";
    default:
      return "bg-warning/10 text-warning border-warning/20";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "approved":
      return "check_circle";
    case "rejected":
      return "cancel";
    case "modified":
      return "edit";
    default:
      return "schedule";
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WeeklyPlanPage() {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      if (!patientId) return;
      setIsLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("dietrace_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Load patient
        const patientRes = await fetch(`${API_URL}/patients/${patientId}`, { headers });
        if (!checkAuth(patientRes, navigate)) return;
        if (!patientRes.ok) throw new Error("Failed to load patient");
        const patientData = await patientRes.json();
        setPatient(patientData);

        // Load weekly plan
        const planRes = await fetch(`${API_URL}/weekly-plans/${patientId}`, { headers });
        if (!checkAuth(planRes, navigate)) return;
        if (!planRes.ok) throw new Error("Failed to load weekly plan");
        const planData = await planRes.json();
        setWeeklyPlan(planData);
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [patientId, navigate]);

  const handleDayClick = (recId: string, dayNum: number) => {
    if (weeklyPlan) {
      navigate(`/dietitian/recommendation/${recId}?day=${dayNum}&total=${weeklyPlan.total_days}`);
    }
  };

  if (isLoading) {
    return (
      <div className="weekly-plan-page min-h-screen flex items-center justify-center gap-3 text-on-surface-variant">
        <div className="spinner" />
        <span className="text-sm">Loading weekly plan...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="weekly-plan-page min-h-screen flex flex-col items-center justify-center gap-4 text-on-surface-variant">
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

  if (!weeklyPlan || !patient) return null;

  const startDate = new Date(weeklyPlan.admission_date);
  const statusCounts = {
    approved: weeklyPlan.days.filter((d) => d.status === "approved").length,
    rejected: weeklyPlan.days.filter((d) => d.status === "rejected").length,
    modified: weeklyPlan.days.filter((d) => d.status === "modified").length,
    pending: weeklyPlan.days.filter((d) => d.status === "pending_review").length,
  };

  return (
    <div className="weekly-plan-page font-body-md text-body-md antialiased min-h-screen relative overflow-x-hidden">
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

        <main className="flex-1 px-margin-desktop py-12 max-w-7xl mx-auto w-full">
          {/* Title */}
          <div className="mb-10 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-caption-bold text-caption-bold text-primary uppercase tracking-widest">Weekly Menu Planning</span>
            </div>
            <h1 className="font-headline-md text-4xl text-on-surface mb-2">{patient.full_name}</h1>
            <p className="font-body-md text-on-surface-variant">
              {weeklyPlan.total_days}-day hospital stay • {formatDate(weeklyPlan.admission_date)} to{" "}
              {formatDate(weeklyPlan.discharge_date)}
            </p>
          </div>

          {/* Status Summary */}
          <div className="liquid-glass rounded-3xl p-8 mb-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Approved</p>
              <p className="text-3xl font-bold text-success">{statusCounts.approved}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Pending</p>
              <p className="text-3xl font-bold text-warning">{statusCounts.pending}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Modified</p>
              <p className="text-3xl font-bold text-info">{statusCounts.modified}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Rejected</p>
              <p className="text-3xl font-bold text-error">{statusCounts.rejected}</p>
            </div>
          </div>

          {/* Weekly Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {weeklyPlan.days.map((day, idx) => {
              const dayDate = new Date(startDate);
              dayDate.setDate(dayDate.getDate() + idx);
              return (
                <button
                  key={day.day_number}
                  onClick={() => handleDayClick(day.recommendation_id, day.day_number)}
                  className="liquid-glass rounded-2xl p-6 text-left hover:scale-105 transition-transform cursor-pointer border border-black/5 hover:border-primary/20"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest">Day {day.day_number}</p>
                      <p className="text-sm font-medium text-on-surface">
                        {dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <span className={`material-symbols-outlined text-lg ${getStatusIcon(day.status)}`}>
                      {getStatusIcon(day.status)}
                    </span>
                  </div>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${getStatusBadgeColor(day.status)}`}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    {day.status.replace("_", " ")}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => navigate("/dietitian/dashboard")}
              className="px-8 py-3.5 bg-black/5 border border-black/10 rounded-xl text-on-surface-variant font-medium text-sm hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">home</span>
              Dashboard
            </button>
            <button
              onClick={() => navigate(`/dietitian/weekly-plan/${weeklyPlan.id}/full-report`)}
              className="px-12 py-3.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 shadow-lg"
            >
              <span className="material-symbols-outlined text-base">description</span>
              Full Report
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
