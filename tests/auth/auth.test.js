import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Read the auth.js source
const authSource = fs.readFileSync(path.resolve(__dirname, '../../auth.js'), 'utf-8');

function createAuthEnvironment(options = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    runScripts: 'dangerously',
  });

  const { window } = dom;

  // Mock fetch for config loading
  const mockConfig = options.config || { UserPoolId: 'us-east-1_TestPool', ClientId: 'testclientid123', Region: 'us-east-1' };
  window.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockConfig),
  });

  // Mock console.error
  window.console = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };

  // Track signUp calls
  const mockSignUp = vi.fn();
  const mockConfirmRegistration = vi.fn();
  const mockResendConfirmationCode = vi.fn();

  // Mock CognitoUser constructor
  const mockCognitoUser = {
    confirmRegistration: mockConfirmRegistration,
    resendConfirmationCode: mockResendConfirmationCode,
  };

  // Mock AmazonCognitoIdentity SDK
  window.AmazonCognitoIdentity = {
    CognitoUserPool: vi.fn().mockImplementation(() => ({
      signUp: mockSignUp,
      getCurrentUser: () => null,
    })),
    CognitoUser: vi.fn().mockImplementation(() => mockCognitoUser),
    CognitoUserAttribute: vi.fn().mockImplementation((data) => data),
  };

  // Execute auth.js in the JSDOM context
  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = authSource;
  window.document.body.appendChild(scriptEl);

  return {
    window,
    Auth: window.Auth,
    mocks: {
      signUp: mockSignUp,
      confirmRegistration: mockConfirmRegistration,
      resendConfirmationCode: mockResendConfirmationCode,
      CognitoUser: window.AmazonCognitoIdentity.CognitoUser,
      CognitoUserAttribute: window.AmazonCognitoIdentity.CognitoUserAttribute,
    },
  };
}

describe('Auth module - register', () => {
  let env;

  beforeEach(async () => {
    env = createAuthEnvironment();
    await env.Auth.init();
  });

  it('should call userPool.signUp with email, password, and attribute list', async () => {
    env.mocks.signUp.mockImplementation((email, password, attrs, validationData, callback) => {
      callback(null, { user: { getUsername: () => 'test@example.com' } });
    });

    await env.Auth.register('test@example.com', 'Password1!', 'Test User');

    expect(env.mocks.signUp).toHaveBeenCalled();
    const callArgs = env.mocks.signUp.mock.calls[0];
    expect(callArgs[0]).toBe('test@example.com');
    expect(callArgs[1]).toBe('Password1!');
    expect(callArgs[2]).toHaveLength(2);
    expect(callArgs[3]).toBeNull();
    expect(typeof callArgs[4]).toBe('function');
  });

  it('should include email and name in the attribute list', async () => {
    env.mocks.signUp.mockImplementation((email, password, attrs, validationData, callback) => {
      callback(null, { user: { getUsername: () => 'test@example.com' } });
    });

    await env.Auth.register('test@example.com', 'Password1!', 'Test User');

    const attrs = env.mocks.signUp.mock.calls[0][2];
    expect(attrs).toHaveLength(2);
    expect(attrs[0]).toEqual({ Name: 'email', Value: 'test@example.com' });
    expect(attrs[1]).toEqual({ Name: 'name', Value: 'Test User' });
  });

  it('should resolve with the result on success', async () => {
    const mockResult = { user: { getUsername: () => 'test@example.com' }, userConfirmed: false };
    env.mocks.signUp.mockImplementation((email, password, attrs, validationData, callback) => {
      callback(null, mockResult);
    });

    const result = await env.Auth.register('test@example.com', 'Password1!', 'Test User');
    expect(result).toBe(mockResult);
  });

  it('should dispatch auth:error and reject on failure', async () => {
    const mockError = new Error('UsernameExistsException');
    env.mocks.signUp.mockImplementation((email, password, attrs, validationData, callback) => {
      callback(mockError);
    });

    const events = [];
    env.window.document.addEventListener('auth:error', (e) => events.push(e.detail));

    await expect(env.Auth.register('test@example.com', 'Password1!', 'Test User')).rejects.toThrow('UsernameExistsException');
    expect(events).toHaveLength(1);
    expect(events[0].operation).toBe('register');
    expect(events[0].error).toBe(mockError);
  });

  it('should reject immediately if auth is disabled', async () => {
    // Create a new env with invalid config to disable auth
    const disabledEnv = createAuthEnvironment({ config: {} });
    await disabledEnv.Auth.init();

    await expect(disabledEnv.Auth.register('test@example.com', 'Pass1!', 'User')).rejects.toThrow('Auth is disabled');
  });
});

