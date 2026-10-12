/** Sonde de santé pour Kubernetes (vivant / prêt). Ne dépend d'aucun service externe. */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok', site: 'backoffice' });
}
