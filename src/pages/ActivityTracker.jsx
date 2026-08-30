import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './ActivityTracker.css'

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
  const [savingId, setSavingId] = useState(null) // requirement_id being saved

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

  // Progress per student
  const progressMap = useMemo(() => {
    const map = {}
    const total = requirements.length || 1

    students.forEach((s) => {
      const completed = activity.filter(
        (a) => a.student_id === s.id && a.completed
      ).length
      map[s.id] = { completed, total }
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

  // Group requirements by week for the modal
  const requirementsByWeek = useMemo(() => {
    const groups = {}
    requirements.forEach((r) => {
      const week = r.week ?? 0
      if (!groups[week]) groups[week] = []
      groups[week].push(r)
    })
    return Object.entries(groups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([week, items]) => ({
        week: Number(week),
        label: week === '0' || week === 0 ? 'General' : `Week ${week}`,
        items,
      }))
  }, [requirements])

  function getActivity(studentId, requirementId) {
    return activity.find(
      (a) => a.student_id === studentId && a.requirement_id === requirementId
    )
  }

  async function toggleRequirement(studentId, requirementId, currentCompleted) {
    setSavingId(requirementId)

    const existing = getActivity(studentId, requirementId)

    if (existing) {
      // Update
      const { error } = await supabase
        .from('student_activity')
        .update({
          completed: !currentCompleted,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (!error) {
        setActivity((prev) =>
          prev.map((a) =>
            a.id === existing.id
              ? { ...a, completed: !currentCompleted }
              : a
          )
        )
      }
    } else {
      // Insert
      const { data, error } = await supabase
        .from('student_activity')
        .insert({
          student_id: studentId,
          requirement_id: requirementId,
          completed: true,
        })
        .select()
        .single()

      if (!error && data) {
        setActivity((prev) => [...prev, data])
      }
    }

    setSavingId(null)
  }

  async function updateNote(studentId, requirementId, note) {
    const existing = getActivity(studentId, requirementId)

    if (existing) {
      await supabase
        .from('student_activity')
        .update({ note, updated_at: new Date().toISOString() })
        .eq('id', existing.id)

      setActivity((prev) =>
        prev.map((a) =>
          a.id === existing.id ? { ...a, note } : a
        )
      )
    } else if (note.trim()) {
      // Create row with note even if not completed
      const { data } = await supabase
        .from('student_activity')
        .insert({
          student_id: studentId,
          requirement_id: requirementId,
          completed: false,
          note,
        })
        .select()
        .single()

      if (data) {
        setActivity((prev) => [...prev, data])
      }
    }
  }

  function openChecklist(student) {
    setSelectedStudent(student)
  }

  function closeChecklist() {
    setSelectedStudent(null)
  }

  return (
    <div className="activity-page">
      <button className="back-link" onClick={() => navigate('/admin')}>
        ← Back to students
      </button>

      <div className="activity-header">
        <h1 className="admin-welcome">Activity Tracker</h1>
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

                return (
                  <tr key={s.id}>
                    <td className="student-name-cell">{s.name}</td>
                    <td>{s.clinic || '—'}</td>
                    <td>
                      <div className="progress-cell">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="progress-text">
                          {prog.completed}/{prog.total}
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
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeChecklist()
          }}
        >
          <div
            className="checklist-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>{selectedStudent.name}</h2>
                <p>
                  {selectedStudent.clinic || 'No clinic assigned'}
                  {selectedStudent.university ? ` · ${selectedStudent.university}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-button"
                onClick={closeChecklist}
              >
                ×
              </button>
            </div>

            <div className="checklist-body">
              {requirements.length === 0 ? (
                <p className="empty-subtitle">
                  No requirements set up yet. Add items to the activity_requirements table.
                </p>
              ) : (
                requirementsByWeek.map((group) => (
                  <div key={group.week} className="week-group">
                    <h3 className="week-title">{group.label}</h3>
                    <div className="requirement-list">
                      {group.items.map((req) => {
                        const act = getActivity(selectedStudent.id, req.id)
                        const completed = act?.completed || false
                        const note = act?.note || ''

                        return (
                          <div key={req.id} className="requirement-row">
                            <label className="requirement-check">
                              <input
                                type="checkbox"
                                checked={completed}
                                disabled={savingId === req.id}
                                onChange={() =>
                                  toggleRequirement(
                                    selectedStudent.id,
                                    req.id,
                                    completed
                                  )
                                }
                              />
                              <span className={completed ? 'done' : ''}>
                                {req.label}
                              </span>
                            </label>

                            <input
                              type="text"
                              className="requirement-note"
                              placeholder="Note..."
                              defaultValue={note}
                              onBlur={(e) => {
                                if (e.target.value !== note) {
                                  updateNote(
                                    selectedStudent.id,
                                    req.id,
                                    e.target.value
                                  )
                                }
                              }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivityTracker
