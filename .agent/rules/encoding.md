# Character Encoding & UTF-8 Guidelines

## Critical Rule
Always preserve UTF-8 encoding across all files (`.js`, `.html`, `.css`, `.json`, `.md`, `.spec.js`).

## Why This Matters
On Windows environments (PowerShell / Windows CMD), default stream redirections, pipes, and certain legacy cmdlets (e.g., `Set-Content` without `-Encoding utf8`, `Out-File`, `>`) decode or write bytes using Windows-1252 / ANSI. This corrupts multi-byte UTF-8 sequences into mojibake:
- `✕` (U+2715) becomes `âœ•`
- `•` (U+2022) becomes `â€¢`
- `—` (U+2014) becomes `â€”`
- `–` (U+2013) becomes `â€“`
- `──` becomes `â”€â”€`
- Emojis (e.g. `🥟`) undergo double-transcoding into sequences like `ÃƒÂ°Ã…Â¸Ã‚Â¥Ã…Â¸`.

## Rules for Agents & Developers
1. **Never use non-UTF-8 shell redirection to edit or create source files**:
   - Avoid PowerShell `Get-Content ... | Set-Content ...` without explicit `-Encoding utf8`.
   - Avoid `>` or `>>` redirection in PowerShell unless `$OutputEncoding = [System.Text.Encoding]::UTF8` and `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` are set.
2. **Use Dedicated File Tools**:
   - Always use proper UTF-8 file reading and editing tools (`edit_file`, `write_file`) or Node.js scripts using explicit `'utf8'`.
3. **HTML Entitites vs. Literal Unicode**:
   - For UI text where ambiguity may arise in HTML templates, standard entities (like `&bull;` for bullet points) or direct unicode characters written via UTF-8 tools are acceptable.
4. **Pre-commit / Pre-push Verification**:
   - Verify that changes do not introduce unintended ANSI mojibake sequences (`â€`, `âœ`, `â”`, `Ãƒ`, `Ã‚`).
