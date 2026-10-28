import '@testing-library/jest-dom/vitest';

/*
 * jsdom connaît <dialog> mais pas encore son ouverture modale : ouverture et fermeture minimales pour
 * les tests (le navigateur fournit le reste : focus piégé, Échap, fond inerte).
 */
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
