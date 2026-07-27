# Security Policy

FlowStar handles token streaming workflows on Stellar and Soroban. Please report
suspected vulnerabilities privately so maintainers have time to investigate and
coordinate a fix before details become public.

## Supported Scope

Security reports are in scope when they affect FlowStar-controlled code or
deployment configuration, including:

- Soroban smart contracts in `contracts/`, including authorization, token
  accounting, stream lifecycle logic, and storage behavior.
- Frontend and wallet integration code that prepares, signs, or submits FlowStar
  transactions.
- API routes, RPC integration, transaction building, and client-side stream
  calculations that can affect user funds or permissions.
- CI/CD workflows, deployment scripts, dependency configuration, and secret
  handling owned by this repository.

The following are normally out of scope:

- Vulnerabilities in the Stellar network, Soroban platform, Freighter wallet, or
  third-party services unless they are caused by FlowStar integration code.
- General dependency reports without a demonstrated exploit path in FlowStar.
- Social engineering, phishing, physical attacks, spam, or denial-of-service
  testing that degrades public infrastructure.
- Issues that only affect a local development environment without impact on
  deployed contracts, users, or project maintainers.

## How to Report a Vulnerability

1. Use GitHub's private vulnerability reporting flow:
   <https://github.com/FlowwStar/FlowStar/security/advisories/new>
2. Include a clear description, affected files or contract functions, impact,
   reproduction steps, and any proof of concept needed to validate the issue.
3. If funds or keys may be at risk, include the affected network, contract ID,
   token, account role, and whether the issue is reproducible on testnet,
   mainnet, or both.
4. Do not open a public issue or pull request containing exploit details before
   maintainers have triaged the report.

If private vulnerability reporting is not enabled for this repository, open a
minimal public issue asking maintainers for a private security contact. Do not
include exploit details in that issue.

## Response Timeline

Maintainers should aim for the following response windows:

| Step | Target |
| --- | --- |
| Acknowledge report | Within 48 hours |
| Initial triage | Within 1 week |
| Critical fix or mitigation | Within 72 hours after confirmation |
| High severity fix or mitigation | Within 1 week after confirmation |
| Medium severity fix or mitigation | Within 2 weeks after confirmation |
| Low severity fix | Best effort, based on project priorities |

Complex smart contract issues may require more time for testing, deployment, or
coordinated disclosure. Maintainers should keep the reporter updated when the
timeline changes.

## Severity Guide

Use the following guide when estimating impact:

| Severity | Examples |
| --- | --- |
| Critical | Unauthorized withdrawal or cancellation of streams, theft or permanent loss of user funds, private key or secret exposure, exploit that affects deployed contracts at scale |
| High | Authorization bypass, transaction manipulation, incorrect accounting that can move funds under specific conditions, CI/CD compromise path |
| Medium | Incorrect balances or stream state display that can mislead users into signing harmful transactions, limited data exposure, dependency issue with a practical FlowStar exploit path |
| Low | Hardening gaps, missing security headers, informational leakage without direct fund or permission impact |

CVSS may be used when helpful, but a practical explanation of exploitability and
user impact is more important than a score alone.

## Safe Harbor

FlowStar welcomes good-faith security research. If you comply with this policy,
avoid privacy violations, avoid data destruction, do not exfiltrate funds or
secrets, and report vulnerabilities promptly, the project will not pursue legal
action against you for the research activity itself.

Researchers should:

- Test on local environments or testnet whenever possible.
- Stop testing and report immediately if user funds, private data, or project
  secrets may be exposed.
- Access only the minimum data needed to prove the issue.
- Give maintainers a reasonable opportunity to remediate before public
  disclosure.

## Bug Bounty and Recognition

This policy does not create a standing cash bounty or guarantee payment. If a
linked issue, campaign, or external program offers rewards, eligibility,
severity, payout, and disclosure rules are governed by that program. Maintainers
may still credit good-faith reporters in release notes or advisories when both
parties agree.

## Maintainer Setup

To make the reporting path work, repository maintainers should enable GitHub
private vulnerability reporting or GitHub Security Advisories for FlowStar. The
private reporting link above should then route researchers away from public
issues and toward coordinated disclosure.
## Scope

The following are **in scope** for vulnerability reports:

- **Smart contract** (`contracts/streaming/`) — logic errors, authorization bypasses, fund-loss vectors, integer overflow/underflow
- **Frontend** (`app/`, `components/`, `hooks/`, `lib/`) — XSS, CSRF, wallet-key exposure, data leakage
- **CI/CD pipeline** — supply-chain attacks, secret exposure in workflows

The following are **out of scope**:

- Vulnerabilities in third-party dependencies (report to their maintainers directly)
- The Stellar network or Soroban runtime itself
- Issues requiring physical access to a user's device
- Social engineering attacks

---

## Reporting a Vulnerability

**Preferred:** Use [GitHub Security Advisories](https://github.com/FlowwStar/FlowStar/security/advisories/new) to open a private advisory. This keeps the report confidential until a fix is ready.

**Email fallback:** For urgent critical issues, email the maintainers at the address listed on the GitHub profile. Include:
1. A clear description of the vulnerability
2. Steps to reproduce or a proof-of-concept
3. Affected component(s) and version/commit hash
4. Your assessment of impact and severity

Please **do not** open a public GitHub issue for security vulnerabilities.

---

## Response Timeline

| Stage | Target |
|---|---|
| Acknowledgment | Within 48 hours |
| Triage & severity classification | Within 1 week |
| Fix (Critical) | Within 72 hours of triage |
| Fix (High) | Within 1 week of triage |
| Fix (Medium) | Within 2 weeks of triage |
| Fix (Low) | Next scheduled release |

We will keep you updated throughout the process and credit you in the release notes unless you prefer to remain anonymous.

---

## Severity Classification

We use a simplified severity scale:

| Severity | Description |
|---|---|
| **Critical** | Direct loss of user funds, private key exposure, or complete contract takeover |
| **High** | Unauthorized access to user data, bypass of core authorization checks |
| **Medium** | Denial of service for individual users, data integrity issues without fund loss |
| **Low** | Minor information disclosure, cosmetic security issues |

---

## Safe Harbor

FlowStar is committed to working with security researchers. If you discover a vulnerability and report it responsibly under this policy:

- We will not pursue legal action against you
- We will not refer you to law enforcement
- We will work with you to understand and resolve the issue quickly

We ask that you:

- Give us reasonable time to respond before public disclosure
- Avoid accessing or modifying user data beyond what is necessary to demonstrate the vulnerability
- Do not perform denial-of-service attacks or disrupt live services

---

## Bug Bounty

There is no formal bug bounty program at this time. We will publicly credit researchers who report valid vulnerabilities (unless anonymity is requested).
