import { Routes, Route } from 'react-router-dom'
import StudentStatus from './pages/StudentStatus'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import StudentDetail from './pages/StudentDetail'
import PaymentTracker from './pages/PaymentTracker'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<h1>Tutoring Platform</h1>} />
      <Route path="/status/:slug" element={<StudentStatus />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students/:id"
        element={
          <ProtectedRoute>
            <StudentDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/payments"
        element={
          <ProtectedRoute>
            <PaymentTracker />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App