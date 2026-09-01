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
  size = 112,
  stroke = 10,
}) {
  const radius = (size - stroke) / 2
  const circumference =
    2 * Math.PI * radius

  const offset =
    circumference -
    (Math.min(
      100,
      Math.max(0, percentage)
    ) /
      100) *
      circumference

  return (
    <div
      className="sa-gauge"
      style={{
        width: size,
        height: size,
      }}
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
        <strong>{percentage}%</strong>
        <span>
          Overall Completion
        </span>
      </div>
    </div>
  )
}

function StudentActivityModal({
  student,
  onClose,
}) {
  const {
    requirements,
    loading,
    error,
    progress,
    requirementsByWeek,
    getActivity,
    toggleRequirement,
    updateNote,
    deleteActivity,
  } = useStudentActivity(student?.id)

  const [savingId, setSavingId] =
    useState(null)

  const [deletingId, setDeletingId] =
    useState(null)

  const [viewFilter, setViewFilter] =
    useState('all')

  const [
    expandedWeeks,
    setExpandedWeeks,
  ] = useState(() => new Set())

  const [
    activeWeekTab,
    setActiveWeekTab,
  ] = useState({})

  const [
    openMenuId,
    setOpenMenuId,
  ] = useState(null)

  const weekStatuses = useMemo(() => {
    const map = {}

    requirementsByWeek.forEach(
      (group) => {
        const total =
          group.items.length

        const completed =
          group.items.filter(
            (requirement) =>
              getActivity(
                requirement.id
              )?.completed
          ).length

        map[group.week] = {
          total,
          completed,
          allDone:
            total > 0 &&
            completed === total,
          hasAny: completed > 0,
        }
      }
    )

    return map
  }, [
    requirementsByWeek,
    getActivity,
  ])

  useEffect(() => {
    if (
      requirementsByWeek.length ===
      0
    ) {
      return
    }

    setExpandedWeeks((previous) => {
      if (previous.size > 0) {
        return previous
      }

      const firstOpen =
        requirementsByWeek.find(
          (group) => {
            const status =
              weekStatuses[
                group.week
              ]

            return (
              status &&
              !status.allDone
            )
          }
        ) ||
        requirementsByWeek[0]

      return new Set([
        firstOpen.week,
      ])
    })
  }, [
    requirementsByWeek,
    weekStatuses,
  ])

  const currentWeek = useMemo(() => {
    const open =
      requirementsByWeek.find(
        (group) => {
          const status =
            weekStatuses[group.week]

          return (
            status &&
            !status.allDone
          )
        }
      )

    return (
      open?.week ??
      requirementsByWeek[
        requirementsByWeek.length - 1
      ]?.week ??
      0
    )
  }, [
    requirementsByWeek,
    weekStatuses,
  ])

  const noteCount = useMemo(() => {
    return requirements.reduce(
      (count, requirement) => {
        const note =
          getActivity(
            requirement.id
          )?.note

        return (
          count +
          (note && note.trim()
            ? 1
            : 0)
        )
      },
      0
    )
  }, [
    requirements,
    getActivity,
  ])

  const paceLabel = useMemo(() => {
    if (!progress.total) {
      return '—'
    }

    if (
      progress.percentage >= 75
    ) {
      return 'On Track'
    }

    if (
      progress.percentage >= 40
    ) {
      return 'Needs Attention'
    }

    return 'Behind'
  }, [progress])

  async function handleToggle(
    requirementId
  ) {
    setSavingId(requirementId)

    await toggleRequirement(
      requirementId
    )

    setSavingId(null)
  }

  async function handleDelete(
    requirement
  ) {
    const confirmed =
      window.confirm(
        `Remove "${requirement.label}" for ${student.name}?`
      )

    if (!confirmed) {
      return
    }

    setDeletingId(
      requirement.id
    )

    await deleteActivity(
      requirement
    )

    setDeletingId(null)
    setOpenMenuId(null)
  }

  function toggleWeek(week) {
    setExpandedWeeks(
      (previous) => {
        const next =
          new Set(previous)

        if (next.has(week)) {
          next.delete(week)
        } else {
          next.add(week)
        }

        return next
      }
    )
  }

  function setWeekTab(
    week,
    tab
  ) {
    setActiveWeekTab(
      (previous) => ({
        ...previous,
        [week]: tab,
      })
    )
  }

  function filterItems(items) {
    if (
      viewFilter === 'all'
    ) {
      return items
    }

    if (
      viewFilter ===
      'completed'
    ) {
      return items.filter(
        (requirement) =>
          getActivity(
            requirement.id
          )?.completed
      )
    }

    return items.filter(
      (requirement) =>
        !getActivity(
          requirement.id
        )?.completed
    )
  }

  const timelineWeeks =
    useMemo(() => {
      const weeks =
        requirementsByWeek
          .map(
            (group) =>
              group.week
          )
          .filter(
            (week) =>
              week > 0
          )
          .sort(
            (a, b) =>
              a - b
          )

      if (
        weeks.length > 0
      ) {
        return weeks
      }

      return [
        1, 2, 3, 4,
        5, 6, 7, 8,
      ]
    }, [
      requirementsByWeek,
    ])

  const initials =
    getInitials(
      student?.name
    )

  const subtitle = [
    student?.program ||
      student?.subject ||
      'Student Activity',
    student?.university,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className="sa-overlay"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >
      <div
        className="sa-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sa-title"
        onMouseDown={(
          event
        ) =>
          event.stopPropagation()
        }
      >
        {/* =========================
            HEADER
        ========================== */}

        <header className="sa-header">
          <div className="sa-identity">
            <div
              className="sa-avatar"
              aria-hidden="true"
            >
              {initials}
            </div>

            <div className="sa-identity-text">
              <h2 id="sa-title">
                {student?.name ||
                  'Student'}
              </h2>

              <p>
                {subtitle}
              </p>

              <span className="sa-status-pill">
                <span className="sa-status-dot" />
                Active
              </span>
            </div>
          </div>

          <div className="sa-progress-panel">
            <div className="sa-progress-panel-top">
              <h3>
                Progress &amp;
                Timeline
              </h3>

              <button
                type="button"
                className="sa-close"
                onClick={
                  onClose
                }
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* =========================
                TIMELINE
            ========================== */}

            <div
              className="sa-timeline"
              role="list"
            >
              {timelineWeeks.map(
                (
                  week,
                  index
                ) => {
                  const status =
                    weekStatuses[
                      week
                    ] || {
                      allDone:
                        false,
                      hasAny:
                        false,
                    }

                  const isCurrent =
                    week ===
                    currentWeek

                  const isPast =
                    status.allDone

                  return (
                    <div
                      key={week}
                      role="listitem"
                      className={[
                        'sa-timeline-step',
                        isPast
                          ? 'is-done'
                          : '',
                        isCurrent
                          ? 'is-current'
                          : '',
                      ]
                        .filter(
                          Boolean
                        )
                        .join(' ')}
                    >
                      <div className="sa-timeline-node">
                        {isPast ? (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M2.5 6.2L4.8 8.5L9.5 3.5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <span className="sa-timeline-dot" />
                        )}
                      </div>

                      <span className="sa-timeline-label">
                        Week{' '}
                        {week}
                      </span>

                      {index <
                        timelineWeeks.length -
                          1 && (
                        <span
                          className="sa-timeline-connector"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  )
                }
              )}
            </div>

            {/* =========================
                PROGRESS GAUGE
            ========================== */}

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
                      Overall
                      Completion
                    </strong>

                    <span>
                      {
                        progress.completed
                      }
                      /
                      {
                        progress.total
                      }
                    </span>
                  </div>
                </div>

                <div className="sa-meta-card">
                  <span className="sa-meta-dot muted" />

                  <div>
                    <strong>
                      Last updated
                    </strong>

                    <span>
                      Just now
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* =========================
                INSIGHTS
            ========================== */}

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
                  Avg. Activity
                  Score:{' '}
                  <strong>
                    {progress.percentage
                      ? `${progress.percentage}%`
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

        {/* =========================
            BODY
        ========================== */}

        <div className="sa-body">
          <div className="sa-section-bar">
            <span className="sa-section-title">
              Activity by Week
            </span>

            <div className="sa-section-actions">
              <div
                className="sa-filter-tabs"
                role="tablist"
              >
                {[
                  {
                    id: 'all',
                    label:
                      'View All',
                  },
                  {
                    id: 'todo',
                    label:
                      'To Do',
                  },
                  {
                    id: 'completed',
                    label:
                      'Completed',
                  },
                ].map(
                  (tab) => (
                    <button
                      key={
                        tab.id
                      }
                      type="button"
                      role="tab"
                      aria-selected={
                        viewFilter ===
                        tab.id
                      }
                      className={
                        viewFilter ===
                        tab.id
                          ? 'sa-filter-tab is-active'
                          : 'sa-filter-tab'
                      }
                      onClick={() =>
                        setViewFilter(
                          tab.id
                        )
                      }
                    >
                      {
                        tab.label
                      }
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="sa-empty">
              Loading
              checklist…
            </div>
          ) : requirements.length ===
            0 ? (
            <div className="sa-empty">
              <strong>
                No assigned
                activities yet
              </strong>

              <span>
                Assign activities
                from the Activity
                Tracker to get
                started.
              </span>
            </div>
          ) : (
            <div className="sa-week-list">
              {requirementsByWeek.map(
                (group) => {
                  const status =
                    weekStatuses[
                      group.week
                    ] || {
                      total: 0,
                      completed:
                        0,
                      allDone:
                        false,
                    }

                  const isExpanded =
                    expandedWeeks.has(
                      group.week
                    )

                  const tab =
                    activeWeekTab[
                      group.week
                    ] ||
                    'activities'

                  const visibleItems =
                    filterItems(
                      group.items
                    )

                  const notesInWeek =
                    group.items.filter(
                      (
                        requirement
                      ) => {
                        const note =
                          getActivity(
                            requirement.id
                          )?.note

                        return (
                          note &&
                          note.trim()
                        )
                      }
                    ).length

                  return (
                    <section
                      key={
                        group.week
                      }
                      className={[
                        'sa-week',
                        status.allDone
                          ? 'is-complete'
                          : '',
                        isExpanded
                          ? 'is-open'
                          : '',
                      ]
                        .filter(
                          Boolean
                        )
                        .join(' ')}
                    >
                      {/* =========================
                          WEEK HEADER
                      ========================== */}

                      <button
                        type="button"
                        className="sa-week-header"
                        onClick={() =>
                          toggleWeek(
                            group.week
                          )
                        }
                        aria-expanded={
                          isExpanded
                        }
                      >
                        <span
                          className="sa-week-check"
                          aria-hidden="true"
                        >
                          {status.allDone ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                            >
                              <path
                                d="M2.5 7.2L5.5 10.2L11.5 3.8"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <span className="sa-week-check-empty" />
                          )}
                        </span>

                        <span className="sa-week-title">
                          {status.allDone
                            ? `Completed (${status.completed} task${
                                status.completed ===
                                1
                                  ? ''
                                  : 's'
                              })`
                            : group.label}
                        </span>

                        {status.allDone && (
                          <span className="sa-week-summary">
                            {group.items
                              .map(
                                (
                                  requirement
                                ) =>
                                  requirement.code ||
                                  requirement.label
                              )
                              .filter(
                                Boolean
                              )
                              .slice(
                                0,
                                4
                              )
                              .join(
                                ', '
                              )}

                            {group.items
                              .length >
                            4
                              ? '…'
                              : ''}
                          </span>
                        )}

                        <span
                          className="sa-week-chevron"
                          aria-hidden="true"
                        >
                          {isExpanded
                            ? '▾'
                            : '▸'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="sa-week-body">
                          {/* =========================
                              WEEK TABS
                          ========================== */}

                          <div
                            className="sa-week-tabs"
                            role="tablist"
                          >
                            {[
                              {
                                id: 'activities',
                                label: `Activities (${group.items.length})`,
                              },
                              {
                                id: 'notes',
                                label: `Notes (${notesInWeek})`,
                              },
                              {
                                id: 'files',
                                label:
                                  'Files (0)',
                              },
                            ].map(
                              (
                                tabOption
                              ) => (
                                <button
                                  key={
                                    tabOption.id
                                  }
                                  type="button"
                                  role="tab"
                                  className={
                                    tab ===
                                    tabOption.id
                                      ? 'sa-week-tab is-active'
                                      : 'sa-week-tab'
                                  }
                                  onClick={() =>
                                    setWeekTab(
                                      group.week,
                                      tabOption.id
                                    )
                                  }
                                >
                                  {
                                    tabOption.label
                                  }
                                </button>
                              )
                            )}
                          </div>

                          {/* =========================
                              ACTIVITIES
                          ========================== */}

                          {tab ===
                            'activities' && (
                            <div className="sa-table-wrap">
                              <div className="sa-table-head">
                                <span>
                                  Activity
                                </span>

                                <span>
                                  Status
                                </span>

                                <span>
                                  Note
                                </span>

                                <span />
                              </div>

                              {visibleItems.length ===
                              0 ? (
                                <div className="sa-table-empty">
                                  No
                                  activities
                                  match
                                  this
                                  filter.
                                </div>
                              ) : (
                                visibleItems.map(
                                  (
                                    requirement
                                  ) => {
                                    const item =
                                      getActivity(
                                        requirement.id
                                      )

                                    const completed =
                                      item?.completed ||
                                      false

                                    const note =
                                      item?.note ||
                                      ''

                                    const isCustom =
                                      Boolean(
                                        requirement.student_id
                                      )

                                    const menuOpen =
                                      openMenuId ===
                                      requirement.id

                                    return (
                                      <div
                                        key={
                                          requirement.id
                                        }
                                        className={
                                          completed
                                            ? 'sa-row is-done'
                                            : 'sa-row'
                                        }
                                      >
                                        {/* Activity */}

                                        <div className="sa-row-activity">
                                          <label className="sa-check">
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
                                                handleToggle(
                                                  requirement.id
                                                )
                                              }
                                            />

                                            <span className="sa-check-box" />
                                          </label>

                                          <div className="sa-row-text">
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

                                            {isCustom && (
                                              <span className="sa-custom-tag">
                                                Custom
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Status */}

                                        <div className="sa-row-status">
                                          <span
                                            className={
                                              completed
                                                ? 'sa-status is-done'
                                                : 'sa-status is-pending'
                                            }
                                          >
                                            {completed
                                              ? 'Completed'
                                              : 'Awaiting Review'}
                                          </span>
                                        </div>

                                        {/* Note */}

                                        <div className="sa-row-note">
                                          <input
                                            type="text"
                                            className="sa-note-input"
                                            placeholder="Add note…"
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
                                                  requirement.id,
                                                  event
                                                    .target
                                                    .value
                                                )
                                              }
                                            }}
                                          />
                                        </div>

                                        {/* Actions */}

                                        <div className="sa-row-actions">
                                          <div className="sa-menu-wrap">
                                            <button
                                              type="button"
                                              className="sa-icon-btn"
                                              aria-label="More actions"
                                              onClick={() =>
                                                setOpenMenuId(
                                                  menuOpen
                                                    ? null
                                                    : requirement.id
                                                )
                                              }
                                            >
                                              ⋯
                                            </button>

                                            {menuOpen && (
                                              <div className="sa-menu">
                                                {isCustom && (
                                                  <button
                                                    type="button"
                                                    className="sa-menu-item danger"
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
                                                      ? 'Removing…'
                                                      : 'Remove'}
                                                  </button>
                                                )}

                                                <button
                                                  type="button"
                                                  className="sa-menu-item"
                                                  onClick={() =>
                                                    setOpenMenuId(
                                                      null
                                                    )
                                                  }
                                                >
                                                  Close
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  }
                                )
                              )}
                            </div>
                          )}

                          {/* =========================
                              NOTES
                          ========================== */}

                          {tab ===
                            'notes' && (
                            <div className="sa-notes-panel">
                              {group.items.filter(
                                (
                                  requirement
                                ) => {
                                  const note =
                                    getActivity(
                                      requirement.id
                                    )?.note

                                  return (
                                    note &&
                                    note.trim()
                                  )
                                }
                              ).length ===
                              0 ? (
                                <p className="sa-table-empty">
                                  No notes
                                  for this
                                  week yet.
                                </p>
                              ) : (
                                group.items.map(
                                  (
                                    requirement
                                  ) => {
                                    const note =
                                      getActivity(
                                        requirement.id
                                      )?.note

                                    if (
                                      !note ||
                                      !note.trim()
                                    ) {
                                      return null
                                    }

                                    return (
                                      <div
                                        key={
                                          requirement.id
                                        }
                                        className="sa-note-card"
                                      >
                                        <strong>
                                          {
                                            requirement.label
                                          }
                                        </strong>

                                        <p>
                                          {
                                            note
                                          }
                                        </p>
                                      </div>
                                    )
                                  }
                                )
                              )}
                            </div>
                          )}

                          {/* =========================
                              FILES
                          ========================== */}

                          {tab ===
                            'files' && (
                            <p className="sa-table-empty">
                              File
                              attachments
                              are not
                              available in
                              this view.
                            </p>
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

        {/* =========================
            FOOTER
        ========================== */}

        <footer className="sa-footer">
          <button
            type="button"
            className="sa-btn-ghost"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="sa-btn-primary"
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