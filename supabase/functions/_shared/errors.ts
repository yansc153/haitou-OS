/**
 * Business Error Codes
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § Error Handling
 */

export const ERRORS = {
  // Auth
  AUTH_REQUIRED: { status: 401, code: 'AUTH_REQUIRED', message: 'Authentication required' },

  // Team
  TEAM_ALREADY_ACTIVE: { status: 409, code: 'TEAM_ALREADY_ACTIVE', message: 'Team is already active' },
  TEAM_ALREADY_PAUSED: { status: 409, code: 'TEAM_ALREADY_PAUSED', message: 'Team is already paused' },
  TEAM_NOT_READY: { status: 422, code: 'TEAM_NOT_READY', message: 'Team does not meet readiness requirements' },

  // Onboarding
  RESUME_MISSING: { status: 422, code: 'RESUME_MISSING', message: 'Resume has not been uploaded' },
  ONBOARDING_INCOMPLETE: { status: 422, code: 'ONBOARDING_INCOMPLETE', message: 'Onboarding is not complete' },

  // Platform
  PLATFORM_AUTH_REQUIRED: { status: 401, code: 'PLATFORM_AUTH_REQUIRED', message: 'Platform authentication required' },

  // Generic
  NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: 'Resource not found' },
  BAD_REQUEST: { status: 400, code: 'BAD_REQUEST', message: 'Invalid request' },
  INTERNAL_ERROR: { status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' },
} as const;
