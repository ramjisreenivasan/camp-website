// AI Tech Product Camp - Main JavaScript
// FAQ accordion with progressive enhancement

// Mark JS as available for progressive enhancement
// CSS uses .js-enabled to hide FAQ answers (they remain visible without JS)
document.body.classList.add('js-enabled');

// Theme Toggle Logic
(function () {
  const toggle = document.getElementById('theme-toggle');
  const STORAGE_KEY = 'theme-preference';

  function getPreference() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }

  // Apply saved preference on load
  var currentTheme = getPreference();
  applyTheme(currentTheme);

  if (toggle) {
    toggle.addEventListener('click', function () {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(currentTheme);
      localStorage.setItem(STORAGE_KEY, currentTheme);
    });
  }
})();

// FAQ Accordion Logic
(function () {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(function (item) {
    const button = item.querySelector('.faq-question');
    if (!button) return;

    button.addEventListener('click', function () {
      const isExpanded = button.getAttribute('aria-expanded') === 'true';

      // Close all other open items (single-open accordion behavior)
      faqItems.forEach(function (otherItem) {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          const otherButton = otherItem.querySelector('.faq-question');
          if (otherButton) {
            otherButton.setAttribute('aria-expanded', 'false');
          }
        }
      });

      // Toggle the clicked item
      if (isExpanded) {
        item.classList.remove('active');
        button.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('active');
        button.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

// Auth System Initialization
document.addEventListener('DOMContentLoaded', function () {
  // Initialize Auth module first (loads config, checks session),
  // then initialize AuthUI (sets up header controls and event listeners)
  Auth.init().then(function () {
    AuthUI.init();
    AdminUI.init();

    // Wire existing "Register Now" buttons to open the registration modal
    var registerButtons = document.querySelectorAll('a[href="#register"]');
    registerButtons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        AuthUI.showRegisterModal();
      });
    });
  });
});
