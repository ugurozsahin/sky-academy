# Codex project instructions

Read `CLAUDE.md` at the repository root before working. It contains the shared
project context, development rules, testing requirements, and review/merge gates.
Follow those rules without duplicating them here.

For an explicitly requested development routine, read `docs/ROUTINE-PROMPT.md`
and follow its routine instructions. For an explicitly requested watchdog run,
read `docs/WATCHDOG-PROMPT.md`. Reading these files for setup or validation does
not itself start a routine or authorise GitHub writes.

Never expose credentials in messages, logs, command output, commits, or
artifacts. Do not print environment variables or authentication files that may
contain secrets. Redact sensitive values when reporting errors.

Keep owner-facing responses brief and in Turkish. Provide prompts intended for
the owner to paste into another session in English. Use British English for
code, comments, and game text.
