import { ApiError } from '@/lib/api';
import { errorText } from './errors';
import { groupTexts } from './group-texts';
import type { QuoteRequest, SkippedRequest } from './schemas';

/** Nom affiché d'une demande du groupe : sa prestation, sinon son code. */
export function serviceLabel(request: Pick<QuoteRequest, 'serviceName' | 'serviceCode'>): string {
  return request.serviceName?.trim() || request.serviceCode;
}

function requestName(requestId: string, requests: readonly QuoteRequest[]): string {
  const request = requests.find((item) => item.id === requestId);
  return request ? serviceLabel(request) : requestId;
}

/**
 * Message d'une opération de groupe refusée. Les devis groupés sont « tout ou rien » : l'erreur porte
 * `details.requestId`, la demande en cause, nommée par sa prestation devant le message de la gateway.
 */
export function groupErrorText(error: unknown, requests: readonly QuoteRequest[]): string {
  const message = errorText(error);
  if (!(error instanceof ApiError)) return message;
  const requestId = error.details.requestId;
  return typeof requestId === 'string' && requestId
    ? groupTexts.requestError(requestName(requestId, requests), message)
    : message;
}

/** Demandes laissées de côté par une opération de groupe, en clair : « Nettoyage de vitres : déjà visitée ». */
export function skippedLines(
  skipped: readonly SkippedRequest[],
  requests: readonly QuoteRequest[],
): string[] {
  return skipped.map((item) =>
    groupTexts.outcome.skipped(
      requestName(item.requestId, requests),
      groupTexts.skippedReasons[item.reason] ?? item.reason,
    ),
  );
}
