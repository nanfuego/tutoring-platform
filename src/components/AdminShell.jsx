import { Link, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import './AdminShell.css'
import './UniversalAdminTheme.css'
import './AdminShell.signout.css'

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

const EMPTY_FORM = {
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
}

export default function AdminShell({ children }) {
  const location = useLocation()
  const [currentTime, setCurrentTime] = useState(() => formatNow())

  const [modal, setModal] = useState(null)
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [showCanvasPassword, setShowCanvasPassword] = useState(false)
  const [showCorelmsPassword, setShowCorelmsPassword] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [deleteSearch, setDeleteSearch] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(formatNow()), 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!modal) return

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) closeModal()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [modal, saving])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function closeModal() {
    if (saving) return
    setModal(null)
    setError('')
    setSelectedIds([])
    setDeleteSearch('')
  }

  function openAddStudent() {
    setError('')
    setForm({ ...EMPTY_FORM })
    setShowCanvasPassword(false)
    setShowCorelmsPassword(false)
    setModal('add')
  }

  async function openDeleteStudents() {
    setError('')
    setSelectedIds([])
    setDeleteSearch('')
    setModal('delete')
    setLoadingStudents(true)

    const { data, error: loadError } = await supabase
      .from('students')
      .select('id, name, email, university, program, active')
      .order('name')

    if (loadError) {
      setError(loadError.message)
      setStudents([])
    } else {
      setStudents(data || [])
    }

    setLoadingStudents(false)
  }

  function handleFormChange(event) {
    const { name, value, type, checked } = event.target

    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
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
      active: Boolean(form.active),
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

    const { error: insertError } = await supabase
      .from('students')
      .insert(newStudent)

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    closeModal()
    window.location.reload()
  }

  const visibleDeleteStudents = useMemo(() => {
    const query = deleteSearch.trim().toLowerCase()

    if (!query) return students

    return students.filter((student) =>
      [
        student.name,
        student.email,
        student.university,
        student.program,
      ].some((value) =>
        value?.toLowerCase().includes(query)
      )
    )
  }, [students, deleteSearch])

  function toggleDeleteStudent(id) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((studentId) => studentId !== id)
        : [...current, id]
    )
  }

  function toggleAllVisible() {
    const ids = visibleDeleteStudents.map(
      (student) => student.id
    )

    const allSelected =
      ids.length > 0 &&
      ids.every((id) => selectedIds.includes(id))

    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])]
    )
  }

  async function handleDeleteStudents() {
    if (!selectedIds.length) return

    const selectedNames = students
      .filter((student) =>
        selectedIds.includes(student.id)
      )
      .map((student) => student.name)
      .join(', ')

    const confirmed = window.confirm(
      `Permanently delete ${selectedNames}?\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    setSaving(true)
    setError('')

    const { error: deleteError } = await supabase
      .from('students')
      .delete()
      .in('id', selectedIds)

    if (deleteError) {
      setError(deleteError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    closeModal()
    window.location.reload()
  }

  const isDashboard = location.pathname === '/admin'
  const isActivity = location.pathname === '/admin/activity'
  const isPayments = location.pathname === '/admin/payments'

  return (
    <div className="universal-admin-page">
      <header className="universal-admin-header">
        <div className="universal-admin-header-row">
          <div>
            <p className="universal-admin-welcome">
              Welcome, Joyce!
            </p>

            <p className="universal-admin-clock">
              {currentTime}
            </p>
          </div>

          <button
            type="button"
            className="universal-admin-logout"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>

        <nav className="universal-admin-nav">
          <Link
            to="/admin"
            className={`universal-admin-nav-link ${
              isDashboard ? 'active' : ''
            }`}
          >
            Dashboard
          </Link>

          <span className="universal-admin-divider" />

          <Link
            to="/admin/activity"
            className={`universal-admin-nav-link ${
              isActivity ? 'active' : ''
            }`}
          >
            Student Progress
          </Link>

          <Link
            to="/admin/payments"
            className={`universal-admin-nav-link ${
              isPayments ? 'active' : ''
            }`}
          >
            Payment Management
          </Link>
        </nav>
      </header>

      <main className="universal-admin-content">
        {children}
      </main>

      {modal === 'add' && (
        <div
          className="universal-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal()
            }
          }}
        >
          <form
            className="universal-modal add-modal"
            onSubmit={handleAddStudent}
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="universal-modal-header">
              <div>
                <span className="universal-modal-kicker">
                  STUDENT MANAGER
                </span>

                <h2>Add Student</h2>

                <p>
                  Create a student profile and optionally
                  save both learning-system credentials.
                </p>
              </div>

              <button
                type="button"
                className="universal-modal-close"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            {error && (
              <div className="universal-modal-error">
                {error}
              </div>
            )}

            <section className="universal-form-section">
              <div className="universal-section-title">
                <span>01</span>

                <div>
                  <h3>Student Information</h3>
                  <p>
                    Basic information used throughout
                    the platform.
                  </p>
                </div>
              </div>

              <div className="universal-form-grid">
                <label className="full">
                  <span>Full Name *</span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    required
                    autoFocus
                  />
                </label>

                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleFormChange}
                  />
                </label>

                <label>
                  <span>Phone</span>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleFormChange}
                  />
                </label>

                <label>
                  <span>School</span>
                  <select
                    name="university"
                    value={form.university}
                    onChange={handleFormChange}
                  >
                    <option value="AUHS">AUHS</option>
                    <option value="PACIFIC">
                      PACIFIC
                    </option>
                  </select>
                </label>

                <label>
                  <span>Program / Course</span>
                  <input
                    name="program"
                    value={form.program}
                    onChange={handleFormChange}
                  />
                </label>

                <label>
                  <span>Subject</span>
                  <input
                    name="subject"
                    value={form.subject}
                    onChange={handleFormChange}
                  />
                </label>

                <label className="full">
                  <span>Status Page Slug</span>
                  <input
                    name="slug"
                    value={form.slug}
                    onChange={handleFormChange}
                    placeholder="optional"
                  />
                </label>
              </div>
            </section>

            <section className="universal-form-section">
              <div className="universal-section-title">
                <span>02</span>

                <div>
                  <h3>Learning Systems</h3>
                  <p>
                    Optional credentials for the
                    student's online systems.
                  </p>
                </div>
              </div>

              <div className="credential-cards">
                <div className="credential-card">
                  <div className="credential-card-heading">
                    <strong>Canvas</strong>
                    <span>Learning System</span>
                  </div>

                  <label>
                    <span>Username</span>
                    <input
                      name="canvas_un"
                      value={form.canvas_un}
                      onChange={handleFormChange}
                      autoComplete="off"
                    />
                  </label>

                  <label>
                    <span>Password</span>

                    <div className="credential-password">
                      <input
                        type={
                          showCanvasPassword
                            ? 'text'
                            : 'password'
                        }
                        name="canvas_pw"
                        value={form.canvas_pw}
                        onChange={handleFormChange}
                        autoComplete="off"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowCanvasPassword(
                            (value) => !value
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

                <div className="credential-card">
                  <div className="credential-card-heading">
                    <strong>CORELMS</strong>
                    <span>Learning System</span>
                  </div>

                  <label>
                    <span>Username</span>
                    <input
                      name="corelms_un"
                      value={form.corelms_un}
                      onChange={handleFormChange}
                      autoComplete="off"
                    />
                  </label>

                  <label>
                    <span>Password</span>

                    <div className="credential-password">
                      <input
                        type={
                          showCorelmsPassword
                            ? 'text'
                            : 'password'
                        }
                        name="corelms_pw"
                        value={form.corelms_pw}
                        onChange={handleFormChange}
                        autoComplete="off"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowCorelmsPassword(
                            (value) => !value
                          )
                        }
                      >
                        {showCorelmsPassword
                          ? 'Hide'
                          : 'Show'}
                      </button>
                    </div>
                  </label>
                </div>
              </div>
            </section>

            <div className="universal-modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={closeModal}
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
                  ? 'Saving...'
                  : 'Add Student'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modal === 'delete' && (
        <div
          className="universal-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal()
            }
          }}
        >
          <div
            className="universal-modal delete-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="universal-modal-header">
              <div>
                <span className="universal-modal-kicker danger-kicker">
                  STUDENT MANAGER
                </span>

                <h2>Delete Students</h2>

                <p>
                  Select one or more students to
                  permanently remove.
                </p>
              </div>

              <button
                type="button"
                className="universal-modal-close"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            {error && (
              <div className="universal-modal-error">
                {error}
              </div>
            )}

            <div className="delete-toolbar">
              <input
                value={deleteSearch}
                onChange={(event) =>
                  setDeleteSearch(
                    event.target.value
                  )
                }
                placeholder="Search students..."
              />

              <span>
                {selectedIds.length} selected
              </span>
            </div>

            <div className="delete-list">
              <button
                type="button"
                className="delete-select-all"
                onClick={toggleAllVisible}
              >
                <span
                  className={`delete-checkbox ${
                    visibleDeleteStudents.length >
                      0 &&
                    visibleDeleteStudents.every(
                      (student) =>
                        selectedIds.includes(
                          student.id
                        )
                    )
                      ? 'checked'
                      : ''
                  }`}
                >
                  {visibleDeleteStudents.length >
                    0 &&
                  visibleDeleteStudents.every(
                    (student) =>
                      selectedIds.includes(
                        student.id
                      )
                  )
                    ? '✓'
                    : ''}
                </span>

                <span>
                  Select visible students
                </span>
              </button>

              {loadingStudents ? (
                <div className="delete-empty">
                  Loading students...
                </div>
              ) : visibleDeleteStudents.length ===
                0 ? (
                <div className="delete-empty">
                  No students found.
                </div>
              ) : (
                visibleDeleteStudents.map(
                  (student) => {
                    const checked =
                      selectedIds.includes(
                        student.id
                      )

                    return (
                      <button
                        type="button"
                        key={student.id}
                        className={`delete-student-row ${
                          checked
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() =>
                          toggleDeleteStudent(
                            student.id
                          )
                        }
                      >
                        <span
                          className={`delete-checkbox ${
                            checked
                              ? 'checked'
                              : ''
                          }`}
                        >
                          {checked ? '✓' : ''}
                        </span>

                        <span className="delete-student-info">
                          <strong>
                            {student.name ||
                              'Unnamed student'}
                          </strong>

                          <span>
                            {student.program ||
                              'General'}{' '}
                            ·{' '}
                            {student.university ||
                              '—'}
                          </span>
                        </span>

                        <span
                          className={`delete-active-state ${
                            student.active
                              ? 'active'
                              : 'inactive'
                          }`}
                        >
                          {student.active
                            ? 'Active'
                            : 'Inactive'}
                        </span>
                      </button>
                    )
                  }
                )
              )}
            </div>

            <div className="universal-modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="danger-button"
                onClick={handleDeleteStudents}
                disabled={
                  saving ||
                  selectedIds.length === 0
                }
              >
                {saving
                  ? 'Deleting...'
                  : `Delete ${
                      selectedIds.length || ''
                    } Student${
                      selectedIds.length === 1
                        ? ''
                        : 's'
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
