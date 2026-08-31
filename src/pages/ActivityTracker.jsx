import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './ActivityTracker.css'

function ActivityTracker() {
  const navigate = useNavigate()

  // ============================================================
  // DATA
  // ============================================================

  const [students, setStudents] = useState([])
  const [requirements, setRequirements] = useState([])
  const [activity, setActivity] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ============================================================
  // FILTERS
  // ============================================================

  const [search, setSearch] = useState('')
  const [clinicFilter, setClinicFilter] = useState('all')

  // ============================================================
  // CHECKLIST MODAL
  // ============================================================

  const [selectedStudent, setSelectedStudent] =
    useState(null)

  const [savingId, setSavingId] =
    useState(null)

  // ============================================================
  // ACTIVITY MANAGEMENT MODAL
  // ============================================================

  const [showActivityManagement, setShowActivityManagement] =
    useState(false)

  const [showAddActivity, setShowAddActivity] =
    useState(false)

  const [savingActivity, setSavingActivity] =
    useState(false)

  const [deletingActivityId, setDeletingActivityId] =
    useState(null)

  const [activityForm, setActivityForm] =
    useState({
      name: '',
      code: '',
      week: '1',
    })

  // ============================================================
  // LOAD DATA
  // ============================================================

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [
        studentsRes,
        requirementsRes,
        activityRes,
      ] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .order('name'),

        supabase
          .from('activity_requirements')
          .select('*')
          .order('sort_order', {
            ascending: true,
            nullsFirst: false,
          })
          .order('week', {
            ascending: true,
            nullsFirst: false,
          }),

        supabase
          .from('student_activity')
          .select('*'),
      ])

      if (studentsRes.error) {
        throw studentsRes.error
      }

      if (requirementsRes.error) {
        throw requirementsRes.error
      }

      if (activityRes.error) {
        throw activityRes.error
      }

      setStudents(
        studentsRes.data || []
      )

      setRequirements(
        requirementsRes.data || []
      )

      setActivity(
        activityRes.data || []
      )
    } catch (err) {
      console.error(
        'Student Progress load error:',
        err
      )

      setError(
        err.message ||
          'Unable to load Student Progress.'
      )
    } finally {
      setLoading(false)
    }
  }

  // ============================================================
  // CLINICS
  // ============================================================

  const clinics = useMemo(() => {
    const uniqueClinics = new Set()

    students.forEach((student) => {
      if (student.clinic) {
        uniqueClinics.add(student.clinic)
      }
    })

    return Array.from(uniqueClinics).sort()
  }, [students])

  // ============================================================
  // PROGRESS
  // ============================================================

  const progressMap = useMemo(() => {
    const map = {}

    students.forEach((student) => {
      const studentActivities =
        activity.filter(
          (item) =>
            item.student_id === student.id
        )

      const completed =
        studentActivities.filter(
          (item) => item.completed === true
        ).length

      map[student.id] = {
        completed,
        total: requirements.length,
      }
    })

    return map
  }, [
    students,
    activity,
    requirements,
  ])

  // ============================================================
  // FILTERED STUDENTS
  // ============================================================

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (
        clinicFilter !== 'all' &&
        student.clinic !== clinicFilter
      ) {
        return false
      }

      if (search.trim()) {
        const query =
          search.trim().toLowerCase()

        const studentName =
          student.name
            ?.toLowerCase() || ''

        const email =
          student.email
            ?.toLowerCase() || ''

        const university =
          student.university
            ?.toLowerCase() || ''

        const program =
          student.program
            ?.toLowerCase() || ''

        if (
          !studentName.includes(query) &&
          !email.includes(query) &&
          !university.includes(query) &&
          !program.includes(query)
        ) {
          return false
        }
      }

      return true
    })
  }, [
    students,
    search,
    clinicFilter,
  ])

  // ============================================================
  // ACTIVITY GROUPS
  // ============================================================

  const requirementsByWeek = useMemo(() => {
    const groups = {}

    requirements.forEach((requirement) => {
      const week =
        requirement.week ?? 0

      if (!groups[week]) {
        groups[week] = []
      }

      groups[week].push(
        requirement
      )
    })

    return Object.entries(groups)
      .sort(
        ([a], [b]) =>
          Number(a) - Number(b)
      )
      .map(
        ([week, items]) => ({
          week: Number(week),
          label:
            Number(week) === 0
              ? 'General'
              : `Week ${week}`,
          items,
        })
      )
  }, [requirements])

  // ============================================================
  // SUMMARY
  // ============================================================

  const totalStudents =
    students.length

  const totalActivities =
    requirements.length

  const totalCompleted =
    activity.filter(
      (item) => item.completed === true
    ).length

  const totalPossible =
    totalStudents *
    totalActivities

  const overallProgress =
    totalPossible > 0
      ? Math.round(
          (totalCompleted /
            totalPossible) *
            100
        )
      : 0

  // ============================================================
  // ACTIVITY LOOKUP
  // ============================================================

  function getActivity(
    studentId,
    requirementId
  ) {
    return activity.find(
      (item) =>
        item.student_id ===
          studentId &&
        item.requirement_id ===
          requirementId
    )
  }

  // ============================================================
  // CHECKLIST
  // ============================================================

  function openChecklist(student) {
    setSelectedStudent(student)
  }

  function closeChecklist() {
    setSelectedStudent(null)
  }

  async function toggleRequirement(
    studentId,
    requirementId,
    currentCompleted
  ) {
    setSavingId(requirementId)
    setError('')

    try {
      const existing =
        getActivity(
          studentId,
          requirementId
        )

      if (existing) {
        const {
          error: updateError,
        } = await supabase
          .from('student_activity')
          .update({
            completed:
              !currentCompleted,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            existing.id
          )

        if (updateError) {
          throw updateError
        }

        setActivity((previous) =>
          previous.map((item) =>
            item.id === existing.id
              ? {
                  ...item,
                  completed:
                    !currentCompleted,
                }
              : item
          )
        )
      } else {
        const {
          data,
          error: insertError,
        } = await supabase
          .from('student_activity')
          .insert({
            student_id:
              studentId,
            requirement_id:
              requirementId,
            completed: true,
          })
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        if (data) {
          setActivity((previous) => [
            ...previous,
            data,
          ])
        }
      }
    } catch (err) {
      console.error(
        'Toggle activity error:',
        err
      )

      setError(
        err.message ||
          'Unable to update activity.'
      )
    } finally {
      setSavingId(null)
    }
  }

  async function updateNote(
    studentId,
    requirementId,
    note
  ) {
    const existing =
      getActivity(
        studentId,
        requirementId
      )

    try {
      if (existing) {
        const {
          error: updateError,
        } = await supabase
          .from('student_activity')
          .update({
            note,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            existing.id
          )

        if (updateError) {
          throw updateError
        }

        setActivity((previous) =>
          previous.map((item) =>
            item.id === existing.id
              ? {
                  ...item,
                  note,
                }
              : item
          )
        )
      } else if (note.trim()) {
        const {
          data,
          error: insertError,
        } = await supabase
          .from('student_activity')
          .insert({
            student_id:
              studentId,
            requirement_id:
              requirementId,
            completed: false,
            note,
          })
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        if (data) {
          setActivity((previous) => [
            ...previous,
            data,
          ])
        }
      }
    } catch (err) {
      console.error(
        'Update note error:',
        err
      )

      setError(
        err.message ||
          'Unable to save note.'
      )
    }
  }

  // ============================================================
  // ACTIVITY MANAGEMENT
  // ============================================================

  function openActivityManagement() {
    setError('')
    setShowActivityManagement(true)
    setShowAddActivity(false)
  }

  function closeActivityManagement() {
    if (
      savingActivity ||
      deletingActivityId
    ) {
      return
    }

    setShowActivityManagement(false)
    setShowAddActivity(false)
    resetActivityForm()
  }

  function resetActivityForm() {
    setActivityForm({
      name: '',
      code: '',
      week: '1',
    })
  }

  function openAddActivity() {
    setError('')
    resetActivityForm()
    setShowAddActivity(true)
  }

  function closeAddActivity() {
    if (savingActivity) {
      return
    }

    setShowAddActivity(false)
    resetActivityForm()
  }

  async function createActivity(event) {
    event.preventDefault()

    const name =
      activityForm.name.trim()

    const code =
      activityForm.code.trim()

    const week =
      Number(activityForm.week)

    if (!name) {
      setError(
        'Please enter an activity name.'
      )
      return
    }

    if (
      !Number.isInteger(week) ||
      week < 0
    ) {
      setError(
        'Activity Week must be a valid number.'
      )
      return
    }

    setSavingActivity(true)
    setError('')

    try {
      /*
       * These are the columns that actually
       * exist in activity_requirements.
       *
       * No semester_id or description is
       * assumed here.
       */

      const {
        data,
        error: insertError,
      } = await supabase
        .from('activity_requirements')
        .insert({
          code:
            code ||
            `ACT-${Date.now()}`,
          label: name,
          week,
          sort_order:
            requirements.length,
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      if (data) {
        setRequirements((previous) => [
          ...previous,
          data,
        ])
      }

      setShowAddActivity(false)
      resetActivityForm()
    } catch (err) {
      console.error(
        'Create activity error:',
        err
      )

      setError(
        err.message ||
          'Unable to create activity.'
      )
    } finally {
      setSavingActivity(false)
    }
  }

  async function deleteActivity(
    requirement
  ) {
    const activityName =
      requirement.label ||
      'this activity'

    const confirmed =
      window.confirm(
        `Delete "${activityName}"?\n\nThis will remove this activity from the activity list and remove its checklist records for all students.\n\nThis cannot be undone.`
      )

    if (!confirmed) {
      return
    }

    setDeletingActivityId(
      requirement.id
    )

    setError('')

    try {
      /*
       * student_activity references the
       * activity requirement.
       *
       * Delete its student checklist
       * records first.
       */

      const {
        error:
          studentActivityError,
      } = await supabase
        .from('student_activity')
        .delete()
        .eq(
          'requirement_id',
          requirement.id
        )

      if (studentActivityError) {
        throw studentActivityError
      }

      /*
       * Now delete the activity itself.
       */

      const {
        error:
          requirementDeleteError,
      } = await supabase
        .from('activity_requirements')
        .delete()
        .eq(
          'id',
          requirement.id
        )

      if (requirementDeleteError) {
        throw requirementDeleteError
      }

      setRequirements((previous) =>
        previous.filter(
          (item) =>
            item.id !==
            requirement.id
        )
      )

      setActivity((previous) =>
        previous.filter(
          (item) =>
            item.requirement_id !==
            requirement.id
        )
      )
    } catch (err) {
      console.error(
        'Delete activity error:',
        err
      )

      setError(
        err.message ||
          'Unable to delete activity.'
      )
    } finally {
      setDeletingActivityId(null)
    }
  }

  // ============================================================
  // END SEMESTER
  // ============================================================

  function handleEndSemester() {
    /*
     * The current database structure supplied
     * does not contain semester tables.
     *
     * We intentionally do not pretend there is
     * a semester system in Supabase yet.
     *
     * The UI explains this rather than issuing
     * a database query against a table that
     * doesn't exist.
     */

    window.alert(
      'Semester management is not connected yet.\n\nThe current database structure does not include semester tables. The Student Progress and Activity Management functions are ready, but semester rollover needs the semester database tables first.'
    )
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="activity-page">

      {/* ======================================================
          PAGE HEADER
      ======================================================= */}

      <div className="activity-page-header">

        <div className="activity-page-header-copy">

          <div className="activity-eyebrow">
            ACTIVITY MANAGEMENT
          </div>

          <h1>
            Student Progress
          </h1>

          <p>
            Monitor student activity
            and manage the current
            semester.
          </p>

        </div>

        <div className="activity-page-actions">

          <button
            type="button"
            className="activity-primary-button"
            onClick={
              openActivityManagement
            }
          >
            <span className="button-plus">
              +
            </span>
            Manage Activities
          </button>

          <button
            type="button"
            className="activity-primary-button"
            onClick={
              handleEndSemester
            }
          >
            End Semester
          </button>

        </div>

      </div>


      {/* ======================================================
          ERROR
      ======================================================= */}

      {error && (
        <div className="activity-error">
          <strong>
            Something went wrong
          </strong>

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError('')
            }
          >
            ×
          </button>
        </div>
      )}


      {/* ======================================================
          SUMMARY
      ======================================================= */}

      <div className="activity-summary-grid">

        <div className="activity-summary-card">

          <span>
            STUDENTS
          </span>

          <strong>
            {totalStudents}
          </strong>

          <small>
            Active student records
          </small>

        </div>


        <div className="activity-summary-card">

          <span>
            ACTIVITIES
          </span>

          <strong>
            {totalActivities}
          </strong>

          <small>
            Checklist activities
          </small>

        </div>


        <div className="activity-summary-card">

          <span>
            COMPLETED
          </span>

          <strong>
            {totalCompleted}
          </strong>

          <small>
            Completed checklist items
          </small>

        </div>


        <div className="activity-summary-card">

          <span>
            OVERALL PROGRESS
          </span>

          <strong>
            {overallProgress}%
          </strong>

          <small>
            Across all students
          </small>

        </div>

      </div>


      {/* ======================================================
          FILTER BAR
      ======================================================= */}

      <div className="activity-filter-card">

        <div className="activity-filter-search">

          <span className="search-icon">
            ⌕
          </span>

          <input
            type="text"
            placeholder="Search student..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />

          {search && (
            <button
              type="button"
              className="clear-search"
              onClick={() =>
                setSearch('')
              }
            >
              ×
            </button>
          )}

        </div>


        <select
          className="activity-filter-select"
          value={clinicFilter}
          onChange={(event) =>
            setClinicFilter(
              event.target.value
            )
          }
        >
          <option value="all">
            All Clinics
          </option>

          {clinics.map((clinic) => (
            <option
              key={clinic}
              value={clinic}
            >
              {clinic}
            </option>
          ))}
        </select>


        <div className="activity-filter-count">
          Showing{' '}
          <strong>
            {filteredStudents.length}
          </strong>{' '}
          of{' '}
          <strong>
            {students.length}
          </strong>{' '}
          students
        </div>

      </div>


      {/* ======================================================
          STUDENT TABLE
      ======================================================= */}

      {loading ? (

        <div className="activity-loading-card">

          <div className="activity-loading-spinner" />

          <strong>
            Loading student progress
          </strong>

          <span>
            Please wait...
          </span>

        </div>

      ) : filteredStudents.length === 0 ? (

        <div className="activity-empty-card">

          <div className="activity-empty-icon">
            ?
          </div>

          <h3>
            No students found
          </h3>

          <p>
            {search ||
            clinicFilter !== 'all'
              ? 'Try changing the search or clinic filter.'
              : 'Add students first from the Dashboard.'}
          </p>

          {(search ||
            clinicFilter !== 'all') && (
            <button
              type="button"
              className="activity-secondary-button"
              onClick={() => {
                setSearch('')
                setClinicFilter('all')
              }}
            >
              Clear Filters
            </button>
          )}

        </div>

      ) : (

        <div className="activity-table-card">

          <div className="activity-table-scroll">

            <table className="activity-table">

              <thead>

                <tr>

                  <th>
                    STUDENT
                  </th>

                  <th>
                    PROGRAM / SCHOOL
                  </th>

                  <th>
                    ACTIVITY PROGRESS
                  </th>

                  <th>
                    STATUS
                  </th>

                  <th className="activity-table-action-heading">
                    ACTION
                  </th>

                </tr>

              </thead>


              <tbody>

                {filteredStudents.map(
                  (student) => {

                    const progress =
                      progressMap[
                        student.id
                      ] || {
                        completed: 0,
                        total:
                          requirements.length,
                      }

                    const percentage =
                      progress.total > 0
                        ? Math.round(
                            (progress.completed /
                              progress.total) *
                              100
                          )
                        : 0

                    let status =
                      'Not Started'

                    if (
                      percentage >=
                      100
                    ) {
                      status =
                        'Completed'
                    } else if (
                      percentage > 0
                    ) {
                      status =
                        'In Progress'
                    }

                    return (
                      <tr
                        key={
                          student.id
                        }
                      >

                        <td>

                          <div className="student-table-person">

                            <div className="student-avatar">
                              {student.name
                                ?.charAt(
                                  0
                                )
                                ?.toUpperCase() ||
                                '?'}
                            </div>

                            <div>

                              <strong>
                                {
                                  student.name
                                }
                              </strong>

                              {student.email && (
                                <span>
                                  {
                                    student.email
                                  }
                                </span>
                              )}

                            </div>

                          </div>

                        </td>


                        <td>

                          <div className="program-school-cell">

                            <strong>
                              {
                                student.program ||
                                'General'
                              }
                            </strong>

                            <span>
                              {
                                student.university ||
                                student.clinic ||
                                '—'
                              }
                            </span>

                          </div>

                        </td>


                        <td>

                          <div className="progress-cell">

                            <div className="progress-track">

                              <div
                                className="progress-fill"
                                style={{
                                  width: `${percentage}%`,
                                }}
                              />

                            </div>

                            <strong>
                              {percentage}%
                            </strong>

                            <span>
                              {
                                progress.completed
                              }/
                              {
                                progress.total
                              }
                            </span>

                          </div>

                        </td>


                        <td>

                          <span
                            className={`progress-status progress-status-${status
                              .toLowerCase()
                              .replace(
                                ' ',
                                '-'
                              )}`}
                          >

                            <span className="status-dot" />

                            {status}

                          </span>

                        </td>


                        <td>

                          <button
                            type="button"
                            className="view-checklist-button"
                            onClick={() =>
                              openChecklist(
                                student
                              )
                            }
                          >
                            View Checklist
                            <span>
                              →
                            </span>
                          </button>

                        </td>

                      </tr>
                    )
                  }
                )}

              </tbody>

            </table>

          </div>

        </div>

      )}


      {/* ======================================================
          CHECKLIST MODAL
      ======================================================= */}

      {selectedStudent && (

        <div
          className="activity-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeChecklist()
            }
          }}
        >

          <div
            className="checklist-modal-large"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="checklist-modal-header">

              <div>

                <span className="activity-eyebrow">
                  STUDENT ACTIVITY
                </span>

                <h2>
                  {
                    selectedStudent.name
                  }
                </h2>

                <p>
                  {
                    selectedStudent.program ||
                    'General'
                  }

                  {selectedStudent.university
                    ? ` · ${selectedStudent.university}`
                    : ''}

                  {selectedStudent.clinic
                    ? ` · ${selectedStudent.clinic}`
                    : ''}
                </p>

              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={
                  closeChecklist
                }
              >
                ×
              </button>

            </div>


            <div className="checklist-progress-summary">

              <div>

                <span>
                  COMPLETION
                </span>

                <strong>
                  {(() => {
                    const studentActivities =
                      activity.filter(
                        (item) =>
                          item.student_id ===
                          selectedStudent.id
                      )

                    const completed =
                      studentActivities.filter(
                        (item) =>
                          item.completed
                      ).length

                    return requirements.length >
                      0
                      ? Math.round(
                          (completed /
                            requirements.length) *
                            100
                        )
                      : 0
                  })()}%
                </strong>

              </div>

              <div className="checklist-progress-track">

                <div
                  className="checklist-progress-fill"
                  style={{
                    width: `${(() => {
                      const studentActivities =
                        activity.filter(
                          (item) =>
                            item.student_id ===
                            selectedStudent.id
                        )

                      const completed =
                        studentActivities.filter(
                          (item) =>
                            item.completed
                        ).length

                      return requirements.length >
                        0
                        ? Math.round(
                            (completed /
                              requirements.length) *
                              100
                          )
                        : 0
                    })()}%`,
                  }}
                />

              </div>

            </div>


            <div className="checklist-body">

              {requirements.length === 0 ? (

                <div className="checklist-empty">

                  <strong>
                    No activities yet
                  </strong>

                  <span>
                    Use Manage Activities
                    to create the first
                    activity.
                  </span>

                </div>

              ) : (

                requirementsByWeek.map(
                  (group) => (

                    <div
                      key={
                        group.week
                      }
                      className="week-group"
                    >

                      <div className="week-group-header">

                        <div>

                          <span>
                            ACTIVITY WEEK
                          </span>

                          <h3>
                            {
                              group.label
                            }
                          </h3>

                        </div>

                        <span className="week-count">
                          {
                            group.items
                              .length
                          }{' '}
                          {group.items
                            .length ===
                          1
                            ? 'activity'
                            : 'activities'}
                        </span>

                      </div>


                      <div className="requirement-list">

                        {group.items.map(
                          (requirement) => {

                            const item =
                              getActivity(
                                selectedStudent.id,
                                requirement.id
                              )

                            const completed =
                              item?.completed ||
                              false

                            const note =
                              item?.note ||
                              ''

                            return (

                              <div
                                key={
                                  requirement.id
                                }
                                className={`requirement-row ${
                                  completed
                                    ? 'requirement-completed'
                                    : ''
                                }`}
                              >

                                <label className="requirement-check">

                                  <input
                                    type="checkbox"
                                    checked={
                                      completed
                                    }
                                    disabled={
                                      savingId ===
                                      requirement.id
                                    }
                                    onChange={() =>
                                      toggleRequirement(
                                        selectedStudent.id,
                                        requirement.id,
                                        completed
                                      )
                                    }
                                  />

                                  <span className="custom-checkmark" />

                                  <span className="requirement-content">

                                    <strong>
                                      {
                                        requirement.label
                                      }
                                    </strong>

                                    {requirement.code && (
                                      <small>
                                        {
                                          requirement.code
                                        }
                                      </small>
                                    )}

                                  </span>

                                </label>


                                <input
                                  type="text"
                                  className="requirement-note"
                                  placeholder="Add a note..."
                                  defaultValue={
                                    note
                                  }
                                  onBlur={(
                                    event
                                  ) => {
                                    if (
                                      event
                                        .target
                                        .value !==
                                      note
                                    ) {
                                      updateNote(
                                        selectedStudent.id,
                                        requirement.id,
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                  }}
                                />

                              </div>

                            )
                          }
                        )}

                      </div>

                    </div>

                  )
                )

              )}

            </div>


            <div className="checklist-modal-footer">

              <button
                type="button"
                className="activity-secondary-button"
                onClick={
                  closeChecklist
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}


      {/* ======================================================
          ACTIVITY MANAGEMENT MODAL
      ======================================================= */}

      {showActivityManagement && (

        <div
          className="activity-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !savingActivity &&
              !deletingActivityId
            ) {
              closeActivityManagement()
            }
          }}
        >

          <div
            className="activity-management-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="activity-management-header">

              <div>

                <span className="activity-eyebrow">
                  ACTIVITY MANAGEMENT
                </span>

                <h2>
                  Manage Activities
                </h2>

                <p>
                  Create and remove
                  checklist activities
                  for your students.
                </p>

              </div>

              <button
                type="button"
                className="modal-close-button"
                disabled={
                  savingActivity ||
                  Boolean(
                    deletingActivityId
                  )
                }
                onClick={
                  closeActivityManagement
                }
              >
                ×
              </button>

            </div>


            {/* ERROR */}

            {error && (
              <div className="activity-modal-error">
                {error}
              </div>
            )}


            {/* ACTIVITY LIST */}

            <div className="activity-management-body">

              <div className="activity-management-toolbar">

                <div>

                  <strong>
                    Current Activities
                  </strong>

                  <span>
                    {requirements.length}{' '}
                    {requirements.length ===
                    1
                      ? 'activity'
                      : 'activities'}
                  </span>

                </div>

                <button
                  type="button"
                  className="activity-primary-button"
                  onClick={
                    openAddActivity
                  }
                  disabled={
                    savingActivity ||
                    Boolean(
                      deletingActivityId
                    )
                  }
                >
                  <span className="button-plus">
                    +
                  </span>
                  Add Activity
                </button>

              </div>


              {requirements.length ===
              0 ? (

                <div className="activity-management-empty">

                  <div className="management-empty-icon">
                    +
                  </div>

                  <strong>
                    No activities yet
                  </strong>

                  <span>
                    Create the first
                    activity for your
                    students.
                  </span>

                  <button
                    type="button"
                    className="activity-primary-button"
                    onClick={
                      openAddActivity
                    }
                  >
                    Add Activity
                  </button>

                </div>

              ) : (

                <div className="activity-management-list">

                  {requirements.map(
                    (
                      requirement,
                      index
                    ) => (

                      <div
                        key={
                          requirement.id
                        }
                        className="activity-management-row"
                      >

                        <div className="management-number">
                          {String(
                            index + 1
                          ).padStart(
                            2,
                            '0'
                          )}
                        </div>


                        <div className="management-activity-info">

                          <div className="management-activity-title">

                            <strong>
                              {
                                requirement.label
                              }
                            </strong>

                            {requirement.code && (
                              <span>
                                {
                                  requirement.code
                                }
                              </span>
                            )}

                          </div>

                          <div className="management-activity-meta">

                            <span>
                              Week{' '}
                              {
                                requirement.week ??
                                '—'
                              }
                            </span>

                            <span className="meta-separator">
                              •
                            </span>

                            <span>
                              Activity
                            </span>

                          </div>

                        </div>


                        <button
                          type="button"
                          className="activity-delete-button"
                          disabled={
                            savingActivity ||
                            Boolean(
                              deletingActivityId
                            )
                          }
                          onClick={() =>
                            deleteActivity(
                              requirement
                            )
                          }
                        >
                          {deletingActivityId ===
                          requirement.id
                            ? 'Deleting...'
                            : 'Delete'}
                        </button>

                      </div>

                    )
                  )}

                </div>

              )}

            </div>


            {/* ADD ACTIVITY FORM */}

            {showAddActivity && (

              <div className="activity-add-panel">

                <div className="activity-add-header">

                  <div>

                    <span className="activity-eyebrow">
                      NEW ACTIVITY
                    </span>

                    <h3>
                      Add Activity
                    </h3>

                    <p>
                      Add a new item to
                      the student
                      checklist.
                    </p>

                  </div>

                  <button
                    type="button"
                    className="modal-close-button small"
                    disabled={
                      savingActivity
                    }
                    onClick={
                      closeAddActivity
                    }
                  >
                    ×
                  </button>

                </div>


                <form
                  className="activity-add-form"
                  onSubmit={
                    createActivity
                  }
                >

                  <div className="activity-form-grid">

                    <label>

                      <span>
                        Activity Name *
                      </span>

                      <input
                        type="text"
                        required
                        value={
                          activityForm.name
                        }
                        onChange={(
                          event
                        ) =>
                          setActivityForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              name:
                                event
                                  .target
                                  .value,
                            })
                          )
                        }
                        placeholder="e.g. Clinical Orientation"
                      />

                    </label>


                    <label>

                      <span>
                        Activity Week *
                      </span>

                      <select
                        value={
                          activityForm.week
                        }
                        onChange={(
                          event
                        ) =>
                          setActivityForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              week:
                                event
                                  .target
                                  .value,
                            })
                          )
                        }
                      >

                        <option value="0">
                          General
                        </option>

                        {Array.from(
                          {
                            length: 16,
                          },
                          (
                            _,
                            index
                          ) => (
                            <option
                              key={
                                index +
                                1
                              }
                              value={
                                index +
                                1
                              }
                            >
                              Week{' '}
                              {index +
                                1}
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
                        type="text"
                        value={
                          activityForm.code
                        }
                        onChange={(
                          event
                        ) =>
                          setActivityForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              code:
                                event
                                  .target
                                  .value,
                            })
                          )
                        }
                        placeholder="Optional"
                      />

                    </label>

                  </div>


                  <div className="activity-add-footer">

                    <button
                      type="button"
                      className="activity-secondary-button"
                      disabled={
                        savingActivity
                      }
                      onClick={
                        closeAddActivity
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="activity-primary-button"
                      disabled={
                        savingActivity
                      }
                    >
                      {savingActivity
                        ? 'Adding...'
                        : 'Add Activity'}
                    </button>

                  </div>

                </form>

              </div>

            )}


            {!showAddActivity && (
              <div className="activity-management-footer">

                <button
                  type="button"
                  className="activity-secondary-button"
                  disabled={
                    savingActivity ||
                    Boolean(
                      deletingActivityId
                    )
                  }
                  onClick={
                    closeActivityManagement
                  }
                >
                  Close
                </button>

              </div>
            )}

          </div>

        </div>

      )}

    </div>
  )
}

export default ActivityTracker