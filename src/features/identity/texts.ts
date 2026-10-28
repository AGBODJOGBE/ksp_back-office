/** Textes de la connexion et de la session du back-office. */
export const identityTexts = {
  login: {
    eyebrow: 'Équipe KSP',
    title: 'Connexion au back-office',
    intro:
      'Réservé à l’équipe KSP. Vous recevez d’abord un code sur WhatsApp, puis vous confirmez avec votre application d’authentification.',
    checking: 'Vérification de votre session…',
    phoneLegend: 'Votre numéro de téléphone',
    countryCode: 'Indicatif',
    phoneNumber: 'Numéro',
    // Espaces insécables dans l'exemple : le numéro ne se coupe pas en fin de ligne.
    phoneHint: 'Le numéro de votre compte KSP. Exemple\u00a0: 01\u00a097\u00a000\u00a000\u00a045.',
    phoneInvalid: 'Numéro invalide\u00a0: vérifiez l’indicatif et le numéro.',
    sendCode: 'Recevoir mon code',
    sending: 'Envoi du code…',
    codeTitle: 'Saisissez votre code',
    codeSent: (channel: string, target: string) =>
      `Nous avons envoyé un code par ${channel === 'sms' ? 'SMS' : 'WhatsApp'} au ${target}.`,
    codeValidity: (minutes: number) => `Il est valable ${minutes} minute${minutes > 1 ? 's' : ''}.`,
    codeLabel: 'Code reçu',
    codeInvalid: 'Saisissez le code reçu, en chiffres.',
    verify: 'Valider',
    verifying: 'Vérification…',
    resend: 'Renvoyer le code',
    resendIn: (delay: string) => `Renvoyer le code dans ${delay}`,
    resent: 'Un nouveau code vous a été envoyé.',
    changeNumber: 'Modifier le numéro',
    attemptsRemaining: (count: number) =>
      count > 1 ? `Il vous reste ${count} essais.` : 'Il vous reste 1 essai.',
    retryIn: (delay: string) => `Nouvel essai possible dans ${delay}.`,
    delay: (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const rest = seconds % 60;
      if (minutes === 0) return `${rest} s`;
      return rest === 0 ? `${minutes} min` : `${minutes} min ${String(rest).padStart(2, '0')} s`;
    },
    sessionReady: 'Session ouverte\u00a0: redirection vers le back-office.',
    genericError: 'Une erreur est survenue. Réessayez dans quelques instants.',
    restart: 'Recommencer la connexion',
    reference: (id: string) => `Référence à donner au support\u00a0: ${id}`,
  },
  stepper: {
    label: 'Étapes de la connexion',
    phone: 'Téléphone',
    code: 'Code reçu',
    mfa: 'Double authentification',
    current: 'étape en cours',
    done: 'terminée',
  },
  enroll: {
    title: 'Configurez votre application d’authentification',
    intro:
      'Première connexion\u00a0: la double authentification est obligatoire pour le back-office. Utilisez une application comme Google Authenticator, Microsoft Authenticator ou 2FAS.',
    loading: 'Préparation de la configuration…',
    step1: 'Ouvrez l’application et ajoutez un compte.',
    step2: 'Scannez ce QR code avec le téléphone.',
    step3: 'Saisissez le code à 6 chiffres affiché par l’application.',
    qrLabel: (issuer: string, account: string) => `QR code de configuration pour ${issuer} (${account})`,
    qrUnavailable: 'Le QR code n’a pas pu être affiché\u00a0: saisissez la clé à la main.',
    manualTitle: 'Impossible de scanner\u00a0? Saisissez la clé à la main',
    manualIntro: (digits: number, period: number) =>
      `Type de compte\u00a0: basé sur l’heure (TOTP), ${digits} chiffres, toutes les ${period} secondes.`,
    issuer: 'Émetteur',
    account: 'Compte',
    secret: 'Clé',
    copySecret: 'Copier la clé',
    copied: 'Copié',
    codeLabel: 'Code de l’application',
    codeHint: '6 chiffres, renouvelés toutes les 30 secondes.',
    codeInvalid: 'Saisissez les 6 chiffres affichés par l’application.',
    submit: 'Activer la double authentification',
    submitting: 'Activation…',
  },
  recovery: {
    title: 'Vos codes de récupération',
    intro:
      'Si vous perdez votre téléphone, ces codes sont le seul moyen d’accéder au back-office. Chacun ne sert qu’une fois. Ils ne seront plus jamais affichés.',
    warning:
      'Ne quittez pas cette page avant de les avoir mis en lieu sûr (gestionnaire de mots de passe, papier rangé).',
    listLabel: 'Codes de récupération',
    copy: 'Copier les codes',
    copied: 'Codes copiés',
    copyFailed: 'Copie impossible\u00a0: sélectionnez les codes à la main ou téléchargez-les.',
    download: 'Télécharger (.txt)',
    fileName: 'ksp-back-office-codes-de-recuperation.txt',
    fileHeader: (account: string, date: string) => [
      'KSP Back-office — codes de récupération',
      `Compte : ${account}`,
      `Remis le : ${date}`,
      '',
      'Chaque code ne sert qu’une fois. Gardez ce fichier en lieu sûr.',
      '',
    ],
    confirm: 'J’ai mis mes codes en lieu sûr',
    confirmRequired: 'Cochez la case pour confirmer que vos codes sont en lieu sûr.',
    continue: 'Accéder au back-office',
  },
  mfa: {
    title: 'Double authentification',
    intro: 'Ouvrez votre application d’authentification et saisissez le code à 6 chiffres affiché pour KSP.',
    codeLabel: 'Code de l’application',
    codeInvalid: 'Saisissez les 6 chiffres affichés par l’application.',
    submit: 'Valider',
    submitting: 'Vérification…',
    useRecovery: 'Utiliser un code de récupération',
    useApp: 'Utiliser l’application d’authentification',
    recoveryTitle: 'Code de récupération',
    recoveryIntro: 'Saisissez l’un des codes remis lors de la configuration. Il ne pourra plus resservir.',
    recoveryLabel: 'Code de récupération',
    recoveryHint: 'Format\u00a0: XXXXX-XXXXX. Les tirets et les espaces sont ignorés.',
    recoveryInvalid: 'Saisissez un code de récupération complet (10 caractères).',
  },
  remaining: {
    title: 'Codes de récupération',
    used: 'Vous vous êtes connecté avec un code de récupération\u00a0: il ne pourra plus resservir.',
    count: (count: number) =>
      count === 0
        ? 'Il ne vous reste aucun code de récupération.'
        : `Il vous reste ${count} code${count > 1 ? 's' : ''} de récupération.`,
    advice: 'Si vous avez perdu votre téléphone, prévenez un administrateur du back-office dès maintenant.',
    continue: 'Continuer',
  },
  denied: {
    title: 'Accès au back-office refusé',
    advice:
      'Le back-office est réservé aux comptes de l’équipe KSP qui ont un rôle attribué. Si vous pensez que c’est une erreur, contactez un administrateur.',
    otherNumber: 'Utiliser un autre numéro',
  },
  guard: {
    loading: 'Vérification de votre session…',
    unavailable: 'Impossible de vérifier votre session.',
    redirecting: 'Redirection vers la connexion…',
    signingOut: 'Déconnexion…',
    expiredTitle: 'Votre session a pris fin',
    expiredText:
      'Une session du back-office dure 12 heures au plus et se ferme après 30 minutes sans activité. Reconnectez-vous pour continuer.',
    forbiddenTitle: 'Accès au back-office retiré',
    signIn: 'Se reconnecter',
  },
  account: {
    label: 'Mon compte',
    open: 'Ouvrir le menu du compte',
    unnamed: 'Agent KSP',
    phone: 'Téléphone',
    email: 'E-mail',
    emailMissing: 'Aucun e-mail vérifié',
    emailPending: (email: string) => `${email} (en attente de confirmation)`,
    sessionUntil: (time: string) => `Session ouverte jusqu’à ${time} au plus tard`,
    idle: 'Fermée après 30 minutes sans activité.',
    loading: 'Chargement du profil…',
    signOut: 'Se déconnecter',
    signingOut: 'Déconnexion…',
  },
} as const;
