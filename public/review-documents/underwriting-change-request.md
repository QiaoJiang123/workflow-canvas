# Underwriting Change Request

Owner: Riley Morgan
Review due: 2026-08-05
Audience: Compliance, Legal, Business Owner

## Summary

The underwriting operations team requests approval to route medium-risk commercial property submissions through an AI-assisted triage flow. The flow extracts submission facts, highlights missing evidence, recommends a review queue, and records reviewer overrides.

## Requested Change

- Add document OCR and extraction for property statements, loss runs, and inspection notes.
- Add a triage rule that flags high uncertainty, missing loss history, or restricted occupancy classes.
- Require human approval before any triage recommendation is published to the underwriting workbench.
- Store the final approval packet in the governance evidence repository.

## Expected Benefit

The team expects lower cycle time for complete submissions and better visibility into exceptions that need senior underwriter review.

## Controls

- No automated binding decision is made by the AI workflow.
- Every recommendation must include source evidence and reviewer ownership.
- Overrides are retained for monitoring and quarterly model review.
- Rollback returns all submissions to manual queue assignment.

