import { z } from 'zod';
import { PaginationQuery, UuidSchema } from './common.schema';

export const FormSubmissionStatusSchema = z.enum([
    'new',
    'read',
    'replied',
    'contacted',
    'converted',
    'archived',
    'spam',
]);

export const ListFormSubmissionsQuery = PaginationQuery.extend({
    store_id: UuidSchema,
    type: z.enum(['all', 'contact', 'lead']).default('all'),
    status: z.enum(['all', 'new', 'read', 'replied', 'contacted', 'converted', 'archived', 'spam']).default('all'),
});

export const UpdateFormSubmissionSchema = z.object({
    status: FormSubmissionStatusSchema,
});

export type FormSubmissionStatus = z.infer<typeof FormSubmissionStatusSchema>;
