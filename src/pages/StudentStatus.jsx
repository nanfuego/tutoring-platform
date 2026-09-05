import { useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import './StudentStatus.css'

function StudentStatus() {
  const { slug } = useParams()

  const [student, setStudent] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        // Public-safe view:
        // never expose credentials or admin-only student fields here.
        const { data: studentData, error: studentError } = await supabase
          .from('student_status_public')
          .select('*')
          .eq('slug', slug)
          .single()

        if (studentError) {
          throw studentError
        }

        if (cancelled) return

        setStudent(studentData)

        // SECURITY DEFINER RPC scoped to the public student slug.
        // This intentionally does not expose internal/admin notes.
        const { data: checklistData, error: checklistError } = await supabase.rpc(
          'get_student_checklist',
          { p_slug: slug }
        )

        if (checklistError) {
          throw checklistError
        }

        if (!cancelled) {
          setChecklist(checklistData || [])
        }
      } catch (fetchError) {
        console.error('Error loading student status:', fetchError)

        if (!cancelled) {
          setError(fetchError?.message || 'Unable to load student progress.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [slug])

  const groupedByWeek = useMemo(() => {
    return checklist.reduce((groups, item) => {
      const week = Number(item.week ?? 0)

      if (!groups[week]) {
        groups[week] = []
      }

      groups[week].push(item)
      return groups
    }, {})
  }, [checklist])

  const weeks = useMemo(() => {
    return Object.keys(groupedByWeek)
      .map(Number)
      .sort((a, b) => a - b)
  }, [groupedByWeek])

  const completedCount = useMemo(
    () => checklist.filter((item) => Boolean(item.completed)).length,
    [checklist]
  )

  const remainingCount = Math.max(checklist.length - completedCount, 0)

  const progressPercent =
    checklist.length > 0
      ? Math.round((completedCount / checklist.length) * 100)
      : 0

  const studentMeta = useMemo(() => {
    if (!student) return []

    return [
      student.university,
      student.program,
      student.subject,
    ].filter(Boolean)
  }, [student])

  if (loading) {
    return (
      <div className="student-status-page">
        <div className="student-status-shell">
          <div className="student-status-state-card">
            <div className="student-status-spinner" aria-hidden="true" />
            <strong>Loading your progress</strong>
            <span>Getting your latest activity status...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="student-status-page">
        <div className="student-status-shell">
          <div className="student-status-state-card student-status-error-card">
            <div className="student-status-state-icon" aria-hidden="true">
              !
            </div>
            <strong>Student status not found</strong>
            <span>
              Please check the link and try again. If the problem continues,
              contact your tutor.
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="student-status-page">
      <main className="student-status-shell">
        <section className="student-status-hero">
          <div className="student-status-hero-copy">
            <span className="student-status-eyebrow">STUDENT PROGRESS</span>

            <h1>
              Hi, <span>{student.name}</span>
            </h1>

            <p className="student-status-intro">
              Here&apos;s a clear view of your current activity progress.
            </p>

            {studentMeta.length > 0 && (
              <div className="student-status-meta">
                {studentMeta.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            )}
          </div>

          <div className="student-status-progress-ring-card">
            <div
              className="student-status-progress-ring"
              style={{ '--progress': `${progressPercent}%` }}
              aria-label={`${progressPercent}% complete`}
            >
              <div>
                <strong>{progressPercent}%</strong>
                <span>Complete</span>
              </div>
            </div>
          </div>
        </section>

        {checklist.length === 0 ? (
          <section className="student-status-empty-card">
            <div className="student-status-empty-icon" aria-hidden="true">
              ✓
            </div>
            <div>
              <span className="student-status-section-eyebrow">
                ACTIVITY CHECKLIST
              </span>
              <h2>No activities assigned yet</h2>
              <p>
                Your activity requirements will appear here once they are
                assigned.
              </p>
            </div>
          </section>
        ) : (
          <>
            <section
              className="student-status-summary-grid"
              aria-label="Progress summary"
            >
              <div className="student-status-summary-card">
                <span className="student-status-summary-label">
                  OVERALL PROGRESS
                </span>
                <strong>{progressPercent}%</strong>
                <small>Across all assigned activities</small>
              </div>

              <div className="student-status-summary-card student-status-summary-card-completed">
                <span className="student-status-summary-label">COMPLETED</span>
                <strong>{completedCount}</strong>
                <small>Activities finished</small>
              </div>

              <div className="student-status-summary-card">
                <span className="student-status-summary-label">REMAINING</span>
                <strong>{remainingCount}</strong>
                <small>Activities still to complete</small>
              </div>

              <div className="student-status-summary-card">
                <span className="student-status-summary-label">TOTAL</span>
                <strong>{checklist.length}</strong>
                <small>Assigned activities</small>
              </div>
            </section>

            <section className="student-status-progress-card">
              <div className="student-status-progress-card-heading">
                <div>
                  <span className="student-status-section-eyebrow">
                    OVERALL PROGRESS
                  </span>
                  <h2>Your checklist progress</h2>
                </div>

                <span className="student-status-progress-count">
                  {completedCount} of {checklist.length} complete
                </span>
              </div>

              <div
                className="student-status-progress-track"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={progressPercent}
              >
                <div
                  className="student-status-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </section>

            <section className="student-status-activities">
              <div className="student-status-section-header">
                <div>
                  <span className="student-status-section-eyebrow">
                    ACTIVITY CHECKLIST
                  </span>
                  <h2>Your activities</h2>
                  <p>
                    Work through each requirement and check back here for your
                    latest progress.
                  </p>
                </div>
              </div>

              <div className="student-status-week-list">
                {weeks.map((week) => {
                  const weekItems = groupedByWeek[week]
                  const weekCompleted = weekItems.filter(
                    (item) => item.completed
                  ).length

                  return (
                    <section key={week} className="student-status-week-card">
                      <div className="student-status-week-header">
                        <div>
                          <span className="student-status-week-kicker">
                            {week === 0 ? 'GENERAL' : `WEEK ${week}`}
                          </span>
                          <h3>
                            {week === 0
                              ? 'General Requirements'
                              : `Week ${week} Activities`}
                          </h3>
                        </div>

                        <span className="student-status-week-count">
                          {weekCompleted}/{weekItems.length} complete
                        </span>
                      </div>

                      <div className="student-status-task-list">
                        {weekItems.map((item) => {
                          const completed = Boolean(item.completed)

                          return (
                            <article
                              key={item.requirement_id}
                              className={
                                completed
                                  ? 'student-status-task is-completed'
                                  : 'student-status-task'
                              }
                            >
                              <div
                                className="student-status-task-icon"
                                aria-hidden="true"
                              >
                                {completed ? '✓' : ''}
                              </div>

                              <div className="student-status-task-copy">
                                <strong>{item.label}</strong>
                                <span>
                                  {completed
                                    ? 'This activity is complete.'
                                    : 'This activity is still pending.'}
                                </span>
                              </div>

                              <span
                                className={
                                  completed
                                    ? 'student-status-pill is-completed'
                                    : 'student-status-pill'
                                }
                              >
                                {completed ? 'Completed' : 'Not Started'}
                              </span>
                            </article>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            </section>
          </>
        )}

        <footer className="student-status-footer">
          <span>Progress updates are managed by your tutor.</span>
        </footer>
      </main>
    </div>
  )
}

export default StudentStatus
