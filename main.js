// AI Tech Product Camp - Main JavaScript
// FAQ accordion with progressive enhancement

// Mark JS as available for progressive enhancement
// CSS uses .js-enabled to hide FAQ answers (they remain visible without JS)
document.body.classList.add('js-enabled');

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

// Terms & Conditions Modal
(function () {
  function showTermsModal() {
    var termsContent = document.getElementById('terms-conditions');
    if (!termsContent) return;

    // Clone the content for the modal
    var content = termsContent.innerHTML;

    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'terms-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'terms-modal-title');

    var modal = document.createElement('div');
    modal.className = 'terms-modal';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'terms-modal-close';
    closeBtn.setAttribute('aria-label', 'Close Terms & Conditions');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function () {
      closeTermsModal(overlay);
    });

    var contentDiv = document.createElement('div');
    contentDiv.className = 'terms-modal-content';
    contentDiv.innerHTML = content;

    modal.appendChild(closeBtn);
    modal.appendChild(contentDiv);
    overlay.appendChild(modal);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeTermsModal(overlay);
    });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        closeTermsModal(overlay);
        document.removeEventListener('keydown', handler);
      }
    });

    document.body.appendChild(overlay);
    closeBtn.focus();
  }

  function closeTermsModal(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  // Attach click handlers to terms links (footer and registration form)
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href="#terms-conditions"], .terms-modal-link');
    if (link) {
      e.preventDefault();
      showTermsModal();
    }
  });
})();
