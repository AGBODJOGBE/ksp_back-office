'use client';

import { type ComponentProps, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm-action';
import { FormMessage, TextField } from '@/components/ui/field';
import { correctLocation } from '@/features/cleaning/api';
import { errorStatus, errorText } from '@/features/cleaning/errors';
import { locationTexts as t } from '@/features/cleaning/location-texts';
import type { GeoLocation, LocationCorrection } from '@/features/cleaning/schemas';
import { cleaningTexts } from '@/features/cleaning/texts';
import { type LocationField, readLocationInput } from '@/features/cleaning/workflow';

const common = cleaningTexts.common;

type Values = Record<LocationField, string>;

const fromLocation = (location: GeoLocation | null): Values => ({
  latitude: location ? String(location.latitude) : '',
  longitude: location ? String(location.longitude) : '',
  accuracyMeters: location?.accuracyMeters != null ? String(location.accuracyMeters) : '',
  landmark: '',
  commune: '',
});

type DeviceState = { tone: 'info' | 'success'; text: string } | null;

/**
 * « Corriger la position » (`PUT /admin/cleaning/quote-requests/{id}/location`, ADR-035) : position du
 * téléphone par l'API de géolocalisation du navigateur (agent sur place), ou saisie à la main (superviseur).
 * La position est affichée en texte seulement, sans carte ni lien externe. Route sans clé d'idempotence :
 * bouton désactivé pendant l'envoi ; après une coupure réseau, `onReread` relit la fiche.
 */
export function LocationAction({
  requestId,
  location,
  onDone,
  onReread,
  rereadNote,
  accessibleLabel,
}: {
  requestId: string;
  location: GeoLocation | null;
  onDone: (correction: LocationCorrection) => void;
  onReread?: () => void;
  rereadNote?: string;
  accessibleLabel?: string;
}) {
  const [values, setValues] = useState<Values>(() => fromLocation(location));
  const [invalid, setInvalid] = useState<LocationField | null>(null);
  const [device, setDevice] = useState<DeviceState>(null);
  const [locating, setLocating] = useState(false);
  const id = `position-${requestId}`;

  const set = (field: LocationField, value: string) => setValues((all) => ({ ...all, [field]: value }));

  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDevice({ tone: 'info', text: t.deviceUnavailable });
      return;
    }
    setLocating(true);
    setDevice({ tone: 'info', text: t.locating });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const accuracy = String(Math.round(coords.accuracy));
        setValues((all) => ({
          ...all,
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
          accuracyMeters: accuracy,
        }));
        setInvalid(null);
        setDevice({ tone: 'success', text: t.deviceFound(accuracy) });
      },
      (failure) => {
        setLocating(false);
        setDevice({
          tone: 'info',
          text: failure.code === failure.PERMISSION_DENIED ? t.deviceDenied : t.deviceFailed,
        });
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  const field = (
    name: LocationField,
    label: string,
    hint: string,
    extra: Partial<ComponentProps<'input'>> = {},
  ) => (
    <TextField
      id={`${id}-${name}`}
      name={name}
      label={label}
      hint={hint}
      value={values[name]}
      error={invalid === name ? t.invalid[name] : null}
      onChange={(event) => set(name, event.target.value)}
      {...extra}
    />
  );

  return (
    <ConfirmAction
      label={t.label}
      accessibleLabel={accessibleLabel}
      title={t.title}
      description={t.text}
      confirmLabel={t.confirm}
      labels={{ cancel: common.cancel, pending: common.sending }}
      onOpen={() => {
        setValues(fromLocation(location));
        setInvalid(null);
        setDevice(null);
      }}
      onConfirm={async () => {
        const read = readLocationInput(values);
        if (!read.ok) {
          setInvalid(read.field);
          return t.invalid[read.field];
        }
        setInvalid(null);
        try {
          onDone(await correctLocation(requestId, read.input));
          return null;
        } catch (error) {
          if (errorStatus(error) === 0 && onReread) {
            onReread();
            return `${errorText(error)} ${rereadNote ?? ''}`.trim();
          }
          return errorText(error);
        }
      }}
    >
      <div className="grid gap-3">
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={locate}
          disabled={locating}
          aria-busy={locating || undefined}
        >
          {locating ? t.locating : t.useDevice}
        </Button>
        <p className="text-small text-ink-muted">{t.deviceHint}</p>
        <FormMessage tone={device?.tone === 'success' ? 'success' : 'info'}>{device?.text}</FormMessage>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('latitude', t.latitude, t.latitudeHint, { inputMode: 'decimal', required: true })}
        {field('longitude', t.longitude, t.longitudeHint, { inputMode: 'decimal', required: true })}
      </div>
      {field('accuracyMeters', t.accuracy, t.accuracyHint, { inputMode: 'decimal' })}
      {field('landmark', t.landmark, t.landmarkHint, { maxLength: 500 })}
      {field('commune', t.commune, t.communeHint, { maxLength: 100 })}
    </ConfirmAction>
  );
}
