# BioRender Clinical Design Brief

Status: implementation companion for Rhema Flow clinical tools.

## Purpose

Use BioRender-style scientific visuals to clarify clinical reasoning, not to
decorate the interface. Clinical tools stay interactive in React; BioRender
figures should support patient education, clinician explanation, reports and
score interpretation.

## Priority Figures

### 1. Rheumatology Disease Activity Loop

- App surfaces: `src/pages/Dashboard.tsx`, `src/pages/PatientDetail.tsx`,
  `src/components/patients/ScoreTrends.tsx`, `src/components/patients/VisitHistory.tsx`.
- Visual: patient symptoms, joint exam, labs, score calculation, treatment
  adjustment, monitoring follow-up.
- BioRender prompt:
  "Create a clean clinical workflow figure for rheumatology disease activity
  monitoring. Show patient-reported symptoms, swollen/tender joint assessment,
  CRP/ESR lab data, DAS28/CDAI/SDAI score calculation, treatment decision,
  and follow-up monitoring. Use a professional medical dashboard style,
  accessible labels, no patient-identifiable data."
- UI use: small explanatory panel beside score trends and downloadable patient
  report graphic.

### 2. Prescription Safety Pipeline

- App surfaces: `src/components/prescriptions/*`,
  `src/components/teleconsulta/MemedPrescriptionPanel.tsx`.
- Visual: draft medication list, validation, interaction/cid review, digital
  signature, PDF export, audit trail.
- BioRender prompt:
  "Create a medical workflow figure showing digital prescription safety:
  medication draft, required-field validation, CID-10 review, signature
  capture, SHA-256 integrity hash, PDF export, and audit log. Use neutral
  clinical colors and icon-like panels."
- UI use: empty state and help panel in the prescriptions tab.

### 3. Teleconsulta Clinical Encounter

- App surfaces: `src/components/teleconsulta/TeleconsultaLobby.tsx`,
  `src/components/teleconsulta/TeleconsultaRoom.tsx`.
- Visual: remote patient intake, video visit, clinical notes, prescription,
  follow-up plan, secure sharing.
- BioRender prompt:
  "Create a telemedicine encounter workflow figure for a rheumatology clinic:
  patient joins securely, clinician reviews chart, video consultation,
  prescription panel, follow-up plan, encrypted record sharing. Make it clear
  and suitable for clinical software onboarding."
- UI use: onboarding card and patient-facing explanation.

### 4. Obstetric/Pediatric Risk Score Interpretation

- App surfaces: `src/pages/Scores.tsx`, `src/components/scores/*`.
- Visual: inputs, score calculation, risk bands, recommended action.
- BioRender prompt:
  "Create a generic clinical risk score interpretation figure with input
  domains, score calculation, color-coded low/moderate/high risk bands, and
  clinical action recommendation. Avoid disease-specific claims; keep labels
  editable."
- UI use: shared score-card visual grammar for APGAR, PEWS, preeclampsia,
  preterm risk and neonatal calculators.

### 5. Patient Data Integrity and Privacy

- App surfaces: `src/components/patients/PatientChainAnchorPanel.tsx`,
  `src/pages/BlockchainRegistry.tsx`, `src/pages/SolanaChainDemo.tsx`.
- Visual: local clinical record, hash generation, on-chain proof, no PHI
  on-chain, verification receipt.
- BioRender prompt:
  "Create a privacy-preserving medical data integrity figure: local clinical
  record stays private, a cryptographic hash is generated, only the proof is
  anchored externally, and verification returns a receipt. Emphasize no PHI
  leaves the clinical system."
- UI use: chain anchor explanation and exported reports.

## UI Design Rules For Clinical Tools

- Keep clinical inputs dense, aligned and scannable.
- Use segmented controls for categorical score inputs.
- Use sliders or numeric inputs for continuous clinical values.
- Show score interpretation next to the result, not below a long form.
- Keep action buttons explicit: calculate, save, export, reset.
- Use muted clinical colors for normal states and reserve red/amber for risk.
- Place BioRender figures in help, onboarding, report and education surfaces;
  never replace an interactive calculator with a static image.

## Implementation Targets

- Shared score result component:
  `src/components/scores/ClinicalScoreResult.tsx`
- Shared visual explainer component:
  `src/components/clinical/ClinicalVisualExplainer.tsx`
- Prescription empty/help state:
  `src/components/prescriptions/PrescriptionList.tsx`
- Teleconsulta onboarding/help card:
  `src/components/teleconsulta/TeleconsultaLobby.tsx`
- Patient report visual section:
  `src/components/patients/PatientReportExport.tsx`

## Asset Handling

- Store final exported figures under `public/clinical-figures/`.
- Use filenames like:
  - `rheumatology-activity-loop.svg`
  - `prescription-safety-pipeline.svg`
  - `teleconsulta-encounter-flow.svg`
  - `clinical-risk-score-bands.svg`
  - `privacy-integrity-proof.svg`
- Keep source/editable BioRender links in this document once exported.
- Add alt text for every figure and do not include PHI in any asset.
