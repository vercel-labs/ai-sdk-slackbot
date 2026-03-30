
# Customer Issue → Team Routing Matrix

This matrix summarizes **common customer issues** and the **teams/channels that actually handle them in practice**, based on CSE scope docs and real routing/redirects in Slack.

---

## Quick routing principles

* **Platform is broken / misbehaving → CSE via Support case**, escalate to Engineering only after SME review.

* **Contracts, pricing, renewals, commercial terms → Account team (AE/CSM) + Deal Desk/FinOps as needed.**

* **Self-serve billing mechanics, plan behavior, infra billing edge-cases → Finfra / Billing Ops (#help-finfra).**

* **Security, compliance, DDOS details, questionnaires → Security / Trust / Customer Diligence (#help-customer-diligence-questions, #help-legal).**

* **Abuse, account recovery, registration problems → Trust & Safety (#help-trust-and-safety, account recovery flows).**

* **Implementation, app code, 3rd‑party integrations → Generally out-of-scope for CSE; use Community, Professional Services, or Field Eng / TC for Enterprise advisory.**

---

## Detailed mapping

| Customer issue / ask | Primary owner / team | Where to route | Notes & supporting examples |
|---|---|---|---|
| **“Something is broken on Vercel” (errors, outages, regressions clearly tied to platform)** | **CSE (Customer Success Engineering)** | Customer opens a case at **vercel.com/help** (or via Support Center); internal follow-up in CSE SME / product-area channels and, if needed, `#help-*` engineering channels. | CSE’s scope is “faults associated with the Vercel platform” and engineering mitigations to prevent recurrence. Suspected multi‑customer/high‑severity issues become incidents and/or Engineering escalations via Linear `customer-issue` plus `#help-*`. |
| **Build & deployment failures, CI/CD issues, zero‑config weirdness** | **CSE** (Build & Deployments SME) | Support case → internal to **Build & Deployments** product area SMEs. | Explicitly in-scope: “Build and Deployments (builds, CI/CD issues, etc).” CSE investigates, may escalate to Engineering via Linear if reproducible platform bug. |
| **Functions / Fluid Compute behavior, cold starts, concurrency, 500s from serverless** | **CSE** (Functions / Fluid Compute SME) | Support case; internal SME channels + `#help-*` Compute when escalation needed. | CSE covers “Functions (Fluid Compute, Routing Middleware, etc).” Escalation process: CSE first attempts fix, gets SME +1, then raises Linear `CS Issue` with logs, repro, etc. |
| **Edge Config limits, feature usage questions** | **CSE** + internal **Finfra/pricing** as needed | Support case; CSE can raise internal requests (e.g. to increase Edge Config team limit) with product/finfra. | Example: NerdWallet Edge Config limit increase handled via CSE case and Slack; CSE asked internally, limit was increased and they confirmed impact on billing. |
| **Domains, DNS, SSL / certificate issues** | **CSE** (Domains & DNS SME) | Support case; SME escalation if complex. | CSE list includes “Domains and DNS (domain configuration, domain transfers, SSL certificates, etc).” Out-of-scope when root cause is external DNS or third‑party infra misconfiguration with no Vercel bug. |
| **Platform feature questions (Toolbar, Log Drains, WAF, deployment protection, project security)** | **CSE** | Support case; often triaged by SME area (Platform Features / Project Security). | CSE supports “Platform Features (account settings, Log Drains, Vercel Toolbar, etc)” and “Project Security (Audit Logs, Deployment Protection, Vercel Firewall, etc).” |
| **Usage / billing for self‑serve plans (Hobby/Pro)** | **CSE** (for troubleshooting) + **Finfra/Billing Ops** for system-level changes | Support case + internal `#help-finfra` if behavior is billing‑system related. | CSE owns “Vercel Billing (including usage-based issues for self-serve customers).” For systemic behaviors (e.g., auto‑invoicing toggles, Pro billing flows) teams coordinate with Finfra; Extreme Reach and MasterCard threads were handled in `#help-finfra` and escalated to AE + Deal Desk when policy/contract changes were required. |
| **Enterprise billing questions (invoices, who’s on Enterprise, confusion between Pro vs Enterprise)** | **Account team (AE/CSM)** + **FinOps / Deal Desk / Finfra**, not CSE | Route to AE/CSM and, internally, `#help-billing-ops` / `#help-deal-desk` / Finfra as needed. | CSE docs explicitly say “Enterprise billing (consult the customer’s accounts team).” Softbank case: Enterprise case opened for “plan confusion”; CSE and Safety Ops concluded it’s a contract/provisioning error and pushed to Deal Desk / accounts rather than treating as support. |
| **Plan / pricing questions for Enterprise (what’s included, MIU bundles, SKU pricing, changes at renewal)** | **AE** (with SE/TC support) | Customer should go through **AE / CSM** (e.g. shared Slack, email); internal escalation in account channel / `#help-deal-desk` / `#project-*` pricing channels. | Example: GoTo enterprise case about Fluid Compute pricing; CSE explicitly flagged “contract-related” questions and asked AE to take over while CSE monitored technical thread. Pricing-migration and flex-commit threads show pricing handled by Sales leadership, RevOps, and AE teams—not CSE. Decks describing the account team (AE, Sales Engineer, CSM, Technical Consultant) reinforce that commercial/pricing strategy sits with this group. |
| **Self‑serve customer wants “Enterprise-like” invoicing or exceptions (e.g. Pro team demanding invoice/ACH)** | **AE / Sales leadership + Finfra/Billing Ops** | Internal `#help-finfra` + account channel; likely resolved via **Enterprise contract** or policy exception, not support. | MasterCard Pro account: customer wanted to be invoiced monthly “like an ENT customer”; Finfra and Sales explicitly treated this as a business/plan decision, suggesting Ent or policy changes, not a CSE fix. Similar for Extreme Reach (prior Ent via ACH → downgraded to Pro; resolution was to craft a small Ent contract via AE + Deal Desk). |
| **Contracts, MSAs, DPAs, redlines, legal language** | **Legal** + **AE/CSM** | Route to `#help-legal` and the account team; customer interface is primarily AE/CSM and their counsel. | Contracts and custom terms (MSA, custom invoicing, support SLAs) are framed as commercial/legal scope in Enterprise proposal decks and support terms docs, handled through legal and deal structuring—not CSE. |
| **Security / compliance questionnaires, DDOS guarantees, Trust Center clarifications** | **Security / Trust / Customer Diligence** + **AE** | Internal `#help-customer-diligence-questions` (and sometimes `#help-legal`), with AE owning customer comms. | Example: Baker McKenzie DDOS questions were explicitly routed to `#help-customer-diligence-questions`; Security drafted a detailed written explanation which AE used with the customer, with no CSE involvement. |
| **Abuse reports, DMCA/trademark complaints, account takeover, registration issues** | **Trust & Safety / Security**, not CSE | Route to `#help-trust-and-safety` and/or security email/account recovery flows. | CSE team doc: “Abuse, Copyright/DMCA, or trademark misuse concerns (reach out to #help-trust-and-safety)” and “Registration or account recovery (reach out to #help-trust-and-safety or ask the customer to visit https://vercel.com/accountrecovery).” |
| **Implementation questions, optimization guidance, “how should we architect X on Vercel?”** | **Field Engineering / Technical Consultants / SEs / Professional Services** for Enterprise; **Community** for others | For Enterprise: via **account team** (shared Slack, email) which pulls in SE, TC, or PS. For self‑serve: docs and community, not CSE. | CSE doc explicitly calls out that “Implementation, third party configurations and optimization guidance/training (Enterprise customers can consult their AE or Professional Services)” is **out of scope** for support. Professional Services offerings (Next.js code audits, performance audits, workshops, architecture guidance) are owned by Solutions Engineering / Technical Consultants, not CSE. |
| **Next.js / framework questions not tied to a Vercel platform issue** | **Community / OSS channels**, not CSE | Direct customers to Next.js docs, community forums, or OSS channels; Enterprise may get advisory via TC/SE but not support case ownership. | CSE scope docs say OSS products (Next.js, Svelte, AI SDK, etc.) are supported via community, and “Non‑Vercel Issues (Third-Party Support)” are out-of-scope for support cases. |
| **v0 customer-specific issues (usage, troubleshooting, configuration)** | **DSE** (investigates first, routes to v0 team if confirmed platform-wide bug) | DSE handles customer-specific v0 issues the same way as Vercel platform issues — investigate first, then route if it's a platform-wide v0 bug. | Customer-specific v0 questions (usage guidance, troubleshooting, configuration, integration with Vercel projects) are in-scope for DSE. Only platform-wide v0 bugs/outages route to v0 team. |
| **v0 platform-wide bugs / v0 output generation bugs** | **v0 product team & feedback channels** (not general CSE except incidents) | Use the v0 feedback form on `v0.dev` or product-specific channels; CSE only engages for incidents at billing/dashboard level. | CSE can help with “v0 (billing and dashboard issues)” but “v0 bugs and output generation … the v0 team will only address incidents; to report bugs or feedback, customers must use the v0 feedback form on https://v0.dev.” |
| **Workflow product issues (durability, missing logs, internal errors)** | **Workflow product team** via Engineering; CSE currently limited | Support cases should be created when allowed; many issues are being handled via Project Workflow channels and GitHub issues rather than normal CSE queues until enablement completes. | Slack shows recurring tension here: product/engineering discuss how to enable CSE and when to allow Workflow cases; in the meantime, customers are often redirected to GitHub issues or project channels, and CSE is asked **not** to fully own these yet. |
| **Customer wants a concurrency / limits increase or special infra change (e.g., Edge Config limits, rate limits, Workflow allowances)** | **CSE** to triage and gather requirements, then **Engineering / Product / FinOps** | Start with a Support case; CSE collects technical and business context and then escalates via SME channels and Linear for the owning product team. | “Handling a Customer Case” and escalation docs instruct CSE to gather full technical detail, then escalate via `customer-issue` in Linear and SME +1 before involving AE/CSM or product teams. NerdWallet Edge Config case is an example of CSE brokering a limit increase with product/fininfra. |
| **General “who at Vercel owns me?” or account team questions** | **Account team (AE + CSM + SE + TC)** | Internally: account-specific Slack channel (e.g. `#internal-<customer>`). Customer-facing: AE/CSM email or shared Enterprise Slack channel. | Enterprise proposals and pitch decks describe the account team composition (AE, Sales Engineer, Customer Success Manager, Technical Consultant) and their responsibilities: growth, onboarding, communication, technical alignment, and audits/workshops. |
| **Sales inquiries, expansion, renewals, churn risk, commercial risk (“red accounts”)** | **AE / CSM / Sales leadership** | Account channels (e.g. `#internal-<customer>`, `#red-accounts`, `#deals-lost`). | CSE “Case Handling” explicitly lists “Sales Inquiries”, “Enterprise”, and “Account Changes” as case types that should be handled by another team (account teams) rather than support. Slack shows renewals and lost deals handled in commercial channels, not via CSE queues. |

---

## Edge cases & misrouting patterns

* **Support cases about contracts or pricing:** CSE guidance is to **hand off to AE/CSM** using the Enterprise Hand Off macro when issues relate to contract terms, implementation scope, or exclusive Enterprise benefits.

* **Enterprise cases that are actually Customer Success / Salesforce config issues:** As seen in the “Enterprise Customer Case Routing” thread, mis‑typed record types or case reasons can cause cases to route to the wrong queue; these are corrected by Salesforce ops / CSE ops rather than treated as new escalations.

* **Workflow & emerging products:** Until enablement and tooling are ready, teams often prefer GitHub issues and dedicated project channels; Vertex / bot responses are being tuned to avoid sending these to community when that will not help.

This matrix should be treated as a **starting point**: always favor the documented CSE scope and escalation guides for final authority, and route ambiguous cases through CSE or the AE/CSM rather than guessing.


---

## Sources

- [Case Handling](https://www.notion.so/b387f59a3ded429791545f6d8584b6f2)
- [Meet the CSE Team](https://www.notion.so/68271b9b41a840cba290d2eeddac6bcd)
- [Escalating CSE Cases](https://www.notion.so/8fa371c42bf74b018f7e0760afed1bdc)
- [Thread between Salesforce, Paulo, and 4 others](https://vercel.slack.com/archives/C02H3929Q1W/p1761042304834279)
- [DDoS Protection Clarification for Baker McKenzie](https://vercel.slack.com/archives/C029HAZD4SC/p1766079624984339)
- [MasterCard Billing and Vercel Plan Options](https://vercel.slack.com/archives/C02GL5DDHL1/p1764088497234329)
- [v1 Vercel + ariumliving.com - Enterprise Proposal.pdf](https://vercel.slack.com/files/U0109B8EKR9/F08TEJSG5B8/v1_vercel___ariumliving.com_-_enterprise_proposal.pdf)
- [Extreme Reach Auto Invoicing Issue](https://vercel.slack.com/archives/C02GL5DDHL1/p1766167685607279)
- [Releaf x Vercel ](https://docs.google.com/presentation/d/1ZPjsyF9g04i1lXAXGlubGP5kWguB2OBSu4ONMQJxeX8)
- [Revised Escalation Process](https://www.notion.so/1ade06b059c4814f8004efd6ebebe1ed)
- [NerdWallet Edge Config Limit Increase](https://vercel.slack.com/archives/C02H3929Q1W/p1760387874748759)
- [Softbank Vercel Enterprise Plan Issue](https://vercel.slack.com/archives/C02H3929Q1W/p1764830282799629)
- [Thread between Matt, Michael, Casey, and 4 others](https://vercel.slack.com/archives/C0A2PPBDCAH/p1767974296991409)
- [Premium Support SKU Launch](https://vercel.slack.com/archives/C0XD1TQ8Z/p1763485380737309)
- [Pricing and Billing Migration](https://vercel.slack.com/archives/C09TB2TFWV6/p1767895339757269)
- [▵ The Pitch Deck 2025](https://docs.google.com/presentation/d/1M6ipYMHTZzUpjCDe7bW3D6d8JdrVnMQ28me0ekywKgo)
- [Vercel x Federal Group](https://docs.google.com/presentation/d/1RTgN6Msfzg_2mogJOHKTx0D3Sl5t5vaiNzy_P_5Thho)
- [Workflow Support and Enablement](https://vercel.slack.com/archives/C09125LC4AX/p1766012732920569)
- [Logitech Renewal and Vercel Partnership](https://vercel.slack.com/archives/C09P37DHEB0/p1766182689012049)
- [Plex Lost Renewal Due to Cost](https://vercel.slack.com/archives/C06STMLUCTD/p1753989623792739)
- [Enterprise Customer Case Routing](https://vercel.slack.com/archives/C091RJS6VL1/p1767832628298119)
