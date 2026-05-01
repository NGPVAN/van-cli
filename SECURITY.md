# Security Policy

The maintainers of `van-cli` take security seriously. This document describes how
to report vulnerabilities and what you can expect from us in return.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, report them privately by email to:

**security@ngpvan.com**

If possible, please include the following information in your report:

- A description of the vulnerability and its potential impact
- Steps to reproduce, including any proof-of-concept code, scripts, or commands
- The version, commit, or branch of `van-cli` affected
- Any relevant configuration, logs, or environment details
- Your name and an optional handle for credit (if you would like to be acknowledged)

You may encrypt sensitive details in your report if needed; contact us at the
address above to coordinate a key exchange.

## Our Commitments

When you report a vulnerability in good faith, we commit to the following:

### Acknowledgment — within 48 hours

We will acknowledge receipt of your report within **48 hours** of submission.
This acknowledgment confirms we have received the report and assigned it to a
responder; it does not yet constitute a triage decision.

### Triage — within 7 calendar days

Within **7 calendar days** of acknowledgment, we will provide an initial triage
response that includes our assessment of severity, whether we have reproduced
the issue, and the next steps we plan to take.

### Remediation timeline

Our target remediation timelines, measured from the date of triage, are:

| Severity | Target fix or mitigation |
| --- | --- |
| Critical | 14 calendar days |
| High | 30 calendar days |
| Medium | 60 calendar days |
| Low | 90 calendar days |

If a fix will take longer than the target window — for example, because it
depends on an upstream dependency or a coordinated release — we will tell you
why and agree on a revised timeline with you.

### Disclosure

We will coordinate public disclosure with you. By default, we will publish a
security advisory once a fix has been released and users have had a reasonable
window to upgrade. We are happy to credit you in the advisory unless you prefer
to remain anonymous.

## Safe Harbor

We support good-faith security research and will not pursue or support legal
action against researchers who:

- Make a good-faith effort to comply with this policy;
- Report the vulnerability promptly to `security@ngpvan.com` and do not
  disclose it to others before we have had a reasonable opportunity to remediate;
- Avoid privacy violations, destruction of data, degradation of service, and
  disruption to production systems or to the experience of other users;
- Only interact with accounts, data, or systems that you own or for which you
  have explicit permission from the account holder;
- Do not exploit a vulnerability beyond the minimum necessary to demonstrate
  the issue, and delete any data obtained as soon as it is no longer needed for
  the report;
- Do not attempt to access, modify, or destroy data belonging to others, and do
  not use social engineering, physical attacks, or denial-of-service techniques.

If your research is conducted in accordance with this policy, we will:

- Treat your activity as authorized under the Computer Fraud and Abuse Act
  (CFAA), the DMCA's anti-circumvention provisions, and analogous state and
  international laws, to the extent we are legally able to do so;
- Work with you to understand and resolve the issue quickly;
- Not pursue or support legal action related to your research.

This safe harbor applies only to the `van-cli` project and other systems
explicitly listed in scope. It does not authorize testing against third-party
services, NGP VAN production environments not owned by you, or any system for
which you do not have authorization. If in doubt about whether your testing is
in scope, please ask us first at `security@ngpvan.com`.

If legal action is initiated by a third party against you for activity that
complied with this policy, we will make this authorization known.

## Out of Scope

The following are generally **not** considered vulnerabilities under this policy:

- Findings from automated scanners without a demonstrated, exploitable impact
- Reports of missing security headers or best-practice hardening without a
  demonstrated security impact
- Denial-of-service attacks, including volumetric, protocol, or rate-based
  attacks against NGP VAN infrastructure
- Social engineering of NGP VAN employees, users, or contractors
- Vulnerabilities in third-party dependencies that have not been integrated
  into a released version of `van-cli` (please report those upstream)

## Questions

For any questions about this policy, contact `security@ngpvan.com`.
