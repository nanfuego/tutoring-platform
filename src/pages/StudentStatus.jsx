import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import './StudentStatus.css'

const statusMeta = {
  not_started: { label: 'Not Started', color: 'var(--color-status-not-started)' },
  in_progress: { label: 'In Progress', color: 'var(--color-status-in-progress)' },
  delivered: { label: 'Delivered', color: 'var(--color-status-delivered)' },
}

function StudentStatus() {
  const { slug } = useParams()
  const [student, setStudent] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('slug', slug)
        .single()

      if (studentError) {
        setError(studentError.message)
        setLoading(false)
        return
      }

      setStudent(studentData)

      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('student_id', studentData.id)
        .order('due_date', { ascending: true })

      if (taskError) {
        setError(taskError.message)
      } else {
        setTasks(taskData)
      }

      setLoading(false)
    }

    fetchData()
  }, [slug])

  if (loading) return <p className="loading-text">Loading...</p>
  if (error) return <p className="error-text">Student not found.</p>

  return (
    <div className="status-page">
      <div className="status-container">
        <div className="status-header">
          <p className="status-eyebrow">Your Progress</p>
          <h1 className="status-heading">Hi, {student.name}</h1>
          <p className="status-subheading">Here's where things stand right now.</p>
        </div>

        {tasks.length === 0 ? (
          <p className="empty-state">No tasks yet — check back soon.</p>
        ) : (
          <div className="timeline">
            {tasks.map((task) => {
              const meta = statusMeta[task.status] || { label: task.status, color: 'var(--color-status-not-started)' }
              return (
                <div
                  key={task.id}
                  className="task-card"
                  style={{ '--dot-color': meta.color }}
                >
                  <div className="task-top">
                    <span className="task-title">{task.title}</span>
                    <span className="task-type">{task.type}</span>
                  </div>
                  <div className="task-meta">
                    <span className="status-pill" style={{ '--pill-color': meta.color }}>
                      {meta.label}
                    </span>
                    {task.due_date && <span>Due {task.due_date}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentStatus