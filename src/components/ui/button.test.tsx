import { render, screen } from '@testing-library/react';
import { Button, ButtonLink } from './button';

describe('boutons', () => {
  it('ne soumet pas de formulaire par défaut', () => {
    render(<Button>Valider</Button>);
    expect(screen.getByRole('button', { name: 'Valider' })).toHaveAttribute('type', 'button');
  });

  it('applique la variante et garde les classes ajoutées', () => {
    render(
      <Button variant="accent" className="mt-4">
        Demander un devis
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Demander un devis' });
    expect(button).toHaveClass('bg-accent', 'text-on-accent', 'min-h-11', 'mt-4');
  });

  it('rend un lien qui a l’apparence d’un bouton', () => {
    render(
      <ButtonLink href="/mon-espace" variant="secondary" size="lg">
        Mon espace KSP
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: 'Mon espace KSP' });
    expect(link).toHaveAttribute('href', '/mon-espace');
    expect(link).toHaveClass('min-h-13', 'border-line-strong');
  });
});
