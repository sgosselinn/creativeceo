(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const body = document.body;

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
    f.title = 'Vidéo de présentation';
    vsl.replaceChildren(f);
  });

  /* ── Cart ── */
  const KEY = 'tcc-cart';
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { cart = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (_) {} };
  const fmt = (n) => (Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')) + '$';

  const drawer = $('#cart');
  const overlay = $('.cart-overlay');
  const itemsEl = $('[data-cart-items]');
  const totalEl = $('[data-cart-total]');
  const badge = $('[data-cart-count]');
  const checkout = $('[data-checkout]');
  let lastFocus = null;

  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const render = () => {
    const count = cart.reduce((n, i) => n + i.qty, 0);
    const total = cart.reduce((n, i) => n + i.qty * i.price, 0);
    badge.textContent = count;
    badge.classList.toggle('visible', count > 0);
    totalEl.textContent = fmt(total);
    checkout.disabled = count === 0;
    itemsEl.innerHTML = cart.length
      ? cart.map(i => `
        <li class="cart-item">
          <div class="cart-thumb" aria-hidden="true">${esc(i.icon)}</div>
          <div class="cart-info">
            <div class="cart-name">${esc(i.name)}</div>
            <div class="cart-type">${esc(i.type)}</div>
            <div class="qty">
              <button type="button" data-dec="${esc(i.id)}" aria-label="Retirer un">−</button>
              <span>${i.qty}</span>
              <button type="button" data-inc="${esc(i.id)}" aria-label="Ajouter un">+</button>
            </div>
          </div>
          <div class="cart-price">${fmt(i.price * i.qty)}</div>
        </li>`).join('')
      : '<li class="cart-empty">Ton panier est vide.</li>';
  };

  const openCart = () => {
    lastFocus = document.activeElement;
    drawer.classList.add('open'); overlay.classList.add('open');
    body.classList.add('no-scroll');
    $('.cart-close', drawer).focus();
  };
  const closeCart = () => {
    drawer.classList.remove('open'); overlay.classList.remove('open');
    body.classList.remove('no-scroll');
    if (lastFocus) lastFocus.focus();
  };

  $$('[data-cart-open]').forEach(b => b.addEventListener('click', openCart));
  $$('[data-cart-close]').forEach(b => b.addEventListener('click', closeCart));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (drawer.classList.contains('open')) closeCart();
    if (menu.classList.contains('open')) setMenu(false);
  });

  $$('[data-add]').forEach(btn => btn.addEventListener('click', () => {
    const d = btn.closest('.shop-card').dataset;
    const found = cart.find(i => i.id === d.id);
    if (found) found.qty++;
    else cart.push({ id: d.id, name: d.name, type: d.type, price: parseFloat(d.price), icon: d.icon || '📄', qty: 1 });
    save(); render(); openCart();
  }));

  itemsEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.dataset.inc || b.dataset.dec;
    const item = cart.find(i => i.id === id); if (!item) return;
    item.qty += b.dataset.inc ? 1 : -1;
    if (item.qty <= 0) cart = cart.filter(i => i !== item);
    save(); render();
  });

  checkout.addEventListener('click', () => {
    /* TODO : rediriger vers Stripe Checkout / ton processeur de paiement avec `cart` */
  });

  render();

  /* ── Formulaire (envoi vers le CRM via l'attribut action) ── */
  $$('[data-lead-form]').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('[data-lead-msg]', f);
    const btn = $('button[type="submit"]', f);
    f.classList.add('submitted');
    if (!f.checkValidity()) {
      msg.textContent = 'Remplis tous les champs pour continuer.';
      $(':invalid', f).focus();
      return;
    }
    const action = f.getAttribute('action');
    btn.disabled = true;
    msg.textContent = 'Envoi en cours…';
    try {
      if (action) {
        const res = await fetch(action, { method: 'POST', body: new FormData(f), headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(res.status);
      }
      f.reset();
      f.classList.remove('submitted');
      msg.textContent = 'Merci ! Je te reviens très bientôt.';
    } catch (_) {
      msg.textContent = 'Oups, l\u2019envoi n\u2019a pas fonctionné. Réessaie dans un instant.';
    } finally {
      btn.disabled = false;
    }
  }));

  /* ── Newsletter (fallback si aucun action n'est défini) ── */
  const form = $('[data-newsletter]');
  if (form) form.addEventListener('submit', e => {
    if (form.getAttribute('action')) return;
    e.preventDefault();
    $('[data-newsletter-msg]').textContent = 'Merci ! Surveille ta boîte courriel.';
    form.reset();
  });
})();
