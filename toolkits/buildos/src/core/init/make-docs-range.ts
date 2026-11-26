/**
 * The tested Make Docs version range (PRD 20 Make Docs Companion Setup). It
 * is kept here and nowhere else. The CI Make Docs contract job installs Make
 * Docs at both bounds of this range: `MAKE_DOCS_LOWER_BOUND` and the newest
 * published version inside the range.
 */

export const MAKE_DOCS_PACKAGE = "@brucewaynedecoy/make-docs";

/** `~2.0.9` is `>=2.0.9 <2.1.0`. A tilde range needs no shell quoting on any OS. */
export const MAKE_DOCS_RANGE = "~2.0.9";

export const MAKE_DOCS_LOWER_BOUND = "2.0.9";
