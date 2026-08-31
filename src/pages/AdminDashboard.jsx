import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import PageHeader from '../components/PageHeader'
import './AdminDashboard.css'
import './AdminDashboard.redesign.css'

function formatNow() {
  const now = new Date()
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${dateStr} · ${timeStr}`
}

function getInitials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}


function getPaymentState(payments) {
  if (!payments?.length) return 'none'

  const hasPaid = payments.some((payment) => payment.status === 'paid')
  if (hasPaid) return 'paid'

  const hasOverdue = payments.some(
    (payment) =>
      payment.status !== 'paid' &&
      payment.due_date &&
      new Date(payment.due_date) < new Date(new Date().toDateString())
  )

  if (hasOverdue) return 'overdue'
  return 'pending'
}

function AdminDashboard() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  // Dashboard data used by the redesigned summary table.
  const [payments, setPayments] = useState([])
  const [activity, setActivity] = useState([])
  const [activityRequirements, setActivityRequirements] = useState([])

  // Add Student modal
  const [showAddStudent, setShowAddStudent] = useState(false)

  // Delete Students modal
  const [showDeleteStudents, setShowDeleteStudents] = useState(false)

  // General states
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState([])
  const [error, setError] = useState('')
  const [deleteSearch, setDeleteSearch] = useState('')
  const [deleteSchoolFilter, setDeleteSchoolFilter] = useState('all')
  const [deleteStatusFilter, setDeleteStatusFilter] = useState('all')

  // Canvas password visibility
  const [showCanvasPassword, setShowCanvasPassword] = useState(false)
  const [showCorelmsPassword, setShowCorelmsPassword] = useState(false)

  // Live clock
  const [currentTime, setCurrentTime] = useState(() => formatNow())

  // Search + School filter + dashboard status filter
  const [search, setSearch] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Student Manager dropdown
  const [showManagerMenu, setShowManagerMenu] = useState(false)
  const [openActionMenu, setOpenActionMenu] = useState(null)
  const [actionMenuPosition, setActionMenuPosition] = useState(null)
  const [contactStudent, setContactStudent] = useState(null)
  const [contactMode, setContactMode] = useState('compose')
  const [contactSubject, setContactSubject] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const managerRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(formatNow()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (managerRef.current && !managerRef.current.contains(event.target)) {
        setShowManagerMenu(false)
      }
      if (!event.target.closest('.student-row-actions')) {
        setOpenActionMenu(null)
        setActionMenuPosition(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keep the fixed action menu from floating away when the table/page scrolls.
  useEffect(() => {
    if (!openActionMenu) return

    function handleScroll() {
      setOpenActionMenu(null)
      setActionMenuPosition(null)
    }

    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [openActionMenu])

  // Add Student form
  const [form, setForm] = useState({
    name: '',
    email: '',
    university: 'AUHS',
    subject: '',
    program: '',
    phone: '',
    slug: '',
    active: true,
    canvas_un: '',
    canvas_pw: '',
    corelms_un: '',
    corelms_pw: '',
  })

  useEffect(() => {
    fetchStudents()
  }, [])

  async function fetchStudents() {
    setLoading(true)

    const [studentsRes, paymentsRes, requirementsRes, activityRes] =
      await Promise.all([
        supabase.from('students').select('*').order('name'),
        supabase.from('payments').select('student_id, status, due_date'),
        supabase.from('activity_requirements').select('id, student_id'),
        supabase.from('student_activity').select('student_id, completed'),
      ])

    if (studentsRes.error) {
      console.error('Error loading students:', studentsRes.error)
      setError(studentsRes.error.message)
    }

    if (paymentsRes.error) {
      console.warn('Unable to load payment summary:', paymentsRes.error.message)
    }

    if (requirementsRes.error) {
      console.warn(
        'Unable to load activity requirements:',
        requirementsRes.error.message
      )
    }

    if (activityRes.error) {
      console.warn('Unable to load activity progress:', activityRes.error.message)
    }

    setStudents(studentsRes.data || [])
    setPayments(paymentsRes.data || [])
    setActivity(activityRes.data || [])
    setActivityRequirements(requirementsRes.data || [])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function openAddStudent() {
    setShowManagerMenu(false)
    setError('')

    setForm({
      name: '',
      email: '',
      university: 'AUHS',
      subject: '',
      program: '',
      phone: '',
      slug: '',
      active: true,
      canvas_un: '',
      canvas_pw: '',
      corelms_un: '',
      corelms_pw: '',
    })

    setShowCanvasPassword(false)
    setShowCorelmsPassword(false)
    setShowAddStudent(true)
  }

  function openDeleteStudents() {
    setShowManagerMenu(false)
    setError('')
    setSelectedStudents([])
    setDeleteSearch('')
    setDeleteSchoolFilter('all')
    setDeleteStatusFilter('all')
    setShowDeleteStudents(true)
  }

  function closeAddStudent() {
    if (saving) return
    setShowAddStudent(false)
    setError('')
  }

  async function handleAddStudent(event) {
    event.preventDefault()

    setSaving(true)
    setError('')

    const newStudent = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      university: form.university,
      subject: form.subject.trim() || null,
      program: form.program.trim() || null,
      phone: form.phone.trim() || null,
      slug: form.slug.trim() || null,
      active: form.active,
      canvas_un: form.canvas_un.trim() || null,
      canvas_pw: form.canvas_pw || null,
      corelms_un: form.corelms_un.trim() || null,
      corelms_pw: form.corelms_pw || null,
    }

    if (!newStudent.name) {
      setError('Student name is required.')
      setSaving(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('students')
      .insert(newStudent)
      .select()
      .single()

    if (insertError) {
      console.error('Error adding student:', insertError)
      setError(insertError.message)
      setSaving(false)
      return
    }

    setStudents((current) =>
      [...current, data].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      )
    )

    setShowAddStudent(false)
    setSaving(false)
  }

  function toggleStudentSelection(studentId) {
    setSelectedStudents((current) => {
      if (current.includes(studentId)) {
        return current.filter((id) => id !== studentId)
      }
      return [...current, studentId]
    })
  }

  function toggleSelectAll() {
    if (students.length === 0) return

    if (selectedStudents.length === students.length) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(students.map((student) => student.id))
    }
  }

  async function handleDeleteSelected() {
    if (selectedStudents.length === 0) return

    const selectedStudentObjects = students.filter((student) =>
      selectedStudents.includes(student.id)
    )

    const names = selectedStudentObjects
      .map((student) => student.name)
      .join(', ')

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${names}?\n\nThis will remove their profiles and associated notes.`
    )

    if (!confirmed) return

    setDeleting(true)
    setError('')

    const { error: deleteError } = await supabase
      .from('students')
      .delete()
      .in('id', selectedStudents)

    if (deleteError) {
      console.error('Error deleting students:', deleteError)
      setError(deleteError.message)
      setDeleting(false)
      return
    }

    setStudents((current) =>
      current.filter((student) => !selectedStudents.includes(student.id))
    )

    setPayments((current) =>
      current.filter((payment) => !selectedStudents.includes(payment.student_id))
    )

    setActivity((current) =>
      current.filter((item) => !selectedStudents.includes(item.student_id))
    )

    setSelectedStudents([])
    setDeleting(false)
    setShowDeleteStudents(false)
  }

  const studentMetrics = useMemo(() => {
    const paymentsByStudent = {}
    const activityByStudent = {}

    payments.forEach((payment) => {
      if (!paymentsByStudent[payment.student_id]) {
        paymentsByStudent[payment.student_id] = []
      }
      paymentsByStudent[payment.student_id].push(payment)
    })

    activity.forEach((item) => {
      if (!activityByStudent[item.student_id]) {
        activityByStudent[item.student_id] = []
      }
      activityByStudent[item.student_id].push(item)
    })

    return students.reduce((map, student) => {
      const studentActivity = activityByStudent[student.id] || []
      const completed = studentActivity.filter((item) => item.completed).length
      // Total requirements for this student = shared/cohort-wide items
      // (student_id is null) plus any custom items added just for them.
      const total = activityRequirements.filter(
        (r) => !r.student_id || r.student_id === student.id
      ).length
      const progress = total
        ? Math.min(100, Math.round((completed / total) * 100))
        : 0

      map[student.id] = {
        progress,
        paymentState: getPaymentState(paymentsByStudent[student.id] || []),
        status: progress >= 100 ? 'completed' : 'in-progress',
      }

      return map
    }, {})
  }, [students, payments, activity, activityRequirements])

  const baseFilteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (schoolFilter !== 'all' && student.university !== schoolFilter) {
        return false
      }

      if (search.trim()) {
        const q = search.toLowerCase()
        const matchesSearch =
          student.name?.toLowerCase().includes(q) ||
          student.email?.toLowerCase().includes(q) ||
          student.phone?.toLowerCase().includes(q) ||
          student.subject?.toLowerCase().includes(q) ||
          student.program?.toLowerCase().includes(q) ||
          student.university?.toLowerCase().includes(q)

        if (!matchesSearch) return false
      }

      return true
    })
  }, [students, schoolFilter, search])

  const statusCounts = useMemo(() => {
    const inProgress = baseFilteredStudents.filter(
      (student) => studentMetrics[student.id]?.status !== 'completed'
    ).length

    const completed = baseFilteredStudents.filter(
      (student) => studentMetrics[student.id]?.status === 'completed'
    ).length

    return {
      all: baseFilteredStudents.length,
      'in-progress': inProgress,
      completed,
    }
  }, [baseFilteredStudents, studentMetrics])

  const filteredStudents = useMemo(() => {
    if (statusFilter === 'all') return baseFilteredStudents

    return baseFilteredStudents.filter(
      (student) => studentMetrics[student.id]?.status === statusFilter
    )
  }, [baseFilteredStudents, statusFilter, studentMetrics])

  const deleteFilteredStudents = useMemo(() => {
    const query = deleteSearch.trim().toLowerCase()

    return students.filter((student) => {
      if (deleteSchoolFilter !== 'all' && student.university !== deleteSchoolFilter) {
        return false
      }

      const metric = studentMetrics[student.id]
      const status = metric?.status || 'in-progress'

      if (deleteStatusFilter !== 'all' && status !== deleteStatusFilter) {
        return false
      }

      if (!query) return true

      return (
        student.name?.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query) ||
        student.phone?.toLowerCase().includes(query) ||
        student.subject?.toLowerCase().includes(query) ||
        student.program?.toLowerCase().includes(query) ||
        student.university?.toLowerCase().includes(query)
      )
    })
  }, [students, deleteSearch, deleteSchoolFilter, deleteStatusFilter, studentMetrics])

  const allVisibleDeleteSelected =
    deleteFilteredStudents.length > 0 &&
    deleteFilteredStudents.every((student) => selectedStudents.includes(student.id))

  function toggleVisibleDeleteSelection() {
    const visibleIds = deleteFilteredStudents.map((student) => student.id)

    if (allVisibleDeleteSelected) {
      setSelectedStudents((current) =>
        current.filter((id) => !visibleIds.includes(id))
      )
    } else {
      setSelectedStudents((current) => [
        ...new Set([...current, ...visibleIds]),
      ])
    }
  }

  function openQuickContact(student) {
    setOpenActionMenu(null)
    setContactStudent(student)
    setContactMode('compose')
    setContactSubject('')
    setContactMessage('')
  }

  function closeQuickContact() {
    setContactStudent(null)
    setContactSubject('')
    setContactMessage('')
  }

  function sendQuickEmail(event) {
    event.preventDefault()
    if (!contactStudent?.email) return
    window.location.href = `mailto:${contactStudent.email}?subject=${encodeURIComponent(contactSubject.trim())}&body=${encodeURIComponent(contactMessage.trim())}`
    closeQuickContact()
  }

  function sendNudge(student, type) {
    if (!student?.email) return
    const metric = studentMetrics[student.id] || { progress: 0, paymentState: 'none' }
    const paymentLabel = { paid: 'paid', pending: 'pending', overdue: 'overdue', none: 'not yet invoiced' }[metric.paymentState]
    const subject = type === 'payment' ? 'Payment reminder' : 'Course progress check-in'
    const body = type === 'payment'
      ? `Hi ${student.name || 'there'},\n\nJust a quick reminder regarding your payment. Our records currently show your payment status as ${paymentLabel}. Please let us know if you have any questions.\n\nThank you!`
      : `Hi ${student.name || 'there'},\n\nJust checking in on your course progress. Your current activity progress is ${metric.progress}%. Please let us know if you need any help getting back on track.\n\nThank you!`
    window.location.href = `mailto:${student.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setOpenActionMenu(null)
  }

  function exportStudentData(student) {
    const metric = studentMetrics[student.id] || { progress: 0, paymentState: 'none' }
    const rows = [
      ['Field', 'Value'],
      ['Name', student.name || ''], ['Email', student.email || ''],
      ['School', student.university || ''], ['Program', student.program || ''],
      ['Subject', student.subject || ''], ['Phone', student.phone || ''],
      ['Active', student.active ? 'Yes' : 'No'],
      ['Activity Progress', `${metric.progress}%`], ['Payment Status', metric.paymentState],
    ]
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(student.name || 'student').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-report.csv`
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
    setOpenActionMenu(null)
  }

  function archiveOrDeleteStudent(student) {
    setOpenActionMenu(null)
    setSelectedStudents([student.id])
    setDeleteSearch(''); setDeleteSchoolFilter('all'); setDeleteStatusFilter('all')
    setShowDeleteStudents(true)
  }

  return (
    <div className="admin-page">
      {/* TOP BAR */}
      <div className="admin-topbar">
        <div className="admin-topbar-row">
          <div className="admin-heading">
            <p className="admin-welcome">Welcome, Joyce!</p>
            <p className="admin-clock">{currentTime}</p>
          </div>

          <button onClick={handleLogout} className="logout-button">
            Sign Out
          </button>
        </div>

        <div className="student-action-buttons">
          <div className="manager-dropdown" ref={managerRef}>
            <button
              type="button"
              className="manager-button"
              onClick={() => setShowManagerMenu((prev) => !prev)}
            >
              Student Manager <span className="manager-caret">▾</span>
            </button>

            {showManagerMenu && (
              <div className="manager-menu">
                <button type="button" onClick={openAddStudent}>
                  + Add Student
                </button>
                <button type="button" onClick={openDeleteStudents}>
                  Delete Students
                </button>
              </div>
            )}
          </div>

          <Link to="/admin/activity" className="nav-button">
            Student Progress
          </Link>

          <Link to="/admin/payments" className="nav-button">
            Payment Management
          </Link>
        </div>

        <hr className="admin-divider" />
      </div>

      {error && !showAddStudent && !showDeleteStudents && (
        <div className="dashboard-error">{error}</div>
      )}

      {/* Search + School Filter + Status Tabs */}
      <div className="page-header">
  <div className="page-header-content">
    <div className="page-eyebrow">STUDENT MANAGEMENT</div>

    <h1 className="page-title">Dashboard</h1>

    <p className="page-description">
      Monitor students, activity progress, and overall platform activity.
    </p>
  </div>
</div>
      <div className="dashboard-filter-row">
        <div className="dashboard-controls">
        <input
          type="text"
          className="dashboard-search"
          placeholder="Search by name, email, phone, or subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="school-filter"
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
        >
          <option value="all">All Schools</option>
          <option value="AUHS">AUHS</option>
          <option value="PACIFIC">PACIFIC</option>
        </select>
        </div>

        <div className="dashboard-status-tabs" role="tablist" aria-label="Student status">
        {[
          { key: 'all', label: 'All' },
          { key: 'in-progress', label: 'In Progress' },
          { key: 'completed', label: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab.key}
            className={
              statusFilter === tab.key
                ? 'dashboard-status-tab active'
                : 'dashboard-status-tab'
            }
            onClick={() => setStatusFilter(tab.key)}
          >
            <span>{tab.label}</span>
            <span className="dashboard-status-count">
              {statusCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      </div>

      {/* STUDENT TABLE */}
      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : (
        <div className="students-card">
          <div className="student-table-wrapper">
            {filteredStudents.length === 0 ? (
              <div className="empty-table">
                <p className="empty-title">No students found</p>
                <p className="empty-subtitle">
                  {search || schoolFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try changing the search, school, or status filter.'
                    : 'Add a student to get started.'}
                </p>
              </div>
            ) : (
              <table className="student-table">
                <thead>
                  <tr>
                    <th>STUDENT</th>
                    <th>PROGRAM / SCHOOL</th>
                    <th>STATUS &amp; PAYMENT</th>
                    <th>ACTIVITY</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map((student) => {
                    const metric = studentMetrics[student.id] || {
                      progress: 0,
                      paymentState: 'none',
                      status: 'in-progress',
                    }
                    const paymentLabel = {
                      paid: 'Paid',
                      pending: 'Pending',
                      overdue: 'Overdue',
                      none: 'No Invoice',
                    }[metric.paymentState]
                    const actionOpen = openActionMenu === student.id

                    return (
                      <tr key={student.id}>
                        <td>
                          <Link
                            to={`/admin/students/${student.id}`}
                            className="student-row-link"
                            aria-label={`Open ${student.name}`}
                          >
                            <span className="student-avatar">
                              {getInitials(student.name)}
                            </span>
                            <span className="student-primary">
                              <span className="student-name">
                                {student.name || 'Unnamed student'}
                              </span>
                              <span className="student-email">
                                {student.email || 'No email address'}
                              </span>
                            </span>
                          </Link>
                        </td>

                        <td>
                          <div className="program-cell">
                            <span className="program-name">
                              {student.program || 'General'} / {student.university || '—'}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="status-payment-cell">
                            <span
                              className={`student-active-badge ${metric.status === 'completed' ? 'active' : 'inactive'}`}
                            >
                              <span className="status-dot" />
                              {metric.status === 'completed' ? 'Completed' : 'In Progress'}
                            </span>
                            {metric.paymentState !== 'none' && (
                              <>
                                <span className="status-payment-separator">•</span>
                                <span className={`payment-badge ${metric.paymentState}`}>
                                  {metric.paymentState === 'paid' ? '✓' : ''}
                                  {paymentLabel}
                                </span>
                              </>
                            )}
                            {metric.paymentState === 'none' && (
                              <span className="payment-badge none">NO INVOICE</span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="activity-cell">
                            <div className="activity-meter-row">
                              <div className="activity-progress activity-segments">
                                {Array.from({ length: 7 }).map((_, index) => (
                                  <span
                                    key={index}
                                    className={
                                      index < Math.round(metric.progress / 14.2857)
                                        ? 'filled'
                                        : ''
                                    }
                                  />
                                ))}
                              </div>
                              <span className="activity-value">{metric.progress}%</span>
                            </div>
                          </div>
                        </td>
                        <td className="student-row-actions-cell">
                          <div className="student-row-actions">
                            {student.email ? (
                              <button type="button" className="student-action-icon" onClick={() => openQuickContact(student)} aria-label={`Quick contact ${student.name}`} title="Quick contact">✉</button>
                            ) : (
                              <span className="student-action-icon disabled" aria-hidden="true">✉</span>
                            )}
                            <button
                              type="button"
                              className={`student-action-icon menu-trigger ${actionOpen ? 'open' : ''}`}
                              onClick={(event) => {
                                if (actionOpen) {
                                  setOpenActionMenu(null)
                                  setActionMenuPosition(null)
                                  return
                                }

                                const rect = event.currentTarget.getBoundingClientRect()
                                const menuWidth = 290
                                const margin = 12
                                const left = Math.max(
                                  margin,
                                  Math.min(
                                    rect.right - menuWidth,
                                    window.innerWidth - menuWidth - margin
                                  )
                                )
                                const estimatedHeight = 260
                                const spaceBelow = window.innerHeight - rect.bottom - margin
                                const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight

                                setActionMenuPosition({
                                  left,
                                  top: openUpward
                                    ? Math.max(margin, rect.top - estimatedHeight - 8)
                                    : rect.bottom + 8,
                                })
                                setOpenActionMenu(student.id)
                              }}
                              aria-label={`Actions for ${student.name}`}
                              aria-expanded={actionOpen}
                            >⋮</button>
                            {actionOpen && actionMenuPosition && (
                              <div
                                className="student-action-menu"
                                style={{ left: actionMenuPosition.left, top: actionMenuPosition.top }}
                                role="menu"
                                aria-label={`More actions for ${student.name}`}
                              >
                                <Link to={`/admin/students/${student.id}`} role="menuitem">
                                  <span className="action-menu-icon">↗</span>
                                  <span>View Full Profile</span>
                                </Link>
                                <Link to={`/admin/students/${student.id}`} role="menuitem">
                                  <span className="action-menu-icon">✎</span>
                                  <span>Edit Student / Program Details</span>
                                </Link>
                                <Link to="/admin/payments" role="menuitem">
                                  <span className="action-menu-icon">$</span>
                                  <span>Manage Payment / Invoices</span>
                                </Link>
                                <button type="button" role="menuitem" onClick={() => exportStudentData(student)}>
                                  <span className="action-menu-icon">↓</span>
                                  <span>Export Student Data</span>
                                </button>
                                <button type="button" role="menuitem" className="danger" onClick={() => archiveOrDeleteStudent(student)}>
                                  <span className="action-menu-icon">⌫</span>
                                  <span>Archive / Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}


      {/* QUICK CONTACT MODAL */}
      {contactStudent && (
        <div className="contact-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeQuickContact() }}>
          <div className="contact-modal" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="contact-modal-header">
              <div><span className="contact-modal-kicker">QUICK CONTACT</span><h2 id="contact-modal-title">{contactStudent.name}</h2><p>{contactStudent.email || 'No email address'}</p></div>
              <button type="button" className="contact-modal-close" onClick={closeQuickContact} aria-label="Close">×</button>
            </div>
            <div className="contact-modal-tabs">
              <button type="button" className={contactMode === 'compose' ? 'active' : ''} onClick={() => setContactMode('compose')}>Send Email / Message</button>
              <button type="button" className={contactMode === 'progress' ? 'active' : ''} onClick={() => setContactMode('progress')}>Progress Nudge</button>
              <button type="button" className={contactMode === 'payment' ? 'active' : ''} onClick={() => setContactMode('payment')}>Payment Nudge</button>
            </div>
            {contactMode === 'compose' ? (
              <form className="contact-modal-form" onSubmit={sendQuickEmail}>
                <label>To<input value={contactStudent.email || ''} readOnly /></label>
                <label>Subject<input value={contactSubject} onChange={(e) => setContactSubject(e.target.value)} placeholder="Subject" /></label>
                <label>Message<textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder="Write your message..." rows={6} /></label>
                <div className="contact-modal-footer"><button type="button" onClick={closeQuickContact}>Cancel</button><button type="submit" className="primary">Open Email</button></div>
              </form>
            ) : (
              <div className="contact-nudge-panel">
                <div className="contact-nudge-icon">✉</div>
                <h3>{contactMode === 'progress' ? 'Send a progress check-in?' : 'Send a payment reminder?'}</h3>
                <p>{contactMode === 'progress' ? `This opens your default mail client with a progress message for ${contactStudent.name}.` : `This opens your default mail client with a payment reminder for ${contactStudent.name}.`}</p>
                <div className="contact-modal-footer"><button type="button" onClick={closeQuickContact}>Cancel</button><button type="button" className="primary" onClick={() => sendNudge(contactStudent, contactMode)}>Open Email</button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showAddStudent && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAddStudent()
            }
          }}
        >
          <div
            className="add-student-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Add Student</h2>
                <p>Enter the student's information below.</p>
              </div>
              <button
                type="button"
                className="modal-close-button"
                onClick={closeAddStudent}
                disabled={saving}
              >
                ×
              </button>
            </div>

            {error && <div className="modal-error">{error}</div>}

            <form onSubmit={handleAddStudent} className="add-student-form">
              <div className="modal-section-heading">
                <span className="modal-section-number">1</span>
                <div>
                  <h3>Student Information</h3>
                  <p>Basic information used throughout the student profile.</p>
                </div>
              </div>

              <div className="modal-form-grid">
                <label className="modal-field-wide">
                  Name <span className="required-mark">*</span>
                  <input type="text" name="name" value={form.name} onChange={handleChange} required autoFocus placeholder="Student full name" />
                </label>

                <label>
                  Email
                  <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="student@example.com" />
                </label>

                <label>
                  University <span className="required-mark">*</span>
                  <select name="university" value={form.university} onChange={handleChange} required>
                    <option value="AUHS">AUHS</option>
                    <option value="PACIFIC">PACIFIC</option>
                  </select>
                </label>

                <label>
                  Program / Course
                  <input type="text" name="program" value={form.program} onChange={handleChange} placeholder="Program or course" />
                </label>

                <label>
                  Subject
                  <input type="text" name="subject" value={form.subject} onChange={handleChange} placeholder="Subject" />
                </label>

                <label>
                  Phone
                  <input type="text" name="phone" value={form.phone} onChange={handleChange} placeholder="Phone number" />
                </label>

                <label>
                  Status Page Slug
                  <input type="text" name="slug" value={form.slug} onChange={handleChange} placeholder="john-smith" />
                </label>

                <label className="modal-status-label">
                  Status
                  <span className="modal-checkbox-row">
                    <input type="checkbox" name="active" checked={form.active} onChange={handleChange} />
                    <span className="modal-toggle-text"><strong>Active student</strong><small>Student is currently being tutored</small></span>
                  </span>
                </label>
              </div>

              <div className="modal-section-heading credentials-heading">
                <span className="modal-section-number">2</span>
                <div>
                  <h3>Learning Systems</h3>
                  <p>Optional login credentials. You can add these later from Student Details.</p>
                </div>
              </div>

              <div className="modal-learning-grid">
                <div className="modal-system-card">
                  <div className="modal-system-title"><span className="system-icon">C</span><div><strong>Canvas</strong><small>Learning System</small></div></div>
                  <div className="modal-system-fields">
                    <label>Username<input type="text" name="canvas_un" value={form.canvas_un} onChange={handleChange} autoComplete="off" placeholder="Canvas username" /></label>
                    <label>Password<div className="modal-password-field"><input type={showCanvasPassword ? 'text' : 'password'} name="canvas_pw" value={form.canvas_pw} onChange={handleChange} autoComplete="new-password" placeholder="Canvas password" /><button type="button" className="show-password-button" onClick={() => setShowCanvasPassword(current => !current)}>{showCanvasPassword ? 'Hide' : 'Show'}</button></div></label>
                  </div>
                </div>

                <div className="modal-system-card">
                  <div className="modal-system-title"><span className="system-icon corelms">L</span><div><strong>CORELMS</strong><small>Learning System</small></div></div>
                  <div className="modal-system-fields">
                    <label>Username<input type="text" name="corelms_un" value={form.corelms_un} onChange={handleChange} autoComplete="off" placeholder="CORELMS username" /></label>
                    <label>Password<div className="modal-password-field"><input type={showCorelmsPassword ? 'text' : 'password'} name="corelms_pw" value={form.corelms_pw} onChange={handleChange} autoComplete="new-password" placeholder="CORELMS password" /><button type="button" className="show-password-button" onClick={() => setShowCorelmsPassword(current => !current)}>{showCorelmsPassword ? 'Hide' : 'Show'}</button></div></label>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <div className="modal-required-hint"><span className="required-mark">*</span> Required fields</div>
                <button type="button" className="cancel-button" onClick={closeAddStudent} disabled={saving}>Cancel</button>
                <button type="submit" className="primary-button modal-submit-button" disabled={saving}>{saving ? 'Adding Student...' : 'Add Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE STUDENTS MODAL */}
      {showDeleteStudents && (
        <div
          className="modal-overlay delete-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setShowDeleteStudents(false)
              setSelectedStudents([])
              setError('')
            }
          }}
        >
          <div
            className="delete-students-modal delete-modal-v2"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="delete-modal-header">
              <div className="delete-modal-title-wrap">
                <div className="delete-modal-icon">⌫</div>
                <div>
                  <div className="delete-modal-kicker">STUDENT MANAGER</div>
                  <h2>Delete Students</h2>
                  <p>Choose the student records you want to permanently remove.</p>
                </div>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={() => {
                  if (deleting) return
                  setShowDeleteStudents(false)
                  setSelectedStudents([])
                  setError('')
                }}
                disabled={deleting}
                aria-label="Close delete students"
              >
                ×
              </button>
            </div>

            <div className="delete-danger-banner">
              <strong>Permanent deletion</strong>
              <span>Deleted student records cannot be recovered from this dashboard.</span>
            </div>

            {error && <div className="modal-error">{error}</div>}

            <div className="delete-toolbar">
              <div className="delete-search-wrap">
                <span className="delete-search-icon">⌕</span>
                <input
                  type="text"
                  value={deleteSearch}
                  onChange={(event) => setDeleteSearch(event.target.value)}
                  placeholder="Search students..."
                  disabled={deleting}
                />
              </div>

              <select
                value={deleteSchoolFilter}
                onChange={(event) => setDeleteSchoolFilter(event.target.value)}
                disabled={deleting}
                aria-label="Filter by school"
              >
                <option value="all">All Schools</option>
                <option value="AUHS">AUHS</option>
                <option value="PACIFIC">PACIFIC</option>
              </select>

              <select
                value={deleteStatusFilter}
                onChange={(event) => setDeleteStatusFilter(event.target.value)}
                disabled={deleting}
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="delete-selection-bar">
              <label className="delete-select-all">
                <input
                  type="checkbox"
                  checked={allVisibleDeleteSelected}
                  onChange={toggleVisibleDeleteSelection}
                  disabled={deleting || deleteFilteredStudents.length === 0}
                />
                <span>Select visible</span>
              </label>

              <div className="delete-selection-meta">
                <span>{deleteFilteredStudents.length} shown</span>
                <strong>{selectedStudents.length} selected</strong>
              </div>
            </div>

            <div className="delete-student-list-v2">
              {deleteFilteredStudents.length === 0 ? (
                <div className="delete-empty-v2">
                  <div className="delete-empty-icon">⌕</div>
                  <strong>No students found</strong>
                  <span>Try changing your search or filters.</span>
                </div>
              ) : (
                deleteFilteredStudents.map((student) => {
                  const isSelected = selectedStudents.includes(student.id)
                  const metric = studentMetrics[student.id] || { status: 'in-progress' }

                  return (
                    <label
                      key={student.id}
                      className={
                        isSelected
                          ? 'delete-student-row-v2 selected'
                          : 'delete-student-row-v2'
                      }
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleStudentSelection(student.id)}
                        disabled={deleting}
                      />

                      <span className="delete-student-avatar">
                        {getInitials(student.name)}
                      </span>

                      <span className="delete-student-main">
                        <span className="delete-student-name">{student.name}</span>
                        <span className="delete-student-subline">
                          {student.email || 'No email address'}
                        </span>
                      </span>

                      <span className="delete-student-tags">
                        <span className="delete-tag school">{student.university || '—'}</span>
                        {student.program && (
                          <span className="delete-tag">{student.program}</span>
                        )}
                        <span className={`delete-tag ${metric.status === 'completed' ? 'complete' : 'progress'}`}>
                          {metric.status === 'completed' ? 'Completed' : 'In Progress'}
                        </span>
                      </span>

                      <span className="delete-row-indicator" aria-hidden="true">
                        {isSelected ? '✓' : ''}
                      </span>
                    </label>
                  )
                })
              )}
            </div>

            <div className="delete-modal-footer">
              <div className="delete-footer-warning">
                {selectedStudents.length > 0
                  ? `${selectedStudents.length} student${selectedStudents.length === 1 ? '' : 's'} will be deleted.`
                  : 'No students selected.'}
              </div>

              <div className="delete-footer-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    if (deleting) return
                    setShowDeleteStudents(false)
                    setSelectedStudents([])
                    setError('')
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="delete-selected-button delete-button-v2"
                  onClick={handleDeleteSelected}
                  disabled={deleting || selectedStudents.length === 0}
                >
                  {deleting
                    ? 'Deleting...'
                    : `Delete ${selectedStudents.length > 0 ? `Selected (${selectedStudents.length})` : 'Selected'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard