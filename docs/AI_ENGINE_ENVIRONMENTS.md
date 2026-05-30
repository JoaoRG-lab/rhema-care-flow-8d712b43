# AI Engine Environments

This document defines the proposal-first engine mesh for continuous Rhema Flow improvement.

## Contract

- Canonical repo: `JoaoRG-lab/rhema-care-flow-8d712b43`.
- Canonical deploy: `https://rhema-care-flow.lovable.app/`.
- Every environment is a proposal source, not an autonomous production deployer.
- No PHI, service role keys, patient identifiers, migrations, DNS, or production deploys may be sent to external workbenches.
- Required gate before merge/deploy: `npm run quality:gate` with ADR >= `0.90`.

## Environments

| Environment | Role | Entrypoint | Output |
| --- | --- | --- | --- |
| Local WSL | Primary coding, testing, ADR, handoff | `npm run engine:local` | JSON in `~/rhema-ops/handoff` |
| Hugging Face Jobs | Public/de-identified clinical audit bench | `scripts/hf_clinical_improvement_job.py` | Review-only JSON proposals |
| Replit | Interactive coding mirror and recovery source | `.replit` | Preview and branch proposals |
| Netlify | Static preview mirror | `netlify.toml` | Preview-only site artifact |
| Hex | Analytics and bio/stat notebooks | `docs/HEX_ENGINE_WORKBENCH.md` | De-identified metrics/proposals |

## Local Commands

```bash
npm run engine:local
npm run quality:gate
npm run edge:check
```

## Hugging Face Jobs

Run the clinical public-page workbench:

```bash
hf jobs uv run scripts/hf_clinical_improvement_job.py \
  --flavor cpu-basic \
  --timeout 30m
```

Suggested environment:

```bash
RHEMA_PUBLIC_URL="https://rhema-care-flow.lovable.app/"
RHEMA_ROUTES="/,/learn,/scores,/about,/quality-test"
```

If Hugging Face Jobs is unavailable because of credits or quota, run the same
review locally:

```bash
python3 scripts/hf_clinical_improvement_job.py
```

If a job produces a durable JSON artifact, wire it into Supabase only after review:

```bash
supabase secrets set HF_CLINICAL_JOB_CONTEXT_URL="https://..."
```

## Replit

The `.replit` and `replit.nix` files make the app runnable as a Replit preview. Replit is allowed to propose code and run previews, but it must not deploy production or write secrets.

## Netlify

`netlify.toml` builds a static preview from the same Vite app. Netlify should be used as a preview/artifact mirror unless `main` is green and the production target is explicitly confirmed.

## Hex

Hex is a notebook layer for exported, de-identified operational metrics only. Use it for clinical quality charts, bio/stat review, and release intelligence; never connect live patient tables.

## Handoff

Each engine cycle should leave:

- current objective;
- branch and SHA;
- commands run;
- route findings;
- proposals;
- blocked actions;
- next safe actions.
