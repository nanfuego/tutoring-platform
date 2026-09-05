import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import './DashboardStudentActions.css'

const EMPTY_FORM = {
  name: '',
  email: '',
  university: 'AUHS',
  program: '',
  phone: '',
  slug: '',
  active: true,
  canvas_un: '',
  canvas_pw: '',
  corelms_un: '',
  corelms_pw: '',
}

export default function DashboardStudentActions() {
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [students, setStudents] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [deleteSearch, setDeleteSearch] = useState('')
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCanvasPassword, setShowCanvasPassword] = useState(false)
  const [showCorelmsPassword, setShowCorelmsPassword] = useState(false)

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

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      university: form.university,
      program: form.program.trim() || null,
      phone: form.phone.trim() || null,
      slug: form.slug.trim() || null,
      active: Boolean(form.active),
      canvas_un: form.canvas_un.trim() || null,
      canvas_pw: form.canvas_pw || null,
      corelms_un: form.corelms_un.trim() || null,
      corelms_pw: form.corelms_pw || null,
    }

    if (!payload.name) {
      setError('Student name is required.')
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase
      .from('students')
      .insert(payload)

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setModal(null)
    window.location.reload()
  }

  const visibleStudents = useMemo(() => {
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

  function toggleStudent(id) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  function toggleAllVisible() {
    const ids = visibleStudents.map((student) => student.id)
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

    const confirmed = window.confirm(
      `Delete ${selectedIds.length} student${
        selectedIds.length === 1 ? '' : 's'
      }? This cannot be undone.`
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
    setModal(null)
    window.location.reload()
  }

  return (
    <>
      <section className="dashboard-progress-style-header">
        <div className="dashboard-progress-style-copy">
          <span className="dashboard-progress-eyebrow">
            STUDENT MANAGEMENT
          </span>

          <h1>Dashboard</h1>

          <p>
            Monitor students, activity progress, and overall platform activity.
          </p>
        </div>

        <div className="dashboard-progress-style-actions">
          <button
            type="button"
            className="dashboard-progress-primary"
            onClick={openAddStudent}
          >
            <span className="dashboard-progress-plus">+</span>
            Add Student
          </button>

          <button
            type="button"
            className="dashboard-progress-danger"
            onClick={openDeleteStudents}
          >
            Delete Student
          </button>
        </div>
      </section>

      {modal === 'add' && (
        <div
          className="dsa-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}
        >
          <form
            className="dsa-modal"
            onSubmit={handleAddStudent}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dsa-header">
              <div>
                <span>STUDENT MANAGEMENT</span>
                <h2>Add Student</h2>
                <p>Create a new student profile.</p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            {error && (
              <div className="dsa-error">{error}</div>
            )}

            <div className="dsa-grid">
              <label className="wide">
                Name *
                <input
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
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
                  onChange={handleFormChange}
                />
              </label>

              <label>
                Phone
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleFormChange}
                />
              </label>

              <label>
                School
                <select
                  name="university"
                  value={form.university}
                  onChange={handleFormChange}
                >
                  <option value="AUHS">AUHS</option>
                  <option value="PACIFIC">PACIFIC</option>
                </select>
              </label>

              <label>
                Program / Course
                <input
                  name="program"
                  value={form.program}
                  onChange={handleFormChange}
                />
              </label>

              <label>
                Status Page Slug
                <input
                  name="slug"
                  value={form.slug}
                  onChange={handleFormChange}
                />
              </label>

              <label className="wide dsa-check">
                <input
                  type="checkbox"
                  name="active"
                  checked={form.active}
                  onChange={handleFormChange}
                />
                Active student
              </label>
            </div>

            <div className="dsa-credentials">
              <div>
                <strong>Canvas</strong>
                <input
                  name="canvas_un"
                  value={form.canvas_un}
                  onChange={handleFormChange}
                  placeholder="Username"
                />
                <div className="dsa-password">
                  <input
                    type={showCanvasPassword ? 'text' : 'password'}
                    name="canvas_pw"
                    value={form.canvas_pw}
                    onChange={handleFormChange}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowCanvasPassword((value) => !value)
                    }
                  >
                    {showCanvasPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <strong>CORELMS</strong>
                <input
                  name="corelms_un"
                  value={form.corelms_un}
                  onChange={handleFormChange}
                  placeholder="Username"
                />
                <div className="dsa-password">
                  <input
                    type={showCorelmsPassword ? 'text' : 'password'}
                    name="corelms_pw"
                    value={form.corelms_pw}
                    onChange={handleFormChange}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowCorelmsPassword((value) => !value)
                    }
                  >
                    {showCorelmsPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>

            <div className="dsa-footer">
              <button
                type="button"
                className="secondary"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Add Student'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modal === 'delete' && (
        <div
          className="dsa-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}
        >
          <div
            className="dsa-modal delete-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dsa-header">
              <div>
                <span>STUDENT MANAGEMENT</span>
                <h2>Delete Students</h2>
                <p>
                  Select one or more students to permanently remove.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            {error && (
              <div className="dsa-error">{error}</div>
            )}

            <div className="dsa-delete-toolbar">
              <input
                value={deleteSearch}
                onChange={(event) =>
                  setDeleteSearch(event.target.value)
                }
                placeholder="Search students..."
              />
              <span>{selectedIds.length} selected</span>
            </div>

            <button
              type="button"
              className="dsa-select-all"
              onClick={toggleAllVisible}
              disabled={
                loadingStudents ||
                visibleStudents.length === 0
              }
            >
              Select visible students
            </button>

            <div className="dsa-student-list">
              {loadingStudents ? (
                <div className="dsa-empty">
                  Loading students...
                </div>
              ) : visibleStudents.length === 0 ? (
                <div className="dsa-empty">
                  No students found.
                </div>
              ) : (
                visibleStudents.map((student) => {
                  const checked =
                    selectedIds.includes(student.id)

                  return (
                    <label
                      key={student.id}
                      className={
                        checked
                          ? 'dsa-student selected'
                          : 'dsa-student'
                      }
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleStudent(student.id)
                        }
                      />

                      <span>
                        <strong>
                          {student.name ||
                            'Unnamed student'}
                        </strong>
                        <small>
                          {student.email || 'No email'} ·{' '}
                          {student.university || '—'}
                        </small>
                      </span>
                    </label>
                  )
                })
              )}
            </div>

            <div className="dsa-footer">
              <button
                type="button"
                className="secondary"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="danger"
                onClick={handleDeleteStudents}
                disabled={
                  saving ||
                  selectedIds.length === 0
                }
              >
                {saving
                  ? 'Deleting...'
                  : `Delete Selected${
                      selectedIds.length
                        ? ` (${selectedIds.length})`
                        : ''
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
