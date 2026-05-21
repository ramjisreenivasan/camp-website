/**
 * Auth UI Module - Authentication UI Controller
 * Manages modal lifecycle, form rendering, and header auth state.
 * Loaded via script tag; exposes global `AuthUI` object.
 */
var AuthUI = (function () {
  'use strict';

  /**
   * Private helper: open a modal dialog with the given title and content.
   * Creates the overlay, sets ARIA attributes, adds close button,
   * sets up Escape key listener, and implements focus trapping.
   *
   * @param {string} title - The modal title (used in h2 and aria-labelledby)
   * @param {string} content - HTML string for the modal body (form fields, etc.)
   */
  function _openModal(title, content) {
    // Close any existing modal first
    closeModal();

    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'auth-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'modal-title');

    // Create modal container
    var modal = document.createElement('div');
    modal.className = 'auth-modal';

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.className = 'auth-modal-close';
    closeBtn.setAttribute('aria-label', 'Close dialog');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function () {
      closeModal();
    });

    // Title
    var heading = document.createElement('h2');
    heading.id = 'modal-title';
    heading.textContent = title;

    // Assemble modal
    modal.appendChild(closeBtn);
    modal.appendChild(heading);

    // Insert content
    var contentContainer = document.createElement('div');
    contentContainer.innerHTML = content;
    modal.appendChild(contentContainer);

    overlay.appendChild(modal);

    // Close on overlay click (outside modal)
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        closeModal();
      }
    });

    // Append to body
    document.body.appendChild(overlay);

    // Store reference to previous active element for focus restoration
    overlay._previousFocus = document.activeElement;

    // Set up keyboard handling (Escape to close, focus trapping)
    overlay._keyHandler = function (e) {
      if (e.key === 'Escape') {
        closeModal();
        return;
      }

      if (e.key === 'Tab') {
        _trapFocus(e, modal);
      }
    };
    document.addEventListener('keydown', overlay._keyHandler);

    // Move focus into the modal
    var firstFocusable = _getFocusableElements(modal)[0];
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      modal.setAttribute('tabindex', '-1');
      modal.focus();
    }
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
  function _trapFocus(e, modal) {
    var focusable = _getFocusableElements(modal);
    if (focusable.length === 0) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: if on first element, wrap to last
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if on last element, wrap to first
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /**
   * Close any open modal and clean up event listeners.
   */
  function closeModal() {
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
   * Display the sign-in form modal.
   * Renders a form with email and password fields, a "Forgot password?" link,
   * and wires submission to Auth.signIn() with client-side validation.
   */
  function showLoginModal() {
    var formHTML = '' +
      '<form class="auth-form" id="login-form" novalidate>' +
        '<div class="auth-error" role="alert" aria-live="polite"></div>' +
        '<div class="form-group">' +
          '<label for="login-email">Email</label>' +
          '<input type="email" id="login-email" name="email" autocomplete="email" required />' +
          '<span class="field-error" id="login-email-error" aria-live="polite"></span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="login-password">Password</label>' +
          '<input type="password" id="login-password" name="password" autocomplete="current-password" required />' +
          '<span class="field-error" id="login-password-error" aria-live="polite"></span>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary">Sign In</button>' +
        '<button type="button" class="btn btn-link auth-forgot-btn" id="forgot-password-btn">Forgot password?</button>' +
      '</form>';

    _openModal('Sign In', formHTML);

    // Attach event listeners after modal is rendered
    var form = document.querySelector('#login-form');
    var emailInput = document.querySelector('#login-email');
    var passwordInput = document.querySelector('#login-password');
    var errorDiv = form.querySelector('.auth-error');
    var forgotBtn = document.querySelector('#forgot-password-btn');

    // Clear field errors on input
    function clearFieldError(input, errorSpanId) {
      input.addEventListener('input', function () {
        var errorSpan = document.querySelector('#' + errorSpanId);
        if (errorSpan) errorSpan.textContent = '';
        errorDiv.textContent = '';
      });
    }

    clearFieldError(emailInput, 'login-email-error');
    clearFieldError(passwordInput, 'login-password-error');

    // Forgot password link handler
    forgotBtn.addEventListener('click', function () {
      AuthUI.showForgotPasswordModal();
    });

    // Form submission handler
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Clear previous errors
      errorDiv.textContent = '';
      var emailError = document.querySelector('#login-email-error');
      var passwordError = document.querySelector('#login-password-error');
      if (emailError) emailError.textContent = '';
      if (passwordError) passwordError.textContent = '';

      var emailVal = emailInput.value;
      var passwordVal = passwordInput.value;

      // Validate all fields
      var hasErrors = false;

      var emailRequiredValidation = Validators.validateRequired(emailVal, 'Email');
      if (!emailRequiredValidation.valid) {
        if (emailError) emailError.textContent = emailRequiredValidation.error;
        hasErrors = true;
      } else {
        var emailFormatValidation = Validators.validateEmail(emailVal);
        if (!emailFormatValidation.valid) {
          if (emailError) emailError.textContent = emailFormatValidation.error;
          hasErrors = true;
        }
      }

      var passwordRequiredValidation = Validators.validateRequired(passwordVal, 'Password');
      if (!passwordRequiredValidation.valid) {
        if (passwordError) passwordError.textContent = passwordRequiredValidation.error;
        hasErrors = true;
      }

      if (hasErrors) return;

      // Disable submit button during request
      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      Auth.signIn(emailVal, passwordVal)
        .then(function () {
          closeModal();
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';

          // If account is not verified, show verify modal
          if (err.code === 'UserNotConfirmedException') {
            AuthUI.showVerifyModal(emailVal);
            return;
          }

          errorDiv.textContent = err.message || 'Sign in failed. Please try again.';
        });
    });
  }

  /**
   * Display the registration form modal.
   * Renders a form with full name, email, and password fields.
   * Validates inputs client-side before calling Auth.register().
   * Shows inline errors for validation failures and Cognito errors.
   */
  function showRegisterModal() {
    var formHTML = '' +
      '<form class="auth-form" id="register-form" novalidate>' +
        '<div class="auth-error" role="alert" aria-live="polite"></div>' +
        '<div class="form-group">' +
          '<label for="register-name">Full Name</label>' +
          '<input type="text" id="register-name" name="name" autocomplete="name" required />' +
          '<span class="field-error" id="register-name-error" aria-live="polite"></span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="register-email">Email</label>' +
          '<input type="email" id="register-email" name="email" autocomplete="email" required />' +
          '<span class="field-error" id="register-email-error" aria-live="polite"></span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="register-password">Password</label>' +
          '<input type="password" id="register-password" name="password" autocomplete="new-password" required />' +
          '<span class="field-error" id="register-password-error" aria-live="polite"></span>' +
          '<p class="password-policy">Password must be at least 8 characters and include uppercase, lowercase, number, and special character.</p>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary">Register</button>' +
      '</form>';

    _openModal('Create Account', formHTML);

    // Attach event listeners after modal is rendered
    var form = document.querySelector('#register-form');
    var nameInput = document.querySelector('#register-name');
    var emailInput = document.querySelector('#register-email');
    var passwordInput = document.querySelector('#register-password');
    var errorDiv = form.querySelector('.auth-error');

    // Clear field errors on input
    function clearFieldError(input, errorSpanId) {
      input.addEventListener('input', function () {
        var errorSpan = document.querySelector('#' + errorSpanId);
        if (errorSpan) errorSpan.textContent = '';
        errorDiv.textContent = '';
      });
    }

    clearFieldError(nameInput, 'register-name-error');
    clearFieldError(emailInput, 'register-email-error');
    clearFieldError(passwordInput, 'register-password-error');

    // Form submission handler
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Clear previous errors
      errorDiv.textContent = '';
      var nameError = document.querySelector('#register-name-error');
      var emailError = document.querySelector('#register-email-error');
      var passwordError = document.querySelector('#register-password-error');
      if (nameError) nameError.textContent = '';
      if (emailError) emailError.textContent = '';
      if (passwordError) passwordError.textContent = '';

      var nameVal = nameInput.value;
      var emailVal = emailInput.value;
      var passwordVal = passwordInput.value;

      // Validate all fields
      var hasErrors = false;

      var nameValidation = Validators.validateRequired(nameVal, 'Full Name');
      if (!nameValidation.valid) {
        if (nameError) nameError.textContent = nameValidation.error;
        hasErrors = true;
      }

      var emailRequiredValidation = Validators.validateRequired(emailVal, 'Email');
      if (!emailRequiredValidation.valid) {
        if (emailError) emailError.textContent = emailRequiredValidation.error;
        hasErrors = true;
      } else {
        var emailFormatValidation = Validators.validateEmail(emailVal);
        if (!emailFormatValidation.valid) {
          if (emailError) emailError.textContent = emailFormatValidation.error;
          hasErrors = true;
        }
      }

      var passwordRequiredValidation = Validators.validateRequired(passwordVal, 'Password');
      if (!passwordRequiredValidation.valid) {
        if (passwordError) passwordError.textContent = passwordRequiredValidation.error;
        hasErrors = true;
      } else {
        var passwordPolicyValidation = Validators.validatePassword(passwordVal);
        if (!passwordPolicyValidation.valid) {
          if (passwordError) passwordError.textContent = passwordPolicyValidation.errors.join('. ');
          hasErrors = true;
        }
      }

      if (hasErrors) return;

      // Disable submit button during request
      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registering...';

      Auth.register(emailVal, passwordVal, nameVal)
        .then(function () {
          // Show success message
          errorDiv.textContent = '';
          form.innerHTML = '<div class="auth-success" role="status">' +
            '<p>Registration successful! A verification email has been sent to <strong>' + emailVal + '</strong>.</p>' +
            '<p>Please check your inbox and enter the verification code.</p>' +
          '</div>';

          // Open verify modal after a short delay
          setTimeout(function () {
            AuthUI.showVerifyModal(emailVal);
          }, 2000);
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Register';
          errorDiv.textContent = err.message || 'Registration failed. Please try again.';
        });
    });
  }

  /**
   * Display the verification code form modal.
   * Shows a form with a verification code input, submit button, and resend link.
   * Wires submission to Auth.confirmRegistration() and resend to Auth.resendConfirmationCode().
   * @param {string} email - The email address to verify
   */
  function showVerifyModal(email) {
    var formHTML = '' +
      '<form class="auth-form" id="verify-form" novalidate>' +
        '<div class="auth-error" role="alert" aria-live="polite"></div>' +
        '<p class="auth-info">A verification code has been sent to <strong>' + email + '</strong>. Please enter it below.</p>' +
        '<div class="form-group">' +
          '<label for="verify-code">Verification Code</label>' +
          '<input type="text" id="verify-code" name="code" autocomplete="one-time-code" required />' +
          '<span class="field-error" id="verify-code-error" aria-live="polite"></span>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary">Verify Email</button>' +
        '<button type="button" class="btn btn-link auth-resend-btn" id="resend-code-btn">Resend code</button>' +
      '</form>';

    _openModal('Verify Your Email', formHTML);

    // Attach event listeners after modal is rendered
    var form = document.querySelector('#verify-form');
    var codeInput = document.querySelector('#verify-code');
    var errorDiv = form.querySelector('.auth-error');
    var resendBtn = document.querySelector('#resend-code-btn');

    // Clear field errors on input
    codeInput.addEventListener('input', function () {
      var errorSpan = document.querySelector('#verify-code-error');
      if (errorSpan) errorSpan.textContent = '';
      errorDiv.textContent = '';
    });

    // Form submission handler
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Clear previous errors
      errorDiv.textContent = '';
      var codeError = document.querySelector('#verify-code-error');
      if (codeError) codeError.textContent = '';

      var codeVal = codeInput.value;

      // Validate code is not empty
      var codeValidation = Validators.validateRequired(codeVal, 'Verification Code');
      if (!codeValidation.valid) {
        if (codeError) codeError.textContent = codeValidation.error;
        return;
      }

      // Disable submit button during request
      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';

      Auth.confirmRegistration(email, codeVal)
        .then(function () {
          // Show success message
          errorDiv.textContent = '';
          form.innerHTML = '<div class="auth-success" role="status">' +
            '<p>Email verified successfully!</p>' +
            '<p>You can now sign in with your credentials.</p>' +
          '</div>';

          // Open login modal after a short delay
          setTimeout(function () {
            AuthUI.showLoginModal();
          }, 2000);
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Verify Email';
          errorDiv.textContent = err.message || 'Verification failed. Please try again.';
        });
    });

    // Resend code handler
    resendBtn.addEventListener('click', function () {
      errorDiv.textContent = '';
      resendBtn.disabled = true;

      Auth.resendConfirmationCode(email)
        .then(function () {
          errorDiv.textContent = '';
          // Show brief success message
          var successMsg = document.createElement('div');
          successMsg.className = 'auth-success-inline';
          successMsg.setAttribute('role', 'status');
          successMsg.textContent = 'Code resent!';
          form.insertBefore(successMsg, form.firstChild);
          resendBtn.disabled = false;

          // Remove success message after a few seconds
          setTimeout(function () {
            if (successMsg.parentNode) {
              successMsg.parentNode.removeChild(successMsg);
            }
          }, 3000);
        })
        .catch(function (err) {
          resendBtn.disabled = false;
          errorDiv.textContent = err.message || 'Failed to resend code. Please try again.';
        });
    });
  }

  /**
   * Display the password reset flow modal (Step 1: request code).
   * Renders a form with email input. On success, opens the confirm reset modal.
   */
  function showForgotPasswordModal() {
    var formHTML = '' +
      '<form class="auth-form" id="forgot-form" novalidate>' +
        '<div class="auth-error" role="alert" aria-live="polite"></div>' +
        '<p class="auth-info">Enter your email address and we\'ll send you a code to reset your password.</p>' +
        '<div class="form-group">' +
          '<label for="forgot-email">Email</label>' +
          '<input type="email" id="forgot-email" name="email" autocomplete="email" required />' +
          '<span class="field-error" id="forgot-email-error" aria-live="polite"></span>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary">Send Reset Code</button>' +
      '</form>';

    _openModal('Reset Password', formHTML);

    // Attach event listeners after modal is rendered
    var form = document.querySelector('#forgot-form');
    var emailInput = document.querySelector('#forgot-email');
    var errorDiv = form.querySelector('.auth-error');

    // Clear field errors on input
    emailInput.addEventListener('input', function () {
      var errorSpan = document.querySelector('#forgot-email-error');
      if (errorSpan) errorSpan.textContent = '';
      errorDiv.textContent = '';
    });

    // Form submission handler
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Clear previous errors
      errorDiv.textContent = '';
      var emailError = document.querySelector('#forgot-email-error');
      if (emailError) emailError.textContent = '';

      var emailVal = emailInput.value;

      // Validate email
      var hasErrors = false;

      var emailRequiredValidation = Validators.validateRequired(emailVal, 'Email');
      if (!emailRequiredValidation.valid) {
        if (emailError) emailError.textContent = emailRequiredValidation.error;
        hasErrors = true;
      } else {
        var emailFormatValidation = Validators.validateEmail(emailVal);
        if (!emailFormatValidation.valid) {
          if (emailError) emailError.textContent = emailFormatValidation.error;
          hasErrors = true;
        }
      }

      if (hasErrors) return;

      // Disable submit button during request
      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      Auth.forgotPassword(emailVal)
        .then(function () {
          // Show step 2: confirm reset modal
          _showResetConfirmModal(emailVal);
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Reset Code';
          errorDiv.textContent = err.message || 'Failed to send reset code. Please try again.';
        });
    });
  }

  /**
   * Display the password reset confirm modal (Step 2: enter code + new password).
   * @param {string} email - The email address the reset code was sent to
   */
  function _showResetConfirmModal(email) {
    var formHTML = '' +
      '<form class="auth-form" id="reset-form" novalidate>' +
        '<div class="auth-error" role="alert" aria-live="polite"></div>' +
        '<p class="auth-info">A reset code has been sent to <strong>' + email + '</strong>. Enter it below with your new password.</p>' +
        '<div class="form-group">' +
          '<label for="reset-code">Reset Code</label>' +
          '<input type="text" id="reset-code" name="code" autocomplete="one-time-code" required />' +
          '<span class="field-error" id="reset-code-error" aria-live="polite"></span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="reset-password">New Password</label>' +
          '<input type="password" id="reset-password" name="password" autocomplete="new-password" required />' +
          '<span class="field-error" id="reset-password-error" aria-live="polite"></span>' +
          '<p class="password-policy">Password must be at least 8 characters and include uppercase, lowercase, number, and special character.</p>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary">Reset Password</button>' +
      '</form>';

    _openModal('Reset Password', formHTML);

    // Attach event listeners after modal is rendered
    var form = document.querySelector('#reset-form');
    var codeInput = document.querySelector('#reset-code');
    var passwordInput = document.querySelector('#reset-password');
    var errorDiv = form.querySelector('.auth-error');

    // Clear field errors on input
    codeInput.addEventListener('input', function () {
      var errorSpan = document.querySelector('#reset-code-error');
      if (errorSpan) errorSpan.textContent = '';
      errorDiv.textContent = '';
    });

    passwordInput.addEventListener('input', function () {
      var errorSpan = document.querySelector('#reset-password-error');
      if (errorSpan) errorSpan.textContent = '';
      errorDiv.textContent = '';
    });

    // Form submission handler
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Clear previous errors
      errorDiv.textContent = '';
      var codeError = document.querySelector('#reset-code-error');
      var passwordError = document.querySelector('#reset-password-error');
      if (codeError) codeError.textContent = '';
      if (passwordError) passwordError.textContent = '';

      var codeVal = codeInput.value;
      var passwordVal = passwordInput.value;

      // Validate fields
      var hasErrors = false;

      var codeValidation = Validators.validateRequired(codeVal, 'Reset Code');
      if (!codeValidation.valid) {
        if (codeError) codeError.textContent = codeValidation.error;
        hasErrors = true;
      }

      var passwordRequiredValidation = Validators.validateRequired(passwordVal, 'Password');
      if (!passwordRequiredValidation.valid) {
        if (passwordError) passwordError.textContent = passwordRequiredValidation.error;
        hasErrors = true;
      } else {
        var passwordPolicyValidation = Validators.validatePassword(passwordVal);
        if (!passwordPolicyValidation.valid) {
          if (passwordError) passwordError.textContent = passwordPolicyValidation.errors.join('. ');
          hasErrors = true;
        }
      }

      if (hasErrors) return;

      // Disable submit button during request
      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Resetting...';

      Auth.confirmPassword(email, codeVal, passwordVal)
        .then(function () {
          // Show success message
          errorDiv.textContent = '';
          form.innerHTML = '<div class="auth-success" role="status">' +
            '<p>Password reset successful!</p>' +
            '<p>You can now sign in with your new password.</p>' +
          '</div>';

          // Open login modal after a short delay
          setTimeout(function () {
            AuthUI.showLoginModal();
          }, 2000);
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reset Password';
          errorDiv.textContent = err.message || 'Password reset failed. Please try again.';
        });
    });
  }

  /**
   * Toggle header between authenticated/unauthenticated states.
   * When user is authenticated: show user's name and "Sign Out" button.
   * When unauthenticated: show "Sign In" and "Register" buttons.
   * @param {object|null} user - The current user object or null
   */
  function updateHeaderState(user) {
    var container = document.getElementById('auth-controls');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    if (user && user.name) {
      // Authenticated state: show My Dashboard link + user name + Sign Out button
      var dashboardLink = document.createElement('a');
      dashboardLink.href = 'dashboard.html';
      dashboardLink.className = 'nav-link dashboard-link';
      dashboardLink.id = 'header-dashboard-link';
      dashboardLink.textContent = 'My Dashboard';

      var nameSpan = document.createElement('span');
      nameSpan.className = 'auth-user-name';
      nameSpan.textContent = user.name;

      var signOutBtn = document.createElement('button');
      signOutBtn.className = 'btn btn-secondary auth-signout-btn';
      signOutBtn.id = 'header-signout-btn';
      signOutBtn.textContent = 'Sign Out';
      signOutBtn.addEventListener('click', function () {
        if (typeof Auth !== 'undefined' && Auth.signOut) {
          Auth.signOut();
        }
      });

      container.appendChild(dashboardLink);

      // Show Admin Dashboard link for admin users
      if (typeof RoleManager !== 'undefined' && RoleManager.isAdmin && RoleManager.isAdmin()) {
        var adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.className = 'nav-link admin-link';
        adminLink.id = 'header-admin-link';
        adminLink.textContent = 'Admin Dashboard';
        container.appendChild(adminLink);
      }

      container.appendChild(nameSpan);
      container.appendChild(signOutBtn);
    } else {
      // Unauthenticated state: show Sign In + Register buttons
      var signInBtn = document.createElement('button');
      signInBtn.className = 'btn btn-secondary auth-signin-btn';
      signInBtn.id = 'header-signin-btn';
      signInBtn.textContent = 'Sign In';
      signInBtn.addEventListener('click', function () {
        AuthUI.showLoginModal();
      });

      var registerBtn = document.createElement('button');
      registerBtn.className = 'btn btn-primary auth-register-btn';
      registerBtn.id = 'header-register-btn';
      registerBtn.textContent = 'Register';
      registerBtn.addEventListener('click', function () {
        AuthUI.showRegisterModal();
      });

      container.appendChild(signInBtn);
      container.appendChild(registerBtn);
    }
  }

  /**
   * Initialize the Auth UI: inject header controls, attach event listeners,
   * bind to auth events.
   */
  function init() {
    // Render initial header state based on current auth status
    if (typeof Auth !== 'undefined' && Auth.isAuthenticated && Auth.isAuthenticated()) {
      var session = Auth.getSession();
      if (session) {
        try {
          var idToken = session.getIdToken();
          var payload = idToken.decodePayload();
          updateHeaderState({
            name: payload.name || payload.email || '',
            email: payload.email || '',
            emailVerified: payload.email_verified || false
          });
        } catch (e) {
          updateHeaderState({ name: '', email: '', emailVerified: false });
        }
      } else {
        updateHeaderState(null);
      }
    } else {
      updateHeaderState(null);
    }

    // Listen for auth:stateChanged events and update the header UI
    document.addEventListener('auth:stateChanged', function (e) {
      var detail = e.detail || {};
      if (detail.state === 'authenticated') {
        updateHeaderState(detail.user);
      } else {
        updateHeaderState(null);
      }
    });

    // Listen for auth:error events and display errors in the active modal
    document.addEventListener('auth:error', function (e) {
      var detail = e.detail || {};
      var errorMessage = '';
      if (detail.error && detail.error.message) {
        errorMessage = detail.error.message;
      } else if (detail.message) {
        errorMessage = detail.message;
      }

      if (errorMessage) {
        var errorDiv = document.querySelector('.auth-modal-overlay .auth-error');
        if (errorDiv) {
          errorDiv.textContent = errorMessage;
        }
      }
    });

    // Clear errors when user modifies form fields within the active modal
    document.addEventListener('input', function (e) {
      // Only handle inputs inside an auth modal
      var modal = document.querySelector('.auth-modal-overlay');
      if (!modal) return;
      if (!modal.contains(e.target)) return;

      // Clear the general error div
      var errorDiv = modal.querySelector('.auth-error');
      if (errorDiv) {
        errorDiv.textContent = '';
      }
    });
  }

  // Public API
  return {
    init: init,
    showLoginModal: showLoginModal,
    showRegisterModal: showRegisterModal,
    showVerifyModal: showVerifyModal,
    showForgotPasswordModal: showForgotPasswordModal,
    closeModal: closeModal,
    updateHeaderState: updateHeaderState,
    // Exposed for testing
    _openModal: _openModal
  };
})();
