# Adapter Registry

## Purpose

An adapter adds target-platform authoring rules on top of the base Build OS export contract.

The base skill decides *which* Build OS source becomes *which* Azure row. An adapter decides *how deep* the Description and Acceptance Criteria must go, *what property set* each work item must carry, and *what naming and formatting* the target platform requires.

Use an adapter when the backlog describes work on a named commercial platform. Use no adapter for platform-neutral software work.

## Registered adapters

| Adapter id | Target platform | Entry file |
| --- | --- | --- |
| `dynamics-365-ce` | Microsoft Dynamics 365 Customer Engagement / Dataverse / Power Platform | [dynamics-365-ce/ADAPTER.md](dynamics-365-ce/ADAPTER.md) |

Reserved ids for future work: `dynamics-365-fo`, `salesforce`, `servicenow`, `sap-s4hana`, `snowflake`, `azure-infra`.

## Selection procedure

Run this after backlog selection and before manifest creation.

1. Read this registry.
2. Scan the selected `00-index.md`, every included phase file, and the referenced PRD titles for the trigger signals below.
3. Count distinct signal terms for each adapter. Record where each hit occurred.
4. Apply the resolution rules.
5. State the chosen adapter, the evidence, and the required parameters to the user. Get confirmation before manifest creation.

Never select an adapter silently. A wrong adapter produces work items that look correct and are not implementable.

## Trigger signals

### `dynamics-365-ce`

Strong signals. One hit is enough to propose the adapter:

`Dynamics 365 CE`, `Dynamics 365 Customer Engagement`, `Dataverse`, `Power Platform`, `Power Apps`, `Power Automate`, `plug-in registration`, `publisher prefix`, `global choice`, `option set`, `web resource`, `custom API`, `model-driven app`, `business unit`, `security role`, `solution import`, `unmanaged solution`, `managed solution`, `Common Data Service`, `CRM`.

Supporting signals. Two or more hits together propose the adapter:

`plugin`, `entity`, `table and columns`, `main form`, `system view`, `lookup view`, `pre-operation`, `post-operation`, `synchronous`, `asynchronous`, `pre image`, `post image`, `business rule`, `business process flow`, `solution layer`, `environment`, `DEVL`, `sandbox`, `field security profile`.

Negative signals. These indicate a different adapter, not this one:

`Finance and Operations`, `D365 F&O`, `X++`, `AOT`, `Apex`, `Visualforce`, `SOQL`, `Lightning`, `ServiceNow`, `ABAP`.

## Resolution rules

- **One adapter matches.** Propose it. State the top three evidence lines with their file paths.
- **No adapter matches.** Use the base contract only. Say so explicitly in the delivery report.
- **Two or more adapters match.** Stop. Show the evidence per adapter and ask the user to select one. Do not apply two adapters to one CSV.
- **Signals appear in only one phase of a multi-phase backlog.** Ask whether the whole Epic targets that platform. An adapter applies to a whole export, not to part of it.
- **The user names an adapter directly.** Use it. Skip signal scanning. Still enforce the adapter's required parameters.
- **The user says no adapter.** Use the base contract only.

## Project pinning

A repository can pin an adapter so scanning is not needed. Check these in order and use the first that exists:

1. An `azure_boards_adapter` block in the nearest applicable `AGENTS.md`.
2. `.buildos/azure-boards-adapter.json` at the project root.

Pin file shape:

```json
{
  "adapter": "dynamics-365-ce",
  "adapter_params": {
    "publisher_prefix": "jd_"
  }
}
```

A pin removes the scan. It does not remove confirmation of the required parameters when they are absent or look wrong.

## Required-parameter gate

Every adapter declares required parameters in its entry file.

Stop and ask when a required parameter is missing. Do not guess it. Do not use a placeholder. Do not carry a value over from an example, from this repository, or from an unrelated project.

## Manifest keys

An adapter records itself in the manifest so the choice is auditable:

```json
{
  "profile": "target17-new",
  "adapter": "dynamics-365-ce",
  "adapter_params": { "publisher_prefix": "jd_" },
  "items": []
}
```

The emitter fails when `adapter` names an unregistered adapter, or when a required parameter is missing.

## Adding a new adapter

Create `adapters/<id>/ADAPTER.md` with these sections in this order:

1. `Applies to` — the platform and its component vocabulary.
2. `Required parameters` — with the exact stop-and-ask rule.
3. `Work type taxonomy` — the item classes and their title codes.
4. `Title grammar` — the exact title pattern.
5. `Text conventions` — naming, casing, and quoting rules.
6. `Section depth contract` — what each Description section must prove.
7. `Deterministic checks` — the rules the validator enforces.
8. `Bundled files` — the authoring, template, and example files.

Create `scripts/adapters/<id>.mjs` exporting `id`, `requiredParams`, `normalizeParams`, and `validateRows`.

Add the row to the registered-adapter table and a trigger-signal block above.
