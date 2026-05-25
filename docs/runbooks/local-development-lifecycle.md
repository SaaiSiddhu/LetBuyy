# Local Development Lifecycle Runbook

## Purpose

Start, validate, seed, and reset the isolated local LetBuyy operations stack.

## Procedure

1. Run `pnpm run local:bootstrap`.
2. Run `pnpm run local:up`.
3. Run `pnpm run local:seed`.
4. Run `pnpm run local:health`.

## Reset

Run `pnpm run local:reset`, then `pnpm run local:seed` and `pnpm run local:health`.

## Evidence Boundary

Local stack health proves developer readiness only. It must not be attached to live production certification.
