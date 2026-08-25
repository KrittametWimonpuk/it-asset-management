import {
  Activity, ArrowDown, ArrowRight, BarChart3, BookOpen, CheckCircle2,
  ClipboardCheck, Cloud, Code2, Container, Database, FileClock, GitPullRequest,
  Headphones, KeyRound, LockKeyhole, Network, Server, ShieldCheck, Sparkles,
  UsersRound, Workflow,
} from 'lucide-react'
import './PortfolioShowcase.css'

const GITHUB_URL = 'https://github.com/KrittametWimonpuk/it-asset-management'

const HIGHLIGHTS = [
  { title: 'Authentication', copy: 'Secure JWT authentication with bcrypt password hashing.', icon: KeyRound },
  { title: 'RBAC', copy: 'Clear access boundaries for Admin, IT Staff, and Employee roles.', icon: UsersRound },
  { title: 'Assignment Lifecycle', copy: 'Complete custody history from assignment through return.', icon: ClipboardCheck },
  { title: 'Dashboard', copy: 'Operational KPIs, warranty health, and real-time summaries.', icon: BarChart3 },
  { title: 'Helpdesk', copy: 'Structured ticket workflow with priority and status tracking.', icon: Headphones },
  { title: 'Reports', copy: 'Filterable previews with CSV, Excel, and PDF export.', icon: Activity },
  { title: 'Audit Log', copy: 'Immutable activity history with before-and-after evidence.', icon: FileClock },
  { title: 'Swagger', copy: 'Interactive OpenAPI 3.1 documentation for 66 endpoints.', icon: BookOpen },
  { title: 'CI/CD', copy: 'Automated quality gates for every push and pull request.', icon: GitPullRequest },
  { title: 'Docker', copy: 'Production-ready containers with Nginx reverse proxy.', icon: Container },
]

const STACK = [
  { name: 'React', detail: 'Frontend', icon: Code2 },
  { name: 'Vite', detail: 'Build Tool', icon: Sparkles },
  { name: 'Express', detail: 'REST API', icon: Server },
  { name: 'Prisma', detail: 'ORM', icon: Workflow },
  { name: 'PostgreSQL', detail: 'Database', icon: Database },
  { name: 'Docker', detail: 'Containers', icon: Container },
  { name: 'GitHub Actions', detail: 'CI/CD', icon: GitPullRequest },
  { name: 'Nginx', detail: 'Web Proxy', icon: Network },
  { name: 'AWS ECS', detail: 'Deployment', icon: Cloud },
]

const TIMELINE = [
  ['v0.2.0', 'Foundation'], ['v0.3.0', 'Asset Details'], ['v0.4.0', 'RBAC'],
  ['v0.5.0', 'Assignments'], ['v0.6.0', 'Dashboard'], ['v0.7.0', 'Helpdesk'],
  ['v0.8.0', 'Reports'], ['v0.8.1', 'OpenAPI'], ['v0.9.0', 'Audit Log'], ['v1.0.0', 'Stable'],
]

const STATS = ['12 Milestones', 'Production Ready', 'CI/CD', 'OpenAPI', 'Audit Logging', 'Responsive UI', 'Dark Mode']
const PREVIEWS = ['Login', 'Dashboard', 'Assets', 'Helpdesk', 'Reports', 'Audit Log']

function BrandMark() {
  return <span className="showcase-brand-mark" aria-hidden="true"><ShieldCheck size={22} /></span>
}

function ProductPreview({ type }) {
  const isLogin = type === 'Login'
  return <div className={`showcase-product-preview is-${type.toLowerCase().replace(' ', '-')}`} aria-hidden="true">
    {isLogin ? <>
      <div className="preview-login-visual"><span className="preview-cloud" /><span className="preview-device large" /><span className="preview-device small" /></div>
      <div className="preview-login-card"><i /><b /><span /><span /><i className="preview-login-submit" /></div>
    </> : <>
      <div className="preview-sidebar"><span /><i /><i /><i /><i /></div>
      <div className="preview-app">
        <header><i /><span /><b /></header>
        <div className="preview-body">
          <div className="preview-title"><b /><span /></div>
          {type === 'Dashboard' && <><div className="preview-kpis"><i /><i /><i /></div><div className="preview-chart"><span /><span /><span /><span /><span /></div></>}
          {type === 'Assets' && <><div className="preview-toolbar"><span /><b /></div><div className="preview-table">{[1,2,3,4].map((row) => <i key={row} />)}</div></>}
          {type === 'Helpdesk' && <><div className="preview-ticket-filters"><i /><i /><i /></div><div className="preview-tickets">{[1,2,3].map((row) => <span key={row}><b /><i /></span>)}</div></>}
          {type === 'Reports' && <><div className="preview-report-grid"><i /><i /><i /><i /></div><div className="preview-report-actions"><span /><b /><b /></div></>}
          {type === 'Audit Log' && <div className="preview-audit">{[1,2,3,4].map((row) => <span key={row}><i /><b /></span>)}</div>}
        </div>
      </div>
    </>}
  </div>
}

