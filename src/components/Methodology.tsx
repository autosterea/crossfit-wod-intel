import type { CrossFitData } from '../types'

interface Props {
  data: CrossFitData
}

function SectionBadge({ num }: { num: number }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/15 text-blue-400 text-xs font-bold font-mono shrink-0">
      {num}
    </span>
  )
}

function SectionCard({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border border-[#1e1e3a] rounded-xl bg-[#0c0c18] overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1e1e3a] bg-[#0a0a14]">
        <SectionBadge num={num} />
        <h2 className="text-lg font-bold text-slate-200">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4 text-sm text-slate-300 leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function Citation({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs text-slate-500 leading-relaxed pl-4 border-l-2 border-[#1e1e3a]">
      {children}
    </p>
  )
}

function WarningItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-amber-400 mt-0.5 shrink-0" title="Limitation">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-slate-200 pt-2">{children}</h3>
}

function StatMethod({ name, what, howUsed, citation }: { name: string; what: string; howUsed: string; citation: string }) {
  return (
    <div className="border border-[#1e1e3a] rounded-lg bg-[#0a0a14] p-4 space-y-2">
      <h4 className="text-sm font-bold text-blue-400">{name}</h4>
      <div>
        <span className="text-xs font-semibold text-slate-400">What it measures: </span>
        <span className="text-xs text-slate-300">{what}</span>
      </div>
      <div>
        <span className="text-xs font-semibold text-slate-400">How we use it: </span>
        <span className="text-xs text-slate-300">{howUsed}</span>
      </div>
      <Citation>{citation}</Citation>
    </div>
  )
}

export default function Methodology({ data }: Props) {
  const { total_workouts, date_range, years_covered } = data.overview

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-rose-400 bg-clip-text text-transparent">
          Methodology, Sources &amp; Limitations
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Full transparency on how this analysis was built, what assumptions were made, and where the limitations are.
        </p>
      </div>

      {/* Section 1: Data Source & Collection */}
      <SectionCard num={1} title="Data Source & Collection">
        <SubHeading>Data Source</SubHeading>
        <ul className="list-disc list-outside pl-5 space-y-1.5 text-sm text-slate-300">
          <li>All workout data was collected from <a href="https://www.crossfit.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/30">crossfit.com</a>, the official CrossFit website</li>
          <li>CrossFit.com has published a Workout of the Day (WOD) nearly every day since February 10, 2001</li>
          <li>This dataset contains <span className="text-blue-400 font-mono font-bold">{total_workouts.toLocaleString()}</span> workouts spanning <span className="text-blue-400 font-mono font-bold">{date_range}</span></li>
          <li>Data was initially compiled into a structured dataset through web scraping of publicly available workout pages</li>
          <li>Daily updates are automated via a GitHub Actions workflow that fetches the latest WOD from <span className="font-mono text-xs text-slate-400">crossfit.com/workout/YYYY/MM/DD</span></li>
        </ul>

        <SubHeading>What's Included</SubHeading>
        <ul className="list-disc list-outside pl-5 space-y-1.5 text-sm text-slate-300">
          <li>Workout date, title, and full description text</li>
          <li>Movement classification (30 primary categories, 80 when text-parsed)</li>
          <li>Modality tagging (Monostructural, Gymnastics, Weightlifting, combinations)</li>
          <li>Time domain classification (Sprint, Short, Medium, Long, Strength/Skill)</li>
          <li>Structure type (For Time, AMRAP, EMOM, Max Load, Hero WOD, Benchmark, etc.)</li>
          <li>Load profile (Bodyweight, Light, Moderate, Heavy)</li>
          <li>Named WOD identification (Hero WODs, Benchmark/"Girls" WODs)</li>
        </ul>

        <SubHeading>What's NOT Included</SubHeading>
        <ul className="list-disc list-outside pl-5 space-y-1.5 text-sm text-slate-400">
          <li>Athlete performance data (times, scores, weights lifted)</li>
          <li>Scaling options (only Rx'd prescription is tracked)</li>
          <li>Warm-up or cool-down programming</li>
          <li>Supplemental work or accessory movements</li>
          <li>Workouts from CrossFit affiliates (only crossfit.com mainsite WODs)</li>
        </ul>
      </SectionCard>

      {/* Section 2: Movement Classification Methodology */}
      <SectionCard num={2} title="Movement Classification Methodology">
        <SubHeading>Two Layers of Movement Tracking</SubHeading>

        <div className="border border-[#1e1e3a] rounded-lg bg-[#0a0a14] p-4 space-y-2">
          <h4 className="text-sm font-bold text-emerald-400">Layer 1 — Structured Classification (30 movements)</h4>
          <p className="text-sm text-slate-300">
            The original dataset classifies each workout into 30 canonical movement categories. This was done during initial data processing by mapping exercise descriptions to standardized names. For example, "Strict Pull-ups," "Kipping Pull-ups," and "Butterfly Pull-ups" all map to "PullUp." This provides consistent tracking but loses granularity.
          </p>
        </div>

        <div className="border border-[#1e1e3a] rounded-lg bg-[#0a0a14] p-4 space-y-2">
          <h4 className="text-sm font-bold text-purple-400">Layer 2 — Text-Parsed Extraction (80 movements)</h4>
          <p className="text-sm text-slate-300">
            We additionally scan every workout description using keyword dictionary matching to identify 80 distinct exercises. This catches movements the 30-category system groups together (e.g., "Ring Dip" vs "Bar Dip" vs generic "Dip") and movements it misses entirely (e.g., "Turkish Get-up," "Bear Crawl," "Pegboard").
          </p>
        </div>

        <SubHeading>Limitations of Text Parsing</SubHeading>
        <ul className="list-disc list-outside pl-5 space-y-1.5 text-sm text-slate-300">
          <li>Keyword matching is not perfect — if a workout describes a movement using unusual phrasing, it may be missed</li>
          <li>Some movements share keywords (e.g., "clean" appears in "Clean," "Clean and Jerk," "Squat Clean") — we use longest-match-first to minimize false positives</li>
          <li>Workout descriptions are sometimes truncated in the source data (limited to ~500 characters), which may cut off movements listed at the end</li>
          <li>Creative workout descriptions or non-standard formatting may cause misclassification</li>
          <li>Estimated false negative rate: <span className="text-amber-400 font-mono">~5-10%</span> of movement mentions may be missed</li>
          <li>Estimated false positive rate: <span className="text-amber-400 font-mono">~2-3%</span> of detections may be incorrect</li>
        </ul>
      </SectionCard>

      {/* Section 3: Functional Movement Taxonomy */}
      <SectionCard num={3} title="Functional Movement Taxonomy">
        <SubHeading>Movement-to-Pattern Mapping</SubHeading>
        <p className="text-sm text-slate-300">
          Each of the 30 tracked movements is manually mapped to:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-1.5 text-sm text-slate-300">
          <li><span className="text-slate-200 font-medium">Functional patterns:</span> Vertical Push, Vertical Pull, Horizontal Push, Horizontal Pull, Squat, Hinge, Lunge, Locomotion, Plyometric, Core, Olympic Lift, Overhead Stability</li>
          <li><span className="text-slate-200 font-medium">Muscle groups:</span> Based on primary movers for each exercise</li>
          <li><span className="text-slate-200 font-medium">Physical skills:</span> Which of CrossFit's 10 General Physical Skills each movement primarily develops</li>
          <li><span className="text-slate-200 font-medium">Complexity score:</span> 1-5 scale based on technical difficulty and learning curve</li>
        </ul>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mt-2">
          <p className="text-xs text-amber-300/80">
            These mappings are subjective and represent one coach's classification. Different coaches may reasonably disagree on specific mappings (e.g., whether a Thruster is primarily a "Squat" or a "Vertical Push"). The taxonomy is available in the source code for review: <span className="font-mono text-amber-400">src/data/movement-taxonomy.ts</span>
          </p>
        </div>
      </SectionCard>

      {/* Section 4: Statistical Methods & Citations */}
      <SectionCard num={4} title="Statistical Methods & Citations">
        <p className="text-sm text-slate-400 mb-2">
          Each statistical method used in this analysis is documented below with its purpose, application, and original academic citation.
        </p>

        <div className="space-y-3">
          <StatMethod
            name="Shannon Entropy (Information Theory)"
            what='Measures the randomness/variety in a probability distribution. Higher entropy = more varied.'
            howUsed='We calculate the entropy of movement selection frequency to measure how "constantly varied" the programming is.'
            citation='Shannon, C.E. (1948). "A Mathematical Theory of Communication." Bell System Technical Journal, 27(3), 379-423.'
          />

          <StatMethod
            name="Herfindahl-Hirschman Index (HHI)"
            what="Measures market concentration. Originally from antitrust economics. Range: 1/N (perfectly distributed) to 1 (monopoly)."
            howUsed="Applied to movement frequency to detect if a few movements dominate programming."
            citation='Herfindahl, O.C. (1950). "Concentration in the Steel Industry." Unpublished doctoral dissertation, Columbia University. Hirschman, A.O. (1945). "National Power and the Structure of Foreign Trade." University of California Press.'
          />

          <StatMethod
            name="Chi-Squared Test"
            what="Tests whether an observed frequency differs significantly from an expected frequency."
            howUsed="Tests whether movement co-occurrences are statistically significant (p < 0.01) or could occur by chance."
            citation='Pearson, K. (1900). "On the Criterion that a Given System of Deviations from the Probable in the Case of a Correlated System of Variables is Such that it Can Be Reasonably Supposed to Have Arisen from Random Sampling." Philosophical Magazine, 50(302), 157-175.'
          />

          <StatMethod
            name="Mann-Kendall Trend Test"
            what="Non-parametric test for monotonic trends in time series data. Does not assume normal distribution."
            howUsed={`Tests whether functional movement patterns have statistically significant upward or downward trends over ${years_covered} years.`}
            citation='Mann, H.B. (1945). "Nonparametric Tests Against Trend." Econometrica, 13(3), 245-259. Kendall, M.G. (1975). "Rank Correlation Methods." 4th edition, Charles Griffin.'
          />

          <StatMethod
            name="PageRank"
            what="Measures node importance in a network based on the structure of incoming links. Originally developed for ranking web pages."
            howUsed='Applied to the movement co-occurrence network to identify which movements are most "important" — connected to other highly-connected movements.'
            citation='Brin, S. & Page, L. (1998). "The Anatomy of a Large-Scale Hypertextual Web Search Engine." Computer Networks and ISDN Systems, 30(1-7), 107-117.'
          />

          <StatMethod
            name="Betweenness Centrality"
            what='Measures how often a node lies on the shortest path between other nodes. High betweenness = "bridge" between communities.'
            howUsed="Identifies movements that connect different types of fitness (e.g., Thrusters bridge Weightlifting and Gymnastics)."
            citation='Freeman, L.C. (1977). "A Set of Measures of Centrality Based on Betweenness." Sociometry, 40(1), 35-41.'
          />

          <StatMethod
            name="Markov Chain Analysis"
            what="Models transitions between states based on probability. The next state depends only on the current state (memoryless property)."
            howUsed="Models what modality CrossFit programs after each modality. Computes the steady-state distribution (long-run programming mix)."
            citation='Markov, A.A. (1906). "Extension of the Law of Large Numbers to Dependent Quantities." Izvestiia Fiziko-matematicheskago obshchestva pri Kazanskom universitete, 15(2), 135-156.'
          />

          <StatMethod
            name="Pareto Analysis"
            what="The observation that roughly 80% of effects come from 20% of causes."
            howUsed="Determines what percentage of movements account for 80% of all programming volume."
            citation='Pareto, V. (1896). "Cours d&apos;Economie Politique." Lausanne: F. Rouge.'
          />

          <StatMethod
            name="Linear Regression"
            what="Models the linear relationship between variables. R-squared measures goodness of fit."
            howUsed="Measures trend strength in movement frequency over time."
            citation='Galton, F. (1886). "Regression Towards Mediocrity in Hereditary Stature." Journal of the Anthropological Institute, 15, 246-263.'
          />

          <StatMethod
            name="Z-Score Anomaly Detection"
            what="Measures how many standard deviations a value is from the mean. |z| > 2.5 is considered anomalous."
            howUsed="Identifies workouts with unusually high or low movement counts."
            citation='Standard statistical methodology. See: Grubbs, F.E. (1969). "Procedures for Detecting Outlying Observations in Samples." Technometrics, 11(1), 1-21.'
          />
        </div>
      </SectionCard>

      {/* Section 5: CrossFit Model References */}
      <SectionCard num={5} title="CrossFit Model References">
        <SubHeading>CrossFit's Theoretical Framework</SubHeading>
        <div className="space-y-2">
          <Citation>
            Glassman, G. (2002). "What Is Fitness?" CrossFit Journal, Issue 1. — Defines fitness as "increased work capacity across broad time and modal domains."
          </Citation>
          <Citation>
            Glassman, G. (2007). "Understanding CrossFit." CrossFit Journal, Issue 56. — Describes the methodology of constantly varied functional movements at high intensity.
          </Citation>
          <Citation>
            Glassman, G. (2002). "The Garage Gym." CrossFit Journal, Issue 1. — Early programming philosophy.
          </Citation>
        </div>

        <SubHeading>10 General Physical Skills</SubHeading>
        <p className="text-sm text-slate-300">
          Originally defined by Jim Cawley and Bruce Evans of Dynamax. Categorizes fitness into:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
            <p className="text-emerald-400 font-semibold mb-1">Organic adaptations (training)</p>
            <p className="text-slate-400">Cardiovascular Endurance, Stamina, Strength, Flexibility</p>
          </div>
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
            <p className="text-purple-400 font-semibold mb-1">Neurological adaptations (practice)</p>
            <p className="text-slate-400">Coordination, Agility, Balance, Accuracy</p>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
            <p className="text-blue-400 font-semibold mb-1">Both</p>
            <p className="text-slate-400">Power, Speed</p>
          </div>
        </div>
        <Citation>
          Glassman, G. (2002). "What Is Fitness?" CrossFit Journal, Issue 1, p. 4.
        </Citation>

        <SubHeading>Energy Systems</SubHeading>
        <p className="text-sm text-slate-300">Based on standard exercise physiology:</p>
        <ul className="list-disc list-outside pl-5 space-y-1 text-sm text-slate-300">
          <li><span className="text-rose-400 font-medium">Phosphagen (ATP-CP):</span> 0-10 seconds, max effort</li>
          <li><span className="text-amber-400 font-medium">Glycolytic:</span> 10 seconds to ~2 minutes, high intensity</li>
          <li><span className="text-emerald-400 font-medium">Oxidative:</span> 2+ minutes, sustained effort</li>
        </ul>
        <Citation>
          McArdle, W.D., Katch, F.I., &amp; Katch, V.L. (2015). "Exercise Physiology: Nutrition, Energy, and Human Performance." 8th edition, Wolters Kluwer.
        </Citation>

        <SubHeading>The Hopper Model</SubHeading>
        <p className="text-sm text-slate-300">
          Glassman's concept that true fitness means readiness for any random physical task.
        </p>
        <Citation>
          Glassman, G. (2002). "What Is Fitness?" CrossFit Journal, Issue 1.
        </Citation>
      </SectionCard>

      {/* Section 6: Assumptions & Known Limitations */}
      <SectionCard num={6} title="Assumptions & Known Limitations">
        <SubHeading>Data Completeness</SubHeading>
        <ul className="space-y-2 text-sm text-slate-300">
          <WarningItem>~16% of workouts have "Unknown" time domain classification</WarningItem>
          <WarningItem>~37% have "Unknown" load profile</WarningItem>
          <WarningItem>Workout descriptions are truncated at ~500 characters in some cases</WarningItem>
          <WarningItem>Some early workouts (2001-2003) have sparse descriptions</WarningItem>
        </ul>

        <SubHeading>Classification Subjectivity</SubHeading>
        <ul className="space-y-2 text-sm text-slate-300">
          <WarningItem>Movement-to-modality mapping follows CrossFit's standard M/G/W classification, but edge cases exist (e.g., Wall Balls could be argued as Gymnastics or Weightlifting)</WarningItem>
          <WarningItem>Functional pattern mapping (Push/Pull/Squat/Hinge) is one interpretation — other strength coaches may classify differently</WarningItem>
          <WarningItem>Time domain boundaries (Sprint &lt; 5min, Short 5-10min, etc.) are approximate and may not match every coach's definition</WarningItem>
        </ul>

        <SubHeading>Statistical Caveats</SubHeading>
        <ul className="space-y-2 text-sm text-slate-300">
          <WarningItem>Co-occurrence analysis assumes that movements listed in the same workout description are programmed together, which is true for most but not all cases (some descriptions include warm-up movements)</WarningItem>
          <WarningItem>Trend analysis over {years_covered} years assumes the data collection methodology was consistent throughout, which may not be perfectly true for the earliest years</WarningItem>
          <WarningItem>The 30-movement classification system groups many exercises together, potentially masking variation within categories</WarningItem>
          <WarningItem>PageRank and network centrality metrics are sensitive to the threshold used for including co-occurrence links</WarningItem>
        </ul>

        <SubHeading>Not Analyzed</SubHeading>
        <ul className="space-y-2 text-sm text-slate-300">
          <WarningItem>We do not analyze athlete outcomes or performance improvements</WarningItem>
          <WarningItem>No comparison with other programming methodologies (CompTrain, HWPO, Mayhem, etc.)</WarningItem>
          <WarningItem>No analysis of competition (CrossFit Games) programming</WarningItem>
          <WarningItem>No nutritional or recovery data</WarningItem>
          <WarningItem>Scaling patterns are not tracked</WarningItem>
        </ul>
      </SectionCard>

      {/* Section 7: Reproducibility */}
      <SectionCard num={7} title="Reproducibility">
        <SubHeading>Open Source</SubHeading>
        <p className="text-sm text-slate-300">
          This project is fully open source. All code, data, and methodology are available for review, replication, and critique.
        </p>

        <div className="bg-[#0a0a14] border border-[#1e1e3a] rounded-lg p-4 space-y-3">
          <div>
            <span className="text-xs font-semibold text-slate-400">GitHub Repository: </span>
            <a href="https://github.com/autosterea/crossfit-wod-intel" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 underline decoration-blue-400/30 font-mono">
              github.com/autosterea/crossfit-wod-intel
            </a>
          </div>
        </div>

        <SubHeading>Key Source Files</SubHeading>
        <div className="bg-[#0a0a14] border border-[#1e1e3a] rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <tbody>
              {[
                ['Data', 'src/data/crossfit-data.json', 'Full workout dataset'],
                ['Movement taxonomy', 'src/data/movement-taxonomy.ts', 'Movement-to-pattern mappings'],
                ['Statistical analysis', 'src/utils/statistics.ts', 'Core statistical methods'],
                ['Advanced analysis', 'src/utils/advanced-analysis.ts', 'Network, Markov, entropy analysis'],
                ['Rep/loading extraction', 'src/utils/rep-extractor.ts', 'Rep scheme & load parsing'],
                ['Movement text extraction', 'src/utils/movement-extractor.ts', 'Keyword-based movement detection'],
                ['Daily updater', 'scripts/fetch-daily-wod.mjs', 'GitHub Actions auto-update script'],
              ].map(([label, path, desc], i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-[#0c0c18]' : ''}>
                  <td className="px-3 py-2 text-slate-400 font-medium whitespace-nowrap">{label}</td>
                  <td className="px-3 py-2 font-mono text-blue-400/80">{path}</td>
                  <td className="px-3 py-2 text-slate-500 hidden sm:table-cell">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SubHeading>To Run Locally</SubHeading>
        <div className="bg-[#0a0a14] border border-[#1e1e3a] rounded-lg p-3">
          <code className="text-xs font-mono text-emerald-400">npm install && npm run dev</code>
        </div>

        <p className="text-sm text-slate-400">
          Contributions, corrections, and critiques are welcome via{' '}
          <a href="https://github.com/autosterea/crossfit-wod-intel/issues" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/30">
            GitHub Issues
          </a>.
        </p>
      </SectionCard>

      {/* Section 8: Contact & Citation */}
      <SectionCard num={8} title="Contact & Citation">
        <p className="text-sm text-slate-300">
          If you use this analysis in academic work, coaching materials, or media, please cite as:
        </p>

        <div className="bg-[#0a0a14] border border-[#1e1e3a] rounded-lg p-4">
          <p className="font-mono text-xs text-slate-300 leading-relaxed">
            Dewangan, R. (2026). CrossFit WOD Intelligence: Analysis of {years_covered} Years of CrossFit Programming.<br />
            Available at: <a href="https://autosterea.github.io/crossfit-wod-intel/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">https://autosterea.github.io/crossfit-wod-intel/</a><br />
            GitHub: <a href="https://github.com/autosterea/crossfit-wod-intel" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">https://github.com/autosterea/crossfit-wod-intel</a>
          </p>
        </div>

        <div className="border-t border-[#1e1e3a] pt-4 mt-2">
          <p className="text-sm text-slate-300">For questions, corrections, or collaboration:</p>
          <p className="text-sm text-slate-200 font-medium mt-1">
            Created by Ravikant Dewangan <span className="text-slate-500">|</span> MS S&amp;C <span className="text-slate-500">|</span> CCFT <span className="text-slate-500">|</span> Head Coach, Persistence Athletics, Seattle
          </p>
        </div>
      </SectionCard>
    </div>
  )
}
