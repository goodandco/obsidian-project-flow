---
Type: "Proposal"
Status: "New"
Parent: "[[$_PROJECT_NAME Work]]"
Date: ${DATE}
Project: "[[$_PROJECT_FULL_NAME]]"
tags:
  - type/proposal
  - $_PROJECT_TAG
---

## Summary

{One or two sentences. What are you proposing and why does it matter?
Example: "Introduce a weekly report command to replace manual status updates."}

## Problem

{What's broken, missing, or suboptimal today? Be specific — describe the current state.
Example: "Every Friday the team spends 30min aggregating task updates into a status report.
This is repetitive, error-prone, and delays the actual retrospective."}

## Proposed Solution

{What exactly are you proposing? Describe the solution clearly.
Include scope boundaries — what's in, what's explicitly out.
Example: "A command that queries closed tasks for the current week and generates
a structured markdown report via AI. Manual trigger only — no scheduling."}

## Alternatives Considered

{What other options did you evaluate and why did you reject them?
Example:

- Export to CSV and format manually — too much friction
- Third-party integration — overkill for current team size}

## Expected Outcome

{What does success look like? What changes after this is implemented?
Example: "Report generation takes under 1 minute. Friday retrospectives start on time."}

## Risks and Open Questions

{What could go wrong? What still needs to be figured out?
Example: "AI output quality depends on task descriptions being consistent.
Open: do we need approval before sharing the report externally?"}

## References

{Links, related ideas, tasks, or external resources.}
