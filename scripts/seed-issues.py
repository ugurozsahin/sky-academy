#!/usr/bin/env python3
"""One-off: create the labels and issues in scripts/issues-seed.json on GitHub (run from the repo root on a machine
that has the owner's token in .git/github-credentials). Idempotent per title: existing open/closed issues with the
same title are reused. Writes scripts/issues-created.json (title -> number) and prints a summary."""
import json, re, sys, urllib.request, urllib.error, time
REPO = 'ugurozsahin/sky-academy'
tok = None
for line in open('.git/github-credentials'):
    m = re.search(r'https://[^:]+:([^@]+)@github\.com', line.strip())
    if m: tok = m.group(1)
if not tok: sys.exit('no github.com token in .git/github-credentials')
def api(method, path, data=None):
    req = urllib.request.Request(f'https://api.github.com{path}', method=method, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Authorization': f'Bearer {tok}', 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'sna-seed'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return r.status, json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'null')
seed = json.load(open('scripts/issues-seed.json'))
WORKFLOW = """

### Workflow (minimum scrum — the developer and the reviewer/QA must be different agents)
- [ ] **Refine** — acceptance criteria written at the top of this issue (Claude proposes, owner may adjust)
- [ ] **Develop** — agent A: branch `claude/issue-{n}`, implement + tests (`npm test`, `npx tsc --noEmit`, e2e mobile), open a PR that says `Closes #{n}`
- [ ] **Review** — a *different* agent (fresh subagent, or the next routine run) reviews the PR diff against CLAUDE.md, the acceptance criteria and the tests; approves or requests changes in the PR
- [ ] **QA** — the reviewer (never the developer) runs the full e2e (mobile + desktop) on the PR and plays the feature (screenshots); results recorded in the PR
- [ ] **Owner action** — {owner}
- [ ] **Done** — merged to `main`, issue closed with the commit hash
"""
def with_workflow(it, n):
    if it.get('state') == 'closed': return it['body']
    return it['body'] + WORKFLOW.format(n=n, owner=it.get('owner_action') or seed.get('owner_action_default', 'none expected'))
for name, color, desc in seed['labels']:
    st, _ = api('POST', f'/repos/{REPO}/labels', {'name': name, 'color': color, 'description': desc})
    if st not in (201, 422): print('label', name, st)
existing = {}
page = 1
while True:
    st, lst = api('GET', f'/repos/{REPO}/issues?state=all&per_page=100&page={page}')
    if st != 200 or not lst: break
    for i in lst:
        if 'pull_request' not in i: existing[i['title']] = i['number']
    page += 1
created = {}; keys = {}
for it in seed['issues']:
    n = existing.get(it['title'])
    if n is None:
        st, r = api('POST', f'/repos/{REPO}/issues', {'title': it['title'], 'body': it['body'], 'labels': it['labels']})
        if st != 201: print('FAIL', it['title'], st, r); continue
        n = r['number']; time.sleep(0.6)
        api('PATCH', f'/repos/{REPO}/issues/{n}', {'body': with_workflow(it, n)})
        if it.get('state') == 'closed': api('PATCH', f'/repos/{REPO}/issues/{n}', {'state': 'closed', 'state_reason': 'completed'})
    else: api('PATCH', f'/repos/{REPO}/issues/{n}', {'body': with_workflow(it, n), 'labels': it['labels'], **({'state': 'closed', 'state_reason': 'completed'} if it.get('state') == 'closed' else {})}); time.sleep(0.3)   # refresh an existing issue
    created[it['title']] = n
    if it.get('key'): keys[it['key']] = n
for it in seed['issues']:                       # second pass: cross-references
    if '{{' in it['body'] and it['title'] in created:
        body = re.sub(r'\{\{(.+?)\}\}', lambda m: f"#{keys.get(m.group(1), '?')}", with_workflow(it, created[it['title']]))
        api('PATCH', f'/repos/{REPO}/issues/{created[it["title"]]}', {'body': body})
order_title = '📌 Priority order (owner-maintained)'
lines = [f'- [ ] #{created[i["title"]]} {i["title"]}' for i in seed['issues'] if i.get('state') != 'closed' and 'later' not in i['labels'] and i['title'] in created]
body = ('The owner keeps this list in order; Claude (interactive sessions and the hourly routine) works top-down, '
        'skipping items labelled `owner-input` unless the owner is in the session, and only picking items labelled `routine-ok` in the routine.\n\n'
        'Tick or reorder freely — the routine re-reads this issue every run.\n\n' + '\n'.join(lines))
if order_title in existing: api('PATCH', f'/repos/{REPO}/issues/{existing[order_title]}', {'body': body}); on = existing[order_title]
else:
    st, r = api('POST', f'/repos/{REPO}/issues', {'title': order_title, 'body': body, 'labels': ['priority:P1']}); on = r.get('number') if st == 201 else None
created[order_title] = on
json.dump(created, open('scripts/issues-created.json', 'w'), indent=1, ensure_ascii=False)
print(f'{len(created)} issues; order issue #{on}')
