/**
 * Form Validation Utilities
 * Client-side validation for auth forms.
 * Loaded via script tag; exposes global `Validators` object.
 */
var Validators = (function () {
  'use strict';

  /**
   * Validate a password against the Cognito password policy.
   * Checks: minimum 8 characters, at least one uppercase letter,
   * at least one lowercase letter, at least one digit, at least one special character.
   *
   * @param {string} password - The password to validate
   * @returns {{ valid: boolean, errors: string[] }} Validation result with specific error messages
   */
  function validatePassword(password) {
    var errors = [];

    if (typeof password !== 'string' || password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one digit');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Validate an email address format.
   * Checks that the email has a valid structure: local@domain.tld
   *
   * @param {string} email - The email address to validate
   * @returns {{ valid: boolean, error: string|null }} Validation result with error message or null
   */
  function validateEmail(email) {
    if (typeof email !== 'string' || email.trim() === '') {
      return { valid: false, error: 'Please enter a valid email address' };
    }

    // Practical email regex: local part @ domain with at least one dot in domain
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Please enter a valid email address' };
    }

    return { valid: true, error: null };
  }

  /**
   * Validate that a required field is not empty or whitespace-only.
   *
   * @param {string} value - The field value to validate
   * @param {string} fieldName - The display name of the field (used in error message)
   * @returns {{ valid: boolean, error: string|null }} Validation result with field-specific error or null
   */
  function validateRequired(value, fieldName) {
    if (typeof value !== 'string' || value.trim() === '') {
      return { valid: false, error: fieldName + ' is required' };
    }

    return { valid: true, error: null };
  }

  // Public API
  return {
    validatePassword: validatePassword,
    validateEmail: validateEmail,
    validateRequired: validateRequired
  };
})();
