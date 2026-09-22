import { ApiError } from '@/services/http';

export function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'validation' || error.kind === 'auth') {
      return error.message;
    }

    if (error.kind === 'network') {
      return 'Não foi possível conectar. Verifique sua internet e tente novamente.';
    }

    if (error.kind === 'config' && __DEV__) {
      return error.message;
    }
  }

  return 'Algo deu errado. Tente novamente em instantes.';
}

export function fieldErrorsFor(error: unknown): Record<string, string> {
  if (error instanceof ApiError && error.fieldErrors) {
    return error.fieldErrors;
  }

  return {};
}
