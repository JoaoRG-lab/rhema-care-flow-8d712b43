# Local Quality Engine

Rhema uses a local ADR gate before a branch is considered ready for PR review,
merge, deploy, or external-agent promotion.

## Commands

```bash
npm run quality:fast
npm run quality:gate
```

`quality:fast` runs the lightweight loop for active design/code work.
`quality:gate` runs typecheck, lint, tests, build, and secret scan.

Reports are written to:

```text
~/rhema-ops/handoff/
```

Each report includes:

- repo, branch, and SHA;
- command results;
- redacted output tails;
- ADR subscores;
- deploy gate decision.

## ADR Weights

- Functionality: 30%
- Security: 20%
- Redundancy: 15%
- Reproducibility: 15%
- Coverage: 10%
- Cost/time: 10%

The deploy gate blocks below `0.90` or when any required check fails.

## Multi-Agent Use

Perplexity, GPT, Hugging Face jobs, Figma, BioRender, Canva, Waldo, and other
agents may propose changes. A proposal becomes operational only after:

1. code or artifact is committed on a branch;
2. `npm run quality:gate` passes;
3. security-sensitive changes receive explicit review;
4. GitHub PR/checks are used as the durable coordination point.

No agent should run production deploys, Supabase migrations, DNS edits, or secret
changes from this local gate alone.
