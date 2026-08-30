import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import './AdminDashboard.css'

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

function AdminDashboard() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  // Add Student modal
  const [showAddStudent, setShowAddStudent] = useState(false)

  // Delete Students modal
  const [showDeleteStudents, setShowDeleteStudents] = useState(false)

  // General states
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState([])
  const [error, setError] = useState('')

  // Canvas password visibility
  const [showCanvasPassword, setShowCanvasPassword] = useState(false)

  // Live clock
  const [currentTime, setCurrentTime] = useState(() => formatNow())

  // Search + Status filter
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | active | inactive

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(formatNow()), 30000)
    return () => clearInterval(timer)
  }, [])

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
  })

  useEffect(() => {
    fetchStudents()
  }, [])

  async function fetchStudents() {
    setLoading(true)

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error loading students:', error)
      setError(error.message)
    }

    setStudents(data || [])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  // =========================================
  // FORM HANDLING
  // =========================================

  function handleChange(event) {
    const { name, value, type, checked } = event.target

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // =========================================
  // OPEN ADD STUDENT
  // =========================================

  function openAddStudent() {
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
    })

    setShowCanvasPassword(false)
    setShowAddStudent(true)
  }

  // =========================================
  // CLOSE ADD STUDENT
  // =========================================

  function closeAddStudent() {
    if (saving) return

    setShowAddStudent(false)
    setError('')
  }

  // =========================================
  // ADD STUDENT
  // =========================================

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

  // =========================================
  // DELETE SELECTION
  // =========================================

  function toggleStudentSelection(studentId) {
    setSelectedStudents((current) => {
      if (current.includes(studentId)) {
        return current.filter((id) => id !== studentId)
      }

      return [...current, studentId]
    })
  }

  function toggleSelectAll() {
    if (students.length === 0) {
      return
    }

    if (selectedStudents.length === students.length) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(students.map((student) => student.id))
    }
  }

  // =========================================
  // DELETE SELECTED STUDENTS
  // =========================================

  async function handleDeleteSelected() {
    if (selectedStudents.length === 0) {
      return
    }

    const selectedStudentObjects = students.filter((student) =>
      selectedStudents.includes(student.id)
    )

    const names = selectedStudentObjects
      .map((student) => student.name)
      .join(', ')

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${names}?\n\nThis will remove their profiles and associated notes.`
    )

    if (!confirmed) {
      return
    }

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
      current.filter(
        (student) => !selectedStudents.includes(student.id)
      )
    )

    setSelectedStudents([])
    setDeleting(false)
    setShowDeleteStudents(false)
  }

  // =========================================
  // FILTER STUDENTS
  // =========================================

  const filteredStudents = students.filter((student) => {
    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchesSearch =
        student.name?.toLowerCase().includes(q) ||
        student.email?.toLowerCase().includes(q) ||
        student.phone?.toLowerCase().includes(q) ||
        student.subject?.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }

    // Status filter
    if (statusFilter === 'active' && !student.active) return false
    if (statusFilter === 'inactive' && student.active) return false

    return true
  })

  const auhsStudents = filteredStudents.filter(
    (student) => student.university === 'AUHS'
  )

  const pacificStudents = filteredStudents.filter(
    (student) => student.university === 'PACIFIC'
  )

  // =========================================
  // STUDENT TABLE
  // =========================================

  function StudentTable({ students }) {
    return (
      <div className="student-table-wrapper">
        {students.length === 0 ? (
          <div className="empty-table">
            <p className="empty-title">No students found</p>
            <p className="empty-subtitle">
              {search || statusFilter !== 'all'
                ? 'Try changing the search or filter.'
                : 'Add a student to get started.'}
            </p>
          </div>
        ) : (
          <table className="student-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Subject</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <Link
                      to={`/admin/students/${student.id}`}
                      className="student-name-link"
                    >
                      {student.name}
                    </Link>
                  </td>
                  <td>{student.email || '—'}</td>
                  <td>{student.subject || '—'}</td>
                  <td>{student.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  // =========================================
  // PAGE
  // =========================================

  return (
    <div className="admin-page">

      {/* TOP BAR */}

      <div className="admin-topbar">

        <div className="admin-topbar-row">

          <div className="admin-heading">
            <p className="admin-welcome">
              Welcome, Joyce!
            </p>
            <p className="admin-clock">
              {currentTime}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="logout-button"
          >
            Sign Out
          </button>

        </div>

        <div className="student-action-buttons">

          <button
            type="button"
            onClick={openAddStudent}
            className="add-student-button"
          >
            + Add Student
          </button>
          <button
            type="button"
            onClick={() => {
              setError('')
              setSelectedStudents([])
              setShowDeleteStudents(true)
            }}
            className="delete-students-button"
          >
            <span className="trash-icon"> 🗑 </span>Delete Students
          </button>

          <Link to="/admin/payments" className="create-invoice-button">
            💵 Payments
          </Link>

        </div>

      </div>

      <hr className="admin-divider" />

      {/* Search + Status Filter */}
      <div className="dashboard-controls">
        <input
          type="text"
          className="dashboard-search"
          placeholder="Search by name, email, phone, or subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="status-filters">
          <button
            className={statusFilter === 'all' ? 'filter-pill active' : 'filter-pill'}
            onClick={() => setStatusFilter('all')}
          >
            All
          </button>
          <button
            className={statusFilter === 'active' ? 'filter-pill active' : 'filter-pill'}
            onClick={() => setStatusFilter('active')}
          >
            Active
          </button>
          <button
            className={statusFilter === 'inactive' ? 'filter-pill active' : 'filter-pill'}
            onClick={() => setStatusFilter('inactive')}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* ERROR */}

      {error && !showAddStudent && !showDeleteStudents && (
        <div className="dashboard-error">
          {error}
        </div>
      )}


      {/* STUDENT TABLES */}

      {loading ? (

        <p className="loading-text">
          Loading...
        </p>

      ) : (

        <div className="university-container">

          {/* AUHS */}

          <section className="university-card">

            <div className="university-header">

              <h2>
                AUHS
              </h2>

              <span>
                {auhsStudents.length}
              </span>

            </div>

            <StudentTable
              students={auhsStudents}
            />

          </section>


          {/* PACIFIC */}

          <section className="university-card">

            <div className="university-header">

              <h2>
                PACIFIC
              </h2>

              <span>
                {pacificStudents.length}
              </span>

            </div>

            <StudentTable
              students={pacificStudents}
            />

          </section>

        </div>

      )}


      {/* =====================================
          ADD STUDENT MODAL
          ===================================== */}

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

                <h2>
                  Add Student
                </h2>

                <p>
                  Enter the student's information below.
                </p>

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


            {error && (
              <div className="modal-error">
                {error}
              </div>
            )}


            <form
              onSubmit={handleAddStudent}
              className="add-student-form"
            >

              <div className="modal-form-grid">

                <label>
                  Name

                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    autoFocus
                  />
                </label>


                <label>
                  Email

                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                  />
                </label>


                <label>
                  University

                  <select
                    name="university"
                    value={form.university}
                    onChange={handleChange}
                    required
                  >
                    <option value="AUHS">
                      AUHS
                    </option>

                    <option value="PACIFIC">
                      PACIFIC
                    </option>
                  </select>

                </label>


                <label>
                  Subject

                  <input
                    type="text"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                  />
                </label>


                <label>
                  Program / Course

                  <input
                    type="text"
                    name="program"
                    value={form.program}
                    onChange={handleChange}
                  />
                </label>


                <label>
                  Phone

                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </label>


                <label>
                  Status Page Slug

                  <input
                    type="text"
                    name="slug"
                    value={form.slug}
                    onChange={handleChange}
                    placeholder="example: john-smith"
                  />
                </label>


                <label className="modal-status-label">

                  Status

                  <span className="modal-checkbox-row">

                    <input
                      type="checkbox"
                      name="active"
                      checked={form.active}
                      onChange={handleChange}
                    />

                    Active student

                  </span>

                </label>

              </div>


              {/* CANVAS */}

              <div className="modal-canvas-section">

                <div className="modal-canvas-heading">

                  <h3>
                    Canvas
                  </h3>

                  <p>
                    Canvas login information for this student.
                  </p>

                </div>


                <div className="modal-canvas-grid">

                  <label>
                    UN

                    <input
                      type="text"
                      name="canvas_un"
                      value={form.canvas_un}
                      onChange={handleChange}
                      autoComplete="off"
                    />

                  </label>


                  <label>
                    PW

                    <div className="modal-password-field">

                      <input
                        type={
                          showCanvasPassword
                            ? 'text'
                            : 'password'
                        }
                        name="canvas_pw"
                        value={form.canvas_pw}
                        onChange={handleChange}
                        autoComplete="off"
                      />

                      <button
                        type="button"
                        className="show-password-button"
                        onClick={() =>
                          setShowCanvasPassword(
                            (current) => !current
                          )
                        }
                      >
                        {showCanvasPassword
                          ? 'Hide'
                          : 'Show'}
                      </button>

                    </div>

                  </label>

                </div>

              </div>


              {/* ACTIONS */}

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeAddStudent}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? 'Adding Student...'
                    : 'Add Student'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}


      {/* =====================================
          DELETE STUDENTS MODAL
          ===================================== */}

      {showDeleteStudents && (

        <div
          className="modal-overlay"
          onMouseDown={(event) => {

            if (event.target === event.currentTarget) {

              if (!deleting) {
                setShowDeleteStudents(false)
                setSelectedStudents([])
                setError('')
              }

            }

          }}
        >

          <div
            className="delete-students-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >

            {/* HEADER */}

            <div className="modal-header">

              <div>

                <h2>
                  Delete Students
                </h2>

                <p>
                  Select the students you want to delete.
                </p>

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
              >
                ×
              </button>

            </div>


            {/* ERROR */}

            {error && (
              <div className="modal-error">
                {error}
              </div>
            )}


            {/* SELECT ALL */}

            <div className="select-all-row">

              <label className="student-checkbox-label">

                <input
                  type="checkbox"
                  checked={
                    students.length > 0 &&
                    selectedStudents.length === students.length
                  }
                  onChange={toggleSelectAll}
                  disabled={
                    deleting ||
                    students.length === 0
                  }
                />

                <span>
                  Select All
                </span>

              </label>


              <span className="selected-count">
                {selectedStudents.length} selected
              </span>

            </div>


            {/* STUDENT LIST */}

            <div className="simple-delete-list">

              {students.length === 0 ? (

                <div className="delete-empty">
                  No students available.
                </div>

              ) : (

                students.map((student) => {

                  const isSelected =
                    selectedStudents.includes(student.id)

                  return (

                    <label
                      key={student.id}
                      className={
                        isSelected
                          ? 'simple-delete-row selected'
                          : 'simple-delete-row'
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


                      <div className="simple-student-info">

                        <div className="simple-student-name">
                          {student.name}
                        </div>

                        <div className="simple-student-details">

                          <span className="university-label">
                            {student.university || '—'}
                          </span>

                          <span>
                            {student.email || 'No email'}
                          </span>

                          <span>
                            {student.subject || 'No subject'}
                          </span>

                          <span
                            className={
                              student.active
                                ? 'delete-status active'
                                : 'delete-status inactive'
                            }
                          >
                            {student.active
                              ? 'Active'
                              : 'Inactive'}
                          </span>

                        </div>

                      </div>

                    </label>

                  )

                })

              )}

            </div>


            {/* ACTIONS */}

            <div className="modal-actions">

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
                className="delete-selected-button"
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

      )}

    </div>
  )
}

export default AdminDashboard
