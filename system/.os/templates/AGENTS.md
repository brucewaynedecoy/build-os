# Templates Router (`.os/templates`)

Starting shapes to **copy** when creating system artifacts. The **authority** is in [`../contracts/`](../contracts/) — templates are conveniences, not contracts. Copy the matching template, then conform it to its contract.

## Templates

- [`guardrail-playbook.md`](guardrail-playbook.md) — guardrail playbook shape.
- [`instance-config.yaml`](instance-config.yaml) — neutral starter for [`../config/instance.yaml`](../config/instance.yaml).
- [`procedure-playbook-explicit-steps-standing.md`](procedure-playbook-explicit-steps-standing.md) — standing procedure with ordered, required steps.
- [`procedure-playbook-explicit-steps-stateful.md`](procedure-playbook-explicit-steps-stateful.md) — stateful procedure with prerequisites and ordered, required state changes.
- [`procedure-playbook-guided-objective-standing.md`](procedure-playbook-guided-objective-standing.md) — standing procedure guided by outcome, decision points, and boundaries.
- [`procedure-playbook-guided-objective-stateful.md`](procedure-playbook-guided-objective-stateful.md) — stateful procedure guided by starting state, target state, and transition guidance.
- [`procedure-playbook-inferred-actions-standing.md`](procedure-playbook-inferred-actions-standing.md) — standing agent procedure where actions are inferred from context.
- [`procedure-playbook-inferred-actions-stateful.md`](procedure-playbook-inferred-actions-stateful.md) — stateful agent procedure where state-changing actions are inferred from evidence.
