# Config Router (`.os/config`)

This directory contains adopter-owned configuration for this Build OS instance. It is the one place
where a deployed instance defines concrete systems, environments, and owners.

## Files

- [`instance.yaml`](instance.yaml) — canonical instance configuration.

## Use

Before editing config, read [`../contracts/config-contract.md`](../contracts/config-contract.md).
For a fresh instance, copy [`../templates/instance-config.yaml`](../templates/instance-config.yaml)
to `instance.yaml`, then replace the neutral example values with adopter-owned values.

Keep schema details in the contract. This router should only point operators to the right authority,
template, and canonical config file.
