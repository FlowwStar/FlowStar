# Security Policy

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
