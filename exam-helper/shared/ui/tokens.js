/** popup 与 Shadow DOM 气泡共用的设计 token（与 shared/ui/tokens.css 对齐） */
export const DESIGN_TOKENS_CSS = `
  :host, :root {
    --text-primary: #1a2230;
    --text-secondary: #5c6573;
    --text-muted: #5a6270;
    --accent: #2f6f58;
    --accent-soft: #245545;
    --highlight: #ffe58a;
    --error: #b84a4a;
    --surface: rgba(255, 255, 255, 0.92);
    --surface-muted: #f6f8fb;
    --surface-input: #eef1f6;
    --border: rgba(26, 34, 48, 0.1);
    --shadow: rgba(26, 34, 48, 0.14);
    --z-overlay: 2147483647;
  }
`;