describe('Auth module - confirmRegistration', () => {
  let env;

  beforeEach(async () => {
    env = createAuthEnvironment();
    await env.Auth.init();
  });

  it('should create a CognitoUser and call confirmRegistration with code', async () => {
    env.mocks.confirmRegistration.mockImplementation((code, forceAlias, callback) => {
      callback(null, 'SUCCESS');
    });

    await env.Auth.confirmRegistration('test@example.com', '123456');

    expect(env.mocks.CognitoUser).toHaveBeenCalledWith({
      Username: 'test@example.com',
      Pool: expect.any(Object),
    });
    expect(env.mocks.confirmRegistration).toHaveBeenCalledWith('123456', true, expect.any(Function));
  });

  it('should resolve with the result on success', async () => {
    env.mocks.confirmRegistration.mockImplementation((code, forceAlias, callback) => {
      callback(null, 'SUCCESS');
    });

    const result = await env.Auth.confirmRegistration('test@example.com', '123456');
    expect(result).toBe('SUCCESS');
  });

  it('should dispatch auth:error and reject on failure', async () => {
    const mockError = new Error('CodeMismatchException');
    env.mocks.confirmRegistration.mockImplementation((code, forceAlias, callback) => {
      callback(mockError);
    });

    const events = [];
    env.window.document.addEventListener('auth:error', (e) => events.push(e.detail));

    await expect(env.Auth.confirmRegistration('test@example.com', 'wrong')).rejects.toThrow('CodeMismatchException');
    expect(events).toHaveLength(1);
    expect(events[0].operation).toBe('confirmRegistration');
    expect(events[0].error).toBe(mockError);
  });

  it('should reject immediately if auth is disabled', async () => {
    const disabledEnv = createAuthEnvironment({ config: {} });
    await disabledEnv.Auth.init();

    await expect(disabledEnv.Auth.confirmRegistration('test@example.com', '123456')).rejects.toThrow('Auth is disabled');
  });
});

describe('Auth module - resendConfirmationCode', () => {
  let env;

  beforeEach(async () => {
    env = createAuthEnvironment();
    await env.Auth.init();
  });

  it('should create a CognitoUser and call resendConfirmationCode', async () => {
    env.mocks.resendConfirmationCode.mockImplementation((callback) => {
      callback(null, { CodeDeliveryDetails: {} });
    });

    await env.Auth.resendConfirmationCode('test@example.com');

    expect(env.mocks.CognitoUser).toHaveBeenCalledWith({
      Username: 'test@example.com',
      Pool: expect.any(Object),
    });
    expect(env.mocks.resendConfirmationCode).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should resolve with the result on success', async () => {
    const mockResult = { CodeDeliveryDetails: { Destination: 't***@example.com' } };
    env.mocks.resendConfirmationCode.mockImplementation((callback) => {
      callback(null, mockResult);
    });

    const result = await env.Auth.resendConfirmationCode('test@example.com');
    expect(result).toBe(mockResult);
  });

  it('should dispatch auth:error and reject on failure', async () => {
    const mockError = new Error('LimitExceededException');
    env.mocks.resendConfirmationCode.mockImplementation((callback) => {
      callback(mockError);
    });

    const events = [];
    env.window.document.addEventListener('auth:error', (e) => events.push(e.detail));

    await expect(env.Auth.resendConfirmationCode('test@example.com')).rejects.toThrow('LimitExceededException');
    expect(events).toHaveLength(1);
    expect(events[0].operation).toBe('resendConfirmationCode');
    expect(events[0].error).toBe(mockError);
  });

  it('should reject immediately if auth is disabled', async () => {
    const disabledEnv = createAuthEnvironment({ config: {} });
    await disabledEnv.Auth.init();

    await expect(disabledEnv.Auth.resendConfirmationCode('test@example.com')).rejects.toThrow('Auth is disabled');
  });
});

