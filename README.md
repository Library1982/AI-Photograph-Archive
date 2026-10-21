# AI Photograph Archive — department demonstration

A portable photograph archive developed as a first prototype for departmental review. Photographs and bilingual descriptive records are stored together in an exportable system. This is a working single-administrator prototype, not a production institutional repository.

## Included

- Password-protected workspace; credentials and AI API keys remain on the server.
- JPEG/PNG batch upload (30 per batch, 10 MB per image), shared collection/event/date/creator/source context entered once.
- Original bytes preserved, SHA-256 checksums, image dimensions, file size, unique reference codes and exact duplicate detection.
- Arabic and English titles, descriptions and keywords; visible-text transcription; context, provenance, rights and location fields.
- Optional OpenAI image analysis fills empty descriptive fields. Existing values remain intact. AI never assigns historical identities or dates automatically.
- Every descriptive field has a status: Needs review, System default, User supplied, AI suggested or User confirmed. Suggested fields require an administrator's approval.
- Draft/approved queues, collection filters and text search across Arabic and English records.
- Full NDJSON export including originals, metadata and audit history; command-line restore on another server.
- SQLite database and file storage, no external JavaScript or CSS dependencies. Docker and Render Blueprint included.

## Run locally

Use Node.js 24 or later. No npm packages are needed.

```sh
export APP_PASSWORD='choose-a-password-at-least-12-characters'
export SESSION_SECRET='choose-a-random-secret-at-least-32-characters'
export COOKIE_SECURE=false
npm start
```

Open http://localhost:3000 and enter your APP_PASSWORD. On Windows PowerShell use `$env:APP_PASSWORD="..."` syntax for environment variables. `.env.example` is documentation, not automatically loaded. Never commit real credentials or departmental photographs to GitHub.

### Optional AI

Set `OPENAI_API_KEY` and `OPENAI_MODEL` in the environment, then restart. Choose an available vision-capable model that supports Structured Outputs in your OpenAI account. Each analysis explicitly sends the selected photograph and its saved descriptive context to OpenAI. AI API usage can incur charges. Without these settings the archive works, and analysis is disabled. No live API request was made during prototype verification.

## GitHub and Render

1. Create an empty **private** GitHub repository named `AI-Photograph-Archive` under your account. Upload the source from this package, with `package.json`, `server.mjs`, `Dockerfile` and `render.yaml` at the repository root. Keep `data/`, backups and secrets out of Git.
2. Connect the repository to Render through a Blueprint using `render.yaml`.
3. Set `APP_PASSWORD` to a long unique password. Render generates `SESSION_SECRET`. Leave AI settings empty for a manual demonstration, or set your own server-side API key and model.
4. The included Blueprint uses a **free, temporary demonstration service**. Files and database changes may disappear on restart or redeployment. Use non-sensitive test images and export before ending a demonstration. The application displays a temporary-storage notice.
5. For a durable pilot: select an appropriate paid service, attach a persistent disk at `/app/data`, set `TEMPORARY_STORAGE=false`, keep `COOKIE_SECURE=true`, and establish scheduled backups. Review current Render pricing before provisioning. Paid infrastructure has not been ordered by this project.

Render is the configured host because this prototype uses SQLite and a filesystem. Do not deploy it unchanged as Vercel Functions: that requires an external durable database and object store instead of local writes.

## Presentation sequence

1. Open the empty archive and explain the single-administrator demonstration scope.
2. Upload 3–5 permitted photographs in a batch; enter shared context once.
3. Open a record. Show the reference, checksum, preserved original and editable fields.
4. If AI is configured, draft the bilingual description. Check every suggestion against the photograph. Unknown names, dates and events stay blank unless documented.
5. Correct a field, approve the record, then search for it in Arabic or English.
6. Export the archive and explain how it moves to the department's server.

## Transfer to departmental infrastructure

- Export `photo-archive-backup.ndjson` from the signed-in workspace. It contains originals as base64, metadata with field evidence, and audit history. Keep it protected like the photographs themselves.
- Stop writes to the old archive during the final migration export. Run this application on the new host with Node.js 24 or Docker, a writable durable data directory and new secrets.
- Restore before admitting users:

```sh
DATA_DIR=./department-data node restore.mjs < photo-archive-backup.ndjson
```

- Point `DATA_DIR` on the new server to that restored directory. Start the application with the same directory. Verify record counts, bilingual fields and a sample of original-file checksums before changing the access URL.
- For this prototype export runs in-process; use it during a quiet period without edits. A large institutional collection needs a background backup service and storage capacity monitoring.
- Preserve the Git repository, source history, hosting settings (without secrets), backup procedures and ownership information as the technical handover.

## Data and standards

This is a local application profile informed by ISAD(G) and IPTC Photo Metadata, not a certification of full compliance. Records carry reference code, assigned title, creator, date, extent/medium and level of description. Photographs include captions, subjects, location shown versus camera location, provenance and rights. Collections currently use a text parent reference; a full fonds/series hierarchy and authority records require further development.

References:
- ISAD(G), 2nd edition: https://www.nla.ae/wp-content/uploads/2023/10/ISADG_2.pdf
- IPTC Photo Metadata standard: https://www.iptc.org/std/photometadata/specification/IPTC-PhotoMetadata
- Render storage: https://render.com/docs/disks
- Render free services: https://render.com/docs/free
- OpenAI image inputs: https://developers.openai.com/api/docs/guides/images-vision

## Boundaries before institutional rollout

Single shared administrator account; audit entries identify the administrator role, not individual staff. Access values (Internal/Restricted/Public) are **metadata labels**: all records remain behind the same password; there is no public portal or per-record permission system. A production release needs named users and roles, institutional authentication, retention and access policy implementation, storage/backups and recovery drills, authority control, expanded archival hierarchy, accessibility testing and evaluation of AI descriptions against staff-reviewed records. Current image-header checks are basic and do not replace full media decoding or malware scanning. No facial identification, reverse-image search, automatic publication, LMS synchronization or OCR accuracy guarantee is implemented.

## Verification

Run `npm test`. Tests cover original-file preservation, duplicates, bilingual editing, stale edit rejection, AI suggestions not overwriting existing fields, approval labels and backup restore. Live AI and hosted deployment still require configured accounts and must be tested there.
