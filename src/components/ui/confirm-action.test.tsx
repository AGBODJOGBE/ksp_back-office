import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConfirmAction } from './confirm-action';
import { isCurrentTab } from './sub-nav';

const labels = { cancel: 'Annuler', pending: 'Envoi…' };

describe('action confirmée dans une boîte de dialogue', () => {
  it('ne fait rien sans confirmation, transmet les champs et ferme après succès', async () => {
    const onConfirm = vi.fn(async (data: FormData) => (data.get('reason') ? null : 'Indiquez un motif.'));
    render(
      <ConfirmAction
        label="Annuler la mission"
        title="Annuler ?"
        confirmLabel="Confirmer"
        labels={labels}
        danger
        onConfirm={onConfirm}
      >
        <label>
          Motif
          <input name="reason" />
        </label>
      </ConfirmAction>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler la mission' }));
    const dialog = screen.getByRole('dialog', { name: 'Annuler ?' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Indiquez un motif.');

    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Client absent' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});

describe('onglets d’un module', () => {
  it('l’onglet racine n’est courant que sur sa propre adresse et ses fiches rattachées', () => {
    const root = { href: '/nettoyage', label: 'Demandes', match: ['/nettoyage/demandes'] };
    expect(isCurrentTab(root, '/nettoyage', true)).toBe(true);
    expect(isCurrentTab(root, '/nettoyage/demandes/42', true)).toBe(true);
    expect(isCurrentTab(root, '/nettoyage/missions', true)).toBe(false);
    expect(
      isCurrentTab({ href: '/nettoyage/missions', label: 'Missions' }, '/nettoyage/missions/1/passages/2'),
    ).toBe(true);
  });
});
