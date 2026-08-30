import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import './StudentActivityModal.css'

function StudentActivityModal({ student, onClose }) {
  const [requirements, setRequirements] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!student?.id) return

    let cancelled = false

    async function loadChecklist() {
      setLoading(true)
      setError('')

      const [requirementsRes, activityRes] = await Promise.all([
        supabase
          .from('activity_requirements')
          .select('*')
          .order('sort_order'),
        supabase
          .from('student_activity')
          .select('*')
          .eq('student_id', student.id),
      ])

      if (cancelled) return

      if (requirementsRes.error) {
        console.error('Error loading activity requirements:', requirementsRes.error)
        setError(requirementsRes.error.message)
      } else if (activityRes.error) {
        console.error('Error loading student activity:', activityRes.error)
        setError(activityRes.error.message)
      }

      setRequirements(requirementsRes.data || [])
      setActivity(activityRes.data || [])
      setLoading(false)
    }

    loadChecklist()

    return () => {
      cancelled = true
    }
  }, [student?.id])

  const completedCount = useMemo(
    () => activity.filter((item) => item.completed).length,
    [activity]
  )

  const progressPercent =
    requirements.length > 0
      ? Math.round((completedCount / requirements.length) * 100)
      : 0

  const requirementsByWeek = useMemo(() => {
    const groups = {}

    requirements.forEach((requirement) => {
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

  function getActivity(requirementId) {
    return activity.find(
      (item) =>
        item.student_id === student.id &&
        item.requirement_id === requirementId
    )
  }

  async function toggleRequirement(requirementId) {
    const existing = getActivity(requirementId)
    const currentCompleted = existing?.completed || false

    setSavingId(requirementId)
    setError('')

    if (existing) {
      const { error: updateError } = await supabase
        .from('student_activity')
        .update({
          completed: !currentCompleted,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Error updating activity:', updateError)
        setError(updateError.message)
      } else {
        setActivity((current) =>
          current.map((item) =>
            item.id === existing.id
              ? { ...item, completed: !currentCompleted }
              : item
          )
        )
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('student_activity')
        .insert({
          student_id: student.id,
          requirement_id: requirementId,
          completed: true,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating activity:', insertError)
        setError(insertError.message)
      } else if (data) {
        setActivity((current) => [...current, data])
      }
    }

    setSavingId(null)
  }

  async function updateNote(requirementId, note) {
    const existing = getActivity(requirementId)

    if (existing) {
      const { error: updateError } = await supabase
        .from('student_activity')
        .update({
          note,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Error saving activity note:', updateError)
        setError(updateError.message)
        return
      }

      setActivity((current) =>
        current.map((item) =>
          item.id === existing.id ? { ...item, note } : item
        )
      )
    } else if (note.trim()) {
      const { data, error: insertError } = await supabase
        .from('student_activity')
        .insert({
          student_id: student.id,
          requirement_id: requirementId,
          completed: false,
          note,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating activity note:', insertError)
        setError(insertError.message)
      } else if (data) {
        setActivity((current) => [...current, data])
      }
    }
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
            <strong>{progressPercent}%</strong>
          </div>

          <div className="student-activity-summary-count">
            {completedCount} of {requirements.length} completed
          </div>

          <div className="student-activity-summary-bar">
            <span style={{ width: `${progressPercent}%` }} />
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
                <div className="student-activity-week-title">
                  {group.label}
                </div>

                <div className="student-activity-list">
                  {group.items.map((requirement) => {
                    const item = getActivity(requirement.id)
                    const completed = item?.completed || false
                    const note = item?.note || ''

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
                            onChange={() =>
                              toggleRequirement(requirement.id)
                            }
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
                        </label>

                        <input
                          type="text"
                          className="student-activity-note"
                          placeholder="Add note..."
                          defaultValue={note}
                          onBlur={(event) => {
                            if (event.target.value !== note) {
                              updateNote(
                                requirement.id,
                                event.target.value
                              )
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

        <div className="student-activity-modal-footer">
          <button
            type="button"
            className="student-activity-done-button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default StudentActivityModal
