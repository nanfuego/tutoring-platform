import { useEffect, useMemo, useState } from 'react'
import { useStudentActivity } from '../hooks/useStudentActivity'
import './StudentActivityModal.css'

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase()
}

function CircularProgress({
  percentage = 0,
  size = 110,
  stroke = 10,
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const normalized = Math.min(
    100,
    Math.max(0, percentage)
  )
  const offset =
    circumference -
    (normalized / 100) * circumference

  return (
    <div
      className="sa-gauge"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="sa-gauge-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className="sa-gauge-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${
            size / 2
          })`}
        />
      </svg>

      <div className="sa-gauge-label">
        <strong>{normalized}%</strong>
        <span>Completion</span>
      </div>
    </div>
  )
}

function StudentActivityModal({
  student,
  onClose,
}) {
  const {
    subjects,
    selectedSubject,
    selectedSubjectId,
    setSelectedSubjectId,
    subjectProgress,
    requirements,
    loading,
    error,
    progress,
    currentActivity,
    requirementsByWeek,
    getActivity,
    toggleRequirement,
    updateNote,
    deleteActivity,
  } = useStudentActivity(student?.id)

  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [viewFilter, setViewFilter] = useState('all')
  const [expandedWeeks, setExpandedWeeks] =
    useState(() => new Set())

  // Changing subject resets the view to that subject's current week.
  useEffect(() => {
    setExpandedWeeks(new Set())
    setViewFilter('all')
  }, [selectedSubjectId])

  const weekStatuses = useMemo(() => {
    const map = {}

    requirementsByWeek.forEach((group) => {
      const completed = group.items.filter(
        (requirement) =>
          getActivity(requirement.id)?.completed
      ).length

      map[group.week] = {
        total: group.items.length,
        completed,
        allDone:
          group.items.length > 0 &&
          completed === group.items.length,
        hasAny: completed > 0,
      }
    })

    return map
  }, [requirementsByWeek, getActivity])

  useEffect(() => {
    if (!requirementsByWeek.length) return

    setExpandedWeeks((previous) => {
      if (previous.size > 0) {
        return previous
      }

      const firstOpen =
        requirementsByWeek.find(
          (group) =>
            !weekStatuses[group.week]?.allDone
        ) || requirementsByWeek[0]

      return new Set([firstOpen.week])
    })
  }, [requirementsByWeek, weekStatuses])

  const currentWeek = useMemo(() => {
    const open =
      requirementsByWeek.find(
        (group) =>
          !weekStatuses[group.week]?.allDone
      )

    return (
      open?.week ??
      requirementsByWeek[
        requirementsByWeek.length - 1
      ]?.week ??
      0
    )
  }, [requirementsByWeek, weekStatuses])

  const timelineWeeks = useMemo(() => {
    const weeks = requirementsByWeek
      .map((group) => group.week)
      .filter((week) => week > 0)
      .sort((a, b) => a - b)

    return weeks.length
      ? weeks
      : [1, 2, 3, 4, 5, 6, 7, 8]
  }, [requirementsByWeek])

  const noteCount = useMemo(
    () =>
      requirements.reduce(
        (count, requirement) => {
          const note =
            getActivity(requirement.id)?.note

          return (
            count +
            (note && note.trim() ? 1 : 0)
          )
        },
        0
      ),
    [requirements, getActivity]
  )

  const paceLabel = useMemo(() => {
    if (!progress.total) return '—'
    if (progress.percentage >= 75) {
      return 'On Track'
    }
    if (progress.percentage >= 40) {
      return 'Needs Attention'
    }
    return 'Behind'
  }, [progress])

  function filterItems(items) {
    if (viewFilter === 'completed') {
      return items.filter(
        (requirement) =>
          getActivity(requirement.id)?.completed
      )
    }

    if (viewFilter === 'todo') {
      return items.filter(
        (requirement) =>
          !getActivity(requirement.id)?.completed
      )
    }

    return items
  }

  async function handleToggle(requirementId) {
    setSavingId(requirementId)
    await toggleRequirement(requirementId)
    setSavingId(null)
  }

  async function handleDelete(requirement) {
    const confirmed = window.confirm(
      `Remove "${requirement.label}" for ${student.name}?`
    )

    if (!confirmed) return

    setDeletingId(requirement.id)
    await deleteActivity(requirement)
    setDeletingId(null)
  }

  function toggleWeek(week) {
    setExpandedWeeks((previous) => {
      const next = new Set(previous)

      if (next.has(week)) {
        next.delete(week)
      } else {
        next.add(week)
      }

      return next
    })
  }

  const assignedSubjectSummary = useMemo(() => {
    if (!subjects.length) {
      return 'No subject assigned'
    }

    return subjects
      .map((subject) => subject.name)
      .join(', ')
  }, [subjects])

  return (
    <div
      className="sa-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="sa-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sa-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header className="sa-header">
          <div className="sa-identity">
            <div className="sa-avatar">
              {getInitials(student?.name)}
            </div>

            <div className="sa-identity-text">
              <h2 id="sa-title">
                {student?.name || 'Student'}
              </h2>

              <p>
                {[
                  student?.program,
                  student?.university,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Student Activity'}
              </p>
            </div>

            <div className="sa-subject-control">
              <span className="sa-subject-label">
                SUBJECT
              </span>

              {subjects.length > 1 ? (
                <select
                  className="sa-subject-select"
                  value={
                    selectedSubjectId ?? ''
                  }
                  onChange={(event) =>
                    setSelectedSubjectId(
                      event.target.value
                    )
                  }
                >
                  {subjects.map((subject) => (
                    <option
                      key={subject.id}
                      value={subject.id}
                    >
                      {subject.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="sa-subject-single">
                  <strong>
                    {selectedSubject?.name ||
                      student?.subject ||
                      'No subject assigned'}
                  </strong>
                  <span>
                    Current subject
                  </span>
                </div>
              )}
            </div>

            {subjects.length > 1 && (
              <div className="sa-subject-overview">
                <span>
                  Assigned subjects
                </span>
                <strong>
                  {assignedSubjectSummary}
                </strong>
              </div>
            )}

            <span className="sa-status-pill">
              <span className="sa-status-dot" />
              Active
            </span>
          </div>

          <div className="sa-progress-panel">
            <div className="sa-progress-panel-top">
              <div>
                <span className="sa-progress-kicker">
                  {selectedSubject?.name ||
                    'Subject'}
                </span>
                <h3>
                  Progress &amp; Timeline
                </h3>
              </div>

              <button
                type="button"
                className="sa-close"
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {subjects.length > 1 && (
              <div className="sa-subject-progress-strip">
                {subjectProgress.map(
                  (subject) => (
                    <button
                      key={subject.id}
                      type="button"
                      className={
                        String(
                          selectedSubjectId
                        ) ===
                        String(subject.id)
                          ? 'sa-subject-progress-card is-active'
                          : 'sa-subject-progress-card'
                      }
                      onClick={() =>
                        setSelectedSubjectId(
                          subject.id
                        )
                      }
                    >
                      <span>
                        {subject.name}
                      </span>
                      <strong>
                        {
                          subject.progress
                            .percentage
                        }
                        %
                      </strong>
                      <small>
                        {
                          subject.progress
                            .completed
                        }
                        /
                        {
                          subject.progress
                            .total
                        }
                      </small>
                    </button>
                  )
                )}
              </div>
            )}

            <div
              className="sa-timeline"
              role="list"
            >
              {timelineWeeks.map(
                (week, index) => {
                  const status =
                    weekStatuses[week] || {
                      allDone: false,
                      hasAny: false,
                    }

                  const isCurrent =
                    week === currentWeek

                  return (
                    <div
                      key={week}
                      role="listitem"
                      className={[
                        'sa-timeline-step',
                        status.allDone
                          ? 'is-done'
                          : '',
                        isCurrent
                          ? 'is-current'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="sa-timeline-node">
                        {status.allDone
                          ? '✓'
                          : ''}
                      </div>

                      <span className="sa-timeline-label">
                        Week {week}
                      </span>

                      {index <
                        timelineWeeks.length -
                          1 && (
                        <span className="sa-timeline-connector" />
                      )}
                    </div>
                  )
                }
              )}
            </div>

            <div className="sa-gauge-row">
              <CircularProgress
                percentage={
                  progress.percentage
                }
              />

              <div className="sa-gauge-meta">
                <div className="sa-meta-card">
                  <span className="sa-meta-dot" />
                  <div>
                    <strong>
                      {selectedSubject?.name ||
                        'Subject'}{' '}
                      Completion
                    </strong>
                    <span>
                      {progress.completed}/
                      {progress.total}{' '}
                      activities
                    </span>
                  </div>
                </div>

                <div className="sa-meta-card">
                  <span className="sa-meta-dot muted" />
                  <div>
                    <strong>
                      Current Activity
                    </strong>
                    <span>
                      {currentActivity?.label ||
                        (progress.total
                          ? 'All complete'
                          : 'No activities')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="sa-insights">
              <span className="sa-insights-label">
                Quick Insights
              </span>

              <div className="sa-insight-chips">
                <div className="sa-chip">
                  Current Pace:{' '}
                  <strong>
                    {paceLabel}
                  </strong>
                </div>

                <div className="sa-chip">
                  Current Week:{' '}
                  <strong>
                    {currentWeek
                      ? `Week ${currentWeek}`
                      : '—'}
                  </strong>
                </div>

                <div className="sa-chip">
                  Notes:{' '}
                  <strong>
                    {noteCount}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="sa-error">
            {error}
          </div>
        )}

        <div className="sa-body">
          <div className="sa-section-bar">
            <div>
              <span className="sa-section-title">
                Activity by Week
              </span>
              <p className="sa-section-subtitle">
                {selectedSubject?.name ||
                  student?.subject ||
                  'Selected subject'}
              </p>
            </div>

            <div className="sa-filter-tabs">
              {[
                ['all', 'View All'],
                ['todo', 'To Do'],
                ['completed', 'Completed'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={
                    viewFilter === id
                      ? 'sa-filter-tab is-active'
                      : 'sa-filter-tab'
                  }
                  onClick={() =>
                    setViewFilter(id)
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="sa-empty">
              Loading checklist…
            </div>
          ) : subjects.length === 0 ? (
            <div className="sa-empty">
              <strong>
                No subject assigned
              </strong>
              <span>
                Assign a subject from Activity
                Management first.
              </span>
            </div>
          ) : requirements.length === 0 ? (
            <div className="sa-empty">
              <strong>
                No activities for{' '}
                {selectedSubject?.name ||
                  'this subject'}
              </strong>
              <span>
                Add activities to this subject
                in Activity Management.
              </span>
            </div>
          ) : (
            <div className="sa-week-list">
              {requirementsByWeek.map(
                (group) => {
                  const status =
                    weekStatuses[group.week] || {
                      total: 0,
                      completed: 0,
                      allDone: false,
                    }

                  const isExpanded =
                    expandedWeeks.has(
                      group.week
                    )

                  const visibleItems =
                    filterItems(group.items)

                  return (
                    <section
                      key={group.week}
                      className={[
                        'sa-week',
                        isExpanded
                          ? 'is-open'
                          : '',
                        status.allDone
                          ? 'is-complete'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <button
                        type="button"
                        className="sa-week-header"
                        onClick={() =>
                          toggleWeek(group.week)
                        }
                      >
                        <span className="sa-week-check">
                          {status.allDone
                            ? '✓'
                            : ''}
                        </span>

                        <span className="sa-week-title">
                          {group.label}
                        </span>

                        <span className="sa-week-summary">
                          {status.completed} of{' '}
                          {status.total} completed
                        </span>

                        <span className="sa-week-chevron">
                          {isExpanded
                            ? '▴'
                            : '▾'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="sa-week-body">
                          {visibleItems.length ===
                          0 ? (
                            <div className="sa-week-empty">
                              No activities in
                              this filter.
                            </div>
                          ) : (
                            visibleItems.map(
                              (requirement) => {
                                const item =
                                  getActivity(
                                    requirement.id
                                  )

                                const completed =
                                  Boolean(
                                    item?.completed
                                  )

                                return (
                                  <div
                                    key={
                                      requirement.id
                                    }
                                    className={
                                      completed
                                        ? 'sa-activity-row is-complete'
                                        : 'sa-activity-row'
                                    }
                                  >
                                    <button
                                      type="button"
                                      className="sa-activity-check"
                                      disabled={
                                        savingId ===
                                        requirement.id
                                      }
                                      onClick={() =>
                                        handleToggle(
                                          requirement.id
                                        )
                                      }
                                      aria-label={
                                        completed
                                          ? 'Mark incomplete'
                                          : 'Mark complete'
                                      }
                                    >
                                      {completed
                                        ? '✓'
                                        : ''}
                                    </button>

                                    <div className="sa-activity-main">
                                      <strong>
                                        {
                                          requirement.label
                                        }
                                      </strong>

                                      <span>
                                        {requirement.code ||
                                          selectedSubject?.name ||
                                          'Activity'}
                                      </span>
                                    </div>

                                    <input
                                      className="sa-note-input"
                                      type="text"
                                      defaultValue={
                                        item?.note ||
                                        ''
                                      }
                                      placeholder="Note..."
                                      onBlur={(
                                        event
                                      ) => {
                                        if (
                                          event.target
                                            .value !==
                                          (item?.note ||
                                            '')
                                        ) {
                                          updateNote(
                                            requirement.id,
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                      }}
                                    />

                                    {requirement.student_id ===
                                      student?.id && (
                                      <button
                                        type="button"
                                        className="sa-delete-activity"
                                        disabled={
                                          deletingId ===
                                          requirement.id
                                        }
                                        onClick={() =>
                                          handleDelete(
                                            requirement
                                          )
                                        }
                                      >
                                        {deletingId ===
                                        requirement.id
                                          ? 'Removing...'
                                          : 'Remove'}
                                      </button>
                                    )}
                                  </div>
                                )
                              }
                            )
                          )}
                        </div>
                      )}
                    </section>
                  )
                }
              )}
            </div>
          )}
        </div>

        <footer className="sa-footer">
          <span>
            {selectedSubject?.name
              ? `${selectedSubject.name} progress`
              : 'Student progress'}
          </span>

          <button
            type="button"
            className="sa-done-button"
            onClick={onClose}
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}

export default StudentActivityModal
