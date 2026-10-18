(function () {
  var themeButtons = document.querySelectorAll('.theme button');
  var systemPreference = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');

    themeButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.value === theme));
    });
  }

  themeButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var theme = button.value;
      applyTheme(theme);
      try {
        if (theme === 'light' || theme === 'dark') localStorage.setItem('theme', theme);
        else localStorage.removeItem('theme');
      } catch (error) {
        console.warn('Die Farbschema-Einstellung konnte nicht gespeichert werden.', error);
      }
    });
  });

  systemPreference.addEventListener('change', function () {
    if (!document.documentElement.hasAttribute('data-theme')) applyTheme('system');
  });
  applyTheme(document.documentElement.getAttribute('data-theme') || 'system');

  var triggers = Array.from(document.querySelectorAll('.gallery-trigger[data-full]'));

  var uniqueImages = Array.from(new Map(triggers.map(function (trigger) {
    return [trigger.dataset.full, trigger];
  })).values());
  if (!uniqueImages.length) return;

  function viewerIcon(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  var dialog = document.createElement('dialog');
  dialog.className = 'photo-viewer';
  dialog.setAttribute('aria-label', 'Fotogalerie');
  dialog.innerHTML = '<div class="viewer-topbar"><span class="viewer-counter" aria-live="polite"></span><button class="viewer-close" type="button" aria-label="Galerie schließen">' + viewerIcon('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>') + '</button></div>'
    + '<div class="viewer-stage"><img class="viewer-image" alt=""></div>'
    + '<div class="viewer-footer"><p class="viewer-caption" aria-live="polite"></p><div class="viewer-navigation">'
    + '<button class="viewer-arrow viewer-previous" type="button" aria-label="Vorheriges Bild">' + viewerIcon('<path d="M14.5 5.5 8 12l6.5 6.5"/>') + '</button>'
    + '<button class="viewer-arrow viewer-next" type="button" aria-label="Nächstes Bild">' + viewerIcon('<path d="M9.5 5.5 16 12l-6.5 6.5"/>') + '</button>'
    + '</div></div>';
  document.body.append(dialog);

  var image = dialog.querySelector('.viewer-image');
  var caption = dialog.querySelector('.viewer-caption');
  var counter = dialog.querySelector('.viewer-counter');
  var previous = dialog.querySelector('.viewer-previous');
  var next = dialog.querySelector('.viewer-next');
  var currentIndex = 0;

  function showImage(index) {
    currentIndex = (index + uniqueImages.length) % uniqueImages.length;
    var trigger = uniqueImages[currentIndex];
    var thumbnail = trigger.querySelector('img');
    image.src = trigger.dataset.full;
    image.alt = thumbnail ? thumbnail.alt : trigger.getAttribute('aria-label') || '';
    caption.textContent = trigger.dataset.caption || image.alt;
    counter.textContent = (currentIndex + 1) + ' / ' + uniqueImages.length;
    var hasMultipleImages = uniqueImages.length > 1;
    previous.hidden = !hasMultipleImages;
    next.hidden = !hasMultipleImages;
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var index = uniqueImages.findIndex(function (item) {
        return item.dataset.full === trigger.dataset.full;
      });
      showImage(index);
      dialog.showModal();
    });
  });

  previous.addEventListener('click', function () { showImage(currentIndex - 1); });
  next.addEventListener('click', function () { showImage(currentIndex + 1); });
  dialog.querySelector('.viewer-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showImage(currentIndex - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showImage(currentIndex + 1);
    }
  });
})();

// Vorher/Nachher-Regler auf den Detailseiten: sanftes Wippen, Maus und Tastatur.
(function () {
  var sliders = document.querySelectorAll('.compare');
  if (!sliders.length) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  sliders.forEach(function (box, index) {
    var range = box.querySelector('.compare-range');
    if (!range) return;

    var position = 50, holdUntil = 0, blend = 1, visible = false, running = false;
    var offset = index * 1700, period = 1150 + index * 180;

    function set(value) {
      position = value;
      box.style.setProperty('--pos', value + '%');
      range.value = Math.round(value);
    }
    function pause() {
      holdUntil = performance.now() + 2500;
      blend = 0;
    }
    function tick(now) {
      if (now > holdUntil) {
        blend = Math.min(1, blend + 0.015);
        var sway = 50 + 17 * Math.sin((now + offset) / period) + 5 * Math.sin((now + offset) / (period * 0.37));
        set(position + (sway - position) * (0.03 + 0.2 * blend * blend));
      }
      if (visible) requestAnimationFrame(tick);
      else running = false;
    }

    range.addEventListener('input', function () { pause(); set(+range.value); });
    range.addEventListener('focus', pause);
    box.addEventListener('pointerdown', pause);
    box.addEventListener('pointermove', function (event) {
      if (event.pointerType !== 'mouse') return;
      var rect = box.getBoundingClientRect();
      pause();
      set(Math.min(100, Math.max(0, (event.clientX - rect.left) / rect.width * 100)));
    });

    set(50);
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !running) {
        running = true;
        requestAnimationFrame(tick);
      }
    }).observe(box);
  });
})();

// Lasche der Kontaktleiste: Klick hält sie offen, Escape schließt sie
(function () {
  var bar = document.querySelector('.callbar');
  if (!bar) return;
  var tab = bar.querySelector('.callbar-tab');
  function setOpen(open) { bar.classList.toggle('is-open', open); tab.setAttribute('aria-expanded', String(open)); }
  tab.addEventListener('click', function () { setOpen(!bar.classList.contains('is-open')); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
})();

// Auf Handys öffnet whatsapp:// direkt die App; wa.me bleibt für Desktop (Web/Desktop-App)
if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
  document.querySelectorAll('a[href^="https://wa.me/"]').forEach(function (a) {
    a.href = 'whatsapp://send?phone=' + a.getAttribute('href').replace('https://wa.me/', '');
  });
}
