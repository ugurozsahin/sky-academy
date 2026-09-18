/**
 * Just enough shell parsing for the Bash guard to ask "what would this command run?" rather than "does this
 * text appear?". Matching text failed both ways (PR #255 review): a force flag after a line continuation, a
 * quoted `;` or a `"$(…)"` argument was never seen, and a commit message that merely mentioned a marker was
 * denied.
 *
 * It understands quotes, backslashes and line continuations, `$(…)` and backticks (parsed as commands of
 * their own), statement separators, redirects, heredocs (kept as text, never run as commands) and
 * `sh -c '…'` / `eval`. It is a guard against mistakes, not a sandbox: a command assembled at run time
 * (`T="git push"; $T`) cannot be known from its text.
 */

/** Index just past the `)` that closes the `$(` whose body starts at `i`. */
const closeParen = (s, i) => {
  for (let depth = 1, quote = null; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') i++;
    else if (quote) { if (c === quote) quote = null; }
    else if (c === "'" || c === '"') quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i + 1;
  }
  return s.length;
};

/** @returns {{words: string[], redirects: {op: string, target: string}[]}[]} */
export function parse(cmd, out = []) {
  const s = String(cmd ?? '');
  let words = [], redirects = [], word = null, redirectOp = null, pending = [];
  const pushWord = () => {
    if (word === null) return;
    if (redirectOp === '<<') pending.push(word);
    else if (redirectOp) redirects.push({ op: redirectOp, target: word });
    else words.push(word);
    word = null; redirectOp = null;
  };
  const endStatement = () => {
    pushWord();
    if (words.length || redirects.length) out.push({ words, redirects });
    words = []; redirects = [];
  };
  const substitution = (body) => { parse(body, out); word = (word ?? '') + '$()'; };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') { if (s[i + 1] !== '\n') word = (word ?? '') + (s[i + 1] ?? ''); i++; }
    else if (c === "'") { const end = s.indexOf("'", i + 1); const j = end < 0 ? s.length : end; word = (word ?? '') + s.slice(i + 1, j); i = j; }
    else if (c === '"') {
      word ??= '';
      for (i++; i < s.length && s[i] !== '"'; i++) {
        if (s[i] === '\\') { if (s[i + 1] !== '\n') word += s[i + 1] ?? ''; i++; }
        else if (s[i] === '$' && s[i + 1] === '(') { const j = closeParen(s, i + 2); substitution(s.slice(i + 2, j - 1)); i = j - 1; }
        else if (s[i] === '`') { const j = s.indexOf('`', i + 1); const k = j < 0 ? s.length : j; substitution(s.slice(i + 1, k)); i = k; }
        else word += s[i];
      }
    }
    else if (c === '$' && s[i + 1] === '(') { const j = closeParen(s, i + 2); substitution(s.slice(i + 2, j - 1)); i = j - 1; }
    else if (c === '`') { const j = s.indexOf('`', i + 1); const k = j < 0 ? s.length : j; substitution(s.slice(i + 1, k)); i = k; }
    else if (c === ' ' || c === '\t') pushWord();
    else if (c === '#' && word === null) { while (i < s.length && s[i] !== '\n') i++; i--; }
    else if (c === '\n') {
      endStatement();
      for (const delimiter of pending) {                     // a heredoc body is text, not commands: skip it
        for (i++; i < s.length; i++) {
          const end = s.indexOf('\n', i), line = s.slice(i, end < 0 ? s.length : end);
          i = end < 0 ? s.length : end;
          if (line.replace(/^\t+/, '') === delimiter) break;
        }
      }
      pending = [];
    }
    else if (c === ';' || c === '(' || c === ')') endStatement();
    else if (c === '&' && s[i + 1] !== '>') { endStatement(); if (s[i + 1] === '&') i++; }
    else if (c === '|') { endStatement(); if (s[i + 1] === '|' || s[i + 1] === '&') i++; }
    else if (c === '>' || c === '<' || (c === '&' && s[i + 1] === '>')) {
      if (word !== null && /^\d+$/.test(word)) word = null;  // `2>` — the digits are a file descriptor
      pushWord();
      const op = /^(&>>|&>|>>|>\||>&|<<<|<<-?|<>|<&|>|<)/.exec(s.slice(i))[0];
      redirectOp = op.startsWith('<<') && op !== '<<<' ? '<<' : op;
      i += op.length - 1;
    }
    else word = (word ?? '') + c;
  }
  endStatement();
  return out;
}

// Words that run the command that follows them.
const WRAPPERS = new Set(['env', 'command', 'sudo', 'time', 'nohup', 'exec', 'builtin', '{', '!', 'if', 'then', 'else', 'elif', 'do', 'while', 'until']);

/**
 * The command each statement really runs: leading `VAR=value` and wrapper words skipped, and the script
 * inside `sh -c '…'` or `eval …` parsed as statements of its own.
 * @returns {{name: string, args: string[], redirects: {op: string, target: string}[]}[]}
 */
export function commands(cmd) {
  const found = [];
  const visit = (statements) => {
    for (const st of statements) {
      const w = st.words.slice();
      for (let wrapped = false; w.length; ) {
        if (/^[A-Za-z_]\w*=/.test(w[0])) w.shift();
        else if (WRAPPERS.has(w[0])) { w.shift(); wrapped = true; }
        else if (wrapped && w[0].startsWith('-')) w.shift();               // the wrapper's own options
        else break;
      }
      const [name = '', ...args] = w;
      const base = name.split('/').pop();
      found.push({ name: base, args, redirects: st.redirects });
      if (/^(sh|bash|zsh|dash)$/.test(base) && args.includes('-c')) visit(parse(args[args.indexOf('-c') + 1] ?? ''));
      if (base === 'eval') visit(parse(args.join(' ')));
    }
  };
  visit(parse(cmd));
  return found;
}
