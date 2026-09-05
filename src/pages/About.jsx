import { Link } from 'react-router-dom'
import logo from '../assets/westpacific-logo.png'
import footerLogo from '../assets/westpacific-logo-footer-white.png'
import joycePhoto from '../assets/joyce.png'
import fernandoPhoto from '../assets/fernando.png'
import louiePhoto from '../assets/louie.png'
import './Home.css'
import './About.css'

const team = [
  {
    name: 'Lou Joyce Garcia-Galang, RN, MSN',
    role: 'Founder · Student Support & Administrative Services',
    image: joycePhoto,
    featured: true,
    paragraphs: [
      `Lou Joyce Garcia-Galang, RN, MSN, is the founder and heart behind WestPacific Desk. As a registered nurse, educator, and mother of two, Joyce understands what it means to balance professional ambition, family responsibilities, and the realities of building a better future.`,
      `Her journey began in nursing, a profession she deeply respects, but one that also showed her how difficult it can be to build financial stability while working demanding hours in the Philippines. Like many professionals and parents, she wanted a way to continue using her skills while also being present for her family.`,
      `Working from home gave Joyce that opportunity. Over time, she began assisting nursing students with organization, coursework coordination, progress tracking, deadlines, and the everyday challenges that come with completing a demanding nursing program.`,
      `What she discovered was that many capable students do not struggle because they lack ability. Sometimes they simply need structure, accountability, encouragement, and someone dependable in their corner. Helping students move closer to graduation became more than work, it became something deeply meaningful.`,
      `That experience became the foundation of WestPacific Desk: a service built around the belief that reliable support can give people more time, less stress, and a better opportunity to succeed.`,
      `Today, Joyce continues to work closely with students and clients while raising her two children, showing that professional growth and family life do not always have to compete with one another.`,
    ],
  },
  {
    name: 'Nan Galang',
    role: 'Technical Lead · IT Specialist & Support Engineer',
    image: fernandoPhoto,
    paragraphs: [
      `Nan Galang leads the technical side of WestPacific Desk. An IT specialist and Support Engineer, Nan has built his career around solving problems, supporting technology, and keeping systems working reliably behind the scenes.`,
      `He currently works remotely with a VoIP technology company, giving him firsthand experience with remote operations, technical support, communications systems, troubleshooting, and the realities of supporting clients in an always-connected environment.`,
      `Technology has always been more than a profession for Nan. It is also a personal interest. He enjoys exploring new tools, building web applications, improving workflows, working with networks and systems, and finding practical ways technology can make everyday work easier.`,
      `At WestPacific Desk, Nan handles the technical side of the business, including website development, web applications, systems, integrations, troubleshooting, and digital infrastructure.`,
      `His approach is straightforward: technology should solve problems, not create more of them.`,
    ],
  },
  {
    name: 'Louie Crespo',
    role: 'Operations Support Associate',
    image: louiePhoto,
    paragraphs: [
      `Louie Crespo provides valuable operational support to the WestPacific Desk team.`,
      `While much of our work happens remotely, there are still times when something needs to be handled in person. Louie helps bridge that gap by assisting Joyce and Nan with on-site errands, document handling, coordination, data entry, and other day-to-day tasks that help keep operations moving.`,
      `His willingness to step in wherever needed makes him an important part of the team and allows WestPacific Desk to stay organized both online and offline.`,
    ],
  },
]

function About() {
  return (
    <div className="wp-site about-page">
      <header className="wp-header">
        <div className="wp-container wp-header-row">
          <Link to="/" className="wp-logo-link" aria-label="WestPacific Desk home">
            <img className="wp-header-logo" src={logo} alt="WestPacific Desk" />
          </Link>

          <nav className="wp-nav" aria-label="Main navigation">
            <Link to="/">Home</Link>
            <Link to="/#services">Services</Link>
            <Link className="active" to="/about">About</Link>
            <Link to="/#contact">Contact</Link>
          </nav>

          <Link className="wp-get-started" to="/#contact">
            Get Started
          </Link>
        </div>
      </header>

      <main>
        <section className="about-hero">
          <div className="wp-container about-hero-inner">
            <span className="wp-eyebrow">THE PEOPLE BEHIND WESTPACIFIC DESK</span>

            <h1>
              Built From Experience.
              <br />
              Driven by Family.
              <br />
              Focused on Helping Others Move Forward.
            </h1>

            <p>
              WestPacific Desk began with a simple idea: build meaningful work from home
              while helping other people reach their goals. What started with supporting
              nursing students grew into a small family-driven team providing student
              assistance, administrative support, technology solutions, and dependable
              remote services to clients around the world.
            </p>
          </div>
        </section>

        <section className="about-story-strip">
          <div className="wp-container about-story-strip-inner">
            <div>
              <span>Philippines Based</span>
              <strong>Supporting Clients Worldwide</strong>
            </div>
            <div>
              <span>Built Around</span>
              <strong>Family, Flexibility & Purpose</strong>
            </div>
            <div>
              <span>Focused On</span>
              <strong>Reliable, Human Support</strong>
            </div>
          </div>
        </section>

        <section className="about-team">
          <div className="wp-container">
            {team.map((member, index) => (
              <article
                className={`about-person ${index % 2 === 1 ? 'reverse' : ''} ${member.featured ? 'featured' : ''}`}
                key={member.name}
              >
                <div className="about-person-photo-wrap">
                  <div className="about-person-photo">
                    <img src={member.image} alt={member.name} />
                  </div>
                  {member.featured && (
                    <span className="about-founder-badge">Founder</span>
                  )}
                </div>

                <div className="about-person-copy">
                  <span className="about-person-role">{member.role}</span>
                  <h2>{member.name}</h2>

                  <div className="about-person-text">
                    {member.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="about-closing">
          <div className="wp-container about-closing-card">
            <span className="wp-eyebrow">MORE THAN AN OFFSHORE SUPPORT COMPANY</span>

            <h2>Small Team. Personal Support. Work That Matters.</h2>

            <p>
              We are a small team, and we consider that one of our strengths.
              Our clients are not passed from department to department. We get to know
              the people we work with, understand what they are trying to accomplish,
              and find practical ways to help.
            </p>

            <p>
              From nursing students working toward graduation to business owners trying
              to reclaim more of their time, our goal is the same:
              <strong> help good people move forward.</strong>
            </p>

            <p>
              From our desk in the Philippines to yours, wherever you may be,
              we’re here to support the work behind your goals.
            </p>

            <div className="about-closing-signature">
              Your Remote Partner for a Brighter Tomorrow.
            </div>

            <div className="about-closing-actions">
              <Link className="wp-button wp-button-primary" to="/#contact">
                Work With Us <span aria-hidden="true">→</span>
              </Link>

              <Link className="wp-button wp-button-outline" to="/#services">
                Explore Services
              </Link>
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
            <Link to="/">Home</Link>
            <Link to="/#services">Services</Link>
            <Link to="/about">About</Link>
            <Link to="/#contact">Contact</Link>
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
              <a href="/#contact" aria-label="Facebook">f</a>
              <a href="/#contact" aria-label="LinkedIn">in</a>
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
    </div>
  )
}

export default About
