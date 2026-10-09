import { contract } from '#contract-runtime'; /* augur-inject:import:dc62138f */
import augurContract_8320d650 from '../contracts/health-response.contract.ts'; /* augur-inject:contract-predicate:51b2b5cd */
// Response of the stage-1 dev server: /health only (the Web editor arrives in stage 7).

export interface HealthResponse {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
}

const JSON_TYPE = 'application/json; charset=utf-8';

export function healthResponse(method: string | undefined, path: string | undefined): HealthResponse {
  const pathname = (path ?? '').split('?')[0];
  if (pathname !== '/health') return { status: 404, contentType: JSON_TYPE, body: JSON.stringify({ error: 'not_found' }) };
  if (method !== 'GET' && method !== 'HEAD') {
    return { status: 405, contentType: JSON_TYPE, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }
  return { status: 200, contentType: JSON_TYPE, body: JSON.stringify({ status: 'ok', service: 'commentarii' }) };
}
// @ts-expect-error augur-inject
healthResponse = contract(healthResponse, { ...augurContract_8320d650, contractId: 'C-7', mode: 'observe', sample: 1, where: 'src/health/health-response.ts:11', rule: 'contract-wrap', id: '8320d650' }); /* augur-inject:contract-wrap:8320d650 */
