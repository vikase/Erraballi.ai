/* erraballi.ai: analytics and lead form. Loaded on every page.
   GA_ID is the Google tag ID from Google Analytics (Admin > Data streams > erraballi.ai > tag instructions).
   If it is empty, no analytics code loads.
   Leads go to the Google Form "erraballi.ai leads" (answers land in its linked Sheet). */
(function () {
  var GA_ID = 'GTM-NK8K8MNN';
  var FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdF8gAKYqrYJK-nPKCZrgfWlAZCuI3rR4rVVkcmNjEf7BO_eQ/formResponse';
  var ENTRY = { name: 'entry.1699689804', email: 'entry.738657282', company: 'entry.1459134194', message: 'entry.863628148', source: 'entry.1417167977' };

  /* ---------- analytics ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  if (GA_ID) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + GA_ID;
    document.head.appendChild(s);
    window.gtag('js', new Date());
    document.addEventListener('DOMContentLoaded', function () {
      var n = document.getElementById('ga-note');
      if (n) n.textContent = ' · This site counts visits with Google Analytics.';
    });
  }
  function track(name, params) { try { window.gtag('event', name, params || {}); } catch (e) {} }

  /* ---------- where the visitor came from (first touch in this browser tab) ---------- */
  function store(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function firstTouch() {
    var saved = load('ea_src');
    if (saved) return saved;
    var q = new URLSearchParams(location.search), parts = [];
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
      if (q.get(k)) parts.push(k.slice(4) + '=' + q.get(k).slice(0, 60));
    });
    var ref = '';
    try { if (document.referrer && new URL(document.referrer).host !== location.host) ref = new URL(document.referrer).host; } catch (e) {}
    if (ref) parts.push('ref=' + ref);
    var v = parts.join(' ') || 'direct';
    store('ea_src', v);
    return v;
  }
  var SOURCE = firstTouch();

  /* ---------- clicks ---------- */
  function section(el) {
    var s = el.closest('section[id], footer, nav, [id]');
    if (!s) return 'page';
    return s.id || s.tagName.toLowerCase();
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var label = (a.textContent || '').trim().slice(0, 60);
    if (a.hasAttribute('data-cta')) track('cta_click', { cta: a.getAttribute('data-cta'), link_text: label, location: section(a) });
    if (href.indexOf('mailto:') === 0) track('email_click', { link_text: label, location: section(a) });
    if (/linkedin\.com/.test(href)) track('linkedin_click', { location: section(a) });
    if (/marked-to-market/.test(href)) track('newsletter_click', { location: section(a) });
  });

  /* ---------- hero film: one event when a visitor watches most of it ---------- */
  var film = document.getElementById('film');
  if (film) {
    var sent = false;
    film.addEventListener('timeupdate', function () {
      if (!sent && film.currentTime >= 24) { sent = true; track('film_watched', { seconds: 24 }); }
    });
  }

  /* ---------- lead form ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('form.lead'), function (form) {
    var status = form.querySelector('.lead-status');
    var button = form.querySelector('button[type=submit]');
    var started = false;
    form.addEventListener('input', function () {
      if (!started) { started = true; track('form_start', { form_name: form.getAttribute('data-form') || 'contact' }); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.elements.website && form.elements.website.value) return; /* honeypot: bots fill this field */
      if (!form.reportValidity()) return;
      var data = new URLSearchParams();
      data.append(ENTRY.name, form.elements.name.value.trim());
      data.append(ENTRY.email, form.elements.email.value.trim());
      data.append(ENTRY.company, form.elements.company.value.trim());
      data.append(ENTRY.message, form.elements.message.value.trim());
      data.append(ENTRY.source, (form.getAttribute('data-form') || 'contact') + ' | ' + location.pathname + ' | ' + SOURCE);
      button.disabled = true;
      status.textContent = 'Sending…';
      fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body: data }).then(function () {
        track('generate_lead', { form_name: form.getAttribute('data-form') || 'contact', lead_source: SOURCE });
        form.classList.add('sent');
        status.textContent = 'Got it. Thank you. I will reply by email.';
      }).catch(function () {
        button.disabled = false;
        status.innerHTML = 'That did not send. Please email <a href="mailto:vikas@erraballi.org">vikas@erraballi.org</a>.';
      });
    });
  });
})();