export default function PortfolioShowcase({ onViewDemo }) {
  return <main className="showcase-page">
    <a className="showcase-skip" href="#showcase-content">Skip to project overview</a>

    <header className="showcase-nav">
      <a className="showcase-brand" href="#top" aria-label="IT Asset Management home"><BrandMark /><span><strong>IT Asset</strong><small>Enterprise Platform</small></span></a>
      <nav aria-label="Portfolio navigation"><a href="#highlights">Highlights</a><a href="#architecture">Architecture</a><a href="#screenshots">Screenshots</a></nav>
      <button type="button" className="showcase-nav-demo" onClick={onViewDemo}>View Demo <ArrowRight size={15} /></button>
    </header>

    <div id="showcase-content">
      <section id="top" className="showcase-hero" aria-labelledby="showcase-title">
        <div className="showcase-hero-glow" aria-hidden="true" />
        <div className="showcase-container showcase-hero-grid">
          <div className="showcase-hero-copy">
            <span className="showcase-eyebrow"><span /> Production-ready portfolio project</span>
            <h1 id="showcase-title">Enterprise IT<br /><em>Asset Management</em></h1>
            <p>Professional asset tracking platform built for secure operations, accountable ownership, and complete lifecycle visibility.</p>
            <div className="showcase-hero-actions">
              <button type="button" className="showcase-primary-action" onClick={onViewDemo}>View Demo <ArrowRight size={17} /></button>
              <a className="showcase-secondary-action" href={GITHUB_URL} target="_blank" rel="noreferrer"><GitPullRequest size={17} /> GitHub</a>
              <a className="showcase-tertiary-action" href="/api/docs/" target="_blank" rel="noreferrer"><BookOpen size={17} /> API Docs</a>
            </div>
            <div className="showcase-proof"><span><CheckCircle2 size={15} /> Stable v1.0.1</span><span><CheckCircle2 size={15} /> 57 documented endpoints</span><span><CheckCircle2 size={15} /> 3-role RBAC</span></div>
          </div>

          <div className="showcase-command-center" aria-label="Product interface preview">
            <div className="showcase-window-bar"><span><i /><i /><i /></span><small>enterprise-console / overview</small><b>LIVE</b></div>
            <div className="showcase-window-body">
              <aside><BrandMark /><i className="active" /><i /><i /><i /><i /></aside>
              <div className="showcase-window-main">
                <header><span>Enterprise Overview</span><div><i /><i /></div></header>
                <div className="showcase-window-welcome"><div><small>GOOD MORNING</small><strong>Operations at a glance</strong></div><span>24 AUG 2026</span></div>
                <div className="showcase-window-kpis"><article><span>Assets</span><strong>1,284</strong><small>+4.8%</small></article><article><span>Assigned</span><strong>86%</strong><small>Healthy</small></article><article><span>Open tickets</span><strong>18</strong><small>3 critical</small></article></div>
                <div className="showcase-window-panels"><article><header><b>Asset health</b><span>12 months</span></header><div className="showcase-bars">{[44,62,54,76,68,82,72,88,78,92,84,96].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></article><article><header><b>Activity</b><span>Live</span></header>{[1,2,3].map((item) => <div className="showcase-activity" key={item}><i /><span><b /><small /></span></div>)}</article></div>
              </div>
            </div>
          </div>
        </div>
        <a className="showcase-scroll-cue" href="#highlights">Explore the project <ArrowDown size={15} /></a>
      </section>

      <section id="highlights" className="showcase-section showcase-highlights" aria-labelledby="highlights-title">
        <div className="showcase-container">
          <div className="showcase-section-heading"><span>Capabilities</span><h2 id="highlights-title">Built beyond the happy path</h2><p>A complete operational system with security, governance, and deployment considered from day one.</p></div>
          <div className="showcase-highlight-grid">{HIGHLIGHTS.map(({ title, copy, icon: Icon }, index) => <article key={title} style={{ '--delay': `${index * 35}ms` }}><span><Icon size={19} /></span><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </div>
      </section>

      <section className="showcase-section showcase-stack" aria-labelledby="stack-title">
        <div className="showcase-container showcase-stack-layout">
          <div className="showcase-section-heading"><span>Technology Stack</span><h2 id="stack-title">Modern tools.<br />Production discipline.</h2><p>A pragmatic full-stack architecture designed to stay understandable, testable, and deployable.</p></div>
          <div className="showcase-stack-grid">{STACK.map(({ name, detail, icon: Icon }) => <article key={name}><span><Icon size={20} /></span><div><strong>{name}</strong><small>{detail}</small></div></article>)}</div>
        </div>
      </section>

      <section id="architecture" className="showcase-section showcase-architecture" aria-labelledby="architecture-title">
        <div className="showcase-container">
          <div className="showcase-section-heading centered"><span>System Architecture</span><h2 id="architecture-title">A clear path from interface to data</h2><p>Purposeful separation keeps every layer focused and maintainable.</p></div>
          <div className="showcase-architecture-flow">
            {[['Frontend', 'React + Vite', Code2], ['API', 'Express REST', Server], ['Prisma', 'Type-safe ORM', Workflow], ['PostgreSQL', 'Relational data', Database]].map(([title, detail, Icon], index) => <div className="showcase-architecture-step" key={title}><article><span><Icon size={23} /></span><small>0{index + 1}</small><strong>{title}</strong><p>{detail}</p></article>{index < 3 && <ArrowRight className="showcase-flow-arrow" aria-hidden="true" />}</div>)}
          </div>
          <div className="showcase-architecture-note"><LockKeyhole size={16} /><span>JWT + RBAC enforced at the API layer</span><i /><span>Containerized deployment through Nginx to AWS ECS</span></div>
        </div>
      </section>

      <section className="showcase-section showcase-timeline" aria-labelledby="timeline-title">
        <div className="showcase-container">
          <div className="showcase-section-heading"><span>Project Timeline</span><h2 id="timeline-title">From foundation to stable release</h2><p>Ten deliberate releases, each delivering one cohesive engineering milestone.</p></div>
          <ol className="showcase-release-track">{TIMELINE.map(([version, label], index) => <li key={version} className={index === TIMELINE.length - 1 ? 'current' : ''}><span>{index + 1}</span><div><strong>{version}</strong><small>{label}</small></div></li>)}</ol>
        </div>
      </section>

      <section className="showcase-stat-band" aria-label="Project statistics"><div className="showcase-container"><div className="showcase-stat-intro"><span>Engineering Snapshot</span><strong>Built to ship.</strong></div>{STATS.map((stat, index) => <div className="showcase-stat" key={stat}><strong>{index === 0 ? '12' : <CheckCircle2 size={20} />}</strong><span>{index === 0 ? 'Milestones' : stat}</span></div>)}</div></section>

      <section id="screenshots" className="showcase-section showcase-screenshots" aria-labelledby="screenshots-title">
        <div className="showcase-container">
          <div className="showcase-section-heading centered"><span>Product Tour</span><h2 id="screenshots-title">A consistent enterprise experience</h2><p>Six focused workspaces designed around real IT operations.</p></div>
          <div className="showcase-preview-grid">{PREVIEWS.map((title, index) => <article key={title} className={index === 0 || index === 3 ? 'featured' : ''}><header><div><span>0{index + 1}</span><h3>{title}</h3></div><small>Product preview</small></header><ProductPreview type={title} /></article>)}</div>
        </div>
      </section>

      <section className="showcase-cta"><div className="showcase-container"><div><span>Explore the working product</span><h2>See the full lifecycle in action.</h2><p>Open the demo to review the dashboard, asset workflows, reports, and audit trail.</p></div><button type="button" onClick={onViewDemo}>Launch Demo <ArrowRight size={18} /></button></div></section>
    </div>

    <footer className="showcase-footer"><div className="showcase-container"><a className="showcase-brand" href="#top"><BrandMark /><span><strong>IT Asset Management</strong><small>v1.0.1 Stable</small></span></a><div><span>MIT License</span><a href={GITHUB_URL} target="_blank" rel="noreferrer"><GitPullRequest size={15} /> GitHub Repository</a></div></div></footer>
  </main>
}