function createSignInEnvironment(options = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    runScripts: 'dangerously',
  });

  const { window } = dom;

  // Mock fetch for config loading
  const mockConfig = options.config || { UserPoolId: 'us-east-1_TestPool', ClientId: 'testclientid123', Region: 'us-east-1' };
  window.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockConfig),
  });

  // Mock console
  window.console = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };

  // Mock authenticateUser and getUserAttributes
  const mockAuthenticateUser = vi.fn();
  const mockGetUserAttributes = vi.fn();

  const mockCognitoUser = {
    authenticateUser: mockAuthenticateUser,
    getUserAttributes: mockGetUserAttributes,
  };

  // Mock AmazonCognitoIdentity SDK
  window.AmazonCognitoIdentity = {
    CognitoUserPool: vi.fn().mockImplementation(() => ({
      signUp: vi.fn(),
      getCurrentUser: () => null,
    })),
    CognitoUser: vi.fn().mockImplementation(() => mockCognitoUser),
    CognitoUserAttribute: vi.fn().mockImplementation((data) => data),
    AuthenticationDetails: vi.fn().mockImplementation((data) => data),
  };

  // Execute auth.js in the JSDOM context
  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = authSource;
  window.document.body.appendChild(scriptEl);

  return {
    window,
    Auth: window.Auth,
    mocks: {
      authenticateUser: mockAuthenticateUser,
      getUserAttributes: mockGetUserAttributes,
      CognitoUser: window.AmazonCognitoIdentity.CognitoUser,
      AuthenticationDetails: window.AmazonCognitoIdentity.AuthenticationDetails,
    },
  };
}

