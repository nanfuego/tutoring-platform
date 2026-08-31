import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import StudentActivityModal from './StudentActivityModal'
import './ActivityTracker.css'

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function ActivityTracker() {
  const navigate = useNavigate()

  const [students, setStudents] = useState([])
  const [requirements, setRequirements] = useState([])
  const [activity, setActivity] = useState([]) // all student_activity rows
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [clinicFilter, setClinicFilter] = useState('all')

  // Checklist modal
  const [selectedStudent, setSelectedStudent] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const [studentsRes, reqRes, activityRes] = await Promise.all([
      supabase.from('students').select('*').order('name'),
      supabase.from('activity_requirements').select('*').order('sort_order'),
      supabase.from('student_activity').select('*'),
    ])

    setStudents(studentsRes.data || [])
    setRequirements(reqRes.data || [])
    setActivity(activityRes.data || [])
    setLoading(false)
  }

  // Unique clinics from students (if clinic field exists)
  const clinics = useMemo(() => {
    const set = new Set()
    students.forEach((s) => {
      if (s.clinic) set.add(s.clinic)
    })
    return Array.from(set).sort()
  }, [students])

  // Progress per student. Each student's total includes the shared,
  // cohort-wide requirements (student_id is null) plus any custom
  // activities added just for them (student_id === s.id).
  const progressMap = useMemo(() => {
    const map = {}

    students.forEach((s) => {
      const applicable = requirements.filter(
        (r) => !r.student_id || r.student_id === s.id
      )
      const completed = activity.filter(
        (a) =>
          a.student_id === s.id &&
          a.completed &&
          applicable.some((r) => r.id === a.requirement_id)
      ).length
      map[s.id] = { completed, total: applicable.length }
    })

    return map
  }, [students, activity, requirements])

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (clinicFilter !== 'all' && s.clinic !== clinicFilter) return false

      if (search.trim()) {
        const q = search.toLowerCase()
        if (!s.name?.toLowerCase().includes(q)) return false
      }

      return true
    })
  }, [students, search, clinicFilter])

  // Summary stats across the currently filtered set
  const summary = useMemo(() => {
    const total = requirements.length || 1

    const percentages = filteredStudents.map((s) => {
      const prog = progressMap[s.id] || { completed: 0, total }
      return prog.total > 0 ? (prog.completed / prog.total) * 100 : 0
    })

    const avgCompletion = percentages.length
      ? Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length)
      : 0

    const fullyCompleted = percentages.filter((p) => p >= 100).length
    const notStarted = percentages.filter((p) => p === 0).length

    return {
      totalStudents: filteredStudents.length,
      avgCompletion,
      fullyCompleted,
      notStarted,
    }
  }, [filteredStudents, progressMap, requirements])

  function openChecklist(student) {
    setSelectedStudent(student)
  }

  function closeChecklist() {
    setSelectedStudent(null)
    // Refresh progress bars in case checkboxes changed while the modal was open
    loadData()
  }

  return (
    <div className="activity-page">
      <button className="back-link" onClick={() => navigate('/admin')}>
        ← Back to Dashboard
      </button>

      <div className="activity-header">
        <h1 className="admin-welcome">Student Progress</h1>
      </div>

      <div className="activity-summary">
        <div className="summary-card">
          <p className="summary-label">Students</p>
          <p className="summary-value">{summary.totalStudents}</p>
        </div>
        <div className="summary-card">
          <p className="summary-label">Avg. Completion</p>
          <p className="summary-value accent">{summary.avgCompletion}%</p>
        </div>
        <div className="summary-card">
          <p className="summary-label">Fully Completed</p>
          <p className="summary-value">{summary.fullyCompleted}</p>
        </div>
        <div className="summary-card">
          <p className="summary-label">Not Started</p>
          <p className="summary-value muted">{summary.notStarted}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="activity-controls">
        <input
          type="text"
          className="activity-search"
          placeholder="Search student..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="clinic-filter"
          value={clinicFilter}
          onChange={(e) => setClinicFilter(e.target.value)}
        >
          <option value="all">All Clinics</option>
          {clinics.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : filteredStudents.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No students found</p>
          <p className="empty-subtitle">
            {search || clinicFilter !== 'all'
              ? 'Try changing the search or clinic filter.'
              : 'Add students first from the dashboard.'}
          </p>
        </div>
      ) : (
        <div className="activity-table-wrapper">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Clinic</th>
                <th>Progress</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => {
                const prog = progressMap[s.id] || { completed: 0, total: requirements.length }
                const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0
                const progressState =
                  pct >= 100 ? 'complete' : pct === 0 ? 'not-started' : 'in-progress'

                return (
                  <tr key={s.id}>
                    <td className="student-name-cell">
                      <div className="student-identity">
                        <span className="student-avatar">{initials(s.name)}</span>
                        <span>{s.name}</span>
                      </div>
                    </td>
                    <td>
                      {s.clinic ? (
                        <span className="clinic-badge">{s.clinic}</span>
                      ) : (
                        <span className="muted-cell">—</span>
                      )}
                    </td>
                    <td>
                      <div className="progress-cell">
                        <div className="progress-bar">
                          <div
                            className={`progress-fill ${progressState}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="progress-text">
                          {prog.completed}/{prog.total} · {pct}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="view-checklist-btn"
                        onClick={() => openChecklist(s)}
                      >
                        View Checklist
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Checklist Modal */}
      {selectedStudent && (
        <StudentActivityModal
          student={selectedStudent}
          onClose={closeChecklist}
        />
      )}
    </div>
  )
}

export default ActivityTracker
