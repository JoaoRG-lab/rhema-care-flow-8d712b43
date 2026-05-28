# Hugging Face Clinical Improvement Workbench

## Purpose

Hugging Face is used as an external workbench for continuous clinical product improvement. It can run cheap CPU jobs for public-page audits, larger jobs for evaluation datasets, or future GPU workloads for model-assisted review. It is not a production deploy target.

## Safety Model

- Never send PHI or authenticated patient data to Hugging Face Jobs.
- Jobs read public routes or curated de-identified datasets only.
- Results are proposals, not automatic code changes.
- Supabase migrations, secrets, DNS, deploys, and GitHub writes still require the normal Rhema review gates.
- Persisted HF outputs can be consumed by `ai-improvement-cycle` through `HF_CLINICAL_JOB_CONTEXT_URL`.

## Local Script

The reusable UV job script lives at:

```text
scripts/hf_clinical_improvement_job.py
```

It audits public routes, emits JSON proposals, and marks all outputs as review-only.

## Run With Hugging Face Jobs

Using the HF Jobs connector, submit the script as inline UV code or with the CLI:

```bash
hf jobs uv run scripts/hf_clinical_improvement_job.py \
  --flavor cpu-basic \
  --timeout 30m
```

Optional environment:

```bash
RHEMA_PUBLIC_URL="https://rhema-care-flow.lovable.app/"
RHEMA_ROUTES="/,/learn,/scores,/landing,/about"
```

## Connect Results Back To Rhema

After a job produces a stable JSON artifact, expose or upload that artifact and set:

```bash
supabase secrets set HF_CLINICAL_JOB_CONTEXT_URL="https://..."
supabase secrets set HF_CLINICAL_DATASET_ID="owner/dataset-name"
supabase secrets set HF_CLINICAL_SPACE_URL="https://huggingface.co/spaces/owner/space"
supabase secrets set HF_CLINICAL_CONTEXT="Operational notes for the HF workbench"
```

The `huggingface` auditor in `ai-improvement-cycle` reads those values and converts them into `ai_improvement_tasks`.

## Rotation

The `ai_improvement_runs.agent` enum now includes:

- `replit`
- `huggingface`

This keeps stalled external workbenches inside the same redundancy trail as the existing auditors.

## Recommended Cadence

- Daily: CPU public-page audit.
- Weekly: de-identified clinical instrument review.
- Before releases: accessibility, patient-language, safety-boundary review.
- Never: automatic deployment from HF output.