describe('Auth module - signIn', () => {
  let env;

  beforeEach(async () => {
    env = createSignInEnvironment();
    await env.Auth.init();
  });

  it('should create AuthenticationDetails and CognitoUser with correct params', async () => {
    const mockSession = { isValid: () => true };
    env.mocks.authenticateUser.mockImplementation((authDetails, callbacks) => {
      callbacks.onSuccess(mockSession);
    });
    env.mocks.getUserAttributes.mockImplementation((callback) => {
      callback(null, [
        { getName: () => 'email', getValue: () => 'test@example.com' },
        { getName: () => 'name', getValue: () => 'Test User' },
        { getName: () => 'email_verified', getValue: () => 'true' },
      ]);
    });

    await env.Auth.signIn('test@example.com', 'Password1!');

    expect(env.mocks.AuthenticationDetails).toHaveBeenCalledWith({
      Username: 'test@example.com',
      Password: 'Password1!',
    });
    expect(env.mocks.CognitoUser).toHaveBeenCalledWith({
      Username: 'test@example.com',
      Pool: expect.any(Object),
    });
  });

  it('should store session and update auth state on success', async () => {
    const mockSession = { isValid: () => true, getIdToken: () => ({ getJwtToken: () => 'id-token' }) };
    env.mocks.authenticateUser.mockImplementation((authDetails, callbacks) => {
      callbacks.onSuccess(mockSession);
    });
    env.mocks.getUserAttributes.mockImplementation((callback) => {
      callback(null, [
        { getName: () => 'email', getValue: () => 'test@example.com' },
        { getName: () => 'name', getValue: () => 'Test User' },
        { getName: () => 'email_verified', getValue: () => 'true' },
      ]);
    });

    const events = [];
    env.window.document.addEventListener('auth:stateChanged', (e) => events.push(e.detail));

    const result = await env.Auth.signIn('test@example.com', 'Password1!');

    expect(result).toBe(mockSession);
    expect(env.Auth.isAuthenticated()).toBe(true);
    expect(env.Auth.getCurrentUser()).toEqual({
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
    });
    expect(env.Auth.getSession()).toBe(mockSession);
    // auth:stateChanged should have been dispatched
    expect(events.length).toBeGreaterThanOrEqual(1);
    const lastEvent = events[events.length - 1];
    expect(lastEvent.state).toBe('authenticated');
    expect(lastEvent.user.email).toBe('test@example.com');
  });

  it('should set authenticated state with fallback user info when getUserAttributes fails', async () => {
    const mockSession = { isValid: () => true };
    env.mocks.authenticateUser.mockImplementation((authDetails, callbacks) => {
      callbacks.onSuccess(mockSession);
    });
    env.mocks.getUserAttributes.mockImplementation((callback) => {
      callback(new Error('Cannot get attributes'));
    });

    await env.Auth.signIn('test@example.com', 'Password1!');

    expect(env.Auth.isAuthenticated()).toBe(true);
    expect(env.Auth.getCurrentUser()).toEqual({
      email: 'test@example.com',
      name: '',
      emailVerified: false,
    });
  });

  it('should dispatch auth:error and reject on authentication failure', async () => {
    const mockError = { code: 'NotAuthorizedException', message: 'Incorrect username or password.' };
    env.mocks.authenticateUser.mockImplementation((authDetails, callbacks) => {
      callbacks.onFailure(mockError);
    });

    const events = [];
    env.window.document.addEventListener('auth:error', (e) => events.push(e.detail));

    await expect(env.Auth.signIn('test@example.com', 'wrong')).rejects.toEqual(mockError);
    expect(events).toHaveLength(1);
    expect(events[0].operation).toBe('signIn');
    expect(events[0].error).toBe(mockError);
  });

  it('should dispatch auth:verificationRequired when user is not confirmed', async () => {
    const mockError = { code: 'UserNotConfirmedException', message: 'User is not confirmed.' };
    env.mocks.authenticateUser.mockImplementation((authDetails, callbacks) => {
      callbacks.onFailure(mockError);
    });

    const verificationEvents = [];
    const errorEvents = [];
    env.window.document.addEventListener('auth:verificationRequired', (e) => verificationEvents.push(e.detail));
    env.window.document.addEventListener('auth:error', (e) => errorEvents.push(e.detail));

    await expect(env.Auth.signIn('test@example.com', 'Password1!')).rejects.toEqual(mockError);

    // Should dispatch both verificationRequired and error events
    expect(verificationEvents).toHaveLength(1);
    expect(verificationEvents[0].email).toBe('test@example.com');
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].operation).toBe('signIn');
  });

  it('should reject immediately if auth is disabled', async () => {
    const disabledEnv = createSignInEnvironment({ config: {} });
    await disabledEnv.Auth.init();

    await expect(disabledEnv.Auth.signIn('test@example.com', 'Pass1!')).rejects.toThrow('Auth is disabled');
  });
});


