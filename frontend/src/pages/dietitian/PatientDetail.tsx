import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL, checkAuth } from "../../lib/api";

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
  none: "No Preference",
};

const carbLabels: Record<string, string> = {
  white_rice: "White Rice",
  noodle: "Noodle",
  none: "No Preference",
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

function computeBmi(weightKg: number, heightCm: number) {
  if (!weightKg || !heightCm) {
    return { value: "—", category: "Unknown", color: "text-on-surface-variant" };
  }
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  let category = "Normal";
  let color = "text-success";
  if (bmi < 18.5) {
    category = "Underweight";
    color = "text-warning";
  } else if (bmi >= 25.0 && bmi < 30) {
    category = "Overweight";
    color = "text-warning";
  } else if (bmi >= 30) {
    category = "Obese";
    color = "text-error";
  }
  return { value: bmi.toFixed(1), category, color };
}

function getAgeCategory(age: number) {
  if (age < 13) return { label: "Child", color: "text-info" };
  if (age < 18) return { label: "Teenager", color: "text-info" };
  if (age >= 65) return { label: "Elderly", color: "text-warning" };
  return { label: "Adult", color: "text-success" };
}

function deriveEstimatedDiet(data: PatientDetailData) {
  const parts: string[] = [];

  if (data.category === "pregnant") parts.push("Pregnancy Diet (+300-500 kcal)");
  if (data.category === "pre_operation") parts.push("Pre-Op Diet (Low Fibre)");
  if (data.category === "post_operation") parts.push("Recovery Diet (High Protein)");

  if (data.conditions.diabetes && data.conditions.hypertension) {
    parts.push("Diabetic + Low Sodium");
  } else if (data.conditions.diabetes) {
    parts.push("Diabetic Diet");
  } else if (data.conditions.hypertension) {
    parts.push("Low Sodium / DASH");
  }

  if (data.conditions.highCholesterol) parts.push("Low Fat");
  if (data.chewingProblem) parts.push("Soft Texture");
  if (data.vegetarian) parts.push("Vegetarian");
  if (data.allergies.length > 0) parts.push(`Allergy-Restricted (${data.allergies.length})`);

  if (parts.length === 0) return "Standard Balanced Diet";
  return parts.join(" + ");
}

function deriveCalorieEstimate(data: PatientDetailData) {
  // TODO: This duplicates backend inference logic. Consider fetching from API instead.
  let factor = 30;
  const bmi = parseFloat(computeBmi(data.weightKg, data.heightCm).value);

  if (bmi >= 25) factor = data.activityLevel === "sedentary" ? 20 : data.activityLevel === "moderate" ? 22 : 25;
  else if (bmi < 18.5) factor = data.activityLevel === "sedentary" ? 35 : data.activityLevel === "moderate" ? 40 : 45;
  else factor = data.activityLevel === "sedentary" ? 30 : data.activityLevel === "moderate" ? 35 : 40;

  let base = data.weightKg * factor;
  const ageCat = getAgeCategory(data.age);
  if (ageCat.label === "Child") base *= 0.8;
  else if (ageCat.label === "Teenager") base *= 0.9;

  let adjustment = 0;
  if (data.category === "pregnant") adjustment = 350;
  else if (data.category === "pre_operation") adjustment = -200;
  else if (data.category === "post_operation") adjustment = 200;

  return Math.round(base + adjustment);
}

export default function PatientDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<PatientDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [generateError, setGenerateError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [menuDate, setMenuDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    async function loadPatient() {
      setIsLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("dietrace_token");
        const res = await fetch(`${API_URL}/patients/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!checkAuth(res, navigate)) return;
        if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
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
            highCholesterol: api.health_profile?.has_high_cholesterol ?? false,
          },
          allergies: Array.isArray(api.health_profile?.allergies) ? api.health_profile.allergies : [],
          activityLevel: api.health_profile?.activity_level ?? "sedentary",
          vegetarian: api.health_profile?.is_vegetarian ?? false,
          chewingProblem: api.health_profile?.has_chewing_problem ?? false,
          smokes: api.health_profile?.smokes ?? false,
          sleepPattern: api.health_profile?.sleep_pattern ?? "normal",
          preference: {
            protein: api.health_profile?.preferred_protein ?? "none",
            carbohydrate: api.health_profile?.preferred_carbohydrate ?? "none",
          },
          notes: api.health_profile?.notes ?? "",
        });
      } catch (err: any) {
        setError(err.message || "Failed to load patient record.");
      } finally {
        setIsLoading(false);
      }
    }
    loadPatient();
  }, [id]);

  if (isLoading) {
    return (
      <div className="patient-detail-page min-h-screen flex items-center justify-center gap-3 text-on-surface-variant">
        <div className="spinner" />
        <span className="text-sm">Loading patient record...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="patient-detail-page min-h-screen flex flex-col items-center justify-center gap-4 text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl text-error">error</span>
        <p className="text-lg">{error}</p>
        <button
          onClick={() => navigate("/dietitian/dashboard")}
          className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!data) return null;

  const bmi = computeBmi(data.weightKg, data.heightCm);
  const ageCat = getAgeCategory(data.age);
  const estimatedDiet = deriveEstimatedDiet(data);
  const estimatedCalories = deriveCalorieEstimate(data);

  const handleGenerateRecommendation = async () => {
    if (!id) return;
    setGenerateError("");
    setIsGenerating(true);
    try {
      const token = localStorage.getItem("dietrace_token");
      const res = await fetch(
        `${API_URL}/recommendations/generate/${encodeURIComponent(id)}?date=${menuDate}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Generate failed (${res.status})`);
      }
      const recommendation = await res.json();
      navigate(`/dietitian/recommendation/${recommendation.id}`);
    } catch (err: any) {
      setGenerateError(err.message || "Failed to generate recommendation.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="patient-detail-page font-body-md text-body-md antialiased min-h-screen relative overflow-x-hidden">
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{ background: "linear-gradient(135deg, #f8faf8 100%, #ffffff 0%)" }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="w-full h-20 sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-black/5 flex justify-between items-center px-margin-desktop">
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
            <h1 className="font-bold text-xl tracking-[0.2em] text-on-surface uppercase leading-none">dietrace</h1>
          </div>
          <div className="flex-1 flex justify-end items-center gap-6">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <button title="Coming soon" className="material-symbols-outlined p-2 rounded-full opacity-40 cursor-default">notifications</button>
              <button title="Coming soon" className="material-symbols-outlined p-2 rounded-full opacity-40 cursor-default">settings</button>
            </div>
            <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/5 border border-black/10 hover:border-primary/30 transition-all cursor-pointer group">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary group-hover:scale-105 transition-transform">DR</div>
              <span className="text-label-md font-medium">Account</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-margin-desktop py-12 max-w-7xl mx-auto w-full">
          <div className="mb-10 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-caption-bold text-caption-bold text-primary uppercase tracking-widest">Expert Clinical Review</span>
            </div>
            <h1 className="font-headline-md text-4xl text-on-surface mb-2">Patient Details</h1>
            <p className="font-body-md text-on-surface-variant max-w-2xl">Comprehensive clinical health profile for {data.fullName}.</p>
          </div>

          {generateError && (
            <div className="liquid-glass px-6 py-4 rounded-xl flex items-center gap-3 border-l-4 border-l-error mb-8">
              <span className="material-symbols-outlined text-error text-lg">error</span>
              <span className="text-sm text-on-surface">{generateError}</span>
              <button onClick={() => setGenerateError("")} className="ml-auto text-xs text-on-surface-variant hover:text-on-surface">Dismiss</button>
            </div>
          )}

          {/* Clinical Intelligence Summary Card */}
          <div className="liquid-glass rounded-3xl p-8 mb-8 border-l-4 border-l-primary">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-primary">analytics</span>
              <h3 className="text-xl font-semibold text-on-surface">Clinical Intelligence Summary</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 text-center">
                <p className="text-[10px] uppercase text-primary font-bold mb-2 tracking-widest">BMI</p>
                <p className={`text-3xl font-bold ${bmi.color}`}>{bmi.value}</p>
                <p className={`text-xs font-medium mt-1 ${bmi.color}`}>{bmi.category}</p>
              </div>
              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 text-center">
                <p className="text-[10px] uppercase text-primary font-bold mb-2 tracking-widest">Age Category</p>
                <p className={`text-2xl font-bold ${ageCat.color}`}>{ageCat.label}</p>
                <p className="text-xs text-on-surface-variant mt-1">{data.age} years old</p>
              </div>
              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 text-center">
                <p className="text-[10px] uppercase text-primary font-bold mb-2 tracking-widest">Est. Daily Calories</p>
                <p className="text-2xl font-bold text-on-surface">{estimatedCalories}</p>
                <p className="text-xs text-on-surface-variant mt-1">kcal / day</p>
              </div>
              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 text-center">
                <p className="text-[10px] uppercase text-primary font-bold mb-2 tracking-widest">Estimated Diet</p>
                <p className="text-sm font-bold text-on-surface leading-tight">{estimatedDiet}</p>
              </div>
            </div>
            <p className="text-[10px] text-on-surface-variant/60 italic mt-4">
              Values calculated using the rule-based inference engine (R1-R30). Official targets are produced during recommendation generation.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Identity & Biometrics */}
            <div className="col-span-12 lg:col-span-8 liquid-glass rounded-3xl p-8 flex flex-col gap-8">
              <div className="flex items-center justify-between border-b border-black/5 pb-6">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">fingerprint</span>
                  <h3 className="text-xl font-semibold text-on-surface">Patient Identity &amp; Biometrics</h3>
                </div>
                <span className="px-3 py-1 bg-primary/10 rounded-full font-caption-bold text-[10px] text-primary uppercase tracking-widest">Active Profile</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest">Full Legal Name</p>
                  <p className="text-lg font-medium text-on-surface">{data.fullName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest">Patient ID</p>
                  <p className="text-lg font-medium text-primary">#{data.patientCode}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest">Age / Gender</p>
                  <p className="text-lg font-medium text-on-surface">{data.age}Y / {data.gender}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest">Admission Date</p>
                  <p className="text-lg font-medium text-on-surface">{data.admissionDate || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-black/5">
                <div className="bg-black/5 p-4 rounded-2xl border border-black/5 text-center">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2">Weight</p>
                  <p className="text-2xl font-bold text-on-surface">{data.weightKg} <span className="text-sm font-normal text-on-surface-variant">kg</span></p>
                </div>
                <div className="bg-black/5 p-4 rounded-2xl border border-black/5 text-center">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2">Height</p>
                  <p className="text-2xl font-bold text-on-surface">{data.heightCm} <span className="text-sm font-normal text-on-surface-variant">cm</span></p>
                </div>
                <div className="bg-black/5 p-4 rounded-2xl border border-black/5 text-center">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2">BMI <span className="opacity-50">(ref.)</span></p>
                  <p className="text-2xl font-bold text-on-surface">{bmi.value}</p>
                </div>
                <div className="bg-black/5 p-4 rounded-2xl border border-black/5 text-center">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2">BMI Category</p>
                  <p className={`text-lg font-bold uppercase tracking-tighter ${bmi.color}`}>{bmi.category}</p>
                </div>
              </div>
            </div>

            {/* Category */}
            <div className="col-span-12 lg:col-span-4 liquid-glass rounded-3xl p-8 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">category</span>
                <h3 className="text-xl font-semibold text-on-surface">Patient Category</h3>
              </div>
              <div className="space-y-6">
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase text-primary font-bold mb-1 tracking-widest">Status Category</p>
                  <p className="text-xl font-bold text-on-surface capitalize">{data.category.replace(/_/g, " ")}</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between items-center p-3 rounded-xl bg-black/5 border border-black/5">
                    <span className="text-sm text-on-surface-variant uppercase font-bold tracking-widest">Ward Unit</span>
                    <span className="text-on-surface font-medium">{data.ward || "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Medical Profile */}
            <div className="col-span-12 lg:col-span-5 liquid-glass rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-8">
                <span className="material-symbols-outlined text-primary">clinical_notes</span>
                <h3 className="text-xl font-semibold text-on-surface">Medical Profile</h3>
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
                          c.active ? "bg-primary/5 border-primary/10" : "bg-black/[0.02] border-black/5 opacity-50"
                        }`}
                      >
                        <span className="text-sm font-medium">{c.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.active ? "bg-primary/10 text-primary" : "text-on-surface-variant"
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
                          className="px-4 py-1.5 bg-error/10 text-error rounded-full text-xs font-bold uppercase tracking-widest border border-error/20"
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
                  <span className="material-symbols-outlined text-primary">fitness_center</span>
                  <h3 className="text-lg font-semibold text-on-surface">Lifestyle Facts</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-3.5 bg-black/5 rounded-xl border border-black/5">
                    <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-1">Activity Level</p>
                    <p className="text-sm font-medium capitalize">{data.activityLevel}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-black/5 rounded-xl border border-black/5 flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold">Vegetarian</span>
                      <span className="text-sm font-medium">{data.vegetarian ? "Yes" : "No"}</span>
                    </div>
                    <div className="p-3 bg-black/5 rounded-xl border border-black/5 flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold">Chewing Problem</span>
                      <span className="text-sm font-medium">{data.chewingProblem ? "Yes" : "No"}</span>
                    </div>
                    <div className="p-3 bg-black/5 rounded-xl border border-black/5 flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold">Smoker</span>
                      <span className="text-sm font-medium">{data.smokes ? "Yes" : "No"}</span>
                    </div>
                    <div className="p-3 bg-black/5 rounded-xl border border-black/5 flex flex-col">
                      <span className="text-[10px] text-on-surface-variant uppercase font-bold">Sleep Pattern</span>
                      <span className="text-sm font-medium capitalize">{data.sleepPattern}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nutritional Targets Card */}
              <div className="liquid-glass rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  <h3 className="text-lg font-semibold text-on-surface">Nutritional Targets</h3>
                </div>
                <div className="space-y-6">
                  <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                    <p className="text-[10px] uppercase text-primary font-bold mb-2 tracking-widest">Estimated Daily Target</p>
                    <p className="text-3xl font-bold text-on-surface">{estimatedCalories} <span className="text-lg font-normal text-on-surface-variant">kcal</span></p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-black/5 border border-black/5">
                      <span className="text-xs font-medium">Breakfast (25%)</span>
                      <span className="font-bold text-primary">{Math.round(estimatedCalories * 0.25)} kcal</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-black/5 border border-black/5">
                      <span className="text-xs font-medium">Lunch (40%)</span>
                      <span className="font-bold text-primary">{Math.round(estimatedCalories * 0.4)} kcal</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-black/5 border border-black/5">
                      <span className="text-xs font-medium">Dinner (35%)</span>
                      <span className="font-bold text-primary">{Math.round(estimatedCalories * 0.35)} kcal</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preferences + Notes */}
            <div className="col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="liquid-glass rounded-3xl p-8">
                <h3 className="text-lg font-semibold text-on-surface flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-primary">favorite</span>
                  Preferences
                </h3>
                <div className="space-y-4">
                  <div className="bg-black/5 p-4 rounded-2xl border border-black/5">
                    <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Protein</p>
                    <p className="text-sm font-medium text-on-surface">{proteinLabels[data.preference.protein] ?? data.preference.protein}</p>
                  </div>
                  <div className="bg-black/5 p-4 rounded-2xl border border-black/5">
                    <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Carbohydrate</p>
                    <p className="text-sm font-medium text-on-surface">{carbLabels[data.preference.carbohydrate] ?? data.preference.carbohydrate}</p>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2 liquid-glass rounded-3xl p-8">
                <h3 className="text-lg font-semibold text-on-surface flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-primary">description</span>
                  Clinical Observations
                </h3>
                <div className="bg-black/5 p-6 rounded-2xl border border-black/5 min-h-[140px] relative">
                  <p className="font-body-md text-on-surface leading-relaxed italic opacity-90 text-sm">
                    {data.notes || "No clinical notes recorded yet."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-12 flex justify-between items-center animate-fade-in">
            <button
              onClick={() => navigate("/dietitian/dashboard")}
              className="px-8 py-3.5 bg-black/5 border border-black/10 rounded-xl text-on-surface-variant font-medium text-sm hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Dashboard
            </button>
            <div className="flex flex-wrap justify-end gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-black/5 border border-black/10 rounded-xl">
                <span className="material-symbols-outlined text-primary text-base">calendar_today</span>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Menu Date</label>
                  <input
                    type="date"
                    value={menuDate}
                    onChange={(e) => setMenuDate(e.target.value)}
                    className="bg-transparent text-sm text-on-surface focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={() => window.print()}
                className="px-8 py-3.5 bg-black/5 border border-black/10 rounded-xl text-on-surface font-medium text-sm hover:bg-black/10 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Print Record
              </button>
              <button
                onClick={handleGenerateRecommendation}
                disabled={isGenerating}
                className="px-8 py-3.5 bg-primary/10 border border-primary/20 rounded-xl text-primary font-bold text-sm hover:bg-primary/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                {isGenerating ? "Generating..." : "Generate Recommendation"}
              </button>
              <button
                onClick={() => navigate(`/dietitian/patients/${id}/edit`)}
                className="px-12 py-3.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                Edit Profile
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
