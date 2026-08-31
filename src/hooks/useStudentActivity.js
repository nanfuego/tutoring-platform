import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

/**
 * Single source of truth for a student's activity checklist:
 * loading, progress math, and every mutation (toggle, note, add, delete).
 *
 * Used by both StudentActivityModal (list view) and StudentDetail (inline
 * panel) so a fix here fixes both UIs instead of drifting independently.
 */
export function useStudentActivity(studentId) {
  const [requirements, setRequirements] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!studentId) return

    setLoading(true)
    setError('')

    const [reqRes, actRes] = await Promise.all([
      supabase
        .from('activity_requirements')
        .select('*')
        .or(`student_id.is.null,student_id.eq.${studentId}`)
        .order('sort_order'),
      supabase
        .from('student_activity')
        .select('*')
        .eq('student_id', studentId),
    ])

    if (reqRes.error) {
      console.error('Error loading activity requirements:', reqRes.error)
      setError(reqRes.error.message)
    } else if (actRes.error) {
      console.error('Error loading student activity:', actRes.error)
      setError(actRes.error.message)
    }

    setRequirements(reqRes.data || [])
    setActivity(actRes.data || [])
    setLoading(false)
  }, [studentId])

  useEffect(() => {
    load()
  }, [load])

  const getActivity = useCallback(
    (requirementId) =>
      activity.find((item) => item.requirement_id === requirementId),
    [activity],
  )

  const progress = useMemo(() => {
    const completed = activity.filter((item) => item.completed).length
    const total = requirements.length
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }, [activity, requirements])

  const requirementsByWeek = useMemo(() => {
    const groups = {}

    requirements.forEach((requirement) => {
      const week = requirement.week ?? 0
      if (!groups[week]) groups[week] = []
      groups[week].push(requirement)
    })

    return Object.entries(groups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([week, items]) => ({
        week: Number(week),
        label: Number(week) === 0 ? 'General' : `Week ${week}`,
        items,
      }))
  }, [requirements])

  // Weeks already in use, so an "add activity" form can offer them
  // alongside "General" instead of forcing a brand new group every time.
  const weekOptions = useMemo(() => {
    const weeks = new Set(requirements.map((r) => Number(r.week ?? 0)))
    weeks.add(0)
    return Array.from(weeks).sort((a, b) => a - b)
  }, [requirements])

  async function toggleRequirement(requirementId) {
    const existing = getActivity(requirementId)
    const currentCompleted = existing?.completed || false

    setError('')

    if (existing) {
      const { error: updateError } = await supabase
        .from('student_activity')
        .update({
          completed: !currentCompleted,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Error updating activity:', updateError)
        setError(updateError.message)
        return
      }

      setActivity((current) =>
        current.map((item) =>
          item.id === existing.id
            ? { ...item, completed: !currentCompleted }
            : item,
        ),
      )
    } else {
      const { data, error: insertError } = await supabase
        .from('student_activity')
        .insert({
          student_id: studentId,
          requirement_id: requirementId,
          completed: true,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating activity:', insertError)
        setError(insertError.message)
        return
      }

      setActivity((current) => [...current, data])
    }
  }

  async function updateNote(requirementId, note) {
    const existing = getActivity(requirementId)
    setError('')

    if (existing) {
      const { error: updateError } = await supabase
        .from('student_activity')
        .update({ note, updated_at: new Date().toISOString() })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Error saving activity note:', updateError)
        setError(updateError.message)
        return
      }

      setActivity((current) =>
        current.map((item) =>
          item.id === existing.id ? { ...item, note } : item,
        ),
      )
    } else if (note.trim()) {
      const { data, error: insertError } = await supabase
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
        console.error('Error creating activity note:', insertError)
        setError(insertError.message)
        return
      }

      setActivity((current) => [...current, data])
    }
  }

  async function addActivity(label, week) {
    if (!label.trim()) return

    setError('')

    const maxSortOrder = requirements.reduce(
      (max, r) => Math.max(max, r.sort_order ?? 0),
      0,
    )

    const { data, error: insertError } = await supabase
      .from('activity_requirements')
      .insert({
        label: label.trim(),
        week: Number(week),
        student_id: studentId,
        sort_order: maxSortOrder + 1,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error adding custom activity:', insertError)
      setError(insertError.message)
      return
    }

    setRequirements((current) => [...current, data])
  }

  async function deleteActivity(requirement) {
    setError('')

    // Clear any saved progress for this item first in case the DB
    // foreign key isn't set to cascade on delete.
    await supabase
      .from('student_activity')
      .delete()
      .eq('requirement_id', requirement.id)
      .eq('student_id', studentId)

    const { error: deleteError } = await supabase
      .from('activity_requirements')
      .delete()
      .eq('id', requirement.id)

    if (deleteError) {
      console.error('Error deleting custom activity:', deleteError)
      setError(deleteError.message)
      return
    }

    setRequirements((current) => current.filter((r) => r.id !== requirement.id))
    setActivity((current) =>
      current.filter((item) => item.requirement_id !== requirement.id),
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
