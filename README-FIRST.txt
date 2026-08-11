HIDEIT v1.0 — GITHUB READY
==========================
Purpose: permanent browser-based PDF redaction.

Core workflow:
Choose/drop PDF -> drag black boxes -> undo/clear -> navigate pages -> Redact & download.

Security design:
The exported document is rebuilt from rendered page images. The original PDF text/object structure is not copied into the output. Redactions are burned into the rendered page before embedding into a fresh PDF. Standard output metadata fields are reset.

Important launch testing:
1. Test multi-page PDFs.
2. Test mouse and touch redaction.
3. Copy/paste/search text under a redaction in the OUTPUT — it should not exist as selectable text because output pages are flattened images.
4. Try extracting text/images from the output with a PDF tool.
5. Visually inspect every redaction before sharing.
6. Test large PDFs on mobile for memory limits.

External libraries:
PDF.js 3.11.174 and pdf-lib 1.17.1 are loaded from CDNs.
