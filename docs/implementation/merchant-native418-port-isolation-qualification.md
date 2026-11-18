# Native418 browser fixture port isolation

Status: local qualification passed; final-source CI and hosted/device acceptance remain open.

## Observed failure

Required CI on 1a844dccb failed before the payout browser journey began:
`listen EADDRINUSE: address already in use 127.0.0.1:54772`.
The failure occurred in its fixed-port availability probe. The existing listener
was inspected but not stopped. Its retained failure log SHA256 is
`bd0f2b90a2520562843fe8c54ffc195ad20f0acae13b00ccb7632674ff36b118`.

A source audit found the same fixed-port setup in the payment-configuration
browser fixture. No payment or production runtime change is involved.

## Change

Both fixtures use the shared owned-database helper to choose distinct
OS-assigned loopback ports for their Next clients. The helper requires the exact
verified database handle and a bounded integer count, and keeps the sockets
open together while choosing the batch. It releases its allocation sockets
before named-client startup; actual readiness and owner-bound cleanup remain
required. Each HTTP bridge binds port zero and uses its real assigned address.
This removes the fixed-port assumption without killing an existing listener or
weakening any login, MFA, money, tenancy or recovery assertion.

## Local proof

- `20261117T101322Z-native418-browser-ports-occupied-regression-673e62d943e447ffb8ce39c8433647ed`: both complete browser suites passed concurrently while
  54770–54775 were deliberately occupied by task-owned listeners. Neither fixture
  contacted any of those listeners. No foreign listener was stopped.
- Browser cases: 2 passed, zero failures/skips/cleanup failures. The payout case
  includes normal login, MFA, wrong-actor/store refusals, lost-response recovery,
  exact canonical readback and cross-page recovery. These are synthetic local
  provider fixtures, not provider/bank settlement acceptance.
- `20261117T101708Z-native418-port-helper-qualification-71c3d304450e4024a273462e24f46b4b`: 10 owned-client tests passed, including new allocation
  ownership/count/distinctness controls and existing process cleanup boundaries.
- Gateway typechecking passed on the final local changes.

Earlier failed/canceled CI remains unaccepted. A fresh exact-source required CI
run must pass before staging, production deployment and iPhone login testing.
