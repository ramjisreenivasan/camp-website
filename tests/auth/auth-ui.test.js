import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Read the auth-ui.js and validators.js source
const authUiSource = fs.readFileSync(path.resolve(__dirname, '../../auth-ui.js'), 'utf-8');
const validatorsSource = fs.readFileSync(path.resolve(__dirname, '../../validators.js'), 'utf-8');

function createAuthUIEnvironment(options = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    runScripts: 'dangerously',
  });

  const { window } = dom;

  // Load validators first (dependency for registration modal)
  const validatorsScript = window.document.createElement('script');
  validatorsScript.textContent = validatorsSource;
  window.document.body.appendChild(validatorsScript);

  // Set up Auth mock if provided
  if (options.authMock) {
    window.Auth = options.authMock;
  }

  // Execute auth-ui.js in the JSDOM context
  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = authUiSource;
  window.document.body.appendChild(scriptEl);

  return {
    window,
    document: window.document,
    AuthUI: window.AuthUI,
  };
}

describe('AuthUI - modal infrastructure', () => {
  let env;

  beforeEach(() => {
    env = createAuthUIEnvironment();
  });

  describe('_openModal', () => {
    it('should create an overlay with role="dialog"', () => {
      env.AuthUI._openModal('Test Title', '<p>Content</p>');

      const overlay = env.document.querySelector('.auth-modal-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay.getAttribute('role')).toBe('dialog');
    });

    it('should set aria-modal="true" on the overlay', () => {
      env.AuthUI._openModal('Test Title', '<p>Content</p>');

      const overlay = env.document.querySelector('.auth-modal-overlay');
      expect(overlay.getAttribute('aria-modal')).toBe('true');
    });

    it('should set aria-labelledby="modal-title" on the overlay', () => {
      env.AuthUI._openModal('Test Title', '<p>Content</p>');

      const overlay = env.document.querySelector('.auth-modal-overlay');
      expect(overlay.getAttribute('aria-labelledby')).toBe('modal-title');
    });

    it('should create a heading with id="modal-title" and the given title text', () => {
      env.AuthUI._openModal('Sign In', '<p>Form here</p>');

      const heading = env.document.querySelector('#modal-title');
      expect(heading).not.toBeNull();
      expect(heading.tagName).toBe('H2');
      expect(heading.textContent).toBe('Sign In');
    });

    it('should create a close button with aria-label="Close dialog"', () => {
      env.AuthUI._openModal('Test', '<p>Content</p>');

      const closeBtn = env.document.querySelector('.auth-modal-close');
      expect(closeBtn).not.toBeNull();
      expect(closeBtn.getAttribute('aria-label')).toBe('Close dialog');
    });

    it('should render the provided HTML content inside the modal', () => {
      env.AuthUI._openModal('Test', '<input type="email" /><button type="submit">Submit</button>');

      const modal = env.document.querySelector('.auth-modal');
      const input = modal.querySelector('input[type="email"]');
      const button = modal.querySelector('button[type="submit"]');
      expect(input).not.toBeNull();
      expect(button).not.toBeNull();
    });

    it('should append the overlay to document.body', () => {
      env.AuthUI._openModal('Test', '<p>Content</p>');

      const overlay = env.document.querySelector('.auth-modal-overlay');
      expect(overlay.parentNode).toBe(env.document.body);
    });

    it('should close existing modal before opening a new one', () => {
      env.AuthUI._openModal('First', '<p>First</p>');
      env.AuthUI._openModal('Second', '<p>Second</p>');

      const overlays = env.document.querySelectorAll('.auth-modal-overlay');
      expect(overlays.length).toBe(1);

      const heading = env.document.querySelector('#modal-title');
      expect(heading.textContent).toBe('Second');
    });

    it('should move focus into the modal after opening', () => {
      env.AuthUI._openModal('Test', '<input type="text" /><button>OK</button>');

      // The first focusable element in the modal is the close button
      const closeBtn = env.document.querySelector('.auth-modal-close');
      expect(env.document.activeElement).toBe(closeBtn);
    });
  });

  describe('closeModal', () => {
    it('should remove the overlay from the DOM', () => {
      env.AuthUI._openModal('Test', '<p>Content</p>');
      expect(env.document.querySelector('.auth-modal-overlay')).not.toBeNull();

      env.AuthUI.closeModal();
      expect(env.document.querySelector('.auth-modal-overlay')).toBeNull();
    });

    it('should do nothing if no modal is open', () => {
      // Should not throw
      expect(() => env.AuthUI.closeModal()).not.toThrow();
    });

    it('should restore focus to the previously focused element', () => {
      // Create a button and focus it
      const btn = env.document.createElement('button');
      btn.textContent = 'Trigger';
      env.document.body.appendChild(btn);
      btn.focus();

      env.AuthUI._openModal('Test', '<input type="text" />');
      // Focus should be in the modal now
      expect(env.document.activeElement).not.toBe(btn);

      env.AuthUI.closeModal();
      expect(env.document.activeElement).toBe(btn);
    });
  });

  describe('Escape key closes modal', () => {
    it('should close the modal when Escape is pressed', () => {
      env.AuthUI._openModal('Test', '<input type="text" />');
      expect(env.document.querySelector('.auth-modal-overlay')).not.toBeNull();

      // Simulate Escape key
      const event = new env.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      env.document.dispatchEvent(event);

      expect(env.document.querySelector('.auth-modal-overlay')).toBeNull();
    });
  });

  describe('Close button closes modal', () => {
    it('should close the modal when the close button is clicked', () => {
      env.AuthUI._openModal('Test', '<p>Content</p>');
      expect(env.document.querySelector('.auth-modal-overlay')).not.toBeNull();

      const closeBtn = env.document.querySelector('.auth-modal-close');
      closeBtn.click();

      expect(env.document.querySelector('.auth-modal-overlay')).toBeNull();
    });
  });

  describe('Overlay click closes modal', () => {
    it('should close the modal when clicking the overlay background', () => {
      env.AuthUI._openModal('Test', '<p>Content</p>');
      const overlay = env.document.querySelector('.auth-modal-overlay');
      expect(overlay).not.toBeNull();

      // Simulate click on the overlay itself (not the modal)
      const event = new env.window.MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: overlay });
      overlay.dispatchEvent(event);

      expect(env.document.querySelector('.auth-modal-overlay')).toBeNull();
    });

    it('should NOT close the modal when clicking inside the modal', () => {
      env.AuthUI._openModal('Test', '<p>Content</p>');
      const modal = env.document.querySelector('.auth-modal');

      // Simulate click on the modal content
      const event = new env.window.MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: modal });
      modal.dispatchEvent(event);

      expect(env.document.querySelector('.auth-modal-overlay')).not.toBeNull();
    });
  });

  describe('Focus trapping', () => {
    it('should wrap focus from last to first element on Tab', () => {
      env.AuthUI._openModal('Test', '<input id="first" type="text" /><input id="second" type="text" /><button id="last">OK</button>');

      const lastBtn = env.document.querySelector('#last');
      lastBtn.focus();

      // Simulate Tab key
      const event = new env.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      // We need to check that preventDefault is called
      let defaultPrevented = false;
      event.preventDefault = () => { defaultPrevented = true; };
      env.document.dispatchEvent(event);

      // Focus should wrap to the close button (first focusable in modal)
      const closeBtn = env.document.querySelector('.auth-modal-close');
      expect(env.document.activeElement).toBe(closeBtn);
      expect(defaultPrevented).toBe(true);
    });

    it('should wrap focus from first to last element on Shift+Tab', () => {
      env.AuthUI._openModal('Test', '<input id="first" type="text" /><input id="second" type="text" /><button id="last">OK</button>');

      // The close button is the first focusable element in the modal
      const closeBtn = env.document.querySelector('.auth-modal-close');
      closeBtn.focus();

      // Simulate Shift+Tab key
      const event = new env.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
      let defaultPrevented = false;
      event.preventDefault = () => { defaultPrevented = true; };
      env.document.dispatchEvent(event);

      // Focus should wrap to the last focusable element
      const lastBtn = env.document.querySelector('#last');
      expect(env.document.activeElement).toBe(lastBtn);
      expect(defaultPrevented).toBe(true);
    });
  });

  describe('Public API stubs', () => {
    it('should expose init as a function', () => {
      expect(typeof env.AuthUI.init).toBe('function');
    });

    it('should expose showLoginModal as a function', () => {
      expect(typeof env.AuthUI.showLoginModal).toBe('function');
    });

    it('should expose showRegisterModal as a function', () => {
      expect(typeof env.AuthUI.showRegisterModal).toBe('function');
    });

    it('should expose showVerifyModal as a function', () => {
      expect(typeof env.AuthUI.showVerifyModal).toBe('function');
    });

    it('should expose showForgotPasswordModal as a function', () => {
      expect(typeof env.AuthUI.showForgotPasswordModal).toBe('function');
    });

    it('should expose closeModal as a function', () => {
      expect(typeof env.AuthUI.closeModal).toBe('function');
    });

    it('should expose updateHeaderState as a function', () => {
      expect(typeof env.AuthUI.updateHeaderState).toBe('function');
    });
  });
});


