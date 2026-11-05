/** Textes de la boîte « Corriger la position » (ADR-035). Chargés avec la boîte. */

export const locationTexts = {
  label: 'Corriger la position',
  title: 'Corriger la position du lieu',
  text: 'La commune est recalculée à partir de la position et doit être desservie. La correction s’applique à toutes les demandes du groupe et aux missions non terminées ; les devis déjà envoyés ne changent pas.',
  useDevice: 'Utiliser ma position actuelle',
  locating: 'Recherche de la position…',
  deviceHint: 'Sur place : le téléphone donne la position et sa précision. Sinon, saisissez-les à la main.',
  deviceUnavailable: 'Ce navigateur ne donne pas de position : saisissez-la à la main.',
  deviceDenied: 'Accès à la position refusé : autorisez-le dans le navigateur, ou saisissez-la à la main.',
  deviceFailed: 'Position introuvable pour l’instant : réessayez à découvert, ou saisissez-la à la main.',
  deviceFound: (accuracy: string) => `Position du téléphone reprise (précision ± ${accuracy} m).`,
  latitude: 'Latitude',
  latitudeHint: 'Degrés décimaux, de −90 à 90 (par exemple 6,3703).',
  longitude: 'Longitude',
  longitudeHint: 'Degrés décimaux, de −180 à 180 (par exemple 2,3912).',
  accuracy: 'Précision (mètres)',
  accuracyHint: 'Facultative, de 0 à 100 000.',
  landmark: 'Repère',
  landmarkHint: 'Facultatif, 500 caractères au plus. Laissez vide pour garder le repère actuel.',
  commune: 'Commune (repli)',
  communeHint: 'Facultative, 100 caractères au plus : utilisée seulement si la position ne suffit pas.',
  invalid: {
    latitude: 'Saisissez une latitude entre −90 et 90.',
    longitude: 'Saisissez une longitude entre −180 et 180.',
    accuracyMeters: 'Saisissez une précision entre 0 et 100 000 mètres.',
    landmark: 'Le repère fait 500 caractères au plus.',
    commune: 'La commune fait 100 caractères au plus.',
  },
  confirm: 'Enregistrer la position',
  done: (requests: number, missions: number) =>
    `Position enregistrée : ${requests} demande${requests > 1 ? 's' : ''} et ${missions} mission${
      missions > 1 ? 's' : ''
    } mise${requests + missions > 1 ? 's' : ''} à jour.`,
} as const;
