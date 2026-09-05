import { Link } from 'react-router-dom'
import logo from '../assets/westpacific-desk-logo.png'
import './Home.css'

const services = [
  {
    number: '01',
    title: 'Student Assistance',
    description:
      'Support with scheduling, reminders, follow-ups, records, LMS coordination, and day-to-day student administration.',
  },
  {
    number: '02',
    title: 'Administrative Support',
    description:
      'Reliable help with data entry, document organization, email coordination, calendars, spreadsheets, and routine office tasks.',
  },
  {
    number: '03',
    title: 'Progress & Record Tracking',
    description:
      'Organized monitoring of student progress, activities, deadlines, notes, payments, and other important records.',
  },
  {
    number: '04',
    title: 'Virtual Office Assistance',
    description:
      'Flexible remote support for recurring office work, follow-ups, file management, and administrative coordination.',
  },
  {
    number: '05',
    title: 'Web App Development',
    description:
      'Custom web applications for internal workflows, student management, tracking systems, dashboards, and small business operations.',
  },
  {
    number: '06',
    title: 'Website Building',
    description:
      'Professional business websites and landing pages designed to present services clearly and work well across desktop and mobile.',
  },
  {
    number: '07',
    title: 'Website Management',
    description:
      'Ongoing help with content updates, page changes, maintenance, organization, and day-to-day website administration.',
  },
]


const benefits = [
  'Organized and dependable support',
  'Clear communication and follow-up',
  'Flexible remote assistance',
  'Professional record keeping',
  'Student-focused coordination',
  'Simple, efficient workflows',
]

