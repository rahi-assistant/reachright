# ReachRight Engineering Mandates

## Core Principles
1. **Deterministic Outputs:** User-facing artifacts (PDFs, reports, receipts) must be deterministically generated on the server. Do not rely on client-side rendering or browser-specific behaviors (like `window.print()`).
2. **Premium Aesthetic:** Every deliverable must reflect the highest quality of design. Use dedicated layout engines for document generation to ensure exact mathematical control over typography, spacing, and brand colors.
3. **No Compromises on User Friction:** Eliminate unnecessary intermediate steps. A request for a document must result in an immediate, ready-to-use file download.

## PDF Generation Standard (The "React-PDF" Standard)
- **Mandate:** All PDFs must be generated using `@react-pdf/renderer`.
- **Architecture:** 
  - PDFs are constructed using React components strictly typed and styled with Flexbox.
  - Documents are generated on the server as binary streams or buffers and returned directly to the client with `application/pdf` MIME types.
- **Styling constraints:** All styles must be defined explicitly in `StyleSheet.create()`. Fonts must be explicitly registered and loaded.

## Code Quality & Consistency
- Keep API routes cleanly separated from rendering logic. The PDF component structure should live in its own directory (e.g., `app/components/pdf/`).
- Enforce strict typing for all audit data passed into the renderer.
