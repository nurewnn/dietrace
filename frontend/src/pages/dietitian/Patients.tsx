import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { checkAuth, apiFetch } from "../../lib/api";

const allergyOptions = [
  { label: "Seafood", value: "seafood" },
  { label: "Peanut", value: "nut" },
  { label: "Egg", value: "egg" },
  { label: "Milk", value: "dairy" },
  { label: "Wheat", value: "gluten" },
];

const diseaseGuidance: Record<string, { title: string; color: string; bgColor: string; borderColor: string; icon: string; message: string }> = {
  diabetes: {
    title: "Diabetes Guidance",
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/20",
    icon: "medical_services",
    message: "Glycemic control is a priority for this patient. Menu selection is restricted to low-sugar options only; moderate and high-sugar items are excluded to support stable blood glucose levels.",
  },
  hypertension: {
    title: "Hypertension Guidance",
    color: "text-error",
    bgColor: "bg-error/10",
    borderColor: "border-error/20",
    icon: "favorite",
    message: "Blood pressure management requires sodium restriction. Menu selection is limited to low-sodium options only; moderate and high-sodium items are excluded from this patient's plan.",
  },
  highCholesterol: {
    title: "High Cholesterol Guidance",
    color: "text-info",
    bgColor: "bg-info/10",
    borderColor: "border-info/20",
    icon: "monitor_heart",
    message: "Lipid management requires fat intake control. Menu selection is limited to low-fat options only; moderate and high-fat items are excluded to support cardiovascular health.",
  },
};

const activityGuidance: Record<string, { impact: string; description: string }> = {
  sedentary: { impact: "Base calories only", description: "Bed rest or minimal movement. No additional caloric allowance." },
  moderate: { impact: "+10-15% calories", description: "Occasional walking, light duties. Slight increase in energy needs." },
  active: { impact: "+20-25% calories", description: "Regular physical activity or demanding work. Higher energy requirement." },
};

