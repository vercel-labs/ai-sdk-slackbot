# DSE Slack Agent - Quick Start Guide

The DSE Slack Agent (`@Dev Success Support Agent`) is an AI-powered bot that helps field team members (AEs, CSMs, SEs) triage customer issues and automatically route them to the Developer Success Engineering (DSE) team or provide guidance on which team should handle the request.

---

## How to Use

Simply @mention the agent in any Slack channel or thread:

```
@Dev Success Support Agent [your request]
```

**Examples:**
- `@Dev Success Support Agent please create a ticket to investigate this cold start issue`
- `@Dev Success Support Agent can DSE help with this ISR cache problem?`
- `@Dev Success Support Agent what types of issues can the DSE team help with?`

**Note:** Your responses are private (ephemeral). Only you see the agent's reply. Tickets posted to DSE team channel are public.

---

## When to Use the Agent

Use the agent when you need to:
- **Engage DSE** for technical debugging, performance investigations, or usage/cost optimization
- **Triage unclear issues** to determine if they're in DSE scope
- **Track ongoing DSE work** by creating documentation tickets
- **Ask about DSE capabilities** (what can DSE help with, when to engage, etc.)

---

## When NOT to Use

- **Urgent production outages** - Ping DSE team directly in #help-dev-success
- **Platform bugs/outages** - The agent will route to CSE, but for speed, go directly
- **Internal DSE discussions** - Use #help-dev-success directly

---

## What Happens Next

**If IN-SCOPE:**
- Agent automatically creates a DSE ticket with customer context, Team ID, priority, and issue summary
- Ticket posted to DSE team channel with descriptive title
- You receive confirmation (ephemeral message)

**If OUT-OF-SCOPE:**
- Agent explains why and provides specific routing guidance
- Tells you which team should handle this (CSE, AE/CSM, Professional Services, etc.)

**If INFORMATIONAL:**
- Agent answers your question about DSE capabilities
- No ticket created

---

## Quick Reference

| Your Situation | What to Say | What Happens |
|----------------|-------------|--------------|
| Customer has technical issue DSE should investigate | `@Dev Success Support Agent create ticket for [issue]` | Ticket created automatically |
| Unsure if DSE can help with an issue | `@Dev Success Support Agent can DSE help with [issue]?` | Agent provides routing guidance |
| Need to track ongoing DSE work | `@Dev Success Support Agent track this work with [customer]` | Documentation ticket created |
| Want to know DSE capabilities | `@Dev Success Support Agent what can DSE help with?` | Agent explains DSE scope |
| Platform outage or billing issue | `@Dev Success Support Agent [describe issue]` | Agent routes to CSE/AE/CSM |

---

## DSE Scope (What DSE Handles)

**IN-SCOPE:**
- Deep technical debugging (cold starts, caching, ISR, routing, session handling)
- Performance investigations and optimization recommendations
- Usage/cost analysis and efficiency guidance
- Time-boxed onboarding, enablement, and go-live support
- Product/feature guidance (how to use Vercel features, framework behavior)
- v0 customer-specific issues (usage questions, troubleshooting, configuration — DSE investigates first, routes to v0 team only if platform-wide bug)

**OUT-OF-SCOPE (Agent will route to appropriate team):**
- Clear platform bugs/outages → CSE (support ticket)
- Platform-wide v0 bugs/outages → v0 feedback form or #v0-customer-help
- v0 billing/dashboard issues → CSE (support ticket)
- Billing, pricing, contract questions → AE/CSM + FinOps/Deal Desk
- Long-term embedded ownership → AE/CSM (Platform Architect evaluation)
- Full implementation work → Professional Services
- Security/compliance → AE/CSM + Security/Legal teams

---

## Tips for Best Results

**Provide context in your request:**
- Customer/company name
- Team ID (format: `team_XXXXXXXXXXXXXXXXXXXXXXXX`)
- What's blocking the customer or why it's urgent
- Brief description of the issue

**Use threads:** If discussing a customer issue in a thread, @mention the agent IN that thread for full context.

**The agent automatically searches** the last ~100 channel messages for Team IDs, Project IDs, and customer context.

---

## Providing Feedback

If something doesn't work as expected:

**Slack DM:** Send Nic Dillon a DM with:
- Your prompt to the agent
- The agent's response
- What you expected vs. what happened

**GitHub Issues:** https://github.com/nicdillon/dshelp-agent/issues

**Urgent DSE needs:** Post directly in #help-dev-success

---

## Common Questions

**Q: Why didn't the agent create a ticket?**
A: The agent classified your request as out-of-scope or informational. Check its response for routing guidance.

**Q: Can I see the ticket?**
A: Yes, tickets are posted in the DSE team channel (usually #help-dev-success).

**Q: What if the agent missed context?**
A: Include important details directly in your message to the agent (Team ID, customer name, etc.).

**Q: How long until DSE responds?**
A: Ticket creation is instant. DSE response depends on priority (SEV 1/2/3) and team workload. Typically a few hours for SEV 3, faster for urgent issues.

---

**Want more details?** See [DETAILED-GUIDE.md](./DETAILED-GUIDE.md) for full examples and scenarios.

**Need help?** Contact Nic Dillon or post in #help-dev-success.
