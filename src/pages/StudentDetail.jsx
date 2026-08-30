import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
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
  const [activity, setActivity] = useState([])
  const [requirements, setRequirements] = useState([])
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
  const [savingActivityId, setSavingActivityId] = useState(null)

  useEffect(() => { loadStudentData() }, [id])

  async function loadStudentData() {
    setLoading(true)
    setError('')
    const [studentResult, notesResult, paymentsResult, activityResult, requirementsResult] =
      await Promise.all([
        supabase.from('students').select('*').eq('id', id).single(),
        supabase.from('notes').select('*').eq('student_id', id).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('student_id', id).order('due_date', { ascending: false }),
        supabase.from('student_activity').select('*').eq('student_id', id),
        supabase.from('activity_requirements').select('*').order('sort_order'),
      ])

    if (studentResult.error) {
      console.error('Error loading student:', studentResult.error)
      setError(studentResult.error.message)
      setLoading(false)
      return
    }

    if (notesResult.error) console.error('Error loading notes:', notesResult.error)
    if (paymentsResult.error) console.error('Error loading payments:', paymentsResult.error)
    if (activityResult.error) console.error('Error loading activity:', activityResult.error)
    if (requirementsResult.error) console.error('Error loading activity requirements:', requirementsResult.error)

    setStudent(studentResult.data)
    setNotes(notesResult.data || [])
    setPayments(paymentsResult.data || [])
    setActivity(activityResult.data || [])
    setRequirements(requirementsResult.data || [])
    setLoading(false)
  }

  function handleChange(event) {
    const { name, value } = event.target
    setStudent(current => ({ ...current, [name]: value }))
  }

  function handleCompletedChange(event) {
    setStudent(current => ({ ...current, active: !event.target.checked }))
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

  const activityProgress = useMemo(() => {
    const total = requirements.length
    const completed = activity.filter(item => item.completed).length
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [activity, requirements])

  const activityRequirementsByWeek = useMemo(() => {
    const groups = {}
    requirements.forEach(requirement => {
      const week = requirement.week ?? 0
      if (!groups[week]) groups[week] = []
      groups[week].push(requirement)
    })
    return Object.entries(groups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([week, items]) => ({
        week: Number(week),
        label: week === '0' || week === 0 ? 'General' : `Week ${week}`,
        items,
      }))
  }, [requirements])

  function getStudentActivity(requirementId) {
    return activity.find(item => item.requirement_id === requirementId)
  }

  async function toggleStudentActivity(requirementId) {
    const existing = getStudentActivity(requirementId)
    const currentCompleted = existing?.completed || false
    setSavingActivityId(requirementId)
    setError('')

    if (existing) {
      const { error: updateError } = await supabase
        .from('student_activity')
        .update({ completed: !currentCompleted, updated_at: new Date().toISOString() })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Error updating activity:', updateError)
        setError(updateError.message)
      } else {
        setActivity(current => current.map(item =>
          item.id === existing.id ? { ...item, completed: !currentCompleted } : item
        ))
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('student_activity')
        .insert({ student_id: id, requirement_id: requirementId, completed: true })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating activity:', insertError)
        setError(insertError.message)
      } else if (data) {
        setActivity(current => [...current, data])
      }
    }

    setSavingActivityId(null)
  }

  async function updateStudentActivityNote(requirementId, note) {
    const existing = getStudentActivity(requirementId)

    if (existing) {
      const { error: updateError } = await supabase
        .from('student_activity')
        .update({ note, updated_at: new Date().toISOString() })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Error saving activity note:', updateError)
        setError(updateError.message)
        return
      }

      setActivity(current => current.map(item =>
        item.id === existing.id ? { ...item, note } : item
      ))
    } else if (note.trim()) {
      const { data, error: insertError } = await supabase
        .from('student_activity')
        .insert({ student_id: id, requirement_id: requirementId, completed: false, note })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating activity note:', insertError)
        setError(insertError.message)
      } else if (data) {
        setActivity(current => [...current, data])
      }
    }
  }

  const isCompleted = !Boolean(student?.active)

  if (loading) return <div className="detail-page"><div className="detail-loading"><div className="loading-spinner" /><p>Loading student...</p></div></div>

  if (!student) return <div className="detail-page"><Link to="/admin" className="back-link">← Back to Dashboard</Link><div className="detail-error">Student could not be found.</div></div>

  return (
    <div className="detail-page">
      <div className="detail-topbar"><Link to="/admin" className="back-link">← Back to Dashboard</Link></div>

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
              {student.program && <span>{student.program}</span>}
              {student.subject && <span>{student.subject}</span>}
            </div>
          </div>
        </div>
        <div className="student-hero-actions">
          {student.slug && <a href={`/status/${student.slug}`} target="_blank" rel="noreferrer" className="secondary-button">View Status Page</a>}
          <button type="submit" form="student-detail-form" className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </header>

      {error && <div className="detail-error"><strong>Something went wrong:</strong> {error}</div>}

      <section className="quick-stats">
        <div className="stat-card"><span className="stat-label">Outstanding</span><strong className="stat-value">{paymentSummaryText.outstanding}</strong><span className="stat-detail">Unpaid invoices</span></div>
        <div className="stat-card"><span className="stat-label">Collected</span><strong className="stat-value">{paymentSummaryText.paid}</strong><span className="stat-detail">Paid invoices</span></div>
        <div className="stat-card"><span className="stat-label">Activity</span><strong className="stat-value">{activityProgress.total > 0 ? `${activityProgress.percentage}%` : '—'}</strong><span className="stat-detail">{activityProgress.total > 0 ? `${activityProgress.completed} of ${activityProgress.total} completed` : 'No requirements'}</span></div>
        <div className="stat-card"><span className="stat-label">Notes</span><strong className="stat-value">{notes.length}</strong><span className="stat-detail">Monitoring notes</span></div>
      </section>

      <section className="quick-actions">
        <div><h2>Quick Actions</h2><p>Jump directly to this student's main management areas.</p></div>
        <div className="quick-action-buttons">
          <Link to="/admin/payments" className="action-button"><span className="action-icon">💳</span><span><strong>Payments</strong><small>View invoices</small></span></Link>
          <button type="button" className="action-button" onClick={() => setShowActivityModal(true)}><span className="action-icon">📊</span><span><strong>Activity</strong><small>View checklist</small></span></button>
          {student.slug && <a href={`/status/${student.slug}`} target="_blank" rel="noreferrer" className="action-button"><span className="action-icon">🔗</span><span><strong>Status Page</strong><small>Open student page</small></span></a>}
        </div>
      </section>

      <form id="student-detail-form" className="student-detail-form" onSubmit={handleSave}>
        <section className="detail-card">
          <div className="card-header"><div><h2>Student Information</h2><p>Basic information and tutoring status.</p></div></div>
          <div className="detail-grid">
            <label><span>Name</span><input type="text" name="name" value={student.name || ''} onChange={handleChange} required /></label>
            <label><span>Email</span><input type="email" name="email" value={student.email || ''} onChange={handleChange} /></label>
            <label><span>University</span><select name="university" value={student.university || ''} onChange={handleChange}><option value="">Select University</option><option value="AUHS">AUHS</option><option value="PACIFIC">PACIFIC</option></select></label>
            <label><span>Subject</span><input type="text" name="subject" value={student.subject || ''} onChange={handleChange} /></label>
            <label><span>Program / Course</span><input type="text" name="program" value={student.program || ''} onChange={handleChange} /></label>
            <label><span>Phone</span><input type="text" name="phone" value={student.phone || ''} onChange={handleChange} /></label>
            <label><span>Status Page Slug</span><input type="text" name="slug" value={student.slug || ''} onChange={handleChange} /></label>
          </div>
          <div className="completion-panel">
            <div><strong>Tutoring Status</strong><p>Mark this student as completed when the tutoring relationship has finished.</p></div>
            <label className="completion-toggle"><input type="checkbox" checked={isCompleted} onChange={handleCompletedChange} /><span className="toggle-box">{isCompleted ? '✓' : ''}</span><span className="toggle-label">Tutoring completed</span></label>
          </div>
          {student.slug && <div className="status-preview"><span>Student Status Page</span><a href={`/status/${student.slug}`} target="_blank" rel="noreferrer">/status/{student.slug}</a></div>}
        </section>

        <section className="detail-card payment-card">
          <div className="card-header"><div><h2>Payment Summary</h2><p>Payment information for this student.</p></div><Link to="/admin/payments" className="card-link">Open Payment Tracker →</Link></div>
          <div className="payment-summary-grid">
            <div className="payment-summary-item"><span>Outstanding</span><strong>{paymentSummaryText.outstanding}</strong></div>
            <div className="payment-summary-item"><span>Collected</span><strong className="paid-amount">{paymentSummaryText.paid}</strong></div>
            <div className="payment-summary-item"><span>Overdue</span><strong className="overdue-amount">{paymentSummaryText.overdue}</strong></div>
            <div className="payment-summary-item"><span>Invoices</span><strong>{payments.length}</strong></div>
          </div>
          <div className="payment-details">
            <div><span>Last Payment</span><strong>{lastPaidPayment ? formatShortDate(lastPaidPayment.paid_at || lastPaidPayment.updated_at || lastPaidPayment.invoice_date) : 'No payments yet'}</strong></div>
            <div><span>Next Due</span><strong>{nextPayment ? formatShortDate(nextPayment.due_date) : 'No upcoming payment'}</strong></div>
          </div>
        </section>

        <div className="two-column-grid">
          <section className="detail-card">
            <div className="card-header"><div><h2>Canvas</h2><p>Canvas login information.</p></div><span className="system-badge">Learning System</span></div>
            <div className="credentials-grid">
              <label><span>Username</span><input type="text" name="canvas_un" value={student.canvas_un || ''} onChange={handleChange} autoComplete="off" /></label>
              <label><span>Password</span><div className="password-field"><input type={showCanvasPassword ? 'text' : 'password'} name="canvas_pw" value={student.canvas_pw || ''} onChange={handleChange} autoComplete="off" /><button type="button" className="show-password-button" onClick={() => setShowCanvasPassword(current => !current)}>{showCanvasPassword ? 'Hide' : 'Show'}</button></div></label>
            </div>
          </section>

          <section className="detail-card">
            <div className="card-header"><div><h2>CORELMS</h2><p>CORELMS login information.</p></div><span className="system-badge">Learning System</span></div>
            <div className="credentials-grid">
              <label><span>Username</span><input type="text" name="corelms_un" value={student.corelms_un || ''} onChange={handleChange} autoComplete="off" /></label>
              <label><span>Password</span><div className="password-field"><input type={showCorelmsPassword ? 'text' : 'password'} name="corelms_pw" value={student.corelms_pw || ''} onChange={handleChange} autoComplete="off" /><button type="button" className="show-password-button" onClick={() => setShowCorelmsPassword(current => !current)}>{showCorelmsPassword ? 'Hide' : 'Show'}</button></div></label>
            </div>
          </section>
        </div>

        <section className="detail-card activity-card">
          <div className="card-header"><div><h2>Activity Progress</h2><p>Progress from the Activity Tracker checklist.</p></div><button type="button" className="card-link activity-card-link-button" onClick={() => setShowActivityModal(true)}>Open Checklist →</button></div>
          {activityProgress.total === 0 ? <div className="activity-empty">No activity requirements have been configured yet.</div> : <div className="activity-progress"><div className="activity-progress-header"><strong>{activityProgress.completed} of {activityProgress.total} completed</strong><span>{activityProgress.percentage}%</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${activityProgress.percentage}%` }} /></div></div>}
        </section>

        <div className="save-bar"><div>{savedMessage && <span className="saved-message">✓ {savedMessage}</span>}</div><button type="submit" className="primary-button save-main-button" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button></div>
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

            {error && <div className="student-detail-activity-error">{error}</div>}

            <div className="student-detail-activity-body">
              {requirements.length === 0 ? (
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
                                onChange={() => toggleStudentActivity(requirement.id)}
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
        <div><h2>Delete Student</h2><p>Permanently remove this student from the tutoring platform.</p></div>
        <button type="button" className="delete-student-button" onClick={handleDeleteStudent} disabled={deletingStudent}>{deletingStudent ? 'Deleting...' : 'Delete Student'}</button>
      </section>
    </div>
  )
}

export default StudentDetail
