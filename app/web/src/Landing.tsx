const GITHUB = 'https://github.com/ronkenx9/teampot'
const VERIFIED = `${GITHUB}/blob/main/app/VERIFIED.md`

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav" aria-label="Teampot">
        <a className="landing-brand" href="/" aria-label="Teampot home"><PotMark size={24} /><b>teampot</b></a>
        <nav>
          <a href={VERIFIED}>Verified</a>
          <a href={GITHUB}>GitHub</a>
          <a className="nav-demo" href="/app">Open demo</a>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow">Built on Tempo</p>
            <h1>Every team runs its own money.</h1>
            <p className="hero-line">Finance sets the frame. Departments decide. Everyone's paid and spends from their phone, with limits the network enforces.</p>
            <div className="hero-actions">
              <a className="btn primary" href="/app">Open the live demo</a>
              <a className="btn ghost" href={VERIFIED}>See what's verified</a>
            </div>
          </div>
          {/* Real screenshots of the running demo (captured with Playwright), not mockups. */}
          <figure className="hero-shots">
            <img className="shot-desk" src="/shots/finance.webp" width="1600" height="1000" alt="Teampot Finance view: company map with Design, Engineering and Marketing department accounts and their budgets." />
            <img className="shot-phone" src="/shots/phone.webp" width="600" height="1298" alt="Teampot on a phone: Sam's payday and Design pot with Face ID payments." />
          </figure>
        </section>

        <section className="problem-section" aria-labelledby="problem-title">
          <div>
            <p className="section-kicker">The problem</p>
            <h2 id="problem-title">Every money decision in a company gets choked up to one admin desk.</h2>
          </div>
          <div className="funnel-visual" aria-label="Every department request funnels to Finance">
            <span>Design</span><span>Engineering</span><span>Marketing</span>
            <strong>Finance desk</strong>
          </div>
        </section>

        <section className="steps-section" aria-labelledby="steps-title">
          <p className="section-kicker">How it works</p>
          <h2 id="steps-title">Three moves, then the team can work.</h2>
          <div className="steps">
            <article><span>1</span><h3>Finance funds departments</h3><p>Each department starts with its own account and budget frame.</p></article>
            <article><span>2</span><h3>Heads set their team's rules</h3><p>Approved vendors and limits sit with the people closest to the work.</p></article>
            <article><span>3</span><h3>Everyone pays from their phone</h3><p>Payday, perks, contractors, and team spend run without cards changing hands.</p></article>
          </div>
        </section>

        <section className="audience-section" aria-label="Who Teampot is for">
          <article><h2>For Finance</h2><p>Set budgets, review exceptions, run payday, and see receipts without becoming the company checkout line.</p></article>
          <article><h2>For Department heads</h2><p>Approve the vendors and limits your team actually needs, then send unused budget back cleanly.</p></article>
          <article><h2>For Everyone</h2><p>Use Face ID instead of cards and know immediately when a payment needs approval.</p></article>
        </section>

        <section className="different-section" aria-labelledby="different-title">
          <div>
            <p className="section-kicker">Why it's different</p>
            <h2 id="different-title">The spending frame is enforced by the network, not a spreadsheet.</h2>
            <p>Teampot is built on Tempo, the payments blockchain by Stripe and Paradigm. Each department is its own account, Face ID replaces shared cards, and payday lands in one transaction.</p>
            <a className="btn primary" href={VERIFIED}>See what's verified</a>
          </div>
          <div className="proof-grid">
            <Proof label="Department accounts" value="Real accounts" />
            <Proof label="Rules" value="Network enforced" />
            <Proof label="Cards" value="Face ID" />
            <Proof label="Payday" value="One transaction" />
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <a href={GITHUB}>GitHub</a>
        <span>Demo company · test money</span>
      </footer>
    </div>
  )
}


function MiniKpi({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><b>{value}</b></div>
}

function FillGauge({ ratio, color }: { ratio: number; color: string }) {
  const lit = Math.round(Math.max(0, Math.min(1, ratio)) * 16)
  return (
    <svg className="product-gauge" viewBox="0 0 72 72" aria-hidden>
      {Array.from({ length: 16 }).map((_, i) => {
        const row = Math.floor(i / 4)
        const col = i % 4
        const fillIndex = 15 - i
        return <rect key={i} x={8 + col * 14} y={8 + row * 14} width="10" height="10" rx="3" fill={fillIndex < lit ? color : '#E4DED5'} />
      })}
    </svg>
  )
}

function Proof({ label, value }: { label: string; value: string }) {
  return <article><small>{label}</small><b>{value}</b></article>
}

const PotMark = ({ size = 26 }: { size?: number }) => (
  <svg viewBox="55 176 692 444" width={size * 1.56} height={size} aria-hidden>
    <path fill="#141414" d="M58 302 C100 470 240 615 400 615 C560 615 698 470 743 302 C746 292 738 290 731 293 C620 345 510 376 400 376 C290 376 180 345 69 293 C62 290 55 293 58 302 Z" />
    <path fill="#E8552D" d="M98 207 C220 246 330 252 420 250 C540 247 630 221 690 188 C714 176 724 196 709 216 C640 285 530 318 410 318 C290 318 170 287 99 240 C84 230 86 203 98 207 Z" />
  </svg>
)
