// Planted failure for the release eval gate (W1 R7 P8 t4, A65): a converter
// that loses every section. scripts/release-gate.ts `eval --plant eval` runs
// the conversion eval gate with it (BUILDOS_EVAL_CONVERTER), and the gate
// must fail. It is never used by a release.

export const converter = {
  name: "planted-failure",
  async convert(): Promise<string[]> {
    return ["planted text that matches no reference"];
  },
};
