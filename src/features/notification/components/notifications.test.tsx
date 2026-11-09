import { fireEvent, render, screen, within } from '@testing-library/react';
import { session } from '@/lib/api';
import { errorBody, stubGateway } from '@/lib/api/gateway.test-utils';
import { sessionBody } from '@/lib/api/session.test-utils';
import { DeliveriesList } from './deliveries-list';
import { DeliveryDetail } from './delivery-detail';
import { TemplatesList } from './templates-list';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/notifications/envois',
  useSearchParams: () => new URLSearchParams(search),
}));

const DELIVERIES = '/api/v1/admin/notification/deliveries';
const TEMPLATES = '/api/v1/admin/notification/templates';
const ID = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d6101';
const USER = '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d9e11';

function delivery(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    templateCode: 'cleaning.quote_requested.customer',
    requestedChannel: 'whatsapp',
    channelUsed: null,
    channelsTried: ['whatsapp', 'email'],
    targetMasked: '+229********45',
    recipientUserId: USER,
    status: 'failed',
    errorCode: 'NOTIFICATION_CHANNELS_EXHAUSTED',
    failureReason: 'provider_unavailable',
    providerMessageId: null,
    createdAt: '2026-11-05T09:30:00Z',
    expiresAt: null,
    acceptedAt: null,
    failedAt: '2026-11-05T09:30:02Z',
    erased: false,
    ...overrides,
  };
}

const templates = {
  data: [
    {
      code: 'billing.invoice_issued.customer',
      kind: 'document',
      channels: ['whatsapp', 'email'],
      secret: false,
      optional: true,
      variables: ['first_name', 'invoice_number'],
      optionalVariables: [],
      subject: 'Votre facture {invoice_number}',
      text: 'Bonjour {first_name},\nVotre facture {invoice_number} est disponible.',
    },
    {
      code: 'identity.otp',
      kind: 'direct',
      channels: ['whatsapp', 'sms'],
      secret: true,
      optional: false,
      variables: ['code', 'expires_in_minutes'],
      optionalVariables: [],
      subject: null,
      text: null,
    },
  ],
};

beforeEach(() => {
  search = '';
  replace.mockReset();
  session.set(sessionBody(['support_agent']));
});
afterEach(() => vi.unstubAllGlobals());

describe('historique des envois', () => {
  it('liste les envois, destinataire masqué, compte supprimé signalé', async () => {
    const { calls } = stubGateway({
      [`GET ${DELIVERIES}`]: {
        status: 200,
        body: {
          data: [
            delivery(),
            delivery({
              id: '0192f1c4-7a2b-7c3d-8e4f-5a6b7c8d6102',
              templateCode: 'billing.invoice_issued.customer',
              status: 'accepted',
              channelUsed: 'email',
              targetMasked: null,
              recipientUserId: null,
              erased: true,
            }),
          ],
          nextCursor: null,
        },
      },
      [`GET ${TEMPLATES}`]: { status: 200, body: templates },
    });
    render(<DeliveriesList />);
    const link = await screen.findByRole('link', { name: 'cleaning.quote_requested.customer' });
    expect(link).toHaveAttribute('href', `/notifications/envois/${ID}`);
    expect(screen.getAllByText('+229********45').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Compte supprimé').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Essayés : WhatsApp, E-mail').length).toBeGreaterThan(0);
    expect(calls.find((call) => call.path === DELIVERIES)!.search).toBe('?limit=25');
  });

  it('filtres lus dans l’adresse et transmis ; identifiant de compte vérifié avant la recherche', async () => {
    search = 'canal=email&etat=failed&du=2026-11-01&au=2026-11-30&destinataire=pas-un-uuid';
    const { calls } = stubGateway({
      [`GET ${DELIVERIES}`]: { status: 200, body: { data: [], nextCursor: null } },
      [`GET ${TEMPLATES}`]: { status: 200, body: templates },
    });
    render(<DeliveriesList />);
    expect(await screen.findByText('Aucun envoi ne correspond à ces filtres.')).toBeInTheDocument();
    const query = new URLSearchParams(calls.find((call) => call.path === DELIVERIES)!.search);
    expect(Object.fromEntries(query)).toEqual({
      limit: '25',
      channel: 'email',
      status: 'failed',
      from: '2026-11-01',
      to: '2026-11-30',
    });

    fireEvent.change(screen.getByLabelText('Compte destinataire'), { target: { value: '+22997000045' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(await screen.findByText('Identifiant de compte attendu (UUID).')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Compte destinataire'), { target: { value: USER } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(replace.mock.calls[0]![0]).toContain(`destinataire=${USER}`);
  });

  it('détail : canaux essayés dans l’ordre, cause d’échec, lien vers les envois du compte', async () => {
    stubGateway({ [`GET ${DELIVERIES}/${ID}`]: { status: 200, body: delivery() } });
    render(<DeliveryDetail id={ID} />);
    const attempts = await screen.findByRole('region', { name: 'Canaux essayés' });
    expect(
      within(attempts)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['1.WhatsApp', '2.E-mail']);
    expect(within(attempts).getByText(/prestataire indisponible/)).toBeInTheDocument();
    expect(within(attempts).getByText('NOTIFICATION_CHANNELS_EXHAUSTED')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: USER })).toHaveAttribute(
      'href',
      `/notifications/envois?destinataire=${USER}`,
    );
  });

  it('détail introuvable : message sans « Réessayer »', async () => {
    stubGateway({
      [`GET ${DELIVERIES}/${ID}`]: { status: 404, body: errorBody('NOTIFICATION_NOT_FOUND', 'Introuvable.') },
    });
    render(<DeliveryDetail id={ID} />);
    expect(await screen.findByText('Cet envoi est introuvable.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });
});

describe('modèles de messages', () => {
  it('texte avec les variables, modèle rédigé chez le prestataire, recherche', async () => {
    stubGateway({ [`GET ${TEMPLATES}`]: { status: 200, body: templates } });
    render(<TemplatesList />);
    const invoice = await screen.findByRole('listitem', { name: 'billing.invoice_issued.customer' });
    expect(within(invoice).getByText('Votre facture {invoice_number}')).toBeInTheDocument();
    expect(within(invoice).getByText('Soumis aux préférences du client')).toBeInTheDocument();
    const otp = screen.getByRole('listitem', { name: 'identity.otp' });
    expect(within(otp).getByText(/rédigé chez le prestataire/)).toBeInTheDocument();
    expect(within(otp).getByText('Secret')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rechercher un modèle'), { target: { value: 'otp' } });
    expect(screen.getByText('1 modèle')).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'billing.invoice_issued.customer' })).toBeNull();
  });
});
