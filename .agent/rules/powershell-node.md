# PowerShell & Node.js Command Execution Guidelines

## Critical Rule
Never run complex or multi-statement inline `node -e "..."` one-liners in Windows PowerShell when the code contains `$` characters (such as Cheerio's `$(el)`, regexes like `/$1/`, or template literals `${...}`) or nested quotes.

## Why This Matters
In Windows PowerShell:
- Double-quoted strings (`"..."`) interpolate `$` as PowerShell variables (e.g., `$(el)` is evaluated as a PowerShell subexpression before `node` is even invoked, causing `Command exited with code 1` syntax errors).
- Nested quotes inside `node -e "..."` or `node -e '...'` are frequently stripped or mangled by PowerShell's argument parser when passed to native executables.

## Rules for Agents
1. **Use Scratch Scripts Instead of `node -e` One-Liners**:
   - Whenever you need to run a one-off Node.js inspection, data check, or Cheerio/HTML query, write a small `.mjs` or `.cjs` script to the conversation's `scratch/` directory using `write_file` and execute it with `node "<path-to-script.mjs>"`.
2. **Simple Single-Quoted Expressions Only**:
   - Only use `node -e '...'` in PowerShell for trivial single-quoted expressions that contain **no** single quotes, **no** template literals, and **no** double-quote escaping issues.
3. **Use PowerShell-Native Paths & Operators**:
   - Remember the shell is PowerShell on Windows: use `;` instead of `&&` when chaining commands in older PowerShell environments, or run commands sequentially.
