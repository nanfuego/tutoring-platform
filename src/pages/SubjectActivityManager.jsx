import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import './SubjectActivityManager.css'

const EMPTY_SUBJECT = {
  name: '',
  university: 'AUHS',
  description: '',
}

const EMPTY_ACTIVITY = {
  label: '',
  code: '',
  week: '1',
  startDate: '',
  endDate: '',
}

function SubjectActivityManager({ onClose, onChanged }) {
  const [tab, setTab] = useState('subjects')

  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [assignments, setAssignments] = useState([])
  const [requirements, setRequirements] = useState([])
  const [activeSemester, setActiveSemester] = useState(null)

  const [selectedSubjectId, setSelectedSubjectId] = useState(null)
  const [subjectSearch, setSubjectSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('all')

  const [subjectForm, setSubjectForm] = useState(EMPTY_SUBJECT)
  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState(null)

  const [activityForm, setActivityForm] = useState(EMPTY_ACTIVITY)
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)

  const [assignmentStudent, setAssignmentStudent] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [subjectRes, studentRes, assignmentRes, reqRes, semesterRes] =
        await Promise.all([
          supabase
            .from('subjects')
            .select('*')
            .order('university', { ascending: true })
            .order('name', { ascending: true }),

          supabase
            .from('students')
            .select('id, name, email, university, subject, program')
            .order('name', { ascending: true }),

          supabase
            .from('student_subjects')
            .select('*'),

          supabase
            .from('activity_requirements')
            .select('*')
            .order('week', { ascending: true, nullsFirst: false })
            .order('sort_order', { ascending: true, nullsFirst: false }),

          supabase
            .from('semesters')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

      if (subjectRes.error) throw subjectRes.error
      if (studentRes.error) throw studentRes.error
      if (assignmentRes.error) throw assignmentRes.error
      if (reqRes.error) throw reqRes.error
      if (semesterRes.error) throw semesterRes.error

      const nextSubjects = subjectRes.data || []

      setSubjects(nextSubjects)
      setStudents(studentRes.data || [])
      setAssignments(assignmentRes.data || [])
      setRequirements(reqRes.data || [])
      setActiveSemester(semesterRes.data || null)

      setSelectedSubjectId((current) => {
        if (
          current &&
          nextSubjects.some((subject) => subject.id === current)
        ) {
          return current
        }

        return nextSubjects[0]?.id || null
      })
    } catch (err) {
      console.error('Subject manager load error:', err)
      setError(
        err.message ||
          'Unable to load the subject activity manager.'
      )
    } finally {
      setLoading(false)
    }
  }

  const selectedSubject =
    subjects.find((subject) => subject.id === selectedSubjectId) || null

  const subjectCounts = useMemo(() => {
    const map = {}

    subjects.forEach((subject) => {
      map[subject.id] = {
        activities: 0,
        students: 0,
      }
    })

    requirements.forEach((requirement) => {
      if (requirement.subject_id && map[requirement.subject_id]) {
        map[requirement.subject_id].activities += 1
      }
    })

    assignments.forEach((assignment) => {
      if (
        assignment.active !== false &&
        map[assignment.subject_id]
      ) {
        map[assignment.subject_id].students += 1
      }
    })

    return map
  }, [subjects, requirements, assignments])

  const filteredSubjects = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase()

    return subjects.filter((subject) => {
      if (
        schoolFilter !== 'all' &&
        subject.university !== schoolFilter
      ) {
        return false
      }

      if (!query) return true

      return [
        subject.name,
        subject.university,
        subject.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [subjects, subjectSearch, schoolFilter])

  const subjectActivities = useMemo(() => {
    if (!selectedSubject) return []

    return requirements.filter(
      (requirement) =>
        requirement.subject_id === selectedSubject.id
    )
  }, [requirements, selectedSubject])

  const legacyActivities = useMemo(
    () =>
      requirements.filter(
        (requirement) =>
          requirement.subject_id == null &&
          requirement.student_id == null
      ),
    [requirements]
  )

  const groupedActivities = useMemo(() => {
    const groups = {}

    subjectActivities.forEach((activity) => {
      const week = Number(activity.week ?? 0)

      if (!groups[week]) groups[week] = []
      groups[week].push(activity)
    })

    return Object.entries(groups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([week, items]) => ({
        week: Number(week),
        label:
          Number(week) === 0
            ? 'General'
            : `Week ${week}`,
        items,
      }))
  }, [subjectActivities])

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase()

    return students.filter((student) => {
      if (
        schoolFilter !== 'all' &&
        student.university !== schoolFilter
      ) {
        return false
      }

      if (!query) return true

      return [
        student.name,
        student.email,
        student.university,
        student.subject,
        student.program,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [students, studentSearch, schoolFilter])

  function openNewSubject() {
    setEditingSubject(null)
    setSubjectForm({
      ...EMPTY_SUBJECT,
      university:
        schoolFilter !== 'all' ? schoolFilter : 'AUHS',
    })
    setShowSubjectForm(true)
  }

  function openEditSubject(subject) {
    setEditingSubject(subject)
    setSubjectForm({
      name: subject.name || '',
      university: subject.university || 'AUHS',
      description: subject.description || '',
    })
    setShowSubjectForm(true)
  }

  async function saveSubject(event) {
    event.preventDefault()

    if (!subjectForm.name.trim()) {
      setError('Subject name is required.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = {
        name: subjectForm.name.trim(),
        university: subjectForm.university || null,
        description: subjectForm.description.trim() || null,
        active: true,
      }

      if (editingSubject) {
        const { error: updateError } = await supabase
          .from('subjects')
          .update(payload)
          .eq('id', editingSubject.id)

        if (updateError) throw updateError
      } else {
        const { data, error: insertError } = await supabase
          .from('subjects')
          .insert(payload)
          .select()
          .single()

        if (insertError) throw insertError

        if (data?.id) {
          setSelectedSubjectId(data.id)
        }
      }

      setShowSubjectForm(false)
      setEditingSubject(null)
      await loadData()
      onChanged?.()
    } catch (err) {
      console.error('Save subject error:', err)
      setError(err.message || 'Unable to save subject.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSubject(subject) {
    const counts = subjectCounts[subject.id] || {
      activities: 0,
      students: 0,
    }

    if (counts.activities || counts.students) {
      setError(
        `Move/delete the ${counts.activities} activities and remove the ${counts.students} student assignments before deleting ${subject.name}.`
      )
      return
    }

    if (!window.confirm(`Delete subject "${subject.name}"?`)) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const { error: deleteError } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subject.id)

      if (deleteError) throw deleteError

      if (selectedSubjectId === subject.id) {
        setSelectedSubjectId(null)
      }

      await loadData()
      onChanged?.()
    } catch (err) {
      console.error('Delete subject error:', err)
      setError(err.message || 'Unable to delete subject.')
    } finally {
      setSaving(false)
    }
  }

  function openNewActivity() {
    if (!selectedSubject) return

    setEditingActivity(null)
    setActivityForm(EMPTY_ACTIVITY)
    setShowActivityForm(true)
  }

  function openEditActivity(activity) {
    setEditingActivity(activity)
    setActivityForm({
      label: activity.label || '',
      code: activity.code || '',
      week: String(activity.week ?? 1),
      startDate: activity.start_date || '',
      endDate: activity.end_date || '',
    })
    setShowActivityForm(true)
  }

  async function saveActivity(event) {
    event.preventDefault()

    if (!selectedSubject) {
      setError('Select a subject first.')
      return
    }

    if (!activityForm.label.trim()) {
      setError('Activity name is required.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const subjectReqs = requirements.filter(
        (requirement) =>
          requirement.subject_id === selectedSubject.id
      )

      const maxSortOrder = subjectReqs.reduce(
        (max, requirement) =>
          Math.max(max, Number(requirement.sort_order || 0)),
        0
      )

      const payload = {
        label: activityForm.label.trim(),
        code: activityForm.code.trim() || null,
        week: Number(activityForm.week || 0),
        university: selectedSubject.university || null,
        subject_id: selectedSubject.id,
        student_id: null,
        start_date: activityForm.startDate || null,
        end_date: activityForm.endDate || null,
      }

      if (!editingActivity) {
        payload.sort_order = maxSortOrder + 1

        if (activeSemester?.id) {
          payload.semester_id = activeSemester.id
        }
      }

      if (editingActivity) {
        const { error: updateError } = await supabase
          .from('activity_requirements')
          .update(payload)
          .eq('id', editingActivity.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('activity_requirements')
          .insert(payload)

        if (insertError) throw insertError
      }

      setShowActivityForm(false)
      setEditingActivity(null)
      await loadData()
      onChanged?.()
    } catch (err) {
      console.error('Save activity error:', err)
      setError(err.message || 'Unable to save activity.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteActivity(activity) {
    if (
      !window.confirm(
        `Delete activity "${activity.label}"? Student progress for this activity may also need to be removed first.`
      )
    ) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const { error: activityDeleteError } = await supabase
        .from('student_activity')
        .delete()
        .eq('requirement_id', activity.id)

      if (activityDeleteError) throw activityDeleteError

      const { error: requirementDeleteError } = await supabase
        .from('activity_requirements')
        .delete()
        .eq('id', activity.id)

      if (requirementDeleteError) throw requirementDeleteError

      await loadData()
      onChanged?.()
    } catch (err) {
      console.error('Delete activity error:', err)
      setError(err.message || 'Unable to delete activity.')
    } finally {
      setSaving(false)
    }
  }

  async function moveLegacyActivity(activity, subjectId) {
    const subject = subjects.find((item) => item.id === Number(subjectId))

    if (!subject) return

    setSaving(true)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('activity_requirements')
        .update({
          subject_id: subject.id,
          university: subject.university || activity.university || null,
        })
        .eq('id', activity.id)

      if (updateError) throw updateError

      await loadData()
      onChanged?.()
    } catch (err) {
      console.error('Move legacy activity error:', err)
      setError(err.message || 'Unable to move activity.')
    } finally {
      setSaving(false)
    }
  }

  function studentSubjectIds(studentId) {
    return assignments
      .filter(
        (assignment) =>
          assignment.student_id === studentId &&
          assignment.active !== false
      )
      .map((assignment) => assignment.subject_id)
  }

  async function toggleStudentSubject(student, subject) {
    const existing = assignments.find(
      (assignment) =>
        assignment.student_id === student.id &&
        assignment.subject_id === subject.id
    )

    setSaving(true)
    setError('')

    try {
      if (existing?.active !== false) {
        const { error: deleteError } = await supabase
          .from('student_subjects')
          .delete()
          .eq('student_id', student.id)
          .eq('subject_id', subject.id)

        if (deleteError) throw deleteError
      } else {
        const { error: upsertError } = await supabase
          .from('student_subjects')
          .upsert(
            {
              student_id: student.id,
              subject_id: subject.id,
              active: true,
              assigned_at: new Date().toISOString(),
            },
            {
              onConflict: 'student_id,subject_id',
            }
          )

        if (upsertError) throw upsertError
      }

      await loadData()
      onChanged?.()
    } catch (err) {
      console.error('Assign subject error:', err)
      setError(err.message || 'Unable to update subject assignment.')
    } finally {
      setSaving(false)
    }
  }

  const assignmentSubjects = useMemo(() => {
    if (!assignmentStudent) return []

    return subjects.filter(
      (subject) =>
        !subject.university ||
        subject.university === assignmentStudent.university
    )
  }, [subjects, assignmentStudent])

  return (
    <div
      className="subject-manager-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose?.()
        }
      }}
    >
      <div
        className="subject-manager-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="subject-manager-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="subject-manager-header">
          <div>
            <span className="subject-manager-eyebrow">
              ACTIVITY MANAGEMENT
            </span>
            <h2 id="subject-manager-title">
              Subjects & Activities
            </h2>
            <p>
              Organize reusable activities by subject, then assign subjects to students.
            </p>
          </div>

          <button
            type="button"
            className="subject-manager-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="subject-manager-tabs">
          <button
            type="button"
            className={tab === 'subjects' ? 'active' : ''}
            onClick={() => setTab('subjects')}
          >
            Subjects
          </button>

          <button
            type="button"
            className={tab === 'students' ? 'active' : ''}
            onClick={() => setTab('students')}
          >
            Student Assignments
          </button>
        </div>

        {error && (
          <div className="subject-manager-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="subject-manager-loading">
            Loading subject repository...
          </div>
        ) : tab === 'subjects' ? (
          <div className="subject-manager-body subject-manager-subject-layout">
            <aside className="subject-manager-sidebar">
              <div className="subject-manager-toolbar">
                <input
                  type="search"
                  placeholder="Search subjects..."
                  value={subjectSearch}
                  onChange={(event) =>
                    setSubjectSearch(event.target.value)
                  }
                />

                <select
                  value={schoolFilter}
                  onChange={(event) =>
                    setSchoolFilter(event.target.value)
                  }
                >
                  <option value="all">All schools</option>
                  <option value="AUHS">AUHS</option>
                  <option value="PACIFIC">PACIFIC</option>
                </select>
              </div>

              <button
                type="button"
                className="subject-manager-primary subject-manager-new-subject"
                onClick={openNewSubject}
              >
                + New Subject
              </button>

              <div className="subject-manager-subject-list">
                {filteredSubjects.length === 0 ? (
                  <div className="subject-manager-empty-small">
                    No subjects found.
                  </div>
                ) : (
                  filteredSubjects.map((subject) => {
                    const counts =
                      subjectCounts[subject.id] || {}

                    return (
                      <button
                        key={subject.id}
                        type="button"
                        className={
                          selectedSubjectId === subject.id
                            ? 'subject-manager-subject-card active'
                            : 'subject-manager-subject-card'
                        }
                        onClick={() =>
                          setSelectedSubjectId(subject.id)
                        }
                      >
                        <div>
                          <strong>{subject.name}</strong>
                          <span>
                            {subject.university || 'All schools'}
                          </span>
                        </div>

                        <small>
                          {counts.activities || 0} activities ·{' '}
                          {counts.students || 0} students
                        </small>
                      </button>
                    )
                  })
                )}
              </div>

              {legacyActivities.length > 0 && (
                <div className="subject-manager-legacy-note">
                  <strong>
                    {legacyActivities.length} Legacy / Unassigned
                  </strong>
                  <span>
                    Existing activities are kept safe until you move them into a subject.
                  </span>
                </div>
              )}
            </aside>

            <main className="subject-manager-content">
              {!selectedSubject ? (
                <div className="subject-manager-empty">
                  <strong>Select a subject</strong>
                  <span>
                    Choose a subject on the left or create a new one.
                  </span>
                </div>
              ) : (
                <>
                  <div className="subject-manager-subject-heading">
                    <div>
                      <span>
                        {selectedSubject.university || 'All schools'}
                      </span>
                      <h3>{selectedSubject.name}</h3>
                      <p>
                        {selectedSubject.description ||
                          'Reusable activity repository for this subject.'}
                      </p>
                    </div>

                    <div className="subject-manager-heading-actions">
                      <button
                        type="button"
                        className="subject-manager-secondary"
                        onClick={() =>
                          openEditSubject(selectedSubject)
                        }
                      >
                        Edit Subject
                      </button>

                      <button
                        type="button"
                        className="subject-manager-primary"
                        onClick={openNewActivity}
                      >
                        + Add Activity
                      </button>
                    </div>
                  </div>

                  {groupedActivities.length === 0 ? (
                    <div className="subject-manager-empty">
                      <strong>No activities yet</strong>
                      <span>
                        Add the first reusable activity for {selectedSubject.name}.
                      </span>
                    </div>
                  ) : (
                    <div className="subject-manager-week-list">
                      {groupedActivities.map((group) => (
                        <section
                          key={group.week}
                          className="subject-manager-week"
                        >
                          <div className="subject-manager-week-title">
                            <span>{group.label}</span>
                            <small>
                              {group.items.length}{' '}
                              {group.items.length === 1
                                ? 'activity'
                                : 'activities'}
                            </small>
                          </div>

                          <div className="subject-manager-activity-list">
                            {group.items.map((activity) => (
                              <article
                                key={activity.id}
                                className="subject-manager-activity-row"
                              >
                                <div>
                                  <strong>{activity.label}</strong>
                                  <span>
                                    {activity.code || 'No code'}
                                    {activity.start_date
                                      ? ` · Starts ${activity.start_date}`
                                      : ''}
                                    {activity.end_date
                                      ? ` · Ends ${activity.end_date}`
                                      : ''}
                                  </span>
                                </div>

                                <div className="subject-manager-row-actions">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditActivity(activity)
                                    }
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() =>
                                      deleteActivity(activity)
                                    }
                                  >
                                    Delete
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}

                  <div className="subject-manager-delete-subject">
                    <button
                      type="button"
                      onClick={() =>
                        deleteSubject(selectedSubject)
                      }
                    >
                      Delete Subject
                    </button>
                  </div>
                </>
              )}
            </main>
          </div>
        ) : (
          <div className="subject-manager-body subject-manager-student-layout">
            <div className="subject-manager-student-toolbar">
              <input
                type="search"
                placeholder="Search students..."
                value={studentSearch}
                onChange={(event) =>
                  setStudentSearch(event.target.value)
                }
              />

              <select
                value={schoolFilter}
                onChange={(event) =>
                  setSchoolFilter(event.target.value)
                }
              >
                <option value="all">All schools</option>
                <option value="AUHS">AUHS</option>
                <option value="PACIFIC">PACIFIC</option>
              </select>
            </div>

            <div className="subject-manager-student-table-wrap">
              <table className="subject-manager-student-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>School</th>
                    <th>Assigned Subjects</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map((student) => {
                    const ids = studentSubjectIds(student.id)
                    const names = subjects
                      .filter((subject) => ids.includes(subject.id))
                      .map((subject) => subject.name)

                    return (
                      <tr key={student.id}>
                        <td>
                          <strong>{student.name}</strong>
                          <span>{student.email || '—'}</span>
                        </td>
                        <td>{student.university || '—'}</td>
                        <td>
                          {names.length
                            ? names.join(', ')
                            : 'No subject assigned'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="subject-manager-secondary"
                            onClick={() =>
                              setAssignmentStudent(student)
                            }
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showSubjectForm && (
          <div className="subject-manager-inner-overlay">
            <form
              className="subject-manager-form-modal"
              onSubmit={saveSubject}
            >
              <div className="subject-manager-form-header">
                <div>
                  <span>SUBJECT</span>
                  <h3>
                    {editingSubject
                      ? 'Edit Subject'
                      : 'New Subject'}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSubjectForm(false)}
                >
                  ×
                </button>
              </div>

              <label>
                <span>Subject Name</span>
                <input
                  value={subjectForm.name}
                  onChange={(event) =>
                    setSubjectForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Anatomy"
                  autoFocus
                />
              </label>

              <label>
                <span>School</span>
                <select
                  value={subjectForm.university}
                  onChange={(event) =>
                    setSubjectForm((current) => ({
                      ...current,
                      university: event.target.value,
                    }))
                  }
                >
                  <option value="AUHS">AUHS</option>
                  <option value="PACIFIC">PACIFIC</option>
                </select>
              </label>

              <label>
                <span>Description</span>
                <textarea
                  value={subjectForm.description}
                  onChange={(event) =>
                    setSubjectForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows="3"
                  placeholder="Optional notes about this subject..."
                />
              </label>

              <div className="subject-manager-form-actions">
                <button
                  type="button"
                  className="subject-manager-secondary"
                  onClick={() => setShowSubjectForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="subject-manager-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        )}

        {showActivityForm && selectedSubject && (
          <div className="subject-manager-inner-overlay">
            <form
              className="subject-manager-form-modal"
              onSubmit={saveActivity}
            >
              <div className="subject-manager-form-header">
                <div>
                  <span>{selectedSubject.name}</span>
                  <h3>
                    {editingActivity
                      ? 'Edit Activity'
                      : 'Add Activity'}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setShowActivityForm(false)}
                >
                  ×
                </button>
              </div>

              <label>
                <span>Activity Name</span>
                <input
                  value={activityForm.label}
                  onChange={(event) =>
                    setActivityForm((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  autoFocus
                />
              </label>

              <div className="subject-manager-form-grid">
                <label>
                  <span>Code</span>
                  <input
                    value={activityForm.code}
                    onChange={(event) =>
                      setActivityForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Week</span>
                  <input
                    type="number"
                    min="0"
                    value={activityForm.week}
                    onChange={(event) =>
                      setActivityForm((current) => ({
                        ...current,
                        week: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="subject-manager-form-grid">
                <label>
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={activityForm.startDate}
                    onChange={(event) =>
                      setActivityForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>End Date</span>
                  <input
                    type="date"
                    value={activityForm.endDate}
                    onChange={(event) =>
                      setActivityForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="subject-manager-form-actions">
                <button
                  type="button"
                  className="subject-manager-secondary"
                  onClick={() => setShowActivityForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="subject-manager-primary"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : editingActivity
                      ? 'Save Activity'
                      : 'Add Activity'}
                </button>
              </div>
            </form>
          </div>
        )}

        {assignmentStudent && (
          <div className="subject-manager-inner-overlay">
            <div className="subject-manager-form-modal">
              <div className="subject-manager-form-header">
                <div>
                  <span>ASSIGN SUBJECTS</span>
                  <h3>{assignmentStudent.name}</h3>
                  <p>
                    {assignmentStudent.university || 'No school'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setAssignmentStudent(null)}
                >
                  ×
                </button>
              </div>

              <div className="subject-manager-assignment-list">
                {assignmentSubjects.length === 0 ? (
                  <div className="subject-manager-empty-small">
                    No subjects are available for this student's school.
                  </div>
                ) : (
                  assignmentSubjects.map((subject) => {
                    const checked = studentSubjectIds(
                      assignmentStudent.id
                    ).includes(subject.id)

                    return (
                      <label
                        key={subject.id}
                        className="subject-manager-assignment-option"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving}
                          onChange={() =>
                            toggleStudentSubject(
                              assignmentStudent,
                              subject
                            )
                          }
                        />

                        <div>
                          <strong>{subject.name}</strong>
                          <span>
                            {subject.university || 'All schools'} ·{' '}
                            {subjectCounts[subject.id]?.activities || 0}{' '}
                            activities
                          </span>
                        </div>
                      </label>
                    )
                  })
                )}
              </div>

              <div className="subject-manager-form-actions">
                <button
                  type="button"
                  className="subject-manager-primary"
                  onClick={() => setAssignmentStudent(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {legacyActivities.length > 0 && tab === 'subjects' && (
          <details className="subject-manager-legacy-panel">
            <summary>
              Legacy / Unassigned Activities ({legacyActivities.length})
            </summary>

            <div>
              {legacyActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="subject-manager-legacy-row"
                >
                  <div>
                    <strong>{activity.label}</strong>
                    <span>
                      {activity.university || 'No school'} · Week{' '}
                      {activity.week ?? 0}
                    </span>
                  </div>

                  <select
                    defaultValue=""
                    disabled={saving}
                    onChange={(event) => {
                      if (event.target.value) {
                        moveLegacyActivity(
                          activity,
                          event.target.value
                        )
                      }
                    }}
                  >
                    <option value="">
                      Move to subject...
                    </option>

                    {subjects
                      .filter(
                        (subject) =>
                          !activity.university ||
                          activity.university === 'SHARED' ||
                          !subject.university ||
                          subject.university === activity.university
                      )
                      .map((subject) => (
                        <option
                          key={subject.id}
                          value={subject.id}
                        >
                          {subject.name} ·{' '}
                          {subject.university || 'All'}
                        </option>
                      ))}
                  </select>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

export default SubjectActivityManager
