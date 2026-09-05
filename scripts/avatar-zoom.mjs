import { chromium } from '@playwright/test';
const m = await import('/tmp/avatars.mjs');
const pick = m.AVATARS.filter(a=>['blaze','volt','shadow'].includes(a.id));
const html = `<html><body style="margin:0;background:radial-gradient(circle at 50% 30%,#2a3352,#0b0e1c);display:flex;gap:20px;padding:20px">${pick.map(a=>m.avatarSVG(a,'idle',360)).join('')}${m.avatarSVG(pick[0],'happy',360)}</body></html>`;
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const p = await b.newPage({viewport:{width:1560,height:520}});
await p.setContent(html); await p.screenshot({path:'/tmp/zoom.png'}); await b.close();
