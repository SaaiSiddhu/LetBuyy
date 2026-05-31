# Cloudflare Scripts

Cloudflare setup utilities live here when they operate on Cloudflare-specific configuration files and do not belong to deployment wrappers under `infrastructure/scripts/deploy`.

Scripts in this directory must not print secrets, must not commit provider IDs directly, and should only materialize checked-in placeholder values after live resources have been created and captured through approved setup flows.
