import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import './StudentDetail.css'

function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [student, setStudent] = useState(null)
  const [notes, setNotes] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addingNote, setAddingNote] = useState(false)

  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  // Password visibility
  const [showCanvasPassword, setShowCanvasPassword] = useState(false)
  const [showCorelmsPassword, setShowCorelmsPassword] = useState(false)

  // New note
  const [newNote, setNewNote] = useState('')

  useEffect(() => {
    fetchStudent()
    fetchNotes()
  }, [id])

  async function fetchStudent() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error loading student:', error)
      setError(error.message)
      setLoading(false)
      return
    }

    setStudent(data)
    setLoading(false)
  }

  async function fetchNotes() {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('student_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading notes:', error)
      return
    }

    setNotes(data || [])
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target

    setStudent((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSave(event) {
    event.preventDefault()

    if (!student) return

    setSaving(true)
    setError('')
    setSavedMessage('')

    const updates = {
      name: student.name,
      email: student.email || null,
      university: student.university || null,
      program: student.program || null,
      phone: student.phone || null,
      subject: student.subject || null,
      slug: student.slug || null,
      active: student.active,

      // Canvas
      canvas_un: student.canvas_un || null,
      canvas_pw: student.canvas_pw || null,

      // CORELMS
      corelms_un: student.corelms_un || null,
      corelms_pw: student.corelms_pw || null,
    }

    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error saving student:', error)
      setError(error.message)
      setSaving(false)
      return
    }

    setStudent(data)
    setSavedMessage('Changes saved.')

    setTimeout(() => {
      setSavedMessage('')
    }, 2500)

    setSaving(false)
  }

  async function handleAddNote(event) {
    event.preventDefault()

    if (!newNote.trim()) {
      return
    }

    setAddingNote(true)
    setError('')

    const { data, error } = await supabase
      .from('notes')
      .insert({
        student_id: id,
        content: newNote.trim(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding note:', error)
      setError(error.message)
      setAddingNote(false)
      return
    }

    setNotes((current) => [data, ...current])
    setNewNote('')
    setAddingNote(false)
  }

  async function handleDeleteNote(noteId) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this note?'
    )

    if (!confirmed) {
      return
    }

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)

    if (error) {
      console.error('Error deleting note:', error)
      setError(error.message)
      return
    }

    setNotes((current) =>
      current.filter((note) => note.id !== noteId)
    )
  }

  function formatDate(dateString) {
    if (!dateString) return ''

    return new Date(dateString).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="detail-page">
        <p className="loading-text">
          Loading student...
        </p>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="detail-page">

        <Link
          to="/admin"
          className="back-link"
        >
          ← Back to Students
        </Link>

        <div className="detail-error">
          Student could not be found.
        </div>

      </div>
    )
  }

  return (
    <div className="detail-page">

      {/* BACK */}

      <Link
        to="/admin"
        className="back-link"
      >
        ← Back to Students
      </Link>


      {/* HEADER */}

      <div className="detail-header">

        <div>

          <h1>
            Student Detail
          </h1>

          <p>
            Manage student information and monitoring notes.
          </p>

        </div>

      </div>


      {/* ERROR */}

      {error && (
        <div className="detail-error">
          {error}
        </div>
      )}


      {/* STUDENT PROFILE */}

      <form
        className="detail-form"
        onSubmit={handleSave}
      >

        <div className="form-section-title">
          <h2>
            Student Information
          </h2>

          <p>
            Basic information about the student.
          </p>
        </div>


        <div className="detail-grid">

          <label>
            Name

            <input
              type="text"
              name="name"
              value={student.name || ''}
              onChange={handleChange}
              required
            />

          </label>


          <label>
            Email

            <input
              type="email"
              name="email"
              value={student.email || ''}
              onChange={handleChange}
            />

          </label>


          <label>
            University

            <select
              name="university"
              value={student.university || ''}
              onChange={handleChange}
            >
              <option value="">
                Select University
              </option>

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
              value={student.subject || ''}
              onChange={handleChange}
            />

          </label>


          <label>
            Program / Course

            <input
              type="text"
              name="program"
              value={student.program || ''}
              onChange={handleChange}
            />

          </label>


          <label>
            Phone

            <input
              type="text"
              name="phone"
              value={student.phone || ''}
              onChange={handleChange}
            />

          </label>


          <label>
            Status Page Slug

            <input
              type="text"
              name="slug"
              value={student.slug || ''}
              onChange={handleChange}
            />

          </label>


          <label className="active-field">

            Status

            <span className="active-checkbox">

              <input
                type="checkbox"
                name="active"
                checked={Boolean(student.active)}
                onChange={handleChange}
              />

              Active student

            </span>

          </label>

        </div>


        {/* STATUS PAGE PREVIEW */}

        {student.slug && (
          <div className="status-link-preview">

            Student Status Page:

            <a
              href={`/status/${student.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              /status/{student.slug}
            </a>

          </div>
        )}


        {/* =====================================
            CANVAS
            ===================================== */}

        <div className="credentials-section">

          <div className="credentials-heading">

            <h2>
              Canvas
            </h2>

            <p>
              Canvas login information.
            </p>

          </div>


          <div className="credentials-grid">

            <label>
              UN

              <input
                type="text"
                name="canvas_un"
                value={student.canvas_un || ''}
                onChange={handleChange}
                autoComplete="off"
              />

            </label>


            <label>
              PW

              <div className="password-field">

                <input
                  type={
                    showCanvasPassword
                      ? 'text'
                      : 'password'
                  }
                  name="canvas_pw"
                  value={student.canvas_pw || ''}
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


        {/* =====================================
            CORELMS
            ===================================== */}

        <div className="credentials-section">

          <div className="credentials-heading">

            <h2>
              CORELMS
            </h2>

            <p>
              CORELMS login information.
            </p>

          </div>


          <div className="credentials-grid">

            <label>
              UN

              <input
                type="text"
                name="corelms_un"
                value={student.corelms_un || ''}
                onChange={handleChange}
                autoComplete="off"
              />

            </label>


            <label>
              PW

              <div className="password-field">

                <input
                  type={
                    showCorelmsPassword
                      ? 'text'
                      : 'password'
                  }
                  name="corelms_pw"
                  value={student.corelms_pw || ''}
                  onChange={handleChange}
                  autoComplete="off"
                />

                <button
                  type="button"
                  className="show-password-button"
                  onClick={() =>
                    setShowCorelmsPassword(
                      (current) => !current
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


        {/* SAVE */}

        <div className="save-row">

          <button
            type="submit"
            className="save-button"
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : 'Save Changes'}
          </button>

          {savedMessage && (
            <span className="saved-msg">
              {savedMessage}
            </span>
          )}

        </div>

      </form>


      {/* =====================================
          NOTES
          ===================================== */}

      <section className="notes-section">

        <div className="section-heading">

          <div>

            <h2>
              Monitoring Notes
            </h2>

            <p>
              Keep a running record of meetings,
              progress, observations, and assistance.
            </p>

          </div>

          <span className="note-count">
            {notes.length}
          </span>

        </div>


        {/* ADD NOTE */}

        <form
          className="note-form"
          onSubmit={handleAddNote}
        >

          <textarea
            value={newNote}
            onChange={(event) =>
              setNewNote(event.target.value)
            }
            placeholder="Add a note about this student..."
            rows="4"
          />

          <div className="note-form-actions">

            <button
              type="submit"
              className="add-note-button"
              disabled={
                addingNote ||
                !newNote.trim()
              }
            >
              {addingNote
                ? 'Adding...'
                : 'Add Note'}
            </button>

          </div>

        </form>


        {/* NOTES LIST */}

        {notes.length === 0 ? (

          <div className="no-notes">
            No monitoring notes yet.
          </div>

        ) : (

          <ul className="note-list">

            {notes.map((note) => (

              <li
                key={note.id}
                className="note-item"
              >

                <div className="note-content">
                  {note.content}
                </div>


                <div className="note-footer">

                  <span className="note-date">
                    {formatDate(note.created_at)}
                  </span>

                  <button
                    type="button"
                    className="delete-note-button"
                    onClick={() =>
                      handleDeleteNote(note.id)
                    }
                  >
                    Delete
                  </button>

                </div>

              </li>

            ))}

          </ul>

        )}

      </section>

    </div>
  )
}

export default StudentDetail