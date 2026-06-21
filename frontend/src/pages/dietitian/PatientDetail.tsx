import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE_URL = "http://localhost:8000";

const allergyLabels: Record<string, string> = {
  seafood: "Seafood",
  nut: "Peanut",
  dairy: "Dairy",
  egg: "Egg",
  gluten: "Gluten",
};

const proteinLabels: Record<string, string> = {
  chicken: "Chicken",
  fish: "Fish",
  egg: "Egg",
  tofu: "Tofu",
  no_preference: "No Preference",
};

const carbLabels: Record<string, string> = {
  white_rice: "White Rice",
  noodle: "Noodle",
  no_preference: "No Preference",
};

interface PatientDetailData {
  fullName: string;
  patientCode: string;
  age: number;
  gender: string;
  admissionDate: string;
  ward: string;
  weightKg: number;
  heightCm: number;
  category: string;
  conditions: { diabetes: boolean; hypertension: boolean; highCholesterol: boolean };
  allergies: string[];
  activityLevel: string;
  vegetarian: boolean;
  chewingProblem: boolean;
  smokes: boolean;
  sleepPattern: string;
  preference: { protein: string; carbohydrate: string };
  notes: string;
}

const mockPatient: PatientDetailData = {
  fullName: "Elena Maria Rodriguez",
  patientCode: "DX-8829-C",
  age: 42,
  gender: "Female",
  admissionDate: "Oct 14, 2023",
  ward: "Cardiac B - 402",
  weightKg: 68.5,
  heightCm: 164,
  category: "normal",
  conditions: { diabetes: true, hypertension: true, highCholesterol: false },
  allergies: ["seafood", "nut"],
  activityLevel: "moderate",
  vegetarian: false,
  chewingProblem: false,
  smokes: false,
  sleepPattern: "normal",
  preference: { protein: "chicken", carbohydrate: "white_rice" },
  notes:
    "Patient presents with stable vitals post-admission. BMI indicates overweight status but manageable through caloric restriction and low glycemic index meal planning. Previous history of seafood allergy is critical for menu generation. Recommending a focused Mediterranean-style diet with emphasis on lean poultry and plant-based proteins to manage hypertension and metabolic markers.",
};

function computeBmi(weightKg: number, heightCm: number) {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  let category = "Normal";
  if (bmi < 18.5) category = "Underweight";
  else if (bmi >= 25.0) category = "Overweight";
  return { value: bmi.toFixed(1), category };
}

