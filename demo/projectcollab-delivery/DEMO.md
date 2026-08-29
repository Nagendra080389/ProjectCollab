# ProjectCollab live demo scenario

## Story

The Mobile Checkout team needs one shared delivery view. Their lead wants to move from an agreed problem to a tested release candidate while preserving evidence for every decision.

## Before the meeting

1. Open this folder in ProjectCollab.
2. Open **Delivery: Open Delivery Center** from the Command Palette.
3. Select **Set Up Workspace**. Confirm that all six stages show a verification task.
4. If rehearsing, use **Reset** before the live presentation.

## Six-minute live flow

1. Introduce the Delivery Center: one view for stages, execution, evidence, and current workspace readiness.
2. Run **Discover**. Open `01-discovery-brief.md` from Delivery artifacts and show that the outcome and success measures are durable evidence.
3. Run **Plan**, then **Design**. Point out automatic progression and the activity trail.
4. On **Build**, select **Work With Agent** to show the stage-specific, repository-aware agent brief. This step is optional if agent access is unavailable.
5. Run **Build**, then **Test**. In the terminal, show three passing tests. Open `05-test-report.md` from the artifact list.
6. Run **Release**. ProjectCollab requires explicit confirmation before packaging. Approve it and show `06-release-notes.md` plus `release/ProjectPulse-1.0.0/release-manifest.json` in the Explorer.
7. Run the task **Demo: Start Application**, then open `http://127.0.0.1:4173`. Show the delivered ProjectPulse dashboard.

## Closing line

“ProjectCollab connects intent, implementation, automated quality gates, human approval, and release evidence in the same place where the team builds the software.”

## Recovery shortcuts

- If a stage is selected out of order, click the intended stage card and run it.
- If a task is not assigned, choose **Set Up Workspace** again.
- If port 4173 is busy, run `PORT=4174 npm start` in the terminal and open port 4174.
- Generated files can be removed safely by deleting `delivery-artifacts`, `dist`, and `release`; the pipeline recreates them.
