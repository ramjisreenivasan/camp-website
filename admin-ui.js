/**
 * Admin UI Module - Admin-specific UI Extensions
 * Handles admin navigation link and user profile modal on the main page.
 * Loaded via script tag; exposes global `AdminUI` object.
 */
var AdminUI = (function () {
  'use strict';

  /**
   * Initialize admin UI features.
   * Listens for auth:stateChanged to show/hide admin link and
   * make user name clickable for profile modal.
   */
  function init() {
    document.addEventListener('auth:stateChanged', function (e) {
      var detail = e.detail || {};

      if (detail.state === 'authenticated' && detail.user) {
        // Determine if user is admin
        var isAdmin = (typeof RoleManager !== 'undefined' && RoleManager.isAdmin());
        updateAdminLink(isAdmin);
        _makeUserNameClickable(detail.user);
      } else {
        // Unauthenticated — remove admin link and clear cached role
        updateAdminLink(false);
        if (typeof RoleManager !== 'undefined' && RoleManager.clearRole) {
          RoleManager.clearRole();
        }
      }
    });
  }

  /**
   * Render or remove the admin navigation link in the header.
   * Only adds the link to the DOM when isAdmin is true.
   * @param {boolean} isAdmin
   */
  function updateAdminLink(isAdmin) {
    var container = document.getElementById('auth-controls');
    if (!container) return;

    // Remove existing admin link if present
    var existingLink = container.querySelector('.admin-nav-link');
    if (existingLink) {
      container.removeChild(existingLink);
    }

    if (!isAdmin) return;

    // Create admin link element
    var adminLink = document.createElement('a');
    adminLink.href = 'admin.html';
    adminLink.className = 'btn btn-secondary admin-nav-link';
    adminLink.textContent = 'Admin';
    adminLink.setAttribute('aria-label', 'Go to Admin Dashboard');

    // Insert between user name and sign-out button
    var signOutBtn = container.querySelector('.auth-signout-btn');
    if (signOutBtn) {
      container.insertBefore(adminLink, signOutBtn);
    } else {
      container.appendChild(adminLink);
    }
  }

  /**
   * Make the user name element in the header clickable to open the profile modal.
   * @param {object} user - { name, email, emailVerified }
   */
  function _makeUserNameClickable(user) {
    var container = document.getElementById('auth-controls');
    if (!container) return;

    var nameSpan = container.querySelector('.auth-user-name');
    if (!nameSpan) return;

    // Make it a clickable button-like element
    nameSpan.setAttribute('role', 'button');
    nameSpan.setAttribute('tabindex', '0');
    nameSpan.setAttribute('aria-label', 'View your profile');
    nameSpan.style.cursor = 'pointer';

    // Remove existing listeners by cloning
    var newNameSpan = nameSpan.cloneNode(true);
    nameSpan.parentNode.replaceChild(newNameSpan, nameSpan);

    // Attach click handler
    newNameSpan.addEventListener('click', function () {
      var role = (typeof RoleManager !== 'undefined') ? RoleManager.getUserRole() : 'user';
      showProfileModal(user, role);
    });

    // Attach keyboard handler (Enter and Space)
    newNameSpan.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var role = (typeof RoleManager !== 'undefined') ? RoleManager.getUserRole() : 'user';
        showProfileModal(user, role);
      }
    });
  }

  /**
   * Escape HTML special characters to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  function _escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /**
   * Get all focusable elements within a container.
   * @param {HTMLElement} container
   * @returns {HTMLElement[]}
   */
  function _getFocusableElements(container) {
    var selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(container.querySelectorAll(selector));
  }

  /**
   * Trap focus within the modal on Tab/Shift+Tab.
   * @param {KeyboardEvent} e
   * @param {HTMLElement} modal
   */
  function _trapFocusInModal(e, modal) {
    var focusable = _getFocusableElements(modal);
    if (focusable.length === 0) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /**
   * Close the profile modal and clean up event listeners.
   */
  function _closeProfileModal() {
    var overlay = document.querySelector('.auth-modal-overlay');
    if (!overlay) return;

    // Remove keyboard handler
    if (overlay._keyHandler) {
      document.removeEventListener('keydown', overlay._keyHandler);
    }

    // Restore focus to previously focused element
    if (overlay._previousFocus && overlay._previousFocus.focus) {
      overlay._previousFocus.focus();
    }

    // Remove from DOM
    overlay.parentNode.removeChild(overlay);
  }

  /**
   * Display the user profile modal with name, email, role, verification status.
   * Uses the same modal dialog pattern as _openModal in auth-ui.js.
   * @param {object} user - { name, email, emailVerified }
   * @param {string} role - "admin" or "user"
   */
  function showProfileModal(user, role) {
    // Close any existing modal first
    _closeProfileModal();

    var displayName = (user && user.name) ? user.name : 'N/A';
    var displayEmail = (user && user.email) ? user.email : 'N/A';
    var displayRole = role === 'admin' ? 'Admin' : 'User';
    var displayVerified = (user && typeof user.emailVerified !== 'undefined')
      ? (user.emailVerified ? 'Verified' : 'Not Verified')
      : 'N/A';

    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'auth-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'profile-modal-title');

    // Create modal container
    var modal = document.createElement('div');
    modal.className = 'auth-modal';

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.className = 'auth-modal-close';
    closeBtn.setAttribute('aria-label', 'Close dialog');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function () {
      _closeProfileModal();
    });

    // Title
    var heading = document.createElement('h2');
    heading.id = 'profile-modal-title';
    heading.textContent = 'User Profile';

    // Profile content
    var content = document.createElement('div');
    content.className = 'profile-modal-content';
    content.innerHTML =
      '<dl class="profile-details">' +
        '<div class="profile-field">' +
          '<dt>Full Name</dt>' +
          '<dd>' + _escapeHtml(displayName) + '</dd>' +
        '</div>' +
        '<div class="profile-field">' +
          '<dt>Email</dt>' +
          '<dd>' + _escapeHtml(displayEmail) + '</dd>' +
        '</div>' +
        '<div class="profile-field">' +
          '<dt>Role</dt>' +
          '<dd>' + _escapeHtml(displayRole) + '</dd>' +
        '</div>' +
        '<div class="profile-field">' +
          '<dt>Email Verification</dt>' +
          '<dd>' + _escapeHtml(displayVerified) + '</dd>' +
        '</div>' +
      '</dl>';

    // Assemble modal
    modal.appendChild(closeBtn);
    modal.appendChild(heading);
    modal.appendChild(content);
    overlay.appendChild(modal);

    // Close on overlay click (outside modal)
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        _closeProfileModal();
      }
    });

    // Append to body
    document.body.appendChild(overlay);

    // Store reference to previous active element for focus restoration
    overlay._previousFocus = document.activeElement;

    // Set up keyboard handling (Escape to close, focus trapping)
    overlay._keyHandler = function (e) {
      if (e.key === 'Escape') {
        _closeProfileModal();
        return;
      }

      if (e.key === 'Tab') {
        _trapFocusInModal(e, modal);
      }
    };
    document.addEventListener('keydown', overlay._keyHandler);

    // Move focus into the modal (close button is first focusable)
    closeBtn.focus();
  }

  // Public API
  return {
    init: init,
    updateAdminLink: updateAdminLink,
    showProfileModal: showProfileModal
  };
})();
