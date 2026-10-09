import assert from 'node:assert/strict';
import { test } from 'node:test';
import { healthResponse } from '../../src/health/health-response.ts';

test('GET and HEAD /health answer ok', () => {
  for (const method of ['GET', 'HEAD']) {
    const response = healthResponse(method, '/health');
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.body), { status: 'ok', service: 'commentarii' });
  }
  assert.equal(healthResponse('GET', '/health?probe=1').status, 200);
});

test('other paths are 404 and other methods 405', () => {
  assert.equal(healthResponse('GET', '/').status, 404);
  assert.equal(healthResponse('GET', '/healthz').status, 404);
  assert.equal(healthResponse('POST', '/health').status, 405);
});
