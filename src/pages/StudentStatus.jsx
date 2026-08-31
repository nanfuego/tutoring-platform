import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import './StudentStatus.css'

function StudentStatus() {
  const { slug } = useParams()
  const [student, setStudent] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      // Public-safe view: only ever returns name/slug/program/subject/
      // university, never the credential columns on the base students table.
      const { data: studentData, error: studentError } = await supabase
        .from('student_status_public')
        .select('*')
        .eq('slug', slug)
        .single()

      if (studentError) {
        setError(studentError.message)
        setLoading(false)
        return
      }

      setStudent(studentData)

      // SECURITY DEFINER function scoped to this slug only — there's no
      // anon SELECT policy on activity_requirements/student_activity at all,
      // so this is the only way a browser can reach checklist data, and it
      // can only ever see the one student's rows. It also never returns
      // the `note` column — those read as internal/admin annotations.
      const { data: checklistData, error: checklistError } = await supabase.rpc(
        'get_student_checklist',
        { p_slug: slug },
      )

      if (checklistError) {
        setError(checklistError.message)
      } else {
        setChecklist(checklistData || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [slug])

  if (loading) return <p className="loading-text">Loading...</p>
  if (error) return <p className="error-text">Student not found.</p>

  const groupedByWeek = checklist.reduce((groups, item) => {
    const week = item.week ?? 0
    ;(groups[week] ??= []).push(item)
    return groups
  }, {})

  const weeks = Object.keys(groupedByWeek)
    .map(Number)
    .sort((a, b) => a - b)

  const completedCount = checklist.filter((item) => item.completed).length
  const progressPercent =
    checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0

  return (
    <div className="status-page">
      <div className="status-container">
        <div className="status-header">
          <p className="status-eyebrow">Your Progress</p>
          <h1 className="status-heading">Hi, {student.name}</h1>
          <p className="status-subheading">Here's where things stand right now.</p>
        </div>

        {checklist.length === 0 ? (
          <p className="empty-state">No activity requirements yet — check back soon.</p>
        ) : (
          <>
            <div className="status-progress-summary">
              <strong>{progressPercent}% complete</strong>
              <span>{completedCount} of {checklist.length}</span>
            </div>

            <div className="timeline">
              {weeks.map((week) => (
                <div key={week} className="status-week-group">
                  <h2 className="status-week-title">
                    {week === 0 ? 'General' : `Week ${week}`}
                  </h2>

                  {groupedByWeek[week].map((item) => (
                    <div
                      key={item.requirement_id}
                      className="task-card"
                      style={{
                        '--dot-color': item.completed
                          ? 'var(--color-status-delivered)'
                          : 'var(--color-status-not-started)',
                      }}
                    >
                      <div className="task-top">
                        <span className="task-title">{item.label}</span>
                      </div>
                      <div className="task-meta">
                        <span
                          className="status-pill"
                          style={{
                            '--pill-color': item.completed
                              ? 'var(--color-status-delivered)'
                              : 'var(--color-status-not-started)',
                          }}
                        >
                          {item.completed ? 'Completed' : 'Not Started'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default StudentStatus
