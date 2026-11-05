import { render, screen, within } from '@testing-library/react';
import { LogoMark } from './logo';
import { SignatureProgress } from './signature';

const STEPS = [{ label: 'Votre demande' }, { label: 'Visite des lieux' }, { label: 'Devis' }];

describe('logo', () => {
  it('est fait de tracés vectoriels, sans texte dépendant d’une police', () => {
    const { container } = render(<LogoMark title="Groupe KSP" />);
    const logo = screen.getByRole('img', { name: 'Groupe KSP' });
    expect(logo.tagName.toLowerCase()).toBe('svg');
    expect(container.querySelector('text')).toBeNull();
    expect(container.querySelectorAll('path').length).toBeGreaterThanOrEqual(4);
  });

  it('est décoratif sans titre', () => {
    const { container } = render(<LogoMark variant="horizontal" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('fil de progression (signature)', () => {
  it('annonce chaque étape et marque l’étape en cours', () => {
    render(<SignatureProgress steps={STEPS} current={1} label="Avancement de la demande" />);
    const list = screen.getByRole('list', { name: 'Avancement de la demande' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Votre demande (terminée)');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[1]).toHaveTextContent('Visite des lieux (en cours)');
    expect(items[2]).toHaveTextContent('Devis (à venir)');
  });

  it('montre un parcours arrêté sans flèche vers la suite', () => {
    render(<SignatureProgress steps={STEPS} current={2} stopped label="Avancement" />);
    expect(screen.getByRole('list', { name: 'Avancement' }).lastElementChild).toHaveTextContent(
      'Devis (arrêtée)',
    );
  });
});
