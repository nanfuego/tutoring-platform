import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import logo from '../assets/westpacific-logo-footer-white.png'
import joycePhoto from '../assets/joyce.png'
import './AdminShell.css'
import './UniversalAdminTheme.css'

function formatNow() {
  const now = new Date()

  return now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  )
}

function ProgressIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19V9M12 19V5M19 19v-7" />
      <path d="M3 19h18" />
    </svg>
  )
}

function PaymentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  )
}

function InquiryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v11H8l-4 3z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
    </svg>
  )
}

export default function AdminShell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()

  const [currentDate, setCurrentDate] = useState(() => formatNow())
  const [newInquiryCount, setNewInquiryCount] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const isDashboard = location.pathname === '/admin'
  const isActivity = location.pathname === '/admin/activity'
  const isPayments = location.pathname === '/admin/payments'
  const isInquiries = location.pathname === '/admin/inquiries'

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(formatNow())
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let channel

    async function loadNewInquiryCount() {
      const { count, error } = await supabase
        .from('contact_inquiries')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('status', 'new')

      if (error) {
        console.error('Unable to load new inquiry count:', error)
        return
      }

      setNewInquiryCount(count || 0)
    }

    loadNewInquiryCount()

    channel = supabase
      .channel('admin-inquiry-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_inquiries',
        },
        loadNewInquiryCount,
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  return (
    <div className="wp-admin-app">
      <aside className={`wp-admin-sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="wp-admin-brand">
          <Link to="/" className="wp-admin-brand-link" aria-label="WestPacific Desk home">
            <img
              src={logo}
              alt="WestPacific Desk"
              className="wp-admin-brand-logo"
            />
          </Link>

          <span className="wp-admin-portal-label">
            ADMIN PORTAL
          </span>
        </div>

        <nav className="wp-admin-sidebar-nav" aria-label="Admin navigation">
          <span className="wp-admin-nav-section">MANAGE</span>

          <Link
            to="/admin"
            className={`wp-admin-side-link ${isDashboard ? 'active' : ''}`}
          >
            <DashboardIcon />
            <span>Dashboard</span>
          </Link>

          <Link
            to="/admin/activity"
            className={`wp-admin-side-link ${isActivity ? 'active' : ''}`}
          >
            <ProgressIcon />
            <span>Student Progress</span>
          </Link>

          <Link
            to="/admin/payments"
            className={`wp-admin-side-link ${isPayments ? 'active' : ''}`}
          >
            <PaymentIcon />
            <span>Payment Management</span>
          </Link>

          <Link
            to="/admin/inquiries"
            className={`wp-admin-side-link ${isInquiries ? 'active' : ''}`}
          >
            <InquiryIcon />
            <span>Inquiries</span>

            {newInquiryCount > 0 && (
              <span className="wp-admin-side-badge">
                {newInquiryCount > 99 ? '99+' : newInquiryCount}
              </span>
            )}
          </Link>

        </nav>

      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          className="wp-admin-mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <section className="wp-admin-main">
        <header className="wp-admin-topbar">
          <button
            type="button"
            className="wp-admin-menu-toggle"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>

          <div className="wp-admin-topbar-title">
            <span>WESTPACIFIC DESK</span>
            <strong>Operations Workspace</strong>
          </div>

          <div className="wp-admin-topbar-right">
            <div className="wp-admin-date">
              {currentDate}
            </div>

            <div className="wp-admin-top-profile">
              <img src={joycePhoto} alt="Joyce" />
              <div>
                <strong>Joyce</strong>
                <span>Administrator</span>
              </div>

              <button
                type="button"
                className="wp-admin-top-signout"
                onClick={handleLogout}
                title="Sign Out"
              >
                <LogoutIcon />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="wp-admin-content">
          {children}
        </main>
      </section>
    </div>
  )
}
