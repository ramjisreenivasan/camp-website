import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Read the validators.js source
const validatorsSource = fs.readFileSync(path.resolve(__dirname, '../../validators.js'), 'utf-8');

function createValidatorsEnvironment() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    runScripts: 'dangerously',
  });

  const { window } = dom;

  // Execute validators.js in the JSDOM context
  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = validatorsSource;
  window.document.body.appendChild(scriptEl);

  return {
    window,
    Validators: window.Validators,
  };
}

describe('Validators - validatePassword', () => {
  let env;

  beforeEach(() => {
    env = createValidatorsEnvironment();
  });

  it('should accept a valid password meeting all criteria', () => {
    const result = env.Validators.validatePassword('Abcdef1!');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should reject a password shorter than 8 characters', () => {
    const result = env.Validators.validatePassword('Ab1!xyz');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters');
  });

  it('should reject a password without an uppercase letter', () => {
    const result = env.Validators.validatePassword('abcdef1!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  it('should reject a password without a lowercase letter', () => {
    const result = env.Validators.validatePassword('ABCDEF1!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  it('should reject a password without a digit', () => {
    const result = env.Validators.validatePassword('Abcdefg!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one digit');
  });

  it('should reject a password without a special character', () => {
    const result = env.Validators.validatePassword('Abcdefg1');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one special character');
  });

  it('should return multiple errors for a password violating multiple rules', () => {
    const result = env.Validators.validatePassword('abc');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters');
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
    expect(result.errors).toContain('Password must contain at least one digit');
    expect(result.errors).toContain('Password must contain at least one special character');
  });

  it('should accept a password with exactly 8 characters meeting all rules', () => {
    const result = env.Validators.validatePassword('Aa1!xxxx');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should handle an empty string', () => {
    const result = env.Validators.validatePassword('');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters');
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
    expect(result.errors).toContain('Password must contain at least one digit');
    expect(result.errors).toContain('Password must contain at least one special character');
  });

  it('should accept various special characters', () => {
    const specials = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+'];
    specials.forEach((char) => {
      const result = env.Validators.validatePassword('Abcdef1' + char);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Validators - validateEmail', () => {
  let env;

  beforeEach(() => {
    env = createValidatorsEnvironment();
  });

  it('should accept a valid email address', () => {
    const result = env.Validators.validateEmail('user@example.com');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should accept an email with subdomain', () => {
    const result = env.Validators.validateEmail('user@mail.example.com');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should accept an email with plus addressing', () => {
    const result = env.Validators.validateEmail('user+tag@example.com');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should accept an email with dots in local part', () => {
    const result = env.Validators.validateEmail('first.last@example.com');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should reject an email without @ symbol', () => {
    const result = env.Validators.validateEmail('userexample.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please enter a valid email address');
  });

  it('should reject an email without domain', () => {
    const result = env.Validators.validateEmail('user@');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please enter a valid email address');
  });

  it('should reject an email without TLD', () => {
    const result = env.Validators.validateEmail('user@example');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please enter a valid email address');
  });

  it('should reject an email without local part', () => {
    const result = env.Validators.validateEmail('@example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please enter a valid email address');
  });

  it('should reject an empty string', () => {
    const result = env.Validators.validateEmail('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please enter a valid email address');
  });

  it('should reject a whitespace-only string', () => {
    const result = env.Validators.validateEmail('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please enter a valid email address');
  });

  it('should reject an email with spaces', () => {
    const result = env.Validators.validateEmail('user @example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please enter a valid email address');
  });

  it('should reject a non-string input', () => {
    const result = env.Validators.validateEmail(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please enter a valid email address');
  });
});


describe('Validators - validateRequired', () => {
  let env;

  beforeEach(() => {
    env = createValidatorsEnvironment();
  });

  it('should accept a non-empty string value', () => {
    const result = env.Validators.validateRequired('John', 'Full Name');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should reject an empty string with field-specific error', () => {
    const result = env.Validators.validateRequired('', 'Email');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email is required');
  });

  it('should reject a whitespace-only string with field-specific error', () => {
    const result = env.Validators.validateRequired('   ', 'Full Name');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Full Name is required');
  });

  it('should reject a tab-only string', () => {
    const result = env.Validators.validateRequired('\t\t', 'Password');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Password is required');
  });

  it('should accept a value with leading/trailing spaces but non-empty content', () => {
    const result = env.Validators.validateRequired('  hello  ', 'Username');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should reject null input', () => {
    const result = env.Validators.validateRequired(null, 'Email');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email is required');
  });

  it('should reject undefined input', () => {
    const result = env.Validators.validateRequired(undefined, 'Email');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email is required');
  });

  it('should use the provided field name in the error message', () => {
    const result = env.Validators.validateRequired('', 'Verification Code');
    expect(result.error).toBe('Verification Code is required');
  });
});
