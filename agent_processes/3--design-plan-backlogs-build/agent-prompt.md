Please review the README.md file in this current directory, which describes a browser extension to be developed.  It references an integration with another system/service (named Matters); Matters is not ready yet for integration, but we want to go ahead and build out a working version of this extension that performs all of its non-Matters functions -- however, we also want to ensure that we follow our workflow for documenting, planning, generating/maintaining PRDs, building/maintaining work backlogs, and then doing work phase-by-phase.  That workflow is segmented into 2 parts, which looks like this:

**Segment 1 - Linear, non-looped process**
See `plan-process/1a-full-scope-planning.md`, which covers the below steps (in more detail):

1. Generate a comprehensive design doc that captures the entirety of what we are trying to build. You can delineate this into 2 design docs (i.e., building the pre-Matters browser extension, and integrating Matters when available).  Design docs are created in `../../docs/designs/`.
2. Generate a plan bundle under `../../docs/plans/` derived from the design doc for the pre-Matters browser extension.
3. Generate a full PRD set in `../../docs/prd/` derived from the design doc and the newly-created plan bundle.
4. Generate a work backlog under `../../docs/work/` which is derived from the newly-created plan bundle, but is correlated against (i.e. references) the PRD set of documents.

This segment gives us a clean, comprehensive set of product documents that provides clear guidance on what is being built, what it's features and requirements are, and how it will be built (organized into manageable work waves, revisions (only used when making changes to features that have already been implemented), and stages/phases for organizing work in granular, testable, shippable units.

**Segment 2 - Looped build process**
See the agent instructions and the numbered documents under `build-process/`, which cover the following steps in more detail:

1. FOR EACH WORK BACKLOG SUB-DIRECTORY UNDER `../../docs/work/`:
    1. FOR EACH PHASE (STARTING AT "1") UNDER `../../docs/work/<work-backlog>/`
        1. See the agent instructions and the numbered documents under `build-process/`.
        2. Implement each document (as a step).
    2. Loop for each phase until the work backlog/wave is completed.
2. Loop for each work backlog directory that hasn't been implemented yet, until each work backlog/wave is completed.

I am specifically asking you to proceed with this workflow without me in the loop.  The end result should be a fully built "version 1" solution/product that is thoroughly documented (including with comprehensive guides for both devs/maintainers AND end users).
