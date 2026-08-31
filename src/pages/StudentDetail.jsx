import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useStudentActivity } from '../hooks/useStudentActivity'
import './StudentDetail.css'
import './StudentDetail.activity-modal.css'

function formatDate(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function formatShortDate(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString([], {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(Number(amount || 0))
}

function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [notes, setNotes] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const [deletingStudent, setDeletingStudent] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [showCanvasPassword, setShowCanvasPassword] = useState(false)
  const [showCorelmsPassword, setShowCorelmsPassword] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [showActivityModal, setShowActivityModal] = useState(false)

  // Checklist state/logic now lives in one shared place — see
  // src/hooks/useStudentActivity.js. StudentActivityModal.jsx uses the same
  // hook, so a fix here fixes both UIs instead of drifting independently.
  const {
    requirements,
    loading: activityLoading,
    error: activityError,
    progress: activityProgress,
    requirementsByWeek: activityRequirementsByWeek,
    getActivity: getStudentActivity,
    toggleRequirement: toggleStudentActivity,
    updateNote: updateStudentActivityNote,
  } = useStudentActivity(id)

  const [savingActivityId, setSavingActivityId] = useState(null)

  useEffect(() => { loadStudentData() }, [id])

  async function loadStudentData() {
    setLoading(true)
    setError('')
    const [studentResult, notesResult, paymentsResult] = await Promise.all([
      supabase.from('students').select('*').eq('id', id).single(),
      supabase.from('notes').select('*').eq('student_id', id).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('student_id', id).order('due_date', { ascending: false }),
    ])

    if (studentResult.error) {
      console.error('Error loading student:', studentResult.error)
      setError(studentResult.error.message)
      setLoading(false)
      return
    }

    if (notesResult.error) console.error('Error loading notes:', notesResult.error)
    if (paymentsResult.error) console.error('Error loading payments:', paymentsResult.error)

    setStudent(studentResult.data)
    setNotes(notesResult.data || [])
    setPayments(paymentsResult.data || [])
    setLoading(false)
  }

  function handleChange(event) {
    const { name, value } = event.target
    setStudent(current => ({ ...current, [name]: value }))
  }

  async function toggleContractComplete() {
    if (!student || saving) return

    // active=true → in progress; active=false → contract completed
    const currentlyCompleted = !Boolean(student.active)
    const nextActive = currentlyCompleted // reactivate if completed; else mark complete

    setSaving(true)
    setError('')
    setSavedMessage('')

    const { data, error: updateError } = await supabase
      .from('students')
      .update({ active: nextActive })
      .eq('id', id)
      .select()
      .single()

    setSaving(false)

    if (updateError) {
      console.error('Error updating contract status:', updateError)
      setError(updateError.message)
      return
    }

    setStudent(data)
    setSavedMessage(
      nextActive
        ? 'Student marked as in progress.'
        : 'Contract marked as completed.'
    )
    setTimeout(() => setSavedMessage(''), 2500)
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
      final_grade: student.final_grade || null,
      slug: student.slug || null,
      active: Boolean(student.active),
      canvas_un: student.canvas_un || null,
      canvas_pw: student.canvas_pw || null,
      corelms_un: student.corelms_un || null,
      corelms_pw: student.corelms_pw || null,
    }

    const { data, error } = await supabase.from('students').update(updates).eq('id', id).select().single()

    if (error) {
      console.error('Error saving student:', error)
      setError(error.message)
      setSaving(false)
      return
    }

    setStudent(data)
    setSavedMessage('Changes saved.')
    setTimeout(() => setSavedMessage(''), 2500)
    setSaving(false)
  }

  async function handleDeleteStudent() {
    if (!student) return
    if (!window.confirm(`Delete ${student.name}? This will permanently remove the student record.`)) return

    setDeletingStudent(true)
    setError('')
    const { error } = await supabase.from('students').delete().eq('id', id)

    if (error) {
      console.error('Error deleting student:', error)
      setError(error.message)
      setDeletingStudent(false)
      return
    }
    navigate('/admin')
  }

  async function handleAddNote(event) {
    event.preventDefault()
    if (!newNote.trim()) return
    setAddingNote(true)
    setError('')

    const { data, error } = await supabase.from('notes').insert({
      student_id: id,
      content: newNote.trim(),
    }).select().single()

    if (error) {
      console.error('Error adding note:', error)
      setError(error.message)
      setAddingNote(false)
      return
    }

    setNotes(current => [data, ...current])
    setNewNote('')
    setAddingNote(false)
  }

  async function handleDeleteNote(noteId) {
    if (!window.confirm('Are you sure you want to delete this note?')) return
    const { error } = await supabase.from('notes').delete().eq('id', noteId)

    if (error) {
      console.error('Error deleting note:', error)
      setError(error.message)
      return
    }
    setNotes(current => current.filter(note => note.id !== noteId))
  }

  async function handleToggleActivity(requirementId) {
    setSavingActivityId(requirementId)
    await toggleStudentActivity(requirementId)
    setSavingActivityId(null)
  }

  const paymentSummary = useMemo(() => {
    const currencies = {}
    payments.forEach(payment => {
      const currency = payment.currency || 'USD'
      if (!currencies[currency]) currencies[currency] = { paid: 0, outstanding: 0, overdue: 0 }
      const amount = Number(payment.amount || 0)
      if (payment.status === 'paid') {
        currencies[currency].paid += amount
      } else {
        currencies[currency].outstanding += amount
        if (payment.due_date && new Date(payment.due_date) < new Date(new Date().toDateString())) {
          currencies[currency].overdue += amount
        }
      }
    })
    return currencies
  }, [payments])

  const paymentSummaryText = useMemo(() => {
    const entries = Object.entries(paymentSummary)
    if (!entries.length) return { outstanding: '—', paid: '—', overdue: '—' }
    const makeText = key => entries.filter(([, values]) => values[key] > 0)
      .map(([currency, values]) => formatMoney(values[key], currency)).join(' + ') || '—'
    return {
      outstanding: makeText('outstanding'),
      paid: makeText('paid'),
      overdue: makeText('overdue'),
    }
  }, [paymentSummary])

  const lastPaidPayment = useMemo(() => payments.filter(p => p.status === 'paid')
    .sort((a, b) => new Date(b.paid_at || b.updated_at || b.invoice_date || 0) - new Date(a.paid_at || a.updated_at || a.invoice_date || 0))[0] || null, [payments])

  const nextPayment = useMemo(() => {
    const today = new Date()
    return payments.filter(p => p.status !== 'paid' && p.due_date && new Date(p.due_date) >= today)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0] || null
  }, [payments])

  const isCompleted = !Boolean(student?.active)

  if (loading) return <div className="detail-page"><div className="detail-loading"><div className="loading-spinner" /><p>Loading student...</p></div></div>

  if (!student) return <div className="detail-page"><Link to="/admin" className="back-link">← Back to Dashboard</Link><div className="detail-error">Student could not be found.</div></div>

  return (
    <div className="detail-page">
     
      <header className="student-hero">
        <div className="student-hero-main">
          <div className="student-avatar">{(student.name || '?').trim().charAt(0).toUpperCase()}</div>
          <div className="student-hero-info">
            <div className="student-title-row">
              <h1>{student.name || 'Student'}</h1>
              {isCompleted ? <span className="completion-badge completed">✓ Completed</span> : <span className="completion-badge in-progress">In Progress</span>}
            </div>
            <p className="student-email">{student.email || 'No email address'}</p>
            <div className="student-meta">
              {student.university && <span>{student.university}</span>}
              {student.final_grade && (
                <span className="hero-final-grade">
                  Grade: {student.final_grade}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="student-hero-actions">
          <button
            type="button"
            className={`contract-complete-button${isCompleted ? ' is-completed' : ''}`}
            onClick={toggleContractComplete}
            disabled={saving}
          >
            {isCompleted ? 'Mark In Progress' : 'Mark Contract Complete'}
          </button>
          <button type="submit" form="student-detail-form" className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </header>

      {error && <div className="detail-error"><strong>Something went wrong:</strong> {error}</div>}

      <section className="quick-stats quick-stats-compact">
        <div className="stat-card"><span className="stat-label">Outstanding</span><strong className="stat-value">{paymentSummaryText.outstanding}</strong></div>
        <div className="stat-card"><span className="stat-label">Collected</span><strong className="stat-value">{paymentSummaryText.paid}</strong></div>
        <div className="stat-card"><span className="stat-label">Activity</span><strong className="stat-value">{activityProgress.total > 0 ? `${activityProgress.percentage}%` : '—'}</strong></div>
        <div className="stat-card"><span className="stat-label">Notes</span><strong className="stat-value">{notes.length}</strong></div>
      </section>

      <form id="student-detail-form" className="student-detail-form student-detail-form-compact" onSubmit={handleSave}>
        <div className="detail-top-grid">
          <section className="detail-card detail-card-compact">
            <div className="card-header">
              <div>
                <h2>Student Information</h2>
              </div>
            </div>
            <div className="detail-grid detail-grid-compact">
              <label><span>Name</span><input type="text" name="name" value={student.name || ''} onChange={handleChange} required /></label>
              <label><span>Email</span><input type="email" name="email" value={student.email || ''} onChange={handleChange} /></label>
              <label><span>Phone</span><input type="text" name="phone" value={student.phone || ''} onChange={handleChange} /></label>
              <label>
                <span>University</span>
                <select name="university" value={student.university || ''} onChange={handleChange}>
                  <option value="">Select University</option>
                  <option value="AUHS">AUHS</option>
                  <option value="PACIFIC">PACIFIC</option>
                </select>
              </label>
              <label className="final-grade-field">
                <span>Final Grade</span>
                <input
                  type="text"
                  name="final_grade"
                  value={student.final_grade || ''}
                  onChange={handleChange}
                  placeholder="e.g. A, 92%, Pass"
                />
              </label>
              <label><span>Status Page Slug</span><input type="text" name="slug" value={student.slug || ''} onChange={handleChange} /></label>
            </div>
            {student.slug && (
              <div className="status-preview">
                <span>Student Status Page</span>
                <a
                  href={`/status/${student.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  /status/{student.slug}
                </a>
              </div>
            )}
          </section>

          <section className="detail-card detail-card-compact">
            <div className="card-header">
              <div>
                <h2>Learning Systems</h2>
              </div>
            </div>
            <div className="learning-systems-block">
              <div className="learning-system-group">
                <h3>Canvas</h3>
                <div className="credentials-grid credentials-grid-compact">
                  <label>
                    <span>Username</span>
                    <input type="text" name="canvas_un" value={student.canvas_un || ''} onChange={handleChange} autoComplete="off" />
                  </label>
                  <label>
                    <span>Password</span>
                    <div className="password-field">
                      <input
                        type={showCanvasPassword ? 'text' : 'password'}
                        name="canvas_pw"
                        value={student.canvas_pw || ''}
                        onChange={handleChange}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="show-password-button"
                        onClick={() => setShowCanvasPassword((current) => !current)}
                      >
                        {showCanvasPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>
                </div>
              </div>
              <div className="learning-system-group">
                <h3>CORELMS</h3>
                <div className="credentials-grid credentials-grid-compact">
                  <label>
                    <span>Username</span>
                    <input type="text" name="corelms_un" value={student.corelms_un || ''} onChange={handleChange} autoComplete="off" />
                  </label>
                  <label>
                    <span>Password</span>
                    <div className="password-field">
                      <input
                        type={showCorelmsPassword ? 'text' : 'password'}
                        name="corelms_pw"
                        value={student.corelms_pw || ''}
                        onChange={handleChange}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="show-password-button"
                        onClick={() => setShowCorelmsPassword((current) => !current)}
                      >
                        {showCorelmsPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="detail-card detail-card-compact payment-card">
          <div className="card-header">
            <div>
              <h2>Payments</h2>
              <p>Summary and history for this student.</p>
            </div>
          </div>
          <div className="payment-summary-grid payment-summary-grid-compact">
            <div className="payment-summary-item"><span>Outstanding</span><strong>{paymentSummaryText.outstanding}</strong></div>
            <div className="payment-summary-item"><span>Collected</span><strong className="paid-amount">{paymentSummaryText.paid}</strong></div>
            <div className="payment-summary-item"><span>Overdue</span><strong className="overdue-amount">{paymentSummaryText.overdue}</strong></div>
            <div className="payment-summary-item"><span>Invoices</span><strong>{payments.length}</strong></div>
          </div>

          <div className="payment-history">
            <div className="payment-history-header">
              <strong>Payment history</strong>
              <span>
                {payments.length}{' '}
                {payments.length === 1 ? 'record' : 'records'}
              </span>
            </div>
            {payments.length === 0 ? (
              <p className="payment-history-empty">No payment records yet.</p>
            ) : (
              <div className="payment-history-table-wrap">
                <table className="payment-history-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Invoice</th>
                      <th>Due</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => {
                      const overdue =
                        payment.status !== 'paid' &&
                        payment.due_date &&
                        new Date(payment.due_date) <
                          new Date(new Date().toDateString())
                      return (
                        <tr key={payment.id}>
                          <td title={payment.description || undefined}>
                            {payment.description || '—'}
                          </td>
                          <td className="payment-history-amount">
                            {formatMoney(payment.amount, payment.currency)}
                          </td>
                          <td>{formatShortDate(payment.invoice_date)}</td>
                          <td className={overdue ? 'overdue-amount' : ''}>
                            {formatShortDate(payment.due_date)}
                          </td>
                          <td>
                            <span
                              className={`payment-history-status ${
                                payment.status === 'paid'
                                  ? 'paid'
                                  : overdue
                                    ? 'overdue'
                                    : 'pending'
                              }`}
                            >
                              {payment.status === 'paid'
                                ? 'Paid'
                                : overdue
                                  ? 'Overdue'
                                  : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {savedMessage && (
          <div className="save-bar save-bar-message-only">
            <span className="saved-message">✓ {savedMessage}</span>
          </div>
        )}
      </form>

      <section className="detail-card notes-card">
        <div className="card-header"><div><h2>Monitoring Notes</h2><p>Keep a running record of meetings, progress, observations, and assistance.</p></div><span className="note-count">{notes.length}</span></div>
        <form className="note-form" onSubmit={handleAddNote}>
          <textarea value={newNote} onChange={event => setNewNote(event.target.value)} placeholder="Add a note about this student..." rows="4" />
          <div className="note-form-actions"><button type="submit" className="add-note-button" disabled={addingNote || !newNote.trim()}>{addingNote ? 'Adding...' : 'Add Note'}</button></div>
        </form>
        {notes.length === 0 ? <div className="no-notes"><strong>No monitoring notes yet.</strong><span>Add the first note above to start the student's history.</span></div> : <ul className="note-list">{notes.map(note => <li key={note.id} className="note-item"><div className="note-content">{note.content}</div><div className="note-footer"><span className="note-date">{formatDate(note.created_at)}</span><button type="button" className="delete-note-button" onClick={() => handleDeleteNote(note.id)}>Delete</button></div></li>)}</ul>}
      </section>

      {showActivityModal && (
        <div
          className="student-detail-activity-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowActivityModal(false)
          }}
        >
          <div
            className="student-detail-activity-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-detail-activity-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="student-detail-activity-header">
              <div>
                <span className="student-detail-activity-kicker">ACTIVITY CHECKLIST</span>
                <h2 id="student-detail-activity-title">{student.name}</h2>
                <p>
                  {student.program || student.subject || 'Student activity'}
                  {student.university ? ` · ${student.university}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="student-detail-activity-close"
                onClick={() => setShowActivityModal(false)}
                aria-label="Close activity checklist"
              >
                ×
              </button>
            </div>

            <div className="student-detail-activity-summary">
              <div className="student-detail-activity-summary-top">
                <div>
                  <span>Progress</span>
                  <strong>{activityProgress.percentage}%</strong>
                </div>
                <span>{activityProgress.completed} of {activityProgress.total} completed</span>
              </div>
              <div className="student-detail-activity-summary-bar">
                <span style={{ width: `${activityProgress.percentage}%` }} />
              </div>
            </div>

            {activityError && <div className="student-detail-activity-error">{activityError}</div>}

            <div className="student-detail-activity-body">
              {activityLoading ? (
                <div className="student-detail-activity-empty">Loading checklist...</div>
              ) : requirements.length === 0 ? (
                <div className="student-detail-activity-empty">
                  No activity requirements have been configured yet.
                </div>
              ) : (
                activityRequirementsByWeek.map(group => (
                  <section key={group.week} className="student-detail-activity-week">
                    <h3>{group.label}</h3>
                    <div className="student-detail-activity-list">
                      {group.items.map(requirement => {
                        const item = getStudentActivity(requirement.id)
                        const completed = item?.completed || false
                        const note = item?.note || ''

                        return (
                          <div
                            key={requirement.id}
                            className={completed ? 'student-detail-activity-row completed' : 'student-detail-activity-row'}
                          >
                            <label className="student-detail-activity-check">
                              <input
                                type="checkbox"
                                checked={completed}
                                disabled={savingActivityId === requirement.id}
                                onChange={() => handleToggleActivity(requirement.id)}
                              />
                              <span className={completed ? 'done' : ''}>{requirement.label}</span>
                            </label>
                            <input
                              type="text"
                              className="student-detail-activity-note"
                              placeholder="Note..."
                              defaultValue={note}
                              onBlur={(event) => {
                                if (event.target.value !== note) {
                                  updateStudentActivityNote(requirement.id, event.target.value)
                                }
                              }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>

            <div className="student-detail-activity-footer">
              <button type="button" className="primary-button" onClick={() => setShowActivityModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="danger-zone">
        <div><h2>Delete Student</h2><p>Permanently remove this student from the tracking platform.</p></div>
        <button type="button" className="delete-student-button" onClick={handleDeleteStudent} disabled={deletingStudent}>{deletingStudent ? 'Deleting...' : 'Delete Student'}</button>
      </section>
    </div>
  )
}

export default StudentDetail
