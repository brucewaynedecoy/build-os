package intake

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const testReferencesOutput = "system/.os/indexes/references.json"

func TestBuildReferencesIndexKeepsIDsWhenTwinRemoved(t *testing.T) {
	root := t.TempDir()
	twins := map[string]string{}
	for _, name := range []string{"alpha", "bravo", "charlie", "delta"} {
		twins[name] = convertTestCSV(t, root, name)
	}
	before := buildTestReferences(t, root)
	for i, name := range []string{"alpha", "bravo", "charlie", "delta"} {
		want := []string{"REF-001", "REF-002", "REF-003", "REF-004"}[i]
		if got := before.ids[twins[name]]; got != want {
			t.Fatalf("first build: %s id=%q want %q", name, got, want)
		}
	}

	removeTestTwin(t, root, twins["bravo"])
	after := buildTestReferences(t, root)

	if len(after.ids) != 3 {
		t.Fatalf("after removal: %d references, want 3: %v", len(after.ids), after.ids)
	}
	if id, ok := after.ids[twins["bravo"]]; ok {
		t.Fatalf("removed twin %s still indexed as %s", twins["bravo"], id)
	}
	for _, name := range []string{"alpha", "charlie", "delta"} {
		if after.ids[twins[name]] != before.ids[twins[name]] {
			t.Fatalf("%s id changed from %s to %s", name, before.ids[twins[name]], after.ids[twins[name]])
		}
	}
	if after.nextID != 5 {
		t.Fatalf("next_id=%d want 5", after.nextID)
	}
	if got, want := after.order, []string{"REF-001", "REF-003", "REF-004"}; strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("file order=%v want %v", got, want)
	}
}

func TestBuildReferencesIndexNeverReusesRemovedIDs(t *testing.T) {
	root := t.TempDir()
	alpha := convertTestCSV(t, root, "alpha")
	bravo := convertTestCSV(t, root, "bravo")
	buildTestReferences(t, root)

	// Remove the reference with the highest number. Only next_id remembers it.
	removeTestTwin(t, root, bravo)
	buildTestReferences(t, root)

	charlie := convertTestCSV(t, root, "charlie")
	got := buildTestReferences(t, root)
	if got.ids[alpha] != "REF-001" {
		t.Fatalf("alpha id=%q want REF-001", got.ids[alpha])
	}
	if got.ids[charlie] != "REF-003" {
		t.Fatalf("charlie id=%q want REF-003 (REF-002 belonged to a removed twin)", got.ids[charlie])
	}

	// A twin that comes back is a new reference and gets a new number.
	convertTestCSV(t, root, "bravo")
	got = buildTestReferences(t, root)
	if got.ids[bravo] != "REF-004" {
		t.Fatalf("restored bravo id=%q want REF-004", got.ids[bravo])
	}
	if got.nextID != 5 {
		t.Fatalf("next_id=%d want 5", got.nextID)
	}
}

func TestBuildReferencesIndexKeepsLegacyInsertionOrderIDs(t *testing.T) {
	root := t.TempDir()
	zulu := convertTestCSV(t, root, "zulu")
	alpha := convertTestCSV(t, root, "alpha")
	// An index from before next_id existed, with IDs in insertion order
	// (not path order) and an entry whose twin has since been removed.
	writeTextFile(t, root, testReferencesOutput, `{
  "version": 1,
  "references": [
    {"id": "REF-001", "converted": "`+zulu+`"},
    {"id": "REF-002", "converted": "`+alpha+`"},
    {"id": "REF-003", "converted": "system/assets/gone/gone.csv"}
  ]
}
`)
	mike := convertTestCSV(t, root, "mike")
	got := buildTestReferences(t, root)
	if got.ids[zulu] != "REF-001" || got.ids[alpha] != "REF-002" {
		t.Fatalf("legacy ids changed: zulu=%q alpha=%q", got.ids[zulu], got.ids[alpha])
	}
	if got.ids[mike] != "REF-004" {
		t.Fatalf("mike id=%q want REF-004", got.ids[mike])
	}
	if len(got.ids) != 3 {
		t.Fatalf("got %d references, want 3: %v", len(got.ids), got.ids)
	}
}

func TestBuildReferencesIndexRefusesUnreadableExistingIndex(t *testing.T) {
	root := t.TempDir()
	convertTestCSV(t, root, "alpha")
	writeTextFile(t, root, testReferencesOutput, "{not json")
	_, err := BuildReferencesIndex(IndexOptions{RepoRoot: root, AssetsRoot: "system/assets", Output: testReferencesOutput})
	if err == nil {
		t.Fatal("expected an error for an unreadable existing index")
	}
	if got := readTextFile(t, root, testReferencesOutput); got != "{not json" {
		t.Fatalf("existing index was overwritten: %q", got)
	}
}

type testReferences struct {
	ids    map[string]string
	order  []string
	nextID int
}

func convertTestCSV(t *testing.T, root, name string) string {
	t.Helper()
	writeTextFile(t, root, name+".csv", "name,value\n"+name+",1\n")
	result, err := Convert(ConvertOptions{RepoRoot: root, Source: name + ".csv", AssetsRoot: "system/assets", Force: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Outputs) != 1 {
		t.Fatalf("%s: outputs=%d", name, len(result.Outputs))
	}
	rel, err := filepath.Rel(root, result.Outputs[0].Path)
	if err != nil {
		t.Fatal(err)
	}
	return filepath.ToSlash(rel)
}

func removeTestTwin(t *testing.T, root, converted string) {
	t.Helper()
	if err := os.Remove(filepath.Join(root, filepath.FromSlash(converted))); err != nil {
		t.Fatal(err)
	}
}

func buildTestReferences(t *testing.T, root string) testReferences {
	t.Helper()
	result, err := BuildReferencesIndex(IndexOptions{RepoRoot: root, AssetsRoot: "system/assets", Output: testReferencesOutput})
	if err != nil {
		t.Fatal(err)
	}
	var index ReferenceIndex
	if err := json.Unmarshal([]byte(readTextFile(t, root, testReferencesOutput)), &index); err != nil {
		t.Fatal(err)
	}
	if result.Count != len(index.References) {
		t.Fatalf("result count=%d, file has %d", result.Count, len(index.References))
	}
	got := testReferences{ids: map[string]string{}, nextID: index.NextID}
	for _, entry := range index.References {
		got.ids[entry.Converted] = entry.ID
		got.order = append(got.order, entry.ID)
	}
	return got
}
