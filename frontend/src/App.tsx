import { Routes, Route } from "react-router-dom";
import Welcome from "./pages/Welcome";
import SelectPatient from "./pages/patient/SelectPatient";
import ApprovedMenu from "./pages/patient/ApprovedMenu";
import Login from "./pages/dietitian/Login";
import Dashboard from "./pages/dietitian/Dashboard";
import Patients from "./pages/dietitian/Patients";
import PatientDetail from "./pages/dietitian/PatientDetail";
import RecommendationResult from "./pages/dietitian/RecommendationResult";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/patient/select" element={<SelectPatient />} />
      <Route path="/patient/menu" element={<ApprovedMenu />} />
      <Route path="/dietitian/login" element={<Login />} />
      <Route path="/dietitian/dashboard" element={<Dashboard />} />
      <Route path="/dietitian/patients" element={<Patients />} />
      <Route path="/dietitian/patients/:id" element={<PatientDetail />} />
      <Route path="/dietitian/recommendation" element={<RecommendationResult />} />
    </Routes>
  );
}
