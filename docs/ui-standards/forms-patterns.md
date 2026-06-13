# Forms Patterns

- **Labels always** — `Input`/`Select`/`Checkbox` carry a visible (or `aria-`) label. `Checkbox` requires `label`; use `unstyled` + the prop for aria when the visible label is a sibling.
- **Right input type** — `type="email"`, `type="number"` + `inputmode` for amounts/pincodes; `min`/`step` where applicable.
- **Inline validation** — validate on blur/submit; show `helperText`/`error` next to the field, not just a toast.
- **Disabled while busy** — disable inputs + submit during async; `loading` on the submit button.
- **Unsaved guard** — `SaveBar` reflects saved/unsaved/saving; discard restores.
- **Server schema parity** — client validation mirrors the Zod schema in `@letbuyy/commerce-core` / `@letbuyy/shared-types`; the server re-validates (never trust the client).
- **Sensible defaults** — currency INR, country IN; pre-fill where known.
- **Errors are recoverable** — keep the user's input on failure; map server error codes to friendly messages.
