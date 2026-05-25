# Local Development Lifecycle Runbook

## Purpose

Start, validate, seed, and reset the isolated local LetBuyy operations stack.

## Procedure

1. Run `npm run local:bootstrap`.
2. Run `npm run local:up`.
3. Run `npm run local:seed`.
4. Run `npm run local:health`.

## Reset

Run `npm run local:reset`, then `npm run local:seed` and `npm run local:health`.

## Evidence Boundary

Local stack health proves developer readiness only. It must not be attached to live production certification.