function createSignOutEnvironment(options = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    runScripts: 'dangerously',
  });

  const { window } = dom;

  // Mock fetch for config loading
  const mockConfig = options.config || { UserPoolId: 'us-east-1_TestPool', ClientId: 'testclientid123', Region: 'us-east-1' };
  window.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockConfig),
  });

  // Mock console
  window.console = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };

  // Mock authenticateUser and getUserAttributes for sign-in
  const mockAuthenticateUser = vi.fn();
  const mockGetUserAttributes = vi.fn();
  const mockSignOutFn = vi.fn();

  const mockCognitoUser = {
    authenticateUser: mockAuthenticateUser,
    getUserAttributes: mockGetUserAttributes,
    signOut: mockSignOutFn,
  };

  // getCurrentUser returns null initially (no existing session), then returns mockCognitoUser after sign-in
  const getCurrentUserFn = vi.fn().mockReturnValue(null);

  // Mock AmazonCognitoIdentity SDK
  window.AmazonCognitoIdentity = {
    CognitoUserPool: vi.fn().mockImplementation(() => ({
      signUp: vi.fn(),
      getCurrentUser: getCurrentUserFn,
    })),
    CognitoUser: vi.fn().mockImplementation(() => mockCognitoUser),
    CognitoUserAttribute: vi.fn().mockImplementation((data) => data),
    AuthenticationDetails: vi.fn().mockImplementation((data) => data),
  };

  // Execute auth.js in the JSDOM context
  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = authSource;
  window.document.body.appendChild(scriptEl);

  return {
    window,
    Auth: window.Auth,
    mocks: {
      authenticateUser: mockAuthenticateUser,
      getUserAttributes: mockGetUserAttributes,
      signOut: mockSignOutFn,
      CognitoUser: window.AmazonCognitoIdentity.CognitoUser,
      AuthenticationDetails: window.AmazonCognitoIdentity.AuthenticationDetails,
      CognitoUserPool: window.AmazonCognitoIdentity.CognitoUserPool,
      getCurrentUser: getCurrentUserFn,
    },
  };
}

describe('Auth module - signOut', () => {
  let env;

  beforeEach(async () => {
    env = createSignOutEnvironment();
    await env.Auth.init();

    // Sign in first to establish an authenticated session
    env.mocks.authenticateUser.mockImplementation((authDetails, callbacks) => {
      callbacks.onSuccess({ isValid: () => true, getIdToken: () => ({ getJwtToken: () => 'token' }) });
    });
    env.mocks.getUserAttributes.mockImplementation((callback) => {
      callback(null, [
        { getName: () => 'email', getValue: () => 'test@example.com' },
        { getName: () => 'name', getValue: () => 'Test User' },
        { getName: () => 'email_verified', getValue: () => 'true' },
      ]);
    });

    await env.Auth.signIn('test@example.com', 'Password1!');

    // After sign-in, getCurrentUser should return the cognito user (simulating SDK behavior)
    env.mocks.getCurrentUser.mockReturnValue({
      signOut: env.mocks.signOut,
    });
  });

  it('should call cognitoUser.signOut() on the current user from the pool', () => {
    env.Auth.signOut();
    expect(env.mocks.signOut).toHaveBeenCalled();
  });

  it('should clear currentUser to null after sign out', () => {
    expect(env.Auth.getCurrentUser()).not.toBeNull();
    env.Auth.signOut();
    expect(env.Auth.getCurrentUser()).toBeNull();
  });

  it('should clear session to null after sign out', () => {
    expect(env.Auth.getSession()).not.toBeNull();
    env.Auth.signOut();
    expect(env.Auth.getSession()).toBeNull();
  });

  it('should set isAuthenticated to false after sign out', () => {
    expect(env.Auth.isAuthenticated()).toBe(true);
    env.Auth.signOut();
    expect(env.Auth.isAuthenticated()).toBe(false);
  });

  it('should dispatch auth:stateChanged with unauthenticated state', () => {
    const events = [];
    env.window.document.addEventListener('auth:stateChanged', (e) => events.push(e.detail));

    env.Auth.signOut();

    expect(events).toHaveLength(1);
    expect(events[0].state).toBe('unauthenticated');
    expect(events[0].user).toBeNull();
  });

  it('should do nothing when auth is disabled', async () => {
    const disabledEnv = createSignOutEnvironment({ config: {} });
    await disabledEnv.Auth.init();

    const events = [];
    disabledEnv.window.document.addEventListener('auth:stateChanged', (e) => events.push(e.detail));

    // Should not throw and should not dispatch events
    disabledEnv.Auth.signOut();
    expect(events).toHaveLength(0);
  });

  it('should handle case when getCurrentUser returns null', async () => {
    // Create environment where getCurrentUser returns null
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      runScripts: 'dangerously',
    });
    const { window } = dom;
    const mockConfig = { UserPoolId: 'us-east-1_TestPool', ClientId: 'testclientid123', Region: 'us-east-1' };
    window.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockConfig) });
    window.console = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };

    window.AmazonCognitoIdentity = {
      CognitoUserPool: vi.fn().mockImplementation(() => ({
        signUp: vi.fn(),
        getCurrentUser: () => null,
      })),
      CognitoUser: vi.fn(),
      CognitoUserAttribute: vi.fn().mockImplementation((data) => data),
      AuthenticationDetails: vi.fn().mockImplementation((data) => data),
    };

    const scriptEl = window.document.createElement('script');
    scriptEl.textContent = authSource;
    window.document.body.appendChild(scriptEl);

    await window.Auth.init();

    const events = [];
    window.document.addEventListener('auth:stateChanged', (e) => events.push(e.detail));

    // Should not throw even when no current user
    window.Auth.signOut();
    expect(events).toHaveLength(1);
    expect(events[0].state).toBe('unauthenticated');
  });
});


