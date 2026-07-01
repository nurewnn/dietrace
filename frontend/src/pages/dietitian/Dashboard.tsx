import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, checkAuth } from "../../lib/api";

type ReviewStatus = "pending_review" | "approved" | "modified" | "rejected" | "needs_dietitian_action" | "awaiting_data";

interface PatientReviewRow {
  id: string;
  name: string;
  age: number;
  gender: string;
  department: string;
  ward: string;
  tags: string[];
  status: ReviewStatus;
  recommendationId?: string;
  hasHealthProfile: boolean;
}

interface DashboardSummaryData {
  total_patients: number;
  pending_review: number;
  approved: number;
  modified: number;
  rejected: number;
  no_suitable_alerts: number;
}

interface ActivityItem {
  action: string;
  patient_code: string;
  patient_name: string;
  note: string;
  action_at: string;
}

interface WorkloadData {
  approved: number;
  rejected: number;
  modified: number;
  reviewed: number;
  generated: number;
}

const navItems = [
  { icon: "dashboard", label: "Dashboard", route: "/dietitian/dashboard", active: true },
  { icon: "person_add", label: "Add Patient", route: "/dietitian/patients" },
];

const statCardsConfig = [
  { key: "total_patients" as const, status: "all" as const, icon: "groups", label: "TOTAL", sub: "Patients Active", accent: "border-t-black/20", iconColor: "text-on-surface", labelColor: "text-on-surface-variant" },
  { key: "pending_review" as const, status: "pending_review" as const, icon: "pending_actions", label: "PENDING", sub: "Review Required", accent: "border-t-warning", iconColor: "text-warning", labelColor: "text-warning" },
  { key: "approved" as const, status: "approved" as const, icon: "verified", label: "APPROVED", sub: "Clinical Validated", accent: "border-t-success", iconColor: "text-success", labelColor: "text-success" },
  { key: "modified" as const, status: "modified" as const, icon: "edit_note", label: "MODIFIED", sub: "Custom Adjusts", accent: "border-t-info", iconColor: "text-info", labelColor: "text-info" },
  { key: "rejected" as const, status: "rejected" as const, icon: "cancel", label: "REJECTED", sub: "Flagged Safety", accent: "border-t-error", iconColor: "text-error", labelColor: "text-error" },
  { key: "no_suitable_alerts" as const, status: "needs_dietitian_action" as const, icon: "warning", label: "ALERTS", sub: "Safety Violations", accent: "border-t-error", iconColor: "text-error animate-pulse", labelColor: "text-error" },
];

function deriveTagsFromHealthProfile(healthProfile: any): string[] {
  const tags: string[] = [];
  if (!healthProfile) return tags;

  if (healthProfile.has_diabetes) tags.push("DIABETES");
  if (healthProfile.has_hypertension) tags.push("HYPERTENSION");
  if (healthProfile.has_high_cholesterol) tags.push("HIGH CHOLESTEROL");
  if (healthProfile.allergies?.length) {
    tags.push(...healthProfile.allergies.map((a: string) => a.toUpperCase()));
  }
  if (healthProfile.patient_category && healthProfile.patient_category !== "normal") {
    tags.push(healthProfile.patient_category.toUpperCase().replace(/_/g, " "));
  }
  if (healthProfile.is_vegetarian) tags.push("VEGETARIAN");
  if (healthProfile.has_chewing_problem) tags.push("CHEWING");
  return tags;
}

function deriveStatus(healthProfile: any, latestRec: any): ReviewStatus {
  if (!healthProfile) return "awaiting_data";
  if (latestRec) return latestRec.status as ReviewStatus;
  return "pending_review";
}

