# Lab 04: freeze window + HITL destructive shell

Two separate packages (same `package policy` name, different folders) so `opa test` does not collide.

- `freeze/`: logic deny for change actions during business hours
- `hitl/`: intervention with `approval_required` for destructive shell
