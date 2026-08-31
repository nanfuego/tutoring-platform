import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import StudentActivityModal from './StudentActivityModal'
import './ActivityTracker.css'

const DEFAULT_SEMESTER = 'Fall Semester'

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatDate(date) {
  if (!date) return '—'

  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function ActivityTracker() {
  const [semester, setSemester] = useState(null)
  const [students, setStudents] = useState([])
  const [semesterStudents, setSemesterStudents] = useState([])
  const [activities, setActivities] = useState([])
  const [studentActivity, setStudentActivity] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [clinicFilter, setClinicFilter] = useState('all')

  const [selectedStudent, setSelectedStudent] = useState(null)

  const [showCreateActivity, setShowCreateActivity] = useState(false)
  const [showEndSemester, setShowEndSemester] = useState(false)

  const [activityForm, setActivityForm] = useState({
    name: '',
    code: '',
    week: '1',
    description: '',
  })

  const [nextSemesterName, setNextSemesterName] = useState('')
  const [nextStudentIds, setNextStudentIds] = useState([])
  const [nextActivityIds, setNextActivityIds] = useState([])

  useEffect(() => {
    loadStudentProgress()
  }, [])

  async function loadStudentProgress() {
    setLoading(true)
    setError('')

    try {
      /*
       * Get the active semester.
       */
      let { data: activeSemester, error: semesterError } = await supabase
        .from('semesters')
        .select('*')
        .eq('status', 'active')
        .maybeSingle()

      if (semesterError) throw semesterError

      /*
       * If this is a new installation and there isn't
       * an active semester yet, create the default one.
       */
      if (!activeSemester) {
        const { data: createdSemester, error: createSemesterError } =
          await supabase
            .from('semesters')
            .insert({
              name: DEFAULT_SEMESTER,
              status: 'active',
              start_date: new Date().toISOString().slice(0, 10),
            })
            .select()
            .single()

        if (createSemesterError) throw createSemesterError

        activeSemester = createdSemester
      }

      const [
        studentsResult,
        membershipResult,
        activitiesResult,
        studentActivityResult,
      ] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .order('name', { ascending: true }),

        supabase
          .from('semester_students')
          .select('*')
          .eq('semester_id', activeSemester.id),

        supabase
          .from('activity_requirements')
          .select('*')
          .eq('semester_id', activeSemester.id)
          .order('week', { ascending: true })
          .order('sort_order', { ascending: true }),

        supabase
          .from('student_activity')
          .select('*'),
      ])

      if (studentsResult.error) throw studentsResult.error
      if (membershipResult.error) throw membershipResult.error
      if (activitiesResult.error) throw activitiesResult.error
      if (studentActivityResult.error) throw studentActivityResult.error

      setSemester(activeSemester)
      setStudents(studentsResult.data || [])
      setSemesterStudents(membershipResult.data || [])
      setActivities(activitiesResult.data || [])
      setStudentActivity(studentActivityResult.data || [])
    } catch (err) {
      console.error('Student Progress load error:', err)
      setError(err.message || 'Unable to load student progress.')
    } finally {
      setLoading(false)
    }
  }

  const enrolledStudentIds = useMemo(
    () => new Set(semesterStudents.map((row) => row.student_id)),
    [semesterStudents]
  )

  const enrolledStudents = useMemo(
    () => students.filter((student) => enrolledStudentIds.has(student.id)),
    [students, enrolledStudentIds]
  )

  const clinics = useMemo(() => {
    return Array.from(
      new Set(
        enrolledStudents
          .map((student) => student.clinic)
          .filter(Boolean)
      )
    ).sort()
  }, [enrolledStudents])

  const progressByStudent = useMemo(() => {
    const result = {}

    enrolledStudents.forEach((student) => {
      const applicableActivities = activities.filter(
        (activity) =>
          !activity.student_id ||
          activity.student_id === student.id
      )

      const applicableIds = new Set(
        applicableActivities.map((activity) => activity.id)
      )

      const completed = studentActivity.filter(
        (item) =>
          item.student_id === student.id &&
          item.completed &&
          applicableIds.has(item.requirement_id)
      ).length

      const total = applicableActivities.length

      result[student.id] = {
        completed,
        total,
        percentage: total
          ? Math.round((completed / total) * 100)
          : 0,
      }
    })

    return result
  }, [enrolledStudents, activities, studentActivity])

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()

    return enrolledStudents.filter((student) => {
      const matchesSearch =
        !query ||
        student.name?.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query) ||
        student.program?.toLowerCase().includes(query) ||
        student.university?.toLowerCase().includes(query)

      const matchesClinic =
        clinicFilter === 'all' ||
        student.clinic === clinicFilter

      return matchesSearch && matchesClinic
    })
  }, [enrolledStudents, search, clinicFilter])

  const summary = useMemo(() => {
    const percentages = enrolledStudents.map(
      (student) => progressByStudent[student.id]?.percentage || 0
    )

    const average = percentages.length
      ? Math.round(
          percentages.reduce((sum, value) => sum + value, 0) /
            percentages.length
        )
      : 0

    const completed = percentages.filter(
      (percentage) => percentage >= 100
    ).length

    const inProgress = percentages.filter(
      (percentage) => percentage > 0 && percentage < 100
    ).length

    return {
      students: enrolledStudents.length,
      activities: activities.length,
      average,
      completed,
      inProgress,
    }
  }, [enrolledStudents, progressByStudent, activities])

  function openEndSemesterModal() {
    setError('')

    setNextSemesterName('')
    setNextStudentIds(enrolledStudents.map((student) => student.id))
    setNextActivityIds(activities.map((activity) => activity.id))

    setShowEndSemester(true)
  }

  function toggleStudent(studentId) {
    setNextStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    )
  }

  function toggleActivity(activityId) {
    setNextActivityIds((current) =>
      current.includes(activityId)
        ? current.filter((id) => id !== activityId)
        : [...current, activityId]
    )
  }

  async function handleCreateActivity(event) {
    event.preventDefault()

    if (!semester) return

    if (!activityForm.name.trim()) {
      setError('Please enter an activity name.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const code =
        activityForm.code.trim() ||
        `ACT-${Date.now()}`

      const { error: insertError } = await supabase
        .from('activity_requirements')
        .insert({
          code,
          label: activityForm.name.trim(),
          week: Number(activityForm.week) || 1,
          sort_order: activities.length,
          semester_id: semester.id,
          description:
            activityForm.description.trim() || null,
        })

      if (insertError) throw insertError

      setActivityForm({
        name: '',
        code: '',
        week: '1',
        description: '',
      })

      setShowCreateActivity(false)

      await loadStudentProgress()
    } catch (err) {
      console.error('Create activity error:', err)
      setError(err.message || 'Unable to create activity.')
    } finally {
      setSaving(false)
    }
  }

  async function handleEndSemester() {
    if (!semester) return

    if (!nextSemesterName.trim()) {
      setError('Please enter the name of the next semester.')
      return
    }

    if (!nextStudentIds.length) {
      setError('Please select at least one student.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const today = new Date().toISOString().slice(0, 10)

      /*
       * 1. Complete the current semester.
       */
      const { error: completeError } = await supabase
        .from('semesters')
        .update({
          status: 'completed',
          end_date: today,
        })
        .eq('id', semester.id)

      if (completeError) throw completeError

      /*
       * 2. Create the new active semester.
       */
      const { data: newSemester, error: newSemesterError } =
        await supabase
          .from('semesters')
          .insert({
            name: nextSemesterName.trim(),
            status: 'active',
            start_date: today,
          })
          .select()
          .single()

      if (newSemesterError) {
        /*
         * Attempt to restore the previous semester if
         * creation of the new one fails.
         */
        await supabase
          .from('semesters')
          .update({
            status: 'active',
            end_date: null,
          })
          .eq('id', semester.id)

        throw newSemesterError
      }

      /*
       * 3. Add selected students to the new semester.
       */
      const membershipRows = nextStudentIds.map(
        (studentId) => ({
          semester_id: newSemester.id,
          student_id: studentId,
        })
      )

      const { error: membershipError } = await supabase
        .from('semester_students')
        .insert(membershipRows)

      if (membershipError) throw membershipError

      /*
       * 4. Copy selected activities into the new semester.
       *
       * New IDs are generated, which means completion from
       * the previous semester cannot leak into the new one.
       */
      const activitiesToCopy = activities.filter((activity) =>
        nextActivityIds.includes(activity.id)
      )

      if (activitiesToCopy.length) {
        const activityRows = activitiesToCopy.map(
          (activity, index) => ({
            code: `${activity.code || 'ACT'}-${Date.now()}-${index}`,
            label: activity.label,
            week: activity.week,
            sort_order:
              activity.sort_order ?? index,
            semester_id: newSemester.id,
            description: activity.description || null,
          })
        )

        const { error: activityCopyError } = await supabase
          .from('activity_requirements')
          .insert(activityRows)

        if (activityCopyError) throw activityCopyError
      }

      setShowEndSemester(false)

      await loadStudentProgress()
    } catch (err) {
      console.error('End semester error:', err)
      setError(
        err.message ||
          'Unable to complete the semester rollover.'
      )
    } finally {
      setSaving(false)
    }
  }

  function closeChecklist() {
    setSelectedStudent(null)
    loadStudentProgress()
  }

  if (loading) {
    return (
      <div className="activity-tracker-page student-progress-workspace">
        <div className="progress-loading">
          <div className="loading-spinner" />
          <strong>Loading Student Progress</strong>
          <span>Preparing the current semester...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="activity-tracker-page student-progress-workspace">

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <div className="student-progress-heading">
        <div>
          <span className="page-kicker">
            ACTIVITY MANAGEMENT
          </span>

          <h1>Student Progress</h1>

          <p>
            Monitor student activity and manage the current
            semester.
          </p>
        </div>

        <div className="student-progress-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              setError('')
              setShowCreateActivity(true)
            }}
          >
            <span>＋</span>
            Create Activity
          </button>

          <button
            type="button"
            className="primary-action"
            onClick={openEndSemesterModal}
          >
            End Semester
          </button>
        </div>
      </div>

      {/* =====================================================
          CURRENT SEMESTER
      ====================================================== */}

      <section className="semester-banner">
        <div className="semester-banner-main">
          <span className="semester-label">
            CURRENT SEMESTER
          </span>

          <h2>
            {semester?.name || DEFAULT_SEMESTER}
          </h2>

          <p>
            Started {formatDate(semester?.start_date)}
          </p>
        </div>

        <div className="semester-meta">
          <strong>{summary.students}</strong>
          <span>students enrolled</span>
        </div>
      </section>

      {/* =====================================================
          SUMMARY
      ====================================================== */}

      <div className="activity-summary">

        <div className="summary-card">
          <span className="summary-label">
            Students
          </span>

          <strong className="summary-value">
            {summary.students}
          </strong>

          <span className="summary-note">
            enrolled this semester
          </span>
        </div>

        <div className="summary-card">
          <span className="summary-label">
            Activities
          </span>

          <strong className="summary-value">
            {summary.activities}
          </strong>

          <span className="summary-note">
            assigned activities
          </span>
        </div>

        <div className="summary-card">
          <span className="summary-label">
            Avg. Completion
          </span>

          <strong className="summary-value accent">
            {summary.average}%
          </strong>

          <span className="summary-note">
            across enrolled students
          </span>
        </div>

        <div className="summary-card">
          <span className="summary-label">
            Fully Completed
          </span>

          <strong className="summary-value">
            {summary.completed}
          </strong>

          <span className="summary-note">
            students at 100%
          </span>
        </div>

      </div>

      {/* =====================================================
          CONTROLS
      ====================================================== */}

      <div className="activity-controls">

        <div className="search-wrap">
          <span className="search-icon">⌕</span>

          <input
            className="activity-search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search student..."
          />
        </div>

        <select
          className="clinic-filter"
          value={clinicFilter}
          onChange={(event) =>
            setClinicFilter(event.target.value)
          }
        >
          <option value="all">
            All Clinics
          </option>

          {clinics.map((clinic) => (
            <option key={clinic} value={clinic}>
              {clinic}
            </option>
          ))}
        </select>

      </div>

      {error && (
        <div className="page-error">
          <strong>Something went wrong</strong>
          <span>{error}</span>
        </div>
      )}

      {/* =====================================================
          STUDENT TABLE
      ====================================================== */}

      {filteredStudents.length === 0 ? (
        <div className="progress-empty">

          <div className="empty-icon">
            👥
          </div>

          <strong>
            {enrolledStudents.length
              ? 'No students found'
              : 'No students enrolled'}
          </strong>

          <span>
            {enrolledStudents.length
              ? 'Try changing your search or clinic filter.'
              : 'Use End Semester to choose students for the current semester.'}
          </span>

        </div>
      ) : (
        <div className="activity-table-wrapper">

          <table className="activity-table">

            <thead>
              <tr>
                <th>STUDENT</th>
                <th>PROGRAM / SCHOOL</th>
                <th>ACTIVITY PROGRESS</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>

              {filteredStudents.map((student) => {

                const progress =
                  progressByStudent[student.id] || {
                    completed: 0,
                    total: 0,
                    percentage: 0,
                  }

                const percentage =
                  progress.percentage

                const status =
                  percentage >= 100
                    ? 'Completed'
                    : percentage > 0
                      ? 'In Progress'
                      : 'Not Started'

                return (
                  <tr key={student.id}>

                    {/* STUDENT */}

                    <td>
                      <div className="student-identity">

                        <span className="student-avatar">
                          {getInitials(student.name)}
                        </span>

                        <div>
                          <strong>
                            {student.name}
                          </strong>

                          <span>
                            {student.email || 'No email'}
                          </span>
                        </div>

                      </div>
                    </td>

                    {/* PROGRAM */}

                    <td>
                      <div className="program-cell">

                        <strong>
                          {student.program || 'General'}
                        </strong>

                        <span>
                          {student.university ||
                            student.clinic ||
                            '—'}
                        </span>

                      </div>
                    </td>

                    {/* PROGRESS */}

                    <td>

                      <div className="progress-cell">

                        <div className="progress-bar">
                          <div
                            className={[
                              'progress-fill',
                              percentage === 0
                                ? 'not-started'
                                : '',
                              percentage >= 100
                                ? 'complete'
                                : '',
                            ].join(' ')}
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>

                        <div className="progress-text">
                          <strong>
                            {percentage}%
                          </strong>

                          <span>
                            {progress.completed}/
                            {progress.total}
                          </span>
                        </div>

                      </div>

                    </td>

                    {/* STATUS */}

                    <td>
                      <span
                        className={[
                          'progress-status',
                          percentage >= 100
                            ? 'complete'
                            : percentage > 0
                              ? 'in-progress'
                              : 'not-started',
                        ].join(' ')}
                      >
                        <i />
                        {status}
                      </span>
                    </td>

                    {/* ACTION */}

                    <td>

                      <button
                        type="button"
                        className="view-checklist-btn"
                        onClick={() =>
                          setSelectedStudent(student)
                        }
                      >
                        View Checklist
                        <span>→</span>
                      </button>

                    </td>

                  </tr>
                )
              })}

            </tbody>

          </table>

        </div>
      )}

      {/* =====================================================
          CHECKLIST MODAL
      ====================================================== */}

      {selectedStudent && (
        <StudentActivityModal
          student={selectedStudent}
          onClose={closeChecklist}
        />
      )}

      {/* =====================================================
          CREATE ACTIVITY MODAL
      ====================================================== */}

      {showCreateActivity && (
        <div
          className="progress-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setShowCreateActivity(false)
            }
          }}
        >

          <form
            className="progress-modal activity-create-modal"
            onSubmit={handleCreateActivity}
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="progress-modal-header">

              <div>
                <span className="page-kicker">
                  ACTIVITY MANAGEMENT
                </span>

                <h2>
                  Create Activity
                </h2>

                <p>
                  Add a new activity to{' '}
                  {semester?.name || 'the current semester'}.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                disabled={saving}
                onClick={() =>
                  setShowCreateActivity(false)
                }
              >
                ×
              </button>

            </div>

            {error && (
              <div className="modal-error">
                {error}
              </div>
            )}

            <div className="modal-section">

              <div className="modal-section-title">

                <span>01</span>

                <div>
                  <h3>
                    Activity Information
                  </h3>

                  <p>
                    Define what students need to
                    complete.
                  </p>
                </div>

              </div>

              <div className="modal-grid">

                <label>
                  <span>
                    Activity Name *
                  </span>

                  <input
                    required
                    autoFocus
                    value={activityForm.name}
                    onChange={(event) =>
                      setActivityForm({
                        ...activityForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="e.g. Initial Assessment"
                  />
                </label>

                <label>
                  <span>
                    Activity Week *
                  </span>

                  <select
                    value={activityForm.week}
                    onChange={(event) =>
                      setActivityForm({
                        ...activityForm,
                        week: event.target.value,
                      })
                    }
                  >
                    {Array.from(
                      { length: 16 },
                      (_, index) => (
                        <option
                          key={index + 1}
                          value={index + 1}
                        >
                          Week {index + 1}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    Activity Code
                  </span>

                  <input
                    value={activityForm.code}
                    onChange={(event) =>
                      setActivityForm({
                        ...activityForm,
                        code: event.target.value,
                      })
                    }
                    placeholder="Optional code"
                  />
                </label>

                <label className="full">
                  <span>
                    Activity Description
                  </span>

                  <textarea
                    rows="5"
                    value={activityForm.description}
                    onChange={(event) =>
                      setActivityForm({
                        ...activityForm,
                        description:
                          event.target.value,
                      })
                    }
                    placeholder="Describe what the student needs to complete..."
                  />
                </label>

              </div>

            </div>

            <div className="progress-modal-footer">

              <button
                type="button"
                className="secondary-action"
                disabled={saving}
                onClick={() =>
                  setShowCreateActivity(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-action"
                disabled={saving}
              >
                {saving
                  ? 'Creating...'
                  : 'Create Activity'}
              </button>

            </div>

          </form>

        </div>
      )}

      {/* =====================================================
          END SEMESTER MODAL
      ====================================================== */}

      {showEndSemester && (
        <div
          className="progress-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setShowEndSemester(false)
            }
          }}
        >

          <div
            className="progress-modal semester-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="progress-modal-header">

              <div>
                <span className="page-kicker">
                  SEMESTER MANAGEMENT
                </span>

                <h2>
                  End {semester?.name}
                </h2>

                <p>
                  Finish this semester and prepare
                  the next one.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                disabled={saving}
                onClick={() =>
                  setShowEndSemester(false)
                }
              >
                ×
              </button>

            </div>

            {error && (
              <div className="modal-error">
                {error}
              </div>
            )}

            <div className="semester-modal-body">

              {/* NEXT SEMESTER */}

              <section className="modal-section">

                <div className="modal-section-title">

                  <span>01</span>

                  <div>
                    <h3>
                      Next Semester
                    </h3>

                    <p>
                      Choose the name for the
                      new semester.
                    </p>
                  </div>

                </div>

                <label className="standalone-field">

                  <span>
                    Semester Name *
                  </span>

                  <input
                    value={nextSemesterName}
                    onChange={(event) =>
                      setNextSemesterName(
                        event.target.value
                      )
                    }
                    placeholder="e.g. Spring Semester"
                  />

                </label>

              </section>

              {/* STUDENTS */}

              <section className="modal-section">

                <div className="modal-section-title">

                  <span>02</span>

                  <div>
                    <h3>
                      Students
                    </h3>

                    <p>
                      Select who will be enrolled
                      in the new semester.
                    </p>
                  </div>

                </div>

                <div className="selection-toolbar">

                  <strong>
                    {nextStudentIds.length}
                    {' '}
                    selected
                  </strong>

                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setNextStudentIds(
                          students.map(
                            (student) =>
                              student.id
                          )
                        )
                      }
                    >
                      Select all
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setNextStudentIds([])
                      }
                    >
                      Clear
                    </button>
                  </div>

                </div>

                <div className="selection-grid">

                  {students.map((student) => {

                    const selected =
                      nextStudentIds.includes(
                        student.id
                      )

                    return (
                      <button
                        type="button"
                        key={student.id}
                        className={[
                          'selection-row',
                          selected
                            ? 'selected'
                            : '',
                        ].join(' ')}
                        onClick={() =>
                          toggleStudent(
                            student.id
                          )
                        }
                      >

                        <span className="selection-check">
                          {selected ? '✓' : ''}
                        </span>

                        <span>
                          <strong>
                            {student.name}
                          </strong>

                          <small>
                            {student.program ||
                              'General'}

                            {student.university
                              ? ` · ${student.university}`
                              : ''}

                            {student.clinic
                              ? ` · ${student.clinic}`
                              : ''}
                          </small>
                        </span>

                      </button>
                    )
                  })}

                </div>

              </section>

              {/* ACTIVITIES */}

              <section className="modal-section">

                <div className="modal-section-title">

                  <span>03</span>

                  <div>
                    <h3>
                      Activities
                    </h3>

                    <p>
                      Choose which activities should
                      carry over.
                    </p>
                  </div>

                </div>

                <div className="selection-toolbar">

                  <strong>
                    {nextActivityIds.length}
                    {' '}
                    selected
                  </strong>

                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setNextActivityIds(
                          activities.map(
                            (activity) =>
                              activity.id
                          )
                        )
                      }
                    >
                      Select all
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setNextActivityIds([])
                      }
                    >
                      Clear
                    </button>
                  </div>

                </div>

                <div className="selection-grid">

                  {activities.length === 0 ? (
                    <div className="selection-empty">
                      No activities are currently
                      assigned to this semester.
                    </div>
                  ) : (
                    activities.map((activity) => {

                      const selected =
                        nextActivityIds.includes(
                          activity.id
                        )

                      return (
                        <button
                          type="button"
                          key={activity.id}
                          className={[
                            'selection-row',
                            selected
                              ? 'selected'
                              : '',
                          ].join(' ')}
                          onClick={() =>
                            toggleActivity(
                              activity.id
                            )
                          }
                        >

                          <span className="selection-check">
                            {selected ? '✓' : ''}
                          </span>

                          <span>
                            <strong>
                              {activity.label}
                            </strong>

                            <small>
                              {activity.week
                                ? `Week ${activity.week}`
                                : 'General activity'}

                              {activity.code
                                ? ` · ${activity.code}`
                                : ''}
                            </small>
                          </span>

                        </button>
                      )
                    })
                  )}

                </div>

              </section>

            </div>

            <div className="progress-modal-footer">

              <button
                type="button"
                className="secondary-action"
                disabled={saving}
                onClick={() =>
                  setShowEndSemester(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-action"
                disabled={saving}
                onClick={handleEndSemester}
              >
                {saving
                  ? 'Starting...'
                  : `Start ${
                      nextSemesterName ||
                      'New Semester'
                    }`}
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  )
}

export default ActivityTracker