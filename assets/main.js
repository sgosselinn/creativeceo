(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const body = document.body;

  /* ── Langue (lue sur <html lang>) ── */
  const lang = document.documentElement.lang.startsWith('en') ? 'en' : 'fr';
  const T = {
    fr: {
      video: 'Vidéo de présentation',
      close: 'Fermer',
      required: 'Remplis tous les champs pour continuer.',
      sending: 'Envoi en cours…',
      thanks: 'Merci ! Je te reviens très bientôt.',
      error: 'Oups, l\u2019envoi n\u2019a pas fonctionné. Réessaie dans un instant.',
      newsletter: 'Merci ! Surveille ta boîte courriel.',
    },
    en: {
      video: 'Introduction video',
      close: 'Close',
      required: 'Please fill in every field to continue.',
      sending: 'Sending…',
      thanks: 'Thank you! I\u2019ll get back to you very soon.',
      error: 'Oops, something went wrong. Please try again in a moment.',
      newsletter: 'Thanks! Keep an eye on your inbox.',
    },
  }[lang];

  /* ── Mobile menu ── */
  const menu = $('#mobile-menu');
  const burger = $('[data-menu-open]');
  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
    body.classList.toggle('no-scroll', open);
  };
  burger.addEventListener('click', () => setMenu(true));
  $('[data-menu-close]').addEventListener('click', () => setMenu(false));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));

  /* ── Nav active ── */
  const navLinks = $$('.nav-links a');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting || body.dataset.page) return;
        navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(s => io.observe(s));
    // Page dédiée : le lien pointant vers la page courante reste actif
    if (body.dataset.page) navLinks.forEach(a => a.classList.toggle('active', a.dataset.page === body.dataset.page));
  }

  /* ── VSL (chargement au clic) ── */
  const vsl = $('.vsl');
  if (vsl) $('.vsl-play', vsl).addEventListener('click', () => {
    const src = vsl.dataset.videoSrc;
    if (!src) return;
    const f = document.createElement('iframe');
    f.src = src + (src.includes('?') ? '&' : '?') + 'autoplay=1';
    f.allow = 'autoplay; fullscreen; picture-in-picture';
    f.allowFullscreen = true;
    f.title = T.video;
    vsl.replaceChildren(f);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('open')) setMenu(false);
  });

  /* ── Pop-up formulaire (5 s après l'arrivée) ── */
  const POPUP_KEY = 'tcc-popup';
  const POPUP_DELAY = 5000;               // délai avant l'ouverture
  const POPUP_SNOOZE = 7 * 24 * 3600e3;   // ne réapparaît pas pendant 7 jours après fermeture
  const store = {
    get: () => { try { return JSON.parse(localStorage.getItem(POPUP_KEY)) || {}; } catch (_) { return {}; } },
    set: (v) => { try { localStorage.setItem(POPUP_KEY, JSON.stringify(v)); } catch (_) {} },
  };
  const srcForm = $('[data-lead-form]');
  let popup = null;
  if (srcForm && typeof HTMLDialogElement === 'function') {
    popup = document.createElement('dialog');
    popup.className = 'popup';
    popup.setAttribute('aria-labelledby', 'popup-title');
    // Titre du pop-up repris de l'en-tête de la section formulaire (donc déjà dans la bonne langue)
    const head = srcForm.closest('.lead');
    const txt = (sel) => { const el = head && $(sel, head); return el ? el.innerHTML : ''; };
    popup.innerHTML = `
      <button class="popup-close" type="button" aria-label="${T.close}">×</button>
      <p class="eyebrow">${txt('.eyebrow')}</p>
      <div class="divider"></div>
      <h2 class="popup-title" id="popup-title">${txt('.section-title')}</h2>
      <p class="popup-desc">${txt('.section-desc')}</p>`;
    const clone = srcForm.cloneNode(true);
    $$('[id]', clone).forEach(el => { el.id = 'popup-' + el.id; });
    $$('label[for]', clone).forEach(el => { el.htmlFor = 'popup-' + el.htmlFor; });
    const src = $('input[name="source"]', clone);
    if (src) src.value = 'popup-' + src.value;
    const goal = $('textarea', clone);
    if (goal) goal.rows = 3;
    popup.appendChild(clone);
    body.appendChild(popup);

    const closePopup = () => {
      if (!popup.open) return;
      popup.close();
    };
    popup.addEventListener('close', () => {
      body.classList.remove('no-scroll');
      const st = store.get();
      if (!st.sent) store.set({ ...st, closedAt: Date.now() });
    });
    $('.popup-close', popup).addEventListener('click', closePopup);
    // Clic sur le fond sombre = fermeture
    popup.addEventListener('click', e => { if (e.target === popup) closePopup(); });
    popup.addEventListener('lead:sent', () => setTimeout(closePopup, 2500));

    const st = store.get();
    const snoozed = st.sent || (st.closedAt && Date.now() - st.closedAt < POPUP_SNOOZE);
    if (!snoozed) setTimeout(() => {
      // Pas d'interruption si le visiteur est déjà occupé (menu, formulaire)
      const busy = menu.classList.contains('open')
        || (document.activeElement && document.activeElement.closest('form'))
        || store.get().sent;
      if (busy) return;
      popup.showModal();
      body.classList.add('no-scroll');
    }, POPUP_DELAY);
  }

  /* ── Formulaire (envoi vers le CRM via l'attribut action) ── */
  $$('[data-lead-form]').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('[data-lead-msg]', f);
    const btn = $('button[type="submit"]', f);
    f.classList.add('submitted');
    if (!f.checkValidity()) {
      msg.textContent = T.required;
      $(':invalid', f).focus();
      return;
    }
    const action = f.getAttribute('action');
    const data = Object.fromEntries(new FormData(f));
    const bot = data.website;
    delete data.website;
    btn.disabled = true;
    msg.textContent = T.sending;
    try {
      // Champ piège rempli = robot : on fait semblant d'envoyer
      if (action && !bot) {
        const params = new URLSearchParams(location.search);
        const payload = {
          ...data,
          full_name: `${data.first_name} ${data.last_name}`.trim(),
          language: lang,
          page_url: location.href,
          referrer: document.referrer || '',
          submitted_at: new Date().toISOString(),
        };
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(k => {
          if (params.get(k)) payload[k] = params.get(k);
        });
        const res = await fetch(action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(res.status);
      }
      f.reset();
      f.classList.remove('submitted');
      msg.textContent = T.thanks;
      store.set({ ...store.get(), sent: true });
      f.dispatchEvent(new CustomEvent('lead:sent', { bubbles: true }));
    } catch (_) {
      msg.textContent = T.error;
    } finally {
      btn.disabled = false;
    }
  }));

  /* ── Newsletter (fallback si aucun action n'est défini) ── */
  const form = $('[data-newsletter]');
  if (form) form.addEventListener('submit', e => {
    if (form.getAttribute('action')) return;
    e.preventDefault();
    $('[data-newsletter-msg]').textContent = T.newsletter;
    form.reset();
  });
})();
