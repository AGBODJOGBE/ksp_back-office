import { render, screen } from '@testing-library/react';
import { session } from '@/lib/api/session';
import { sessionBody } from '@/lib/api/session.test-utils';
import { ModuleGate } from './module-gate';

beforeEach(() => session.clear());

const gate = () =>
  render(
    <ModuleGate slug="finance" label="Finance">
      <p>Contenu du module</p>
    </ModuleGate>,
  );

describe('accès à la page d’un module', () => {
  it('affiche le module ouvert aux rôles de la session', () => {
    session.set(sessionBody(['finance_officer']));
    gate();
    expect(screen.getByText('Contenu du module')).toBeInTheDocument();
  });

  it('explique qu’un module hors des rôles de l’agent n’est pas ouvert', () => {
    session.set(sessionBody(['recovery_agent']));
    gate();
    expect(screen.queryByText('Contenu du module')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Finance : module non ouvert à vos rôles',
    );
    expect(screen.getByRole('link', { name: 'Retour au tableau de bord' })).toHaveAttribute('href', '/');
  });

  it('ne montre rien tant que la session n’est pas reprise', () => {
    const { container } = gate();
    expect(container).toBeEmptyDOMElement();
  });
});
