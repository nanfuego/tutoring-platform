import { useState } from 'react'
import { supabase } from '../supabaseClient'
import './ActivityTracker.css'

function ActivityManagementModal({
  semester,
  activities,
  onClose,
  onChanged,
}) {
  const [showAddForm, setShowAddForm] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [deletingId, setDeletingId] =
    useState(null)

  const [error, setError] =
    useState('')

  const [form, setForm] = useState({
    name: '',
    code: '',
    week: '1',
    description: '',
  })

  function resetForm() {
    setForm({
      name: '',
      code: '',
      week: '1',
      description: '',
    })

    setError('')
  }

  function closeAddForm() {
    if (saving) return

    resetForm()
    setShowAddForm(false)
  }

  async function handleCreateActivity(event) {
    event.preventDefault()

    if (!semester) {
      setError(
        'No active semester was found.'
      )
      return
    }

    if (!form.name.trim()) {
      setError(
        'Please enter an activity name.'
      )
      return
    }

    setSaving(true)
    setError('')

    try {
      const activityCode =
        form.code.trim() ||
        `ACT-${Date.now()}`

      const { error: insertError } =
        await supabase
          .from('activity_requirements')
          .insert({
            code: activityCode,
            label: form.name.trim(),
            week:
              Number(form.week) || 1,
            sort_order:
              activities.length,
            semester_id:
              semester.id,
            description:
              form.description.trim() ||
              null,
          })

      if (insertError) {
        throw insertError
      }

      resetForm()
      setShowAddForm(false)

      await onChanged()
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
      setSaving(false)
    }
  }

  async function handleDeleteActivity(
    activity
  ) {
    const confirmed =
      window.confirm(
        `Delete "${activity.label}"?\n\nThis will remove the activity from the current semester and delete its student completion records.`
      )

    if (!confirmed) {
      return
    }

    setDeletingId(activity.id)
    setError('')

    try {
      /*
       * Remove student completion records first.
       *
       * student_activity.requirement_id references
       * activity_requirements.id, so this prevents a
       * foreign-key constraint error.
       */
      const {
        error: activityRecordsError,
      } = await supabase
        .from('student_activity')
        .delete()
        .eq(
          'requirement_id',
          activity.id
        )

      if (activityRecordsError) {
        throw activityRecordsError
      }

      /*
       * Now remove the activity requirement.
       */
      const {
        error: requirementError,
      } = await supabase
        .from('activity_requirements')
        .delete()
        .eq(
          'id',
          activity.id
        )

      if (requirementError) {
        throw requirementError
      }

      await onChanged()
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
      setDeletingId(null)
    }
  }

  return (
    <div
      className="progress-modal-overlay"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !saving &&
          !deletingId
        ) {
          onClose()
        }
      }}
    >
      <div
        className="progress-modal activity-management-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >

        {/* HEADER */}

        <div className="progress-modal-header">

          <div>

            <span className="page-kicker">
              ACTIVITY MANAGEMENT
            </span>

            <h2>
              Manage Activities
            </h2>

            <p>
              Create or remove activities
              for{' '}
              {semester?.name ||
                'the current semester'}.
            </p>

          </div>

          <button
            type="button"
            className="modal-close"
            disabled={
              saving || Boolean(deletingId)
            }
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>

        </div>


        {/* ERROR */}

        {error && (
          <div className="modal-error">
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
                {activities.length}{' '}
                {activities.length === 1
                  ? 'activity'
                  : 'activities'}{' '}
                in this semester
              </span>

            </div>

            <button
              type="button"
              className="primary-action"
              onClick={() => {
                resetForm()
                setShowAddForm(true)
              }}
              disabled={
                saving ||
                Boolean(deletingId)
              }
            >
              <span>＋</span>
              Add Activity
            </button>

          </div>


          {activities.length === 0 ? (

            <div className="activity-management-empty">

              <div className="activity-empty-icon">
                +
              </div>

              <strong>
                No activities yet
              </strong>

              <span>
                Add the first activity
                for this semester.
              </span>

              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  resetForm()
                  setShowAddForm(true)
                }}
              >
                Add Activity
              </button>

            </div>

          ) : (

            <div className="activity-management-list">

              {activities.map(
                (activity, index) => (

                  <div
                    className="activity-management-row"
                    key={activity.id}
                  >

                    <div className="activity-number">
                      {String(
                        index + 1
                      ).padStart(2, '0')}
                    </div>


                    <div className="activity-management-info">

                      <div className="activity-management-title">

                        <strong>
                          {activity.label}
                        </strong>

                        {activity.code && (
                          <span>
                            {activity.code}
                          </span>
                        )}

                      </div>

                      <div className="activity-management-meta">

                        <span>
                          Week{' '}
                          {activity.week ||
                            '—'}
                        </span>

                        {activity.description && (
                          <>
                            <i />
                            <span>
                              {
                                activity.description
                              }
                            </span>
                          </>
                        )}

                      </div>

                    </div>


                    <button
                      type="button"
                      className="activity-delete-button"
                      disabled={
                        saving ||
                        Boolean(deletingId)
                      }
                      onClick={() =>
                        handleDeleteActivity(
                          activity
                        )
                      }
                    >
                      {deletingId ===
                      activity.id
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>

                  </div>

                )
              )}

            </div>

          )}

        </div>


        {/* ADD ACTIVITY */}

        {showAddForm && (

          <div className="activity-add-panel">

            <div className="activity-add-header">

              <div>

                <span className="page-kicker">
                  NEW ACTIVITY
                </span>

                <h3>
                  Add Activity
                </h3>

                <p>
                  Define the activity
                  students need to
                  complete.
                </p>

              </div>

              <button
                type="button"
                className="modal-close small"
                disabled={saving}
                onClick={
                  closeAddForm
                }
              >
                ×
              </button>

            </div>


            <form
              className="activity-add-form"
              onSubmit={
                handleCreateActivity
              }
            >

              <div className="activity-form-grid">

                <label>

                  <span>
                    Activity Name *
                  </span>

                  <input
                    required
                    autoFocus
                    value={form.name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        name:
                          event.target
                            .value,
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
                    value={form.week}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        week:
                          event.target
                            .value,
                      })
                    }
                  >

                    {Array.from(
                      {
                        length: 16,
                      },
                      (_, index) => (
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


                <label>

                  <span>
                    Activity Code
                  </span>

                  <input
                    value={form.code}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        code:
                          event.target
                            .value,
                      })
                    }
                    placeholder="Optional code"
                  />

                </label>


                <label className="activity-form-full">

                  <span>
                    Activity Description
                  </span>

                  <textarea
                    rows="4"
                    value={
                      form.description
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        description:
                          event.target
                            .value,
                      })
                    }
                    placeholder="Describe what the student needs to complete..."
                  />

                </label>

              </div>


              <div className="activity-add-footer">

                <button
                  type="button"
                  className="secondary-action"
                  disabled={saving}
                  onClick={
                    closeAddForm
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
                    ? 'Adding...'
                    : 'Add Activity'}
                </button>

              </div>

            </form>

          </div>

        )}

      </div>
    </div>
  )
}

export default ActivityManagementModal