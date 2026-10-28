/** Assemble des classes CSS en ignorant les valeurs vides. Les classes passées s'ajoutent, elles ne remplacent pas. */
export function cn(...classes: ReadonlyArray<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
