# Theme Marketplace on this Mac

From `/Volumes/Projects/LetBuyy`:

```sh
pnpm marketplace:start
pnpm marketplace:status
pnpm marketplace:stop
pnpm marketplace:restart
pnpm marketplace:account
```

Open **http://themes.letbuyy-local.localhost:9015/themes** after startup reports ready.
`start` is idempotent. It starts the existing marketplace, canonical identity,
merchant editor, commerce preview and API gateway on loopback. The first startup
and each restart can take a few minutes while Next.js compiles. Docker must be
running and the installed workspace dependencies must remain available.

There is no timed shutdown. Stopping the apps or restarting the Mac retains the
database, account, installed themes, drafts and local signing keys. Run `start`
again when needed. Normal sign-in and session expiration still apply. Local
internal REST credentials renew automatically without expiring the stack.

`account` gives the path to the private synthetic sign-in details. Use that
account through the ordinary login screen. Previews use the real read-only
commerce demo route. Add to library uses the normal authenticated install,
receipt readback and merchant editor handoff.

Private state lives in ignored `.local/theme-marketplace/`, with credentials and
backups mode 0600. The database lives in this setup's explicitly labeled Docker
volume. `stop` preserves it; there is deliberately no reset/delete command. Do
not delete this directory, the volume or the workspace dependency store if you
want to retain the local setup. Source is a private, hash-verified copy of the
marketplace version validated on 24 October, schema 392; a future code/schema
update needs its own validated cutover and never resets this database at start.

This setup was initialized from the actual, positively bound synthetic run555
database. A consistent physical backup retains the object identities pinned by
its custody guards. A logical restore was rejected by those guards and is
preserved separately as a failed attempt; no guard was disabled. This setup
has its own local resource labels, ownership marker and process supervisor. It
does not extend, adopt or bypass the executable test runner's six-hour fixtures.

The launcher refuses occupied app ports and foreign containers, mounts and
volumes. It signals only recorded processes with matching process identities.
The only frozen app launched is the explicitly requested local Theme Marketplace;
production topology and deployment remain unchanged.
