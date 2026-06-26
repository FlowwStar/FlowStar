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
