import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth.jsx'
import { ToastProvider } from './hooks/useToast.jsx'
import { ADMIN_LOGIN_SLUG, SECURITY_LOGIN_SLUG, TEACHER_LOGIN_SLUG } from './lib/routes'
import Landing from './pages/Landing'
import VisitorApp from './pages/VisitorApp'
import SecurityLogin from './pages/SecurityLogin'
import Scanner from './pages/Scanner'
import InviteAccept from './pages/InviteAccept'
import GroupInvitePage from './pages/Groupinvitepage'
import AdminLayout from './pages/AdminLayout'
import AdminVisitors from './pages/AdminVisitors'
import AdminInvites from './pages/AdminInvites'
import AdminStaff from './pages/AdminStaff'
import AdminStudents from './pages/AdminStudents'
import AdminWatchlist from './pages/AdminWatchlist'
import AdminReports from './pages/AdminReports'
import AdminLogs from './pages/AdminLogs'
import AdminManagers from './pages/AdminManagers'
import TeacherLogin from './pages/TeacherLogin'
import TeacherPanel from './pages/TeacherPanel'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* ── Public ───────────────────────────────────────────── */}
            <Route path="/"              element={<VisitorApp />} />
            <Route path="/app"           element={<Navigate to="/" replace />} />
            <Route path="/invite/:token" element={<InviteAccept />} />
            <Route path="/join/:token"   element={<GroupInvitePage />} />

            {/* ── Hidden login routes ───────────────────────────────── */}
            <Route path={`/${ADMIN_LOGIN_SLUG}`}    element={<Landing />} />
            <Route path={`/${SECURITY_LOGIN_SLUG}`} element={<SecurityLogin />} />
            <Route path={`/${TEACHER_LOGIN_SLUG}`}  element={<TeacherLogin />} />

            {/* ── Teacher area ─────────────────────────────────────── */}
            <Route path="/teacher" element={<TeacherPanel />} />

            {/* ── Authenticated areas ──────────────────────────────── */}
            <Route path="/scan" element={<Scanner />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index              element={<Navigate to="visitors" replace />} />
              <Route path="visitors"   element={<AdminVisitors />} />
              <Route path="invites"    element={<AdminInvites />} />
              <Route path="staff"      element={<AdminStaff />} />
              <Route path="students"   element={<AdminStudents />} />
              <Route path="watchlist"  element={<AdminWatchlist />} />
              <Route path="reports"    element={<AdminReports />} />
              <Route path="logs"       element={<AdminLogs />} />
              <Route path="managers"   element={<AdminManagers />} />
            </Route>

            {/* ── Catch-all ────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
