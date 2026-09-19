/**
 * Just enough shell parsing for the Bash guard to ask "what would this command run?" rather than "does this
 * text appear?". Matching text failed both ways (PR #255 review): a force flag after a line continuation, a
 * quoted `;` or a `"$(…)"` argument was never seen, and a commit message that merely mentioned a marker was
 * denied.
 *
 * One recursive scanner: quotes (`'…'`, `"…"`, `$'…'`), backslashes and line continuations; `$(…)`, backticks,
 * `<(…)`, `>(…)` and `(…)`, each scanned as commands of their own; statement separators; redirects; heredocs,
 * whose bodies are text and never commands. Anything left open at the end of the string THROWS, and the guard
 * turns a throw into a deny: a construct this does not understand must not read as "nothing to see".
 *
 * It is a guard against mistakes, not a sandbox: a command assembled at run time (`T="git push"; $T`) cannot
 * be known from its text. The hard guarantee against a force-push belongs on the server (branch protection).
 */

const REDIRECT = /^(&>>|&>|>>|>\||>&|<<<|<<-?|<>|<&|>|<)/;

/**
 * Scans `s` from `i` until `closer` (`)` or a backtick) at this nesting level, or to the end when `closer`
 * is null. Statements found go to `out`; returns the index just past the closer.
 */
function scan(s, i, closer, out) {
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
  const nested = (from, close) => { const j = scan(s, from, close, out); word = (word ?? '') + '$()'; return j - 1; };

  for (; i < s.length; i++) {
    const c = s[i], next = s[i + 1];
    if (c === closer) { endStatement(); return i + 1; }
    if (c === '\\') { if (next !== '\n') word = (word ?? '') + (next ?? ''); i++; }
    else if (c === "'" || (c === '$' && next === "'")) {
      const ansi = c === '$';                                   // $'…' honours backslash escapes, '…' does not
      word ??= '';
      for (i += ansi ? 2 : 1; s[i] !== "'"; i++) {
        if (i >= s.length) throw new Error('unterminated single quote');
        if (ansi && s[i] === '\\') i++;
        word += s[i] ?? '';
      }
    }
    else if (c === '"' || (c === '$' && next === '"')) {
      word ??= '';
      for (i += c === '$' ? 2 : 1; s[i] !== '"'; i++) {
        if (i >= s.length) throw new Error('unterminated double quote');
        if (s[i] === '\\') { if (s[i + 1] !== '\n') word += s[i + 1] ?? ''; i++; }
        else if (s[i] === '$' && s[i + 1] === '(') i = nested(i + 2, ')');
        else if (s[i] === '`') i = nested(i + 1, '`');
        else word += s[i];
      }
    }
    else if (c === '$' && next === '(') i = nested(i + 2, ')');
    else if ((c === '<' || c === '>') && next === '(') { pushWord(); i = nested(i + 2, ')'); }   // process substitution
    else if (c === '`') i = nested(i + 1, '`');
    else if (c === ' ' || c === '\t') pushWord();
    else if (c === '#' && word === null) { while (i + 1 < s.length && s[i + 1] !== '\n') i++; }
    else if (c === '\n') {
      endStatement();
      for (const delimiter of pending) {                        // a heredoc body is text, not commands: skip it
        for (i++; i < s.length; i++) {
          const end = s.indexOf('\n', i), line = s.slice(i, end < 0 ? s.length : end);
          i = end < 0 ? s.length : end;
          if (line.replace(/^\t+/, '') === delimiter) break;
        }
      }
      pending = [];
    }
    else if (c === '(') { endStatement(); i = scan(s, i + 1, ')', out) - 1; }
    else if (c === ';' || c === ')') endStatement();            // a stray `)` is a `case` pattern's
    else if (c === '&' && next !== '>') { endStatement(); if (next === '&') i++; }
    else if (c === '|') { endStatement(); if (next === '|' || next === '&') i++; }
    else if (c === '>' || c === '<' || c === '&') {
      if (word !== null && /^\d+$/.test(word)) word = null;     // `2>` — the digits are a file descriptor
      pushWord();
      const op = REDIRECT.exec(s.slice(i))[0];
      redirectOp = op.startsWith('<<') && op !== '<<<' ? '<<' : op;
      i += op.length - 1;
    }
    else word = (word ?? '') + c;
  }
  if (closer) throw new Error(`unterminated ${closer === ')' ? 'substitution or subshell' : 'backtick'}`);
  endStatement();
  return i;
}

/** @returns {{words: string[], redirects: {op: string, target: string}[]}[]} every statement, nested ones included */
export function parse(cmd) {
  const out = [];
  scan(String(cmd ?? ''), 0, null, out);
  return out;
}

const base = (word) => word.split('/').pop();

/**
 * Every statement the command would run, plus the script handed to `sh -c '…'` or `eval …`, wherever in the
 * statement the shell or `eval` sits — behind `env`, `timeout 30`, `xargs` or anything else.
 */
export function commands(cmd) {
  const found = [];
  const visit = (statements) => {
    for (const st of statements) {
      found.push(st);
      st.words.forEach((w, i) => {
        if (/^(sh|bash|zsh|dash|ksh)$/.test(base(w))) {
          const c = st.words.findIndex((x, j) => j > i && /^-[a-zA-Z]*c[a-zA-Z]*$/.test(x));   // `-c`, `-lc`, `-ec`
          if (c > i) visit(parse(st.words[c + 1] ?? ''));
        }
        if (w === 'eval') visit(parse(st.words.slice(i + 1).join(' ')));
      });
    }
  };
  visit(parse(cmd));
  return found;
}

/** Where `tool` is run in a statement: any word whose basename is `tool`, so no list of wrappers is needed. */
export const runsAt = (words, tool) => words.flatMap((w, i) => (base(w) === tool ? [i] : []));
