import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import './ActivityTracker.css'

function ActivityTracker() {
  // ============================================================
  // DATA
  // ============================================================

  const [allStudents, setAllStudents] = useState([])
  const [students, setStudents] = useState([])
  const [requirements, setRequirements] = useState([])
  const [allRequirements, setAllRequirements] = useState([])
  const [studentActivity, setStudentActivity] = useState([])
  const [currentSemester, setCurrentSemester] = useState(null)
  const [endedSemesters, setEndedSemesters] = useState([])
  const [allSemesterStudents, setAllSemesterStudents] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Viewing an archived semester (read-only snapshot)
  const [archiveView, setArchiveView] = useState(null)

  // ============================================================
  // FILTERS
  // ============================================================

  const [search, setSearch] = useState('')
  const [clinicFilter, setClinicFilter] = useState('all')
  const [schoolFilter, setSchoolFilter] = useState('all')
  const [manageSchoolFilter, setManageSchoolFilter] = useState('all')

  // Assign activity to student(s) by school
  const [showAssignActivity, setShowAssignActivity] = useState(false)
  const [assignSchool, setAssignSchool] = useState('AUHS')
  const [assignStudentSearch, setAssignStudentSearch] = useState('')
  const [assignStudentId, setAssignStudentId] = useState('')
  const [assignSelectedActivityIds, setAssignSelectedActivityIds] = useState([])
  const [assignSaving, setAssignSaving] = useState(false)

  // ============================================================
  // CHECKLIST MODAL
  // ============================================================

  const [selectedStudent, setSelectedStudent] = useState(null)
  const [savingActivityId, setSavingActivityId] = useState(null)

  // ============================================================
  // MANAGE ACTIVITY MODAL
  // ============================================================

  const [showManageActivity, setShowManageActivity] =
    useState(false)

  const [showActivityForm, setShowActivityForm] =
    useState(false)

  const [editingActivity, setEditingActivity] =
    useState(null)

  const [activityForm, setActivityForm] = useState({
    name: '',
    code: '',
    week: '1',
    university: 'AUHS',
  })

  const [savingActivity, setSavingActivity] =
    useState(false)

  // ============================================================
  // DELETE MODAL
  // ============================================================

  const [activityToDelete, setActivityToDelete] =
    useState(null)

  const [deletingActivityId, setDeletingActivityId] =
    useState(null)

  const [manageSearch, setManageSearch] = useState('')
  const [selectedManageIds, setSelectedManageIds] = useState([])
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // ============================================================
  // END SEMESTER / ROLLOVER
  // ============================================================

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
      ])

      if (studentsResponse.error) {
        throw studentsResponse.error
      }

      if (requirementsResponse.error) {
        throw requirementsResponse.error
      }

      if (activityResponse.error) {
        throw activityResponse.error
      }

      if (semesterResponse.error) {
        throw semesterResponse.error
      }

      if (semesterStudentsResponse.error) {
        throw semesterStudentsResponse.error
      }

      const allStudentsData = studentsResponse.data || []
      const allRequirementsData = requirementsResponse.data || []
      const activityData = activityResponse.data || []
      const allSemestersData = semesterResponse.data || []
      const semesterStudentsData =
        semesterStudentsResponse.data || []

      const activeSemester =
        allSemestersData.find((s) => s.status === 'active') ||
        null

      const archived =
        allSemestersData.filter((s) => s.status !== 'active')

      setAllStudents(allStudentsData)
      setAllRequirements(allRequirementsData)
      setStudentActivity(activityData)
      setCurrentSemester(activeSemester)
      setEndedSemesters(archived)
      setAllSemesterStudents(semesterStudentsData)

      if (activeSemester) {
        const assignedIds = new Set(
          semesterStudentsData
            .filter((row) => row.semester_id === activeSemester.id)
            .map((row) => row.student_id)
        )

        setStudents(
          allStudentsData.filter((s) => assignedIds.has(s.id))
        )

        setRequirements(
          allRequirementsData.filter(
            (r) =>
              r.semester_id === activeSemester.id ||
              (r.semester_id == null && r.student_id == null)
          )
        )
      } else {
        // No active semester: show everyone and global requirements
        setStudents(allStudentsData)
        setRequirements(
          allRequirementsData.filter((r) => r.student_id == null)
        )
      }
    } catch (err) {
      console.error(
        'Student Progress loading error:',
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
  // CLINICS / SCHOOLS
  // ============================================================

  const clinics = useMemo(() => {
    const values = new Set()

    students.forEach((student) => {
      if (student.clinic) {
        values.add(student.clinic)
      }
    })

    return Array.from(values).sort()
  }, [students])

  const schools = useMemo(() => {
    const values = new Set()
    allStudents.forEach((student) => {
      if (student.university) values.add(student.university)
    })
    // Always offer the known schools even if empty
    values.add('AUHS')
    values.add('PACIFIC')
    return Array.from(values).sort()
  }, [allStudents])

  /**
   * Activities for a student = current-semester (or global) requirements
   * that are either unscoped (university null) or match the student's school.
   */
  function requirementsForStudent(student, reqList = requirements) {
    const school = student?.university || null
    return reqList.filter((r) => {
      if (r.student_id && r.student_id !== student?.id) return false
      if (!r.university || r.university === '') return true
      return school && r.university === school
    })
  }

  const manageActivities = useMemo(() => {
    const pool = requirements.filter((r) => r.student_id == null)
    if (manageSchoolFilter === 'all') return pool
    if (manageSchoolFilter === 'shared') {
      return pool.filter((r) => !r.university)
    }
    // School-specific view: only that school's activities (not shared)
    return pool.filter((r) => r.university === manageSchoolFilter)
  }, [requirements, manageSchoolFilter])

  const searchableManageActivities = useMemo(() => {
    const query = manageSearch.trim().toLowerCase()
    const sorted = manageActivities.slice().sort(
      (a, b) =>
        (a.week ?? 0) - (b.week ?? 0) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
    )
    if (!query) return sorted
    return sorted.filter((r) => {
      const hay = [r.label, r.code, r.university, `week ${r.week ?? ''}`]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(query)
    })
  }, [manageActivities, manageSearch])

  const allSearchableSelected =
    searchableManageActivities.length > 0 &&
    searchableManageActivities.every((r) =>
      selectedManageIds.includes(r.id)
    )

  function toggleManageSelectAll() {
    if (allSearchableSelected) {
      const visible = new Set(
        searchableManageActivities.map((r) => r.id)
      )
      setSelectedManageIds((current) =>
        current.filter((id) => !visible.has(id))
      )
    } else {
      setSelectedManageIds((current) => {
        const next = new Set(current)
        searchableManageActivities.forEach((r) => next.add(r.id))
        return Array.from(next)
      })
    }
  }

  function toggleManageSelectOne(id) {
    setSelectedManageIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    )
  }

  // ============================================================
  // ACTIVITY GROUPS
  // ============================================================

  function groupRequirementsByWeek(list) {
    const groups = {}

    list.forEach((requirement) => {
      const week = requirement.week ?? 0
      if (!groups[week]) groups[week] = []
      groups[week].push(requirement)
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
  }

  const activityGroups = useMemo(
    () => groupRequirementsByWeek(requirements),
    [requirements]
  )

  const manageActivityGroups = useMemo(
    () => groupRequirementsByWeek(manageActivities),
    [manageActivities]
  )

  const selectedStudentGroups = useMemo(() => {
    if (!selectedStudent) return []
    return groupRequirementsByWeek(
      requirementsForStudent(selectedStudent, requirements)
    )
  }, [selectedStudent, requirements])

  const assignableActivities = useMemo(() => {
    return requirements.filter(
      (r) =>
        r.student_id == null &&
        (!r.university || r.university === assignSchool)
    )
  }, [requirements, assignSchool])

  const assignStudentOptions = useMemo(() => {
    const query = assignStudentSearch.trim().toLowerCase()
    return allStudents
      .filter((s) => s.university === assignSchool)
      .filter((s) => {
        if (!query) return true
        const hay = [s.name, s.email, s.program]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(query)
      })
  }, [allStudents, assignSchool, assignStudentSearch])

  function openAssignActivity() {
    setError('')
    setAssignSchool(
      schoolFilter !== 'all' ? schoolFilter : 'AUHS'
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

  function toggleAssignActivityId(id) {
    setAssignSelectedActivityIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    )
  }

  async function submitAssignActivity(event) {
    event.preventDefault()

    if (!assignStudentId) {
      setError('Please select a student.')
      return
    }

    if (assignSelectedActivityIds.length === 0) {
      setError('Please select at least one activity.')
      return
    }

    setAssignSaving(true)
    setError('')

    try {
      // Ensure checklist rows exist for selected activities (start incomplete)
      const existing = studentActivity.filter(
        (item) =>
          item.student_id === assignStudentId &&
          assignSelectedActivityIds.includes(item.requirement_id)
      )
      const existingIds = new Set(
        existing.map((item) => item.requirement_id)
      )

      const toInsert = assignSelectedActivityIds
        .filter((id) => !existingIds.has(id))
        .map((requirementId) => ({
          student_id: assignStudentId,
          requirement_id: requirementId,
          completed: false,
        }))

      if (toInsert.length > 0) {
        const { data, error: insertError } = await supabase
          .from('student_activity')
          .insert(toInsert)
          .select()

        if (insertError) throw insertError

        setStudentActivity((current) => [
          ...current,
          ...(data || []),
        ])
      }

      setShowAssignActivity(false)
      setAssignSelectedActivityIds([])
      setAssignStudentId('')
    } catch (err) {
      console.error('Assign activity error:', err)
      setError(
        err.message ||
          'Unable to assign activities. If university column is missing, run the SQL migration first.'
      )
    } finally {
      setAssignSaving(false)
    }
  }

  // ============================================================
  // PROGRESS MAP
  // ============================================================

  const progressMap = useMemo(() => {
    const map = {}

    students.forEach((student) => {
      const studentReqs = requirementsForStudent(
        student,
        requirements
      )
      const reqIds = new Set(studentReqs.map((r) => r.id))

      const completed = studentActivity.filter(
        (item) =>
          item.student_id === student.id &&
          item.completed === true &&
          reqIds.has(item.requirement_id)
      ).length

      const total = studentReqs.length

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
  }, [students, requirements, studentActivity])

  // ============================================================
  // SEMESTER ARCHIVE STATS
  // ============================================================

  const archiveRows = useMemo(() => {
    return endedSemesters.map((semester) => {
      const studentIds = allSemesterStudents
        .filter((row) => row.semester_id === semester.id)
        .map((row) => row.student_id)

      const semesterReqs = allRequirements.filter(
        (r) => r.semester_id === semester.id
      )

      const reqIds = new Set(semesterReqs.map((r) => r.id))
      const studentIdSet = new Set(studentIds)

      const completed = studentActivity.filter(
        (item) =>
          item.completed === true &&
          reqIds.has(item.requirement_id) &&
          studentIdSet.has(item.student_id)
      ).length

      const possible =
        studentIds.length * semesterReqs.length

      const percentage =
        possible > 0
          ? Math.round((completed / possible) * 100)
          : 0

      return {
        semester,
        studentCount: studentIds.length,
        activityCount: semesterReqs.length,
        completed,
        percentage,
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
      .filter((row) => row.semester_id === semester.id)
      .map((row) => row.student_id)

    const studentIdSet = new Set(studentIds)
    const semesterStudents = allStudents.filter((s) =>
      studentIdSet.has(s.id)
    )

    const semesterReqs = allRequirements
      .filter((r) => r.semester_id === semester.id)
      .sort((a, b) => {
        const weekDiff = (a.week ?? 0) - (b.week ?? 0)
        if (weekDiff !== 0) return weekDiff
        return (a.sort_order ?? 0) - (b.sort_order ?? 0)
      })

    const reqIds = new Set(semesterReqs.map((r) => r.id))

    const progress = {}
    semesterStudents.forEach((student) => {
      const completed = studentActivity.filter(
        (item) =>
          item.student_id === student.id &&
          item.completed === true &&
          reqIds.has(item.requirement_id)
      ).length

      progress[student.id] = {
        completed,
        total: semesterReqs.length,
        percentage:
          semesterReqs.length > 0
            ? Math.round(
                (completed / semesterReqs.length) * 100
              )
            : 0,
      }
    })

    setArchiveView({
      semester,
      students: semesterStudents,
      requirements: semesterReqs,
      progress,
    })
  }

  function closeArchiveView() {
    setArchiveView(null)
  }

  function formatDate(value) {
    if (!value) return '—'
    try {
      return new Date(value + 'T00:00:00').toLocaleDateString(
        undefined,
        { year: 'numeric', month: 'short', day: 'numeric' }
      )
    } catch {
      return value
    }
  }

  // ============================================================
  // FILTERED STUDENTS
  // ============================================================

  const filteredStudents = useMemo(() => {
    const query =
      search.trim().toLowerCase()

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

      if (!query) {
        return true
      }

      const searchable = [
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

      return searchable.includes(query)
    })
  }, [
    students,
    search,
    clinicFilter,
    schoolFilter,
  ])

  // ============================================================
  // SUMMARY
  // ============================================================

  const totalStudents = students.length
  const totalActivities = requirements.length

  const currentRequirementIds = useMemo(
    () => new Set(requirements.map((r) => r.id)),
    [requirements]
  )

  const completedItems =
    studentActivity.filter(
      (item) =>
        item.completed === true &&
        currentRequirementIds.has(
          item.requirement_id
        ) &&
        students.some(
          (s) => s.id === item.student_id
        )
    ).length

  const possibleItems =
    totalStudents * totalActivities

  const overallProgress =
    possibleItems > 0
      ? Math.round(
          (completedItems /
            possibleItems) *
            100
        )
      : 0

  // ============================================================
  // HELPERS
  // ============================================================

  function getStudentActivity(
    studentId,
    requirementId
  ) {
    return studentActivity.find(
      (item) =>
        item.student_id === studentId &&
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

  async function toggleActivity(
    studentId,
    requirementId,
    currentCompleted
  ) {
    setSavingActivityId(requirementId)
    setError('')

    try {
      const existing =
        getStudentActivity(
          studentId,
          requirementId
        )

      if (existing) {
        const {
          data,
          error: updateError,
        } = await supabase
          .from('student_activity')
          .update({
            completed:
              !currentCompleted,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (updateError) {
          throw updateError
        }

        setStudentActivity((current) =>
          current.map((item) =>
            item.id === existing.id
              ? data
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
            student_id: studentId,
            requirement_id:
              requirementId,
            completed: true,
          })
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        setStudentActivity((current) => [
          ...current,
          data,
        ])
      }
    } catch (err) {
      console.error(
        'Activity update error:',
        err
      )

      setError(
        err.message ||
          'Unable to update activity.'
      )
    } finally {
      setSavingActivityId(null)
    }
  }

  // ============================================================
  // NOTES
  // ============================================================

  async function saveNote(
    studentId,
    requirementId,
    note
  ) {
    const existing =
      getStudentActivity(
        studentId,
        requirementId
      )

    try {
      if (existing) {
        const {
          data,
          error: updateError,
        } = await supabase
          .from('student_activity')
          .update({
            note,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (updateError) {
          throw updateError
        }

        setStudentActivity((current) =>
          current.map((item) =>
            item.id === existing.id
              ? data
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
            student_id: studentId,
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

        setStudentActivity((current) => [
          ...current,
          data,
        ])
      }
    } catch (err) {
      console.error(
        'Note save error:',
        err
      )

      setError(
        err.message ||
          'Unable to save note.'
      )
    }
  }

  // ============================================================
  // MANAGE ACTIVITY
  // ============================================================

  function openManageActivity() {
    setError('')
    const defaultSchool =
      schoolFilter !== 'all' ? schoolFilter : 'AUHS'
    setManageSchoolFilter(defaultSchool)
    setActivityForm({
      name: '',
      code: '',
      week: '1',
      university: defaultSchool,
    })
    setEditingActivity(null)
    setShowActivityForm(false)
    setActivityToDelete(null)
    setManageSearch('')
    setSelectedManageIds([])
    setShowManageActivity(true)
  }

  function handleManageSchoolChange(value) {
    setManageSchoolFilter(value)
    setEditingActivity(null)
    setManageSearch('')
    setSelectedManageIds([])
    setActivityForm((current) => ({
      ...current,
      name: '',
      code: '',
      week: '1',
      university: value === 'shared' || value === 'all' ? '' : value,
    }))
  }

  function closeManageActivity() {
    if (
      savingActivity ||
      deletingActivityId
    ) {
      return
    }

    setShowManageActivity(false)
    setShowActivityForm(false)
    setEditingActivity(null)
    setActivityToDelete(null)

    resetActivityForm()
  }

  // ============================================================
  // ADD ACTIVITY
  // ============================================================

  function resetActivityForm() {
    setActivityForm({
      name: '',
      code: '',
      week: '1',
      university:
        manageSchoolFilter !== 'all' &&
        manageSchoolFilter !== 'shared'
          ? manageSchoolFilter
          : 'AUHS',
    })
  }

  function openAddActivity() {
    setError('')

    setEditingActivity(null)

    resetActivityForm()

    setShowActivityForm(true)
  }

  // ============================================================
  // EDIT ACTIVITY
  // ============================================================

  function openEditActivity(requirement) {
    setError('')

    setEditingActivity(requirement)

    setActivityForm({
      name:
        requirement.label || '',
      code:
        requirement.code || '',
      week:
        String(
          requirement.week ?? 1
        ),
      university:
        requirement.university || '',
    })

    setShowActivityForm(true)
  }

  function closeActivityForm() {
    if (savingActivity) {
      return
    }

    setShowActivityForm(false)
    setEditingActivity(null)

    resetActivityForm()
  }

  // ============================================================
  // SAVE ACTIVITY
  // ============================================================

  async function saveActivity(event) {
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
      // --------------------------------------------------------
      // EDIT
      // --------------------------------------------------------

      const universityValue =
        activityForm.university?.trim() || null

      if (editingActivity) {
        const {
          data,
          error: updateError,
        } = await supabase
          .from('activity_requirements')
          .update({
            label: name,
            code:
              code ||
              editingActivity.code ||
              `ACT-${Date.now()}`,
            week,
            university: universityValue,
          })
          .eq(
            'id',
            editingActivity.id
          )
          .select()
          .single()

        if (updateError) {
          throw updateError
        }

        setRequirements((current) =>
          current.map((item) =>
            item.id ===
            editingActivity.id
              ? data
              : item
          )
        )
        setAllRequirements((current) =>
          current.map((item) =>
            item.id ===
            editingActivity.id
              ? data
              : item
          )
        )
      }

      // --------------------------------------------------------
      // ADD
      // --------------------------------------------------------

      else {
        const insertPayload = {
          code:
            code ||
            `ACT-${Date.now()}`,
          label: name,
          week,
          sort_order:
            requirements.length,
          university: universityValue,
        }

        if (currentSemester?.id) {
          insertPayload.semester_id =
            currentSemester.id
        }

        const {
          data,
          error: insertError,
        } = await supabase
          .from('activity_requirements')
          .insert(insertPayload)
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        setRequirements((current) => [
          ...current,
          data,
        ])
        setAllRequirements((current) => [
          ...current,
          data,
        ])
      }

      // Keep Manage modal open; clear form for the next activity
      setEditingActivity(null)
      setShowActivityForm(false)
      setActivityForm({
        name: '',
        code: '',
        week: '1',
        university:
          manageSchoolFilter === 'shared'
            ? ''
            : manageSchoolFilter === 'all'
              ? 'AUHS'
              : manageSchoolFilter,
      })
    } catch (err) {
      console.error(
        'Save activity error:',
        err
      )

      setError(
        err.message ||
          'Unable to save activity. If school tagging fails, add the university column in Supabase.'
      )
    } finally {
      setSavingActivity(false)
    }
  }

  // ============================================================
  // DELETE
  // ============================================================

  function openDeleteActivity(requirement) {
    setError('')
    setActivityToDelete(requirement)
  }

  function closeDeleteActivity() {
    if (deletingActivityId) {
      return
    }

    setActivityToDelete(null)
  }

  async function deleteActivitiesByIds(ids) {
    if (!ids.length) return

    // Delete checklist records first.
    const { error: checklistDeleteError } = await supabase
      .from('student_activity')
      .delete()
      .in('requirement_id', ids)

    if (checklistDeleteError) {
      throw checklistDeleteError
    }

    const { error: activityDeleteError } = await supabase
      .from('activity_requirements')
      .delete()
      .in('id', ids)

    if (activityDeleteError) {
      throw activityDeleteError
    }

    const idSet = new Set(ids)

    setRequirements((current) =>
      current.filter((item) => !idSet.has(item.id))
    )
    setAllRequirements((current) =>
      current.filter((item) => !idSet.has(item.id))
    )
    setStudentActivity((current) =>
      current.filter(
        (item) => !idSet.has(item.requirement_id)
      )
    )
    setSelectedManageIds((current) =>
      current.filter((id) => !idSet.has(id))
    )
  }

  async function confirmDeleteActivity() {
    if (!activityToDelete) {
      return
    }

    const requirement = activityToDelete

    setDeletingActivityId(requirement.id)
    setError('')

    try {
      await deleteActivitiesByIds([requirement.id])
      setActivityToDelete(null)
    } catch (err) {
      console.error('Delete activity error:', err)
      setError(
        err.message || 'Unable to delete activity.'
      )
    } finally {
      setDeletingActivityId(null)
    }
  }

  async function confirmBulkDelete() {
    if (selectedManageIds.length === 0) return

    const count = selectedManageIds.length
    const ok = window.confirm(
      `Delete ${count} selected ${
        count === 1 ? 'activity' : 'activities'
      }?\n\nThis also removes related student checklist records.`
    )
    if (!ok) return

    setBulkDeleting(true)
    setError('')

    try {
      await deleteActivitiesByIds(selectedManageIds)
    } catch (err) {
      console.error('Bulk delete error:', err)
      setError(
        err.message || 'Unable to delete selected activities.'
      )
    } finally {
      setBulkDeleting(false)
    }
  }

  // ============================================================
  // END SEMESTER / ROLLOVER
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

  function closeEndConfirm() {
    if (savingSemester) return
    setShowEndConfirm(false)
  }

  function continueToNewSemester() {
    setShowEndConfirm(false)
    resetSemesterForm()

    // Pre-select students currently on this semester
    setSelectedStudentIds(students.map((s) => s.id))

    // Pre-select current global requirements as activity templates
    setSelectedActivityIds(
      requirements
        .filter((r) => r.student_id == null)
        .map((r) => r.id)
    )

    // Sensible defaults for dates
    const today = new Date().toISOString().slice(0, 10)
    setSemesterForm((current) => ({
      ...current,
      startDate: today,
    }))

    setShowNewSemester(true)
  }

  function closeNewSemester() {
    if (savingSemester) return
    setShowNewSemester(false)
    resetSemesterForm()
  }

  function toggleSelectedStudent(studentId) {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    )
  }

  function removeSelectedStudent(studentId) {
    setSelectedStudentIds((current) =>
      current.filter((id) => id !== studentId)
    )
  }

  function toggleSelectedActivity(activityId) {
    setSelectedActivityIds((current) =>
      current.includes(activityId)
        ? current.filter((id) => id !== activityId)
        : [...current, activityId]
    )
  }

  function removeSelectedActivity(activityId) {
    setSelectedActivityIds((current) =>
      current.filter((id) => id !== activityId)
    )
  }

  const searchableStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase()
    if (!query) return allStudents
    return allStudents.filter((student) => {
      const haystack = [
        student.name,
        student.email,
        student.program,
        student.university,
        student.clinic,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [allStudents, studentSearch])

  const searchableActivities = useMemo(() => {
    // Prefer templates from the current semester, fall back to all global ones
    const pool =
      requirements.length > 0
        ? requirements.filter((r) => r.student_id == null)
        : allRequirements.filter((r) => r.student_id == null)

    const query = activitySearch.trim().toLowerCase()
    if (!query) return pool

    return pool.filter((activity) => {
      const haystack = [
        activity.label,
        activity.code,
        activity.description,
        activity.week != null ? `week ${activity.week}` : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [requirements, allRequirements, activitySearch])

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

    if (selectedStudentIds.length === 0) {
      setError('Please assign at least one student to the new semester.')
      return
    }

    setSavingSemester(true)
    setError('')

    try {
      // 1. End the current semester (preserve all history)
      if (currentSemester) {
        const { error: endError } = await supabase
          .from('semesters')
          .update({
            status: 'ended',
            end_date:
              currentSemester.end_date ||
              new Date().toISOString().slice(0, 10),
          })
          .eq('id', currentSemester.id)

        if (endError) {
          throw endError
        }
      }

      // 2. Create the new active semester
      const { data: newSemester, error: createError } = await supabase
        .from('semesters')
        .insert({
          name,
          status: 'active',
          start_date: semesterForm.startDate,
          end_date: semesterForm.endDate || null,
        })
        .select()
        .single()

      if (createError) {
        throw createError
      }

      // 3. Assign selected students
      const studentRows = selectedStudentIds.map((studentId) => ({
        semester_id: newSemester.id,
        student_id: studentId,
      }))

      const { error: assignError } = await supabase
        .from('semester_students')
        .insert(studentRows)

      if (assignError) {
        throw assignError
      }

      // 4. Copy selected activities into the new semester
      //    (old requirement rows + student_activity stay historical)
      if (selectedActivityIds.length > 0) {
        const templates = allRequirements.filter((r) =>
          selectedActivityIds.includes(r.id)
        )

        const activityRows = templates.map((template, index) => ({
          code: template.code || `ACT-${Date.now()}-${index}`,
          label: template.label,
          week: template.week ?? 1,
          sort_order: template.sort_order ?? index,
          description: template.description || null,
          semester_id: newSemester.id,
          student_id: null,
        }))

        const { error: activitiesError } = await supabase
          .from('activity_requirements')
          .insert(activityRows)

        if (activitiesError) {
          throw activitiesError
        }
      }

      setShowNewSemester(false)
      resetSemesterForm()
      await loadData()
    } catch (err) {
      console.error('Start new semester error:', err)
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

      {/* ======================================================
          PAGE HEADER
      ======================================================= */}

      <section className="activity-page-header">

        <div className="activity-page-header-copy">

          <span className="activity-eyebrow">
            ACTIVITY MANAGEMENT
          </span>

          <h1>
            Student Progress
          </h1>

          <p>
            Monitor student activity
            and manage the current
            semester.
            {currentSemester?.name
              ? ` Active: ${currentSemester.name}`
              : ''}
          </p>

        </div>

        <div className="activity-page-actions">

          <button
            type="button"
            className="activity-primary-button"
            onClick={openManageActivity}
          >
            <span className="button-plus">+</span>
            Manage Activity
          </button>

          <button
            type="button"
            className="activity-secondary-button"
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


      {/* ======================================================
          ERROR
      ======================================================= */}

      {error && (
        <div className="activity-error">

          <div>

            <strong>
              Something went wrong
            </strong>

            <span>
              {error}
            </span>

          </div>

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

      <section className="activity-summary-grid">

        <div className="activity-summary-card">

          <span>
            STUDENTS
          </span>

          <strong>
            {totalStudents}
          </strong>

          <small>
            Students currently being
            monitored
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
            Checklist requirements
          </small>

        </div>


        <div className="activity-summary-card">

          <span>
            COMPLETED
          </span>

          <strong>
            {completedItems}
          </strong>

          <small>
            Completed activities
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

      </section>


      {/* ======================================================
          FILTER BAR
      ======================================================= */}

      <section className="activity-filter-card">

        <div className="activity-filter-search">

          <span className="search-icon">
            ⌕
          </span>

          <input
            type="text"
            value={search}
            placeholder="Search student..."
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
          value={schoolFilter}
          onChange={(event) =>
            setSchoolFilter(event.target.value)
          }
        >
          <option value="all">All Schools</option>
          {schools.map((school) => (
            <option key={school} value={school}>
              {school}
            </option>
          ))}
        </select>

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
          </strong>

          {' '}of{' '}

          <strong>
            {students.length}
          </strong>

        </div>

      </section>


      {/* ======================================================
          STUDENT PROGRESS + SEMESTER ARCHIVE
      ======================================================= */}

      {loading ? (

        <div className="activity-state-card">

          <div className="activity-spinner" />

          <strong>
            Loading Student Progress
          </strong>

          <span>
            Please wait while the
            student activity is loaded.
          </span>

        </div>

      ) : (

      <div className="activity-split-layout">

        {/* ---- Current semester students ---- */}

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

              <strong>
                No students found
              </strong>

              <span>
                {currentSemester
                  ? 'No students are assigned to this semester, or none match your filters.'
                  : 'Start a semester to assign students.'}
              </span>

            </div>

          ) : (

        <div className="activity-table-card">

          <div className="activity-table-scroll">

            <table className="activity-table activity-table-compact">

              <thead>

                <tr>

                  <th>
                    STUDENT
                  </th>

                  <th>
                    PROGRAM
                  </th>

                  <th>
                    PROGRESS
                  </th>

                  <th className="activity-action-column">
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
                          totalActivities,
                        percentage: 0,
                      }

                    return (

                      <tr
                        key={
                          student.id
                        }
                      >

                        {/* STUDENT */}

                        <td>

                          <div className="student-person">

                            <div className="student-avatar">

                              {student.name
                                ?.charAt(
                                  0
                                )
                                ?.toUpperCase() ||
                                '?'}

                            </div>

                            <div className="student-person-info">

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


                        {/* PROGRAM */}

                        <td>

                          <div className="program-school">

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


                        {/* PROGRESS */}

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
                              }%
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


                        {/* ACTION */}

                        <td className="activity-action-column">

                          <button
                            type="button"
                            className="view-checklist-button"
                            onClick={() =>
                              openChecklist(
                                student
                              )
                            }
                          >
                            View
                            <span>→</span>
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

        </section>

        {/* ---- Semester Archive ---- */}

        <section className="activity-split-panel activity-archive-panel">

          <div className="activity-split-header">
            <div>
              <span className="activity-eyebrow">
                HISTORY
              </span>
              <h3>
                Semester Archive
              </h3>
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
                When you end a semester,
                it will appear here with
                its historical progress.
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
                      <th className="activity-action-column">
                        VIEW
                      </th>
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
                        <tr key={semester.id}>
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
                                / {activityCount} act.
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

                          <td className="activity-action-column">
                            <button
                              type="button"
                              className="view-checklist-button"
                              onClick={() =>
                                openArchiveView(semester)
                              }
                            >
                              View
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
          ARCHIVE DETAIL MODAL
      ======================================================= */}

      {archiveView && (

        <div
          className="activity-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeArchiveView()
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
                    archiveView.semester.start_date
                  )}
                  {' → '}
                  {formatDate(
                    archiveView.semester.end_date
                  )}
                  {' · '}
                  {archiveView.students.length}{' '}
                  students ·{' '}
                  {archiveView.requirements.length}{' '}
                  activities
                  {' · read-only history'}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeArchiveView}
              >
                ×
              </button>

            </div>

            <div className="archive-detail-body">

              {archiveView.students.length === 0 ? (
                <p className="semester-empty-hint">
                  No students were assigned to
                  this semester.
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
                              total:
                                archiveView
                                  .requirements
                                  .length,
                              percentage: 0,
                            }

                          return (
                            <tr key={student.id}>
                              <td>
                                <div className="student-person">
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
                                        {student.email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="program-school">
                                  <strong>
                                    {student.program ||
                                      'General'}
                                  </strong>
                                  <span>
                                    {student.university ||
                                      student.clinic ||
                                      '—'}
                                  </span>
                                </div>
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
                                    /
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
              )}

            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="activity-secondary-button"
                onClick={closeArchiveView}
              >
                Close
              </button>
            </div>

          </div>

        </div>

      )}


      {/* ======================================================
          STUDENT CHECKLIST MODAL
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
            className="checklist-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

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

                  {selectedStudent.university &&
                    ` · ${selectedStudent.university}`}

                </p>

              </div>


              <button
                type="button"
                className="modal-close"
                onClick={
                  closeChecklist
                }
              >
                ×
              </button>

            </div>


            {/* PROGRESS */}

            <div className="checklist-summary">

              <div className="checklist-summary-top">

                <span>
                  OVERALL COMPLETION
                </span>

                <strong>
                  {
                    progressMap[
                      selectedStudent.id
                    ]?.percentage || 0
                  }%
                </strong>

              </div>

              <div className="checklist-progress-track">

                <div
                  className="checklist-progress-fill"
                  style={{
                    width: `${
                      progressMap[
                        selectedStudent.id
                      ]?.percentage || 0
                    }%`,
                  }}
                />

              </div>

            </div>


            {/* BODY */}

            <div className="checklist-body">

              {selectedStudentGroups.length ===
              0 ? (

                <div className="empty-checklist">

                  <strong>
                    No activities for this school
                  </strong>

                  <span>
                    Create school-specific activities
                    in Manage Activity, or use Assign
                    Activity.
                  </span>

                </div>

              ) : (

                selectedStudentGroups.map(
                  (group) => (

                    <div
                      key={
                        group.week
                      }
                      className="week-section"
                    >

                      <div className="week-header">

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
                            .length === 1
                            ? 'activity'
                            : 'activities'}
                        </span>

                      </div>


                      <div className="checklist-items">

                        {group.items.map(
                          (
                            requirement
                          ) => {

                            const existing =
                              getStudentActivity(
                                selectedStudent.id,
                                requirement.id
                              )

                            const completed =
                              existing?.completed ===
                              true

                            return (

                              <div
                                key={
                                  requirement.id
                                }
                                className={`checklist-item ${
                                  completed
                                    ? 'is-completed'
                                    : ''
                                }`}
                              >

                                <label className="check-item-label">

                                  <input
                                    type="checkbox"
                                    checked={
                                      completed
                                    }
                                    disabled={
                                      savingActivityId ===
                                      requirement.id
                                    }
                                    onChange={() =>
                                      toggleActivity(
                                        selectedStudent.id,
                                        requirement.id,
                                        completed
                                      )
                                    }
                                  />

                                  <span className="custom-checkbox" />

                                  <span className="check-item-text">

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
                                  className="check-item-note"
                                  placeholder="Add a note..."
                                  defaultValue={
                                    existing?.note ||
                                    ''
                                  }
                                  onBlur={(
                                    event
                                  ) =>
                                    saveNote(
                                      selectedStudent.id,
                                      requirement.id,
                                      event
                                        .target
                                        .value
                                    )
                                  }
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


            <div className="modal-footer">

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
          MANAGE ACTIVITY MODAL (simple school workflow)
      ======================================================= */}

      {showManageActivity && (

        <div
          className="activity-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeManageActivity()
            }
          }}
        >

          <div
            className="manage-activity-modal manage-activity-modal-simple"
            onMouseDown={(event) => event.stopPropagation()}
          >

            <div className="modal-header">
              <div>
                <span className="activity-eyebrow">
                  ACTIVITY MANAGEMENT
                </span>
                <h2>Manage Activities</h2>
                <p>
                  Choose a school, add activities by
                  name and week, or delete ones you
                  no longer need.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeManageActivity}
              >
                ×
              </button>
            </div>

            <div className="manage-simple-body">

              {/* Step 1 — School */}
              <section className="manage-simple-card">
                <label className="manage-simple-field">
                  <span>1. Select the school</span>
                  <select
                    value={
                      manageSchoolFilter === 'all'
                        ? 'AUHS'
                        : manageSchoolFilter
                    }
                    onChange={(event) =>
                      handleManageSchoolChange(
                        event.target.value
                      )
                    }
                  >
                    {schools.map((school) => (
                      <option key={school} value={school}>
                        {school}
                      </option>
                    ))}
                    <option value="shared">
                      Shared (all schools)
                    </option>
                  </select>
                </label>
              </section>

              {/* Step 2 — Add activity */}
              <section className="manage-simple-card">
                <div className="manage-simple-card-title">
                  <strong>
                    {editingActivity
                      ? '2. Edit activity'
                      : '2. Add activity'}
                  </strong>
                  {editingActivity && (
                    <button
                      type="button"
                      className="manage-cancel-edit"
                      onClick={() => {
                        setEditingActivity(null)
                        setActivityForm({
                          name: '',
                          code: '',
                          week: '1',
                          university:
                            manageSchoolFilter === 'shared'
                              ? ''
                              : manageSchoolFilter === 'all'
                                ? 'AUHS'
                                : manageSchoolFilter,
                        })
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>

                <form
                  className="manage-simple-form"
                  onSubmit={saveActivity}
                >
                  <label className="manage-simple-field manage-simple-field-grow">
                    <span>Activity name</span>
                    <input
                      type="text"
                      required
                      value={activityForm.name}
                      placeholder="e.g. Clinical orientation"
                      disabled={savingActivity}
                      onChange={(event) =>
                        setActivityForm((current) => ({
                          ...current,
                          name: event.target.value,
                          university:
                            manageSchoolFilter === 'shared'
                              ? ''
                              : manageSchoolFilter === 'all'
                                ? 'AUHS'
                                : manageSchoolFilter,
                        }))
                      }
                    />
                  </label>

                  <label className="manage-simple-field">
                    <span>Week</span>
                    <select
                      value={activityForm.week}
                      disabled={savingActivity}
                      onChange={(event) =>
                        setActivityForm((current) => ({
                          ...current,
                          week: event.target.value,
                        }))
                      }
                    >
                      <option value="0">General</option>
                      {Array.from({ length: 16 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          Week {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="submit"
                    className="activity-primary-button manage-simple-save"
                    disabled={savingActivity}
                  >
                    {savingActivity
                      ? 'Saving...'
                      : editingActivity
                        ? 'Update'
                        : 'Save activity'}
                  </button>
                </form>
              </section>

              {/* Step 3 — List + search + bulk delete */}
              <section className="manage-simple-card manage-simple-list-card">
                <div className="manage-simple-card-title">
                  <strong>
                    3. Activities for{' '}
                    {manageSchoolFilter === 'shared'
                      ? 'all schools'
                      : manageSchoolFilter === 'all'
                        ? 'AUHS'
                        : manageSchoolFilter}
                  </strong>
                  <span>
                    {searchableManageActivities.length}
                    {manageSearch.trim()
                      ? ` match · ${manageActivities.length} total`
                      : manageActivities.length === 1
                        ? ' item'
                        : ' items'}
                  </span>
                </div>

                {manageActivities.length === 0 ? (
                  <p className="manage-simple-empty">
                    No activities for this school yet.
                    Add one above. Existing items may
                    need the AUHS SQL update first.
                  </p>
                ) : (
                  <>
                    <div className="manage-bulk-toolbar">
                      <div className="manage-bulk-search">
                        <span>⌕</span>
                        <input
                          type="search"
                          value={manageSearch}
                          onChange={(event) =>
                            setManageSearch(event.target.value)
                          }
                          placeholder="Search activities..."
                        />
                      </div>
                      <label className="manage-select-all">
                        <input
                          type="checkbox"
                          checked={allSearchableSelected}
                          onChange={toggleManageSelectAll}
                        />
                        Select all
                      </label>
                      <button
                        type="button"
                        className="activity-delete-button"
                        disabled={
                          bulkDeleting ||
                          selectedManageIds.length === 0
                        }
                        onClick={confirmBulkDelete}
                      >
                        {bulkDeleting
                          ? 'Deleting...'
                          : `Delete selected (${selectedManageIds.length})`}
                      </button>
                    </div>

                    {searchableManageActivities.length === 0 ? (
                      <p className="manage-simple-empty">
                        No activities match your search.
                      </p>
                    ) : (
                      <ul className="manage-simple-list">
                        {searchableManageActivities.map(
                          (requirement, index) => {
                            const checked =
                              selectedManageIds.includes(
                                requirement.id
                              )
                            return (
                              <li
                                key={requirement.id}
                                className={`manage-simple-item${
                                  editingActivity?.id ===
                                  requirement.id
                                    ? ' is-editing'
                                    : ''
                                }${checked ? ' is-selected' : ''}`}
                              >
                                <label className="manage-item-check">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      toggleManageSelectOne(
                                        requirement.id
                                      )
                                    }
                                  />
                                </label>
                                <span className="manage-simple-index">
                                  {String(index + 1).padStart(
                                    2,
                                    '0'
                                  )}
                                </span>
                                <div className="manage-simple-item-info">
                                  <strong>
                                    {requirement.label}
                                  </strong>
                                  <span>
                                    Week{' '}
                                    {requirement.week ?? '—'}
                                    {requirement.university
                                      ? ` · ${requirement.university}`
                                      : ' · Shared'}
                                  </span>
                                </div>
                                <div className="manage-simple-item-actions">
                                  <button
                                    type="button"
                                    className="activity-edit-button"
                                    onClick={() => {
                                      setEditingActivity(
                                        requirement
                                      )
                                      setActivityForm({
                                        name:
                                          requirement.label ||
                                          '',
                                        code:
                                          requirement.code ||
                                          '',
                                        week: String(
                                          requirement.week ?? 1
                                        ),
                                        university:
                                          requirement.university ||
                                          '',
                                      })
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="activity-delete-button"
                                    disabled={
                                      deletingActivityId ===
                                      requirement.id
                                    }
                                    onClick={() =>
                                      openDeleteActivity(
                                        requirement
                                      )
                                    }
                                  >
                                    {deletingActivityId ===
                                    requirement.id
                                      ? '...'
                                      : 'Delete'}
                                  </button>
                                </div>
                              </li>
                            )
                          }
                        )}
                      </ul>
                    )}
                  </>
                )}
              </section>

            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="activity-secondary-button"
                onClick={closeManageActivity}
              >
                Done
              </button>
            </div>

          </div>

        </div>

      )}


      {/* ======================================================
          ADD / EDIT ACTIVITY MODAL
      ======================================================= */}

      {showActivityForm && (

        <div
          className="activity-modal-overlay activity-form-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeActivityForm()
            }
          }}
        >

          <div
            className="activity-form-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <span className="activity-eyebrow">
                  {editingActivity
                    ? 'EDIT ACTIVITY'
                    : 'NEW ACTIVITY'}
                </span>

                <h2>
                  {editingActivity
                    ? 'Edit Activity'
                    : 'Add Activity'}
                </h2>

                <p>
                  {editingActivity
                    ? 'Update the activity details.'
                    : 'Create a new student checklist activity.'}
                </p>

              </div>


              <button
                type="button"
                className="modal-close"
                disabled={
                  savingActivity
                }
                onClick={
                  closeActivityForm
                }
              >
                ×
              </button>

            </div>


            <form
              className="activity-form"
              onSubmit={
                saveActivity
              }
            >

              <div className="form-grid">

                <label className="form-field form-field-wide">

                  <span>
                    Activity Name *
                  </span>

                  <input
                    type="text"
                    required
                    autoFocus
                    value={
                      activityForm.name
                    }
                    placeholder="Activity name"
                    onChange={(
                      event
                    ) =>
                      setActivityForm(
                        (current) => ({
                          ...current,
                          name:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                  />

                </label>


                <label className="form-field">

                  <span>
                    School *
                  </span>

                  <select
                    value={
                      activityForm.university
                    }
                    onChange={(
                      event
                    ) =>
                      setActivityForm(
                        (current) => ({
                          ...current,
                          university:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                  >
                    <option value="">
                      All schools (shared)
                    </option>
                    {schools.map((school) => (
                      <option
                        key={school}
                        value={school}
                      >
                        {school} only
                      </option>
                    ))}
                  </select>

                </label>


                <label className="form-field">

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
                        (current) => ({
                          ...current,
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
                            index + 1
                          }
                          value={
                            index + 1
                          }
                        >
                          Week{' '}
                          {index + 1}
                        </option>
                      )
                    )}

                  </select>

                </label>


                <label className="form-field">

                  <span>
                    Activity Code
                  </span>

                  <input
                    type="text"
                    value={
                      activityForm.code
                    }
                    placeholder="Optional"
                    onChange={(
                      event
                    ) =>
                      setActivityForm(
                        (current) => ({
                          ...current,
                          code:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                  />

                </label>

              </div>


              <div className="activity-form-footer">

                <button
                  type="button"
                  className="activity-secondary-button"
                  disabled={
                    savingActivity
                  }
                  onClick={
                    closeActivityForm
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
                    ? 'Saving...'
                    : editingActivity
                      ? 'Save Changes'
                      : 'Add Activity'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}


      {/* ======================================================
          DELETE CONFIRMATION MODAL
      ======================================================= */}

      {activityToDelete && (

        <div
          className="activity-modal-overlay delete-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDeleteActivity()
            }
          }}
        >

          <div
            className="delete-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="delete-modal-header">

              <div>

                <span className="activity-eyebrow">
                  DELETE ACTIVITY
                </span>

                <h2>
                  Delete Activity?
                </h2>

              </div>


              <button
                type="button"
                className="modal-close"
                onClick={
                  closeDeleteActivity
                }
              >
                ×
              </button>

            </div>


            <div className="delete-modal-body">

              <div className="delete-activity-preview">

                <strong>
                  {
                    activityToDelete.label
                  }
                </strong>

                <span>

                  Week{' '}
                  {
                    activityToDelete.week ??
                    '—'
                  }

                  {activityToDelete.code &&
                    ` · ${activityToDelete.code}`}

                </span>

              </div>


              <p>
                Are you sure you want to
                delete this activity?
              </p>

              <p className="delete-warning-text">
                This will also remove the
                checklist records associated
                with this activity for all
                students. This action cannot
                be undone.
              </p>

            </div>


            <div className="delete-modal-footer">

              <button
                type="button"
                className="activity-secondary-button"
                disabled={
                  Boolean(
                    deletingActivityId
                  )
                }
                onClick={
                  closeDeleteActivity
                }
              >
                Cancel
              </button>


              <button
                type="button"
                className="delete-confirm-button"
                disabled={
                  Boolean(
                    deletingActivityId
                  )
                }
                onClick={
                  confirmDeleteActivity
                }
              >
                {deletingActivityId
                  ? 'Deleting...'
                  : 'Delete Activity'}
              </button>

            </div>

          </div>

        </div>

      )}


      {/* ======================================================
          ASSIGN ACTIVITY TO STUDENT
      ======================================================= */}

      {showAssignActivity && (

        <div
          className="activity-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAssignActivity()
            }
          }}
        >
          <div
            className="semester-rollover-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="activity-eyebrow">
                  STUDENT ACTIVITIES
                </span>
                <h2>Assign Activity</h2>
                <p>
                  Filter by school, pick a student,
                  then choose activities for their
                  checklist.
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
              className="semester-rollover-form"
              onSubmit={submitAssignActivity}
            >
              <div className="semester-form-grid">
                <label className="semester-field">
                  <span>School</span>
                  <select
                    value={assignSchool}
                    onChange={(event) => {
                      setAssignSchool(event.target.value)
                      setAssignStudentId('')
                      setAssignSelectedActivityIds([])
                    }}
                    disabled={assignSaving}
                  >
                    {schools.map((school) => (
                      <option key={school} value={school}>
                        {school}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="semester-field">
                  <span>Search student</span>
                  <input
                    type="search"
                    value={assignStudentSearch}
                    onChange={(event) =>
                      setAssignStudentSearch(event.target.value)
                    }
                    placeholder="Name or email..."
                    disabled={assignSaving}
                  />
                </label>
              </div>

              <div className="semester-multi-section">
                <div className="semester-multi-header">
                  <strong>Student</strong>
                  <span>
                    {assignStudentOptions.length} in {assignSchool}
                  </span>
                </div>
                <div className="semester-select-list">
                  {assignStudentOptions.length === 0 ? (
                    <p className="semester-empty-hint">
                      No students found for this school.
                    </p>
                  ) : (
                    assignStudentOptions.map((student) => (
                      <label
                        key={student.id}
                        className={`semester-select-row${
                          assignStudentId === student.id
                            ? ' is-selected'
                            : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="assign-student"
                          checked={assignStudentId === student.id}
                          disabled={assignSaving}
                          onChange={() =>
                            setAssignStudentId(student.id)
                          }
                        />
                        <span className="semester-select-name">
                          {student.name}
                        </span>
                        <span className="semester-select-meta">
                          {student.program || student.email || ''}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="semester-multi-section">
                <div className="semester-multi-header">
                  <strong>
                    Activities for {assignSchool}
                  </strong>
                  <span>
                    {assignSelectedActivityIds.length} selected
                  </span>
                </div>
                <div className="semester-select-list">
                  {assignableActivities.length === 0 ? (
                    <p className="semester-empty-hint">
                      No activities for this school yet.
                      Create them in Manage Activity first.
                    </p>
                  ) : (
                    assignableActivities.map((activity) => {
                      const checked =
                        assignSelectedActivityIds.includes(
                          activity.id
                        )
                      return (
                        <label
                          key={activity.id}
                          className={`semester-select-row${
                            checked ? ' is-selected' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={assignSaving}
                            onChange={() =>
                              toggleAssignActivityId(activity.id)
                            }
                          />
                          <span className="semester-select-name">
                            {activity.label}
                          </span>
                          <span className="semester-select-meta">
                            Week {activity.week ?? '—'}
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="modal-footer semester-rollover-footer">
                <button
                  type="button"
                  className="activity-secondary-button"
                  disabled={assignSaving}
                  onClick={closeAssignActivity}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="activity-primary-button"
                  disabled={assignSaving}
                >
                  {assignSaving
                    ? 'Assigning...'
                    : 'Assign Activities'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ======================================================
          END SEMESTER CONFIRMATION
      ======================================================= */}

      {showEndConfirm && (

        <div
          className="activity-modal-overlay delete-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeEndConfirm()
            }
          }}
        >

          <div
            className="delete-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="delete-modal-header">

              <div>

                <span className="activity-eyebrow">
                  SEMESTER
                </span>

                <h2>
                  End Semester?
                </h2>

              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeEndConfirm}
              >
                ×
              </button>

            </div>

            <div className="delete-modal-body">

              <p>
                Are you sure you want to
                end the current semester
                {currentSemester?.name
                  ? ` (${currentSemester.name})`
                  : ''}
                ?
              </p>

              <p className="delete-warning-text">
                Student progress for this
                semester will be kept as
                history. You will then set
                up the next semester.
              </p>

            </div>

            <div className="delete-modal-footer">

              <button
                type="button"
                className="activity-secondary-button"
                onClick={closeEndConfirm}
              >
                Cancel
              </button>

              <button
                type="button"
                className="activity-danger-button"
                onClick={continueToNewSemester}
              >
                Continue
              </button>

            </div>

          </div>

        </div>

      )}


      {/* ======================================================
          START NEW SEMESTER MODAL
      ======================================================= */}

      {showNewSemester && (

        <div
          className="activity-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeNewSemester()
            }
          }}
        >

          <div
            className="semester-rollover-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <span className="activity-eyebrow">
                  SEMESTER ROLLOVER
                </span>

                <h2>
                  Start a New Semester
                </h2>

                <p>
                  Name the semester, assign
                  students, and choose the
                  activities they will track.
                </p>

              </div>

              <button
                type="button"
                className="modal-close"
                disabled={savingSemester}
                onClick={closeNewSemester}
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
                  <span>Semester Name</span>
                  <input
                    type="text"
                    value={semesterForm.name}
                    onChange={(event) =>
                      setSemesterForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="e.g. Fall 2026"
                    disabled={savingSemester}
                    required
                  />
                </label>

                <label className="semester-field">
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={semesterForm.startDate}
                    onChange={(event) =>
                      setSemesterForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                    disabled={savingSemester}
                    required
                  />
                </label>

                <label className="semester-field">
                  <span>Expected End Date</span>
                  <input
                    type="date"
                    value={semesterForm.endDate}
                    onChange={(event) =>
                      setSemesterForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                    disabled={savingSemester}
                  />
                </label>

              </div>

              {/* Assign Students */}
              <div className="semester-multi-section">

                <div className="semester-multi-header">
                  <strong>Assign Students</strong>
                  <span>
                    {selectedStudentIds.length} selected
                  </span>
                </div>

                <div className="semester-search-wrap">
                  <span className="semester-search-icon">
                    🔍
                  </span>
                  <input
                    type="search"
                    className="semester-search-input"
                    value={studentSearch}
                    onChange={(event) =>
                      setStudentSearch(event.target.value)
                    }
                    placeholder="Search students..."
                    disabled={savingSemester}
                  />
                </div>

                {selectedStudentIds.length > 0 && (
                  <div className="semester-chip-list">
                    {selectedStudentIds.map((id) => {
                      const student = allStudents.find(
                        (s) => s.id === id
                      )
                      if (!student) return null
                      return (
                        <span
                          key={id}
                          className="semester-chip"
                        >
                          {student.name}
                          <button
                            type="button"
                            disabled={savingSemester}
                            onClick={() =>
                              removeSelectedStudent(id)
                            }
                            aria-label={`Remove ${student.name}`}
                          >
                            ×
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}

                <div className="semester-select-list">
                  {searchableStudents.length === 0 ? (
                    <p className="semester-empty-hint">
                      No students match your search.
                    </p>
                  ) : (
                    searchableStudents.map((student) => {
                      const checked =
                        selectedStudentIds.includes(
                          student.id
                        )
                      return (
                        <label
                          key={student.id}
                          className={`semester-select-row${
                            checked ? ' is-selected' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={savingSemester}
                            onChange={() =>
                              toggleSelectedStudent(
                                student.id
                              )
                            }
                          />
                          <span className="semester-select-name">
                            {student.name}
                          </span>
                          {(student.program ||
                            student.clinic) && (
                            <span className="semester-select-meta">
                              {student.program ||
                                student.clinic}
                            </span>
                          )}
                        </label>
                      )
                    })
                  )}
                </div>

              </div>

              {/* Assign Activities */}
              <div className="semester-multi-section">

                <div className="semester-multi-header">
                  <strong>
                    Add Activities to Students
                  </strong>
                  <span>
                    {selectedActivityIds.length} selected
                  </span>
                </div>

                <div className="semester-search-wrap">
                  <span className="semester-search-icon">
                    🔍
                  </span>
                  <input
                    type="search"
                    className="semester-search-input"
                    value={activitySearch}
                    onChange={(event) =>
                      setActivitySearch(event.target.value)
                    }
                    placeholder="Search activities..."
                    disabled={savingSemester}
                  />
                </div>

                {selectedActivityIds.length > 0 && (
                  <div className="semester-chip-list">
                    {selectedActivityIds.map((id) => {
                      const activity =
                        allRequirements.find(
                          (r) => r.id === id
                        ) ||
                        requirements.find(
                          (r) => r.id === id
                        )
                      if (!activity) return null
                      return (
                        <span
                          key={id}
                          className="semester-chip"
                        >
                          {activity.label}
                          <button
                            type="button"
                            disabled={savingSemester}
                            onClick={() =>
                              removeSelectedActivity(id)
                            }
                            aria-label={`Remove ${activity.label}`}
                          >
                            ×
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}

                <div className="semester-select-list">
                  {searchableActivities.length === 0 ? (
                    <p className="semester-empty-hint">
                      No activities available to copy.
                      You can add activities after starting
                      the semester.
                    </p>
                  ) : (
                    searchableActivities.map((activity) => {
                      const checked =
                        selectedActivityIds.includes(
                          activity.id
                        )
                      return (
                        <label
                          key={activity.id}
                          className={`semester-select-row${
                            checked ? ' is-selected' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={savingSemester}
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
                            {activity.week ?? '—'}
                            {activity.code
                              ? ` · ${activity.code}`
                              : ''}
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>

              </div>

              <label className="semester-field semester-field-full">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={semesterForm.notes}
                  onChange={(event) =>
                    setSemesterForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Optional notes for this rollover (not stored in the database)"
                  disabled={savingSemester}
                />
              </label>

              <div className="modal-footer semester-rollover-footer">

                <button
                  type="button"
                  className="activity-secondary-button"
                  disabled={savingSemester}
                  onClick={closeNewSemester}
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