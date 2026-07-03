import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL, checkAuth } from "../../lib/api";

interface PatientFormData {
  patient_code: string;
  full_name: string;
  age: number;
  gender: string;
  ward?: string;
  admission_date?: string;
  discharge_date?: string;
}

interface PatientHealthProfileData {
  weight_kg?: number;
  height_cm?: number;
  has_diabetes: boolean;
  has_hypertension: boolean;
  has_high_cholesterol: boolean;
  allergies: string[];
  activity_level: string;
  is_vegetarian: boolean;
  has_chewing_problem: boolean;
  preferred_protein: string;
  preferred_carbohydrate: string;
  patient_category: string;
  pregnancy_trimester?: number;
  smokes: boolean;
  sleep_pattern: string;
  notes?: string;
}

const allergyOptions = ["seafood", "nut", "dairy", "egg", "gluten"];
const activityLevels = ["sedentary", "moderate", "active"];
const categories = ["normal", "pregnant", "pre_operation", "post_operation"];
const proteinOptions = ["none", "chicken", "fish", "egg", "tofu"];
const carbOptions = ["none", "white_rice", "noodle"];
const sleepPatterns = ["normal", "poor", "restless"];

export default function Patients() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [formData, setFormData] = useState<PatientFormData>({
    patient_code: "",
    full_name: "",
    age: 18,
    gender: "M",
    ward: "",
    admission_date: new Date().toISOString().split("T")[0],
    discharge_date: "",
  });

  const [healthProfile, setHealthProfile] = useState<PatientHealthProfileData>({
    weight_kg: undefined,
    height_cm: undefined,
    has_diabetes: false,
    has_hypertension: false,
    has_high_cholesterol: false,
    allergies: [],
    activity_level: "sedentary",
    is_vegetarian: false,
    has_chewing_problem: false,
    preferred_protein: "none",
    preferred_carbohydrate: "none",
    patient_category: "normal",
    smokes: false,
    sleep_pattern: "normal",
    notes: "",
  });

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isEditing && id) {
      loadPatient();
    }
  }, [id, isEditing]);

  async function loadPatient() {
    setIsLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("dietrace_token");
      const res = await fetch(`${API_URL}/patients/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!checkAuth(res, navigate)) return;
      if (!res.ok) throw new Error("Failed to load patient");
      const data = await res.json();

      setFormData({
        patient_code: data.patient_code,
        full_name: data.full_name,
        age: data.age,
        gender: data.gender,
        ward: data.ward || "",
        admission_date: data.admission_date || "",
        discharge_date: data.discharge_date || "",
      });

      if (data.health_profile) {
        setHealthProfile({
          weight_kg: data.health_profile.weight_kg,
          height_cm: data.health_profile.height_cm,
          has_diabetes: data.health_profile.has_diabetes,
          has_hypertension: data.health_profile.has_hypertension,
          has_high_cholesterol: data.health_profile.has_high_cholesterol,
          allergies: data.health_profile.allergies || [],
          activity_level: data.health_profile.activity_level || "sedentary",
          is_vegetarian: data.health_profile.is_vegetarian,
          has_chewing_problem: data.health_profile.has_chewing_problem,
          preferred_protein: data.health_profile.preferred_protein || "none",
          preferred_carbohydrate: data.health_profile.preferred_carbohydrate || "none",
          patient_category: data.health_profile.patient_category || "normal",
          pregnancy_trimester: data.health_profile.pregnancy_trimester,
          smokes: data.health_profile.smokes,
          sleep_pattern: data.health_profile.sleep_pattern || "normal",
          notes: data.health_profile.notes || "",
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to load patient");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setIsSaving(true);

    try {
      const token = localStorage.getItem("dietrace_token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      if (isEditing && id) {
        // Update patient
        const updateRes = await fetch(`${API_URL}/patients/${id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(formData),
        });
        if (!checkAuth(updateRes, navigate)) return;
        if (!updateRes.ok) throw new Error("Failed to update patient");

        // Update health profile
        const profileRes = await fetch(`${API_URL}/patients/${id}/health-profile`, {
          method: "PUT",
          headers,
          body: JSON.stringify(healthProfile),
        });
        if (!checkAuth(profileRes, navigate)) return;
        if (!profileRes.ok) throw new Error("Failed to update health profile");

        setSuccessMsg("Patient updated successfully!");
        setTimeout(() => navigate(`/dietitian/patients/${id}`), 1500);
      } else {
        // Create new patient
        const createRes = await fetch(`${API_URL}/patients`, {
          method: "POST",
          headers,
          body: JSON.stringify(formData),
        });
        if (!checkAuth(createRes, navigate)) return;
        if (!createRes.ok) throw new Error("Failed to create patient");
        const created = await createRes.json();

        // Create health profile
        const profileRes = await fetch(`${API_URL}/patients/${created.id}/health-profile`, {
          method: "PUT",
          headers,
          body: JSON.stringify(healthProfile),
        });
        if (!checkAuth(profileRes, navigate)) return;
        if (!profileRes.ok) throw new Error("Failed to create health profile");

        setSuccessMsg("Patient created successfully!");
        setTimeout(() => navigate("/dietitian/patients"), 1500);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save patient");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="patients-page min-h-screen flex items-center justify-center gap-3 text-on-surface-variant">
        <div className="spinner" />
        <span className="text-sm">Loading patient...</span>
      </div>
    );
  }

  return (
    <div className="patients-page font-body-md text-body-md antialiased min-h-screen relative overflow-x-hidden">
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
          <div className="mb-10 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-caption-bold text-caption-bold text-primary uppercase tracking-widest">
                {isEditing ? "Edit Patient" : "New Patient"}
              </span>
            </div>
            <h1 className="font-headline-md text-4xl text-on-surface mb-2">
              {isEditing ? "Update Patient Record" : "Create Patient Record"}
            </h1>
            <p className="font-body-md text-on-surface-variant">Enter comprehensive patient information including health profile.</p>
          </div>

          {error && (
            <div className="liquid-glass px-6 py-4 rounded-xl flex items-center gap-3 border-l-4 border-l-error mb-8">
              <span className="material-symbols-outlined text-error text-lg">error</span>
              <span className="text-sm text-on-surface">{error}</span>
              <button onClick={() => setError("")} className="ml-auto text-xs text-on-surface-variant hover:text-on-surface">Dismiss</button>
            </div>
          )}

          {successMsg && (
            <div className="liquid-glass px-6 py-4 rounded-xl flex items-center gap-3 border-l-4 border-l-success mb-8 animate-fade-in">
              <span className="material-symbols-outlined text-success text-lg">check_circle</span>
              <span className="text-sm text-on-surface">{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Identity Section */}
            <div className="liquid-glass rounded-3xl p-8">
              <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">person</span>
                Patient Identity
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Patient Code *</label>
                  <input
                    type="text"
                    value={formData.patient_code}
                    onChange={(e) => setFormData({ ...formData, patient_code: e.target.value })}
                    disabled={isEditing}
                    placeholder="e.g., PN-001"
                    className="glass-input w-full px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Full Name *</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g., Sarah Ahmad"
                    className="glass-input w-full px-4 py-3"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Age *</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
                    min="0"
                    max="130"
                    className="glass-input w-full px-4 py-3"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="glass-input w-full px-4 py-3"
                    required
                  >
                    <option>M</option>
                    <option>F</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Ward Unit</label>
                  <input
                    type="text"
                    value={formData.ward}
                    onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                    placeholder="e.g., ICU-2, General-3"
                    className="glass-input w-full px-4 py-3"
                  />
                </div>
              </div>
            </div>

            {/* Admission & Discharge Section */}
            <div className="liquid-glass rounded-3xl p-8">
              <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">calendar_today</span>
                Admission & Discharge
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Admission Date</label>
                  <input
                    type="date"
                    value={formData.admission_date}
                    onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                    className="glass-input w-full px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Discharge Date</label>
                  <input
                    type="date"
                    value={formData.discharge_date}
                    onChange={(e) => setFormData({ ...formData, discharge_date: e.target.value })}
                    className="glass-input w-full px-4 py-3"
                  />
                  <p className="text-[10px] text-on-surface-variant/60 mt-2 italic">Required to generate weekly meal plan</p>
                </div>
              </div>
            </div>

            {/* Biometrics Section */}
            <div className="liquid-glass rounded-3xl p-8">
              <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">fitness_center</span>
                Biometrics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Weight (kg)</label>
                  <input
                    type="number"
                    value={healthProfile.weight_kg || ""}
                    onChange={(e) => setHealthProfile({ ...healthProfile, weight_kg: e.target.value ? parseFloat(e.target.value) : undefined })}
                    step="0.1"
                    className="glass-input w-full px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Height (cm)</label>
                  <input
                    type="number"
                    value={healthProfile.height_cm || ""}
                    onChange={(e) => setHealthProfile({ ...healthProfile, height_cm: e.target.value ? parseFloat(e.target.value) : undefined })}
                    step="0.1"
                    className="glass-input w-full px-4 py-3"
                  />
                </div>
              </div>
            </div>

            {/* Medical Conditions */}
            <div className="liquid-glass rounded-3xl p-8">
              <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">clinical_notes</span>
                Medical Conditions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <label className="flex items-center gap-3 p-4 bg-black/5 rounded-xl border border-black/5 cursor-pointer hover:bg-black/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={healthProfile.has_diabetes}
                    onChange={(e) => setHealthProfile({ ...healthProfile, has_diabetes: e.target.checked })}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium text-on-surface">Diabetes</span>
                </label>
                <label className="flex items-center gap-3 p-4 bg-black/5 rounded-xl border border-black/5 cursor-pointer hover:bg-black/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={healthProfile.has_hypertension}
                    onChange={(e) => setHealthProfile({ ...healthProfile, has_hypertension: e.target.checked })}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium text-on-surface">Hypertension</span>
                </label>
                <label className="flex items-center gap-3 p-4 bg-black/5 rounded-xl border border-black/5 cursor-pointer hover:bg-black/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={healthProfile.has_high_cholesterol}
                    onChange={(e) => setHealthProfile({ ...healthProfile, has_high_cholesterol: e.target.checked })}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium text-on-surface">High Cholesterol</span>
                </label>
              </div>

              {/* Allergies */}
              <div className="mb-6">
                <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-3 tracking-widest">Allergies</label>
                <div className="flex flex-wrap gap-2">
                  {allergyOptions.map((allergy) => (
                    <button
                      key={allergy}
                      type="button"
                      onClick={() => {
                        const updated = healthProfile.allergies.includes(allergy)
                          ? healthProfile.allergies.filter((a) => a !== allergy)
                          : [...healthProfile.allergies, allergy];
                        setHealthProfile({ ...healthProfile, allergies: updated });
                      }}
                      className={`px-4 py-2 rounded-full font-medium text-xs uppercase tracking-widest transition-all ${
                        healthProfile.allergies.includes(allergy)
                          ? "bg-error/10 text-error border border-error/20"
                          : "bg-black/5 text-on-surface border border-black/5 hover:bg-black/10"
                      }`}
                    >
                      {allergy.charAt(0).toUpperCase() + allergy.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Category */}
              <div>
                <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Patient Category</label>
                <select
                  value={healthProfile.patient_category}
                  onChange={(e) => setHealthProfile({ ...healthProfile, patient_category: e.target.value })}
                  className="glass-input w-full px-4 py-3"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lifestyle */}
            <div className="liquid-glass rounded-3xl p-8">
              <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">favorite</span>
                Lifestyle & Preferences
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Activity Level</label>
                  <select
                    value={healthProfile.activity_level}
                    onChange={(e) => setHealthProfile({ ...healthProfile, activity_level: e.target.value })}
                    className="glass-input w-full px-4 py-3"
                  >
                    {activityLevels.map((level) => (
                      <option key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Sleep Pattern</label>
                  <select
                    value={healthProfile.sleep_pattern}
                    onChange={(e) => setHealthProfile({ ...healthProfile, sleep_pattern: e.target.value })}
                    className="glass-input w-full px-4 py-3"
                  >
                    {sleepPatterns.map((pattern) => (
                      <option key={pattern} value={pattern}>
                        {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Preferred Protein</label>
                  <select
                    value={healthProfile.preferred_protein}
                    onChange={(e) => setHealthProfile({ ...healthProfile, preferred_protein: e.target.value })}
                    className="glass-input w-full px-4 py-3"
                  >
                    {proteinOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-on-surface-variant font-bold mb-2 tracking-widest">Preferred Carbohydrate</label>
                  <select
                    value={healthProfile.preferred_carbohydrate}
                    onChange={(e) => setHealthProfile({ ...healthProfile, preferred_carbohydrate: e.target.value })}
                    className="glass-input w-full px-4 py-3"
                  >
                    {carbOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === "white_rice" ? "White Rice" : opt === "none" ? "No Preference" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <label className="flex items-center gap-3 p-4 bg-black/5 rounded-xl border border-black/5 cursor-pointer hover:bg-black/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={healthProfile.is_vegetarian}
                    onChange={(e) => setHealthProfile({ ...healthProfile, is_vegetarian: e.target.checked })}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium text-on-surface">Vegetarian</span>
                </label>
                <label className="flex items-center gap-3 p-4 bg-black/5 rounded-xl border border-black/5 cursor-pointer hover:bg-black/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={healthProfile.has_chewing_problem}
                    onChange={(e) => setHealthProfile({ ...healthProfile, has_chewing_problem: e.target.checked })}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium text-on-surface">Chewing Problem</span>
                </label>
                <label className="flex items-center gap-3 p-4 bg-black/5 rounded-xl border border-black/5 cursor-pointer hover:bg-black/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={healthProfile.smokes}
                    onChange={(e) => setHealthProfile({ ...healthProfile, smokes: e.target.checked })}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium text-on-surface">Smoker</span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div className="liquid-glass rounded-3xl p-8">
              <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">description</span>
                Clinical Notes
              </h2>
              <textarea
                value={healthProfile.notes}
                onChange={(e) => setHealthProfile({ ...healthProfile, notes: e.target.value })}
                placeholder="Enter any additional clinical observations..."
                className="glass-input w-full px-4 py-3 min-h-[120px] resize-none"
              />
            </div>

            {/* Footer */}
            <div className="flex gap-4 justify-end">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-8 py-3.5 bg-black/5 border border-black/10 rounded-xl text-on-surface-variant font-medium text-sm hover:text-primary hover:bg-primary/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-12 py-3.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving..." : isEditing ? "Update Patient" : "Create Patient"}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
