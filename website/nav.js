// The Curriculum menu as a disclosure (#2174, the W3C APG disclosure navigation pattern). Without this file the
// <details> works on its own. With it, the summary becomes a button with aria-expanded and aria-controls, and the
// list closes on Escape (focus back to the button), on a press outside and when focus leaves the menu. Nothing is
// fetched, sent or stored: tests/unit/site-nav-script.test.ts holds that.
(() => {
  const details = document.querySelector('details.nav-years');
  if (!details) return;
  const list = details.querySelector('ul');
  const box = document.createElement('div');
  const button = document.createElement('button');
  box.className = 'nav-years';
  button.type = 'button';
  button.textContent = details.querySelector('summary').textContent;
  list.id = 'nav-years-list';
  button.setAttribute('aria-controls', list.id);
  const isOpen = () => button.getAttribute('aria-expanded') === 'true';
  const set = open => button.setAttribute('aria-expanded', String(open));
  set(details.open);
  box.append(button, list);
  details.replaceWith(box);

  button.addEventListener('click', () => set(!isOpen()));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) { set(false); button.focus(); }
  });
  // Focus moving to nothing (Safari blurs the button when a link in the list is clicked) is left to pointerdown.
  box.addEventListener('focusout', e => { if (e.relatedTarget && !box.contains(e.relatedTarget)) set(false); });
  // pointerdown, not click: a tap on plain page text fires no click on iOS, and focus does not move either.
  document.addEventListener('pointerdown', e => { if (!box.contains(e.target)) set(false); });
  addEventListener('pageshow', () => set(false));   // back to this page: the menu is closed, as on a fresh load
})();
