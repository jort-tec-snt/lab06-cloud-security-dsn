import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { LoadingState } from "./components/Status";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuditPage } from "./pages/AuditPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { LoginPage } from "./pages/LoginPage";
import { RbacPage } from "./pages/RbacPage";
import { UsersPage } from "./pages/UsersPage";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <main className="centered-state"><LoadingState message="Validando sesión…" /></main>;
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return <BrowserRouter><AuthProvider><Routes><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedLayout />}><Route index element={<DashboardPage />} /><Route path="documentos" element={<DocumentsPage />} /><Route path="usuarios" element={<UsersPage />} /><Route path="rbac" element={<RbacPage />} /><Route path="auditoria" element={<AuditPage />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></AuthProvider></BrowserRouter>;
}