function createPasswordResetEnvironment(options = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    runScripts: 'dangerously',
  });

  const { window } = dom;

  // Mock fetch for config loading
  const mockConfig = options.config || { UserPoolId: 'us-east-1_TestPool', ClientId: 'testclientid123', Region: 'us-east-1' };
  window.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockConfig),
  });

  // Mock console
  window.console = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };

  // Mock forgotPassword and confirmPassword on CognitoUser
  const mockForgotPassword = vi.fn();
  const mockConfirmPasswordFn = vi.fn();

  const mockCognitoUser = {
    forgotPassword: mockForgotPassword,
    confirmPassword: mockConfirmPasswordFn,
  };

  // Mock AmazonCognitoIdentity SDK
  window.AmazonCognitoIdentity = {
    CognitoUserPool: vi.fn().mockImplementation(() => ({
      signUp: vi.fn(),
      getCurrentUser: () => null,
    })),
    CognitoUser: vi.fn().mockImplementation(() => mockCognitoUser),
    CognitoUserAttribute: vi.fn().mockImplementation((data) => data),
  };

  // Execute auth.js in the JSDOM context
  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = authSource;
  window.document.body.appendChild(scriptEl);

  return {
    window,
    Auth: window.Auth,
    mocks: {
      forgotPassword: mockForgotPassword,
      confirmPassword: mockConfirmPasswordFn,
      CognitoUser: window.AmazonCognitoIdentity.CognitoUser,
    },
  };
}

describe('Auth module - forgotPassword', () => {
  let env;

  beforeEach(async () => {
    env = createPasswordResetEnvironment();
    await env.Auth.init();
  });

  it('should create a CognitoUser and call forgotPassword with callbacks', async () => {
    env.mocks.forgotPassword.mockImplementation((callbacks) => {
      callbacks.inputVerificationCode({ CodeDeliveryDetails: { Destination: 't***@example.com' } });
    });

    await env.Auth.forgotPassword('test@example.com');

    expect(env.mocks.CognitoUser).toHaveBeenCalledWith({
      Username: 'test@example.com',
      Pool: expect.any(Object),
    });
    expect(env.mocks.forgotPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onFailure: expect.any(Function),
        inputVerificationCode: expect.any(Function),
      })
    );
  });

  it('should resolve when inputVerificationCode is called (code sent successfully)', async () => {
    const mockData = { CodeDeliveryDetails: { Destination: 't***@example.com' } };
    env.mocks.forgotPassword.mockImplementation((callbacks) => {
      callbacks.inputVerificationCode(mockData);
    });

    const result = await env.Auth.forgotPassword('test@example.com');
    expect(result).toBe(mockData);
  });

  it('should resolve when onSuccess is called', async () => {
    const mockData = { success: true };
    env.mocks.forgotPassword.mockImplementation((callbacks) => {
      callbacks.onSuccess(mockData);
    });

    const result = await env.Auth.forgotPassword('test@example.com');
    expect(result).toBe(mockData);
  });

  it('should dispatch auth:error and reject on failure', async () => {
    const mockError = { code: 'UserNotFoundException', message: 'User not found' };
    env.mocks.forgotPassword.mockImplementation((callbacks) => {
      callbacks.onFailure(mockError);
    });

    const events = [];
    env.window.document.addEventListener('auth:error', (e) => events.push(e.detail));

    await expect(env.Auth.forgotPassword('unknown@example.com')).rejects.toEqual(mockError);
    expect(events).toHaveLength(1);
    expect(events[0].operation).toBe('forgotPassword');
    expect(events[0].error).toBe(mockError);
  });

  it('should reject immediately if auth is disabled', async () => {
    const disabledEnv = createPasswordResetEnvironment({ config: {} });
    await disabledEnv.Auth.init();

    await expect(disabledEnv.Auth.forgotPassword('test@example.com')).rejects.toThrow('Auth is disabled');
  });
});

