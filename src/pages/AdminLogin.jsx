import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './AdminLogin.css'
import logo from '../assets/ljg-logo.png'

function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    setLoading(false)

    if (signInError) {
      setError('Incorrect email or password.')
      return
    }

    navigate('/admin')
  }

  return (
    <main className="admin-login-page">
      <section
        className="admin-login-shell"
        aria-label="Administrator sign in"
      >
        <aside className="admin-login-brand">
          <div className="admin-login-brand-overlay" />

          <div className="admin-login-brand-top">
            <img
              src={logo}
              alt="LJG Student Management System"
              className="admin-login-brand-logo"
            />
          </div>

          <div className="admin-login-brand-art">
            <span className="admin-login-orb orb-one" />
            <span className="admin-login-orb orb-two" />
            <span className="admin-login-orb orb-three" />

            <div className="admin-login-art-card card-one">
              <span>STUDENTS</span>
              <strong>Progress</strong>
            </div>

            <div className="admin-login-art-card card-two">
              <span>ACTIVITY</span>
              <strong>Tracking</strong>
            </div>

            <div className="admin-login-art-card card-three">
              <span>PAYMENTS</span>
              <strong>Management</strong>
            </div>
          </div>

          <div className="admin-login-brand-copy">
            <span className="admin-login-brand-kicker">
              LJG STUDENT MANAGEMENT
            </span>

            <h2>
              Everything you need to manage your students
              in one place.
            </h2>

            <p>
              Track progress, activities, student records,
              and payments from a single secure dashboard.
            </p>
          </div>
        </aside>

        <div className="admin-login-panel">
          <div className="admin-login-form-wrap">
            <div className="admin-login-heading">
              <span className="admin-login-eyebrow">
                ADMIN ACCESS
              </span>

              <h1>Welcome back</h1>

              <p>
                Sign in to continue to the student management
                dashboard.
              </p>
            </div>

            <form
              className="admin-login-form"
              onSubmit={handleSubmit}
            >
              <label className="admin-login-field">
                <span>Email address</span>

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="admin-login-field">
                <span>Password</span>

                <div className="admin-login-password">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="admin-login-show-password"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              {error && (
                <div
                  className="admin-login-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="admin-login-submit"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="admin-login-security">
              <span className="admin-login-security-dot" />
              Secure administrator access
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default AdminLogin
