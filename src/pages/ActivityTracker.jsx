import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import './ActivityTracker.css'
import StudentActivityModal from './StudentActivityModal'
import SubjectActivityManager from './SubjectActivityManager'

function ActivityTracker() {
  // ============================================================
  // DATA
  // ============================================================

  const [allStudents, setAllStudents] = useState([])
  const [students, setStudents] = useState([])
  const [requirements, setRequirements] = useState([])
  const [allRequirements, setAllRequirements] = useState([])
  const [studentActivity, setStudentActivity] = useState([])
  const [studentSubjects, setStudentSubjects] = useState([])
  const [subjects, setSubjects] = useState([])
  const [currentSemester, setCurrentSemester] = useState(null)
  const [endedSemesters, setEndedSemesters] = useState([])
  const [allSemesterStudents, setAllSemesterStudents] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ============================================================
  // MODALS
  // ============================================================

  const [archiveView, setArchiveView] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showSubjectManager, setShowSubjectManager] = useState(false)

  // Legacy/manual activity assignment remains available for now.
  const [showAssignActivity, setShowAssignActivity] = useState(false)
  const [assignSchool, setAssignSchool] = useState('AUHS')
  const [assignStudentSearch, setAssignStudentSearch] = useState('')
  const [assignStudentId, setAssignStudentId] = useState('')
  const [assignSelectedActivityIds, setAssignSelectedActivityIds] = useState([])
  const [assignSaving, setAssignSaving] = useState(false)

  // Semester workflow
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [showNewSemester, setShowNewSemester] = useState(false)
  const [savingSemester, setSavingSemester] = useState(false)

  const [semesterForm, setSemesterForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    notes: '',
  })

  const [studentSearch, setStudentSearch] = useState('')
  const [activitySearch, setActivitySearch] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [selectedActivityIds, setSelectedActivityIds] = useState([])

  // ============================================================
  // FILTERS / PAGINATION
  // ============================================================

  const [search, setSearch] = useState('')
  const [clinicFilter, setClinicFilter] = useState('all')
  const [schoolFilter, setSchoolFilter] = useState('all')

  const STUDENTS_PER_PAGE = 10
  const [currentPage, setCurrentPage] = useState(1)

  // ============================================================
  // LOAD
  // ============================================================

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [
        studentsResponse,
        requirementsResponse,
        activityResponse,
        semesterResponse,
        semesterStudentsResponse,
        studentSubjectsResponse,
        subjectsResponse,
      ] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .order('name', { ascending: true }),

        supabase
          .from('activity_requirements')
          .select('*')
          .order('week', {
            ascending: true,
            nullsFirst: false,
          })
          .order('sort_order', {
            ascending: true,
            nullsFirst: false,
          }),

        supabase
          .from('student_activity')
          .select('*'),

        supabase
          .from('semesters')
          .select('*')
          .order('created_at', { ascending: false }),

        supabase
          .from('semester_students')
          .select('semester_id, student_id'),

        supabase
          .from('student_subjects')
          .select('student_id, subject_id, active'),

        supabase
          .from('subjects')
          .select('id, name, university, active')
          .order('name', { ascending: true }),
      ])

      if (studentsResponse.error) throw studentsResponse.error
      if (requirementsResponse.error) throw requirementsResponse.error
      if (activityResponse.error) throw activityResponse.error
      if (semesterResponse.error) throw semesterResponse.error
      if (semesterStudentsResponse.error) throw semesterStudentsResponse.error

      // During rollout, give a clearer message when the migration has not been run.
      if (studentSubjectsResponse.error) {
        throw new Error(
          `Subject system is not ready: ${studentSubjectsResponse.error.message}. Run subject_activity_migration.sql in Supabase first.`
        )
      }

      if (subjectsResponse.error) {
        throw new Error(
          `Subjects could not be loaded: ${subjectsResponse.error.message}`
        )
      }

      const allStudentsData = studentsResponse.data || []
      const allRequirementsData = requirementsResponse.data || []
      const activityData = activityResponse.data || []
      const allSemestersData = semesterResponse.data || []
      const semesterStudentsData = semesterStudentsResponse.data || []
      const studentSubjectData = studentSubjectsResponse.data || []

      const activeSemester =
        allSemestersData.find((semester) => semester.status === 'active') ||
        null

      setAllStudents(allStudentsData)
      setAllRequirements(allRequirementsData)
      setStudentActivity(activityData)
      setStudentSubjects(studentSubjectData)
      setSubjects(subjectsResponse.data || [])
      setCurrentSemester(activeSemester)
      setEndedSemesters(
        allSemestersData.filter(
          (semester) => semester.status !== 'active'
        )
      )
      setAllSemesterStudents(semesterStudentsData)

      if (activeSemester) {
        const assignedIds = new Set(
          semesterStudentsData
            .filter(
              (row) => row.semester_id === activeSemester.id
            )
            .map((row) => row.student_id)
        )

        // Keep existing behavior: students with current semester activity
        // records are visible even if semester_students was not populated.
        const currentRequirementIds = new Set(
          allRequirementsData
            .filter(
              (requirement) =>
                requirement.semester_id === activeSemester.id ||
                requirement.semester_id == null
            )
            .map((requirement) => requirement.id)
        )

        activityData
          .filter((item) =>
            currentRequirementIds.has(item.requirement_id)
          )
          .forEach((item) => assignedIds.add(item.student_id))

        setStudents(
          allStudentsData.filter((student) =>
            assignedIds.has(student.id)
          )
        )

        setRequirements(
          allRequirementsData.filter(
            (requirement) =>
              requirement.semester_id === activeSemester.id ||
              requirement.semester_id == null
          )
        )
      } else {
        setStudents(allStudentsData)
        setRequirements(
          allRequirementsData.filter(
            (requirement) =>
              requirement.semester_id == null
          )
        )
      }
    } catch (err) {
      console.error('Student Progress loading error:', err)

      setError(
        err.message ||
          'Unable to load Student Progress.'
      )
    } finally {
      setLoading(false)
    }
  }

  // ============================================================
  // LOOKUPS
  // ============================================================

  const schools = useMemo(() => {
    const values = new Set(['AUHS', 'PACIFIC'])

    allStudents.forEach((student) => {
      if (student.university) {
        values.add(student.university)
      }
    })

    return Array.from(values).sort()
  }, [allStudents])

  const clinics = useMemo(() => {
    const values = new Set()

    students.forEach((student) => {
      if (student.clinic) {
        values.add(student.clinic)
      }
    })

    return Array.from(values).sort()
  }, [students])

  const subjectIdsByStudent = useMemo(() => {
    const map = new Map()

    studentSubjects
      .filter((assignment) => assignment.active !== false)
      .forEach((assignment) => {
        if (!map.has(assignment.student_id)) {
          map.set(assignment.student_id, new Set())
        }

        map
          .get(assignment.student_id)
          .add(assignment.subject_id)
      })

    return map
  }, [studentSubjects])

  const subjectNamesByStudent = useMemo(() => {
    const subjectNameById = new Map(
      subjects.map((subject) => [
        String(subject.id),
        subject.name,
      ])
    )

    const map = new Map()

    studentSubjects
      .filter((assignment) => assignment.active !== false)
      .forEach((assignment) => {
        const name = subjectNameById.get(
          String(assignment.subject_id)
        )

        if (!name) return

        if (!map.has(assignment.student_id)) {
          map.set(assignment.student_id, [])
        }

        map.get(assignment.student_id).push(name)
      })

    return map
  }, [studentSubjects, subjects])

  /**
   * Subject-aware requirement visibility.
   *
   * - student-specific requirement -> exact student only
   * - subject_id present -> student must be assigned that subject
   * - legacy subject_id NULL -> keep old school-based behavior
   * - university scope always remains enforced
   */
  function requirementsForStudent(
    student,
    reqList = requirements
  ) {
    if (!student) return []

    const school = student.university || null
    const assignedSubjects =
      subjectIdsByStudent.get(student.id) || new Set()

    return reqList.filter((requirement) => {
      if (
        requirement.student_id &&
        requirement.student_id !== student.id
      ) {
        return false
      }

      if (requirement.student_id === student.id) {
        return true
      }

      if (
        requirement.subject_id != null &&
        !assignedSubjects.has(requirement.subject_id)
      ) {
        return false
      }

      if (requirement.university === 'SHARED') {
        return true
      }

      return (
        Boolean(school) &&
        requirement.university === school
      )
    })
  }

  // ============================================================
  // PROGRESS / CURRENT ACTIVITY
  // ============================================================

  const progressMap = useMemo(() => {
    const map = {}

    students.forEach((student) => {
      const studentRequirements =
        requirementsForStudent(student)

      const requirementIds = new Set(
        studentRequirements.map(
          (requirement) => requirement.id
        )
      )

      const completed = studentActivity.filter(
        (item) =>
          item.student_id === student.id &&
          item.completed === true &&
          requirementIds.has(item.requirement_id)
      ).length

      const total = studentRequirements.length

      map[student.id] = {
        completed,
        total,
        percentage:
          total > 0
            ? Math.round((completed / total) * 100)
            : 0,
      }
    })

    return map
  }, [
    students,
    requirements,
    studentActivity,
    subjectIdsByStudent,
  ])

  const currentActivityMap = useMemo(() => {
    const map = {}

    students.forEach((student) => {
      const allowed =
        requirementsForStudent(student)

      const activityByRequirement = new Map(
        studentActivity
          .filter(
            (item) => item.student_id === student.id
          )
          .map((item) => [
            item.requirement_id,
            item,
          ])
      )

      const currentRequirement = allowed.find(
        (requirement) => {
          const item =
            activityByRequirement.get(requirement.id)

          return item?.completed !== true
        }
      )

      if (currentRequirement) {
        map[student.id] =
          currentRequirement.label ||
          currentRequirement.name ||
          'Activity'
      } else if (allowed.length > 0) {
        map[student.id] = 'All complete'
      } else {
        map[student.id] = 'No activity'
      }
    })

    return map
  }, [
    students,
    requirements,
    studentActivity,
    subjectIdsByStudent,
  ])

  // ============================================================
  // FILTERED STUDENTS / PAGINATION
  // ============================================================

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()

    return students.filter((student) => {
      if (
        clinicFilter !== 'all' &&
        student.clinic !== clinicFilter
      ) {
        return false
      }

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
        student.program,
        student.university,
        student.subject,
        student.clinic,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [
    students,
    search,
    clinicFilter,
    schoolFilter,
  ])

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredStudents.length / STUDENTS_PER_PAGE
    )
  )

  const paginatedStudents = useMemo(() => {
    const start =
      (currentPage - 1) * STUDENTS_PER_PAGE

    return filteredStudents.slice(
      start,
      start + STUDENTS_PER_PAGE
    )
  }, [filteredStudents, currentPage])

  const pageStart = filteredStudents.length
    ? (currentPage - 1) * STUDENTS_PER_PAGE + 1
    : 0

  const pageEnd = Math.min(
    currentPage * STUDENTS_PER_PAGE,
    filteredStudents.length
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [search, clinicFilter, schoolFilter])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  // ============================================================
  // SUMMARY
  // ============================================================

  const totalStudents = students.length

  const totalActivities = useMemo(() => {
    const ids = new Set()

    students.forEach((student) => {
      requirementsForStudent(student).forEach(
        (requirement) => ids.add(requirement.id)
      )
    })

    return ids.size
  }, [
    students,
    requirements,
    subjectIdsByStudent,
  ])

  const completedItems = useMemo(() => {
    let count = 0

    students.forEach((student) => {
      const allowedIds = new Set(
        requirementsForStudent(student).map(
          (requirement) => requirement.id
        )
      )

      count += studentActivity.filter(
        (item) =>
          item.student_id === student.id &&
          item.completed === true &&
          allowedIds.has(item.requirement_id)
      ).length
    })

    return count
  }, [
    students,
    requirements,
    studentActivity,
    subjectIdsByStudent,
  ])

  const possibleItems = useMemo(
    () =>
      students.reduce(
        (sum, student) =>
          sum +
          requirementsForStudent(student).length,
        0
      ),
    [
      students,
      requirements,
      subjectIdsByStudent,
    ]
  )

  const overallProgress =
    possibleItems > 0
      ? Math.round(
          (completedItems / possibleItems) * 100
        )
      : 0

  // ============================================================
  // STUDENT CHECKLIST
  // ============================================================

  function openChecklist(student) {
    setSelectedStudent(student)
  }

  function closeChecklist() {
    setSelectedStudent(null)
    loadData()
  }

  // ============================================================
  // SUBJECT MANAGER
  // ============================================================

  function openSubjectManager() {
    setError('')
    setShowSubjectManager(true)
  }

  async function handleSubjectManagerChanged() {
    await loadData()
  }

  // ============================================================
  // LEGACY / MANUAL ASSIGN ACTIVITY
  // ============================================================

  const assignStudentOptions = useMemo(() => {
    const query =
      assignStudentSearch.trim().toLowerCase()

    return allStudents
      .filter(
        (student) =>
          student.university === assignSchool
      )
      .filter((student) => {
        if (!query) return true

        return [
          student.name,
          student.email,
          student.program,
          student.subject,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      })
  }, [
    allStudents,
    assignSchool,
    assignStudentSearch,
  ])

  const assignableActivities = useMemo(() => {
    if (!assignStudentId) return []

    const student = allStudents.find(
      (item) => item.id === assignStudentId
    )

    if (!student) return []

    return requirementsForStudent(
      student,
      requirements
    ).filter(
      (requirement) =>
        requirement.student_id == null
    )
  }, [
    assignStudentId,
    allStudents,
    requirements,
    subjectIdsByStudent,
  ])

  function openAssignActivity() {
    setError('')
    setAssignSchool(
      schoolFilter !== 'all'
        ? schoolFilter
        : 'AUHS'
    )
    setAssignStudentSearch('')
    setAssignStudentId('')
    setAssignSelectedActivityIds([])
    setShowAssignActivity(true)
  }

  function closeAssignActivity() {
    if (assignSaving) return
    setShowAssignActivity(false)
  }

  function selectAssignStudent(studentId) {
    setAssignStudentId(studentId)

    const student = allStudents.find(
      (item) => item.id === studentId
    )

    if (!student) {
      setAssignSelectedActivityIds([])
      return
    }

    const allowedIds = new Set(
      requirementsForStudent(
        student,
        requirements
      ).map((requirement) => requirement.id)
    )

    const existing = studentActivity
      .filter(
        (item) =>
          item.student_id === studentId &&
          allowedIds.has(item.requirement_id)
      )
      .map((item) => item.requirement_id)

    setAssignSelectedActivityIds(existing)
  }

  function toggleAssignActivityId(id) {
    setAssignSelectedActivityIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  const allAssignActivitiesSelected =
    assignableActivities.length > 0 &&
    assignableActivities.every((activity) =>
      assignSelectedActivityIds.includes(
        activity.id
      )
    )

  function toggleSelectAllAssignActivities() {
    if (!assignStudentId || assignSaving) return

    const visibleIds = assignableActivities.map(
      (activity) => activity.id
    )

    setAssignSelectedActivityIds((current) => {
      if (allAssignActivitiesSelected) {
        return current.filter(
          (id) => !visibleIds.includes(id)
        )
      }

      return Array.from(
        new Set([...current, ...visibleIds])
      )
    })
  }

  async function submitAssignActivity(event) {
    event.preventDefault()

    if (!assignStudentId) {
      setError('Please select a student.')
      return
    }

    setAssignSaving(true)
    setError('')

    try {
      const visibleIds = new Set(
        assignableActivities.map(
          (activity) => activity.id
        )
      )

      const existingRows = studentActivity.filter(
        (item) =>
          item.student_id === assignStudentId &&
          visibleIds.has(item.requirement_id)
      )

      const existingIds = new Set(
        existingRows.map(
          (item) => item.requirement_id
        )
      )

      const selectedIds = new Set(
        assignSelectedActivityIds
      )

      const toInsert =
        assignSelectedActivityIds
          .filter((id) => !existingIds.has(id))
          .map((requirementId) => ({
            student_id: assignStudentId,
            requirement_id: requirementId,
            completed: false,
          }))

      const toRemove = [...existingIds].filter(
        (id) => !selectedIds.has(id)
      )

      if (toInsert.length) {
        const { error: insertError } =
          await supabase
            .from('student_activity')
            .insert(toInsert)

        if (insertError) throw insertError
      }

      if (toRemove.length) {
        const { error: deleteError } =
          await supabase
            .from('student_activity')
            .delete()
            .eq('student_id', assignStudentId)
            .in('requirement_id', toRemove)

        if (deleteError) throw deleteError
      }

      if (currentSemester?.id) {
        const alreadyAssigned =
          allSemesterStudents.some(
            (row) =>
              row.semester_id ===
                currentSemester.id &&
              row.student_id ===
                assignStudentId
          )

        if (
          assignSelectedActivityIds.length > 0 &&
          !alreadyAssigned
        ) {
          const { error: semesterAssignError } =
            await supabase
              .from('semester_students')
              .insert({
                semester_id: currentSemester.id,
                student_id: assignStudentId,
              })

          if (
            semesterAssignError &&
            !String(
              semesterAssignError.message || ''
            ).toLowerCase().includes('duplicate')
          ) {
            throw semesterAssignError
          }
        }
      }

      await loadData()
    } catch (err) {
      console.error('Assign activity error:', err)

      setError(
        err.message ||
          'Unable to update student activities.'
      )
    } finally {
      setAssignSaving(false)
    }
  }

  // ============================================================
  // ARCHIVE
  // ============================================================

  function formatDate(value) {
    if (!value) return '—'

    try {
      return new Date(
        `${value}T00:00:00`
      ).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return value
    }
  }

  const archiveRows = useMemo(() => {
    return endedSemesters.map((semester) => {
      const studentIds = allSemesterStudents
        .filter(
          (row) =>
            row.semester_id === semester.id
        )
        .map((row) => row.student_id)

      const semesterRequirements =
        allRequirements.filter(
          (requirement) =>
            requirement.semester_id ===
            semester.id
        )

      const requirementIds = new Set(
        semesterRequirements.map(
          (requirement) => requirement.id
        )
      )

      const studentIdSet = new Set(studentIds)

      const completed =
        studentActivity.filter(
          (item) =>
            item.completed === true &&
            requirementIds.has(
              item.requirement_id
            ) &&
            studentIdSet.has(item.student_id)
        ).length

      const possible =
        studentIds.length *
        semesterRequirements.length

      return {
        semester,
        studentCount: studentIds.length,
        activityCount:
          semesterRequirements.length,
        percentage:
          possible > 0
            ? Math.round(
                (completed / possible) * 100
              )
            : 0,
      }
    })
  }, [
    endedSemesters,
    allSemesterStudents,
    allRequirements,
    studentActivity,
  ])

  function openArchiveView(semester) {
    const studentIds = allSemesterStudents
      .filter(
        (row) =>
          row.semester_id === semester.id
      )
      .map((row) => row.student_id)

    const studentIdSet = new Set(studentIds)

    const semesterStudents =
      allStudents.filter((student) =>
        studentIdSet.has(student.id)
      )

    const semesterRequirements =
      allRequirements
        .filter(
          (requirement) =>
            requirement.semester_id ===
            semester.id
        )
        .sort(
          (a, b) =>
            (a.week ?? 0) -
              (b.week ?? 0) ||
            (a.sort_order ?? 0) -
              (b.sort_order ?? 0)
        )

    const requirementIds = new Set(
      semesterRequirements.map(
        (requirement) => requirement.id
      )
    )

    const progress = {}

    semesterStudents.forEach((student) => {
      const completed =
        studentActivity.filter(
          (item) =>
            item.student_id === student.id &&
            item.completed === true &&
            requirementIds.has(
              item.requirement_id
            )
        ).length

      progress[student.id] = {
        completed,
        total: semesterRequirements.length,
        percentage:
          semesterRequirements.length > 0
            ? Math.round(
                (completed /
                  semesterRequirements.length) *
                  100
              )
            : 0,
      }
    })

    setArchiveView({
      semester,
      students: semesterStudents,
      requirements: semesterRequirements,
      progress,
    })
  }

  // ============================================================
  // SEMESTER WORKFLOW
  // ============================================================

  function resetSemesterForm() {
    setSemesterForm({
      name: '',
      startDate: '',
      endDate: '',
      notes: '',
    })
    setStudentSearch('')
    setActivitySearch('')
    setSelectedStudentIds([])
    setSelectedActivityIds([])
  }

  function handleEndSemester() {
    setError('')
    setShowEndConfirm(true)
  }

  function continueToNewSemester() {
    setShowEndConfirm(false)
    resetSemesterForm()

    setSelectedStudentIds(
      students.map((student) => student.id)
    )

    setSelectedActivityIds(
      requirements
        .filter(
          (requirement) =>
            requirement.student_id == null
        )
        .map((requirement) => requirement.id)
    )

    setSemesterForm((current) => ({
      ...current,
      startDate:
        new Date().toISOString().slice(0, 10),
    }))

    setShowNewSemester(true)
  }

  const searchableStudents = useMemo(() => {
    const query =
      studentSearch.trim().toLowerCase()

    if (!query) return allStudents

    return allStudents.filter((student) =>
      [
        student.name,
        student.email,
        student.program,
        student.university,
        student.subject,
        student.clinic,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [allStudents, studentSearch])

  const searchableActivities = useMemo(() => {
    const pool =
      requirements.length > 0
        ? requirements.filter(
            (requirement) =>
              requirement.student_id == null
          )
        : allRequirements.filter(
            (requirement) =>
              requirement.student_id == null
          )

    const query =
      activitySearch.trim().toLowerCase()

    if (!query) return pool

    return pool.filter((activity) =>
      [
        activity.label,
        activity.code,
        activity.description,
        activity.week != null
          ? `week ${activity.week}`
          : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [
    requirements,
    allRequirements,
    activitySearch,
  ])

  function toggleSelectedStudent(studentId) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter(
            (id) => id !== studentId
          )
        : [...current, studentId]
    )
  }

  function toggleSelectedActivity(activityId) {
    setSelectedActivityIds((current) =>
      current.includes(activityId)
        ? current.filter(
            (id) => id !== activityId
          )
        : [...current, activityId]
    )
  }

  async function startNewSemester(event) {
    event.preventDefault()

    const name = semesterForm.name.trim()

    if (!name) {
      setError('Please enter a semester name.')
      return
    }

    if (!semesterForm.startDate) {
      setError('Please enter a start date.')
      return
    }

    if (!selectedStudentIds.length) {
      setError(
        'Please assign at least one student to the new semester.'
      )
      return
    }

    setSavingSemester(true)
    setError('')

    try {
      if (currentSemester) {
        const { error: endError } =
          await supabase
            .from('semesters')
            .update({
              status: 'ended',
              end_date:
                currentSemester.end_date ||
                new Date()
                  .toISOString()
                  .slice(0, 10),
            })
            .eq('id', currentSemester.id)

        if (endError) throw endError
      }

      const {
        data: newSemester,
        error: createError,
      } = await supabase
        .from('semesters')
        .insert({
          name,
          status: 'active',
          start_date:
            semesterForm.startDate,
          end_date:
            semesterForm.endDate || null,
        })
        .select()
        .single()

      if (createError) throw createError

      const { error: studentAssignError } =
        await supabase
          .from('semester_students')
          .insert(
            selectedStudentIds.map(
              (studentId) => ({
                semester_id: newSemester.id,
                student_id: studentId,
              })
            )
          )

      if (studentAssignError) {
        throw studentAssignError
      }

      // Preserve subject_id while copying activities.
      if (selectedActivityIds.length) {
        const templates =
          allRequirements.filter(
            (requirement) =>
              selectedActivityIds.includes(
                requirement.id
              )
          )

        const rows = templates.map(
          (template, index) => ({
            code:
              template.code ||
              `ACT-${Date.now()}-${index}`,
            label: template.label,
            week: template.week ?? 1,
            sort_order:
              template.sort_order ?? index,
            description:
              template.description || null,
            university:
              template.university || null,
            subject_id:
              template.subject_id || null,
            semester_id: newSemester.id,
            student_id: null,
          })
        )

        const { error: copyError } =
          await supabase
            .from('activity_requirements')
            .insert(rows)

        if (copyError) throw copyError
      }

      setShowNewSemester(false)
      resetSemesterForm()
      await loadData()
    } catch (err) {
      console.error(
        'Start new semester error:',
        err
      )

      setError(
        err.message ||
          'Unable to start the new semester.'
      )
    } finally {
      setSavingSemester(false)
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="activity-page">
      <section className="activity-page-header">
        <div className="activity-page-header-copy">
          <span className="activity-eyebrow">
            ACTIVITY MANAGEMENT
          </span>

          <h1>Student Progress</h1>

          <p>
            Monitor student activity and manage the
            current semester.
            {currentSemester?.name
              ? ` Active: ${currentSemester.name}`
              : ''}
          </p>
        </div>

        <div className="activity-page-actions">
          <button
            type="button"
            className="activity-primary-button"
            onClick={openSubjectManager}
          >
            Manage Subject
          </button>

          <button
            type="button"
            className="activity-primary-button"
            onClick={openAssignActivity}
          >
            Assign Activity
          </button>

          <button
            type="button"
            className="activity-danger-button"
            onClick={handleEndSemester}
          >
            End Semester
          </button>
        </div>
      </section>

      {error && (
        <div className="activity-error">
          <div>
            <strong>Something went wrong</strong>
            <span>{error}</span>
          </div>

          <button
            type="button"
            onClick={() => setError('')}
          >
            ×
          </button>
        </div>
      )}

      <section className="activity-summary-grid">
        <div className="activity-summary-card">
          <span>STUDENTS</span>
          <strong>{totalStudents}</strong>
          <small>
            Students currently being monitored
          </small>
        </div>

        <div className="activity-summary-card">
          <span>ACTIVITIES</span>
          <strong>{totalActivities}</strong>
          <small>
            Subject-aware checklist requirements
          </small>
        </div>

        <div className="activity-summary-card">
          <span>COMPLETED</span>
          <strong>{completedItems}</strong>
          <small>Completed activities</small>
        </div>

        <div className="activity-summary-card">
          <span>OVERALL PROGRESS</span>
          <strong>{overallProgress}%</strong>
          <small>Across assigned subjects</small>
        </div>
      </section>

      <section className="activity-filter-card">
        <div className="activity-filter-search">
          <span className="search-icon">⌕</span>

          <input
            type="text"
            value={search}
            placeholder="Search student..."
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          {search && (
            <button
              type="button"
              className="clear-search"
              onClick={() => setSearch('')}
            >
              ×
            </button>
          )}
        </div>

        <select
          className="activity-filter-select"
          value={schoolFilter}
          onChange={(event) =>
            setSchoolFilter(event.target.value)
          }
        >
          <option value="all">All Schools</option>

          {schools.map((school) => (
            <option
              key={school}
              value={school}
            >
              {school}
            </option>
          ))}
        </select>

        {clinics.length > 0 && (
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
        )}

        <div className="activity-filter-count">
          Showing{' '}
          <strong>
            {filteredStudents.length}
          </strong>{' '}
          of <strong>{students.length}</strong>
        </div>
      </section>

      {loading ? (
        <div className="activity-state-card">
          <div className="activity-spinner" />
          <strong>
            Loading Student Progress
          </strong>
          <span>
            Please wait while student activity
            is loaded.
          </span>
        </div>
      ) : (
        <div className="activity-split-layout">
          <section className="activity-split-panel">
            <div className="activity-split-header">
              <div>
                <span className="activity-eyebrow">
                  CURRENT SEMESTER
                </span>

                <h3>
                  {currentSemester?.name ||
                    'Student Progress'}
                </h3>
              </div>

              <span className="activity-split-count">
                {filteredStudents.length}{' '}
                {filteredStudents.length === 1
                  ? 'student'
                  : 'students'}
              </span>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="activity-state-card activity-state-card-compact">
                <div className="activity-state-icon">
                  ?
                </div>
                <strong>No students found</strong>
                <span>
                  No students match the current
                  filters.
                </span>
              </div>
            ) : (
              <div className="activity-table-card">
                <div className="activity-table-scroll">
                  <table className="activity-table activity-table-compact">
                    <thead>
                      <tr>
                        <th>STUDENT</th>
                        <th>SCHOOL/PROGRAM</th>
                        <th>SUBJECT</th>
                        <th>CURRENT ACTIVITY</th>
                        <th>PROGRESS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedStudents.map(
                        (student) => {
                          const progress =
                            progressMap[
                              student.id
                            ] || {
                              completed: 0,
                              total: 0,
                              percentage: 0,
                            }

                          return (
                            <tr key={student.id}>
                              <td>
                                <button
                                  type="button"
                                  className="student-person"
                                  onClick={() =>
                                    openChecklist(
                                      student
                                    )
                                  }
                                  title={`View activity for ${student.name}`}
                                  style={{
                                    width: '100%',
                                    padding: 0,
                                    border: 0,
                                    background:
                                      'transparent',
                                    font: 'inherit',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <div className="student-avatar">
                                    {student.name
                                      ?.charAt(0)
                                      ?.toUpperCase() ||
                                      '?'}
                                  </div>

                                  <div className="student-person-info">
                                    <strong>
                                      {student.name}
                                    </strong>

                                    {student.email && (
                                      <span>
                                        {
                                          student.email
                                        }
                                      </span>
                                    )}
                                  </div>
                                </button>
                              </td>

                              <td>
                                <span
                                  className="dash-cell-text dash-school-program"
                                  style={{
                                    display: 'flex',
                                    flexDirection:
                                      'column',
                                    lineHeight: 1.3,
                                  }}
                                >
                                  <span className="dash-school">
                                    {student.university ||
                                      '—'}
                                  </span>

                                  <span
                                    className="dash-program"
                                    style={{
                                      fontSize:
                                        '0.85em',
                                      opacity: 0.7,
                                    }}
                                  >
                                    {student.program ||
                                      '—'}
                                  </span>
                                </span>
                              </td>

                              <td>
                                <span
                                  className="activity-current-label"
                                  title={
                                    subjectNamesByStudent
                                      .get(student.id)
                                      ?.join(', ') ||
                                    student.subject ||
                                    '—'
                                  }
                                >
                                  {subjectNamesByStudent
                                    .get(student.id)
                                    ?.join(', ') ||
                                    student.subject ||
                                    '—'}
                                </span>
                              </td>

                              <td>
                                <span
                                  className={
                                    currentActivityMap[
                                      student.id
                                    ] ===
                                    'All complete'
                                      ? 'activity-current-label is-complete'
                                      : currentActivityMap[
                                            student.id
                                          ] ===
                                          'No activity'
                                        ? 'activity-current-label is-empty'
                                        : 'activity-current-label'
                                  }
                                >
                                  {
                                    currentActivityMap[
                                      student.id
                                    ]
                                  }
                                </span>
                              </td>

                              <td>
                                <div className="progress-cell">
                                  <div className="progress-track">
                                    <div
                                      className="progress-fill"
                                      style={{
                                        width: `${progress.percentage}%`,
                                      }}
                                    />
                                  </div>

                                  <strong>
                                    {
                                      progress.percentage
                                    }
                                    %
                                  </strong>

                                  <span>
                                    {progress.completed}/
                                    {progress.total}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )
                        }
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="activity-pagination">
                  <div className="activity-pagination-info">
                    Showing{' '}
                    <strong>
                      {pageStart}–{pageEnd}
                    </strong>{' '}
                    of{' '}
                    <strong>
                      {filteredStudents.length}
                    </strong>{' '}
                    students
                  </div>

                  <div className="activity-pagination-controls">
                    <button
                      type="button"
                      className="activity-pagination-button"
                      onClick={() =>
                        setCurrentPage((page) =>
                          Math.max(
                            1,
                            page - 1
                          )
                        )
                      }
                      disabled={
                        currentPage === 1
                      }
                    >
                      ← Previous
                    </button>

                    <span className="activity-pagination-page">
                      Page{' '}
                      <strong>
                        {currentPage}
                      </strong>{' '}
                      of{' '}
                      <strong>
                        {totalPages}
                      </strong>
                    </span>

                    <button
                      type="button"
                      className="activity-pagination-button"
                      onClick={() =>
                        setCurrentPage((page) =>
                          Math.min(
                            totalPages,
                            page + 1
                          )
                        )
                      }
                      disabled={
                        currentPage ===
                        totalPages
                      }
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="activity-split-panel activity-archive-panel">
            <div className="activity-split-header">
              <div>
                <span className="activity-eyebrow">
                  HISTORY
                </span>
                <h3>Semester Archive</h3>
              </div>

              <span className="activity-split-count">
                {archiveRows.length}{' '}
                {archiveRows.length === 1
                  ? 'semester'
                  : 'semesters'}
              </span>
            </div>

            {archiveRows.length === 0 ? (
              <div className="activity-state-card activity-state-card-compact">
                <div className="activity-state-icon">
                  ☰
                </div>
                <strong>
                  No archived semesters
                </strong>
                <span>
                  Ended semesters will appear
                  here.
                </span>
              </div>
            ) : (
              <div className="activity-table-card">
                <div className="activity-table-scroll">
                  <table className="activity-table activity-table-compact activity-archive-table">
                    <thead>
                      <tr>
                        <th>SEMESTER</th>
                        <th>DATES</th>
                        <th>STUDENTS</th>
                        <th>PROGRESS</th>
                        <th>VIEW</th>
                      </tr>
                    </thead>

                    <tbody>
                      {archiveRows.map(
                        ({
                          semester,
                          studentCount,
                          activityCount,
                          percentage,
                        }) => (
                          <tr
                            key={semester.id}
                          >
                            <td>
                              <div className="archive-semester-cell">
                                <strong>
                                  {semester.name}
                                </strong>
                                <span className="archive-status-badge">
                                  {semester.status ||
                                    'ended'}
                                </span>
                              </div>
                            </td>

                            <td>
                              <div className="archive-dates">
                                <span>
                                  {formatDate(
                                    semester.start_date
                                  )}
                                </span>
                                <span>
                                  →{' '}
                                  {formatDate(
                                    semester.end_date
                                  )}
                                </span>
                              </div>
                            </td>

                            <td>
                              <span className="archive-meta">
                                {studentCount}
                                <small>
                                  {' '}
                                  / {activityCount}{' '}
                                  act.
                                </small>
                              </span>
                            </td>

                            <td>
                              <div className="progress-cell progress-cell-compact">
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
                              </div>
                            </td>

                            <td>
                              <button
                                type="button"
                                className="view-checklist-button"
                                onClick={() =>
                                  openArchiveView(
                                    semester
                                  )
                                }
                              >
                                View{' '}
                                <span>→</span>
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ======================================================
          SUBJECT ACTIVITY MANAGER — NEW MODAL
      ======================================================= */}

      {showSubjectManager && (
        <SubjectActivityManager
          onClose={() =>
            setShowSubjectManager(false)
          }
          onChanged={
            handleSubjectManagerChanged
          }
        />
      )}

      {/* ======================================================
          STUDENT CHECKLIST
      ======================================================= */}

      {selectedStudent && (
        <StudentActivityModal
          student={selectedStudent}
          onClose={closeChecklist}
        />
      )}

      {/* ======================================================
          ARCHIVE DETAIL
      ======================================================= */}

      {archiveView && (
        <div
          className="activity-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setArchiveView(null)
            }
          }}
        >
          <div
            className="archive-detail-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="activity-eyebrow">
                  SEMESTER ARCHIVE
                </span>
                <h2>
                  {archiveView.semester.name}
                </h2>
                <p>
                  {formatDate(
                    archiveView.semester
                      .start_date
                  )}{' '}
                  →{' '}
                  {formatDate(
                    archiveView.semester.end_date
                  )}{' '}
                  · {archiveView.students.length}{' '}
                  students ·{' '}
                  {
                    archiveView.requirements
                      .length
                  }{' '}
                  activities
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setArchiveView(null)
                }
              >
                ×
              </button>
            </div>

            <div className="archive-detail-body">
              {archiveView.students.length ===
              0 ? (
                <p className="semester-empty-hint">
                  No students were assigned
                  to this semester.
                </p>
              ) : (
                <div className="activity-table-scroll">
                  <table className="activity-table activity-table-compact">
                    <thead>
                      <tr>
                        <th>STUDENT</th>
                        <th>PROGRAM</th>
                        <th>PROGRESS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {archiveView.students.map(
                        (student) => {
                          const progress =
                            archiveView.progress[
                              student.id
                            ] || {
                              completed: 0,
                              total: 0,
                              percentage: 0,
                            }

                          return (
                            <tr key={student.id}>
                              <td>
                                <strong>
                                  {student.name}
                                </strong>
                              </td>

                              <td>
                                {student.program ||
                                  '—'}
                              </td>

                              <td>
                                <div className="progress-cell">
                                  <div className="progress-track">
                                    <div
                                      className="progress-fill"
                                      style={{
                                        width: `${progress.percentage}%`,
                                      }}
                                    />
                                  </div>

                                  <strong>
                                    {
                                      progress.percentage
                                    }
                                    %
                                  </strong>

                                  <span>
                                    {
                                      progress.completed
                                    }
                                    /{progress.total}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="activity-secondary-button"
                onClick={() =>
                  setArchiveView(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          MANUAL ASSIGN ACTIVITY
          Keep during migration for individual exceptions.
      ======================================================= */}

      {showAssignActivity && (
        <div
          className="activity-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAssignActivity()
            }
          }}
        >
          <div
            className="assign-activity-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="activity-eyebrow">
                  STUDENT ACTIVITIES
                </span>
                <h2>Assign Activity</h2>
                <p>
                  For normal setup, assign a
                  subject in Manage Activity.
                  Use this screen only for
                  individual activity exceptions.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                disabled={assignSaving}
                onClick={closeAssignActivity}
              >
                ×
              </button>
            </div>

            <form
              className="assign-activity-body"
              onSubmit={submitAssignActivity}
            >
              <div className="assign-toolbar">
                <label className="assign-field">
                  <span>School</span>

                  <select
                    value={assignSchool}
                    disabled={assignSaving}
                    onChange={(event) => {
                      setAssignSchool(
                        event.target.value
                      )
                      setAssignStudentId('')
                      setAssignSelectedActivityIds(
                        []
                      )
                      setAssignStudentSearch('')
                    }}
                  >
                    {schools.map((school) => (
                      <option
                        key={school}
                        value={school}
                      >
                        {school}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="assign-field assign-field-grow">
                  <span>Search student</span>
                  <input
                    type="search"
                    value={
                      assignStudentSearch
                    }
                    onChange={(event) =>
                      setAssignStudentSearch(
                        event.target.value
                      )
                    }
                    placeholder="Name, email, subject, or program..."
                    disabled={assignSaving}
                  />
                </label>
              </div>

              <div className="assign-split">
                <section className="assign-panel">
                  <div className="assign-panel-header">
                    <strong>Students</strong>
                    <span>
                      {
                        assignStudentOptions.length
                      }{' '}
                      in {assignSchool}
                    </span>
                  </div>

                  <div className="assign-panel-list">
                    {assignStudentOptions.map(
                      (student) => (
                        <button
                          key={student.id}
                          type="button"
                          className={`assign-student-row${
                            assignStudentId ===
                            student.id
                              ? ' is-active'
                              : ''
                          }`}
                          disabled={
                            assignSaving
                          }
                          onClick={() =>
                            selectAssignStudent(
                              student.id
                            )
                          }
                        >
                          <span className="assign-student-avatar">
                            {student.name
                              ?.charAt(0)
                              ?.toUpperCase() ||
                              '?'}
                          </span>

                          <span className="assign-student-info">
                            <strong>
                              {student.name}
                            </strong>
                            <small>
                              {student.subject ||
                                student.program ||
                                student.email ||
                                '—'}
                            </small>
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </section>

                <section className="assign-panel assign-panel-activities">
                  <div className="assign-panel-header">
                    <strong>
                      {assignStudentId
                        ? `Activities · ${
                            allStudents.find(
                              (student) =>
                                student.id ===
                                assignStudentId
                            )?.name ||
                            'Student'
                          }`
                        : 'Activities'}
                    </strong>

                    {assignStudentId &&
                      assignableActivities.length >
                        0 && (
                        <label className="assign-select-all">
                          <input
                            type="checkbox"
                            checked={
                              allAssignActivitiesSelected
                            }
                            disabled={
                              assignSaving
                            }
                            onChange={
                              toggleSelectAllAssignActivities
                            }
                          />
                          <span>
                            Select All
                          </span>
                        </label>
                      )}
                  </div>

                  {!assignStudentId ? (
                    <p className="assign-placeholder">
                      Select a student first.
                    </p>
                  ) : assignableActivities.length ===
                    0 ? (
                    <p className="semester-empty-hint">
                      No activities are available
                      for the student's assigned
                      subjects.
                    </p>
                  ) : (
                    <div className="assign-panel-list">
                      {assignableActivities.map(
                        (activity) => {
                          const checked =
                            assignSelectedActivityIds.includes(
                              activity.id
                            )

                          return (
                            <label
                              key={activity.id}
                              className={`assign-activity-row${
                                checked
                                  ? ' is-selected'
                                  : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  checked
                                }
                                disabled={
                                  assignSaving
                                }
                                onChange={() =>
                                  toggleAssignActivityId(
                                    activity.id
                                  )
                                }
                              />

                              <span className="assign-activity-text">
                                <strong>
                                  {
                                    activity.label
                                  }
                                </strong>
                                <small>
                                  Week{' '}
                                  {activity.week ??
                                    '—'}
                                </small>
                              </span>
                            </label>
                          )
                        }
                      )}
                    </div>
                  )}
                </section>
              </div>

              <div className="modal-footer semester-rollover-footer">
                <button
                  type="button"
                  className="activity-secondary-button"
                  disabled={assignSaving}
                  onClick={
                    closeAssignActivity
                  }
                >
                  Close
                </button>

                <button
                  type="submit"
                  className="activity-primary-button"
                  disabled={
                    assignSaving ||
                    !assignStudentId
                  }
                >
                  {assignSaving
                    ? 'Saving...'
                    : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================
          END SEMESTER
      ======================================================= */}

      {showEndConfirm && (
        <div className="activity-modal-overlay delete-overlay">
          <div className="delete-modal">
            <div className="delete-modal-header">
              <div>
                <span className="activity-eyebrow">
                  SEMESTER
                </span>
                <h2>End Semester?</h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setShowEndConfirm(false)
                }
              >
                ×
              </button>
            </div>

            <div className="delete-modal-body">
              <p>
                End the current semester
                {currentSemester?.name
                  ? ` (${currentSemester.name})`
                  : ''}
                ?
              </p>

              <p className="delete-warning-text">
                Existing student progress will
                remain in the semester archive.
              </p>
            </div>

            <div className="delete-modal-footer">
              <button
                type="button"
                className="activity-secondary-button"
                onClick={() =>
                  setShowEndConfirm(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="activity-danger-button"
                onClick={
                  continueToNewSemester
                }
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          NEW SEMESTER
      ======================================================= */}

      {showNewSemester && (
        <div className="activity-modal-overlay">
          <div className="semester-rollover-modal">
            <div className="modal-header">
              <div>
                <span className="activity-eyebrow">
                  SEMESTER ROLLOVER
                </span>
                <h2>
                  Start a New Semester
                </h2>
                <p>
                  Choose students and copy
                  subject-aware activity
                  templates into the next
                  semester.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                disabled={savingSemester}
                onClick={() => {
                  if (!savingSemester) {
                    setShowNewSemester(false)
                    resetSemesterForm()
                  }
                }}
              >
                ×
              </button>
            </div>

            <form
              className="semester-rollover-form"
              onSubmit={startNewSemester}
            >
              <div className="semester-form-grid">
                <label className="semester-field semester-field-full">
                  <span>
                    Semester Name
                  </span>
                  <input
                    type="text"
                    value={semesterForm.name}
                    onChange={(event) =>
                      setSemesterForm(
                        (current) => ({
                          ...current,
                          name:
                            event.target
                              .value,
                        })
                      )
                    }
                    required
                  />
                </label>

                <label className="semester-field">
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={
                      semesterForm.startDate
                    }
                    onChange={(event) =>
                      setSemesterForm(
                        (current) => ({
                          ...current,
                          startDate:
                            event.target
                              .value,
                        })
                      )
                    }
                    required
                  />
                </label>

                <label className="semester-field">
                  <span>
                    Expected End Date
                  </span>
                  <input
                    type="date"
                    value={
                      semesterForm.endDate
                    }
                    onChange={(event) =>
                      setSemesterForm(
                        (current) => ({
                          ...current,
                          endDate:
                            event.target
                              .value,
                        })
                      )
                    }
                  />
                </label>
              </div>

              <div className="semester-multi-section">
                <div className="semester-multi-header">
                  <strong>
                    Assign Students
                  </strong>
                  <span>
                    {
                      selectedStudentIds.length
                    }{' '}
                    selected
                  </span>
                </div>

                <div className="semester-search-wrap">
                  <input
                    type="search"
                    className="semester-search-input"
                    value={studentSearch}
                    onChange={(event) =>
                      setStudentSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search students..."
                  />
                </div>

                <div className="semester-select-list">
                  {searchableStudents.map(
                    (student) => {
                      const checked =
                        selectedStudentIds.includes(
                          student.id
                        )

                      return (
                        <label
                          key={student.id}
                          className={`semester-select-row${
                            checked
                              ? ' is-selected'
                              : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleSelectedStudent(
                                student.id
                              )
                            }
                          />

                          <span className="semester-select-name">
                            {student.name}
                          </span>

                          <span className="semester-select-meta">
                            {student.subject ||
                              student.program ||
                              student.university ||
                              '—'}
                          </span>
                        </label>
                      )
                    }
                  )}
                </div>
              </div>

              <div className="semester-multi-section">
                <div className="semester-multi-header">
                  <strong>
                    Copy Activities
                  </strong>
                  <span>
                    {
                      selectedActivityIds.length
                    }{' '}
                    selected
                  </span>
                </div>

                <div className="semester-search-wrap">
                  <input
                    type="search"
                    className="semester-search-input"
                    value={activitySearch}
                    onChange={(event) =>
                      setActivitySearch(
                        event.target.value
                      )
                    }
                    placeholder="Search activities..."
                  />
                </div>

                <div className="semester-select-list">
                  {searchableActivities.map(
                    (activity) => {
                      const checked =
                        selectedActivityIds.includes(
                          activity.id
                        )

                      return (
                        <label
                          key={activity.id}
                          className={`semester-select-row${
                            checked
                              ? ' is-selected'
                              : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleSelectedActivity(
                                activity.id
                              )
                            }
                          />

                          <span className="semester-select-name">
                            {activity.label}
                          </span>

                          <span className="semester-select-meta">
                            Week{' '}
                            {activity.week ??
                              '—'}
                          </span>
                        </label>
                      )
                    }
                  )}
                </div>
              </div>

              <div className="modal-footer semester-rollover-footer">
                <button
                  type="button"
                  className="activity-secondary-button"
                  disabled={savingSemester}
                  onClick={() => {
                    if (!savingSemester) {
                      setShowNewSemester(false)
                      resetSemesterForm()
                    }
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="activity-primary-button"
                  disabled={savingSemester}
                >
                  {savingSemester
                    ? 'Starting...'
                    : 'Start New Semester'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivityTracker
