# Incident Investigation

An AI-assisted tool that helps a responder investigate a messy production problem by weighing operational evidence, forming hypotheses, and recommending next actions.

## Language

**Incident**:
The real-world production problem being investigated.
_Avoid_: Outage, issue, ticket

**Investigation**:
The evolving working state the system holds about one Incident: what it has seen, what it believes, and why.
_Avoid_: Session, case, analysis

**Wave**:
A batch of Evidence that arrives together and triggers one update to the Investigation.
_Avoid_: Batch, tick, round

**Evidence**:
Any single input item (alert, log excerpt, deploy note, chat message, runbook, prior incident note, responder note) with a stable identifier and a source type.
_Avoid_: Input, data, artifact

**Responder Note**:
Evidence created by the human responder, such as a stated fact, an action taken, or the rejection of a Hypothesis.
_Avoid_: Comment, feedback, user message

**Signal**:
Evidence the Investigation judges relevant to the Incident, with a stated reason.
_Avoid_: Finding, clue

**Noise**:
Evidence the Investigation judges irrelevant, kept with a stated reason rather than discarded.
_Avoid_: Junk, filtered

**Hypothesis**:
A candidate explanation of cause, impact, or contributing factor, with a status (open, supported, refuted), a confidence, and the Evidence that supports or contradicts it.
_Avoid_: Theory, guess, root cause (until confirmed)

## Rules of the language

- Evidence may move between Signal and Noise as the Investigation learns more; each reclassification is recorded with its reason.
- A Hypothesis is never asserted without citing Evidence.
- The Investigation changes only through Waves; conversation with the responder changes it only by producing a Responder Note.
