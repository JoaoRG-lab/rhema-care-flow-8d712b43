# Hex Engine Workbench

Hex can be used as a cloud analytics notebook for Rhema Flow quality and bio/stat review.

## Inputs Allowed

- De-identified route metrics.
- Public content audit outputs.
- ADR quality gate JSON.
- Aggregated clinical-tool coverage counts.
- Synthetic/demo datasets.

## Inputs Forbidden

- PHI.
- Patient identifiers.
- Supabase service role keys.
- Raw clinical notes.
- Authenticated patient or clinician tables.

## Recommended Tables

Create notebooks from exported JSON/CSV artifacts, not live production tables:

- `rhema-quality-gate-*.json`
- `rhema-continuous-engine-*.json`
- Hugging Face public audit JSON
- synthetic score coverage matrix

## Notebook Outputs

Hex should produce proposal artifacts only:

- missing clinical score coverage;
- accessibility deltas;
- quality trends;
- release risk charts;
- bio/stat suggestions for patient education and clinical calculators.

Any recommendation still goes through GitHub PR and ADR before production.
