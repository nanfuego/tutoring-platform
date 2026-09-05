import { Link } from 'react-router-dom'
import logo from '../assets/westpacific-logo.png'
import footerLogo from '../assets/westpacific-logo-footer-white.png'
import hero from '../assets/westpacific-hero.jpg'
import palmLeft from '../assets/palm-left.jpg'
import palmRight from '../assets/palm-right.jpg'
import './Home.css'

function PeopleIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="12" cy="10" r="4" />
      <circle cx="22" cy="11" r="3.2" />
      <path d="M4 27v-2c0-5 3.5-8.5 8-8.5s8 3.5 8 8.5v2" />
      <path d="M20 18c4 .2 7 3 7 6.5V27" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="8" y="4" width="16" height="24" rx="2" />
      <path d="M12 11h8M12 15h8M12 19h8M12 23h5" />
    </svg>
  )
}

function LaptopIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="7" y="6" width="18" height="14" rx="2" />
      <path d="M4 25h24M9 25l1.7-3h10.6l1.7 3" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="11" />
      <path d="M5 16h22M16 5c3.3 3.2 5 6.8 5 11s-1.7 7.8-5 11M16 5c-3.3 3.2-5 6.8-5 11s1.7 7.8 5 11" />
    </svg>
  )
}

function HeadsetIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 18v-2a9 9 0 0 1 18 0v2" />
      <rect x="5" y="17" width="5" height="8" rx="2" />
      <rect x="22" y="17" width="5" height="8" rx="2" />
      <path d="M22 25c0 2-1.8 3.5-4 3.5h-3" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 27h22" />
      <rect x="7" y="18" width="4" height="8" />
      <rect x="14" y="13" width="4" height="13" />
      <rect x="21" y="7" width="4" height="19" />
    </svg>
  )
}

const services = [
  {
    Icon: PeopleIcon,
    title: 'Student Assistance',
    intro: 'Reliable support for students who need help staying organized and on track.',
    points: [
      'LMS and online class coordination',
      'Assignment and deadline tracking',
      'Progress monitoring',
      'Record organization',
      'Follow-ups and reminders',
      'Student support administration',
    ],
  },
  {
    Icon: DocumentIcon,
    title: 'Administrative Support',
    intro: 'Dependable remote assistance for recurring office and business tasks.',
    points: [
      'Data entry',
      'Email and calendar coordination',
      'Document preparation',
      'File organization',
      'Spreadsheet management',
      'Administrative follow-ups',
    ],
  },
  {
    Icon: LaptopIcon,
    title: 'Web App Development',
    intro: 'Custom web applications designed around real workflows.',
    points: [
      'Internal dashboards',
      'Student management systems',
      'Tracking tools',
      'Payment and activity systems',
      'Business workflow applications',
      'Custom database-driven solutions',
    ],
  },
  {
    Icon: GlobeIcon,
    title: 'Website Building & Management',
    intro: 'Professional websites that are clear, modern, and easy to maintain.',
    points: [
      'Business websites',
      'Landing pages',
      'Website redesigns',
      'Content updates',
      'Website maintenance',
      'Domain and deployment assistance',
    ],
  },
  {
    Icon: HeadsetIcon,
    title: 'Virtual Office Assistance',
    intro: 'Flexible day-to-day support without the overhead of an in-house office team.',
    points: [
      'Scheduling',
      'Client follow-ups',
      'Online research',
      'Digital file management',
      'Routine office coordination',
      'Remote administrative assistance',
    ],
  },
  {
    Icon: ChartIcon,
    title: 'Data Management & Reporting',
    intro: 'Keep important information organized, accurate, and easy to understand.',
    points: [
      'Data organization',
      'Spreadsheet cleanup',
      'Progress reports',
      'Status tracking',
      'Record maintenance',
      'Simple dashboards and reporting',
    ],
  },
]

const values = [
  {
    title: 'Reliable',
    text: 'We take deadlines, records, follow-ups, and communication seriously.',
  },
  {
    title: 'Flexible',
    text: 'Support can be adapted to one-time projects, recurring work, or ongoing operations.',
  },
  {
    title: 'Personal',
    text: 'You work with people who understand your priorities, workflow, and goals.',
  },
  {
    title: 'Practical',
    text: 'We focus on useful solutions that save time and reduce unnecessary work.',
  },
  {
    title: 'Remote by Design',
    text: 'Based in the Philippines and ready to support clients worldwide.',
  },
]