export default function PatientDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<PatientDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    async function loadPatient() {
      try {
        const token = localStorage.getItem("dietrace_token");
        const res = await fetch(`${API_BASE_URL}/patients/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Endpoint returned ${res.status}`);
        const api = await res.json();
        setData({
          fullName: api.full_name,
          patientCode: api.patient_code,
          age: api.age,
          gender: api.gender,
          admissionDate: api.admission_date,
          ward: api.ward,
          weightKg: api.health_profile?.weight_kg ?? 0,
          heightCm: api.health_profile?.height_cm ?? 0,
          category: api.health_profile?.patient_category ?? "normal",
          conditions: {
            diabetes: api.health_profile?.has_diabetes ?? false,
            hypertension: api.health_profile?.has_hypertension ?? false,
            highCholesterol: api.health_profile?.has_hypercholesterolemia ?? false,
          },
          allergies: (api.health_profile?.allergies ?? "")
            .split(",")
            .map((a: string) => a.trim())
            .filter(Boolean),
          activityLevel: api.health_profile?.activity_level ?? "sedentary",
          vegetarian: api.health_profile?.is_vegetarian ?? false,
          chewingProblem: api.health_profile?.has_chewing_problem ?? false,
          smokes: api.health_profile?.smokes ?? false,
          sleepPattern: api.health_profile?.sleep_pattern ?? "normal",
          preference: api.health_profile?.food_preference ?? { protein: "no_preference", carbohydrate: "no_preference" },
          notes: api.health_profile?.notes ?? "",
        });
        setUsingMockData(false);
      } catch (err) {
        console.warn("GET /patients/:id not available yet, showing demo data:", err);
        setData(mockPatient);
        setUsingMockData(true);
      } finally {
        setIsLoading(false);
      }
    }
    loadPatient();
  }, [id]);

  if (isLoading) {
    return (
      <div className="patient-detail-page min-h-screen flex items-center justify-center text-on-surface-variant text-sm">
        Loading patient record...
      </div>
    );
  }
  if (!data) return null;

  const bmi = computeBmi(data.weightKg, data.heightCm);

  return (
    <div className="patient-detail-page font-body-md text-body-md antialiased min-h-screen relative overflow-x-hidden">
      <video autoPlay className="video-bg" loop muted playsInline>
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4"
          type="video/mp4"
        />
      </video>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="w-full h-20 sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/10 flex justify-between items-center px-margin-desktop">
          <div className="flex-1 flex justify-start">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group"
            >
              <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
              <span className="text-label-md font-medium uppercase tracking-widest">Back</span>
            </button>
          </div>
          <div className="flex-1 flex justify-center">
            <h1 className="font-bold text-xl tracking-[0.2em] text-white uppercase leading-none">dietrace</h1>
          </div>
          <div className="flex-1 flex justify-end items-center gap-6">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <button title="Coming soon" className="material-symbols-outlined p-2 rounded-full opacity-40 cursor-default">notifications</button>
              <button title="Coming soon" className="material-symbols-outlined p-2 rounded-full opacity-40 cursor-default">settings</button>
            </div>
            <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer group">
              <div className="w-8 h-8 rounded-full bg-sage flex items-center justify-center text-xs font-bold text-background group-hover:scale-105 transition-transform">DR</div>
              <span className="text-label-md font-medium">Account</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-margin-desktop py-12 max-w-7xl mx-auto w-full">
          <div className="mb-10 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-accent-teal animate-pulse"></span>
              <span className="font-caption-bold text-caption-bold text-accent-teal uppercase tracking-widest">Expert Clinical Review</span>
            </div>
            <h1 className="font-headline-md text-4xl text-primary mb-2">Patient Details</h1>
            <p className="font-body-md text-on-surface-variant max-w-2xl">Comprehensive clinical health profile for {data.fullName}.</p>
          </div>

          {usingMockData && (
            <div className="liquid-glass px-6 py-3 rounded-xl flex items-center gap-3 mb-8 border-l-4 border-l-amber-400/60">
              <span className="material-symbols-outlined text-amber-400 text-lg">info</span>
              <span className="text-xs text-on-surface-variant">
                Showing demo data — <code className="text-white">GET /patients/{"{id}"}</code> not reachable yet.
              </span>
            </div>
          )}

          <div className="grid grid-cols-12 gap-6">
            {/* Identity & Biometrics */}
            <div className="col-span-12 lg:col-span-8 liquid-glass rounded-3xl p-8 flex flex-col gap-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-accent-teal">fingerprint</span>
                  <h3 className="text-xl font-semibold text-primary">Patient Identity &amp; Biometrics</h3>
                </div>
                <span className="px-3 py-1 bg-white/10 rounded-full font-caption-bold text-[10px] text-accent-teal uppercase tracking-widest">Active Profile</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest">Full Legal Name</p>
                  <p className="text-lg font-medium text-primary">{data.fullName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest">Patient ID</p>
                  <p className="text-lg font-medium text-accent-teal">#{data.patientCode}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest">Age / Gender</p>
                  <p className="text-lg font-medium text-primary">{data.age}Y / {data.gender}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest">Admission Date</p>
                  <p className="text-lg font-medium text-primary">{data.admissionDate}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/5">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2">Weight</p>
                  <p className="text-2xl font-bold text-primary">{data.weightKg} <span className="text-sm font-normal text-on-surface-variant">kg</span></p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2">Height</p>
                  <p className="text-2xl font-bold text-primary">{data.heightCm} <span className="text-sm font-normal text-on-surface-variant">cm</span></p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2">BMI <span className="opacity-50">(ref.)</span></p>
                  <p className="text-2xl font-bold text-primary">{bmi.value}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2">BMI Category</p>
                  <p className="text-lg font-bold text-accent-teal uppercase tracking-tighter">{bmi.category}</p>
                </div>
              </div>
              <p className="text-[10px] text-on-surface-variant/60 italic -mt-2">
                BMI shown here is a quick client-side reference. Official figures will come from the rule-based inference engine once recommendation generation is built.
              </p>
            </div>

            {/* Category */}
            <div className="col-span-12 lg:col-span-4 liquid-glass rounded-3xl p-8 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-accent-teal">category</span>
                <h3 className="text-xl font-semibold text-primary">Patient Category</h3>
              </div>
              <div className="space-y-6">
                <div className="bg-accent-teal/5 border border-accent-teal/20 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase text-accent-teal font-bold mb-1 tracking-widest">Status Category</p>
                  <p className="text-xl font-bold text-primary capitalize">{data.category}</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-sm text-on-surface-variant uppercase font-bold tracking-widest">Ward Unit</span>
                    <span className="text-primary font-medium">{data.ward}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Medical Profile */}
            <div className="col-span-12 lg:col-span-5 liquid-glass rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-8">
                <span className="material-symbols-outlined text-accent-teal">clinical_notes</span>
                <h3 className="text-xl font-semibold text-primary">Medical Profile</h3>
              </div>
              <div className="space-y-8">
                <div>
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-4 tracking-widest">Active Conditions</p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { label: "Diabetes Type II", active: data.conditions.diabetes },
                      { label: "Hypertension", active: data.conditions.hypertension },
                      { label: "High Cholesterol", active: data.conditions.highCholesterol },
                    ].map((c) => (
                      <div
                        key={c.label}
                        className={`flex items-center justify-between p-3.5 rounded-xl border ${
                          c.active ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 opacity-40"
                        }`}
                      >
                        <span className="text-sm font-medium">{c.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.active ? "bg-status-error-container text-on-error-container" : "text-on-surface-variant"
                          }`}
                        >
                          {c.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-4 tracking-widest">Clinical Allergies</p>
                  {data.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {data.allergies.map((a) => (
                        <span
                          key={a}
                          className="px-4 py-1.5 bg-status-error text-on-error rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-status-error/10"
                        >
                          {allergyLabels[a] ?? a}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface-variant">No known allergies recorded.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Lifestyle + Nutrition */}
            <div className="col-span-12 lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lifestyle Card */}
              <div className="liquid-glass rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-accent-teal">fitness_center</span>
                  <h3 className="text-lg font-semibold text-primary">Lifestyle Facts</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-1">Activity Level</p>
                    <p className="text-sm font-medium capitalize">{data.activityLevel}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold">Vegetarian</span>
                      <span className="text-sm font-medium">{data.vegetarian ? "Yes" : "No"}</span>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold">Chewing Problem</span>
                      <span className="text-sm font-medium">{data.chewingProblem ? "Yes" : "No"}</span>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold">Smoker</span>
                      <span className="text-sm font-medium">{data.smokes ? "Yes" : "No"}</span>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold">Sleep Pattern</span>
                      <span className="text-sm font-medium capitalize">{data.sleepPattern}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nutritional Targets Card */}
              <div className="liquid-glass rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-accent-teal">analytics</span>
                  <h3 className="text-lg font-semibold text-primary">Nutritional Targets</h3>
                </div>
                <div className="flex flex-col items-center justify-center text-center h-full py-6 gap-2">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">hourglass_empty</span>
                  <p className="text-sm text-on-surface-variant">Awaiting recommendation generation.</p>
                  <p className="text-[10px] text-on-surface-variant/50">Meal kcal targets are produced by the inference engine.</p>
                </div>
              </div>
            </div>

            {/* Preferences + Notes */}
            <div className="col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="liquid-glass rounded-3xl p-8">
                <h3 className="text-lg font-semibold text-primary flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-accent-teal">favorite</span>
                  Preferences
                </h3>
                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Protein</p>
                    <p className="text-sm font-medium text-primary">{proteinLabels[data.preference.protein] ?? data.preference.protein}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Carbohydrate</p>
                    <p className="text-sm font-medium text-primary">{carbLabels[data.preference.carbohydrate] ?? data.preference.carbohydrate}</p>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2 liquid-glass rounded-3xl p-8">
                <h3 className="text-lg font-semibold text-primary flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-accent-teal">description</span>
                  Clinical Observations
                </h3>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 min-h-[140px] relative">
                  <p className="font-body-md text-on-surface leading-relaxed italic opacity-90 text-sm">
                    {data.notes || "No clinical notes recorded yet."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-12 flex justify-between items-center animate-fade-in-delayed">
            <button
              onClick={() => navigate("/dietitian/dashboard")}
              className="px-8 py-3.5 bg-white/5 border border-white/10 rounded-xl text-on-surface-variant font-medium text-sm hover:text-primary hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Dashboard
            </button>
            <div className="flex gap-4">
              <button
                onClick={() => window.print()}
                className="px-8 py-3.5 bg-white/5 border border-white/10 rounded-xl text-on-surface font-medium text-sm hover:bg-white/10 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Print Record
              </button>
              <button
                onClick={() => navigate(`/dietitian/patients/${id}/edit`)}
                className="px-12 py-3.5 bg-primary text-background rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 shadow-2xl shadow-white/10"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                Edit Profile Information
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}