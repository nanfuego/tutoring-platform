import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

const LEGACY_SUBJECT_ID = '__legacy__'
const FALLBACK_SUBJECT_ID = '__current__'

function groupByWeek(requirements) {
  const groups = {}

  requirements.forEach((requirement) => {
    const week = Number(requirement.week ?? 0)

    if (!groups[week]) {
      groups[week] = []
    }

    groups[week].push(requirement)
  })

  return Object.entries(groups)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([week, items]) => ({
      week: Number(week),
      label: Number(week) === 0 ? 'General' : `Week ${week}`,
      items: items
        .slice()
        .sort(
          (a, b) =>
            Number(a.sort_order ?? 0) -
            Number(b.sort_order ?? 0)
        ),
    }))
}

export function useStudentActivity(studentId) {
  const [student, setStudent] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [allRequirements, setAllRequirements] = useState([])
  const [activity, setActivity] = useState([])
  const [selectedSubjectId, setSelectedSubjectId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSemesterId, setActiveSemesterId] = useState(null)

  const load = useCallback(async () => {
    if (!studentId) {
      setStudent(null)
      setSubjects([])
      setAllRequirements([])
      setActivity([])
      setSelectedSubjectId(null)
      setActiveSemesterId(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [studentRes, semesterRes, assignmentRes] =
        await Promise.all([
          supabase
            .from('students')
            .select('id, name, university, program, subject')
            .eq('id', studentId)
            .single(),

          supabase
            .from('semesters')
            .select('id')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from('student_subjects')
            .select('subject_id, active')
            .eq('student_id', studentId),
        ])

      if (studentRes.error) throw studentRes.error
      if (semesterRes.error) throw semesterRes.error
      if (assignmentRes.error) {
        throw new Error(
          `Subject assignments could not be loaded: ${assignmentRes.error.message}`
        )
      }

      const studentRow = studentRes.data
      const school = studentRow?.university || null
      const semesterId = semesterRes.data?.id || null

      const subjectIds = (assignmentRes.data || [])
        .filter((row) => row.active !== false)
        .map((row) => row.subject_id)

      let subjectRows = []

      if (subjectIds.length > 0) {
        const { data, error: subjectError } = await supabase
          .from('subjects')
          .select('*')
          .in('id', subjectIds)
          .order('name', { ascending: true })

        if (subjectError) throw subjectError
        subjectRows = data || []
      }

      const [reqRes, actRes] = await Promise.all([
        supabase
          .from('activity_requirements')
          .select('*')
          .or(`student_id.is.null,student_id.eq.${studentId}`)
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
          .select('*')
          .eq('student_id', studentId),
      ])

      if (reqRes.error) throw reqRes.error
      if (actRes.error) throw actRes.error

      const assignedSubjectSet = new Set(subjectIds)

      const eligibleRequirements = (reqRes.data || []).filter(
        (requirement) => {
          const isStudentSpecific =
            requirement.student_id === studentId

          const belongsToCurrentSemester = semesterId
            ? requirement.semester_id === semesterId ||
              requirement.semester_id == null
            : requirement.semester_id == null

          if (!belongsToCurrentSemester) {
            return false
          }

          if (
            requirement.student_id != null &&
            !isStudentSpecific
          ) {
            return false
          }

          // Subject-linked activities require that assignment.
          if (
            requirement.subject_id != null &&
            !assignedSubjectSet.has(requirement.subject_id) &&
            !isStudentSpecific
          ) {
            return false
          }

          if (isStudentSpecific) {
            return true
          }

          if (requirement.university === 'SHARED') {
            return true
          }

          return (
            Boolean(school) &&
            requirement.university === school
          )
        }
      )

      const legacyRequirements = eligibleRequirements.filter(
        (requirement) => requirement.subject_id == null
      )

      const normalizedSubjects = subjectRows.map((subject) => ({
        ...subject,
        id: subject.id,
        legacy: false,
      }))

      // Compatibility behavior:
      // - One assigned subject: legacy activities temporarily count under it.
      // - Multiple assigned subjects: legacy activities are shown separately
      //   because we cannot safely guess which subject owns them.
      // - No normalized assignment: use the old students.subject text.
      if (
        normalizedSubjects.length > 1 &&
        legacyRequirements.length > 0
      ) {
        normalizedSubjects.push({
          id: LEGACY_SUBJECT_ID,
          name: 'Legacy / Unassigned',
          university: school,
          legacy: true,
        })
      } else if (normalizedSubjects.length === 0) {
        if (studentRow?.subject) {
          normalizedSubjects.push({
            id: FALLBACK_SUBJECT_ID,
            name: studentRow.subject,
            university: school,
            legacy: true,
            fallback: true,
          })
        } else if (legacyRequirements.length > 0) {
          normalizedSubjects.push({
            id: LEGACY_SUBJECT_ID,
            name: 'General Activities',
            university: school,
            legacy: true,
          })
        }
      }

      setStudent(studentRow)
      setSubjects(normalizedSubjects)
      setAllRequirements(eligibleRequirements)
      setActivity(actRes.data || [])
      setActiveSemesterId(semesterId)

      setSelectedSubjectId((current) => {
        if (
          current != null &&
          normalizedSubjects.some(
            (subject) =>
              String(subject.id) === String(current)
          )
        ) {
          return current
        }

        return normalizedSubjects[0]?.id ?? null
      })
    } catch (err) {
      console.error('Error loading student activity:', err)

      setError(
        err.message || 'Unable to load student activity.'
      )

      setStudent(null)
      setSubjects([])
      setAllRequirements([])
      setActivity([])
      setSelectedSubjectId(null)
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    load()
  }, [load])

  const realSubjectCount = useMemo(
    () =>
      subjects.filter(
        (subject) =>
          subject.id !== LEGACY_SUBJECT_ID &&
          subject.id !== FALLBACK_SUBJECT_ID
      ).length,
    [subjects]
  )

  function requirementsForSubject(subjectId) {
    if (subjectId == null) return []

    const isLegacy =
      subjectId === LEGACY_SUBJECT_ID ||
      subjectId === FALLBACK_SUBJECT_ID

    if (isLegacy) {
      return allRequirements.filter(
        (requirement) =>
          requirement.subject_id == null
      )
    }

    return allRequirements.filter((requirement) => {
      if (
        String(requirement.subject_id) ===
        String(subjectId)
      ) {
        return true
      }

      // Migration compatibility: when a student currently has only one
      // normalized subject, unassigned legacy activities are temporarily
      // included in that subject until the admin moves them.
      return (
        realSubjectCount === 1 &&
        requirement.subject_id == null
      )
    })
  }

  const requirements = useMemo(
    () => requirementsForSubject(selectedSubjectId),
    [
      allRequirements,
      selectedSubjectId,
      realSubjectCount,
    ]
  )

  const selectedSubject = useMemo(
    () =>
      subjects.find(
        (subject) =>
          String(subject.id) ===
          String(selectedSubjectId)
      ) || null,
    [subjects, selectedSubjectId]
  )

  const getActivity = useCallback(
    (requirementId) =>
      activity.find(
        (item) =>
          item.requirement_id === requirementId
      ),
    [activity]
  )

  function buildProgress(requirementsForProgress) {
    const ids = new Set(
      requirementsForProgress.map(
        (requirement) => requirement.id
      )
    )

    const completed = activity.filter(
      (item) =>
        item.completed === true &&
        ids.has(item.requirement_id)
    ).length

    const total = requirementsForProgress.length

    return {
      completed,
      total,
      percentage:
        total > 0
          ? Math.round((completed / total) * 100)
          : 0,
    }
  }

  const progress = useMemo(
    () => buildProgress(requirements),
    [requirements, activity]
  )

  const subjectProgress = useMemo(
    () =>
      subjects.map((subject) => {
        const subjectRequirements =
          requirementsForSubject(subject.id)

        return {
          ...subject,
          progress: buildProgress(subjectRequirements),
          requirementCount: subjectRequirements.length,
        }
      }),
    [
      subjects,
      allRequirements,
      activity,
      realSubjectCount,
    ]
  )

  const requirementsByWeek = useMemo(
    () => groupByWeek(requirements),
    [requirements]
  )

  const weekOptions = useMemo(() => {
    const weeks = new Set(
      requirements.map((requirement) =>
        Number(requirement.week ?? 0)
      )
    )

    weeks.add(0)

    return Array.from(weeks).sort(
      (a, b) => a - b
    )
  }, [requirements])

  const currentActivity = useMemo(() => {
    if (!requirements.length) return null

    return (
      requirements.find((requirement) => {
        const item = getActivity(requirement.id)
        return item?.completed !== true
      }) || null
    )
  }, [requirements, getActivity])

  async function toggleRequirement(requirementId) {
    const allowed = requirements.some(
      (requirement) =>
        requirement.id === requirementId
    )

    if (!allowed) {
      setError(
        'This activity is not available in the selected subject.'
      )
      return
    }

    const existing = getActivity(requirementId)
    const currentCompleted =
      existing?.completed || false

    setError('')

    if (existing) {
      const { data, error: updateError } =
        await supabase
          .from('student_activity')
          .update({
            completed: !currentCompleted,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single()

      if (updateError) {
        setError(updateError.message)
        return
      }

      setActivity((current) =>
        current.map((item) =>
          item.id === existing.id ? data : item
        )
      )
    } else {
      const { data, error: insertError } =
        await supabase
          .from('student_activity')
          .insert({
            student_id: studentId,
            requirement_id: requirementId,
            completed: true,
          })
          .select()
          .single()

      if (insertError) {
        setError(insertError.message)
        return
      }

      setActivity((current) => [
        ...current,
        data,
      ])
    }
  }

  async function updateNote(requirementId, note) {
    const allowed = requirements.some(
      (requirement) =>
        requirement.id === requirementId
    )

    if (!allowed) {
      setError(
        'This activity is not available in the selected subject.'
      )
      return
    }

    const existing = getActivity(requirementId)

    setError('')

    if (existing) {
      const { data, error: updateError } =
        await supabase
          .from('student_activity')
          .update({
            note,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single()

      if (updateError) {
        setError(updateError.message)
        return
      }

      setActivity((current) =>
        current.map((item) =>
          item.id === existing.id ? data : item
        )
      )
    } else if (note.trim()) {
      const { data, error: insertError } =
        await supabase
          .from('student_activity')
          .insert({
            student_id: studentId,
            requirement_id: requirementId,
            completed: false,
            note,
          })
          .select()
          .single()

      if (insertError) {
        setError(insertError.message)
        return
      }

      setActivity((current) => [
        ...current,
        data,
      ])
    }
  }

  async function addActivity(label, week) {
    if (!label.trim()) return

    setError('')

    const maxSortOrder = allRequirements.reduce(
      (max, requirement) =>
        Math.max(
          max,
          Number(requirement.sort_order ?? 0)
        ),
      0
    )

    const selectedIsRealSubject =
      selectedSubjectId != null &&
      selectedSubjectId !== LEGACY_SUBJECT_ID &&
      selectedSubjectId !== FALLBACK_SUBJECT_ID

    const payload = {
      label: label.trim(),
      week: Number(week),
      student_id: studentId,
      university: student?.university || null,
      subject_id: selectedIsRealSubject
        ? selectedSubjectId
        : null,
      sort_order: maxSortOrder + 1,
    }

    if (activeSemesterId) {
      payload.semester_id = activeSemesterId
    }

    const { data, error: insertError } =
      await supabase
        .from('activity_requirements')
        .insert(payload)
        .select()
        .single()

    if (insertError) {
      setError(insertError.message)
      return
    }

    setAllRequirements((current) => [
      ...current,
      data,
    ])
  }

  async function deleteActivity(requirement) {
    setError('')

    if (requirement.student_id !== studentId) {
      setError(
        'Subject repository activities cannot be deleted from a student record.'
      )
      return
    }

    await supabase
      .from('student_activity')
      .delete()
      .eq('requirement_id', requirement.id)
      .eq('student_id', studentId)

    const { error: deleteError } =
      await supabase
        .from('activity_requirements')
        .delete()
        .eq('id', requirement.id)
        .eq('student_id', studentId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setAllRequirements((current) =>
      current.filter(
        (item) => item.id !== requirement.id
      )
    )

    setActivity((current) =>
      current.filter(
        (item) =>
          item.requirement_id !== requirement.id
      )
    )
  }


  async function saveProgressChanges(changes) {
    if (!changes || typeof changes !== 'object') {
      return { saved: 0 }
    }

    const entries = Object.entries(changes).filter(
      ([requirementId]) =>
        requirements.some(
          (requirement) =>
            String(requirement.id) === String(requirementId)
        )
    )

    if (entries.length === 0) {
      return { saved: 0 }
    }

    setError('')

    try {
      let saved = 0
      const nextActivity = [...activity]

      for (const [requirementId, completed] of entries) {
        const requirement = requirements.find(
          (item) =>
            String(item.id) === String(requirementId)
        )

        if (!requirement) continue

        const existing = nextActivity.find(
          (item) =>
            item.requirement_id === requirement.id
        )

        if (existing) {
          if (
            Boolean(existing.completed) ===
            Boolean(completed)
          ) {
            continue
          }

          const { data, error: updateError } =
            await supabase
              .from('student_activity')
              .update({
                completed: Boolean(completed),
                updated_at:
                  new Date().toISOString(),
              })
              .eq('id', existing.id)
              .select()
              .single()

          if (updateError) throw updateError

          const index = nextActivity.findIndex(
            (item) => item.id === existing.id
          )

          if (index >= 0) {
            nextActivity[index] = data
          }

          saved += 1
          continue
        }

        // No existing row and draft is unchecked:
        // there is nothing to persist.
        if (!completed) continue

        const { data, error: insertError } =
          await supabase
            .from('student_activity')
            .insert({
              student_id: studentId,
              requirement_id: requirement.id,
              completed: true,
            })
            .select()
            .single()

        if (insertError) throw insertError

        nextActivity.push(data)
        saved += 1
      }

      setActivity(nextActivity)

      return { saved }
    } catch (err) {
      console.error(
        'Error saving progress changes:',
        err
      )

      setError(
        err.message ||
          'Unable to save progress changes.'
      )

      throw err
    }
  }


  return {
    student,
    subjects,
    selectedSubject,
    selectedSubjectId,
    setSelectedSubjectId,
    subjectProgress,

    requirements,
    allRequirements,
    activity,
    loading,
    error,
    progress,
    currentActivity,
    requirementsByWeek,
    weekOptions,

    getActivity,
    toggleRequirement,
    saveProgressChanges,
    updateNote,
    addActivity,
    deleteActivity,
    refresh: load,
  }
}