function Home() {
  return (
    <div className="public-home">
      <header className="public-nav">
        <div className="public-nav-inner">
          <a href="#top" className="public-brand" aria-label="WestPacific Desk Home">
            <img src={logo} alt="WestPacific Desk" />
          </a>

          <nav className="public-nav-links" aria-label="Main navigation">
            <a href="#services">Services</a>
            <a href="#about">About</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#contact">Contact</a>
          </nav>

          <Link to="/admin/login" className="public-admin-link">
            Login
          </Link>
        </div>
      </header>

      <main id="top">
        <section className="public-hero">
          <div className="public-hero-inner">
            <div className="public-hero-copy">
              <span className="public-eyebrow">
                WESTPACIFIC DESK · PROFESSIONAL OFFSHORE SUPPORT
              </span>

              <h1>
                Helping you stay
                <span> organized, on track, and supported.</span>
              </h1>

              <p className="public-hero-lead">
                Professional offshore support for students, professionals, and businesses
                who need dependable help with administration, student assistance,
                websites, web applications, and everyday online operations.
              </p>

              <div className="public-hero-actions">
                <a href="#contact" className="public-button primary">
                  Get Started
                </a>

                <a href="#services" className="public-button secondary">
                  View Services
                </a>
              </div>

              <div className="public-hero-trust">
                <span><b>✓</b> Remote support</span>
                <span><b>✓</b> Organized workflow</span>
                <span><b>✓</b> Personal assistance</span>
              </div>
            </div>

            <div className="public-hero-visual" aria-hidden="true">
              <div className="hero-visual-window">
                <div className="hero-window-top">
                  <span className="hero-window-dot" />
                  <span className="hero-window-dot" />
                  <span className="hero-window-dot" />
                </div>

                <div className="hero-window-body">
                  <div className="hero-mini-sidebar">
                    <div className="hero-mini-logo">WP</div>
                    <span className="hero-side-line active" />
                    <span className="hero-side-line" />
                    <span className="hero-side-line" />
                    <span className="hero-side-line short" />
                  </div>

                  <div className="hero-dashboard">
                    <span className="hero-dashboard-label">TODAY'S OVERVIEW</span>

                    <div className="hero-dashboard-heading">
                      <div>
                        <strong>Good morning</strong>
                        <small>Everything is organized and ready.</small>
                      </div>

                      <span className="hero-status-pill">On Track</span>
                    </div>

                    <div className="hero-stat-grid">
                      <div><small>Students</small><strong>24</strong></div>
                      <div><small>Tasks</small><strong>18</strong></div>
                      <div><small>Follow-ups</small><strong>6</strong></div>
                    </div>

                    <div className="hero-task-card">
                      <span className="hero-task-check">✓</span>
                      <div>
                        <strong>Student follow-up</strong>
                        <small>Completed today</small>
                      </div>
                    </div>

                    <div className="hero-task-card">
                      <span className="hero-task-check">✓</span>
                      <div>
                        <strong>Records updated</strong>
                        <small>Files organized</small>
                      </div>
                    </div>

                    <div className="hero-task-card pending">
                      <span className="hero-task-check">•</span>
                      <div>
                        <strong>Upcoming schedule</strong>
                        <small>Ready for review</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hero-floating-card floating-one">
                <span>ADMIN SUPPORT</span>
                <strong>Organized</strong>
              </div>

              <div className="hero-floating-card floating-two">
                <span>STUDENT HELP</span>
                <strong>On Track</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="public-intro" id="about">
          <div className="public-section-inner public-intro-grid">
            <div>
              <span className="public-eyebrow">ABOUT THE SERVICE</span>
              <h2>Practical help for the work that keeps everything moving.</h2>
            </div>

            <div className="public-intro-copy">
              <p>
                WestPacific Desk provides hands-on administrative, student, and digital support for
                students, professionals, and businesses that need an extra set of reliable hands. The goal is
                simple: keep records organized, communication clear, tasks
                moving, websites maintained, and important details from falling through the cracks.
              </p>

              <p>
                Support can be tailored to ongoing needs, whether that means
                assisting students, organizing office work, tracking progress,
                managing schedules, building a website or web app, or helping
                with recurring administrative and digital responsibilities.
              </p>
            </div>
          </div>
        </section>

        <section className="public-services" id="services">
          <div className="public-section-inner">
            <div className="public-section-heading">
              <div>
                <span className="public-eyebrow">SERVICES</span>
                <h2>Support that makes everyday work easier.</h2>
              </div>

              <p>
                Flexible administrative, student, and digital support designed around the work
                you need help managing.
              </p>
            </div>

            <div className="public-service-grid">
              {services.map((service) => (
                <article className="public-service-card" key={service.number}>
                  <span className="public-service-number">{service.number}</span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-benefits">
          <div className="public-section-inner public-benefits-grid">
            <div className="public-benefits-copy">
              <span className="public-eyebrow">WHY WORK WITH WESTPACIFIC DESK</span>
              <h2>A calmer way to manage the details.</h2>

              <p>
                Good administrative support should save time, reduce stress,
                and make information easier to find. Every task is approached
                with organization, consistency, and clear communication.
              </p>

              <div className="public-benefit-list">
                {benefits.map((benefit) => (
                  <div key={benefit}>
                    <span>✓</span>
                    {benefit}
                  </div>
                ))}
              </div>
            </div>

            <div className="public-benefit-panel">
              <span className="public-benefit-panel-label">A BETTER WORKFLOW</span>

              <div className="workflow-item">
                <span>1</span>
                <div>
                  <strong>Share what you need help with</strong>
                  <p>Tell us the tasks, priorities, and routine you want supported.</p>
                </div>
              </div>

              <div className="workflow-divider" />

              <div className="workflow-item">
                <span>2</span>
                <div>
                  <strong>Get an organized plan</strong>
                  <p>Work is grouped into a clear, manageable workflow.</p>
                </div>
              </div>

              <div className="workflow-divider" />

              <div className="workflow-item">
                <span>3</span>
                <div>
                  <strong>Stay updated</strong>
                  <p>Receive clear progress, follow-ups, and organized records.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="public-process" id="how-it-works">
          <div className="public-section-inner">
            <div className="public-section-heading centered">
              <span className="public-eyebrow">HOW IT WORKS</span>
              <h2>Simple support. No complicated process.</h2>
              <p>
                Start small or build an ongoing support routine based on your needs.
              </p>
            </div>

            <div className="public-process-grid">
              <div>
                <span>01</span>
                <h3>Tell us what you need</h3>
                <p>Share the tasks, schedule, and type of assistance you need.</p>
              </div>

              <div>
                <span>02</span>
                <h3>Set the workflow</h3>
                <p>We organize priorities, communication, and recurring work.</p>
              </div>

              <div>
                <span>03</span>
                <h3>Get dependable support</h3>
                <p>Tasks are handled consistently with clear updates and follow-up.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="public-contact" id="contact">
          <div className="public-section-inner">
            <div className="public-contact-card">
              <div>
                <span className="public-eyebrow">LET'S WORK TOGETHER</span>
                <h2>Need help staying organized?</h2>

                <p>
                  Whether you need student assistance, virtual office support,
                  or help managing recurring administrative work, WestPacific Desk can help
                  build a workflow that fits your needs.
                </p>
              </div>

              <div className="public-contact-actions">
                <a
                  href="mailto:gloujoyce@gmail.com"
                  className="public-button primary light"
                >
                  Email Joyce
                </a>

                <a
                  href="https://wa.me/639776324096"
                  className="public-button whatsapp"
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>

                <span className="public-contact-note">
                  gloujoyce@gmail.com · +63 977 632 4096
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="public-section-inner public-footer-inner">
          <div className="public-footer-brand">
            <img src={logo} alt="WestPacific Desk" />
            <p>Professional offshore support for students and businesses.</p>
          </div>

          <div className="public-footer-links">
            <a href="#services">Services</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
            <Link to="/admin/login">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home
