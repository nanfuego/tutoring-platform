import { useEffect, useMemo, useState } from 'react'
import { useStudentActivity } from '../hooks/useStudentActivity'
import './StudentActivityModal.css'

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function CircularProgress({ percentage = 0, size = 112, stroke = 10 }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset =
    circumference -
    (Math.min(100, Math.max(0, percentage)) / 100) * circumference

  return (
    <div className="sa-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="sa-gauge-label">
        <strong>{percentage}%</strong>
        <span>Overall Completion</span>
      </div>
    </div>
  )
}

function StudentActivityModal({ student, onClose }) {
  const {
    requirements,
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
  } = useStudentActivity(student?.id)

  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newWeek, setNewWeek] = useState('0')
  const [adding, setAdding] = useState(false)

  const [viewFilter, setViewFilter] = useState('all') // all | todo | completed
  const [expandedWeeks, setExpandedWeeks] = useState(() => new Set())
  const [activeWeekTab, setActiveWeekTab] = useState({}) // week -> activities | notes | files
  const [openMenuId, setOpenMenuId] = useState(null)

  const weekStatuses = useMemo(() => {
    const map = {}
    requirementsByWeek.forEach((group) => {
      const total = group.items.length
      const completed = group.items.filter(
        (r) => getActivity(r.id)?.completed
      ).length
      map[group.week] = {
        total,
        completed,
        allDone: total > 0 && completed === total,
        hasAny: completed > 0,
      }
    })
    return map
  }, [requirementsByWeek, getActivity])

  useEffect(() => {
    if (requirementsByWeek.length === 0) return
    setExpandedWeeks((prev) => {
      if (prev.size > 0) return prev
      const firstOpen =
        requirementsByWeek.find((g) => {
          const st = weekStatuses[g.week]
          return st && !st.allDone
        }) || requirementsByWeek[0]
      return new Set([firstOpen.week])
    })
  }, [requirementsByWeek, weekStatuses])

  const currentWeek = useMemo(() => {
    const open = requirementsByWeek.find((g) => {
      const st = weekStatuses[g.week]
      return st && !st.allDone
    })
    return (
      open?.week ??
      requirementsByWeek[requirementsByWeek.length - 1]?.week ??
      0
    )
  }, [requirementsByWeek, weekStatuses])

  const noteCount = useMemo(() => {
    return requirements.reduce((acc, r) => {
      const note = getActivity(r.id)?.note
      return acc + (note && note.trim() ? 1 : 0)
    }, 0)
  }, [requirements, getActivity])

  const paceLabel = useMemo(() => {
    if (!progress.total) return '—'
    if (progress.percentage >= 75) return 'On Track'
    if (progress.percentage >= 40) return 'Needs Attention'
    return 'Behind'
  }, [progress])

  async function handleToggle(requirementId) {
    setSavingId(requirementId)
    await toggleRequirement(requirementId)
    setSavingId(null)
  }

  async function handleAddActivity(event) {
    event.preventDefault()
    if (!newLabel.trim()) return
    setAdding(true)
    await addActivity(newLabel, newWeek)
    setAdding(false)
    setNewLabel('')
    setNewWeek('0')
    setShowAddForm(false)
  }

  async function handleDelete(requirement) {
    if (
      !window.confirm(
        `Remove "${requirement.label}" for ${student.name}?`
      )
    ) {
      return
    }
    setDeletingId(requirement.id)
    await deleteActivity(requirement)
    setDeletingId(null)
    setOpenMenuId(null)
  }

  function toggleWeek(week) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(week)) next.delete(week)
      else next.add(week)
      return next
    })
  }

  function setWeekTab(week, tab) {
    setActiveWeekTab((prev) => ({ ...prev, [week]: tab }))
  }

  function filterItems(items) {
    if (viewFilter === 'all') return items
    if (viewFilter === 'completed') {
      return items.filter((r) => getActivity(r.id)?.completed)
    }
    return items.filter((r) => !getActivity(r.id)?.completed)
  }

  const timelineWeeks = useMemo(() => {
    const weeks = requirementsByWeek
      .map((g) => g.week)
      .filter((w) => w > 0)
      .sort((a, b) => a - b)
    if (weeks.length > 0) return weeks
    return [1, 2, 3, 4, 5, 6, 7, 8]
  }, [requirementsByWeek])

  const initials = getInitials(student?.name)
  const subtitle = [
    student?.program || student?.subject || 'Student Activity',
    student?.university,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className="sa-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="sa-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sa-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────── */}
        <header className="sa-header">
          <div className="sa-identity">
            <div className="sa-avatar" aria-hidden="true">
              {initials}
            </div>
            <div className="sa-identity-text">
              <h2 id="sa-title">{student?.name || 'Student'}</h2>
              <p>{subtitle}</p>
              <span className="sa-status-pill">
                <span className="sa-status-dot" />
                Active
              </span>
            </div>
          </div>

          <div className="sa-progress-panel">
            <div className="sa-progress-panel-top">
              <h3>Progress &amp; Timeline</h3>
              <button
                type="button"
                className="sa-close"
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="sa-timeline" role="list">
              {timelineWeeks.map((week, index) => {
                const st = weekStatuses[week] || {
                  allDone: false,
                  hasAny: false,
                }
                const isCurrent = week === currentWeek
                const isPast = st.allDone
                return (
                  <div
                    key={week}
                    role="listitem"
                    className={[
                      'sa-timeline-step',
                      isPast ? 'is-done' : '',
                      isCurrent ? 'is-current' : '',
                    ]
                      .filter(Boolean)
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
                    <span className="sa-timeline-label">Week {week}</span>
                    {index < timelineWeeks.length - 1 && (
                      <span
                        className="sa-timeline-connector"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="sa-gauge-row">
              <CircularProgress percentage={progress.percentage} />
              <div className="sa-gauge-meta">
                <div className="sa-meta-card">
                  <span className="sa-meta-dot" />
                  <div>
                    <strong>Overall Completion</strong>
                    <span>
                      {progress.completed}/{progress.total}
                    </span>
                  </div>
                </div>
                <div className="sa-meta-card">
                  <span className="sa-meta-dot muted" />
                  <div>
                    <strong>Last updated</strong>
                    <span>Just now</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="sa-insights">
              <span className="sa-insights-label">Quick Insights</span>
              <div className="sa-insight-chips">
                <div className="sa-chip">
                  Current Pace: <strong>{paceLabel}</strong>
                </div>
                <div className="sa-chip">
                  Avg. Activity Score:{' '}
                  <strong>
                    {progress.percentage ? `${progress.percentage}%` : '—'}
                  </strong>
                </div>
                <div className="sa-chip">
                  Notes: <strong>{noteCount}</strong>
                </div>
              </div>
            </div>
          </div>
        </header>

        {error && <div className="sa-error">{error}</div>}

        {/* ── Body ─────────────────────────────────────────── */}
        <div className="sa-body">
          <div className="sa-section-bar">
            <span className="sa-section-title">Activity by Week</span>
            <div className="sa-section-actions">
              <div className="sa-filter-tabs" role="tablist">
                {[
                  { id: 'all', label: 'View All' },
                  { id: 'todo', label: 'To Do' },
                  { id: 'completed', label: 'Completed' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={viewFilter === tab.id}
                    className={
                      viewFilter === tab.id
                        ? 'sa-filter-tab is-active'
                        : 'sa-filter-tab'
                    }
                    onClick={() => setViewFilter(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="sa-empty">Loading checklist…</div>
          ) : requirements.length === 0 ? (
            <div className="sa-empty">
              <strong>No activity requirements yet</strong>
              <span>Add activities for this student to get started.</span>
            </div>
          ) : (
            <div className="sa-week-list">
              {requirementsByWeek.map((group) => {
                const st = weekStatuses[group.week] || {
                  total: 0,
                  completed: 0,
                  allDone: false,
                }
                const isExpanded = expandedWeeks.has(group.week)
                const tab = activeWeekTab[group.week] || 'activities'
                const visibleItems = filterItems(group.items)
                const notesInWeek = group.items.filter((r) => {
                  const n = getActivity(r.id)?.note
                  return n && n.trim()
                }).length

                return (
                  <section
                    key={group.week}
                    className={[
                      'sa-week',
                      st.allDone ? 'is-complete' : '',
                      isExpanded ? 'is-open' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <button
                      type="button"
                      className="sa-week-header"
                      onClick={() => toggleWeek(group.week)}
                      aria-expanded={isExpanded}
                    >
                      <span className="sa-week-check" aria-hidden="true">
                        {st.allDone ? (
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
                        {st.allDone
                          ? `Completed (${st.completed} task${
                              st.completed === 1 ? '' : 's'
                            })`
                          : group.label}
                      </span>
                      {st.allDone && (
                        <span className="sa-week-summary">
                          {group.items
                            .map((r) => r.code || r.label)
                            .filter(Boolean)
                            .slice(0, 4)
                            .join(', ')}
                          {group.items.length > 4 ? '…' : ''}
                        </span>
                      )}
                      <span className="sa-week-chevron" aria-hidden="true">
                        {isExpanded ? '▾' : '▸'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="sa-week-body">
                        <div className="sa-week-tabs" role="tablist">
                          {[
                            {
                              id: 'activities',
                              label: `Activities (${group.items.length})`,
                            },
                            {
                              id: 'notes',
                              label: `Notes (${notesInWeek})`,
                            },
                            { id: 'files', label: 'Files (0)' },
                          ].map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              role="tab"
                              className={
                                tab === t.id
                                  ? 'sa-week-tab is-active'
                                  : 'sa-week-tab'
                              }
                              onClick={() => setWeekTab(group.week, t.id)}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>

                        {tab === 'activities' && (
                          <div className="sa-table-wrap">
                            <div className="sa-table-head">
                              <span>Activity</span>
                              <span>Status</span>
                              <span>Note</span>
                              <span />
                            </div>
                            {visibleItems.length === 0 ? (
                              <div className="sa-table-empty">
                                No activities match this filter.
                              </div>
                            ) : (
                              visibleItems.map((requirement) => {
                                const item = getActivity(requirement.id)
                                const completed = item?.completed || false
                                const note = item?.note || ''
                                const isCustom = Boolean(
                                  requirement.student_id
                                )
                                const menuOpen =
                                  openMenuId === requirement.id

                                return (
                                  <div
                                    key={requirement.id}
                                    className={
                                      completed
                                        ? 'sa-row is-done'
                                        : 'sa-row'
                                    }
                                  >
                                    <div className="sa-row-activity">
                                      <label className="sa-check">
                                        <input
                                          type="checkbox"
                                          checked={completed}
                                          disabled={
                                            savingId === requirement.id
                                          }
                                          onChange={() =>
                                            handleToggle(requirement.id)
                                          }
                                        />
                                        <span className="sa-check-box" />
                                      </label>
                                      <div className="sa-row-text">
                                        <strong>
                                          {requirement.label}
                                        </strong>
                                        {requirement.code && (
                                          <small>
                                            {requirement.code}
                                          </small>
                                        )}
                                        {isCustom && (
                                          <span className="sa-custom-tag">
                                            Custom
                                          </span>
                                        )}
                                      </div>
                                    </div>

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

                                    <div className="sa-row-note">
                                      <input
                                        type="text"
                                        className="sa-note-input"
                                        placeholder="Add note…"
                                        defaultValue={note}
                                        onBlur={(event) => {
                                          if (
                                            event.target.value !== note
                                          ) {
                                            updateNote(
                                              requirement.id,
                                              event.target.value
                                            )
                                          }
                                        }}
                                      />
                                    </div>

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
                                                setOpenMenuId(null)
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
                              })
                            )}
                          </div>
                        )}

                        {tab === 'notes' && (
                          <div className="sa-notes-panel">
                            {group.items.filter((r) => {
                              const n = getActivity(r.id)?.note
                              return n && n.trim()
                            }).length === 0 ? (
                              <p className="sa-table-empty">
                                No notes for this week yet.
                              </p>
                            ) : (
                              group.items.map((r) => {
                                const n = getActivity(r.id)?.note
                                if (!n || !n.trim()) return null
                                return (
                                  <div
                                    key={r.id}
                                    className="sa-note-card"
                                  >
                                    <strong>{r.label}</strong>
                                    <p>{n}</p>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )}

                        {tab === 'files' && (
                          <p className="sa-table-empty">
                            File attachments are not available in this
                            view.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}

          {showAddForm ? (
            <form className="sa-add-form" onSubmit={handleAddActivity}>
              <div className="sa-add-row">
                <input
                  type="text"
                  className="sa-add-input"
                  placeholder="Activity label, e.g. Extra case study"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  autoFocus
                />
                <select
                  className="sa-add-week"
                  value={newWeek}
                  onChange={(e) => setNewWeek(e.target.value)}
                >
                  {weekOptions.map((w) => (
                    <option key={w} value={w}>
                      {w === 0 ? 'General' : `Week ${w}`}
                    </option>
                  ))}
                  <option
                    value={String(Math.max(...weekOptions, 0) + 1)}
                  >
                    New week ({Math.max(...weekOptions, 0) + 1})
                  </option>
                </select>
              </div>
              <div className="sa-add-actions">
                <button
                  type="button"
                  className="sa-btn-ghost"
                  onClick={() => {
                    setShowAddForm(false)
                    setNewLabel('')
                    setNewWeek('0')
                  }}
                  disabled={adding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sa-btn-primary"
                  disabled={adding || !newLabel.trim()}
                >
                  {adding ? 'Adding…' : 'Add activity'}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="sa-add-trigger"
              onClick={() => setShowAddForm(true)}
            >
              + Add activity for{' '}
              {student?.name?.split(' ')[0] || 'this student'}
            </button>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <footer className="sa-footer">
          <button type="button" className="sa-btn-ghost" onClick={onClose}>
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
