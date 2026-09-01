import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

/**
 * Single source of truth for a student's activity checklist.
 *
 * IMPORTANT:
 * - A student only sees requirements for their own school.
 * - SHARED requirements are visible to both schools.
 * - Student-specific requirements are always allowed for that student.
 * - Only the active semester plus global requirements are loaded.
 * - Historical student_activity rows are excluded from current progress.
 */
export function useStudentActivity(studentId) {
  const [requirements, setRequirements] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentSchool, setStudentSchool] = useState(null)
  const [activeSemesterId, setActiveSemesterId] = useState(null)

  const load = useCallback(async () => {
    if (!studentId) {
      setRequirements([])
      setActivity([])
      setStudentSchool(null)
      setActiveSemesterId(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      // Load the student's actual school and the active semester first.
      const [studentRes, semesterRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, university')
          .eq('id', studentId)
          .single(),

        supabase
          .from('semesters')
          .select('id')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (studentRes.error) throw studentRes.error
      if (semesterRes.error) throw semesterRes.error

      const school = studentRes.data?.university || null
      const semesterId = semesterRes.data?.id || null

      setStudentSchool(school)
      setActiveSemesterId(semesterId)

      // Load candidate requirements and this student's activity rows.
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

      const filteredRequirements = (reqRes.data || []).filter(
        (requirement) => {
          const isStudentSpecific =
            requirement.student_id === studentId

          // Current view = active semester requirements
          // plus global requirements.
          const belongsToCurrentSemester = semesterId
            ? requirement.semester_id === semesterId ||
              requirement.semester_id == null
            : requirement.semester_id == null

          if (!belongsToCurrentSemester) {
            return false
          }

          // Custom requirement explicitly attached
          // to this student is always valid.
          if (isStudentSpecific) {
            return true
          }

          // Global requirements:
          // - SHARED = both schools
          // - otherwise school must match exactly
          if (requirement.student_id == null) {
            if (requirement.university === 'SHARED') {
              return true
            }

            return (
              Boolean(school) &&
              requirement.university === school
            )
          }

          return false
        }
      )

      const allowedRequirementIds = new Set(
        filteredRequirements.map(
          (requirement) => requirement.id
        )
      )

      // Do not let historical or cross-school rows
      // affect this student's current view.
      const filteredActivity = (actRes.data || []).filter(
        (item) =>
          allowedRequirementIds.has(item.requirement_id)
      )

      setRequirements(filteredRequirements)
      setActivity(filteredActivity)
    } catch (err) {
      console.error(
        'Error loading student activity:',
        err
      )

      setError(
        err.message ||
          'Unable to load student activity.'
      )

      setRequirements([])
      setActivity([])
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    load()
  }, [load])

  const getActivity = useCallback(
    (requirementId) =>
      activity.find(
        (item) =>
          item.requirement_id === requirementId
      ),
    [activity]
  )

  const progress = useMemo(() => {
    const requirementIds = new Set(
      requirements.map((r) => r.id)
    )

    const completed = activity.filter(
      (item) =>
        item.completed &&
        requirementIds.has(item.requirement_id)
    ).length

    const total = requirements.length

    return {
      completed,
      total,
      percentage:
        total > 0
          ? Math.round((completed / total) * 100)
          : 0,
    }
  }, [activity, requirements])

  const requirementsByWeek = useMemo(() => {
    const groups = {}

    requirements.forEach((requirement) => {
      const week = requirement.week ?? 0

      if (!groups[week]) {
        groups[week] = []
      }

      groups[week].push(requirement)
    })

    return Object.entries(groups)
      .sort(
        ([a], [b]) =>
          Number(a) - Number(b)
      )
      .map(([week, items]) => ({
        week: Number(week),
        label:
          Number(week) === 0
            ? 'General'
            : `Week ${week}`,
        items,
      }))
  }, [requirements])

  const weekOptions = useMemo(() => {
    const weeks = new Set(
      requirements.map((r) =>
        Number(r.week ?? 0)
      )
    )

    weeks.add(0)

    return Array.from(weeks).sort(
      (a, b) => a - b
    )
  }, [requirements])

  async function toggleRequirement(requirementId) {
    const allowed = requirements.some(
      (r) => r.id === requirementId
    )

    if (!allowed) {
      setError(
        'This activity is not available for this student.'
      )
      return
    }

    const existing =
      getActivity(requirementId)

    const currentCompleted =
      existing?.completed || false

    setError('')

    if (existing) {
      const { error: updateError } =
        await supabase
          .from('student_activity')
          .update({
            completed: !currentCompleted,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', existing.id)

      if (updateError) {
        console.error(
          'Error updating activity:',
          updateError
        )

        setError(updateError.message)
        return
      }

      setActivity((current) =>
        current.map((item) =>
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
          student_id: studentId,
          requirement_id: requirementId,
          completed: true,
        })
        .select()
        .single()

      if (insertError) {
        console.error(
          'Error creating activity:',
          insertError
        )

        setError(insertError.message)
        return
      }

      setActivity((current) => [
        ...current,
        data,
      ])
    }
  }

  async function updateNote(
    requirementId,
    note
  ) {
    const allowed = requirements.some(
      (r) => r.id === requirementId
    )

    if (!allowed) {
      setError(
        'This activity is not available for this student.'
      )
      return
    }

    const existing =
      getActivity(requirementId)

    setError('')

    if (existing) {
      const { error: updateError } =
        await supabase
          .from('student_activity')
          .update({
            note,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', existing.id)

      if (updateError) {
        console.error(
          'Error saving activity note:',
          updateError
        )

        setError(updateError.message)
        return
      }

      setActivity((current) =>
        current.map((item) =>
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
          student_id: studentId,
          requirement_id: requirementId,
          completed: false,
          note,
        })
        .select()
        .single()

      if (insertError) {
        console.error(
          'Error creating activity note:',
          insertError
        )

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
    if (!label.trim()) {
      return
    }

    setError('')

    const maxSortOrder =
      requirements.reduce(
        (max, r) =>
          Math.max(
            max,
            r.sort_order ?? 0
          ),
        0
      )

    const payload = {
      label: label.trim(),
      week: Number(week),
      student_id: studentId,
      university: studentSchool,
      sort_order: maxSortOrder + 1,
    }

    if (activeSemesterId) {
      payload.semester_id =
        activeSemesterId
    }

    const {
      data,
      error: insertError,
    } = await supabase
      .from('activity_requirements')
      .insert(payload)
      .select()
      .single()

    if (insertError) {
      console.error(
        'Error adding custom activity:',
        insertError
      )

      setError(insertError.message)
      return
    }

    setRequirements((current) => [
      ...current,
      data,
    ])
  }

  async function deleteActivity(
    requirement
  ) {
    setError('')

    // Only student-specific activities should
    // be deleted from the student modal.
    if (
      requirement.student_id !== studentId
    ) {
      setError(
        'School-wide activities cannot be deleted from a student record.'
      )
      return
    }

    await supabase
      .from('student_activity')
      .delete()
      .eq(
        'requirement_id',
        requirement.id
      )
      .eq('student_id', studentId)

    const { error: deleteError } =
      await supabase
        .from('activity_requirements')
        .delete()
        .eq('id', requirement.id)
        .eq('student_id', studentId)

    if (deleteError) {
      console.error(
        'Error deleting custom activity:',
        deleteError
      )

      setError(deleteError.message)
      return
    }

    setRequirements((current) =>
      current.filter(
        (r) => r.id !== requirement.id
      )
    )

    setActivity((current) =>
      current.filter(
        (item) =>
          item.requirement_id !==
          requirement.id
      )
    )
  }

  return {
    requirements,
    activity,
    loading,
    error,
    progress,
    requirementsByWeek,
    weekOptions,
    getActivity,
    toggleRequirement,
    updateNote,
    addActivity,
    deleteActivity,
    refresh: load,
  }
}