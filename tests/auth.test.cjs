const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);

function api(env, method = 'GET') {
  const context = { module: { exports: {} }, process: { env }, Buffer, URL };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'api/supabase-config.js'), 'utf8'), context);
  const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  context.module.exports({ method }, response);
  return response;
}

test('configuration returns public settings from Vercel integration names', () => {
  const res = api({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SERVICE_ROLE_KEY: 'must-not-leak' });
  assert.equal(res.code, 200);
  assert.equal(res.body.publishableKey, 'sb_publishable_test');
  assert.deepEqual(Object.keys(res.body).sort(), ['publishableKey', 'url']);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('configuration supports legacy anon keys and rejects secret/service role keys', () => {
  const jwt = role => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.signature';
  const base = { SUPABASE_URL: 'https://example.supabase.co' };
  assert.equal(api({ ...base, SUPABASE_ANON_KEY: jwt('anon') }).code, 200);
  for (const key of ['sb_secret_test', jwt('service_role'), 'bad-key']) {
    assert.equal(api({ ...base, SUPABASE_ANON_KEY: key }).code, 503);
  }
  assert.equal(api({}).code, 503);
  assert.equal(api({ ...base, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }, 'POST').code, 405);
});

function authHarness({ session = null, configOK = true } = {}) {
  const nodes = {};
  let authListener;
  const calls = [];
  function node(id) {
    return nodes[id] ||= { value: '', hidden: false, dataset: {}, events: {}, open: false,
      addEventListener(name, callback) { this.events[name] = callback; },
      setAttribute() {}, reportValidity() { return true; },
      showModal() { this.open = true; }, close() { this.open = false; this.events.close?.(); } };
  }
  const auth = {
    onAuthStateChange(callback) { authListener = callback; },
    async getSession() { return { data: { session }, error: null }; },
    async signInWithPassword(value) { calls.push(['login', value]); return auth.result; },
    async signUp(value) { calls.push(['signup', value]); return auth.result; },
    async signOut(value) { calls.push(['logout', value]); return auth.result; },
    result: { data: { session: null }, error: null }
  };
  vm.runInNewContext(scripts[0], {
    document: { querySelector: node },
    window: { location: { protocol: 'https:', origin: 'https://test.vercel.app' }, supabase: { createClient: () => ({ auth }) } },
    fetch: async () => ({ ok: configOK, json: async () => ({ url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' }) })
  });
  return { node, auth, calls, changeSession: session => authListener('SIGNED_IN', session) };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const submit = h => h.node('#auth-form').events.submit({ preventDefault() {} });

test('restores session, updates email on auth events and signs out', async () => {
  const h = authHarness({ session: { user: { email: 'saved@example.com' } } });
  await settle();
  assert.equal(h.node('#account-email').textContent, 'saved@example.com');
  assert.equal(h.node('#login-button').hidden, true);
  h.auth.result = { error: null };
  await h.node('#logout-button').events.click();
  assert.equal(h.node('#account-email').hidden, true);
  assert.equal(h.node('#login-button').hidden, false);
  assert.equal(h.calls[0][0], 'logout');
});

test('popup switches mode, submits signup and explains email confirmation', async () => {
  const h = authHarness();
  await settle();
  h.node('#login-button').events.click();
  assert.equal(h.node('#auth-dialog').open, true);
  h.node('#auth-toggle').events.click();
  assert.equal(h.node('#auth-title').textContent, '회원가입');
  assert.equal(h.node('#auth-password').autocomplete, 'new-password');
  h.node('#auth-email').value = 'new@example.com';
  h.node('#auth-password').value = 'test-password';
  await submit(h);
  assert.equal(h.calls[0][0], 'signup');
  assert.equal(h.calls[0][1].options.emailRedirectTo, 'https://test.vercel.app/');
  assert.match(h.node('#auth-message').textContent, /확인 링크/);
  assert.equal(h.node('#auth-password').value, '');
  assert.equal(h.node('#auth-submit').disabled, false);
});

test('successful login closes popup and shows email; duplicate submission is blocked', async () => {
  const h = authHarness();
  await settle();
  h.node('#login-button').events.click();
  h.node('#auth-email').value = 'login@example.com';
  h.node('#auth-password').value = 'test-password';
  h.auth.result = { data: { session: { user: { email: 'login@example.com' } } }, error: null };
  await Promise.all([submit(h), submit(h)]);
  assert.equal(h.calls.length, 1);
  assert.equal(h.node('#auth-dialog').open, false);
  assert.equal(h.node('#account-email').textContent, 'login@example.com');
  assert.equal(h.node('#logout-button').hidden, false);
});

test('wrong password and missing configuration show recoverable errors', async () => {
  const h = authHarness();
  await settle();
  h.node('#login-button').events.click();
  h.auth.result = { error: { code: 'invalid_credentials' } };
  await submit(h);
  assert.match(h.node('#auth-message').textContent, /이메일 또는 비밀번호/);
  assert.equal(h.node('#auth-dialog').open, true);
  const bad = authHarness({ configOK: false });
  await settle();
  assert.match(bad.node('#account-message').textContent, /연결 설정/);
});

test('all inline scripts parse; Supabase is loaded from CDN', () => {
  scripts.forEach(script => new vm.Script(script));
  assert.match(html, /https:\/\/cdn.jsdelivr.net\/npm\/@supabase\/supabase-js@2/);
});
