import { corsHeaders } from './cors.ts';

type ApiResponse<T> = {
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  meta?: Record<string, unknown>;
};

export function ok<T>(data: T, meta?: Record<string, unknown>): Response {
  const body: ApiResponse<T> = { data, error: null, meta };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function created<T>(data: T): Response {
  const body: ApiResponse<T> = { data, error: null };
  return new Response(JSON.stringify(body), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function err(status: number, code: string, message: string, details?: unknown): Response {
  const body: ApiResponse<null> = {
    data: null,
    error: { code, message, details },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
