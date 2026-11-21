import assert from 'node:assert/strict';
import { test } from 'node:test';

import { runHook } from './helpers.mjs';

const call = (tool, mode = 'default') => runHook('auth0-read-only', { tool_name: tool, permission_mode: mode, tool_input: {} });

test('auth0-read-only: every tool that writes to the tenant is refused, in every mode', () => {
  for (const t of ['auth0_create_application', 'auth0_update_application', 'auth0_save_credentials_to_file',
    'auth0_create_resource_server', 'auth0_update_resource_server', 'auth0_create_application_grant',
    'auth0_create_action', 'auth0_update_action', 'auth0_deploy_action', 'auth0_create_form', 'auth0_update_form',
    'auth0_publish_form', 'auth0_onboarding', 'auth0_some_future_tool']) {
    for (const mode of ['default', 'bypassPermissions']) {
      const r = call(`mcp__auth0__${t}`, mode);
      assert.equal(r.status, 2, `${t} in ${mode}`);
      assert.match(r.stderr, /DENIED.*Terraform/s, t);
    }
  }
});

test('auth0-read-only: reading the tenant passes', () => {
  for (const t of ['auth0_list_applications', 'auth0_get_application', 'auth0_list_resource_servers',
    'auth0_get_resource_server', 'auth0_list_actions', 'auth0_get_action', 'auth0_list_logs', 'auth0_get_log',
    'auth0_list_forms', 'auth0_get_form', 'auth0_get_quickstart_guide']) {
    const r = call(`mcp__auth0__${t}`);
    assert.equal(r.status, 0, t);
    assert.equal(r.stdout + r.stderr, '', t);
  }
});

test("auth0-read-only: other servers' tools are not its business", () => {
  for (const t of ['mcp__infisical-docs__search_infisical', 'Bash', 'mcp__other__auth0_create_application']) {
    assert.equal(call(t).status, 0, t);
  }
});
