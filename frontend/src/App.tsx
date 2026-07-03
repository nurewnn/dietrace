import { Routes, Route } from "react-router-dom";
import Welcome from "./pages/Welcome";
import SelectPatient from "./pages/patient/SelectPatient";
import ApprovedMenu from "./pages/patient/ApprovedMenu";
import Login from "./pages/dietitian/Login";
import Dashboard from "./pages/dietitian/Dashboard";
import Patients from "./pages/dietitian/Patients";
import PatientDetail from "./pages/dietitian/PatientDetail";
import RecommendationResult from "./pages/dietitian/RecommendationResult";
import WeeklyPlanPage from "./pages/dietitian/WeeklyPlanPage";
import FullMenuReportPage from "./pages/dietitian/FullMenuReportPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/patient/select" element={<SelectPatient />} />
      <Route path="/patient/menu" element={<ApprovedMenu />} />
      <Route path="/dietitian/login" element={<Login />} />
      <Route path="/dietitian/dashboard" element={<Dashboard />} />
      
      {/* Weekly Plan Routes */}
      <Route path="/dietitian/weekly-plan/:patientId" element={<WeeklyPlanPage />} />
      <Route path="/dietitian/weekly-plan/:weeklyPlanId/full-report" element={<FullMenuReportPage />} />
      
      {/* Edit patient — MUST come before /:id so it matches first */}
      <Route path="/dietitian/patients/:id/edit" element={<Patients />} />
      
      {/* View patient detail */}
      <Route path="/dietitian/patients/:id" element={<PatientDetail />} />
      
      {/* Create new patient */}
      <Route path="/dietitian/patients" element={<Patients />} />
      
      <Route path="/dietitian/recommendation/:id" element={<RecommendationResult />} />
    </Routes>
  );
}
