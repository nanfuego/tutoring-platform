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
  const [activeSemester, setActiveSemester] = useState(null)
  const [semesterStudentIds, setSemesterStudentIds] = useState([])

  // Student profile modal (dashboard quick view / edit)
  const [profileStudent, setProfileStudent] = useState(null)
  const [profileForm, setProfileForm] = useState(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')

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

    const [
      studentsRes,
      paymentsRes,
      requirementsRes,
      activityRes,
      semesterRes,
      semesterStudentsRes,
    ] = await Promise.all([
      supabase.from('students').select('*').order('name'),
      supabase.from('payments').select('student_id, status, due_date'),
      supabase
        .from('activity_requirements')
        .select('id, student_id, semester_id, label, week'),
      supabase
        .from('student_activity')
        .select('student_id, completed, requirement_id'),
      supabase
        .from('semesters')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase.from('semester_students').select('semester_id, student_id'),
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

    const semester = semesterRes.data?.[0] || null
    const ssRows = semesterStudentsRes.data || []

    setStudents(studentsRes.data || [])
    setPayments(paymentsRes.data || [])
    setActivity(activityRes.data || [])
    setActivityRequirements(requirementsRes.data || [])
    setActiveSemester(semester)
    setSemesterStudentIds(
      semester
        ? ssRows
            .filter((row) => row.semester_id === semester.id)
            .map((row) => row.student_id)
        : []
    )
    setLoading(false)
  }

  function openProfileModal(student) {
    setOpenActionMenu(null)
    setActionMenuPosition(null)
    setProfileMessage('')
    setProfileStudent(student)
    setProfileForm({
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      university: student.university || '',
      program: student.program || '',
      subject: student.subject || '',
      final_grade: student.final_grade || '',
      clinic: student.clinic || '',
      active: student.active !== false,
    })
  }

  function closeProfileModal() {
    if (profileSaving) return
    setProfileStudent(null)
    setProfileForm(null)
    setProfileMessage('')
  }

  function handleProfileChange(event) {
    const { name, value, type, checked } = event.target
    setProfileForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleProfileSave(event) {
    event.preventDefault()
    if (!profileStudent || !profileForm) return

    setProfileSaving(true)
    setProfileMessage('')
    setError('')

    const updates = {
      name: profileForm.name.trim(),
      email: profileForm.email.trim() || null,
      phone: profileForm.phone.trim() || null,
      university: profileForm.university || null,
      program: profileForm.program.trim() || null,
      subject: profileForm.subject.trim() || null,
      final_grade: profileForm.final_grade.trim() || null,
      clinic: profileForm.clinic.trim() || null,
      active: profileForm.active,
    }

    const { data, error: updateError } = await supabase
      .from('students')
      .update(updates)
      .eq('id', profileStudent.id)
      .select()
      .single()

    setProfileSaving(false)

    if (updateError) {
      // Graceful fallback if final_grade column is not migrated yet
      if (
        updateError.message?.includes('final_grade') ||
        updateError.code === 'PGRST204'
      ) {
        const { final_grade, ...withoutGrade } = updates
        const retry = await supabase
          .from('students')
          .update(withoutGrade)
          .eq('id', profileStudent.id)
          .select()
          .single()

        if (retry.error) {
          setError(retry.error.message)
          return
        }

        setStudents((current) =>
          current.map((s) =>
            s.id === profileStudent.id ? retry.data : s
          )
        )
        setProfileStudent(retry.data)
        setProfileMessage(
          'Saved (add a final_grade column in Supabase to store grades).'
        )
        return
      }

      setError(updateError.message)
      return
    }

    setStudents((current) =>
      current.map((s) => (s.id === profileStudent.id ? data : s))
    )
    setProfileStudent(data)
    setProfileMessage('Changes saved.')
    setTimeout(() => setProfileMessage(''), 2500)
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
    const semesterSet = new Set(semesterStudentIds)

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

    // Prefer current-semester requirements when an active semester exists
    const relevantRequirements = activeSemester
      ? activityRequirements.filter(
          (r) =>
            r.semester_id === activeSemester.id ||
            (r.semester_id == null &&
              (!r.student_id || semesterSet.has(r.student_id)))
        )
      : activityRequirements

    return students.reduce((map, student) => {
      const reqsForStudent = relevantRequirements.filter(
        (r) => !r.student_id || r.student_id === student.id
      )
      const reqIds = new Set(reqsForStudent.map((r) => r.id))
      const studentActivity = (activityByStudent[student.id] || []).filter(
        (item) => reqIds.has(item.requirement_id)
      )
      const completed = studentActivity.filter((item) => item.completed).length
      const total = reqsForStudent.length
      const progress = total
        ? Math.min(100, Math.round((completed / total) * 100))
        : 0

      const completedIds = new Set(
        studentActivity
          .filter((item) => item.completed)
          .map((item) => item.requirement_id)
      )
      const nextActivity =
        reqsForStudent.find((r) => !completedIds.has(r.id)) || null

      map[student.id] = {
        progress,
        completed,
        total,
        paymentState: getPaymentState(paymentsByStudent[student.id] || []),
        status: progress >= 100 && total > 0 ? 'completed' : 'in-progress',
        inCurrentSemester: semesterSet.has(student.id),
        semesterName: semesterSet.has(student.id)
          ? activeSemester?.name || 'Current'
          : activeSemester
            ? 'Not assigned'
            : '—',
        currentActivityLabel: nextActivity
          ? nextActivity.label
          : total > 0
            ? 'All complete'
            : 'No activities',
      }

      return map
    }, {})
  }, [
    students,
    payments,
    activity,
    activityRequirements,
    activeSemester,
    semesterStudentIds,
  ])

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
      <section className="dashboard-filter-card">

        <div className="dashboard-filter-search">
          <span className="dashboard-search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search by name, email, phone, or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="dashboard-clear-search"
              onClick={() => setSearch('')}
            >
              ×
            </button>
          )}
        </div>

        <select
          className="dashboard-filter-select"
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
        >
          <option value="all">All Schools</option>
          <option value="AUHS">AUHS</option>
          <option value="PACIFIC">PACIFIC</option>
        </select>

        <div
          className="dashboard-filter-pills"
          role="tablist"
          aria-label="Student status"
        >
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
                  ? 'dashboard-filter-pill active'
                  : 'dashboard-filter-pill'
              }
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label}
              <span className="dashboard-filter-pill-count">
                {statusCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="dashboard-filter-count">
          Showing{' '}
          <strong>{filteredStudents.length}</strong>
          {' '}of{' '}
          <strong>{students.length}</strong>
        </div>

      </section>

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
              <table className="student-table student-table-revamp">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Phone</th>
                    <th>School / Program</th>
                    <th>Final Grade</th>
                    <th>Semester</th>
                    <th>Current Activity</th>
                    <th>Progress</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map((student) => {
                    const metric = studentMetrics[student.id] || {
                      progress: 0,
                      completed: 0,
                      total: 0,
                      paymentState: 'none',
                      status: 'in-progress',
                      semesterName: '—',
                      currentActivityLabel: '—',
                    }
                    const actionOpen = openActionMenu === student.id

                    return (
                      <tr key={student.id}>
                        <td>
                          <button
                            type="button"
                            className="student-row-link student-row-open"
                            onClick={() => openProfileModal(student)}
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
                                {student.email || 'No email'}
                              </span>
                            </span>
                          </button>
                        </td>

                        <td>
                          <span className="dash-cell-text">
                            {student.phone || '—'}
                          </span>
                        </td>

                        <td>
                          <div className="program-cell">
                            <span className="program-name">
                              {student.university || '—'}
                            </span>
                            <span className="program-sub">
                              {student.program || 'General'}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              student.final_grade
                                ? 'dash-grade'
                                : 'dash-cell-muted'
                            }
                          >
                            {student.final_grade || '—'}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              metric.inCurrentSemester
                                ? 'dash-semester'
                                : 'dash-cell-muted'
                            }
                          >
                            {metric.semesterName}
                          </span>
                        </td>

                        <td>
                          <span
                            className="dash-activity-label"
                            title={metric.currentActivityLabel}
                          >
                            {metric.currentActivityLabel}
                          </span>
                        </td>

                        <td>
                          <div className="dash-progress-cell">
                            <div className="dash-progress-track">
                              <div
                                className="dash-progress-fill"
                                style={{
                                  width: `${metric.progress}%`,
                                }}
                              />
                            </div>
                            <strong>{metric.progress}%</strong>
                            <span>
                              {metric.completed}/{metric.total}
                            </span>
                          </div>
                        </td>

                        <td className="student-row-actions-cell">
                          <div className="student-row-actions">
                            <button
                              type="button"
                              className={`student-action-icon menu-trigger ${actionOpen ? 'open' : ''}`}
                              onClick={(event) => {
                                if (actionOpen) {
                                  setOpenActionMenu(null)
                                  setActionMenuPosition(null)
                                  return
                                }

                                const rect =
                                  event.currentTarget.getBoundingClientRect()
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
                                const spaceBelow =
                                  window.innerHeight - rect.bottom - margin
                                const openUpward =
                                  spaceBelow < estimatedHeight &&
                                  rect.top > estimatedHeight

                                setActionMenuPosition({
                                  left,
                                  top: openUpward
                                    ? Math.max(
                                        margin,
                                        rect.top - estimatedHeight - 8
                                      )
                                    : rect.bottom + 8,
                                })
                                setOpenActionMenu(student.id)
                              }}
                              aria-label={`Actions for ${student.name}`}
                              aria-expanded={actionOpen}
                            >
                              ⋮
                            </button>
                            {actionOpen && actionMenuPosition && (
                              <div
                                className="student-action-menu"
                                style={{
                                  left: actionMenuPosition.left,
                                  top: actionMenuPosition.top,
                                }}
                                role="menu"
                                aria-label={`More actions for ${student.name}`}
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => openProfileModal(student)}
                                >
                                  <span className="action-menu-icon">◎</span>
                                  <span>Quick Profile</span>
                                </button>
                                <Link
                                  to={`/admin/students/${student.id}`}
                                  role="menuitem"
                                >
                                  <span className="action-menu-icon">↗</span>
                                  <span>View Full Profile</span>
                                </Link>
                                <Link to="/admin/payments" role="menuitem">
                                  <span className="action-menu-icon">$</span>
                                  <span>Manage Payment / Invoices</span>
                                </Link>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => exportStudentData(student)}
                                >
                                  <span className="action-menu-icon">↓</span>
                                  <span>Export Student Data</span>
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="danger"
                                  onClick={() =>
                                    archiveOrDeleteStudent(student)
                                  }
                                >
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

      {/* Student profile modal — floating cards */}
      {profileStudent && profileForm && (
        <div
          className="profile-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeProfileModal()
          }}
        >
          <div
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="profile-modal-header">
              <div className="profile-modal-identity">
                <span className="student-avatar profile-modal-avatar">
                  {getInitials(profileForm.name)}
                </span>
                <div>
                  <span className="profile-modal-kicker">STUDENT PROFILE</span>
                  <h2 id="profile-modal-title">
                    {profileForm.name || 'Student'}
                  </h2>
                  <p>{profileForm.email || 'No email'}</p>
                </div>
              </div>
              <div className="profile-modal-header-actions">
                {profileMessage && (
                  <span className="profile-save-message">{profileMessage}</span>
                )}
                <button
                  type="submit"
                  form="dashboard-profile-form"
                  className="profile-save-button"
                  disabled={profileSaving}
                >
                  {profileSaving ? 'Saving...' : 'Save'}
                </button>
                <Link
                  to={`/admin/students/${profileStudent.id}`}
                  className="profile-full-link"
                >
                  Full page →
                </Link>
                <button
                  type="button"
                  className="profile-modal-close"
                  onClick={closeProfileModal}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <form
              id="dashboard-profile-form"
              className="profile-modal-body"
              onSubmit={handleProfileSave}
            >
              <div className="profile-card-grid">
                <section className="profile-float-card">
                  <header>
                    <h3>Contact</h3>
                    <span>Name, email, phone</span>
                  </header>
                  <div className="profile-card-fields">
                    <label>
                      <span>Name</span>
                      <input
                        name="name"
                        value={profileForm.name}
                        onChange={handleProfileChange}
                        required
                      />
                    </label>
                    <label>
                      <span>Email</span>
                      <input
                        type="email"
                        name="email"
                        value={profileForm.email}
                        onChange={handleProfileChange}
                      />
                    </label>
                    <label>
                      <span>Phone</span>
                      <input
                        name="phone"
                        value={profileForm.phone}
                        onChange={handleProfileChange}
                      />
                    </label>
                  </div>
                </section>

                <section className="profile-float-card">
                  <header>
                    <h3>School & Program</h3>
                    <span>Enrollment details</span>
                  </header>
                  <div className="profile-card-fields">
                    <label>
                      <span>School</span>
                      <select
                        name="university"
                        value={profileForm.university}
                        onChange={handleProfileChange}
                      >
                        <option value="">Select</option>
                        <option value="AUHS">AUHS</option>
                        <option value="PACIFIC">PACIFIC</option>
                      </select>
                    </label>
                    <label>
                      <span>Program</span>
                      <input
                        name="program"
                        value={profileForm.program}
                        onChange={handleProfileChange}
                      />
                    </label>
                    <label>
                      <span>Subject</span>
                      <input
                        name="subject"
                        value={profileForm.subject}
                        onChange={handleProfileChange}
                      />
                    </label>
                    <label>
                      <span>Clinic</span>
                      <input
                        name="clinic"
                        value={profileForm.clinic}
                        onChange={handleProfileChange}
                      />
                    </label>
                  </div>
                </section>

                <section className="profile-float-card profile-float-card-accent">
                  <header>
                    <h3>Final Grades</h3>
                    <span>Record outcome</span>
                  </header>
                  <div className="profile-card-fields">
                    <label className="profile-field-wide">
                      <span>Final grade</span>
                      <input
                        name="final_grade"
                        value={profileForm.final_grade}
                        onChange={handleProfileChange}
                        placeholder="e.g. A, 92%, Pass"
                      />
                    </label>
                  </div>
                </section>

                <section className="profile-float-card">
                  <header>
                    <h3>Current Semester</h3>
                    <span>
                      {activeSemester?.name || 'No active semester'}
                    </span>
                  </header>
                  <div className="profile-stat-row">
                    <div>
                      <small>Assignment</small>
                      <strong>
                        {studentMetrics[profileStudent.id]?.inCurrentSemester
                          ? 'Assigned'
                          : 'Not assigned'}
                      </strong>
                    </div>
                    <div>
                      <small>Semester</small>
                      <strong>
                        {studentMetrics[profileStudent.id]?.semesterName ||
                          '—'}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="profile-float-card">
                  <header>
                    <h3>Activity Progress</h3>
                    <span>
                      {studentMetrics[profileStudent.id]?.currentActivityLabel ||
                        '—'}
                    </span>
                  </header>
                  <div className="profile-progress-block">
                    <div className="dash-progress-track profile-progress-track">
                      <div
                        className="dash-progress-fill"
                        style={{
                          width: `${studentMetrics[profileStudent.id]?.progress || 0}%`,
                        }}
                      />
                    </div>
                    <div className="profile-stat-row">
                      <div>
                        <small>Progress</small>
                        <strong>
                          {studentMetrics[profileStudent.id]?.progress || 0}%
                        </strong>
                      </div>
                      <div>
                        <small>Completed</small>
                        <strong>
                          {studentMetrics[profileStudent.id]?.completed || 0}
                          /
                          {studentMetrics[profileStudent.id]?.total || 0}
                        </strong>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard