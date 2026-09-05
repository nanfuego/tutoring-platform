import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'
import StudentStatus from './pages/StudentStatus'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import StudentDetail from './pages/StudentDetail'
import PaymentTracker from './pages/PaymentTracker'
import ActivityTracker from './pages/ActivityTracker'
import InquiryTracker from './pages/InquiryTracker'
import AdminShell from './components/AdminShell'
import ProtectedRoute from './components/ProtectedRoute'

function AdminPage({ children }) {
  return (
    <ProtectedRoute>
      <AdminShell>{children}</AdminShell>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/status/:slug" element={<StudentStatus />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route
        path="/admin"
        element={
          <AdminPage>
            <AdminDashboard />
          </AdminPage>
        }
      />

      <Route
        path="/admin/students/:id"
        element={
          <AdminPage>
            <StudentDetail />
          </AdminPage>
        }
      />

      <Route
        path="/admin/activity"
        element={
          <AdminPage>
            <ActivityTracker />
          </AdminPage>
        }
      />

      <Route
        path="/admin/payments"
        element={
          <AdminPage>
            <PaymentTracker />
          </AdminPage>
        }
      />

      <Route
        path="/admin/inquiries"
        element={
          <AdminPage>
            <InquiryTracker />
          </AdminPage>
        }
      />
    </Routes>
  )
}

export default App
