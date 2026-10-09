// C-7 healthResponse(method, path): 200 for GET/HEAD /health, 405 other methods, 404 elsewhere.

import type { HealthResponse } from '../health/health-response.ts';

export default {
  post: (response: HealthResponse, method: string | undefined, path: string | undefined) => {
    const pathname = (path ?? '').split('?')[0];
    if (pathname !== '/health') return response.status === 404 || 'non-health path did not return 404';
    if (method !== 'GET' && method !== 'HEAD') return response.status === 405 || 'other method did not return 405';
    if (response.status !== 200) return 'health did not return 200';
    const body = JSON.parse(response.body) as { status?: unknown; service?: unknown };
    return (body.status === 'ok' && body.service === 'commentarii') || 'health body is wrong';
  },
};
