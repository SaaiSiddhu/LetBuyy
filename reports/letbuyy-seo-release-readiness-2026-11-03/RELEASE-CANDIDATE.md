# Local source candidate — not approved or deployed

Root build `b2CsFLYIUn25H5EguBjys` runs on 9006. Isolated source copy build `fiI7E7RIv4e4VqtSPl2DG` passed the exact filtered release build 29/29(28 cached,1 executed). Source archive:[MARKETING-RELEASE-SOURCE.tar.gz](MARKETING-RELEASE-SOURCE.tar.gz),1289 files across 15 roots, SHA 256`9a0145e2fbf5396660526e9fe1d64004fc598fd1e0df6403cd6fd13ce2d02dbe`. [Manifest](evidence/release-source-manifest.json) hashes match the owner checkout and materialized source copy. No env files, node_modules, generated output or source symlinks are packaged.

The source archive preserves dependency sources and unrelated owner work needed by the existing dirty-tree runtime. It is a review snapshot, not an approved production commit. The builds use loopback API/Accounts settings; generated output must not be deployed as production output. Use reviewed hosted configuration and a separately authorized scoped rebuild/release. The original LCP acceptance, human/device/provider checks and hosted outcomes remain open.

[Latest repair patch](RESOLUTION-REPAIRS.patch) is the 14 path delta from the prior packet;[earlier repairs](SOURCE-CHANGES.patch),[Proxy migration](PROXY-MIGRATION.patch) and [separate Worker CORS repair](GATEWAY-CORS-REPAIR.patch) remain available. Review exact patches against owner changes; do not use a broad reset. A marketing release would not deliver the separate Worker repair. No DNS, Firebase, Play, GSC or analytics mutation occurred.

[Current status](STATUS-AND-EXECUTIVE-SUMMARY.md) · [post-release matrix](PRODUCTION-VERIFICATION-MATRIX.csv) · [recovery](ROLLBACK-AND-RECOVERY.md)
