import * as z from 'zod/mini';

/*
 * Comptes entreprise lus par le back-office (contrat `ksp-api.v1.yaml`, routes
 * `/api/v1/admin/identity/organizations*`, ADR-027), champ par champ. Les énumérations restent des
 * chaînes : un nouvel état s'affiche avec un libellé neutre. Schémas lus dans le navigateur : `zod/mini`.
 */

/** `AdminOrganization` : fiche et décisions du back-office. */
export const adminOrganizationSchema = z.object({
  id: z.string(),
  legalName: z.string(),
  address: z.string(),
  ifu: z.string(),
  rccm: z.nullable(z.string()),
  billingEmail: z.nullable(z.string()),
  status: z.string(),
  rejectionReason: z.nullable(z.string()),
  suspensionReason: z.nullable(z.string()),
  createdAt: z.string(),
  reviewedAt: z.nullable(z.string()),
  /** Compte qui a demandé la création. */
  createdBy: z.string(),
  reviewedBy: z.nullable(z.string()),
  suspendedAt: z.nullable(z.string()),
});

export const adminOrganizationListSchema = z.object({
  data: z.array(adminOrganizationSchema),
  nextCursor: z.nullable(z.string()),
});

/** `OrganizationMember` : coordonnées pour joindre le demandeur. */
export const organizationMemberSchema = z.object({
  userId: z.string(),
  role: z.string(),
  firstName: z.nullable(z.string()),
  lastName: z.nullable(z.string()),
  phone: z.nullable(z.string()),
  joinedAt: z.string(),
});

export const adminOrganizationDetailSchema = z.object({
  organization: adminOrganizationSchema,
  members: z.array(organizationMemberSchema),
});

export type AdminOrganization = z.infer<typeof adminOrganizationSchema>;
export type AdminOrganizationList = z.infer<typeof adminOrganizationListSchema>;
export type AdminOrganizationDetail = z.infer<typeof adminOrganizationDetailSchema>;
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
