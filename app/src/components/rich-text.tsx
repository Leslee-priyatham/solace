"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Heading3 } from "lucide-react";
import { cn } from "./ui";

/**
 * Rich text field. Calls onChange (debounced) while typing and onFocusEditor so a parent
 * toolbar can drive undo/redo for whichever section was edited last.
 */
export function RichText({
  value,
  onChange,
  editable = true,
  placeholder,
  toolbar = false,
  className,
  onFocusEditor,
  debounceMs = 800,
}: {
  value: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  toolbar?: boolean;
  className?: string;
  onFocusEditor?: (editor: Editor) => void;
  debounceMs?: number;
}) {
  const timer = useRef<number | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;
  // The editor normalises HTML (e.g. wraps list items in <p>), so compare against what it
  // produced rather than the raw prop to avoid saving content nobody changed.
  const lastEmitted = useRef<string | null>(null);
  const knownProp = useRef(value);

  const emit = (html: string) => {
    if (html === lastEmitted.current) return;
    lastEmitted.current = html;
    latest.current?.(html);
  };

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Placeholder.configure({ placeholder: placeholder ?? "Write here…" })],
    content: value,
    editable,
    immediatelyRender: false,
    editorProps: { attributes: { class: cn("prose-note tiptap", className) } },
    onCreate: ({ editor }) => {
      lastEmitted.current = editor.getHTML();
    },
    onUpdate: ({ editor }) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        emit(editor.getHTML());
      }, debounceMs);
    },
    onFocus: ({ editor }) => onFocusEditor?.(editor),
    onBlur: ({ editor }) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        emit(editor.getHTML());
      }
    },
  });

  // Replace content when it changes from outside (regenerate, assistant edit).
  useEffect(() => {
    if (!editor || value === knownProp.current) return;
    knownProp.current = value;
    if (!editor.isFocused) {
      editor.commands.setContent(value, { emitUpdate: false });
      lastEmitted.current = editor.getHTML();
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return <div className={cn("prose-note", className)} dangerouslySetInnerHTML={{ __html: value }} />;

  return (
    <div>
      {toolbar && editable && (
        <div className="mb-2 flex gap-1 border-b border-line pb-2">
          <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold">
            <Bold className="size-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic">
            <Italic className="size-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="Heading">
            <Heading3 className="size-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Bullet list">
            <List className="size-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered list">
            <ListOrdered className="size-4" />
          </ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" title={label} onClick={onClick} className={cn("rounded p-1.5 hover:bg-black/5", active && "bg-brand-50 text-brand-700")}>
      {children}
    </button>
  );
}
