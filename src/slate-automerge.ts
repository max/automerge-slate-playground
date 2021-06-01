import Automerge from 'automerge'
import { Operation, Range, SelectionOperation } from 'slate'
import range from 'lodash/range'
import every from 'lodash/every'

export type AutomergeSpan = {
  // todo: add type exports for this to the automerge cursors branch
  start: Automerge.Cursor;
  end: Automerge.Cursor;
}

export type TextFormat = "bold" | "italic" | "underline"

export type Comment = {
  id: string;
  range: AutomergeSpan;
  text: string;
}

export type MarkdownDoc = {
  content: Automerge.Text;
  comments: Comment[];
}

export type RichTextDoc = {
  content: Automerge.Text;
  formatSpans: { span: AutomergeSpan, format: TextFormat, remove?: boolean }[]
}

type ToggleInlineFormatOperation = {
  type: "toggle_inline_formatting"
  selection: Range,
  format: TextFormat
}

// Our own Operation type, which includes all of Slate's operations
// and some custom operations of our own.
// (Todo: probably eventually makes sense to fully customize our operation types)
export type ExtendedSlateOperation = Operation | ToggleInlineFormatOperation

/**
 * Applies an operation from the Slate editor to the Automerge doc storing the content.
 * (Because of how Automerge handles reads/writes separately,
 * we pass in a readable copy and a function to facilitate writes)
 * @param op - the operation to apply
 * @param doc - a readable version of the Automerge document
 * @param changeDoc - to write to the doc, pass a callback into changeDoc
 */
export function applySlateOp(
  op: ExtendedSlateOperation,
  doc: RichTextDoc,
  changeDoc: (callback: (doc: RichTextDoc) => void) => void
): void {
  console.log("applying op", op)
  if (op.type === 'insert_text') {
    changeDoc(d => d.content.insertAt(op.offset, op.text))
  }
  if (op.type === 'remove_text') {
    changeDoc(d => d.content.deleteAt(op.offset, op.text.length))
  }
  // "Toggle" should add formatting iff it's not already applied to all characters in selection.
  // (TODO: should this be handled in the editor UI? Or in this translation layer?)
  if (op.type === 'toggle_inline_formatting') {
    const flatFormatting = flattenedFormatting(doc)
    const selectedArray = flatFormatting.slice(Range.start(op.selection).offset, Range.end(op.selection).offset)
    const isActive = every(selectedArray, c => c && c[op.format] === true)
    const span = automergeSpanFromSlateRange(doc.content, op.selection)
    if (isActive) {
      changeDoc(d => d.formatSpans.push({ span, format: op.format, remove: true }))
      // Note: In normal Slate usage you'd put something like this:
      // Editor.removeMark(editor, format)
      // which would split up tree nodes and set properties on the newly created node.
      // Instead of doing this, we record the format span in the annotations representation,
      // and we avoid splitting nodes.
    } else {
      changeDoc(d => d.formatSpans.push({ span, format: op.format }))
      // Same as above; don't do Slate's typical process here
      // Editor.addMark(editor, format, true)
    }
  }
}

// convert an Automerge Span to a Slate Range.
// Assumes the Slate doc only has a single text node, and no other blocks.
export function slateRangeFromAutomergeSpan(span: AutomergeSpan): Range {
  return {
    anchor: {
      path: [0, 0],
      offset: span.start.index
    },
    focus: {
      path: [0, 0],
      offset: span.end.index
    }
  }
}

// convert a Slate Range to an Automerge Span.
// Assumes the Slate doc only has a single text node, and no other blocks.
export function automergeSpanFromSlateRange(text: Automerge.Text, range: Range): AutomergeSpan {
  return {
    start: text.getCursorAt(range.anchor.offset),
    end: text.getCursorAt(range.focus.offset)
  }
}

// Returns an array of objects, one per character in the doc,
// representing the formatting applied to that character.
// Useful for figuring out how a toggle operation should behave
function flattenedFormatting(doc: RichTextDoc) {
  const chars: { [key: string]: boolean }[] = range(doc.content.length).map(c => {})
  for(const formatSpan of doc.formatSpans) {
    let start: number, end: number;

    // compute a start and end s.t. start comes before end
    // so we don't end up with backwards spans
    if(formatSpan.span.end.index > formatSpan.span.start.index) {
      start = formatSpan.span.start.index;
      end = formatSpan.span.end.index;
    } else {
      start = formatSpan.span.end.index;
      end = formatSpan.span.start.index;
    }

    for(let i = start; i < end; i++) {
      if(chars[i] === undefined) chars[i] = {}
      if(!formatSpan.remove) {
        chars[i][formatSpan.format] = true
      } else {
        chars[i][formatSpan.format] = false
      }
    }
  }

  return chars
}

