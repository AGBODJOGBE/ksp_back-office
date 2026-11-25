'use client';

import { ConfirmAction } from '@/components/ui/confirm-action';
import { formatDateTime } from '@/lib/format';
import { attempt } from '@/features/cleaning/errors';
import { removeSessionPhoto } from '@/features/cleaning/programs-api';
import type { CleaningSession } from '@/features/cleaning/programs-schemas';
import { incidentCategory } from '@/features/cleaning/programs-texts';
import { sessionTexts } from '@/features/cleaning/session-texts';
import { Note, Panel } from './parts';
import { confirmLabels, ReasonField, reasonError, reasonOf, useKeyed } from './request-parts';
import type { SessionProps } from './session-detail';

const t = sessionTexts;

type Photo = CleaningSession['photos'][number];

/** Libellé lisible d'une photo : sa nature et son rang dans cette nature (« Avant 2 »). */
function photoLabels(photos: readonly Photo[]): Map<string, string> {
  const ranks = new Map<string, number>();
  return new Map(
    photos.map((photo) => {
      const rank = (ranks.get(photo.kind) ?? 0) + 1;
      ranks.set(photo.kind, rank);
      return [photo.fileId, t.openPhoto(t.photoKinds[photo.kind] ?? photo.kind, rank)];
    }),
  );
}

/** Retrait d'une photo, confirmé avec un motif ; une clé d'idempotence par photo. */
function RemovePhoto({
  session,
  fileId,
  label,
  onChange,
}: Pick<SessionProps, 'session' | 'onChange'> & { fileId: string; label: string }) {
  const keyed = useKeyed();
  return (
    <ConfirmAction
      label={t.removePhoto.open(label)}
      title={t.removePhoto.title}
      description={t.removePhoto.text}
      confirmLabel={t.removePhoto.confirm}
      labels={confirmLabels}
      danger
      onConfirm={async (data) => {
        const reason = reasonOf(data);
        const invalid = reasonError(reason);
        if (invalid) return invalid;
        return attempt(async () =>
          onChange(await keyed((key) => removeSessionPhoto(session.id, fileId, reason, key))),
        );
      }}
    >
      <ReasonField id={`photo-${fileId}-motif`} />
    </ConfirmAction>
  );
}

/** Photos de la séance (liens temporaires) ; retrait confirmé avec un motif (R-EX-10). */
export function SessionPhotos({ session, onChange, access }: SessionProps) {
  const canManage = access['cleaning.program.manage'];
  const labels = photoLabels(session.photos);
  return (
    <Panel title={t.photos} id="seance-photos">
      {session.photos.length ? (
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {session.photos.map((photo) => {
            const label = labels.get(photo.fileId) ?? photo.fileId;
            return (
              <li key={photo.fileId} className="flex flex-wrap items-center gap-2">
                {photo.url ? (
                  <a
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-ink inline-flex min-h-11 items-center font-semibold underline"
                  >
                    {label}
                  </a>
                ) : (
                  <span className="text-ink-muted">
                    {label} ({t.photoExpired})
                  </span>
                )}
                {canManage ? (
                  <RemovePhoto session={session} fileId={photo.fileId} label={label} onChange={onChange} />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <Note>{t.noPhoto}</Note>
      )}
      {canManage && session.photos.length ? <Note>{t.mfaHint}</Note> : null}
    </Panel>
  );
}

/** Liste de contrôle de la séance, cochée par l'équipe (heure réelle). */
export function SessionChecklist({ session }: { session: CleaningSession }) {
  return (
    <Panel title={t.checklist} id="seance-controle">
      {session.checklist.length ? (
        <ul className="grid gap-1">
          {session.checklist.map((item) => (
            <li key={`${item.cleaningTypeCode ?? ''}-${item.code}`}>
              <span className={item.checked ? 'text-ink' : 'text-ink-muted'}>{item.label}</span>
              <span className="text-small text-ink-muted">
                {' '}
                — {item.checked && item.checkedAt ? t.checked(formatDateTime(item.checkedAt)) : t.notChecked}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Note>{t.noChecklist}</Note>
      )}
    </Panel>
  );
}

/** Incidents signalés sur place et décision du superviseur. */
export function SessionIncidents({ session }: { session: CleaningSession }) {
  if (!session.incidents.length) return null;
  return (
    <Panel title={t.incidents} id="seance-incidents">
      <ul className="grid gap-3">
        {session.incidents.map((incident) => (
          <li key={incident.id} className="grid gap-0.5">
            <span className="text-ink font-semibold">
              {incidentCategory(incident.category)} — {formatDateTime(incident.reportedAt)}
            </span>
            <span>{incident.note}</span>
            <span className="text-small text-ink-muted">
              {t.incidentDecision[incident.decision] ?? incident.decision}
              {incident.decidedAt ? `, ${formatDateTime(incident.decidedAt)}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
