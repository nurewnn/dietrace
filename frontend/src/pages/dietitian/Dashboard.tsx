import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:8000";

type ReviewStatus = "pending" | "approved" | "high_alert" | "unknown";

interface PatientReviewRow {
  id: string;
  name: string;
  age: number;
  gender: string;
  department: string;
  ward: string;
  tags: string[];
  status: ReviewStatus;
}

const mockPatients: PatientReviewRow[] = [
  {
    id: "DX-9821",
    name: "Arthur P. Vance",
    age: 64,
    gender: "Male",
    department: "Cardiology",
    ward: "B-12",
    tags: ["HYPERTENSION", "SODIUM-RESTRICTED"],
    status: "pending",
  },
  {
    id: "DX-1044",
    name: "Linda S. Morrison",
    age: 72,
    gender: "Female",
    department: "Neurology",
    ward: "A-04",
    tags: ["DYSPHAGIA L2", "DIABETES T2"],
    status: "approved",
  },
  {
    id: "DX-7729",
    name: "Marcus J. Wu",
    age: 45,
    gender: "Male",
    department: "ICU",
    ward: "C-01",
    tags: ["CRITICAL CARE", "TOTAL PARENTERAL"],
    status: "high_alert",
  },
];

// TODO: once teammate's /patients endpoint is live, confirm actual field names
// from the response and adjust this mapping. Currently guessing based on the
// patients table schema in the blueprint: id, patient_code, full_name, age, gender, ward.
// Tags/status are NOT in plain /patients — those need health_profile + latest
// recommendation joined in, which may need a different endpoint entirely.
function mapApiPatientToRow(apiPatient: any): PatientReviewRow {
  return {
    id: apiPatient.patient_code ?? apiPatient.id ?? "UNKNOWN",
    name: apiPatient.full_name ?? "Unknown Patient",
    age: apiPatient.age ?? 0,
    gender: apiPatient.gender ?? "—",
    department: apiPatient.ward ?? "—",
    ward: apiPatient.ward ?? "—",
    tags: [], // not available from base /patients — needs health_profile join
    status: "unknown", // not available from base /patients — needs recommendations join
  };
}

const navItems = [
  { icon: "dashboard", label: "Dashboard", route: "/dietitian/dashboard" },
  { icon: "analytics", label: "Patient Analysis", route: null },
  { icon: "rule", label: "Dietary Logic", route: null },
  { icon: "database", label: "Menu Database", route: null },
  { icon: "monitoring", label: "System Health", route: null },
  { icon: "settings", label: "Settings", route: null },
];

