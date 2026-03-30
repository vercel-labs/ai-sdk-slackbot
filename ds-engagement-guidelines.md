Here’s the same text with all emojis removed and nothing else changed:

⸻

Developer Success (DS) / DSE Engagement Scope

Use this guide to decide when to engage DS/DSEs vs. when to re-route a request.

⸻

Engage Developer Success (DS) / DSEs when the request involves:

1. Time-boxed onboarding, go-live, or hypercare
	•	Structured or ad-hoc onboarding / enablement sessions to walk customers through Vercel features, workflows, and best practices.
	•	Single enablement sessions for lower-ARR customers that don’t qualify for a full DSE onboarding program, paired with async follow-up and self-serve resources.
	•	High-leverage, time-bounded technical acceleration (DS is not an embedded consultant).

2. Deep technical debugging & performance investigations
	•	Issues involving cold starts, latency, routing, caching, ISR behavior, or runtime configuration.
	•	Use of Observability, tracing, logs, or repo/code inspection to diagnose issues.
	•	Reproducing problems in POCs or test apps and recommending concrete fixes.
	•	Determining Vercel platform vs application/integration issues (including confirming when it’s not a Vercel infra issue).

3. Usage, cost, and efficiency guidance (technical)
	•	Targeted reviews of usage drivers (Fast Data Transfer, Edge Requests, ISR writes, runtime duration).
	•	Analysis of overage or On-Demand spikes after changes (e.g., framework upgrades, prefetch behavior).
	•	Recommendations that balance performance vs cost, including mitigations like caching strategies or bot filtering.
	•	Lightweight usage audit–style guidance for strategic or churn-risk accounts.

4. Product & feature guidance (how to use Vercel effectively)
	•	Recommending and explaining Vercel features (e.g., Skew Protection, Session Tracing, Bot Protection, preview domains, build caching, Turbopack).
	•	Guidance on framework behavior on Vercel (e.g., Next.js caching, routing, prefetching).
	•	Clarifying what’s normal vs what’s worth optimizing (build times, routing latency, cold starts).
	•	v0 product guidance, customer-specific v0 troubleshooting, and v0 usage questions.
	•	Customer-specific v0 issues follow the same pattern as Vercel platform issues — DSE investigates first, then routes to v0 team only if confirmed as a platform-wide v0 bug.

5. One-off technical calls or async guidance
	•	Short calls to:
	•	Walk through findings already investigated async.
	•	Reinforce recommendations and build customer confidence.
	•	Align on ownership and next steps.
	•	One-off calls via #help-dev-success for accounts without a Platform Architect (PA).

6. Internal partnership & escalation
	•	Triage complex cases and escalate to infra / CDN / Next.js / product teams when issues appear platform-level.
	•	Partner with SEs, CSMs, PAs, Pro Services on renewals, upsells, or competitive saves.
	•	Surface CSQO-style expansion signals discovered during technical work and share with revenue teams.

⸻

Out of Scope (Re-route these requests)

1. Long-term or embedded technical ownership
	•	DS/DSEs do not act as ongoing TCs or permanent technical contacts.
	•	Long-term ownership belongs to PAs or designated TCs on qualifying Enterprise accounts.

2. Full implementation or delivery work
	•	DS provides guidance, reviews, and patterns, not full feature builds or app ownership.
	•	Requests needing implementation capacity → Professional Services or partners.
	•	Especially out of scope: Sitecore implementations and complex security/network builds.

3. Prolonged training for low-ARR accounts
	•	Multi-session onboarding programs are reserved for customers above ~$100k ARR (varies by region/strategy).
	•	For lower-ARR customers, DS may offer:
	•	One enablement session
	•	Docs and checklists
	•	Referral to paid Pro Services training for deeper needs

4. Pricing, commercial, or contract operations
	•	Pricing models, cost calculations, or commercial structuring → Sales Engineering / FinOps (e.g., #help-finfra).
	•	Contract changes, entitlements, SFDC ops, team ID moves → Deal Desk / Enterprise Activation / SFDC Ops.
	•	Seat management or upgrades/downgrades → Customer org admin + AE; DS can only share docs.

5. Deep work in non-Vercel or third-party systems
	•	DS does not design or implement Sitecore, external CDNs/WAFs, or partner-managed infra.
	•	DS scope is limited to how those systems integrate with Vercel.

6. Support queue ownership or incident management
	•	DS is not first-line support and does not own ticket queues.
	•	DS does not run platform incidents; infra/product teams own incidents, with DS providing context as needed.

7. White-glove hand-holding when async guidance is sufficient
	•	Preferred pattern:
	•	Clear written guidance
	•	Optional single call to explain and align
	•	Repeated step-by-step hand-holding → paid consulting if required.

⸻

Triage Summary for Agents
	•	Engage DS/DSE when the ask is time-boxed, technical, and high-leverage, aimed at adoption, performance, cost efficiency, or smooth onboarding/go-live.
	•	Re-route when the request is long-term, commercial, implementation-heavy, operational, or better served by Pro Services, SE/FinOps, Support, or partners.
	•	v0 customer-specific issues ARE in-scope — only platform-wide v0 bugs/outages are routed out.

⸻
