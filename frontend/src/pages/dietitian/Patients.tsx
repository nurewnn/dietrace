import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE_URL = "http://localhost:8000";

const allergyOptions = [
  { label: "Seafood", value: "seafood" },
  { label: "Peanut", value: "nut" },
  { label: "Egg", value: "egg" },
  { label: "Milk", value: "dairy" },
  { label: "Soy", value: "soy" },
  { label: "Wheat", value: "gluten" },
];

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

  const [diabetes, setDiabetes] = useState(false);
  const [hypertension, setHypertension] = useState(false);
  const [highCholesterol, setHighCholesterol] = useState(false);

  const [category, setCategory] = useState("normal");
  const [trimester, setTrimester] = useState("");

  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  const [allergies, setAllergies] = useState<string[]>([]);
  const [activityLevel, setActivityLevel] = useState("sedentary");
  const [vegetarian, setVegetarian] = useState(false);
  const [chewingProblem, setChewingProblem] = useState(false);

  // DB-only, no rule currently consumes these — captured for clinical completeness
  const [smokes, setSmokes] = useState(false);
  const [sleepPattern, setSleepPattern] = useState("good");

  const [preferredProtein, setPreferredProtein] = useState("no_preference");
  const [preferredCarb, setPreferredCarb] = useState("no_preference");

  const [notes, setNotes] = useState("");

  const [isLoadingExisting, setIsLoadingExisting] = useState(isEditMode);
  const [usingMockPrefill, setUsingMockPrefill] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Prefill form when editing an existing patient
  useEffect(() => {
    if (!isEditMode) return;

    async function loadExisting() {
      try {
        const token = localStorage.getItem("dietrace_token");
        const res = await fetch(`${API_BASE_URL}/patients/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Endpoint returned ${res.status}`);
        const api = await res.json();
        applyPrefill(api);
        setUsingMockPrefill(false);
      } catch (err) {
        console.warn("GET /patients/:id not available yet, using demo prefill:", err);
        applyPrefill({
          patient_code: "DX-8829-C",
          full_name: "Elena Maria Rodriguez",
          age: 42,
          gender: "female",
          ward: "Cardiac B - 402",
          admission_date: "2023-10-14",
          health_profile: {
            has_diabetes: true,
            has_hypertension: true,
            has_hypercholesterolemia: false,
            allergies: "seafood, nut",
            food_preference: { protein: "chicken", carbohydrate: "white_rice" },
            activity_level: "moderate",
            patient_category: "normal",
            pregnancy_trimester: null,
            is_vegetarian: false,
            has_chewing_problem: false,
            smokes: false,
            sleep_pattern: "irregular",
            weight_kg: 68.5,
            height_cm: 164,
            notes: "Patient presents with stable vitals post-admission.",
          },
        });
        setUsingMockPrefill(true);
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

      const hp = api.health_profile ?? {};
      setDiabetes(hp.has_diabetes ?? false);
      setHypertension(hp.has_hypertension ?? false);
      setHighCholesterol(hp.has_hypercholesterolemia ?? false);
      setCategory(hp.patient_category ?? "normal");
      setTrimester(hp.pregnancy_trimester ? String(hp.pregnancy_trimester) : "");
      setWeight(hp.weight_kg ? String(hp.weight_kg) : "");
      setHeight(hp.height_cm ? String(hp.height_cm) : "");
      setAllergies(
        typeof hp.allergies === "string"
          ? hp.allergies.split(",").map((a: string) => a.trim()).filter(Boolean)
          : []
      );
      setActivityLevel(hp.activity_level ?? "sedentary");
      setVegetarian(hp.is_vegetarian ?? false);
      setChewingProblem(hp.has_chewing_problem ?? false);
      setSmokes(hp.smokes ?? false);
      setSleepPattern(hp.sleep_pattern ?? "good");
      setPreferredProtein(hp.food_preference?.protein ?? "no_preference");
      setPreferredCarb(hp.food_preference?.carbohydrate ?? "no_preference");
      setNotes(hp.notes ?? "");
    }

    loadExisting();
  }, [id, isEditMode]);

  const toggleAllergy = (value: string) => {
    setAllergies((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);
    setIsSubmitting(true);

    const patientPayload = {
      patient_code: patientCode.trim(),
      full_name: fullName.trim(),
      age: Number(age),
      gender,
      ward: ward.trim(),
      admission_date: admissionDate,
    };

    const healthProfilePayload = {
      has_diabetes: diabetes,
      has_hypertension: hypertension,
      has_hypercholesterolemia: highCholesterol,
      allergies: allergies.length > 0 ? allergies.join(", ") : null,
      food_preference: {
        protein: preferredProtein,
        carbohydrate: preferredCarb,
      },
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
      const token = localStorage.getItem("dietrace_token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const patientUrl = isEditMode ? `${API_BASE_URL}/patients/${id}` : `${API_BASE_URL}/patients`;
      const patientRes = await fetch(patientUrl, {
        method: isEditMode ? "PUT" : "POST",
        headers,
        body: JSON.stringify(patientPayload),
      });
      if (!patientRes.ok) throw new Error(`Save patient failed (${patientRes.status})`);
      const saved = await patientRes.json();
      const targetId = id ?? saved.id ?? saved.patient_code ?? patientCode;

      const profileRes = await fetch(`${API_BASE_URL}/patients/${targetId}/health-profile`, {
        method: "PUT",
        headers,
        body: JSON.stringify(healthProfilePayload),
      });
      if (!profileRes.ok) throw new Error(`Save health profile failed (${profileRes.status})`);

      setSubmitSuccess(true);
      setTimeout(() => navigate(isEditMode ? `/dietitian/patients/${id}` : "/dietitian/dashboard"), 1200);
    } catch (err) {
      console.warn("Patient routes not ready yet:", err);
      console.log("Payload that would be sent:", { patientPayload, healthProfilePayload });
      setSubmitError(
        `Backend ${isEditMode ? "update" : "create"} route isn't live yet — nothing was actually saved. Full payload logged to console (F12) for your teammate.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingExisting) {
    return (
      <div className="patients-page relative min-h-screen flex items-center justify-center text-on-surface-variant text-sm">
        Loading patient record...
      </div>
    );
  }

  return (
    <div className="patients-page relative min-h-screen overflow-x-hidden font-body-md">
      <video autoPlay className="video-bg" loop muted playsInline>
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4"
          type="video/mp4"
        />
      </video>

      <header className="w-full h-20 sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/10 flex justify-between items-center px-margin-desktop">
        <div className="flex-1 flex justify-start">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group"
          >
            <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">
              arrow_back
            </span>
            <span className="text-label-md font-medium">Back</span>
          </button>
        </div>
        <div className="flex-1 flex justify-center">
          <h1 className="font-bold text-xl tracking-[0.2em] text-white uppercase leading-none">dietrace</h1>
        </div>
        <div className="flex-1 flex justify-end items-center gap-6">
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
            <div className="w-8 h-8 rounded-full bg-sage flex items-center justify-center text-xs font-bold text-background">DR</div>
            <span className="text-label-md font-medium">Account</span>
          </div>
        </div>
      </header>

      <main className="relative min-h-screen">
        <div className="px-margin-desktop py-10 max-w-6xl mx-auto">
          <section className="mb-10 flex justify-between items-end">
            <div>
              <h2 className="font-headline-md text-3xl text-primary mb-2">
                {isEditMode ? "Edit Patient Health Profile" : "Patient Health Profile"}
              </h2>
              <p className="text-on-surface-variant text-sm max-w-2xl">
                Clinical data input for expert system processing.
              </p>
            </div>
          </section>

          {usingMockPrefill && (
            <div className="liquid-glass mb-6 px-6 py-4 rounded-2xl border-l-4 border-l-amber-400/60 flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-400 text-lg shrink-0">info</span>
              <p className="text-sm text-on-surface-variant">
                Showing demo data — patient lookup endpoint not reachable yet. Changes here won't save until your teammate's route is live.
              </p>
            </div>
          )}
          {submitError && (
            <div className="liquid-glass mb-6 px-6 py-4 rounded-2xl border-l-4 border-l-red-400 flex items-start gap-3">
              <span className="material-symbols-outlined text-red-400 text-lg shrink-0">error</span>
              <p className="text-sm text-on-surface-variant">{submitError}</p>
            </div>
          )}
          {submitSuccess && (
            <div className="liquid-glass mb-6 px-6 py-4 rounded-2xl border-l-4 border-l-accent-teal flex items-start gap-3">
              <span className="material-symbols-outlined text-accent-teal text-lg shrink-0">check_circle</span>
              <p className="text-sm text-on-surface-variant">Saved. Redirecting...</p>
            </div>
          )}

          <form className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" onSubmit={handleSubmit}>
            <div className="lg:col-span-7 space-y-6">
              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-accent-teal">fingerprint</span>
                  <h3 className="text-lg font-semibold text-primary">Patient Identity</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Patient Code</label>
                    <input
                      className="w-full px-4 py-3 text-sm"
                      placeholder="e.g. PX-9082"
                      type="text"
                      value={patientCode}
                      onChange={(e) => setPatientCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Full Name</label>
                    <input
                      className="w-full px-4 py-3 text-sm"
                      placeholder="Full legal name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Age</label>
                    <input
                      className="w-full px-4 py-3 text-sm"
                      placeholder="Years"
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      required
                    />
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
                    <input
                      className="w-full px-4 py-3 text-sm"
                      placeholder="Unit / Room"
                      type="text"
                      value={ward}
                      onChange={(e) => setWard(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Admission Date</label>
                    <input
                      className="w-full px-4 py-3 text-sm"
                      type="date"
                      value={admissionDate}
                      onChange={(e) => setAdmissionDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-accent-teal">clinical_notes</span>
                  <h3 className="text-lg font-semibold text-primary">Medical Conditions</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                    <input
                      className="w-4 h-4 rounded border-white/20 bg-transparent text-accent-teal focus:ring-accent-teal"
                      type="checkbox"
                      checked={diabetes}
                      onChange={(e) => setDiabetes(e.target.checked)}
                    />
                    <span className="text-on-surface text-sm font-medium">Diabetes</span>
                  </label>
                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                    <input
                      className="w-4 h-4 rounded border-white/20 bg-transparent text-accent-teal focus:ring-accent-teal"
                      type="checkbox"
                      checked={hypertension}
                      onChange={(e) => setHypertension(e.target.checked)}
                    />
                    <span className="text-on-surface text-sm font-medium">Hypertension</span>
                  </label>
                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                    <input
                      className="w-4 h-4 rounded border-white/20 bg-transparent text-accent-teal focus:ring-accent-teal"
                      type="checkbox"
                      checked={highCholesterol}
                      onChange={(e) => setHighCholesterol(e.target.checked)}
                    />
                    <span className="text-on-surface text-sm font-medium">High Cholesterol</span>
                  </label>
                </div>
              </div>

              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-accent-teal">category</span>
                  <h3 className="text-lg font-semibold text-primary">Patient Category</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Status Category</label>
                    <select className="w-full px-4 py-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="normal">Normal</option>
                      <option value="pregnant">Pregnant</option>
                      <option value="preop">Pre-Operation</option>
                      <option value="postop">Post-Operation</option>
                    </select>
                  </div>
                  {category === "pregnant" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Pregnancy Trimester</label>
                      <input
                        className="w-full px-4 py-3 text-sm"
                        max={3}
                        min={1}
                        placeholder="1-3"
                        type="number"
                        value={trimester}
                        onChange={(e) => setTrimester(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-accent-teal">bedtime</span>
                  <h3 className="text-lg font-semibold text-primary">Lifestyle Details</h3>
                </div>
                <p className="text-[11px] text-on-surface-variant/60 italic mb-4">
                  Captured for clinical completeness — not currently used by any rule in the inference engine.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-xs font-medium">Smoker</span>
                    <input
                      className="w-4 h-4 rounded border-white/20 bg-transparent text-accent-teal focus:ring-accent-teal"
                      type="checkbox"
                      checked={smokes}
                      onChange={(e) => setSmokes(e.target.checked)}
                    />
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sleep Pattern</label>
                    <select className="w-full px-4 py-3 text-sm" value={sleepPattern} onChange={(e) => setSleepPattern(e.target.value)}>
                      <option value="good">Good</option>
                      <option value="irregular">Irregular</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-accent-teal">description</span>
                  <h3 className="text-lg font-semibold text-primary">Notes</h3>
                </div>
                <textarea
                  className="w-full h-24 px-4 py-3 text-sm resize-none"
                  placeholder="Clinical observations..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-accent-teal">straighten</span>
                  <h3 className="text-lg font-semibold text-primary">Body Measurements</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Weight (kg)</label>
                    <input
                      className="w-full px-4 py-3 text-sm"
                      step="0.1"
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Height (cm)</label>
                    <input
                      className="w-full px-4 py-3 text-sm"
                      step="0.1"
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-accent-teal">warning</span>
                  <h3 className="text-lg font-semibold text-primary">Allergy &amp; Dietary</h3>
                </div>
                <div className="space-y-5">
                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Allergies (Select All That Apply)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {allergyOptions.map((opt) => (
                        <label
                          key={opt.value}
                          className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all"
                        >
                          <input
                            className="w-4 h-4 rounded border-white/20 bg-transparent text-accent-teal focus:ring-accent-teal"
                            type="checkbox"
                            checked={allergies.includes(opt.value)}
                            onChange={() => toggleAllergy(opt.value)}
                          />
                          <span className="text-xs font-medium">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                    {allergies.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                        {allergies.map((value) => {
                          const opt = allergyOptions.find((o) => o.value === value);
                          return (
                            <span key={value} className="tag-chip px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 uppercase">
                              {opt?.label}
                              <button type="button" onClick={() => toggleAllergy(value)} className="hover:text-white">×</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Activity Level</label>
                    <select className="w-full px-4 py-3 text-sm" value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)}>
                      <option value="sedentary">Sedentary</option>
                      <option value="moderate">Moderate</option>
                      <option value="active">Active</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-xs font-medium">Vegetarian</span>
                      <input
                        className="w-4 h-4 rounded border-white/20 bg-transparent text-accent-teal focus:ring-accent-teal"
                        type="checkbox"
                        checked={vegetarian}
                        onChange={(e) => setVegetarian(e.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-xs font-medium">Chewing Problem</span>
                      <input
                        className="w-4 h-4 rounded border-white/20 bg-transparent text-accent-teal focus:ring-accent-teal"
                        type="checkbox"
                        checked={chewingProblem}
                        onChange={(e) => setChewingProblem(e.target.checked)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="liquid-glass p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="material-symbols-outlined text-accent-teal">restaurant</span>
                  <h3 className="text-lg font-semibold text-primary">Dietary Preference</h3>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Preferred Protein</label>
                    <select className="w-full px-4 py-3 text-sm" value={preferredProtein} onChange={(e) => setPreferredProtein(e.target.value)}>
                      <option value="chicken">Chicken</option>
                      <option value="fish">Fish</option>
                      <option value="egg">Egg</option>
                      <option value="tofu">Tofu</option>
                      <option value="no_preference">No Preference</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Preferred Carbohydrate</label>
                    <select className="w-full px-4 py-3 text-sm" value={preferredCarb} onChange={(e) => setPreferredCarb(e.target.value)}>
                      <option value="white_rice">White Rice</option>
                      <option value="noodle">Noodle</option>
                      <option value="no_preference">No Preference</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-12 flex flex-col md:flex-row items-center justify-end gap-4 pt-4 pb-20">
              <button
                type="button"
                onClick={() => navigate(isEditMode ? `/dietitian/patients/${id}` : "/dietitian/dashboard")}
                className="px-8 py-4 rounded-xl border border-white/10 text-on-surface-variant hover:text-primary hover:bg-white/5 transition-all text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled
                title="Available once this patient is saved and the inference engine is connected"
                className="group flex items-center gap-2 px-8 py-4 rounded-xl bg-accent-teal/10 border border-accent-teal/20 text-accent-teal/60 cursor-not-allowed text-sm font-medium"
              >
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                Generate Recommendation
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex items-center gap-3 px-10 py-4 rounded-xl bg-white text-background hover:bg-accent-teal hover:scale-[1.02] active:scale-95 transition-all duration-300 text-sm font-bold shadow-xl shadow-black/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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