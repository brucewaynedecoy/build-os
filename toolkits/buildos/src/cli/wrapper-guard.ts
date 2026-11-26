// W1 R7 P6 review round 3 (P6-R3-08): the project wrappers set
// BUILDOS_WRAPPER_ACTIVE so that a chain of wrappers that comes back to
// itself stops. Once the real BuildOS program runs, the chain has ended:
// this module clears the variable before any other code of the program
// runs (main.ts imports it first), so a program BuildOS starts, such as a
// companion tool that calls the project wrapper again, is not taken for a
// loop.

/** The variable the project wrappers set while they look for BuildOS. */
export const WRAPPER_GUARD = "BUILDOS_WRAPPER_ACTIVE";

delete process.env[WRAPPER_GUARD];
