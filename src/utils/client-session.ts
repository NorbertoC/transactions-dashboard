export const SESSION_INVALIDATED = 'gastos:session-invalidated';
let sessionGeneration = 0;
let sessionScope: string | null = null;
export function getClientSessionGeneration() { return sessionGeneration; }
export function setClientSessionScope(scope: string | null) {
  if (scope !== sessionScope) { sessionScope = scope; sessionGeneration++; }
}

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function invalidateClientSession() {
  sessionGeneration++;
  window.dispatchEvent(new Event(SESSION_INVALIDATED));
}

export function checkSessionResponse(response: Response, generation = sessionGeneration) {
  if (response.status === 401 || response.status === 403) {
    if (generation === sessionGeneration) invalidateClientSession();
    throw new HttpError(response.status, `Session unavailable (${response.status})`);
  }
}
