import { useState } from 'react'
import { useStudentActivity } from '../hooks/useStudentActivity'
import './StudentActivityModal.css'

function StudentActivityModal({ student, onClose }) {
  const {
    requirements,
    loading,
    error,
    progress,
    requirementsByWeek,
    weekOptions,
    getActivity,
    toggleRequirement,
    updateNote,
    addActivity,
    deleteActivity,
  } = useStudentActivity(student?.id)

  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // Add-activity form (per-student custom items)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newWeek, setNewWeek] = useState('0')
  const [adding, setAdding] = useState(false)

  async function handleToggle(requirementId) {
    setSavingId(requirementId)
    await toggleRequirement(requirementId)
    setSavingId(null)
  }

  async function handleAddActivity(event) {
    event.preventDefault()
    if (!newLabel.trim()) return

    setAdding(true)
    await addActivity(newLabel, newWeek)
    setAdding(false)
    setNewLabel('')
    setNewWeek('0')
    setShowAddForm(false)
  }

  async function handleDelete(requirement) {
    if (!window.confirm(`Remove "${requirement.label}" for ${student.name}?`)) {
      return
    }
    setDeletingId(requirement.id)
    await deleteActivity(requirement)
    setDeletingId(null)
  }

  return (
    <div
      className="student-activity-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="student-activity-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-activity-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="student-activity-modal-header">
          <div>
            <div className="student-activity-kicker">ACTIVITY CHECKLIST</div>
            <h2 id="student-activity-title">{student.name}</h2>
            <p>
              {student.program || student.subject || 'Student activity'}
              {student.university ? ` · ${student.university}` : ''}
            </p>
          </div>

          <button
            type="button"
            className="student-activity-close"
            onClick={onClose}
            aria-label="Close activity checklist"
          >
            ×
          </button>
        </div>

        <div className="student-activity-summary">
          <div>
            <span className="student-activity-summary-label">Progress</span>
            <strong>{progress.percentage}%</strong>
          </div>

          <div className="student-activity-summary-count">
            {progress.completed} of {progress.total} completed
          </div>

          <div className="student-activity-summary-bar">
            <span style={{ width: `${progress.percentage}%` }} />
          </div>
        </div>

        {error && <div className="student-activity-error">{error}</div>}

        <div className="student-activity-body">
          {loading ? (
            <div className="student-activity-loading">Loading checklist...</div>
          ) : requirements.length === 0 ? (
            <div className="student-activity-empty">
              No activity requirements have been set up yet.
            </div>
          ) : (
            requirementsByWeek.map((group) => (
              <section key={group.week} className="student-activity-week">
                <div className="student-activity-week-title">{group.label}</div>

                <div className="student-activity-list">
                  {group.items.map((requirement) => {
                    const item = getActivity(requirement.id)
                    const completed = item?.completed || false
                    const note = item?.note || ''
                    const isCustom = Boolean(requirement.student_id)

                    return (
                      <div
                        key={requirement.id}
                        className={
                          completed
                            ? 'student-activity-item completed'
                            : 'student-activity-item'
                        }
                      >
                        <label className="student-activity-check">
                          <input
                            type="checkbox"
                            checked={completed}
                            disabled={savingId === requirement.id}
                            onChange={() => handleToggle(requirement.id)}
                          />
                          <span
                            className={
                              completed
                                ? 'student-activity-label done'
                                : 'student-activity-label'
                            }
                          >
                            {requirement.label}
                          </span>
                          {isCustom && (
                            <span className="student-activity-custom-tag">Custom</span>
                          )}
                        </label>

                        <div className="student-activity-item-actions">
                          <input
                            type="text"
                            className="student-activity-note"
                            placeholder="Add note..."
                            defaultValue={note}
                            onBlur={(event) => {
                              if (event.target.value !== note) {
                                updateNote(requirement.id, event.target.value)
                              }
                            }}
                          />

                          {isCustom && (
                            <button
                              type="button"
                              className="student-activity-delete"
                              onClick={() => handleDelete(requirement)}
                              disabled={deletingId === requirement.id}
                              aria-label={`Remove ${requirement.label}`}
                              title="Remove this custom activity"
                            >
                              {deletingId === requirement.id ? '...' : '×'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))
          )}

          {showAddForm ? (
            <form className="student-activity-add-form" onSubmit={handleAddActivity}>
              <div className="student-activity-add-row">
                <input
                  type="text"
                  className="student-activity-add-input"
                  placeholder="Activity label, e.g. Extra case study"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  autoFocus
                />

                <select
                  className="student-activity-add-week"
                  value={newWeek}
                  onChange={(e) => setNewWeek(e.target.value)}
                >
                  {weekOptions.map((w) => (
                    <option key={w} value={w}>
                      {w === 0 ? 'General' : `Week ${w}`}
                    </option>
                  ))}
                  <option value={String(Math.max(...weekOptions, 0) + 1)}>
                    New week ({Math.max(...weekOptions, 0) + 1})
                  </option>
                </select>
              </div>

              <div className="student-activity-add-actions">
                <button
                  type="button"
                  className="student-activity-add-cancel"
                  onClick={() => {
                    setShowAddForm(false)
                    setNewLabel('')
                    setNewWeek('0')
                  }}
                  disabled={adding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="student-activity-add-save"
                  disabled={adding || !newLabel.trim()}
                >
                  {adding ? 'Adding...' : 'Add activity'}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="student-activity-add-trigger"
              onClick={() => setShowAddForm(true)}
            >
              + Add activity for {student.name?.split(' ')[0] || 'this student'}
            </button>
          )}
        </div>

        <div className="student-activity-modal-footer">
          <button type="button" className="student-activity-done-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default StudentActivityModal
