import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import test from "node:test";
import {
  editorEditabilityEffect,
  editorEditableExtension,
} from "../src/playground/editorEditability.ts";

test("locking the editor for Run preserves its document and unlocks without clearing it", () => {
  const source = '#include <iostream>\nint main() { std::cout << "keep me"; }\n';
  const initialState = EditorState.create({
    doc: source,
    extensions: [editorEditableExtension(false)],
  });

  const runningState = initialState.update({
    effects: editorEditabilityEffect(true),
  }).state;
  assert.equal(runningState.doc.toString(), source);
  assert.equal(runningState.facet(EditorView.editable), false);

  const completedState = runningState.update({
    effects: editorEditabilityEffect(false),
  }).state;
  assert.equal(completedState.doc.toString(), source);
  assert.equal(completedState.facet(EditorView.editable), true);
});