const statCards = [
  { icon: "groups", label: "TOTAL", value: "1,482", sub: "Patients Active", accent: "border-t-white/20", iconColor: "text-white", labelColor: "text-white/40" },
  { icon: "pending_actions", label: "PENDING", value: "24", sub: "Review Required", accent: "border-t-warning", iconColor: "text-warning", labelColor: "text-warning" },
  { icon: "verified", label: "APPROVED", value: "912", sub: "Clinical Validated", accent: "border-t-success", iconColor: "text-success", labelColor: "text-success" },
  { icon: "edit_note", label: "MODIFIED", value: "156", sub: "Custom Adjusts", accent: "border-t-info", iconColor: "text-info", labelColor: "text-info" },
  { icon: "cancel", label: "REJECTED", value: "12", sub: "Flagged Safety", accent: "border-t-red-500", iconColor: "text-red-500", labelColor: "text-red-500" },
  { icon: "warning", label: "ALERTS", value: "03", sub: "Safety Violations", accent: "border-t-red-400", iconColor: "text-red-400 animate-pulse", labelColor: "text-red-400" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState<PatientReviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    async function loadPatients() {
      try {
        const token = localStorage.getItem("dietrace_token");
        const res = await fetch(`${API_BASE_URL}/patients`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) throw new Error(`Endpoint returned ${res.status}`);

        const data = await res.json();
        const mapped = Array.isArray(data) ? data.map(mapApiPatientToRow) : [];
        setPatients(mapped);
        setUsingMockData(false);
      } catch (err) {
        console.warn("GET /patients not available yet, showing demo data:", err);
        setPatients(mockPatients);
        setUsingMockData(true);
      } finally {
        setIsLoading(false);
      }
    }
    loadPatients();
  }, []);

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

  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  const renderStatusBadge = (status: ReviewStatus) => {
    if (status === "pending") {
      return (
        <span className="text-warning text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-warning/20 border border-warning/30 rounded-full whitespace-nowrap">
          Pending Review
        </span>
      );
    }
    if (status === "approved") {
      return (
        <span className="text-success text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-success/20 border border-success/30 rounded-full whitespace-nowrap">
          Approved
        </span>
      );
    }
    if (status === "high_alert") {
      return (
        <span className="text-red-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-red-400/20 border border-red-400/40 rounded-full flex items-center gap-1 w-fit whitespace-nowrap">
          <span className="material-symbols-outlined text-[12px] whitespace-nowrap">error</span>
          High Alert
        </span>
      );
    }
    return (
      <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-white/5 border border-white/10 rounded-full whitespace-nowrap">
        Awaiting Data
      </span>
    );
  };

  const renderActionButton = (patient: PatientReviewRow) => {
    if (patient.status === "high_alert") {
      return (
        <button
          onClick={() => navigate(`/dietitian/patients/${patient.id}`)}
          className="px-5 py-2 bg-red-500 text-white rounded-full text-xs font-bold hover:scale-105 transition-transform shadow-lg shadow-red-500/20"
        >
          Emergency Review
        </button>
      );
    }
    if (patient.status === "approved") {
      return (
        <button
          onClick={() => navigate(`/dietitian/patients/${patient.id}`)}
          className="px-5 py-2 border border-white/20 text-white rounded-full text-xs font-bold hover:bg-white/10 transition-all"
        >
          Details
        </button>
      );
    }
    return (
      <button
        onClick={() => navigate(`/dietitian/patients/${patient.id}`)}
        className="px-5 py-2 bg-white text-[#0e0e0e] rounded-full text-xs font-bold shadow-lg shadow-white/5 hover:scale-105 transition-transform"
      >
        Review
      </button>
    );
  };

  return (
    <div ref={wrapperRef} className="dietitian-dashboard-page min-h-screen overflow-x-hidden relative selection:bg-primary selection:text-on-primary">
      <video autoPlay className="video-bg" loop muted playsInline>
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4"
          type="video/mp4"
        />
      </video>

      <aside className="fixed left-0 top-0 h-full z-40 flex flex-col p-2 w-64 bg-[#07110F]/80 backdrop-blur-xl border-r border-white/5 shadow-2xl">
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-4 py-8 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent-teal flex items-center justify-center text-[#101A18]">
              <span className="material-symbols-outlined text-headline-sm">monitor_heart</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-white tracking-tight">Dietrace</span>
              <span className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold">Expert System</span>
            </div>
          </div>

          <nav className="flex-1 px-2 space-y-2 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => {
              const isActive = item.label === "Dashboard";
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => item.route && navigate(item.route)}
                  disabled={!item.route}
                  title={item.route ? undefined : "Coming soon"}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg group transition-all duration-300 ${
                    isActive ? "bg-accent-teal text-[#101A18] shadow-lg" : "text-on-surface-variant hover:bg-white/5"
                  } ${!item.route ? "cursor-default" : ""}`}
                >
                  <span className={`material-symbols-outlined ${!isActive ? "group-hover:text-accent-teal" : ""}`}>
                    {item.icon}
                  </span>
                  <span className={`text-sm font-medium text-left ${!isActive ? "group-hover:text-accent-teal" : "font-semibold"}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="px-4 py-6 border-t border-white/5 mt-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full border border-accent-teal/20 p-0.5 overflow-hidden">
                <img
                  alt="Dietitian profile"
                  className="w-full h-full object-cover rounded-full"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeKkqJ8OV00qG-RwclT8OwCEwKF_S_P3qm9aq8HEC3F6ytLsgkMvsw46o_Dmy_1XgT4VjOYomHJYz04m8cfK3RdGzMozuSsewOSSpNi6CmGkL9QicWV3dMaIiiAd2nU4fVfTvY8U8WNblaYkh-UUSdlO4Gc6OgA4ssFac40Jsh0AStayc8Bn8URwMH8mUEsVvRkG61ov-2z15v5SS0wG1vUUVNMhzGTH4RcclJ2Gi54hpya94jXRk7njnXLcFH7mp-RakINrik7F5J"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Leon S. Kennedy</span>
                <span className="text-[10px] text-accent-teal/70 uppercase tracking-widest font-bold">CHIEF DIETITIAN</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-on-surface-variant hover:text-red-400 transition-colors text-sm font-bold"
            >
              <span className="material-symbols-outlined">logout</span>
              <span>Logout System</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="ml-64 min-h-screen relative flex flex-col">
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-8 bg-black/40 backdrop-blur-2xl border-b border-white/10">
          <div className="flex items-center gap-12">
            <h1 className="text-xl font-bold tracking-tight text-white">Dietitian Dashboard</h1>
            <div className="relative w-96 flex items-center gap-4">
              <div className="relative flex-1 group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-accent-teal/50 transition-all text-white placeholder:text-on-surface-variant/50"
                  placeholder="Search patient ID or name"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dietitian/patients")}
              className="action-button-gradient flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold shadow-lg shadow-white/10"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              <span>Add Patient</span>
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </div>
        </header>

        <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          {usingMockData && (
            <div className="liquid-glass-panel px-6 py-3 rounded-xl flex items-center gap-3 border-t-2 border-t-warning">
              <span className="material-symbols-outlined text-warning text-lg">info</span>
              <span className="text-xs text-on-surface-variant">
                Showing demo data — <code className="text-white">/patients</code> endpoint not reachable yet. This will switch automatically once your teammate's route is live.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {statCards.map((card) => (
              <div key={card.label} className={`liquid-glass-panel p-6 rounded-2xl group cursor-pointer border-t-2 ${card.accent}`}>
                <div className="flex justify-between items-start mb-4">
                  <span className={`material-symbols-outlined ${card.iconColor}`}>{card.icon}</span>
                  <span className={`text-[10px] font-bold tracking-widest uppercase ${card.labelColor}`}>{card.label}</span>
                </div>
                <div className="text-3xl font-bold text-white mb-1 metric-value">{card.value}</div>
                <div className="text-xs text-on-surface-variant font-medium">{card.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 liquid-glass-panel rounded-3xl overflow-hidden flex flex-col h-[600px]">
              <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                    <span className="material-symbols-outlined">recent_actors</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">Priority Clinical Review</h2>
                </div>
                <button
                  onClick={() => navigate("/dietitian/patients")}
                  className="text-[10px] font-bold text-accent-teal uppercase tracking-widest hover:underline flex items-center gap-2"
                >
                  <span>View All Records</span>
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full text-on-surface-variant text-sm">
                    Loading patients...
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-black/80 backdrop-blur-md z-10">
                      <tr>
                        <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Patient ID</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Clinical Profile</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Ward</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Constraints</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Status</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredPatients.map((patient) => (
                        <tr
                          key={patient.id}
                          className={`transition-colors group ${
                            patient.status === "high_alert" ? "bg-red-400/5 hover:bg-red-400/10" : "hover:bg-white/5"
                          }`}
                        >
                          <td className={`px-8 py-6 font-mono text-sm font-bold ${patient.status === "high_alert" ? "text-red-400" : "text-accent-teal"}`}>
                            #{patient.id}
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-sm font-bold text-white">{patient.name}</div>
                            <div className="text-[11px] text-on-surface-variant font-medium">
                              {patient.age} Yrs • {patient.gender}
                            </div>
                          </td>
                          <td className="px-8 py-6 text-sm text-on-surface-variant">
                            {patient.department} <span className="text-white/20">/</span> {patient.ward}
                          </td>
                          <td className="px-8 py-6">
                            {patient.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {patient.tags.map((tag) => (
                                  <span key={tag} className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[9px] font-bold uppercase text-white">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-on-surface-variant/50">—</span>
                            )}
                          </td>
                          <td className="px-8 py-6">{renderStatusBadge(patient.status)}</td>
                          <td className="px-8 py-6 text-right">{renderActionButton(patient)}</td>
                        </tr>
                      ))}
                      {filteredPatients.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-8 py-12 text-center text-on-surface-variant text-sm">
                            No patients match "{searchQuery}".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="liquid-glass-panel p-8 rounded-3xl h-[280px] flex flex-col border-t-2 border-t-accent-teal">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[10px] font-bold text-white tracking-widest uppercase opacity-60">Rule Trace Engine</h3>
                  <div className="flex items-center gap-2 bg-accent-teal/20 border border-accent-teal/30 px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 bg-accent-teal rounded-full animate-pulse"></span>
                    <span className="text-[9px] font-bold text-accent-teal uppercase tracking-widest">Live System</span>
                  </div>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
                  <div className="glass-card-nested p-4 rounded-2xl flex gap-4 items-center cursor-pointer hover:bg-white/10 transition-all">
                    <div className="w-1.5 h-10 bg-accent-teal rounded-full shadow-[0_0_10px_rgba(0,242,255,0.4)]"></div>
                    <div className="flex-1">
                      <div className="text-[12px] text-white font-bold tracking-tight">MENU_MATCH_v2.0</div>
                      <div className="text-[10px] text-on-surface-variant font-medium">Validated Protein/Ratio: Patient #DX-1044</div>
                    </div>
                    <span className="material-symbols-outlined text-accent-teal text-lg">check_circle</span>
                  </div>
                  <div className="glass-card-nested p-4 rounded-2xl flex gap-4 items-center cursor-pointer hover:bg-white/10 transition-all">
                    <div className="w-1.5 h-10 bg-red-400 rounded-full shadow-[0_0_10px_rgba(248,113,113,0.4)]"></div>
                    <div className="flex-1">
                      <div className="text-[12px] text-white font-bold tracking-tight">SODIUM_CAP_v1.2</div>
                      <div className="text-[10px] text-red-400 font-medium">Constraint Violation: Threshold Exceeded (#DX-9821)</div>
                    </div>
                    <span className="material-symbols-outlined text-red-400 text-lg">report_problem</span>
                  </div>
                </div>
              </div>

              <div className="liquid-glass-panel p-8 rounded-3xl h-[312px] flex flex-col relative overflow-hidden border-t-2 border-t-white/20">
                <h3 className="text-[10px] font-bold text-white tracking-widest uppercase opacity-60 mb-8">Expert System Analytics</h3>
                <div className="flex-1 space-y-8">
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] text-on-surface-variant font-bold uppercase tracking-widest">Rule Compliance</span>
                      <span className="text-xl text-white font-bold metric-value">98.4%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-accent-teal shadow-[0_0_8px_rgba(0,242,255,0.5)]" style={{ width: "98.4%" }}></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] text-on-surface-variant font-bold uppercase tracking-widest">Automation Accuracy</span>
                      <span className="text-xl text-white font-bold metric-value">92.1%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-white/60" style={{ width: "92.1%" }}></div>
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm text-accent-teal">speed</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white">Core Performance</span>
                  </div>
                  <span className="text-[10px] text-accent-teal font-bold uppercase tracking-widest">Operational</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}