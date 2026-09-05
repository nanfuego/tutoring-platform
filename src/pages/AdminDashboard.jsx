import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import './AdminDashboard.css'
import './AdminDashboard.redesign.css'
import './ActivityTracker.css'

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

const GRADE_PALETTES = {
  green: { background: '#DCFCE7', color: '#15803D', borderColor: '#86EFAC' },
  blue: { background: '#DBEAFE', color: '#1D4ED8', borderColor: '#93C5FD' },
  amber: { background: '#FEF3C7', color: '#B45309', borderColor: '#FCD34D' },
  orange: { background: '#FFEDD5', color: '#C2410C', borderColor: '#FDBA74' },
  red: { background: '#FEE2E2', color: '#B91C1C', borderColor: '#FCA5A5' },
  purple: { background: '#EDE9FE', color: '#6D28D9', borderColor: '#C4B5FD' },
  neutral: { background: '#F1F5F9', color: '#94A3B8', borderColor: '#E2E8F0' },
}

function getGradePalette(grade) {
  if (!grade) return GRADE_PALETTES.neutral

  const value = grade.toString().trim()
  const upper = value.toUpperCase()

  if (upper.startsWith('A') || upper === 'PASS' || upper === 'PASSED') {
    return GRADE_PALETTES.green
  }
  if (upper.startsWith('B')) return GRADE_PALETTES.blue
  if (upper.startsWith('C')) return GRADE_PALETTES.amber
  if (upper.startsWith('D')) return GRADE_PALETTES.orange
  if (upper.startsWith('F') || upper === 'FAIL' || upper === 'FAILED') {
    return GRADE_PALETTES.red
  }
  if (upper.includes('INCOMPLETE') || upper === 'IP' || upper === 'W') {
    return GRADE_PALETTES.purple
  }

  const numericMatch = value.match(/-?\d+(\.\d+)?/)
  if (numericMatch) {
    const numeric = parseFloat(numericMatch[0])
    if (numeric >= 90) return GRADE_PALETTES.green
    if (numeric >= 80) return GRADE_PALETTES.blue
    if (numeric >= 70) return GRADE_PALETTES.amber
    if (numeric >= 60) return GRADE_PALETTES.orange
    return GRADE_PALETTES.red
  }

  return GRADE_PALETTES.purple
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
  const [currentPage, setCurrentPage] = useState(1)
  const STUDENTS_PER_PAGE = 10

  const [openActionMenu, setOpenActionMenu] = useState(null)
  const [actionMenuPosition, setActionMenuPosition] = useState(null)
  const [contactStudent, setContactStudent] = useState(null)
  const [contactMode, setContactMode] = useState('compose')
  const [contactSubject, setContactSubject] = useState('')
  const [contactMessage, setContactMessage] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(formatNow()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Close student row action menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
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
    phone: '',
    slug: '',
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
    setError('')

    setForm({
      name: '',
      email: '',
      university: 'AUHS',
      subject: '',
      phone: '',
      slug: '',
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
      phone: form.phone.trim() || null,
      slug: form.slug.trim() || null,
      active: true,
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

    // Students stay on the Dashboard only until activities are assigned
    // in Activity Tracker → Assign Activity.
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

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE)
  )

  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE
    return filteredStudents.slice(startIndex, startIndex + STUDENTS_PER_PAGE)
  }, [filteredStudents, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, schoolFilter, statusFilter])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

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

      <style>{`
        .dashboard-matched-header {
          margin-bottom: 28px;
        }

        @media (max-width: 760px) {
          .dashboard-matched-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 18px;
          }

          .dashboard-matched-header .activity-page-actions {
            width: 100%;
            flex-wrap: wrap;
          }
        }


        /* --------------------------------------------------------
           ADD STUDENT MODAL V3
        -------------------------------------------------------- */
        .add-student-overlay-v3 {
          padding: 24px;
          background: rgba(15, 23, 42, 0.48);
          backdrop-filter: blur(7px);
        }

        .add-student-modal-v3 {
          width: min(760px, calc(100vw - 32px));
          max-height: min(90vh, 780px);
          overflow-y: auto;
          border: 1px solid #e1e6e9;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 30px 75px rgba(15, 23, 42, 0.26);
          color: #253044;
        }

        .add-student-v3-header {
          position: sticky;
          top: 0;
          z-index: 3;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 20px 22px 17px;
          border-bottom: 1px solid #e9edf0;
          background: rgba(255, 255, 255, 0.97);
          backdrop-filter: blur(8px);
        }

        .add-student-v3-eyebrow {
          display: block;
          margin-bottom: 5px;
          color: #748093;
          font-size: 9px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .add-student-v3-header h2 {
          margin: 0;
          color: #182235;
          font-size: 22px;
          line-height: 1.2;
          font-weight: 750;
          letter-spacing: -0.025em;
        }

        .add-student-v3-header p {
          margin: 5px 0 0;
          max-width: 520px;
          color: #7a8595;
          font-size: 11px;
          line-height: 1.5;
        }

        .add-student-v3-close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          padding: 0;
          flex: 0 0 32px;
          border: 1px solid #dce2e7;
          border-radius: 8px;
          background: #ffffff;
          color: #657182;
          font-size: 19px;
          line-height: 1;
          cursor: pointer;
        }

        .add-student-v3-error {
          margin: 14px 22px 0;
        }

        .add-student-v3-form {
          padding: 18px 22px 0;
        }

        .add-student-v3-section + .add-student-v3-section {
          margin-top: 20px;
          padding-top: 19px;
          border-top: 1px solid #edf0f2;
        }

        .add-student-v3-section-heading {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 13px;
        }

        .add-student-v3-section-heading > span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 27px;
          height: 27px;
          flex: 0 0 27px;
          border-radius: 8px;
          background: #edf3f0;
          color: #174c3a;
          font-size: 9px;
          font-weight: 800;
        }

        .add-student-v3-section-heading h3 {
          margin: 0;
          color: #344055;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 750;
        }

        .add-student-v3-section-heading p {
          margin: 2px 0 0;
          color: #8791a0;
          font-size: 9px;
          line-height: 1.45;
        }

        .add-student-v3-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px 14px;
        }

        .add-student-v3-grid label,
        .add-student-v3-system-card label {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 5px;
          color: #596579;
          font-size: 9px;
          font-weight: 700;
        }

        .add-student-v3-grid label > span,
        .add-student-v3-system-card label > span {
          display: block;
        }

        .add-student-v3-grid b,
        .add-student-v3-required b {
          color: #a83d36;
        }

        .add-student-v3-wide {
          grid-column: 1 / -1;
        }

        .add-student-v3-grid input,
        .add-student-v3-grid select,
        .add-student-v3-system-card input {
          width: 100%;
          height: 36px;
          box-sizing: border-box;
          padding: 0 10px;
          border: 1px solid #dce2e7;
          border-radius: 7px;
          background: #ffffff;
          color: #344055;
          font-family: inherit;
          font-size: 10px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .add-student-v3-grid input:focus,
        .add-student-v3-grid select:focus,
        .add-student-v3-system-card input:focus {
          border-color: #9cb8ad;
          box-shadow: 0 0 0 3px rgba(23, 76, 58, 0.08);
        }

        .add-student-v3-system-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .add-student-v3-system-card {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 11px;
          padding: 14px;
          border: 1px solid #e0e6e3;
          border-radius: 10px;
          background: #f8faf9;
        }

        .add-student-v3-system-title {
          display: flex;
          align-items: center;
          gap: 9px;
          padding-bottom: 2px;
        }

        .add-student-v3-system-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          border-radius: 8px;
          background: #e7f0ec;
          color: #174c3a;
          font-size: 11px;
          font-weight: 800;
        }

        .add-student-v3-system-icon.corelms {
          background: #eef0f5;
          color: #475569;
        }

        .add-student-v3-system-title strong,
        .add-student-v3-system-title small {
          display: block;
        }

        .add-student-v3-system-title strong {
          color: #344055;
          font-size: 11px;
        }

        .add-student-v3-system-title small {
          margin-top: 2px;
          color: #8d97a5;
          font-size: 8px;
        }

        .add-student-v3-password {
          display: flex;
          min-width: 0;
        }

        .add-student-v3-password input {
          min-width: 0;
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }

        .add-student-v3-password button {
          min-width: 54px;
          padding: 0 9px;
          border: 1px solid #dce2e7;
          border-left: 0;
          border-radius: 0 7px 7px 0;
          background: #ffffff;
          color: #536071;
          font-family: inherit;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        .add-student-v3-footer {
          position: sticky;
          bottom: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin: 20px -22px 0;
          padding: 12px 22px;
          border-top: 1px solid #e9edf0;
          background: rgba(250, 251, 251, 0.97);
          backdrop-filter: blur(8px);
        }

        .add-student-v3-required {
          color: #8993a0;
          font-size: 8px;
        }

        .add-student-v3-footer-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .add-student-v3-cancel,
        .add-student-v3-submit {
          min-height: 36px;
          padding: 0 14px;
          border-radius: 7px;
          font-family: inherit;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .add-student-v3-cancel {
          border: 1px solid #d8dfe7;
          background: #ffffff;
          color: #536071;
        }

        .add-student-v3-submit {
          border: 1px solid #174c3a;
          background: #174c3a;
          color: #ffffff;
          box-shadow: 0 3px 8px rgba(23, 76, 58, 0.13);
        }

        .add-student-v3-submit:hover:not(:disabled) {
          border-color: #123f30;
          background: #123f30;
        }

        .add-student-v3-cancel:disabled,
        .add-student-v3-submit:disabled,
        .add-student-v3-close:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .add-student-overlay-v3 {
            padding: 8px;
          }

          .add-student-modal-v3 {
            width: 100%;
            max-height: 96vh;
            border-radius: 12px;
          }

          .add-student-v3-grid,
          .add-student-v3-system-grid {
            grid-template-columns: 1fr;
          }

          .add-student-v3-wide {
            grid-column: auto;
          }

          .add-student-v3-footer {
            align-items: stretch;
            flex-direction: column;
          }

          .add-student-v3-footer-actions {
            width: 100%;
          }

          .add-student-v3-footer-actions button {
            flex: 1;
          }
        }


        /* --------------------------------------------------------
           DELETE STUDENT MODAL V3
        -------------------------------------------------------- */
        .delete-student-overlay-v3 {
          padding: 24px;
          background: rgba(15, 23, 42, 0.48);
          backdrop-filter: blur(7px);
        }

        .delete-student-modal-v3 {
          width: min(820px, calc(100vw - 32px));
          max-height: min(90vh, 820px);
          overflow-y: auto;
          border: 1px solid #e1e6e9;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 30px 75px rgba(15, 23, 42, 0.26);
          color: #253044;
        }

        .delete-student-v3-header {
          position: sticky;
          top: 0;
          z-index: 3;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 20px 22px 17px;
          border-bottom: 1px solid #e9edf0;
          background: rgba(255, 255, 255, 0.97);
          backdrop-filter: blur(8px);
        }

        .delete-student-v3-eyebrow {
          display: block;
          margin-bottom: 5px;
          color: #748093;
          font-size: 9px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .delete-student-v3-header h2 {
          margin: 0;
          color: #182235;
          font-size: 22px;
          line-height: 1.2;
          font-weight: 750;
          letter-spacing: -0.025em;
        }

        .delete-student-v3-header p {
          margin: 5px 0 0;
          max-width: 560px;
          color: #7a8595;
          font-size: 11px;
          line-height: 1.5;
        }

        .delete-student-v3-close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          padding: 0;
          flex: 0 0 32px;
          border: 1px solid #dce2e7;
          border-radius: 8px;
          background: #ffffff;
          color: #657182;
          font-size: 19px;
          line-height: 1;
          cursor: pointer;
        }

        .delete-student-v3-error {
          margin: 14px 22px 0;
        }

        .delete-student-v3-body {
          padding: 18px 22px 0;
        }

        .delete-student-v3-section + .delete-student-v3-section {
          margin-top: 20px;
          padding-top: 19px;
          border-top: 1px solid #edf0f2;
        }

        .delete-student-v3-section-heading {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 13px;
        }

        .delete-student-v3-section-heading > span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 27px;
          height: 27px;
          flex: 0 0 27px;
          border-radius: 8px;
          background: #f5eceb;
          color: #a83d36;
          font-size: 9px;
          font-weight: 800;
        }

        .delete-student-v3-section-heading h3 {
          margin: 0;
          color: #344055;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 750;
        }

        .delete-student-v3-section-heading p {
          margin: 2px 0 0;
          color: #8791a0;
          font-size: 9px;
          line-height: 1.45;
        }

        .delete-student-v3-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 150px 150px;
          gap: 10px;
        }

        .delete-student-v3-search {
          display: flex;
          align-items: center;
          min-width: 0;
          height: 36px;
          padding: 0 10px;
          box-sizing: border-box;
          border: 1px solid #dce2e7;
          border-radius: 7px;
          background: #ffffff;
        }

        .delete-student-v3-search > span {
          margin-right: 7px;
          color: #8b95a3;
          font-size: 13px;
        }

        .delete-student-v3-search input {
          width: 100%;
          min-width: 0;
          height: 32px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #344055;
          font-family: inherit;
          font-size: 10px;
          outline: none;
        }

        .delete-student-v3-toolbar select {
          width: 100%;
          height: 36px;
          padding: 0 9px;
          box-sizing: border-box;
          border: 1px solid #dce2e7;
          border-radius: 7px;
          background: #ffffff;
          color: #344055;
          font-family: inherit;
          font-size: 10px;
          outline: none;
        }

        .delete-student-v3-selection-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 9px;
          padding: 9px 11px;
          border: 1px solid #e1e6e9;
          border-radius: 8px;
          background: #f8faf9;
        }

        .delete-student-v3-selection-bar label {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #526071;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
        }

        .delete-student-v3-selection-bar > div {
          display: flex;
          align-items: center;
          gap: 11px;
          color: #8993a0;
          font-size: 8px;
        }

        .delete-student-v3-selection-bar strong {
          color: #a83d36;
          font-size: 9px;
        }

        .delete-student-v3-list {
          max-height: 330px;
          overflow-y: auto;
          border: 1px solid #e1e6e9;
          border-radius: 10px;
          background: #ffffff;
        }

        .delete-student-v3-row {
          display: grid;
          grid-template-columns: 18px 34px minmax(0, 1fr) auto 24px;
          align-items: center;
          gap: 9px;
          min-height: 56px;
          padding: 8px 11px;
          border-bottom: 1px solid #edf0f2;
          box-sizing: border-box;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease;
        }

        .delete-student-v3-row:last-child {
          border-bottom: 0;
        }

        .delete-student-v3-row:hover {
          background: #fafbfb;
        }

        .delete-student-v3-row.selected {
          background: #fff7f6;
        }

        .delete-student-v3-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #edf3f0;
          color: #174c3a;
          font-size: 9px;
          font-weight: 800;
        }

        .delete-student-v3-main {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 2px;
        }

        .delete-student-v3-main strong {
          overflow: hidden;
          color: #344055;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .delete-student-v3-main small {
          overflow: hidden;
          color: #8a95a4;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .delete-student-v3-tags {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 5px;
          flex-wrap: wrap;
        }

        .delete-student-v3-tag {
          display: inline-flex;
          align-items: center;
          min-height: 20px;
          padding: 0 7px;
          border-radius: 999px;
          background: #f1f4f6;
          color: #667384;
          font-size: 8px;
          font-weight: 700;
          white-space: nowrap;
        }

        .delete-student-v3-tag.school {
          background: #edf3f0;
          color: #174c3a;
        }

        .delete-student-v3-tag.complete {
          background: #e9f4ee;
          color: #215e47;
        }

        .delete-student-v3-tag.progress {
          background: #f5f1e5;
          color: #8a7041;
        }

        .delete-student-v3-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 6px;
          background: #a83d36;
          color: #ffffff;
          font-size: 9px;
          font-weight: 800;
          opacity: 0;
        }

        .delete-student-v3-row.selected .delete-student-v3-check {
          opacity: 1;
        }

        .delete-student-v3-empty {
          display: flex;
          min-height: 180px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #8d97a4;
          text-align: center;
        }

        .delete-student-v3-empty > div {
          margin-bottom: 7px;
          font-size: 18px;
        }

        .delete-student-v3-empty strong {
          color: #536071;
          font-size: 11px;
        }

        .delete-student-v3-empty span {
          margin-top: 3px;
          font-size: 9px;
        }

        .delete-student-v3-footer {
          position: sticky;
          bottom: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-top: 20px;
          padding: 12px 22px;
          border-top: 1px solid #e9edf0;
          background: rgba(250, 251, 251, 0.97);
          backdrop-filter: blur(8px);
        }

        .delete-student-v3-summary {
          color: #8993a0;
          font-size: 8px;
        }

        .delete-student-v3-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .delete-student-v3-cancel,
        .delete-student-v3-submit {
          min-height: 36px;
          padding: 0 14px;
          border-radius: 7px;
          font-family: inherit;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .delete-student-v3-cancel {
          border: 1px solid #d8dfe7;
          background: #ffffff;
          color: #536071;
        }

        .delete-student-v3-submit {
          border: 1px solid #a83d36;
          background: #a83d36;
          color: #ffffff;
          box-shadow: 0 3px 8px rgba(168, 61, 54, 0.18);
        }

        .delete-student-v3-submit:hover:not(:disabled) {
          border-color: #8e302a;
          background: #8e302a;
        }

        .delete-student-v3-cancel:disabled,
        .delete-student-v3-submit:disabled,
        .delete-student-v3-close:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 720px) {
          .delete-student-overlay-v3 {
            padding: 8px;
          }

          .delete-student-modal-v3 {
            width: 100%;
            max-height: 96vh;
            border-radius: 12px;
          }

          .delete-student-v3-toolbar {
            grid-template-columns: 1fr;
          }

          .delete-student-v3-row {
            grid-template-columns: 18px 34px minmax(0, 1fr) 24px;
          }

          .delete-student-v3-tags {
            grid-column: 3 / -1;
            justify-content: flex-start;
          }

          .delete-student-v3-selection-bar,
          .delete-student-v3-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .delete-student-v3-actions {
            width: 100%;
          }

          .delete-student-v3-actions button {
            flex: 1;
          }
        }
      `}</style>
      {error && !showAddStudent && !showDeleteStudents && (
        <div className="dashboard-error">{error}</div>
      )}

      {/* Dashboard header — intentionally matches Student Progress */}
      <section className="activity-page-header dashboard-matched-header">
        <div className="activity-page-header-copy">
          <span className="activity-eyebrow">
            STUDENT MANAGEMENT
          </span>

          <h1>Dashboard</h1>

          <p>
            Monitor students, activity progress, and overall platform activity.
          </p>
        </div>

        <div className="activity-page-actions">
          <button
            type="button"
            className="activity-primary-button"
            onClick={openAddStudent}
          >
            <span className="button-plus">+</span>
            Add Student
          </button>

          <button
            type="button"
            className="activity-danger-button"
            onClick={openDeleteStudents}
          >
            Delete Student
          </button>
        </div>
      </section>
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
                    <th>School/Program</th>
                    <th>Semester</th>
                    <th>Current Activity</th>
                    <th>Progress</th>
                    <th
                      style={{
                        fontWeight: 800,
                        letterSpacing: '0.03em',
                      }}
                    >
                      Final Grade
                    </th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedStudents.map((student) => {
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
                          <span
                            className="dash-cell-text dash-school-program"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              lineHeight: 1.3,
                            }}
                          >
                            <span className="dash-school">
                              {student.university || '—'}
                            </span>
                            <span
                              className="dash-program"
                              style={{ fontSize: '0.85em', opacity: 0.7 }}
                            >
                              {student.program || '—'}
                            </span>
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

                        <td>
                          <span
                            className="dash-grade-badge"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '46px',
                              padding: '4px 12px',
                              borderRadius: '999px',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              letterSpacing: '0.02em',
                              border: `1px solid ${getGradePalette(student.final_grade).borderColor}`,
                              backgroundColor: getGradePalette(student.final_grade).background,
                              color: getGradePalette(student.final_grade).color,
                            }}
                          >
                            {student.final_grade || '—'}
                          </span>
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

          {filteredStudents.length > 0 && (
            <div className="dashboard-pagination">
              <div className="dashboard-pagination-summary">
                Showing{' '}
                <strong>
                  {(currentPage - 1) * STUDENTS_PER_PAGE + 1}
                </strong>
                {' '}–{' '}
                <strong>
                  {Math.min(
                    currentPage * STUDENTS_PER_PAGE,
                    filteredStudents.length
                  )}
                </strong>
                {' '}of <strong>{filteredStudents.length}</strong> students
              </div>

              <div
                className="dashboard-pagination-controls"
                aria-label="Student table pagination"
              >
                <button
                  type="button"
                  className="dashboard-pagination-button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  ← Previous
                </button>

                <span className="dashboard-pagination-page">
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  className="dashboard-pagination-button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
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
          className="modal-overlay add-student-overlay-v3"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAddStudent()
            }
          }}
        >
          <div
            className="add-student-modal add-student-modal-v3"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-student-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="add-student-v3-header">
              <div>
                <span className="add-student-v3-eyebrow">
                  STUDENT MANAGEMENT
                </span>

                <h2 id="add-student-title">Add Student</h2>

                <p>
                  Create the student profile and optionally save
                  learning-system credentials.
                </p>
              </div>

              <button
                type="button"
                className="add-student-v3-close"
                onClick={closeAddStudent}
                disabled={saving}
                aria-label="Close Add Student"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="modal-error add-student-v3-error">
                {error}
              </div>
            )}

            <form
              onSubmit={handleAddStudent}
              className="add-student-v3-form"
            >
              <section className="add-student-v3-section">
                <div className="add-student-v3-section-heading">
                  <span>01</span>

                  <div>
                    <h3>Student Information</h3>
                    <p>
                      Basic details used across the tutoring platform.
                    </p>
                  </div>
                </div>

                <div className="add-student-v3-grid">
                  <label className="add-student-v3-wide">
                    <span>
                      Full Name <b>*</b>
                    </span>

                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      autoFocus
                      placeholder="Student full name"
                    />
                  </label>

                  <label>
                    <span>Email</span>

                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="student@example.com"
                    />
                  </label>

                  <label>
                    <span>Phone</span>

                    <input
                      type="text"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="Phone number"
                    />
                  </label>

                  <label>
                    <span>
                      University <b>*</b>
                    </span>

                    <select
                      name="university"
                      value={form.university}
                      onChange={handleChange}
                      required
                    >
                      <option value="AUHS">AUHS</option>
                      <option value="PACIFIC">PACIFIC</option>
                    </select>
                  </label>

                  <label>
                    <span>Status Page Slug</span>

                    <input
                      type="text"
                      name="slug"
                      value={form.slug}
                      onChange={handleChange}
                      placeholder="john-smith"
                    />
                  </label>
                </div>
              </section>

              <section className="add-student-v3-section add-student-v3-systems-section">
                <div className="add-student-v3-section-heading">
                  <span>02</span>

                  <div>
                    <h3>Learning Systems</h3>
                    <p>
                      Optional credentials. These can also be added later
                      from the student's profile.
                    </p>
                  </div>
                </div>

                <div className="add-student-v3-system-grid">
                  <div className="add-student-v3-system-card">
                    <div className="add-student-v3-system-title">
                      <span className="add-student-v3-system-icon">C</span>

                      <div>
                        <strong>Canvas</strong>
                        <small>Learning System</small>
                      </div>
                    </div>

                    <label>
                      <span>Username</span>

                      <input
                        type="text"
                        name="canvas_un"
                        value={form.canvas_un}
                        onChange={handleChange}
                        autoComplete="off"
                        placeholder="Canvas username"
                      />
                    </label>

                    <label>
                      <span>Password</span>

                      <div className="add-student-v3-password">
                        <input
                          type={showCanvasPassword ? 'text' : 'password'}
                          name="canvas_pw"
                          value={form.canvas_pw}
                          onChange={handleChange}
                          autoComplete="new-password"
                          placeholder="Canvas password"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowCanvasPassword((current) => !current)
                          }
                        >
                          {showCanvasPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </label>
                  </div>

                  <div className="add-student-v3-system-card">
                    <div className="add-student-v3-system-title">
                      <span className="add-student-v3-system-icon corelms">
                        L
                      </span>

                      <div>
                        <strong>CORELMS</strong>
                        <small>Learning System</small>
                      </div>
                    </div>

                    <label>
                      <span>Username</span>

                      <input
                        type="text"
                        name="corelms_un"
                        value={form.corelms_un}
                        onChange={handleChange}
                        autoComplete="off"
                        placeholder="CORELMS username"
                      />
                    </label>

                    <label>
                      <span>Password</span>

                      <div className="add-student-v3-password">
                        <input
                          type={showCorelmsPassword ? 'text' : 'password'}
                          name="corelms_pw"
                          value={form.corelms_pw}
                          onChange={handleChange}
                          autoComplete="new-password"
                          placeholder="CORELMS password"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowCorelmsPassword((current) => !current)
                          }
                        >
                          {showCorelmsPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </label>
                  </div>
                </div>
              </section>

              <div className="add-student-v3-footer">
                <div className="add-student-v3-required">
                  <b>*</b> Required fields
                </div>

                <div className="add-student-v3-footer-actions">
                  <button
                    type="button"
                    className="add-student-v3-cancel"
                    onClick={closeAddStudent}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="add-student-v3-submit"
                    disabled={saving}
                  >
                    {saving ? 'Adding Student...' : 'Add Student'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE STUDENTS MODAL */}
      {showDeleteStudents && (
        <div
          className="modal-overlay delete-student-overlay-v3"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setShowDeleteStudents(false)
              setSelectedStudents([])
              setError('')
            }
          }}
        >
          <div
            className="delete-student-modal-v3"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-student-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="delete-student-v3-header">
              <div>
                <span className="delete-student-v3-eyebrow">
                  STUDENT MANAGEMENT
                </span>

                <h2 id="delete-student-title">Delete Students</h2>

                <p>
                  Select one or more student records to permanently remove
                  from the tutoring platform.
                </p>
              </div>

              <button
                type="button"
                className="delete-student-v3-close"
                onClick={() => {
                  if (deleting) return
                  setShowDeleteStudents(false)
                  setSelectedStudents([])
                  setError('')
                }}
                disabled={deleting}
                aria-label="Close Delete Students"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="modal-error delete-student-v3-error">
                {error}
              </div>
            )}

            <div className="delete-student-v3-body">
              <section className="delete-student-v3-section">
                <div className="delete-student-v3-section-heading">
                  <span>01</span>

                  <div>
                    <h3>Find Students</h3>
                    <p>
                      Search and filter the student list before selecting
                      records to delete.
                    </p>
                  </div>
                </div>

                <div className="delete-student-v3-toolbar">
                  <div className="delete-student-v3-search">
                    <span>⌕</span>

                    <input
                      type="text"
                      value={deleteSearch}
                      onChange={(event) =>
                        setDeleteSearch(event.target.value)
                      }
                      placeholder="Search students..."
                      disabled={deleting}
                    />
                  </div>

                  <select
                    value={deleteSchoolFilter}
                    onChange={(event) =>
                      setDeleteSchoolFilter(event.target.value)
                    }
                    disabled={deleting}
                    aria-label="Filter by school"
                  >
                    <option value="all">All Schools</option>
                    <option value="AUHS">AUHS</option>
                    <option value="PACIFIC">PACIFIC</option>
                  </select>

                  <select
                    value={deleteStatusFilter}
                    onChange={(event) =>
                      setDeleteStatusFilter(event.target.value)
                    }
                    disabled={deleting}
                    aria-label="Filter by status"
                  >
                    <option value="all">All Status</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </section>

              <section className="delete-student-v3-section">
                <div className="delete-student-v3-section-heading">
                  <span>02</span>

                  <div>
                    <h3>Select Students</h3>
                    <p>
                      Choose the records you want to permanently delete.
                    </p>
                  </div>
                </div>

                <div className="delete-student-v3-selection-bar">
                  <label>
                    <input
                      type="checkbox"
                      checked={allVisibleDeleteSelected}
                      onChange={toggleVisibleDeleteSelection}
                      disabled={
                        deleting ||
                        deleteFilteredStudents.length === 0
                      }
                    />

                    <span>Select visible students</span>
                  </label>

                  <div>
                    <span>
                      {deleteFilteredStudents.length} shown
                    </span>

                    <strong>
                      {selectedStudents.length} selected
                    </strong>
                  </div>
                </div>

                <div className="delete-student-v3-list">
                  {deleteFilteredStudents.length === 0 ? (
                    <div className="delete-student-v3-empty">
                      <div>⌕</div>
                      <strong>No students found</strong>
                      <span>
                        Try changing your search or filters.
                      </span>
                    </div>
                  ) : (
                    deleteFilteredStudents.map((student) => {
                      const isSelected =
                        selectedStudents.includes(student.id)

                      const metric =
                        studentMetrics[student.id] || {
                          status: 'in-progress',
                        }

                      return (
                        <label
                          key={student.id}
                          className={
                            isSelected
                              ? 'delete-student-v3-row selected'
                              : 'delete-student-v3-row'
                          }
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              toggleStudentSelection(student.id)
                            }
                            disabled={deleting}
                          />

                          <span className="delete-student-v3-avatar">
                            {getInitials(student.name)}
                          </span>

                          <span className="delete-student-v3-main">
                            <strong>{student.name}</strong>

                            <small>
                              {student.email || 'No email address'}
                            </small>
                          </span>

                          <span className="delete-student-v3-tags">
                            <span className="delete-student-v3-tag school">
                              {student.university || '—'}
                            </span>

                            {student.program && (
                              <span className="delete-student-v3-tag">
                                {student.program}
                              </span>
                            )}

                            <span
                              className={
                                metric.status === 'completed'
                                  ? 'delete-student-v3-tag complete'
                                  : 'delete-student-v3-tag progress'
                              }
                            >
                              {metric.status === 'completed'
                                ? 'Completed'
                                : 'In Progress'}
                            </span>
                          </span>

                          <span className="delete-student-v3-check">
                            {isSelected ? '✓' : ''}
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </section>
            </div>

            <div className="delete-student-v3-footer">
              <div className="delete-student-v3-summary">
                {selectedStudents.length > 0
                  ? `${selectedStudents.length} student${
                      selectedStudents.length === 1 ? '' : 's'
                    } selected`
                  : 'No students selected'}
              </div>

              <div className="delete-student-v3-actions">
                <button
                  type="button"
                  className="delete-student-v3-cancel"
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
                  className="delete-student-v3-submit"
                  onClick={handleDeleteSelected}
                  disabled={
                    deleting ||
                    selectedStudents.length === 0
                  }
                >
                  {deleting
                    ? 'Deleting...'
                    : `Delete Selected${
                        selectedStudents.length > 0
                          ? ` (${selectedStudents.length})`
                          : ''
                      }`}
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