describe('AuthUI - showRegisterModal', () => {
  let env;

  function createEnvWithAuth(authMock) {
    return createAuthUIEnvironment({ authMock });
  }

  describe('form rendering', () => {
    beforeEach(() => {
      env = createEnvWithAuth({ register: () => Promise.resolve() });
    });

    it('should open a modal with title "Create Account"', () => {
      env.AuthUI.showRegisterModal();
      const heading = env.document.querySelector('#modal-title');
      expect(heading.textContent).toBe('Create Account');
    });

    it('should render a form with class "auth-form"', () => {
      env.AuthUI.showRegisterModal();
      const form = env.document.querySelector('.auth-form');
      expect(form).not.toBeNull();
      expect(form.tagName).toBe('FORM');
    });

    it('should render a Full Name input with label', () => {
      env.AuthUI.showRegisterModal();
      const label = env.document.querySelector('label[for="register-name"]');
      const input = env.document.querySelector('#register-name');
      expect(label).not.toBeNull();
      expect(label.textContent).toBe('Full Name');
      expect(input).not.toBeNull();
      expect(input.type).toBe('text');
    });

    it('should render an Email input with label', () => {
      env.AuthUI.showRegisterModal();
      const label = env.document.querySelector('label[for="register-email"]');
      const input = env.document.querySelector('#register-email');
      expect(label).not.toBeNull();
      expect(label.textContent).toBe('Email');
      expect(input).not.toBeNull();
      expect(input.type).toBe('email');
    });

    it('should render a Password input with label', () => {
      env.AuthUI.showRegisterModal();
      const label = env.document.querySelector('label[for="register-password"]');
      const input = env.document.querySelector('#register-password');
      expect(label).not.toBeNull();
      expect(label.textContent).toBe('Password');
      expect(input).not.toBeNull();
      expect(input.type).toBe('password');
    });

    it('should display password policy requirements near the password field', () => {
      env.AuthUI.showRegisterModal();
      const policy = env.document.querySelector('.password-policy');
      expect(policy).not.toBeNull();
      expect(policy.textContent).toContain('8 characters');
      expect(policy.textContent).toContain('uppercase');
      expect(policy.textContent).toContain('lowercase');
      expect(policy.textContent).toContain('number');
      expect(policy.textContent).toContain('special character');
    });

    it('should include an auth-error div with role="alert" and aria-live="polite"', () => {
      env.AuthUI.showRegisterModal();
      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv).not.toBeNull();
      expect(errorDiv.getAttribute('role')).toBe('alert');
      expect(errorDiv.getAttribute('aria-live')).toBe('polite');
    });

    it('should include a submit button with text "Register"', () => {
      env.AuthUI.showRegisterModal();
      const btn = env.document.querySelector('button[type="submit"]');
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe('Register');
    });
  });

  describe('client-side validation', () => {
    beforeEach(() => {
      env = createEnvWithAuth({ register: () => Promise.resolve() });
    });

    it('should show error when Full Name is empty on submit', () => {
      env.AuthUI.showRegisterModal();
      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const nameError = env.document.querySelector('#register-name-error');
      expect(nameError.textContent).toBe('Full Name is required');
    });

    it('should show error when Email is empty on submit', () => {
      env.AuthUI.showRegisterModal();
      const nameInput = env.document.querySelector('#register-name');
      nameInput.value = 'John Doe';

      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const emailError = env.document.querySelector('#register-email-error');
      expect(emailError.textContent).toBe('Email is required');
    });

    it('should show error for invalid email format', () => {
      env.AuthUI.showRegisterModal();
      const nameInput = env.document.querySelector('#register-name');
      const emailInput = env.document.querySelector('#register-email');
      nameInput.value = 'John Doe';
      emailInput.value = 'invalid-email';

      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const emailError = env.document.querySelector('#register-email-error');
      expect(emailError.textContent).toBe('Please enter a valid email address');
    });

    it('should show error when Password is empty on submit', () => {
      env.AuthUI.showRegisterModal();
      const nameInput = env.document.querySelector('#register-name');
      const emailInput = env.document.querySelector('#register-email');
      nameInput.value = 'John Doe';
      emailInput.value = 'john@example.com';

      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const passwordError = env.document.querySelector('#register-password-error');
      expect(passwordError.textContent).toBe('Password is required');
    });

    it('should show password policy errors for weak password', () => {
      env.AuthUI.showRegisterModal();
      const nameInput = env.document.querySelector('#register-name');
      const emailInput = env.document.querySelector('#register-email');
      const passwordInput = env.document.querySelector('#register-password');
      nameInput.value = 'John Doe';
      emailInput.value = 'john@example.com';
      passwordInput.value = 'weak';

      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const passwordError = env.document.querySelector('#register-password-error');
      expect(passwordError.textContent).toContain('8 characters');
    });

    it('should show errors for all invalid fields simultaneously', () => {
      env.AuthUI.showRegisterModal();
      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const nameError = env.document.querySelector('#register-name-error');
      const emailError = env.document.querySelector('#register-email-error');
      const passwordError = env.document.querySelector('#register-password-error');
      expect(nameError.textContent).not.toBe('');
      expect(emailError.textContent).not.toBe('');
      expect(passwordError.textContent).not.toBe('');
    });

    it('should clear field error when user types in the field', () => {
      env.AuthUI.showRegisterModal();
      // Submit empty form to trigger errors
      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const nameError = env.document.querySelector('#register-name-error');
      expect(nameError.textContent).not.toBe('');

      // Simulate input event on name field
      const nameInput = env.document.querySelector('#register-name');
      const inputEvent = new env.window.Event('input', { bubbles: true });
      nameInput.dispatchEvent(inputEvent);

      expect(nameError.textContent).toBe('');
    });
  });

  describe('successful registration', () => {
    it('should call Auth.register with email, password, and name', async () => {
      let calledWith = null;
      env = createEnvWithAuth({
        register: (email, password, name) => {
          calledWith = { email, password, name };
          return Promise.resolve();
        }
      });

      env.AuthUI.showRegisterModal();
      const nameInput = env.document.querySelector('#register-name');
      const emailInput = env.document.querySelector('#register-email');
      const passwordInput = env.document.querySelector('#register-password');
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane@example.com';
      passwordInput.value = 'StrongP@ss1';

      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(calledWith).toEqual({
        email: 'jane@example.com',
        password: 'StrongP@ss1',
        name: 'Jane Smith'
      });
    });

    it('should show success message about verification email', async () => {
      env = createEnvWithAuth({
        register: () => Promise.resolve()
      });

      env.AuthUI.showRegisterModal();
      const nameInput = env.document.querySelector('#register-name');
      const emailInput = env.document.querySelector('#register-email');
      const passwordInput = env.document.querySelector('#register-password');
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane@example.com';
      passwordInput.value = 'StrongP@ss1';

      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const successDiv = env.document.querySelector('.auth-success');
      expect(successDiv).not.toBeNull();
      expect(successDiv.textContent).toContain('verification email');
      expect(successDiv.textContent).toContain('jane@example.com');
    });

    it('should disable submit button during registration', () => {
      env = createEnvWithAuth({
        register: () => new Promise(() => {}) // never resolves
      });

      env.AuthUI.showRegisterModal();
      const nameInput = env.document.querySelector('#register-name');
      const emailInput = env.document.querySelector('#register-email');
      const passwordInput = env.document.querySelector('#register-password');
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane@example.com';
      passwordInput.value = 'StrongP@ss1';

      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const submitBtn = env.document.querySelector('button[type="submit"]');
      expect(submitBtn.disabled).toBe(true);
      expect(submitBtn.textContent).toBe('Registering...');
    });
  });

  describe('registration errors', () => {
    it('should display Cognito error message in auth-error div', async () => {
      env = createEnvWithAuth({
        register: () => Promise.reject(new Error('An account with this email already exists.'))
      });

      env.AuthUI.showRegisterModal();
      const nameInput = env.document.querySelector('#register-name');
      const emailInput = env.document.querySelector('#register-email');
      const passwordInput = env.document.querySelector('#register-password');
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane@example.com';
      passwordInput.value = 'StrongP@ss1';

      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('An account with this email already exists.');
    });

    it('should re-enable submit button after error', async () => {
      env = createEnvWithAuth({
        register: () => Promise.reject(new Error('Registration failed'))
      });

      env.AuthUI.showRegisterModal();
      const nameInput = env.document.querySelector('#register-name');
      const emailInput = env.document.querySelector('#register-email');
      const passwordInput = env.document.querySelector('#register-password');
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane@example.com';
      passwordInput.value = 'StrongP@ss1';

      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const submitBtn = env.document.querySelector('button[type="submit"]');
      expect(submitBtn.disabled).toBe(false);
      expect(submitBtn.textContent).toBe('Register');
    });

    it('should show fallback message when error has no message', async () => {
      env = createEnvWithAuth({
        register: () => Promise.reject({})
      });

      env.AuthUI.showRegisterModal();
      const nameInput = env.document.querySelector('#register-name');
      const emailInput = env.document.querySelector('#register-email');
      const passwordInput = env.document.querySelector('#register-password');
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane@example.com';
      passwordInput.value = 'StrongP@ss1';

      const form = env.document.querySelector('#register-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Registration failed. Please try again.');
    });
  });
});


