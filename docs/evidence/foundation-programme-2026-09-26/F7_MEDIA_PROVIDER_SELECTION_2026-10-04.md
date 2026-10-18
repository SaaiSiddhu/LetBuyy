# F7.1 video-provider decision brief — 4 October 2026

## Current implementation boundary

The Phase 1R cleanup retired the old Firebase-backed marketplace ReelService and
feed. The buyer app currently displays a “Reels are coming soon” state. The
Gateway's R2-backed `media_assets` and `/media` routes are generic merchant file
library paths; they do not transcode, deliver adaptive HLS, accept a provider
readiness callback, or bind an immutable product/listing revision. The reserved
`media-service` runtime must stay empty: any selected adapter and business
workflow belongs in the Gateway monolith and normal apps.

The local Cloudflare topology provisions R2 media buckets with an APAC location
hint and has a Worker ingress, but it does not currently declare a Stream
binding or a video-provider account. APAC on the R2 bucket is not evidence of
Stream video data residency. The canonical-systems registry names no video
provider; provider choice, data-processing terms and approval are still open.

## Provider comparison from current primary documentation

| Requirement | Cloudflare Stream | Mux |
|---|---|---|
| Direct client upload | One-time direct-upload URLs; basic POST for files up to 200 MB; TUS required over 200 MB and recommended for unreliable connections. The Worker Stream binding creates the basic POST URL; TUS creation uses the Stream REST API. | Authenticated Direct Upload URL lets the client upload directly without routing video bytes through LetBuyy. |
| Processing/playback | Managed H.264 adaptive bitrate HLS/DASH to 1080p; set `requireSignedURLs` so a pending/private video cannot be played by guessing its UID. | Asset processing with HLS playback IDs; use signed playback policy and server-generated short-lived JWTs for private content. |
| Readiness | Webhooks report ready/error; verify exact body bytes, HMAC-SHA256 signature and recent timestamp before changing canonical state. | `video.asset.ready` / `video.asset.errored` webhooks; verify signatures and scope the endpoint to its environment. |
| Cost model (current published docs) | $5/month per 1,000 minutes of storage capacity and $1 per 1,000 minutes delivered; ingress/encoding included. Unused direct-upload links reserve `maxDurationSeconds` until completion or expiry. | Input, storage and delivery are each minute-based. Current docs describe 100,000 free monthly delivery minutes; Pay as you go is usage-based with a $20 monthly credit. Basic quality is described for UGC. |
| Existing LetBuyy alignment | Fits the existing Cloudflare Worker/R2 deployment, but is a new product/account capability with separate usage billing and no provisioned Stream binding. | Mature direct-upload, HLS, signed-playback and webhook workflow, but adds another vendor/account and a distinct usage-billing model. |

Sources checked 4 October 2026: [Cloudflare Stream overview](https://developers.cloudflare.com/stream/), [direct creator uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/), [TUS uploads](https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/), [Stream pricing](https://developers.cloudflare.com/stream/pricing/), [Stream webhook verification](https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/), [Mux direct uploads](https://www.mux.com/docs/guides/upload-files-directly), [Mux signed playback](https://www.mux.com/docs/guides/secure-video-playback), [Mux fundamentals and webhooks](https://www.mux.com/docs/core/mux-fundamentals), and [Mux pricing](https://www.mux.com/pricing). Prices and provider behavior can change; recheck before account activation or financial approval.

## Recommendation and next work

Recommend **Cloudflare Stream** for the first LetBuyy V1 reel slice: it fits the
existing Worker/R2 deployment and publishes a simple stored-minutes plus
delivered-minutes billing model. Preserve R2 for poster images and other generic
merchant files; do not treat an MP4 in R2 as the video platform. The integration
must keep every upload private until verified processing plus human product
match approval, support resumable mobile uploads, constrain creator/duration,
verify webhooks, and bind the resulting asset to immutable product revisions.

Before provider-specific code or provisioning, owner approval is still needed
for the provider and its recurring usage-billing relationship. Confirm
Cloudflare Stream eligibility under the existing account and obtain its
applicable data-processing/retention terms. No account was created, no plan was
activated, and no upload, webhook, provider credential, or external transaction
was used in this research.

After selection, the concrete F7.1 implementation is: a narrow Gateway provider
adapter; site-owner-only, idempotent upload-intent creation; short-lived,
single-use upload links constrained by expiry, max duration and creator; a
private `reel_assets`/revision association; signed webhook verification with
replay protection; upload/processing/failure/deletion states; and owned-worker
tests for unauthorized tenant, changed metadata, duplicate callbacks, errors,
stale callback, deletion and exact product-revision binding. Then integrate the
real merchant upload/review UI and marketplace browse/player controls.

The Phase 7 scope still requires provider and counsel review, media rights and
moderation policy, accessibility/caption rules, cost controls and mobile
device playback. This brief is not provider acceptance, legal review, a live
upload, or Phase 7 completion.
