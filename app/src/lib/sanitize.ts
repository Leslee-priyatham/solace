import "server-only";
import sanitizeHtml from "sanitize-html";

// Rich text is stored as HTML and rendered with dangerouslySetInnerHTML, and server actions accept any
// payload — so HTML is cleaned on every write. The allowlist matches what the editor (TipTap StarterKit,
// h2/h3) and textToHtml produce; anything else (scripts, event handlers, styles, iframes…) is dropped.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "code", "pre", "blockquote", "ul", "ol", "li", "h1", "h2", "h3", "h4", "hr", "a"],
  allowedAttributes: { a: ["href", "target", "rel"], ol: ["start"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

export function sanitizeRichHtml(html: string | null | undefined): string {
  return sanitizeHtml(html ?? "", OPTIONS);
}