function Home() {
  const handleContactSubmit = (event) => {
    event.preventDefault()

    const form = new FormData(event.currentTarget)
    const name = form.get('name') || ''
    const email = form.get('email') || ''
    const service = form.get('service') || ''
    const message = form.get('message') || ''

    const subject = encodeURIComponent(`WestPacific Desk Inquiry — ${service}`)
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nService: ${service}\n\nMessage:\n${message}`,
    )

    window.location.href = `mailto:gloujoyce@gmail.com?subject=${subject}&body=${body}`
  }

  return (
    <div className="wp-site" id="home">
      <header className="wp-header">
        <div className="wp-container wp-header-row">
          <a href="#home" className="wp-logo-link" aria-label="WestPacific Desk home">
            <img className="wp-header-logo" src={logo} alt="WestPacific Desk" />
          </a>

          <nav className="wp-nav" aria-label="Main navigation">
            <a className="active" href="#home">Home</a>
            <a href="#services">Services</a>
            <Link to="/about">About</Link>
            <a href="#contact">Contact</a>
          </nav>

          <a className="wp-get-started" href="#contact">
            Get Started
          </a>
        </div>
      </header>

      <main>
        <section className="wp-hero">
          <div className="wp-container wp-hero-grid">
            <div className="wp-hero-copy">
              <h1>
                Reliable Support for Your Students,
                Your Business, and Your Goals.
              </h1>

              <p>
                Administrative support, student assistance, web solutions,
                and more. so you can focus on what matters most.
              </p>

              <div className="wp-hero-buttons">
                <a className="wp-button wp-button-primary" href="#contact">
                  Work With Us <span aria-hidden="true">→</span>
                </a>

                <a className="wp-button wp-button-outline" href="#services">
                  Our Services
                </a>
              </div>
            </div>

            <div
              className="wp-hero-photo"
              style={{ backgroundImage: `url(${hero})` }}
              role="img"
              aria-label="Laptop and coffee on a desk overlooking a tropical beach"
            />
          </div>
        </section>

        <section className="wp-services" id="services">
          <div className="wp-container wp-services-grid">
            {services.map(({ Icon, title }) => (
              <a className="wp-service" href={`#service-${title.toLowerCase().replaceAll(' ', '-').replace('&', 'and')}`} key={title}>
                <Icon />
                <span>{title}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="wp-services-detail">
          <div className="wp-container">
            <div className="wp-section-intro">
              <span className="wp-eyebrow">PROFESSIONAL OFFSHORE SUPPORT</span>
              <h2>Support Built Around the Work You Need Done</h2>
              <p>
                WestPacific Desk provides flexible, dependable support for students,
                professionals, and growing businesses. Whether you need help with
                day-to-day administration, student coordination, website development,
                or ongoing digital support, we help keep things organized, efficient,
                and moving forward.
              </p>
            </div>

            <div className="wp-service-cards">
              {services.map(({ Icon, title, intro, points }) => {
                const id = `service-${title.toLowerCase().replaceAll(' ', '-').replace('&', 'and')}`

                return (
                  <article className="wp-service-card" id={id} key={title}>
                    <div className="wp-service-card-icon">
                      <Icon />
                    </div>

                    <h3>{title}</h3>
                    <p>{intro}</p>

                    <ul>
                      {points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </div>

            <div className="wp-services-cta">
              <div>
                <span className="wp-eyebrow">NEED SOMETHING SPECIFIC?</span>
                <h3>Tell us what you need help with.</h3>
                <p>
                  We’ll build a support arrangement around your workflow, priorities,
                  and the way you prefer to work.
                </p>
              </div>

              <a className="wp-button wp-button-primary" href="#contact">
                Work With Us <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>

        <section
          className="wp-about"
          id="about"
          style={{
            '--palm-left': `url(${palmLeft})`,
            '--palm-right': `url(${palmRight})`,
          }}
        >
          <div className="wp-container wp-about-layout">
            <div className="wp-about-copy">
              <span className="wp-eyebrow">ABOUT WESTPACIFIC DESK</span>
              <h2>Reliable Support From the Pacific, Wherever You Work</h2>

              <p>
                WestPacific Desk is a Philippines-based remote support service providing
                administrative, student, web, and digital assistance to clients around
                the world.
              </p>

              <p>
                We help students, professionals, educators, and growing businesses handle
                the work that takes time but still needs to be done carefully. From keeping
                records organized and following up on important tasks to building websites
                and custom web applications, our goal is simple: make your day-to-day work easier.
              </p>

              <p>
                We believe good support should feel dependable, personal, and uncomplicated.
                That means clear communication, organized workflows, attention to detail,
                and solutions adapted to the way you actually work.
              </p>

              <p>
                Whether you need occasional assistance or ongoing offshore support,
                WestPacific Desk can become a reliable extension of your workflow.
              </p>
            </div>

            <div className="wp-values">
              <span className="wp-eyebrow">WHY WESTPACIFIC DESK</span>

              <div className="wp-values-grid">
                {values.map((value) => (
                  <article className="wp-value-card" key={value.title}>
                    <span className="wp-value-dot" aria-hidden="true">✓</span>
                    <div>
                      <h3>{value.title}</h3>
                      <p>{value.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="wp-container wp-about-signature">
            Your Remote Partner for a Brighter Tomorrow.
          </div>
        </section>

        <section className="wp-contact" id="contact">
          <div className="wp-container wp-contact-grid">
            <div className="wp-contact-copy">
              <span className="wp-eyebrow">LET’S WORK TOGETHER</span>
              <h2>Tell Us What You Need Help With</h2>
              <p className="wp-contact-lead">
                Whether you need student support, administrative assistance, a new
                website, a custom web application, or simply an extra pair of reliable
                hands, we’d be happy to hear from you.
              </p>

              <p>
                Tell us a little about what you need and we’ll discuss how
                WestPacific Desk can support you.
              </p>

              <div className="wp-contact-details">
                <a href="mailto:gloujoyce@gmail.com">
                  <span className="wp-contact-icon" aria-hidden="true">✉</span>
                  <span>
                    <small>Email</small>
                    <strong>gloujoyce@gmail.com</strong>
                  </span>
                </a>

                <a href="https://wa.me/639776324096" target="_blank" rel="noreferrer">
                  <span className="wp-contact-icon" aria-hidden="true">◉</span>
                  <span>
                    <small>WhatsApp</small>
                    <strong>+63 977 632 4096</strong>
                  </span>
                </a>

                <div className="wp-contact-detail">
                  <span className="wp-contact-icon" aria-hidden="true">⌖</span>
                  <span>
                    <small>Location</small>
                    <strong>Philippines</strong>
                    <em>Serving Clients Worldwide</em>
                  </span>
                </div>
              </div>
            </div>

            <div className="wp-contact-form-card">
              <form onSubmit={handleContactSubmit}>
                <div className="wp-form-row">
                  <label>
                    <span>Name</span>
                    <input
                      type="text"
                      name="name"
                      placeholder="Your name"
                      required
                    />
                  </label>

                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      name="email"
                      placeholder="Your email address"
                      required
                    />
                  </label>
                </div>

                <label>
                  <span>What do you need help with?</span>
                  <select name="service" defaultValue="" required>
                    <option value="" disabled>Select a service</option>
                    <option>Student Assistance</option>
                    <option>Administrative Support</option>
                    <option>Web App Development</option>
                    <option>Website Building & Management</option>
                    <option>Virtual Office Assistance</option>
                    <option>Data Management & Reporting</option>
                    <option>Something Else</option>
                  </select>
                </label>

                <label>
                  <span>Message</span>
                  <textarea
                    name="message"
                    rows="6"
                    placeholder="Tell us briefly about the support you need, your timeline, and any important details."
                    required
                  />
                </label>

                <button className="wp-button wp-button-primary wp-contact-submit" type="submit">
                  Send Message <span aria-hidden="true">→</span>
                </button>

                <p className="wp-form-note">
                  Prefer WhatsApp?{' '}
                  <a href="https://wa.me/639776324096" target="_blank" rel="noreferrer">
                    Send us a message directly
                  </a>
                  {' '}and we’ll get back to you as soon as possible.
                </p>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="wp-footer">
        <div className="wp-footer-wave" />

        <div className="wp-container wp-footer-grid">
          <div className="wp-footer-brand">
            <img src={footerLogo} alt="WestPacific Desk" />
          </div>

          <div className="wp-footer-column">
            <h3>Quick Links</h3>
            <a href="#home">Home</a>
            <a href="#services">Services</a>
            <Link to="/about">About</Link>
            <a href="#contact">Contact</a>
          </div>

          <div className="wp-footer-column wp-contact-column">
            <h3>Get In Touch</h3>
            <a href="mailto:gloujoyce@gmail.com">
              <span aria-hidden="true">✉</span>
              gloujoyce@gmail.com
            </a>
            <a href="tel:+639776324096">
              <span aria-hidden="true">◉</span>
              +63 977 632 4096
            </a>
            <p>
              <span aria-hidden="true">⌖</span>
              Philippines
              <small>Serving Clients Worldwide</small>
            </p>
          </div>

          <div className="wp-footer-column">
            <h3>Follow Us</h3>
            <div className="wp-socials">
              <a href="#contact" aria-label="Facebook">f</a>
              <a href="#contact" aria-label="LinkedIn">in</a>
              <a href="mailto:gloujoyce@gmail.com" aria-label="Email">✉</a>
            </div>
          </div>

          <div className="wp-footer-tagline">
            Let’s Build
            <br />
            A Brighter Tomorrow Together.
          </div>
        </div>

        <div className="wp-container wp-copyright">
          © 2025 WestPacific Desk. All rights reserved.
        </div>
      </footer>

      <Link className="wp-admin-link" to="/admin/login">
        Admin
      </Link>
    </div>
  )
}

export default Home
