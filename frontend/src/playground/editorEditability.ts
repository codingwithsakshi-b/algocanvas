import { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export const editorEditableCompartment = new Compartment();

export function editorEditableExtension(readOnly: boolean) {
  return editorEditableCompartment.of(EditorView.editable.of(!readOnly));
}

export function editorEditabilityEffect(readOnly: boolean) {
  return editorEditableCompartment.reconfigure(
    EditorView.editable.of(!readOnly),
  );
}