function mapApiPatientToRow(apiPatient: any): PatientReviewRow {
  const hp = apiPatient.health_profile;
  const latestRec = apiPatient.latest_recommendation;

  return {
    id: apiPatient.patient_code ?? apiPatient.id ?? "UNKNOWN",
    name: apiPatient.full_name ?? "Unknown Patient",
    age: apiPatient.age ?? 0,
    gender: apiPatient.gender ?? "—",
    department: apiPatient.ward ?? "—",
    ward: apiPatient.ward ?? "—",
    tags: deriveTagsFromHealthProfile(hp),
    status: deriveStatus(hp, latestRec),
    recommendationId: latestRec?.id,
    hasHealthProfile: !!hp,
  };
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getActionIcon(action: string): string {
  const map: Record<string, string> = {
    approved: "check_circle",
    rejected: "block",
    modified: "edit_note",
    generated: "auto_awesome",
  };
  return map[action] || "circle";
}

function getActionColor(action: string): string {
  const map: Record<string, string> = {
    approved: "text-success",
    rejected: "text-error",
    modified: "text-info",
    generated: "text-primary",
  };
  return map[action] || "text-on-surface-variant";
}

function getActionLabel(action: string): string {
  const map: Record<string, string> = {
    approved: "Approved",
    rejected: "Rejected",
    modified: "Modified",
    generated: "Generated",
  };
  return map[action] || action;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState<PatientReviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<DashboardSummaryData>({
    total_patients: 0,
    pending_review: 0,
    approved: 0,
    modified: 0,
    rejected: 0,
    no_suitable_alerts: 0,
  });
  const [sortConfig, setSortConfig] = useState<{ key: keyof PatientReviewRow; direction: "asc" | "desc" } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"online" | "offline" | "syncing">("syncing");

  // ── NEW: Sidebar collapse ───────────────────────────────────────
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // ── NEW: Filter chips ───────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<ReviewStatus | "all">("all");

  // ── NEW: Activity & workload ────────────────────────────────────
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [workload, setWorkload] = useState<WorkloadData | null>(null);

  // Load patients
  useEffect(() => {
    async function loadPatients() {
      setIsLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("dietrace_token");
        const res = await fetch(`${API_URL}/patients`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!checkAuth(res, navigate)) return;

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        const mapped = Array.isArray(data) ? data.map(mapApiPatientToRow) : [];
        setPatients(mapped);
        setConnectionStatus("online");
      } catch (err: any) {
        setError(err.message || "Failed to load patients. Please check your connection.");
        setConnectionStatus("offline");
        setPatients([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadPatients();
  }, []);

  // Load summary
  useEffect(() => {
    async function loadSummary() {
      try {
        const token = localStorage.getItem("dietrace_token");
        const res = await fetch(`${API_URL}/dashboard/summary`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!checkAuth(res, navigate)) return;

        if (!res.ok) throw new Error(`Server returned ${res.status}`);

        const data = await res.json();
        setSummary({
          total_patients: data.total_patients ?? 0,
          pending_review: data.pending_review ?? 0,
          approved: data.approved ?? 0,
          modified: data.modified ?? 0,
          rejected: data.rejected ?? 0,
          no_suitable_alerts: data.no_suitable_alerts ?? 0,
        });
      } catch (err: any) {
        console.warn("Dashboard summary failed:", err.message || err);
      }
    }
    loadSummary();
  }, []);

  // ── NEW: Load activity & workload ────────────────────────────────
  useEffect(() => {
    async function loadActivity() {
      try {
        const token = localStorage.getItem("dietrace_token");
        const res = await fetch(`${API_URL}/dashboard/activity`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!checkAuth(res, navigate)) return;
        if (!res.ok) throw new Error("Activity load failed");
        const data = await res.json();
        setActivity(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.warn("Activity feed failed:", err.message || err);
      }
    }

    async function loadWorkload() {
      try {
        const token = localStorage.getItem("dietrace_token");
        const res = await fetch(`${API_URL}/dashboard/workload`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!checkAuth(res, navigate)) return;
        if (!res.ok) throw new Error("Workload load failed");
        const data = await res.json();
        setWorkload(data);
      } catch (err: any) {
        console.warn("Workload snapshot failed:", err.message || err);
      }
    }

    loadActivity();
    loadWorkload();
  }, []);

  // 3D tilt effect on stat cards
  useEffect(() => {
    const panels = wrapperRef.current?.querySelectorAll<HTMLElement>(".liquid-glass-panel");
    if (!panels) return;

    const handlers: Array<{ el: HTMLElement; move: (e: MouseEvent) => void; leave: () => void }> = [];

    panels.forEach((panel) => {
      const move = (e: MouseEvent) => {
        const rect = panel.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 80;
        const rotateY = (centerX - x) / 80;
        panel.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`;
      };
      const leave = () => {
        panel.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)";
      };
      panel.addEventListener("mousemove", move);
      panel.addEventListener("mouseleave", leave);
      handlers.push({ el: panel, move, leave });
    });

    return () => {
      handlers.forEach(({ el, move, leave }) => {
        el.removeEventListener("mousemove", move);
        el.removeEventListener("mouseleave", leave);
      });
    };
  }, [patients]);

  const handleLogout = () => {
    localStorage.removeItem("dietrace_token");
    navigate("/dietitian/login");
  };

  const handleSort = (key: keyof PatientReviewRow) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  };

  const filteredAndSortedPatients = patients
    .filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
      const matchesFilter = activeFilter === "all" || p.status === activeFilter;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

  const renderStatusBadge = (status: ReviewStatus) => {
    const statusMap: Record<string, { class: string; label: string; icon: string }> = {
      pending_review: { class: "status-badge--pending", label: "Pending Review", icon: "pending" },
      approved: { class: "status-badge--approved", label: "Approved", icon: "verified" },
      modified: { class: "status-badge--modified", label: "Modified", icon: "edit_note" },
      rejected: { class: "status-badge--rejected", label: "Rejected", icon: "cancel" },
      needs_dietitian_action: { class: "status-badge--needs-action", label: "Action Needed", icon: "warning" },
      awaiting_data: { class: "status-badge--awaiting", label: "Awaiting Data", icon: "hourglass_empty" },
    };
    const config = statusMap[status] || statusMap.awaiting_data;
    return (
      <span className={`status-badge ${config.class}`}>
        <span className="material-symbols-outlined text-[10px]">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  const goToRecommendation = (patient: PatientReviewRow) => {
    if (patient.recommendationId) {
      navigate(`/dietitian/recommendation/${patient.recommendationId}`);
    } else {
      navigate(`/dietitian/patients/${patient.id}`);
    }
  };

  const handleDeletePatient = async (patient: PatientReviewRow) => {
    const confirmed = window.confirm(`Delete patient "${patient.name}" (${patient.id})? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const token = localStorage.getItem("dietrace_token");
      const res = await fetch(`${API_URL}/patients/${encodeURIComponent(patient.id)}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setPatients((prev) => prev.filter((p) => p.id !== patient.id));
    } catch (err: any) {
      setError(err.message || "Failed to delete patient.");
    }
  };

  const renderActionButton = (patient: PatientReviewRow) => {
    if (patient.status === "needs_dietitian_action") {
      return (
        <button
          onClick={() => goToRecommendation(patient)}
          className="px-5 py-2 bg-error text-white rounded-full text-xs font-bold hover:scale-105 transition-transform shadow-lg shadow-error/20"
        >
          Action Needed
        </button>
      );
    }
    if (patient.status === "approved") {
      return (
        <button
          onClick={() => goToRecommendation(patient)}
          className="px-5 py-2 border border-black/20 text-on-surface rounded-full text-xs font-bold hover:bg-black/5 transition-all"
        >
          Details
        </button>
      );
    }
    if (patient.status === "awaiting_data") {
      return (
        <button
          onClick={() => navigate(`/dietitian/patients/${patient.id}/edit`)}
          className="px-5 py-2 bg-warning/10 text-warning border border-warning/30 rounded-full text-xs font-bold hover:bg-warning/20 transition-all"
        >
          Add Profile
        </button>
      );
    }
    if (patient.status === "pending_review") {
      return (
        <button
          onClick={() => navigate(`/dietitian/patients/${patient.id}`)}
          className="px-5 py-2 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
        >
          Review
        </button>
      );
    }
    return (
      <button
        onClick={() => goToRecommendation(patient)}
        className="px-5 py-2 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
      >
        Review
      </button>
    );
  };

  // Sidebar width class
  const sidebarWidth = isSidebarCollapsed ? "w-16" : "w-64";
  const mainMargin = isSidebarCollapsed ? "ml-16" : "ml-64";

  return (
    <div ref={wrapperRef} className="dietitian-dashboard-page min-h-screen overflow-x-hidden relative selection:bg-primary selection:text-white">
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{ background: "linear-gradient(135deg, #f8faf8 100%, #ffffff 0%)" }}
      />

      {/* ════════════════════════════════════════════════════════════
          SIDEBAR
      ════════════════════════════════════════════════════════════ */}
      <aside
        className={`fixed left-0 top-0 h-full z-40 flex flex-col p-2 bg-white/90 backdrop-blur-xl border-r border-black/5 shadow-lg transition-all duration-300 ${sidebarWidth}`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className={`flex items-center ${isSidebarCollapsed ? "justify-center px-2" : "gap-3 px-4"} py-6 mb-2 relative`}>
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-headline-sm">monitor_heart</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-xl font-bold text-on-surface tracking-tight whitespace-nowrap">Dietrace</span>
                <span className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold whitespace-nowrap">Expert System</span>
              </div>
            )}
          </div>

          {/* ── Nav Items ── */}
          <nav className="flex-1 px-2 space-y-2 overflow-y-auto custom-scrollbar min-h-0">
            {navItems.map((item) => {
              const isActive = item.active;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => item.route && navigate(item.route)}
                  className={`flex items-center gap-4 rounded-lg group transition-all duration-300 ${
                    isActive ? "bg-primary text-white shadow-lg" : "text-on-surface-variant hover:bg-black/5"
                  } ${isSidebarCollapsed ? "justify-center px-2 py-3" : "w-full px-4 py-3"}`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <span className={`material-symbols-outlined ${!isActive ? "group-hover:text-primary" : ""}`}>
                    {item.icon}
                  </span>
                  {!isSidebarCollapsed && (
                    <span className={`text-sm font-medium text-left whitespace-nowrap ${!isActive ? "group-hover:text-primary" : "font-semibold"}`}>
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* ── Workload Snapshot (only when expanded) ── */}
          {!isSidebarCollapsed && (
            <div className="px-2 mb-3 space-y-2">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-2 mb-1">
                Today&apos;s Workload
              </p>
              {workload ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">clinical_notes</span>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-on-surface leading-none">{workload.reviewed}</span>
                      <span className="text-[10px] text-on-surface-variant font-medium">Reviewed</span>
                    </div>
                  </div>
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">auto_awesome</span>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-on-surface leading-none">{workload.generated}</span>
                      <span className="text-[10px] text-on-surface-variant font-medium">Generated</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-8 bg-black/5 rounded-xl animate-pulse" />
              )}
            </div>
          )}

          {/* ── Activity Feed (only when expanded) ── */}
          {!isSidebarCollapsed && (
            <div className="px-2 mb-2 flex flex-col min-h-0">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-2 mb-2">
                Recent Activity
              </p>
              <div className="overflow-y-auto custom-scrollbar max-h-40 space-y-1">
                {activity.length === 0 ? (
                  <p className="text-[10px] text-on-surface-variant/50 px-2 py-1">No recent activity</p>
                ) : (
                  activity.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-black/5 transition-colors"
                      title={`${getActionLabel(a.action)} ${a.patient_code} — ${a.note || ""}`}
                    >
                      <span className={`material-symbols-outlined text-sm ${getActionColor(a.action)}`}>
                        {getActionIcon(a.action)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-on-surface font-medium truncate">
                          {getActionLabel(a.action)} <span className="text-primary font-bold">{a.patient_code}</span>
                        </p>
                        <p className="text-[10px] text-on-surface-variant/60">{timeAgo(a.action_at)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Dietitian Profile + Logout ── */}
          <div className="px-2 py-4 border-t border-black/5 mt-auto shrink-0">
            <div className={`flex items-center gap-3 mb-4 ${isSidebarCollapsed ? "justify-center" : ""}`}>
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 p-0.5 overflow-hidden flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary">person</span>
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-bold text-on-surface whitespace-nowrap">Dietitian</span>
                  <span className="text-[10px] text-primary uppercase tracking-widest font-bold whitespace-nowrap">ON DUTY</span>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 px-4 py-3 text-on-surface-variant hover:text-error transition-colors text-sm font-bold rounded-lg hover:bg-error/5 ${
                isSidebarCollapsed ? "justify-center w-full" : "w-full justify-center"
              }`}
              title="Logout"
            >
              <span className="material-symbols-outlined">logout</span>
              {!isSidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════════════════════════════ */}
      <main className={`${mainMargin} min-h-screen relative flex flex-col transition-all duration-300`}>
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-8 bg-white/80 backdrop-blur-2xl border-b border-black/5">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-on-surface">Dietitian Dashboard</h1>
              <button
                onClick={() => setIsSidebarCollapsed((v) => !v)}
                className="p-1 rounded-lg text-on-surface-variant hover:bg-black/5 hover:text-on-surface transition-colors flex items-center justify-center cursor-pointer text-gray-500"
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <span className="material-symbols-outlined text-[20px] select-none">
                  {isSidebarCollapsed ? "menu" : "menu_open"}
                </span>
              </button>
            </div>
            {/* Search bar */}
            <div className="relative w-96 flex items-center group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
              <input
                className="w-full bg-black/5 border border-black/10 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all text-on-surface placeholder:text-on-surface-variant/50"
                placeholder="Search patient ID or name"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 border border-black/10">
              <span className={`connection-status connection-status--${connectionStatus}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                {connectionStatus === "online" ? "Online" : connectionStatus === "offline" ? "Offline" : "Syncing"}
              </span>
            </div>
            <button
              onClick={() => navigate("/dietitian/patients")}
              className="action-button-gradient flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold shadow-lg"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              <span>Add Patient</span>
            </button>
          </div>
        </header>

        <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          {/* Error Banner */}
          {error && (
            <div className="liquid-glass-panel px-6 py-4 rounded-xl flex items-center gap-3 border-l-4 border-l-error">
              <span className="material-symbols-outlined text-error text-lg">error</span>
              <span className="text-sm text-on-surface">{error}</span>
              <button
                onClick={() => window.location.reload()}
                className="ml-auto text-xs font-bold text-primary uppercase tracking-widest hover:underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {statCardsConfig.map((card) => {
              const isActive = activeFilter === card.status;
              return (
                <div
                  key={card.label}
                  onClick={() => setActiveFilter((prev) => (prev === card.status ? "all" : card.status))}
                  className={`liquid-glass-panel p-6 rounded-2xl group cursor-pointer border-t-2 transition-all duration-300 ${
                    isActive
                      ? "ring-2 ring-primary bg-primary/[0.03] scale-[1.02] shadow-md border-t-primary"
                      : `${card.accent} hover:scale-[1.01]`
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className={`material-symbols-outlined ${card.iconColor}`}>{card.icon}</span>
                    <span className={`text-[10px] font-bold tracking-widest uppercase ${card.labelColor}`}>{card.label}</span>
                  </div>
                  <div className="text-3xl font-bold text-on-surface mb-1 metric-value">{summary[card.key]}</div>
                  <div className="text-xs text-on-surface-variant font-medium">{card.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Patients Table */}
          <div className="liquid-glass-panel rounded-3xl overflow-hidden flex flex-col h-[600px]">
            <div className="p-8 border-b border-black/5 flex items-center justify-between bg-black/5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">recent_actors</span>
                </div>
                <h2 className="text-xl font-bold text-on-surface">Priority Clinical Review</h2>
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                {filteredAndSortedPatients.length} patients
              </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="flex items-center justify-center h-full gap-3 text-on-surface-variant">
                  <div className="spinner" />
                  <span className="text-sm">Loading patients...</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-black/5">
                    <tr>
                      {[
                        { key: "id" as const, label: "Patient ID" },
                        { key: "name" as const, label: "Clinical Profile" },
                        { key: "ward" as const, label: "Ward" },
                        { key: "tags" as const, label: "Constraints" },
                        { key: "status" as const, label: "Status" },
                      ].map((col) => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest cursor-pointer hover:text-primary transition-colors select-none"
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                            {sortConfig?.key === col.key && (
                              <span className="material-symbols-outlined text-xs">
                                {sortConfig.direction === "asc" ? "arrow_upward" : "arrow_downward"}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {filteredAndSortedPatients.map((patient) => (
                      <tr
                        key={patient.id}
                        className={`transition-colors group hover:bg-primary/5 ${
                          patient.status === "needs_dietitian_action" ? "bg-error/5" : ""
                        }`}
                      >
                        <td className={`px-8 py-6 font-mono text-sm font-bold ${patient.status === "needs_dietitian_action" ? "text-error" : "text-primary"}`}>
                          #{patient.id}
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-sm font-bold text-on-surface">{patient.name}</div>
                          <div className="text-[11px] text-on-surface-variant font-medium">
                            {patient.age} Yrs • {patient.gender}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-sm text-on-surface-variant">
                          {patient.department} <span className="text-black/20">/</span> {patient.ward}
                        </td>
                        <td className="px-8 py-6">
                          {patient.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {patient.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-[9px] font-bold uppercase text-primary">
                                  {tag}
                                </span>
                              ))}
                              {patient.tags.length > 3 && (
                                <span className="px-2 py-0.5 text-[9px] text-on-surface-variant">+{patient.tags.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-on-surface-variant/50">—</span>
                          )}
                        </td>
                        <td className="px-8 py-6">{renderStatusBadge(patient.status)}</td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {renderActionButton(patient)}
                            <button
                              onClick={() => handleDeletePatient(patient)}
                              title="Delete patient"
                              className="p-2 rounded-full text-on-surface-variant/40 hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAndSortedPatients.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={6} className="px-8 py-12 text-center text-on-surface-variant text-sm">
                          {searchQuery || activeFilter !== "all"
                            ? `No patients match the current filter.`
                            : "No patients found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
