# Robust Software Pathways

This project should evolve through small, auditable paths. Each path has an owner loop, a verification gate, and a handoff artifact so another human or agent can continue without relying on one chat session.

## Source Of Truth

- Repository: `JoaoRG-lab/rhema-care-flow-8d712b43`
- Main branch: `main`
- Canonical deploy: `https://rhema-care-flow.lovable.app/`
- Canonical Supabase project: `rfsaxstpfpigrjyiochi`
- Local ops root: `~/rhema-ops`
- Recommended local runtime: Node 20+ with `npm ci` from the committed lockfile.

Do not create a new repository, project, migration, deployment, DNS change, or secret without explicit target confirmation.

## Path 1: Reliability And Fetch Errors

Goal: no silent buttons and no stale project calls.

Required patterns:

- Edge calls use `invokeEdgeFn` or `supabaseUrl`/`supabasePublishableKey` from `src/integrations/supabase/client.ts`.
- UI catches errors and shows actionable messages.
- Auth-sensitive views wait for auth loading before querying user data.
- Clipboard actions include a fallback for browsers without `navigator.clipboard`.

Verification:

```bash
npm ci
npx tsc --noEmit
npm run lint
npm test
npm run edge:check
```

## Path 2: Security And Access Control

Goal: fail closed, keep secrets out of Git, and make privileged operations auditable.

Required patterns:

- No tracked credentials in `.env`, editor config, docs, screenshots, or test fixtures.
- Ultimate/admin decisions are checked server-side for Edge Functions and client-side only for UX.
- Code Console writes only to agent branches and PRs.
- Supabase changes are migrations with review; production mutations need explicit authorization.

Verification:

```bash
npm run quality:gate
python3 scripts/rhema_quality_gate.py
```

## Path 3: Clinical Product Quality

Goal: make clinical tools dependable and useful during real workflows.

Required patterns:

- Empty states tell the user what to do next.
- Calculators validate required fields before saving.
- Patient-facing summaries avoid jargon and include safe copy/export behavior.
- Clinical content that makes a medical claim is traceable to guidelines, papers, or curated docs.

Verification:

```bash
npm test
npm run build
```

## Path 4: Agentic Implementation Loop

Goal: Codex, Cursor, Lovable, and other agents can cooperate without stepping on each other.

Loop:

1. Pull latest `origin/main`.
2. Create `codex/<task>` or another explicit branch.
3. Read existing docs and nearby code before editing.
4. Make the smallest useful change.
5. Run `npm ci` if dependencies are missing, then `npm run robust:check`.
6. Open PR with verification results and side effects.
7. Leave handoff notes in `~/rhema-ops/handoff` for unfinished or blocked work.

Cursor's role:

- Follow `.cursorrules` and `.cursor/rules/rhema-flow.mdc` when Cursor supports project rules.
- First action: read this file, then run `npm run robust:check` before proposing code.
- Suggest small diffs and tests.
- Flag raw env usage, silent buttons, hardcoded credentials, unguarded writes, and PHI leakage.
- Do not act as the deploy authority.

## Path 5: Deploy Readiness

Goal: deploy only when the software is reproducible and audited.

Gate:

```bash
npm run robust:check
```

The gate must pass before merge or deployment. If a remote check is cancelled externally, document that separately from local validation.

Production Edge Function deployment, Vercel promotion, Supabase migrations, DNS changes, and secret updates remain explicit-authorization actions.
