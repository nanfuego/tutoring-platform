import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './AdminOperationsOverview.css'

function money(value, currency = 'USD') {
  const amount = Number(value || 0)
  const symbol = currency === 'PHP' ? '₱' : '$'
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatRelative(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function AttentionIcon({ type }) {
  if (type === 'payment') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </svg>
    )
  }

  if (type === 'inquiry') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v11H8l-4 3z" />
        <path d="M8 9h8M8 12h5" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19V9M12 19V5M19 19v-7" />
      <path d="M3 19h18" />
    </svg>
  )
}

function ActivityIcon({ type }) {
  if (type === 'payment') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12h16M12 4v16" />
      </svg>
    )
  }

  if (type === 'inquiry') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v11H8l-4 3z" />
      </svg>
    )
  }

  if (type === 'student') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c1.3-4 4-6 8-6s6.7 2 8 6" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}

export default function AdminOperationsOverview() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [overduePayments, setOverduePayments] = useState([])
  const [newInquiries, setNewInquiries] = useState([])
  const [upcomingActivities, setUpcomingActivities] = useState([])
  const [recentPayments, setRecentPayments] = useState([])
  const [recentInquiries, setRecentInquiries] = useState([])
  const [recentStudents, setRecentStudents] = useState([])
  const [portalTarget, setPortalTarget] = useState(null)


  useEffect(() => {
    let attempts = 0
    let timer

    function mountOverviewAfterDashboardHeader() {
      const dashboard = document.querySelector('.wp-admin-content .admin-page')
      const header = dashboard?.querySelector('.dashboard-matched-header')

      if (!dashboard || !header) {
        attempts += 1
        if (attempts < 20) {
          timer = window.setTimeout(mountOverviewAfterDashboardHeader, 50)
        }
        return
      }

      let host = dashboard.querySelector(':scope > .ops-overview-portal-host')

      if (!host) {
        host = document.createElement('div')
        host.className = 'ops-overview-portal-host'
        header.insertAdjacentElement('afterend', host)
      }

      setPortalTarget(host)
    }

    mountOverviewAfterDashboardHeader()

    return () => {
      if (timer) window.clearTimeout(timer)
      const host = document.querySelector(
        '.wp-admin-content .admin-page > .ops-overview-portal-host'
      )
      if (host) host.remove()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      setLoading(true)

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const end = new Date(today)
      end.setDate(end.getDate() + 7)

      const todayKey = today.toISOString().slice(0, 10)
      const endKey = end.toISOString().slice(0, 10)

      const [
        overdueRes,
        inquiryRes,
        upcomingRes,
        paymentActivityRes,
        inquiryActivityRes,
        studentActivityRes,
      ] = await Promise.all([
        supabase
          .from('payments')
          .select('id, student_id, payer_name, amount, amount_paid, currency, status, due_date, students(name)')
          .lt('due_date', todayKey)
          .neq('status', 'paid')
          .order('due_date', { ascending: true })
          .limit(20),

        supabase
          .from('contact_inquiries')
          .select('id, name, email, service, status, created_at')
          .eq('status', 'new')
          .order('created_at', { ascending: false })
          .limit(20),

        supabase
          .from('activity_requirements')
          .select('id, label, end_date, student_id')
          .gte('end_date', todayKey)
          .lte('end_date', endKey)
          .order('end_date', { ascending: true })
          .limit(20),

        supabase
          .from('payments')
          .select('id, student_id, payer_name, amount, currency, description, created_at, students(name)')
          .order('created_at', { ascending: false })
          .limit(8),

        supabase
          .from('contact_inquiries')
          .select('id, name, service, created_at')
          .order('created_at', { ascending: false })
          .limit(8),

        supabase
          .from('students')
          .select('id, name, university, created_at')
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      if (cancelled) return

      setOverduePayments(overdueRes.error ? [] : overdueRes.data || [])
      setNewInquiries(inquiryRes.error ? [] : inquiryRes.data || [])
      setUpcomingActivities(upcomingRes.error ? [] : upcomingRes.data || [])
      setRecentPayments(paymentActivityRes.error ? [] : paymentActivityRes.data || [])
      setRecentInquiries(inquiryActivityRes.error ? [] : inquiryActivityRes.data || [])
      setRecentStudents(studentActivityRes.error ? [] : studentActivityRes.data || [])

      setLoading(false)
    }

    loadOverview()

    const channel = supabase
      .channel('admin-operations-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, loadOverview)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_inquiries' }, loadOverview)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, loadOverview)
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  const attentionItems = useMemo(() => {
    const overdueBalance = overduePayments.reduce((sum, payment) => {
      const total = Number(payment.amount || 0)
      const paid = Number(payment.amount_paid || 0)
      return sum + Math.max(0, total - paid)
    }, 0)

    return [
      {
        key: 'payments',
        type: 'payment',
        count: overduePayments.length,
        title: overduePayments.length === 1 ? 'Overdue invoice' : 'Overdue invoices',
        detail: overduePayments.length
          ? `${money(overdueBalance)} still outstanding`
          : 'No overdue balances',
        route: '/admin/payments',
        tone: overduePayments.length ? 'danger' : 'good',
      },
      {
        key: 'inquiries',
        type: 'inquiry',
        count: newInquiries.length,
        title: newInquiries.length === 1 ? 'New inquiry' : 'New inquiries',
        detail: newInquiries.length
          ? 'Waiting for a response'
          : 'Inbox is caught up',
        route: '/admin/inquiries',
        tone: newInquiries.length ? 'attention' : 'good',
      },
      {
        key: 'activities',
        type: 'activity',
        count: upcomingActivities.length,
        title: upcomingActivities.length === 1
          ? 'Activity due this week'
          : 'Activities due this week',
        detail: upcomingActivities.length
          ? 'Due within the next 7 days'
          : 'No activity deadlines this week',
        route: '/admin/activity',
        tone: upcomingActivities.length ? 'attention' : 'good',
      },
    ]
  }, [overduePayments, newInquiries, upcomingActivities])

  const recentActivity = useMemo(() => {
    const paymentItems = recentPayments.map((payment) => ({
      key: `payment-${payment.id}`,
      type: 'payment',
      title: 'Invoice created',
      detail:
        payment.students?.name ||
        payment.payer_name ||
        payment.description ||
        'Payment record',
      meta: money(payment.amount, payment.currency),
      date: payment.created_at,
      route: '/admin/payments',
    }))

    const inquiryItems = recentInquiries.map((inquiry) => ({
      key: `inquiry-${inquiry.id}`,
      type: 'inquiry',
      title: 'Inquiry received',
      detail: inquiry.name || inquiry.service || 'Website inquiry',
      meta: inquiry.service || '',
      date: inquiry.created_at,
      route: '/admin/inquiries',
    }))

    const studentItems = recentStudents.map((student) => ({
      key: `student-${student.id}`,
      type: 'student',
      title: 'Student added',
      detail: student.name || 'New student',
      meta: student.university || '',
      date: student.created_at,
      route: `/admin/students/${student.id}`,
    }))

    return [...paymentItems, ...inquiryItems, ...studentItems]
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 7)
  }, [recentPayments, recentInquiries, recentStudents])

  if (!portalTarget) return null

  return createPortal(
    <section className="ops-overview" aria-label="Operations overview">
      <div className="ops-overview-grid">
        <article className="ops-panel ops-attention-panel">
          <div className="ops-panel-header">
            <div>
              <span className="ops-kicker">TODAY</span>
              <h2>Attention Required</h2>
              <p>Items that may need Joyce's attention.</p>
            </div>
          </div>

          <div className="ops-attention-list">
            {loading ? (
              <div className="ops-loading">Checking your workspace…</div>
            ) : (
              attentionItems.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className={`ops-attention-item ${item.tone}`}
                  onClick={() => navigate(item.route)}
                >
                  <span className="ops-attention-icon">
                    <AttentionIcon type={item.type} />
                  </span>

                  <span className="ops-attention-copy">
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </span>

                  <span className="ops-attention-count">{item.count}</span>
                  <span className="ops-arrow">→</span>
                </button>
              ))
            )}
          </div>
        </article>

        <article className="ops-panel ops-activity-panel">
          <div className="ops-panel-header ops-panel-header-row">
            <div>
              <span className="ops-kicker">WORKSPACE</span>
              <h2>Recent Activity</h2>
              <p>Latest changes across students, invoices, and inquiries.</p>
            </div>
          </div>

          <div className="ops-activity-list">
            {loading ? (
              <div className="ops-loading">Loading recent activity…</div>
            ) : recentActivity.length === 0 ? (
              <div className="ops-empty">No recent activity yet.</div>
            ) : (
              recentActivity.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className="ops-activity-row"
                  onClick={() => navigate(item.route)}
                >
                  <span className={`ops-activity-icon ${item.type}`}>
                    <ActivityIcon type={item.type} />
                  </span>

                  <span className="ops-activity-copy">
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </span>

                  {item.meta && <span className="ops-activity-meta">{item.meta}</span>}
                  <time>{formatRelative(item.date)}</time>
                </button>
              ))
            )}
          </div>
        </article>
      </div>
    </section>,
    portalTarget
  )
}