export default function Patients() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  const [patientCode, setPatientCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [ward, setWard] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [dischargeDate, setDischargeDate] = useState("");

  const [diabetes, setDiabetes] = useState(false);
  const [hypertension, setHypertension] = useState(false);
  const [highCholesterol, setHighCholesterol] = useState(false);
  const [noConditions, setNoConditions] = useState(false);

  const [category, setCategory] = useState("normal");
  const [trimester, setTrimester] = useState("");

  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  const [allergies, setAllergies] = useState<string[]>([]);
  const [activityLevel, setActivityLevel] = useState("sedentary");
  const [vegetarian, setVegetarian] = useState(false);
  const [chewingProblem, setChewingProblem] = useState(false);

  const [smokes, setSmokes] = useState(false);
  const [sleepPattern, setSleepPattern] = useState("good");

  const [preferredProtein, setPreferredProtein] = useState("none");
  const [preferredCarb, setPreferredCarb] = useState("none");

  const [notes, setNotes] = useState("");

  const [isLoadingExisting, setIsLoadingExisting] = useState(isEditMode);
  const [error, setError] = useState("");
  const [savedPatientId, setSavedPatientId] = useState<string | null>(id ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  useEffect(() => {
    if (!isEditMode) {
      setIsLoadingExisting(false);
      return;
    }

    async function loadExisting() {
      setIsLoadingExisting(true);
      setError("");
      try {
        const res = await apiFetch(`/patients/${id}`);
        if (!checkAuth(res, navigate)) return;
        if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        const api = await res.json();
        applyPrefill(api);
      } catch (err: any) {
        setError(err.message || "Failed to load patient record.");
      } finally {
        setIsLoadingExisting(false);
      }
    }

    function applyPrefill(api: any) {
      setPatientCode(api.patient_code ?? "");
      setFullName(api.full_name ?? "");
      setAge(String(api.age ?? ""));
      setGender(api.gender ?? "");
      setWard(api.ward ?? "");
      setAdmissionDate(api.admission_date ?? "");
      setDischargeDate(api.discharge_date ?? "");

      const hp = api.health_profile ?? {};
      setDiabetes(hp.has_diabetes ?? false);
      setHypertension(hp.has_hypertension ?? false);
      setHighCholesterol(hp.has_high_cholesterol ?? false);
      setNoConditions(!(hp.has_diabetes || hp.has_hypertension || hp.has_high_cholesterol));
      setCategory(hp.patient_category ?? "normal");
      setTrimester(hp.pregnancy_trimester ? String(hp.pregnancy_trimester) : "");
      setWeight(hp.weight_kg ? String(hp.weight_kg) : "");
      setHeight(hp.height_cm ? String(hp.height_cm) : "");
      setAllergies(Array.isArray(hp.allergies) ? hp.allergies : []);
      setActivityLevel(hp.activity_level ?? "sedentary");
      setVegetarian(hp.is_vegetarian ?? false);
      setChewingProblem(hp.has_chewing_problem ?? false);
      setSmokes(hp.smokes ?? false);
      setSleepPattern(hp.sleep_pattern ?? "good");
      setPreferredProtein(hp.preferred_protein ?? "none");
      setPreferredCarb(hp.preferred_carbohydrate ?? "none");
      setNotes(hp.notes ?? "");
    }

    loadExisting();
  }, [id, isEditMode]);

  const toggleAllergy = (value: string) => {
    setAllergies((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
  };

  const handleConditionChange = (condition: "diabetes" | "hypertension" | "highCholesterol", value: boolean) => {
    if (condition === "diabetes") setDiabetes(value);
    if (condition === "hypertension") setHypertension(value);
    if (condition === "highCholesterol") setHighCholesterol(value);
    if (value) setNoConditions(false);
  };

  const handleNoConditionsChange = (value: boolean) => {
    setNoConditions(value);
    if (value) {
      setDiabetes(false);
      setHypertension(false);
      setHighCholesterol(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitSuccess(false);
    setIsSubmitting(true);

    const patientPayload = {
      patient_code: patientCode.trim(),
      full_name: fullName.trim(),
      age: Number(age),
      gender,
      ward: ward.trim(),
      admission_date: admissionDate,
      discharge_date: dischargeDate,
    };

    const healthProfilePayload = {
      has_diabetes: diabetes,
      has_hypertension: hypertension,
      has_high_cholesterol: highCholesterol,
      allergies,
      preferred_protein: preferredProtein,
      preferred_carbohydrate: preferredCarb,
      activity_level: activityLevel,
      patient_category: category,
      pregnancy_trimester: category === "pregnant" ? Number(trimester) : null,
      is_vegetarian: vegetarian,
      has_chewing_problem: chewingProblem,
      smokes,
      sleep_pattern: sleepPattern,
      weight_kg: Number(weight),
      height_cm: Number(height),
      notes: notes.trim() || null,
    };

    try {
      const patientUrl = isEditMode ? `/patients/${id}` : "/patients";
      const patientRes = await apiFetch(patientUrl, {
        method: isEditMode ? "PUT" : "POST",
        body: JSON.stringify(patientPayload),
      });
      if (!checkAuth(patientRes, navigate)) return;
      if (!patientRes.ok) {
        const err = await patientRes.json().catch(() => null);
        throw new Error(err?.detail || `Save patient failed (${patientRes.status})`);
      }
      const saved = await patientRes.json();
      const targetId = id ?? saved.id ?? saved.patient_code ?? patientCode;

      const profileRes = await apiFetch(`/patients/${targetId}/health-profile`, {
        method: "PUT",
        body: JSON.stringify(healthProfilePayload),
      });
      if (!checkAuth(profileRes, navigate)) return;
      if (!profileRes.ok) {
        const err = await profileRes.json().catch(() => null);
        throw new Error(err?.detail || `Save health profile failed (${profileRes.status})`);
      }

      setSubmitSuccess(true);
      setSavedPatientId(String(targetId));
    } catch (err: any) {
      setError(err.message || "Failed to save patient. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateWeeklyPlan = async () => {
    if (!savedPatientId) return;
    setGenerateError("");
    setIsGenerating(true);
    try {
      const res = await apiFetch(`/weekly-plans/generate/${savedPatientId}`, {
        method: "POST",
      });
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `HTTP ${res.status}`);
      }
      await res.json();
      navigate(`/dietitian/weekly-plan/${savedPatientId}`);
    } catch (err: any) {
      setGenerateError(err.message || "Failed to generate weekly plan.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoadingExisting) {
    return (
      <div className="patients-page relative min-h-screen flex items-center justify-center gap-3 text-on-surface-variant">
        <div className="spinner" />
        <span className="text-sm">Loading patient record...</span>
      </div>
    );
  }

  return (
    <div className="patients-page relative min-h-screen overflow-x-hidden font-body-md">
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{ background: "linear-gradient(135deg, #f8faf8 100%, #ffffff 0%)" }}
      />

      <header className="w-full h-20 sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-black/5 flex justify-between items-center px-margin-desktop">
        <div className="flex-1 flex justify-start">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group"
          >
            <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
            <span className="text-label-md font-medium">Back</span>
          </button>
        </div>
        <div className="flex-1 flex justify-center">
          <h1 className="font-bold text-xl tracking-[0.2em] text-on-surface uppercase leading-none">dietrace</h1>
        </div>
        <div className="flex-1 flex justify-end items-center gap-6">
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/5 border border-black/10">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">DR</div>
            <span className="text-label-md font-medium">Account</span>
          </div>
        </div>
      </header>

      <main className="relative min-h-screen">
        <div className="px-margin-desktop py-10 max-w-6xl mx-auto">
          <section className="mb-10 flex justify-between items-end">
            <div>
              <h2 className="font-headline-md text-3xl text-on-surface mb-2">
                {isEditMode ? "Edit Patient Health Profile" : "Patient Health Profile"}
              </h2>
              <p className="text-on-surface-variant text-sm max-w-2xl">
                Clinical data input for expert system processing.
              </p>
            </div>
          </section>

          {error && (
            <div className="liquid-glass mb-6 px-6 py-4 rounded-2xl border-l-4 border-l-error flex items-start gap-3">
              <span className="material-symbols-outlined text-error text-lg shrink-0">error</span>
              <p className="text-sm text-on-surface">{error}</p>
            </div>
          )}
          {submitSuccess && (
            <div className="liquid-glass mb-6 px-6 py-4 rounded-2xl border-l-4 border-l-primary flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-lg shrink-0">check_circle</span>
                <p className="text-sm text-on-surface">Saved successfully. You can generate a recommendation now.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(isEditMode ? `/dietitian/patients/${id}` : "/dietitian/dashboard")}
                className="text-xs font-bold text-primary uppercase tracking-widest hover:underline whitespace-nowrap"
              >
                View Patient &rarr;
              </button>
            </div>
          )}
          {generateError && (
            <div className="liquid-glass mb-6 px-6 py-4 rounded-2xl border-l-4 border-l-warning flex items-start gap-3">
              <span className="material-symbols-outlined text-warning text-lg shrink-0">info</span>
              <p className="text-sm text-on-surface">{generateError}</p>
            </div>
          )}

          <form className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" onSubmit={handleSubmit}>
            {/* LEFT COLUMN */}
            <div className="lg:col-span-7 space-y-6">
              {/* Patient Identity */}
              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-primary">fingerprint</span>
                  <h3 className="text-lg font-semibold text-on-surface">Patient Identity</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Patient Code</label>
                    <input className="w-full px-4 py-3 text-sm" placeholder="e.g. PX-9082" type="text" value={patientCode} onChange={(e) => setPatientCode(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Full Name</label>
                    <input className="w-full px-4 py-3 text-sm" placeholder="Full legal name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Age</label>
                    <input className="w-full px-4 py-3 text-sm" placeholder="Years" type="number" value={age} onChange={(e) => setAge(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Gender</label>
                    <select className="w-full px-4 py-3 text-sm" value={gender} onChange={(e) => setGender(e.target.value)} required>
                      <option disabled value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Ward</label>
                    <input className="w-full px-4 py-3 text-sm" placeholder="Unit / Room" type="text" value={ward} onChange={(e) => setWard(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Admission Date</label>
                    <input className="w-full px-4 py-3 text-sm" type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Discharge Date</label>
                    <input className="w-full px-4 py-3 text-sm" type="date" value={dischargeDate} onChange={(e) => setDischargeDate(e.target.value)} />
                  </div>
                  {admissionDate && dischargeDate && (
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Stay Duration</span>
                        <span className="text-sm font-bold text-primary">
                          {Math.max(0, Math.ceil((new Date(dischargeDate).getTime() - new Date(admissionDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)} days
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Medical Conditions */}
              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-primary">clinical_notes</span>
                  <h3 className="text-lg font-semibold text-on-surface">Medical Conditions</h3>
                </div>

                {/* No Conditions Option */}
                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-primary/5 border border-primary/10 cursor-pointer hover:bg-primary/10 transition-all mb-4">
                  <input
                    type="checkbox"
                    checked={noConditions}
                    onChange={(e) => handleNoConditionsChange(e.target.checked)}
                    className="w-4 h-4 rounded border-black/20 text-primary focus:ring-primary"
                  />
                  <span className="text-on-surface text-sm font-medium">No Chronic Conditions</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { key: "diabetes" as const, label: "Diabetes", state: diabetes, setter: setDiabetes },
                    { key: "hypertension" as const, label: "Hypertension", state: hypertension, setter: setHypertension },
                    { key: "highCholesterol" as const, label: "High Cholesterol", state: highCholesterol, setter: setHighCholesterol },
                  ].map((c) => (
                    <label key={c.key} className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      c.state ? "bg-primary/5 border-primary/20" : "bg-black/5 border-black/5 hover:bg-black/10"
                    }`}>
                      <input
                        type="checkbox"
                        checked={c.state}
                        onChange={(e) => handleConditionChange(c.key, e.target.checked)}
                        disabled={noConditions}
                        className="w-4 h-4 rounded border-black/20 text-primary focus:ring-primary disabled:opacity-30"
                      />
                      <span className="text-on-surface text-sm font-medium">{c.label}</span>
                    </label>
                  ))}
                </div>

                {/* Disease Guidance Cards */}
                <div className="mt-4 space-y-3">
                  {diabetes && (
                    <div className={`p-4 rounded-xl ${diseaseGuidance.diabetes.bgColor} border ${diseaseGuidance.diabetes.borderColor} flex gap-3`}>
                      <span className={`material-symbols-outlined ${diseaseGuidance.diabetes.color}`}>{diseaseGuidance.diabetes.icon}</span>
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${diseaseGuidance.diabetes.color}`}>{diseaseGuidance.diabetes.title}</p>
                        <p className="text-sm text-on-surface leading-relaxed">{diseaseGuidance.diabetes.message}</p>
                      </div>
                    </div>
                  )}
                  {hypertension && (
                    <div className={`p-4 rounded-xl ${diseaseGuidance.hypertension.bgColor} border ${diseaseGuidance.hypertension.borderColor} flex gap-3`}>
                      <span className={`material-symbols-outlined ${diseaseGuidance.hypertension.color}`}>{diseaseGuidance.hypertension.icon}</span>
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${diseaseGuidance.hypertension.color}`}>{diseaseGuidance.hypertension.title}</p>
                        <p className="text-sm text-on-surface leading-relaxed">{diseaseGuidance.hypertension.message}</p>
                      </div>
                    </div>
                  )}
                  {highCholesterol && (
                    <div className={`p-4 rounded-xl ${diseaseGuidance.highCholesterol.bgColor} border ${diseaseGuidance.highCholesterol.borderColor} flex gap-3`}>
                      <span className={`material-symbols-outlined ${diseaseGuidance.highCholesterol.color}`}>{diseaseGuidance.highCholesterol.icon}</span>
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${diseaseGuidance.highCholesterol.color}`}>{diseaseGuidance.highCholesterol.title}</p>
                        <p className="text-sm text-on-surface leading-relaxed">{diseaseGuidance.highCholesterol.message}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Patient Category */}
              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-primary">category</span>
                  <h3 className="text-lg font-semibold text-on-surface">Patient Category</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Status Category</label>
                    <select className="w-full px-4 py-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="normal">Normal</option>
                      <option value="pregnant">Pregnant</option>
                      <option value="pre_operation">Pre-Operation</option>
                      <option value="post_operation">Post-Operation</option>
                    </select>
                  </div>
                  {category === "pregnant" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Pregnancy Trimester</label>
                      <input className="w-full px-4 py-3 text-sm" max={3} min={1} placeholder="1-3" type="number" value={trimester} onChange={(e) => setTrimester(e.target.value)} required />
                    </div>
                  )}
                </div>
              </div>

              {/* Clinical Notes */}
              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-primary">description</span>
                  <h3 className="text-lg font-semibold text-on-surface">Clinical Notes</h3>
                </div>
                <textarea
                  className="w-full h-32 px-4 py-3 text-sm resize-none"
                  placeholder="Clinical observations, special instructions, or any additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-5 space-y-6">
              {/* Body Measurements */}
              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-primary">straighten</span>
                  <h3 className="text-lg font-semibold text-on-surface">Body Measurements</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Weight (kg)</label>
                    <input className="w-full px-4 py-3 text-sm" step="0.1" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Height (cm)</label>
                    <input className="w-full px-4 py-3 text-sm" step="0.1" type="number" value={height} onChange={(e) => setHeight(e.target.value)} required />
                  </div>
                </div>
              </div>

              {/* Lifestyle */}
              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-primary">fitness_center</span>
                  <h3 className="text-lg font-semibold text-on-surface">Lifestyle</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Activity Level</label>
                    <select className="w-full px-4 py-3 text-sm" value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)}>
                      <option value="sedentary">Sedentary</option>
                      <option value="moderate">Moderate</option>
                      <option value="active">Active</option>
                    </select>
                  </div>

                  {/* Activity Level Guidance */}
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">{activityGuidance[activityLevel].impact}</p>
                    <p className="text-xs text-on-surface-variant">{activityGuidance[activityLevel].description}</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sleep Pattern</label>
                    <select className="w-full px-4 py-3 text-sm" value={sleepPattern} onChange={(e) => setSleepPattern(e.target.value)}>
                      <option value="good">Good</option>
                      <option value="irregular">Irregular</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="flex items-center justify-between p-3 rounded-xl bg-black/5 border border-black/5">
                      <span className="text-xs font-medium">Smoker</span>
                      <input type="checkbox" checked={smokes} onChange={(e) => setSmokes(e.target.checked)} className="w-4 h-4 rounded border-black/20 text-primary focus:ring-primary" />
                    </label>
                    <label className="flex items-center justify-between p-3 rounded-xl bg-black/5 border border-black/5">
                      <span className="text-xs font-medium">Vegetarian</span>
                      <input type="checkbox" checked={vegetarian} onChange={(e) => setVegetarian(e.target.checked)} className="w-4 h-4 rounded border-black/20 text-primary focus:ring-primary" />
                    </label>
                    <label className="flex items-center justify-between p-3 rounded-xl bg-black/5 border border-black/5">
                      <span className="text-xs font-medium">Chewing</span>
                      <input type="checkbox" checked={chewingProblem} onChange={(e) => setChewingProblem(e.target.checked)} className="w-4 h-4 rounded border-black/20 text-primary focus:ring-primary" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Allergy & Dietary */}
              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-error">warning</span>
                  <h3 className="text-lg font-semibold text-on-surface">Allergy &amp; Dietary</h3>
                </div>

                {/* Critical Allergy Warning */}
                <div className="mb-5 p-4 rounded-xl bg-error/10 border border-error/20 flex gap-3">
                  <span className="material-symbols-outlined text-error shrink-0">gpp_maybe</span>
                  <div>
                    <p className="text-xs font-bold text-error uppercase tracking-widest mb-1">Critical Safety Rule</p>
                    <p className="text-xs text-on-surface leading-relaxed">
                      Allergy safety has the highest priority. Any menu with matching allergy tags will be immediately excluded by the inference engine. This rule cannot be overridden by preferences or conditions.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Allergies (Select All That Apply)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {allergyOptions.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-3 p-2.5 rounded-lg bg-black/5 border border-black/5 cursor-pointer hover:bg-black/10 transition-all">
                          <input type="checkbox" checked={allergies.includes(opt.value)} onChange={() => toggleAllergy(opt.value)} className="w-4 h-4 rounded border-black/20 text-primary focus:ring-primary" />
                          <span className="text-xs font-medium">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                    {allergies.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-black/5">
                        {allergies.map((value) => {
                          const opt = allergyOptions.find((o) => o.value === value);
                          return (
                            <span key={value} className="tag-chip px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 uppercase">
                              {opt?.label}
                              <button type="button" onClick={() => toggleAllergy(value)} className="hover:text-error">&times;</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dietary Preference */}
              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-warning">restaurant</span>
                  <h3 className="text-lg font-semibold text-on-surface">Dietary Preference</h3>
                </div>

                {/* Preference Note */}
                <div className="mb-5 p-4 rounded-xl bg-warning/10 border border-warning/20 flex gap-3">
                  <span className="material-symbols-outlined text-warning shrink-0">info</span>
                  <div>
                    <p className="text-xs font-bold text-warning uppercase tracking-widest mb-1">Soft Constraint Note</p>
                    <p className="text-xs text-on-surface leading-relaxed">
                      Patient preference is a soft constraint. The system will try to honor it, but safety rules (allergies, medical conditions) always take priority. If preferences conflict with safety, safe menus will be chosen automatically.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Preferred Protein</label>
                    <select className="w-full px-4 py-3 text-sm" value={preferredProtein} onChange={(e) => setPreferredProtein(e.target.value)}>
                      <option value="chicken">Chicken</option>
                      <option value="fish">Fish</option>
                      <option value="egg">Egg</option>
                      <option value="tofu">Tofu</option>
                      <option value="none">No Preference</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Preferred Carbohydrate</label>
                    <select className="w-full px-4 py-3 text-sm" value={preferredCarb} onChange={(e) => setPreferredCarb(e.target.value)}>
                      <option value="white_rice">White Rice</option>
                      <option value="noodle">Noodle</option>
                      <option value="none">No Preference</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER BUTTONS */}
            <div className="lg:col-span-12 flex flex-col md:flex-row items-center justify-end gap-4 pt-4 pb-20">
              <button
                type="button"
                onClick={() => navigate(isEditMode ? `/dietitian/patients/${id}` : "/dietitian/dashboard")}
                className="px-8 py-4 rounded-xl border border-black/10 text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-all text-sm font-medium"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleGenerateWeeklyPlan}
                disabled={!savedPatientId || isGenerating}
                title={!savedPatientId ? "Save this patient first" : undefined}
                className="group flex items-center gap-2 px-8 py-4 rounded-xl bg-primary/10 border border-primary/20 text-primary enabled:hover:bg-primary/20 transition-all text-sm font-medium disabled:text-primary/40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                {isGenerating ? "Generating..." : "Generate Weekly Plan"}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex items-center gap-3 px-10 py-4 rounded-xl bg-primary text-white hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all duration-300 text-sm font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isSubmitting ? "Saving..." : isEditMode ? "Update Patient Profile" : "Save Patient Profile"}
                {!isSubmitting && (
                  <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