describe('Auth module - confirmPassword', () => {
  let env;

  beforeEach(async () => {
    env = createPasswordResetEnvironment();
    await env.Auth.init();
  });

  it('should create a CognitoUser and call confirmPassword with code, newPassword, and callbacks', async () => {
    env.mocks.confirmPassword.mockImplementation((code, newPassword, callbacks) => {
      callbacks.onSuccess();
    });

    await env.Auth.confirmPassword('test@example.com', '123456', 'NewPassword1!');

    expect(env.mocks.CognitoUser).toHaveBeenCalledWith({
      Username: 'test@example.com',
      Pool: expect.any(Object),
    });
    expect(env.mocks.confirmPassword).toHaveBeenCalledWith(
      '123456',
      'NewPassword1!',
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onFailure: expect.any(Function),
      })
    );
  });

  it('should resolve on successful password confirmation', async () => {
    env.mocks.confirmPassword.mockImplementation((code, newPassword, callbacks) => {
      callbacks.onSuccess();
    });

    await expect(env.Auth.confirmPassword('test@example.com', '123456', 'NewPassword1!')).resolves.toBeUndefined();
  });

  it('should dispatch auth:error and reject on CodeMismatchException', async () => {
    const mockError = { code: 'CodeMismatchException', message: 'Invalid verification code.' };
    env.mocks.confirmPassword.mockImplementation((code, newPassword, callbacks) => {
      callbacks.onFailure(mockError);
    });

    const events = [];
    env.window.document.addEventListener('auth:error', (e) => events.push(e.detail));

    await expect(env.Auth.confirmPassword('test@example.com', 'wrong', 'NewPassword1!')).rejects.toEqual(mockError);
    expect(events).toHaveLength(1);
    expect(events[0].operation).toBe('confirmPassword');
    expect(events[0].error.code).toBe('CodeMismatchException');
  });

  it('should dispatch auth:error and reject on ExpiredCodeException', async () => {
    const mockError = { code: 'ExpiredCodeException', message: 'Code has expired.' };
    env.mocks.confirmPassword.mockImplementation((code, newPassword, callbacks) => {
      callbacks.onFailure(mockError);
    });

    const events = [];
    env.window.document.addEventListener('auth:error', (e) => events.push(e.detail));

    await expect(env.Auth.confirmPassword('test@example.com', '000000', 'NewPassword1!')).rejects.toEqual(mockError);
    expect(events).toHaveLength(1);
    expect(events[0].operation).toBe('confirmPassword');
    expect(events[0].error.code).toBe('ExpiredCodeException');
  });

  it('should reject immediately if auth is disabled', async () => {
    const disabledEnv = createPasswordResetEnvironment({ config: {} });
    await disabledEnv.Auth.init();

    await expect(disabledEnv.Auth.confirmPassword('test@example.com', '123456', 'NewPass1!')).rejects.toThrow('Auth is disabled');
  });
});
