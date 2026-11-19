import assert from 'node:assert/strict';
import { test } from 'node:test';

import { asks, runHook } from './helpers.mjs';

const call = (tool, input = {}, mode = 'default') =>
  runHook('vercel-guard', { tool_name: `mcp__vercel__${tool}`, permission_mode: mode, tool_input: input });
const passes = (r) => r.status === 0 && r.stdout === '' && r.stderr === '';

test('vercel-guard: reading a secret value is refused, in every mode', () => {
  for (const t of ['get_project_env', 'get_shared_env_var', 'get_edge_config_token', 'get_edge_config_tokens',
    'create_edge_config_token', 'create_sdk_key', 'list_feature_flag_sdk_keys']) {
    for (const mode of ['default', 'bypassPermissions']) {
      const r = call(t, {}, mode);
      assert.equal(r.status, 2, `${t} in ${mode}`);
      assert.match(r.stderr, /DENIED.*secret/s, t);
    }
  }
  for (const decrypt of ['true', true]) {
    assert.equal(call('filter_project_envs', { idOrName: 'web', decrypt }).status, 2, `decrypt ${decrypt}`);
  }
});

test('vercel-guard: buying something is refused, in every mode', () => {
  for (const t of ['buy_domain', 'buy_domains', 'buy_single_domain', 'create_or_transfer_domain']) {
    for (const mode of ['default', 'bypassPermissions']) {
      const r = call(t, {}, mode);
      assert.equal(r.status, 2, `${t} in ${mode}`);
      assert.match(r.stderr, /DENIED.*(money|pays)/s, t);
    }
  }
});

test('vercel-guard: reading projects, deployments, logs and analytics passes', () => {
  for (const t of ['list_teams', 'list_projects', 'get_project', 'list_deployments', 'get_deployment',
    'get_deployment_build_logs', 'get_runtime_logs', 'get_runtime_errors', 'web_fetch_vercel_url',
    'search_vercel_documentation', 'read_access_group', 'count_pageviews', 'aggregate_events',
    'check_domain_availability_and_price', 'get_purchase_quote', 'ui_get_build_log_excerpt', 'open_deployments',
    'create_observability_query', 'create_trace_session']) {
    assert.ok(passes(call(t)), t);
  }
  // Claude Code's own sign-in tools for a server that needs OAuth: the user approves in the browser.
  for (const t of ['authenticate', 'complete_authentication']) assert.ok(passes(call(t, {}, 'auto')), t);
  assert.ok(passes(call('filter_project_envs', { idOrName: 'web' })), 'envs without decrypt');
  assert.ok(passes(call('filter_project_envs', { idOrName: 'web', decrypt: 'false' })), 'decrypt false');
});

test('vercel-guard: every other tool asks first, and refuses where a prompt is not guaranteed', () => {
  for (const t of ['deploy_to_vercel', 'create_deployment', 'cancel_deployment', 'request_promote', 'request_rollback',
    'create_project_env', 'edit_project_env', 'update_record', 'replace_domain_dns_records', 'update_firewall_config',
    'pause_project', 'update_project', 'get_access_to_vercel_url', 'submit_feedback', 'run_session_command',
    'some_future_tool']) {
    assert.ok(asks(call(t)), t);
    const r = call(t, {}, 'auto');
    assert.equal(r.status, 2, `${t} in auto`);
  }
});

test("vercel-guard: other servers' tools are not its business", () => {
  for (const t of ['mcp__auth0__auth0_list_logs', 'Bash', 'mcp__other__get_project_env']) {
    assert.equal(runHook('vercel-guard', { tool_name: t, permission_mode: 'default', tool_input: {} }).status, 0, t);
  }
});
