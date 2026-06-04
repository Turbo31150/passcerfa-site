// Accessibilité — Toggles dyslexie / contraste / taille texte. Persistance localStorage.
(function () {
  const body = document.body;
  const dys = document.getElementById('dyslexie-toggle');
  const ctr = document.getElementById('contrast-toggle');
  const big = document.getElementById('taille-plus');

  function apply() {
    if (localStorage.getItem('a11y-dys') === '1') { body.classList.add('dyslexie'); dys.setAttribute('aria-pressed', 'true'); }
    if (localStorage.getItem('a11y-ctr') === '1') { body.classList.add('contrast'); ctr.setAttribute('aria-pressed', 'true'); }
    const fs = localStorage.getItem('a11y-fs');
    if (fs) document.documentElement.style.setProperty('--font-size', fs + 'px');
  }

  dys.addEventListener('click', () => {
    body.classList.toggle('dyslexie');
    const on = body.classList.contains('dyslexie');
    dys.setAttribute('aria-pressed', on ? 'true' : 'false');
    localStorage.setItem('a11y-dys', on ? '1' : '0');
  });

  ctr.addEventListener('click', () => {
    body.classList.toggle('contrast');
    const on = body.classList.contains('contrast');
    ctr.setAttribute('aria-pressed', on ? 'true' : 'false');
    localStorage.setItem('a11y-ctr', on ? '1' : '0');
  });

  big.addEventListener('click', () => {
    const current = parseInt(localStorage.getItem('a11y-fs') || '17', 10);
    const next = current >= 24 ? 17 : current + 2;
    document.documentElement.style.setProperty('--font-size', next + 'px');
    localStorage.setItem('a11y-fs', next);
  });

  apply();

  // Menu hamburger mobile
  const hamburger = document.getElementById('nav-hamburger');
  const navMenu = document.getElementById('nav-menu');
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      const open = navMenu.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
      hamburger.setAttribute('aria-label', open ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation');
    });
    // Fermer au clic sur un lien
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Ouvrir le menu de navigation');
      });
    });
    // Fermer avec Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Ouvrir le menu de navigation');
        hamburger.focus();
      }
    });
  }
})();