describe('AuthUI - showVerifyModal', () => {
  let env;

  function createEnvWithAuth(authMock) {
    return createAuthUIEnvironment({ authMock });
  }

  describe('form rendering', () => {
    beforeEach(() => {
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.resolve(),
        resendConfirmationCode: () => Promise.resolve()
      });
    });

    it('should open a modal with title "Verify Your Email"', () => {
      env.AuthUI.showVerifyModal('test@example.com');
      const heading = env.document.querySelector('#modal-title');
      expect(heading.textContent).toBe('Verify Your Email');
    });

    it('should render a form with class "auth-form"', () => {
      env.AuthUI.showVerifyModal('test@example.com');
      const form = env.document.querySelector('.auth-form');
      expect(form).not.toBeNull();
      expect(form.tagName).toBe('FORM');
    });

    it('should display a message indicating code was sent to the email', () => {
      env.AuthUI.showVerifyModal('user@test.com');
      const info = env.document.querySelector('.auth-info');
      expect(info).not.toBeNull();
      expect(info.textContent).toContain('user@test.com');
      expect(info.textContent).toContain('verification code');
    });

    it('should render a Verification Code input with label', () => {
      env.AuthUI.showVerifyModal('test@example.com');
      const label = env.document.querySelector('label[for="verify-code"]');
      const input = env.document.querySelector('#verify-code');
      expect(label).not.toBeNull();
      expect(label.textContent).toBe('Verification Code');
      expect(input).not.toBeNull();
      expect(input.type).toBe('text');
    });

    it('should include an auth-error div with role="alert" and aria-live="polite"', () => {
      env.AuthUI.showVerifyModal('test@example.com');
      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv).not.toBeNull();
      expect(errorDiv.getAttribute('role')).toBe('alert');
      expect(errorDiv.getAttribute('aria-live')).toBe('polite');
    });

    it('should include a submit button with text "Verify Email"', () => {
      env.AuthUI.showVerifyModal('test@example.com');
      const btn = env.document.querySelector('button[type="submit"]');
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe('Verify Email');
    });

    it('should include a "Resend code" button', () => {
      env.AuthUI.showVerifyModal('test@example.com');
      const resendBtn = env.document.querySelector('#resend-code-btn');
      expect(resendBtn).not.toBeNull();
      expect(resendBtn.textContent).toBe('Resend code');
    });
  });

  describe('client-side validation', () => {
    beforeEach(() => {
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.resolve(),
        resendConfirmationCode: () => Promise.resolve()
      });
    });

    it('should show error when verification code is empty on submit', () => {
      env.AuthUI.showVerifyModal('test@example.com');
      const form = env.document.querySelector('#verify-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const codeError = env.document.querySelector('#verify-code-error');
      expect(codeError.textContent).toBe('Verification Code is required');
    });

    it('should clear field error when user types in the code field', () => {
      env.AuthUI.showVerifyModal('test@example.com');
      // Submit empty form to trigger error
      const form = env.document.querySelector('#verify-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const codeError = env.document.querySelector('#verify-code-error');
      expect(codeError.textContent).not.toBe('');

      // Simulate input event
      const codeInput = env.document.querySelector('#verify-code');
      const inputEvent = new env.window.Event('input', { bubbles: true });
      codeInput.dispatchEvent(inputEvent);

      expect(codeError.textContent).toBe('');
    });
  });

  describe('successful verification', () => {
    it('should call Auth.confirmRegistration with email and code', async () => {
      let calledWith = null;
      env = createEnvWithAuth({
        confirmRegistration: (email, code) => {
          calledWith = { email, code };
          return Promise.resolve();
        },
        resendConfirmationCode: () => Promise.resolve()
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const codeInput = env.document.querySelector('#verify-code');
      codeInput.value = '123456';

      const form = env.document.querySelector('#verify-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(calledWith).toEqual({
        email: 'jane@example.com',
        code: '123456'
      });
    });

    it('should show success message on verification success', async () => {
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.resolve(),
        resendConfirmationCode: () => Promise.resolve()
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const codeInput = env.document.querySelector('#verify-code');
      codeInput.value = '123456';

      const form = env.document.querySelector('#verify-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const successDiv = env.document.querySelector('.auth-success');
      expect(successDiv).not.toBeNull();
      expect(successDiv.textContent).toContain('Email verified successfully');
      expect(successDiv.textContent).toContain('sign in');
    });

    it('should disable submit button during verification', () => {
      env = createEnvWithAuth({
        confirmRegistration: () => new Promise(() => {}), // never resolves
        resendConfirmationCode: () => Promise.resolve()
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const codeInput = env.document.querySelector('#verify-code');
      codeInput.value = '123456';

      const form = env.document.querySelector('#verify-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const submitBtn = env.document.querySelector('button[type="submit"]');
      expect(submitBtn.disabled).toBe(true);
      expect(submitBtn.textContent).toBe('Verifying...');
    });
  });

  describe('verification errors', () => {
    it('should display error message for invalid code', async () => {
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.reject(new Error('Invalid verification code. Please try again.')),
        resendConfirmationCode: () => Promise.resolve()
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const codeInput = env.document.querySelector('#verify-code');
      codeInput.value = '000000';

      const form = env.document.querySelector('#verify-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Invalid verification code. Please try again.');
    });

    it('should display error message for expired code', async () => {
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.reject(new Error('Code has expired. Please request a new one.')),
        resendConfirmationCode: () => Promise.resolve()
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const codeInput = env.document.querySelector('#verify-code');
      codeInput.value = '111111';

      const form = env.document.querySelector('#verify-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Code has expired. Please request a new one.');
    });

    it('should re-enable submit button after error', async () => {
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.reject(new Error('Verification failed')),
        resendConfirmationCode: () => Promise.resolve()
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const codeInput = env.document.querySelector('#verify-code');
      codeInput.value = '000000';

      const form = env.document.querySelector('#verify-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const submitBtn = env.document.querySelector('button[type="submit"]');
      expect(submitBtn.disabled).toBe(false);
      expect(submitBtn.textContent).toBe('Verify Email');
    });

    it('should show fallback message when error has no message', async () => {
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.reject({}),
        resendConfirmationCode: () => Promise.resolve()
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const codeInput = env.document.querySelector('#verify-code');
      codeInput.value = '000000';

      const form = env.document.querySelector('#verify-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Verification failed. Please try again.');
    });
  });

  describe('resend code', () => {
    it('should call Auth.resendConfirmationCode with email when resend is clicked', async () => {
      let calledWith = null;
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.resolve(),
        resendConfirmationCode: (email) => {
          calledWith = email;
          return Promise.resolve();
        }
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const resendBtn = env.document.querySelector('#resend-code-btn');
      resendBtn.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(calledWith).toBe('jane@example.com');
    });

    it('should show "Code resent!" message on successful resend', async () => {
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.resolve(),
        resendConfirmationCode: () => Promise.resolve()
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const resendBtn = env.document.querySelector('#resend-code-btn');
      resendBtn.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      const successMsg = env.document.querySelector('.auth-success-inline');
      expect(successMsg).not.toBeNull();
      expect(successMsg.textContent).toBe('Code resent!');
    });

    it('should display error when resend fails', async () => {
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.resolve(),
        resendConfirmationCode: () => Promise.reject(new Error('Too many attempts. Please try again later.'))
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const resendBtn = env.document.querySelector('#resend-code-btn');
      resendBtn.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Too many attempts. Please try again later.');
    });

    it('should disable resend button during request', () => {
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.resolve(),
        resendConfirmationCode: () => new Promise(() => {}) // never resolves
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const resendBtn = env.document.querySelector('#resend-code-btn');
      resendBtn.click();

      expect(resendBtn.disabled).toBe(true);
    });

    it('should re-enable resend button after successful resend', async () => {
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.resolve(),
        resendConfirmationCode: () => Promise.resolve()
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const resendBtn = env.document.querySelector('#resend-code-btn');
      resendBtn.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(resendBtn.disabled).toBe(false);
    });

    it('should re-enable resend button after failed resend', async () => {
      env = createEnvWithAuth({
        confirmRegistration: () => Promise.resolve(),
        resendConfirmationCode: () => Promise.reject(new Error('Failed'))
      });

      env.AuthUI.showVerifyModal('jane@example.com');
      const resendBtn = env.document.querySelector('#resend-code-btn');
      resendBtn.click();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(resendBtn.disabled).toBe(false);
    });
  });
});


describe('AuthUI - showLoginModal', () => {
  let env;

  function createEnvWithAuth(authMock) {
    return createAuthUIEnvironment({ authMock });
  }

  describe('form rendering', () => {
    beforeEach(() => {
      env = createEnvWithAuth({ signIn: () => Promise.resolve() });
    });

    it('should open a modal with title "Sign In"', () => {
      env.AuthUI.showLoginModal();
      const heading = env.document.querySelector('#modal-title');
      expect(heading.textContent).toBe('Sign In');
    });

    it('should render a form with id="login-form" and class "auth-form"', () => {
      env.AuthUI.showLoginModal();
      const form = env.document.querySelector('#login-form');
      expect(form).not.toBeNull();
      expect(form.tagName).toBe('FORM');
      expect(form.classList.contains('auth-form')).toBe(true);
    });

    it('should render an Email input with label', () => {
      env.AuthUI.showLoginModal();
      const label = env.document.querySelector('label[for="login-email"]');
      const input = env.document.querySelector('#login-email');
      expect(label).not.toBeNull();
      expect(label.textContent).toBe('Email');
      expect(input).not.toBeNull();
      expect(input.type).toBe('email');
    });

    it('should render a Password input with label', () => {
      env.AuthUI.showLoginModal();
      const label = env.document.querySelector('label[for="login-password"]');
      const input = env.document.querySelector('#login-password');
      expect(label).not.toBeNull();
      expect(label.textContent).toBe('Password');
      expect(input).not.toBeNull();
      expect(input.type).toBe('password');
    });

    it('should include an auth-error div with role="alert" and aria-live="polite"', () => {
      env.AuthUI.showLoginModal();
      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv).not.toBeNull();
      expect(errorDiv.getAttribute('role')).toBe('alert');
      expect(errorDiv.getAttribute('aria-live')).toBe('polite');
    });

    it('should include a submit button with text "Sign In"', () => {
      env.AuthUI.showLoginModal();
      const btn = env.document.querySelector('button[type="submit"]');
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe('Sign In');
    });

    it('should include a "Forgot password?" button', () => {
      env.AuthUI.showLoginModal();
      const forgotBtn = env.document.querySelector('#forgot-password-btn');
      expect(forgotBtn).not.toBeNull();
      expect(forgotBtn.textContent).toBe('Forgot password?');
    });

    it('should include field-error spans for email and password', () => {
      env.AuthUI.showLoginModal();
      const emailError = env.document.querySelector('#login-email-error');
      const passwordError = env.document.querySelector('#login-password-error');
      expect(emailError).not.toBeNull();
      expect(emailError.getAttribute('aria-live')).toBe('polite');
      expect(passwordError).not.toBeNull();
      expect(passwordError.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('client-side validation', () => {
    beforeEach(() => {
      env = createEnvWithAuth({ signIn: () => Promise.resolve() });
    });

    it('should show error when Email is empty on submit', () => {
      env.AuthUI.showLoginModal();
      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const emailError = env.document.querySelector('#login-email-error');
      expect(emailError.textContent).toBe('Email is required');
    });

    it('should show error for invalid email format', () => {
      env.AuthUI.showLoginModal();
      const emailInput = env.document.querySelector('#login-email');
      emailInput.value = 'not-an-email';

      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const emailError = env.document.querySelector('#login-email-error');
      expect(emailError.textContent).toBe('Please enter a valid email address');
    });

    it('should show error when Password is empty on submit', () => {
      env.AuthUI.showLoginModal();
      const emailInput = env.document.querySelector('#login-email');
      emailInput.value = 'user@example.com';

      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const passwordError = env.document.querySelector('#login-password-error');
      expect(passwordError.textContent).toBe('Password is required');
    });

    it('should show errors for all invalid fields simultaneously', () => {
      env.AuthUI.showLoginModal();
      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const emailError = env.document.querySelector('#login-email-error');
      const passwordError = env.document.querySelector('#login-password-error');
      expect(emailError.textContent).not.toBe('');
      expect(passwordError.textContent).not.toBe('');
    });

    it('should NOT validate password policy (only required check for login)', () => {
      env.AuthUI.showLoginModal();
      const emailInput = env.document.querySelector('#login-email');
      const passwordInput = env.document.querySelector('#login-password');
      emailInput.value = 'user@example.com';
      passwordInput.value = 'a'; // weak password but should pass login validation

      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const passwordError = env.document.querySelector('#login-password-error');
      expect(passwordError.textContent).toBe('');
    });

    it('should clear field error when user types in the email field', () => {
      env.AuthUI.showLoginModal();
      // Submit empty form to trigger errors
      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const emailError = env.document.querySelector('#login-email-error');
      expect(emailError.textContent).not.toBe('');

      // Simulate input event on email field
      const emailInput = env.document.querySelector('#login-email');
      const inputEvent = new env.window.Event('input', { bubbles: true });
      emailInput.dispatchEvent(inputEvent);

      expect(emailError.textContent).toBe('');
    });

    it('should clear field error when user types in the password field', () => {
      env.AuthUI.showLoginModal();
      // Submit empty form to trigger errors
      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const passwordError = env.document.querySelector('#login-password-error');
      expect(passwordError.textContent).not.toBe('');

      // Simulate input event on password field
      const passwordInput = env.document.querySelector('#login-password');
      const inputEvent = new env.window.Event('input', { bubbles: true });
      passwordInput.dispatchEvent(inputEvent);

      expect(passwordError.textContent).toBe('');
    });

    it('should clear the auth-error div when user types in any field', () => {
      env.AuthUI.showLoginModal();
      // Manually set an error in the auth-error div
      const errorDiv = env.document.querySelector('.auth-error');
      errorDiv.textContent = 'Some error';

      // Simulate input event on email field
      const emailInput = env.document.querySelector('#login-email');
      const inputEvent = new env.window.Event('input', { bubbles: true });
      emailInput.dispatchEvent(inputEvent);

      expect(errorDiv.textContent).toBe('');
    });
  });

  describe('successful sign-in', () => {
    it('should call Auth.signIn with email and password', async () => {
      let calledWith = null;
      env = createEnvWithAuth({
        signIn: (email, password) => {
          calledWith = { email, password };
          return Promise.resolve();
        }
      });

      env.AuthUI.showLoginModal();
      const emailInput = env.document.querySelector('#login-email');
      const passwordInput = env.document.querySelector('#login-password');
      emailInput.value = 'jane@example.com';
      passwordInput.value = 'MyP@ssw0rd';

      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(calledWith).toEqual({
        email: 'jane@example.com',
        password: 'MyP@ssw0rd'
      });
    });

    it('should close the modal on successful sign-in', async () => {
      env = createEnvWithAuth({
        signIn: () => Promise.resolve()
      });

      env.AuthUI.showLoginModal();
      const emailInput = env.document.querySelector('#login-email');
      const passwordInput = env.document.querySelector('#login-password');
      emailInput.value = 'jane@example.com';
      passwordInput.value = 'MyP@ssw0rd';

      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const overlay = env.document.querySelector('.auth-modal-overlay');
      expect(overlay).toBeNull();
    });

    it('should disable submit button during sign-in attempt', () => {
      env = createEnvWithAuth({
        signIn: () => new Promise(() => {}) // never resolves
      });

      env.AuthUI.showLoginModal();
      const emailInput = env.document.querySelector('#login-email');
      const passwordInput = env.document.querySelector('#login-password');
      emailInput.value = 'jane@example.com';
      passwordInput.value = 'MyP@ssw0rd';

      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const submitBtn = env.document.querySelector('button[type="submit"]');
      expect(submitBtn.disabled).toBe(true);
      expect(submitBtn.textContent).toBe('Signing in...');
    });
  });

  describe('sign-in errors', () => {
    it('should display error message for invalid credentials', async () => {
      env = createEnvWithAuth({
        signIn: () => Promise.reject(new Error('Incorrect email or password.'))
      });

      env.AuthUI.showLoginModal();
      const emailInput = env.document.querySelector('#login-email');
      const passwordInput = env.document.querySelector('#login-password');
      emailInput.value = 'jane@example.com';
      passwordInput.value = 'WrongPass1!';

      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Incorrect email or password.');
    });

    it('should re-enable submit button after error', async () => {
      env = createEnvWithAuth({
        signIn: () => Promise.reject(new Error('Sign in failed'))
      });

      env.AuthUI.showLoginModal();
      const emailInput = env.document.querySelector('#login-email');
      const passwordInput = env.document.querySelector('#login-password');
      emailInput.value = 'jane@example.com';
      passwordInput.value = 'SomePass1!';

      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const submitBtn = env.document.querySelector('button[type="submit"]');
      expect(submitBtn.disabled).toBe(false);
      expect(submitBtn.textContent).toBe('Sign In');
    });

    it('should show fallback message when error has no message', async () => {
      env = createEnvWithAuth({
        signIn: () => Promise.reject({})
      });

      env.AuthUI.showLoginModal();
      const emailInput = env.document.querySelector('#login-email');
      const passwordInput = env.document.querySelector('#login-password');
      emailInput.value = 'jane@example.com';
      passwordInput.value = 'SomePass1!';

      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Sign in failed. Please try again.');
    });

    it('should show verify modal when error code is UserNotConfirmedException', async () => {
      const err = new Error('User is not confirmed.');
      err.code = 'UserNotConfirmedException';
      env = createEnvWithAuth({
        signIn: () => Promise.reject(err),
        confirmRegistration: () => Promise.resolve(),
        resendConfirmationCode: () => Promise.resolve()
      });

      env.AuthUI.showLoginModal();
      const emailInput = env.document.querySelector('#login-email');
      const passwordInput = env.document.querySelector('#login-password');
      emailInput.value = 'unverified@example.com';
      passwordInput.value = 'SomePass1!';

      const form = env.document.querySelector('#login-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify modal should now be showing
      const heading = env.document.querySelector('#modal-title');
      expect(heading.textContent).toBe('Verify Your Email');

      // Should show the email in the info text
      const info = env.document.querySelector('.auth-info');
      expect(info.textContent).toContain('unverified@example.com');
    });
  });

  describe('forgot password link', () => {
    it('should call showForgotPasswordModal when "Forgot password?" is clicked', () => {
      let forgotCalled = false;
      env = createEnvWithAuth({ signIn: () => Promise.resolve() });

      // Override showForgotPasswordModal to track calls
      env.AuthUI.showForgotPasswordModal = function () {
        forgotCalled = true;
      };
      // Re-assign to window so the internal reference picks it up
      env.window.AuthUI.showForgotPasswordModal = env.AuthUI.showForgotPasswordModal;

      env.AuthUI.showLoginModal();
      const forgotBtn = env.document.querySelector('#forgot-password-btn');
      forgotBtn.click();

      expect(forgotCalled).toBe(true);
    });
  });
});


describe('AuthUI - showForgotPasswordModal', () => {
  let env;

  function createEnvWithAuth(authMock) {
    return createAuthUIEnvironment({ authMock });
  }

  describe('form rendering (Step 1: request code)', () => {
    beforeEach(() => {
      env = createEnvWithAuth({ forgotPassword: () => Promise.resolve() });
    });

    it('should open a modal with title "Reset Password"', () => {
      env.AuthUI.showForgotPasswordModal();
      const heading = env.document.querySelector('#modal-title');
      expect(heading.textContent).toBe('Reset Password');
    });

    it('should render a form with id="forgot-form" and class "auth-form"', () => {
      env.AuthUI.showForgotPasswordModal();
      const form = env.document.querySelector('#forgot-form');
      expect(form).not.toBeNull();
      expect(form.tagName).toBe('FORM');
      expect(form.classList.contains('auth-form')).toBe(true);
    });

    it('should display an informational message about the reset process', () => {
      env.AuthUI.showForgotPasswordModal();
      const info = env.document.querySelector('.auth-info');
      expect(info).not.toBeNull();
      expect(info.textContent).toContain('email');
      expect(info.textContent).toContain('code');
    });

    it('should render an Email input with label', () => {
      env.AuthUI.showForgotPasswordModal();
      const label = env.document.querySelector('label[for="forgot-email"]');
      const input = env.document.querySelector('#forgot-email');
      expect(label).not.toBeNull();
      expect(label.textContent).toBe('Email');
      expect(input).not.toBeNull();
      expect(input.type).toBe('email');
    });

    it('should include an auth-error div with role="alert" and aria-live="polite"', () => {
      env.AuthUI.showForgotPasswordModal();
      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv).not.toBeNull();
      expect(errorDiv.getAttribute('role')).toBe('alert');
      expect(errorDiv.getAttribute('aria-live')).toBe('polite');
    });

    it('should include a submit button with text "Send Reset Code"', () => {
      env.AuthUI.showForgotPasswordModal();
      const btn = env.document.querySelector('button[type="submit"]');
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe('Send Reset Code');
    });

    it('should include a field-error span for email', () => {
      env.AuthUI.showForgotPasswordModal();
      const emailError = env.document.querySelector('#forgot-email-error');
      expect(emailError).not.toBeNull();
      expect(emailError.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('client-side validation (Step 1)', () => {
    beforeEach(() => {
      env = createEnvWithAuth({ forgotPassword: () => Promise.resolve() });
    });

    it('should show error when Email is empty on submit', () => {
      env.AuthUI.showForgotPasswordModal();
      const form = env.document.querySelector('#forgot-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const emailError = env.document.querySelector('#forgot-email-error');
      expect(emailError.textContent).toBe('Email is required');
    });

    it('should show error for invalid email format', () => {
      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'not-an-email';

      const form = env.document.querySelector('#forgot-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const emailError = env.document.querySelector('#forgot-email-error');
      expect(emailError.textContent).toBe('Please enter a valid email address');
    });

    it('should clear field error when user types in the email field', () => {
      env.AuthUI.showForgotPasswordModal();
      // Submit empty form to trigger error
      const form = env.document.querySelector('#forgot-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const emailError = env.document.querySelector('#forgot-email-error');
      expect(emailError.textContent).not.toBe('');

      // Simulate input event
      const emailInput = env.document.querySelector('#forgot-email');
      const inputEvent = new env.window.Event('input', { bubbles: true });
      emailInput.dispatchEvent(inputEvent);

      expect(emailError.textContent).toBe('');
    });

    it('should clear the auth-error div when user types in the email field', () => {
      env.AuthUI.showForgotPasswordModal();
      const errorDiv = env.document.querySelector('.auth-error');
      errorDiv.textContent = 'Some error';

      const emailInput = env.document.querySelector('#forgot-email');
      const inputEvent = new env.window.Event('input', { bubbles: true });
      emailInput.dispatchEvent(inputEvent);

      expect(errorDiv.textContent).toBe('');
    });
  });

  describe('successful forgot password request (Step 1)', () => {
    it('should call Auth.forgotPassword with email', async () => {
      let calledWith = null;
      env = createEnvWithAuth({
        forgotPassword: (email) => {
          calledWith = email;
          return Promise.resolve();
        },
        confirmPassword: () => Promise.resolve()
      });

      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';

      const form = env.document.querySelector('#forgot-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(calledWith).toBe('jane@example.com');
    });

    it('should show Step 2 (reset confirm modal) on success', async () => {
      env = createEnvWithAuth({
        forgotPassword: () => Promise.resolve(),
        confirmPassword: () => Promise.resolve()
      });

      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';

      const form = env.document.querySelector('#forgot-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      // Step 2 should now be showing with reset-form
      const resetForm = env.document.querySelector('#reset-form');
      expect(resetForm).not.toBeNull();

      // Should show the email in the info text
      const info = env.document.querySelector('.auth-info');
      expect(info.textContent).toContain('jane@example.com');
    });

    it('should disable submit button during request', () => {
      env = createEnvWithAuth({
        forgotPassword: () => new Promise(() => {}) // never resolves
      });

      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';

      const form = env.document.querySelector('#forgot-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const submitBtn = env.document.querySelector('button[type="submit"]');
      expect(submitBtn.disabled).toBe(true);
      expect(submitBtn.textContent).toBe('Sending...');
    });
  });

  describe('forgot password errors (Step 1)', () => {
    it('should display error message when forgotPassword fails', async () => {
      env = createEnvWithAuth({
        forgotPassword: () => Promise.reject(new Error('No account found with this email.'))
      });

      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'unknown@example.com';

      const form = env.document.querySelector('#forgot-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('No account found with this email.');
    });

    it('should re-enable submit button after error', async () => {
      env = createEnvWithAuth({
        forgotPassword: () => Promise.reject(new Error('Failed'))
      });

      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';

      const form = env.document.querySelector('#forgot-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const submitBtn = env.document.querySelector('button[type="submit"]');
      expect(submitBtn.disabled).toBe(false);
      expect(submitBtn.textContent).toBe('Send Reset Code');
    });

    it('should show fallback message when error has no message', async () => {
      env = createEnvWithAuth({
        forgotPassword: () => Promise.reject({})
      });

      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';

      const form = env.document.querySelector('#forgot-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Failed to send reset code. Please try again.');
    });
  });

  describe('Step 2: reset confirm modal rendering', () => {
    beforeEach(async () => {
      env = createEnvWithAuth({
        forgotPassword: () => Promise.resolve(),
        confirmPassword: () => Promise.resolve()
      });

      // Navigate to Step 2
      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';
      const form = env.document.querySelector('#forgot-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should render a form with id="reset-form" and class "auth-form"', () => {
      const form = env.document.querySelector('#reset-form');
      expect(form).not.toBeNull();
      expect(form.tagName).toBe('FORM');
      expect(form.classList.contains('auth-form')).toBe(true);
    });

    it('should display a message indicating code was sent to the email', () => {
      const info = env.document.querySelector('.auth-info');
      expect(info).not.toBeNull();
      expect(info.textContent).toContain('jane@example.com');
      expect(info.textContent).toContain('reset code');
    });

    it('should render a Reset Code input with label', () => {
      const label = env.document.querySelector('label[for="reset-code"]');
      const input = env.document.querySelector('#reset-code');
      expect(label).not.toBeNull();
      expect(label.textContent).toBe('Reset Code');
      expect(input).not.toBeNull();
      expect(input.type).toBe('text');
    });

    it('should render a New Password input with label', () => {
      const label = env.document.querySelector('label[for="reset-password"]');
      const input = env.document.querySelector('#reset-password');
      expect(label).not.toBeNull();
      expect(label.textContent).toBe('New Password');
      expect(input).not.toBeNull();
      expect(input.type).toBe('password');
    });

    it('should display password policy requirements near the password field', () => {
      const policy = env.document.querySelector('.password-policy');
      expect(policy).not.toBeNull();
      expect(policy.textContent).toContain('8 characters');
      expect(policy.textContent).toContain('uppercase');
    });

    it('should include an auth-error div with role="alert" and aria-live="polite"', () => {
      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv).not.toBeNull();
      expect(errorDiv.getAttribute('role')).toBe('alert');
      expect(errorDiv.getAttribute('aria-live')).toBe('polite');
    });

    it('should include a submit button with text "Reset Password"', () => {
      const btn = env.document.querySelector('button[type="submit"]');
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe('Reset Password');
    });
  });

  describe('client-side validation (Step 2)', () => {
    beforeEach(async () => {
      env = createEnvWithAuth({
        forgotPassword: () => Promise.resolve(),
        confirmPassword: () => Promise.resolve()
      });

      // Navigate to Step 2
      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';
      const form = env.document.querySelector('#forgot-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should show error when Reset Code is empty on submit', () => {
      const form = env.document.querySelector('#reset-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const codeError = env.document.querySelector('#reset-code-error');
      expect(codeError.textContent).toBe('Reset Code is required');
    });

    it('should show error when New Password is empty on submit', () => {
      const codeInput = env.document.querySelector('#reset-code');
      codeInput.value = '123456';

      const form = env.document.querySelector('#reset-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const passwordError = env.document.querySelector('#reset-password-error');
      expect(passwordError.textContent).toBe('Password is required');
    });

    it('should show password policy errors for weak password', () => {
      const codeInput = env.document.querySelector('#reset-code');
      const passwordInput = env.document.querySelector('#reset-password');
      codeInput.value = '123456';
      passwordInput.value = 'weak';

      const form = env.document.querySelector('#reset-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const passwordError = env.document.querySelector('#reset-password-error');
      expect(passwordError.textContent).toContain('8 characters');
    });

    it('should show errors for all invalid fields simultaneously', () => {
      const form = env.document.querySelector('#reset-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const codeError = env.document.querySelector('#reset-code-error');
      const passwordError = env.document.querySelector('#reset-password-error');
      expect(codeError.textContent).not.toBe('');
      expect(passwordError.textContent).not.toBe('');
    });

    it('should clear code field error when user types in the code field', () => {
      const form = env.document.querySelector('#reset-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const codeError = env.document.querySelector('#reset-code-error');
      expect(codeError.textContent).not.toBe('');

      const codeInput = env.document.querySelector('#reset-code');
      const inputEvent = new env.window.Event('input', { bubbles: true });
      codeInput.dispatchEvent(inputEvent);

      expect(codeError.textContent).toBe('');
    });

    it('should clear password field error when user types in the password field', () => {
      const codeInput = env.document.querySelector('#reset-code');
      codeInput.value = '123456';

      const form = env.document.querySelector('#reset-form');
      const event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const passwordError = env.document.querySelector('#reset-password-error');
      expect(passwordError.textContent).not.toBe('');

      const passwordInput = env.document.querySelector('#reset-password');
      const inputEvent = new env.window.Event('input', { bubbles: true });
      passwordInput.dispatchEvent(inputEvent);

      expect(passwordError.textContent).toBe('');
    });

    it('should clear the auth-error div when user types in any field', () => {
      const errorDiv = env.document.querySelector('.auth-error');
      errorDiv.textContent = 'Some error';

      const codeInput = env.document.querySelector('#reset-code');
      const inputEvent = new env.window.Event('input', { bubbles: true });
      codeInput.dispatchEvent(inputEvent);

      expect(errorDiv.textContent).toBe('');
    });
  });

  describe('successful password reset (Step 2)', () => {
    it('should call Auth.confirmPassword with email, code, and new password', async () => {
      let calledWith = null;
      env = createEnvWithAuth({
        forgotPassword: () => Promise.resolve(),
        confirmPassword: (email, code, newPassword) => {
          calledWith = { email, code, newPassword };
          return Promise.resolve();
        }
      });

      // Navigate to Step 2
      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';
      let form = env.document.querySelector('#forgot-form');
      let event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Fill in Step 2
      const codeInput = env.document.querySelector('#reset-code');
      const passwordInput = env.document.querySelector('#reset-password');
      codeInput.value = '654321';
      passwordInput.value = 'NewStr0ng!Pass';

      form = env.document.querySelector('#reset-form');
      event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(calledWith).toEqual({
        email: 'jane@example.com',
        code: '654321',
        newPassword: 'NewStr0ng!Pass'
      });
    });

    it('should show success message on password reset success', async () => {
      env = createEnvWithAuth({
        forgotPassword: () => Promise.resolve(),
        confirmPassword: () => Promise.resolve()
      });

      // Navigate to Step 2
      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';
      let form = env.document.querySelector('#forgot-form');
      let event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Fill in Step 2
      const codeInput = env.document.querySelector('#reset-code');
      const passwordInput = env.document.querySelector('#reset-password');
      codeInput.value = '654321';
      passwordInput.value = 'NewStr0ng!Pass';

      form = env.document.querySelector('#reset-form');
      event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const successDiv = env.document.querySelector('.auth-success');
      expect(successDiv).not.toBeNull();
      expect(successDiv.textContent).toContain('Password reset successful');
      expect(successDiv.textContent).toContain('sign in');
    });

    it('should disable submit button during reset request', async () => {
      env = createEnvWithAuth({
        forgotPassword: () => Promise.resolve(),
        confirmPassword: () => new Promise(() => {}) // never resolves
      });

      // Navigate to Step 2
      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';
      let form = env.document.querySelector('#forgot-form');
      let event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Fill in Step 2
      const codeInput = env.document.querySelector('#reset-code');
      const passwordInput = env.document.querySelector('#reset-password');
      codeInput.value = '654321';
      passwordInput.value = 'NewStr0ng!Pass';

      form = env.document.querySelector('#reset-form');
      event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      const submitBtn = env.document.querySelector('button[type="submit"]');
      expect(submitBtn.disabled).toBe(true);
      expect(submitBtn.textContent).toBe('Resetting...');
    });
  });

  describe('password reset errors (Step 2)', () => {
    it('should display error message for invalid code', async () => {
      env = createEnvWithAuth({
        forgotPassword: () => Promise.resolve(),
        confirmPassword: () => Promise.reject(new Error('Invalid verification code. Please try again.'))
      });

      // Navigate to Step 2
      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';
      let form = env.document.querySelector('#forgot-form');
      let event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Fill in Step 2
      const codeInput = env.document.querySelector('#reset-code');
      const passwordInput = env.document.querySelector('#reset-password');
      codeInput.value = '000000';
      passwordInput.value = 'NewStr0ng!Pass';

      form = env.document.querySelector('#reset-form');
      event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Invalid verification code. Please try again.');
    });

    it('should display error message for expired code', async () => {
      env = createEnvWithAuth({
        forgotPassword: () => Promise.resolve(),
        confirmPassword: () => Promise.reject(new Error('Code has expired. Please request a new one.'))
      });

      // Navigate to Step 2
      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';
      let form = env.document.querySelector('#forgot-form');
      let event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Fill in Step 2
      const codeInput = env.document.querySelector('#reset-code');
      const passwordInput = env.document.querySelector('#reset-password');
      codeInput.value = '111111';
      passwordInput.value = 'NewStr0ng!Pass';

      form = env.document.querySelector('#reset-form');
      event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Code has expired. Please request a new one.');
    });

    it('should re-enable submit button after error', async () => {
      env = createEnvWithAuth({
        forgotPassword: () => Promise.resolve(),
        confirmPassword: () => Promise.reject(new Error('Reset failed'))
      });

      // Navigate to Step 2
      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';
      let form = env.document.querySelector('#forgot-form');
      let event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Fill in Step 2
      const codeInput = env.document.querySelector('#reset-code');
      const passwordInput = env.document.querySelector('#reset-password');
      codeInput.value = '000000';
      passwordInput.value = 'NewStr0ng!Pass';

      form = env.document.querySelector('#reset-form');
      event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const submitBtn = env.document.querySelector('button[type="submit"]');
      expect(submitBtn.disabled).toBe(false);
      expect(submitBtn.textContent).toBe('Reset Password');
    });

    it('should show fallback message when error has no message', async () => {
      env = createEnvWithAuth({
        forgotPassword: () => Promise.resolve(),
        confirmPassword: () => Promise.reject({})
      });

      // Navigate to Step 2
      env.AuthUI.showForgotPasswordModal();
      const emailInput = env.document.querySelector('#forgot-email');
      emailInput.value = 'jane@example.com';
      let form = env.document.querySelector('#forgot-form');
      let event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Fill in Step 2
      const codeInput = env.document.querySelector('#reset-code');
      const passwordInput = env.document.querySelector('#reset-password');
      codeInput.value = '000000';
      passwordInput.value = 'NewStr0ng!Pass';

      form = env.document.querySelector('#reset-form');
      event = new env.window.Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Password reset failed. Please try again.');
    });
  });
});

describe('AuthUI - updateHeaderState', () => {
  let env;

  function createEnvWithHeader(authMock) {
    const dom = new JSDOM('<!DOCTYPE html><html><body><header><div class="container"><span class="logo">AI Tech Product Camp</span><div class="header-actions"><div class="auth-controls" id="auth-controls"></div></div></div></header></body></html>', {
      url: 'http://localhost',
      runScripts: 'dangerously',
    });

    const { window } = dom;

    // Load validators
    const validatorsScript = window.document.createElement('script');
    validatorsScript.textContent = validatorsSource;
    window.document.body.appendChild(validatorsScript);

    // Set up Auth mock if provided
    if (authMock) {
      window.Auth = authMock;
    }

    // Execute auth-ui.js
    const scriptEl = window.document.createElement('script');
    scriptEl.textContent = authUiSource;
    window.document.body.appendChild(scriptEl);

    return {
      window,
      document: window.document,
      AuthUI: window.AuthUI,
    };
  }

  describe('unauthenticated state (user is null)', () => {
    beforeEach(() => {
      env = createEnvWithHeader();
    });

    it('should display "Sign In" button when user is null', () => {
      env.AuthUI.updateHeaderState(null);
      const signInBtn = env.document.querySelector('#header-signin-btn');
      expect(signInBtn).not.toBeNull();
      expect(signInBtn.textContent).toBe('Sign In');
    });

    it('should display "Register" button when user is null', () => {
      env.AuthUI.updateHeaderState(null);
      const registerBtn = env.document.querySelector('#header-register-btn');
      expect(registerBtn).not.toBeNull();
      expect(registerBtn.textContent).toBe('Register');
    });

    it('should NOT display user name when user is null', () => {
      env.AuthUI.updateHeaderState(null);
      const nameSpan = env.document.querySelector('.auth-user-name');
      expect(nameSpan).toBeNull();
    });

    it('should NOT display "Sign Out" button when user is null', () => {
      env.AuthUI.updateHeaderState(null);
      const signOutBtn = env.document.querySelector('#header-signout-btn');
      expect(signOutBtn).toBeNull();
    });

    it('should display unauthenticated state when user is undefined', () => {
      env.AuthUI.updateHeaderState(undefined);
      const signInBtn = env.document.querySelector('#header-signin-btn');
      const registerBtn = env.document.querySelector('#header-register-btn');
      expect(signInBtn).not.toBeNull();
      expect(registerBtn).not.toBeNull();
    });
  });

  describe('authenticated state (user object provided)', () => {
    beforeEach(() => {
      env = createEnvWithHeader({ signOut: () => Promise.resolve() });
    });

    it('should display user name when authenticated', () => {
      env.AuthUI.updateHeaderState({ name: 'Jane Smith', email: 'jane@example.com' });
      const nameSpan = env.document.querySelector('.auth-user-name');
      expect(nameSpan).not.toBeNull();
      expect(nameSpan.textContent).toBe('Jane Smith');
    });

    it('should display "Sign Out" button when authenticated', () => {
      env.AuthUI.updateHeaderState({ name: 'Jane Smith', email: 'jane@example.com' });
      const signOutBtn = env.document.querySelector('#header-signout-btn');
      expect(signOutBtn).not.toBeNull();
      expect(signOutBtn.textContent).toBe('Sign Out');
    });

    it('should NOT display "Sign In" button when authenticated', () => {
      env.AuthUI.updateHeaderState({ name: 'Jane Smith', email: 'jane@example.com' });
      const signInBtn = env.document.querySelector('#header-signin-btn');
      expect(signInBtn).toBeNull();
    });

    it('should NOT display "Register" button when authenticated', () => {
      env.AuthUI.updateHeaderState({ name: 'Jane Smith', email: 'jane@example.com' });
      const registerBtn = env.document.querySelector('#header-register-btn');
      expect(registerBtn).toBeNull();
    });
  });

  describe('state transitions', () => {
    beforeEach(() => {
      env = createEnvWithHeader({ signOut: () => Promise.resolve() });
    });

    it('should switch from unauthenticated to authenticated state', () => {
      env.AuthUI.updateHeaderState(null);
      expect(env.document.querySelector('#header-signin-btn')).not.toBeNull();

      env.AuthUI.updateHeaderState({ name: 'John Doe', email: 'john@example.com' });
      expect(env.document.querySelector('#header-signin-btn')).toBeNull();
      expect(env.document.querySelector('.auth-user-name').textContent).toBe('John Doe');
      expect(env.document.querySelector('#header-signout-btn')).not.toBeNull();
    });

    it('should switch from authenticated to unauthenticated state', () => {
      env.AuthUI.updateHeaderState({ name: 'John Doe', email: 'john@example.com' });
      expect(env.document.querySelector('.auth-user-name')).not.toBeNull();

      env.AuthUI.updateHeaderState(null);
      expect(env.document.querySelector('.auth-user-name')).toBeNull();
      expect(env.document.querySelector('#header-signin-btn')).not.toBeNull();
      expect(env.document.querySelector('#header-register-btn')).not.toBeNull();
    });
  });

  describe('button interactions', () => {
    it('should call Auth.signOut when Sign Out button is clicked', () => {
      let signOutCalled = false;
      env = createEnvWithHeader({ signOut: () => { signOutCalled = true; return Promise.resolve(); } });

      env.AuthUI.updateHeaderState({ name: 'Jane Smith', email: 'jane@example.com' });
      const signOutBtn = env.document.querySelector('#header-signout-btn');
      signOutBtn.click();

      expect(signOutCalled).toBe(true);
    });

    it('should call AuthUI.showLoginModal when Sign In button is clicked', () => {
      env = createEnvWithHeader();
      env.AuthUI.updateHeaderState(null);

      const signInBtn = env.document.querySelector('#header-signin-btn');
      signInBtn.click();

      // Verify modal opened with Sign In title
      const heading = env.document.querySelector('#modal-title');
      expect(heading).not.toBeNull();
      expect(heading.textContent).toBe('Sign In');
    });

    it('should call AuthUI.showRegisterModal when Register button is clicked', () => {
      env = createEnvWithHeader();
      env.AuthUI.updateHeaderState(null);

      const registerBtn = env.document.querySelector('#header-register-btn');
      registerBtn.click();

      // Verify modal opened with Create Account title
      const heading = env.document.querySelector('#modal-title');
      expect(heading).not.toBeNull();
      expect(heading.textContent).toBe('Create Account');
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      env = createEnvWithHeader();
    });

    it('should not throw if auth-controls container is missing', () => {
      // Remove the container
      const container = env.document.querySelector('#auth-controls');
      container.parentNode.removeChild(container);

      expect(() => env.AuthUI.updateHeaderState(null)).not.toThrow();
      expect(() => env.AuthUI.updateHeaderState({ name: 'Test', email: 'test@test.com' })).not.toThrow();
    });

    it('should show unauthenticated state when user object has no name', () => {
      env.AuthUI.updateHeaderState({ email: 'test@test.com' });
      const signInBtn = env.document.querySelector('#header-signin-btn');
      expect(signInBtn).not.toBeNull();
    });
  });
});


describe('AuthUI - init() event wiring', () => {
  let env;

  function createEnvWithHeader(authMock) {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="auth-controls"></div></body></html>', {
      url: 'http://localhost',
      runScripts: 'dangerously',
    });

    const { window } = dom;

    // Load validators
    const validatorsScript = window.document.createElement('script');
    validatorsScript.textContent = validatorsSource;
    window.document.body.appendChild(validatorsScript);

    // Set up Auth mock
    if (authMock) {
      window.Auth = authMock;
    } else {
      window.Auth = {
        signIn: () => Promise.resolve(),
        signOut: () => {},
        register: () => Promise.resolve(),
        confirmRegistration: () => Promise.resolve(),
        resendConfirmationCode: () => Promise.resolve(),
        forgotPassword: () => Promise.resolve(),
        confirmPassword: () => Promise.resolve(),
        isAuthenticated: () => false,
        getCurrentUser: () => null,
      };
    }

    // Execute auth-ui.js
    const scriptEl = window.document.createElement('script');
    scriptEl.textContent = authUiSource;
    window.document.body.appendChild(scriptEl);

    return {
      window,
      document: window.document,
      AuthUI: window.AuthUI,
    };
  }

  beforeEach(() => {
    env = createEnvWithHeader();
  });

  describe('auth:stateChanged event', () => {
    it('should call updateHeaderState with user when state is authenticated', () => {
      env.AuthUI.init();

      const user = { name: 'Alice', email: 'alice@example.com' };
      const event = new env.window.CustomEvent('auth:stateChanged', {
        detail: { state: 'authenticated', user: user }
      });
      env.document.dispatchEvent(event);

      const nameSpan = env.document.querySelector('.auth-user-name');
      expect(nameSpan).not.toBeNull();
      expect(nameSpan.textContent).toBe('Alice');

      const signOutBtn = env.document.querySelector('#header-signout-btn');
      expect(signOutBtn).not.toBeNull();
    });

    it('should call updateHeaderState with null when state is unauthenticated', () => {
      env.AuthUI.init();

      // First set authenticated state
      const authEvent = new env.window.CustomEvent('auth:stateChanged', {
        detail: { state: 'authenticated', user: { name: 'Bob', email: 'bob@test.com' } }
      });
      env.document.dispatchEvent(authEvent);

      // Then set unauthenticated state
      const unauthEvent = new env.window.CustomEvent('auth:stateChanged', {
        detail: { state: 'unauthenticated', user: null }
      });
      env.document.dispatchEvent(unauthEvent);

      const signInBtn = env.document.querySelector('#header-signin-btn');
      expect(signInBtn).not.toBeNull();

      const registerBtn = env.document.querySelector('#header-register-btn');
      expect(registerBtn).not.toBeNull();

      const nameSpan = env.document.querySelector('.auth-user-name');
      expect(nameSpan).toBeNull();
    });

    it('should handle missing detail gracefully', () => {
      env.AuthUI.init();

      const event = new env.window.CustomEvent('auth:stateChanged', { detail: {} });
      expect(() => env.document.dispatchEvent(event)).not.toThrow();

      // Should show unauthenticated state (null user)
      const signInBtn = env.document.querySelector('#header-signin-btn');
      expect(signInBtn).not.toBeNull();
    });
  });

  describe('auth:error event', () => {
    it('should display error message in the active modal error div', () => {
      env.AuthUI.init();

      // Open a modal first
      env.AuthUI.showLoginModal();

      // Dispatch auth:error event
      const event = new env.window.CustomEvent('auth:error', {
        detail: { error: { message: 'Invalid credentials' } }
      });
      env.document.dispatchEvent(event);

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Invalid credentials');
    });

    it('should handle error detail with message property directly', () => {
      env.AuthUI.init();

      // Open a modal first
      env.AuthUI.showLoginModal();

      // Dispatch auth:error event with message at top level
      const event = new env.window.CustomEvent('auth:error', {
        detail: { message: 'Something went wrong' }
      });
      env.document.dispatchEvent(event);

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('Something went wrong');
    });

    it('should not throw if no modal is open when error event fires', () => {
      env.AuthUI.init();

      const event = new env.window.CustomEvent('auth:error', {
        detail: { error: { message: 'Some error' } }
      });
      expect(() => env.document.dispatchEvent(event)).not.toThrow();
    });

    it('should not display anything if error has no message', () => {
      env.AuthUI.init();

      // Open a modal first
      env.AuthUI.showLoginModal();

      const event = new env.window.CustomEvent('auth:error', {
        detail: { error: {} }
      });
      env.document.dispatchEvent(event);

      const errorDiv = env.document.querySelector('.auth-error');
      expect(errorDiv.textContent).toBe('');
    });
  });

  describe('input event clears errors in modal', () => {
    it('should clear auth-error div when user types in a modal input', () => {
      env.AuthUI.init();

      // Open login modal
      env.AuthUI.showLoginModal();

      // Set an error message
      const errorDiv = env.document.querySelector('.auth-error');
      errorDiv.textContent = 'Some error message';

      // Simulate input event on the email field
      const emailInput = env.document.querySelector('#login-email');
      const inputEvent = new env.window.Event('input', { bubbles: true });
      emailInput.dispatchEvent(inputEvent);

      expect(errorDiv.textContent).toBe('');
    });

    it('should not clear errors for inputs outside the modal', () => {
      env.AuthUI.init();

      // Open login modal and set an error
      env.AuthUI.showLoginModal();
      const errorDiv = env.document.querySelector('.auth-error');
      errorDiv.textContent = 'Some error message';

      // Create an input outside the modal
      const outsideInput = env.document.createElement('input');
      env.document.body.appendChild(outsideInput);

      // Simulate input event on the outside input
      const inputEvent = new env.window.Event('input', { bubbles: true });
      outsideInput.dispatchEvent(inputEvent);

      // Error should still be there
      expect(errorDiv.textContent).toBe('Some error message');
    });

    it('should not throw if no modal is open when input event fires', () => {
      env.AuthUI.init();

      // Create an input and fire input event with no modal open
      const input = env.document.createElement('input');
      env.document.body.appendChild(input);

      const inputEvent = new env.window.Event('input', { bubbles: true });
      expect(() => input.dispatchEvent(inputEvent)).not.toThrow();
    });
  });
});
