import { z } from 'zod';
import { PaginationQuery, SlugSchema, UuidSchema } from '@letbuyy/shared-types';

export const PageStatusSchema = z.enum(['draft', 'published', 'archived']);

export const ListPagesQuery = PaginationQuery.extend({
  store_id: UuidSchema,
  status: z.enum(['all', 'draft', 'published', 'archived']).default('all'),
});

export const CreatePageSchema = z.object({
  store_id: UuidSchema,
  title: z.string().min(1).max(200).trim(),
  slug: SlugSchema.optional(),
  body: z.string().max(200000).default(''),
  page_type: z.string().min(1).max(50).default('custom'),
  status: PageStatusSchema.default('draft'),
  show_in_nav: z.boolean().default(false),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  display_order: z.number().int().min(0).default(0),
});

export const UpdatePageSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  slug: SlugSchema.optional(),
  body: z.string().max(200000).optional(),
  page_type: z.string().min(1).max(50).optional(),
  status: PageStatusSchema.optional(),
  show_in_nav: z.boolean().optional(),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
  display_order: z.number().int().min(0).optional(),
});

export const PolicyTypeSchema = z.enum(['privacy', 'refund', 'shipping', 'terms', 'contact', 'custom']);

export const ListPoliciesQuery = z.object({
  store_id: UuidSchema,
  status: z.enum(['all', 'draft', 'published', 'archived']).default('all'),
});

export const CreatePolicySchema = z.object({
  store_id: UuidSchema,
  policy_type: PolicyTypeSchema,
  slug: SlugSchema.optional(),
  title: z.string().min(1).max(200).trim(),
  body: z.string().max(200000).default(''),
  status: PageStatusSchema.default('draft'),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
});

export const UpdatePolicySchema = z.object({
  policy_type: PolicyTypeSchema.optional(),
  slug: SlugSchema.optional(),
  title: z.string().min(1).max(200).trim().optional(),
  body: z.string().max(200000).optional(),
  status: PageStatusSchema.optional(),
  seo_title: z.string().max(70).optional().nullable(),
  seo_description: z.string().max(160).optional().nullable(),
});

export const NavigationLocationSchema = z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/);

export const NavigationItemSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(120).trim(),
  url: z.string().min(1).max(300).default('#'),
  target_type: z.string().min(1).max(40).default('url'),
  target_resource_id: z.string().max(120).optional().nullable(),
  parent_item_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
  is_visible: z.boolean().default(true),
  open_in_new_tab: z.boolean().default(false),
});

export const ListNavigationQuery = z.object({
  store_id: UuidSchema,
  location: NavigationLocationSchema.default('main'),
});

export const ReplaceNavigationSchema = z.object({
  store_id: UuidSchema,
  location: NavigationLocationSchema.default('main'),
  name: z.string().min(1).max(120).optional(),
  items: z.array(NavigationItemSchema).max(100).default([]),
});

export interface PortfolioProject {
  id: string;
  store_id?: string;
  title: string;
  slug?: string;
  description?: string;
  content?: string;
  cover_image?: string;
  image?: string;
  images?: string[];
  video_url?: string;
  client_name?: string;
  project_date?: string;
  project_url?: string;
  github_url?: string;
  technologies?: string[];
  categories?: string[];
  tags?: string[];
  link?: string;
  linkLabel?: string;
  is_featured?: boolean;
  display_order?: number;
  status?: 'draft' | 'published';
  created_at?: string;
  updated_at?: string;
}

export interface Skill {
  id: string;
  store_id: string;
  name: string;
  category?: string;
  proficiency: 1 | 2 | 3 | 4 | 5;
  years_experience?: number;
  icon?: string;
  display_order: number;
}

export interface SkillItem {
  id: string;
  name: string;
  level: number;
  category?: string;
}

export interface Education {
  id: string;
  store_id: string;
  institution: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  is_current: boolean;
  gpa?: string;
  description?: string;
  logo_url?: string;
  display_order: number;
}

export interface WorkExperience {
  id: string;
  store_id: string;
  company: string;
  position: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  is_current: boolean;
  description?: string;
  achievements: string[];
  company_logo?: string;
  display_order: number;
}

export interface ServiceItem {
  id: string;
  icon?: string;
  title: string;
  description: string;
  link?: string;
}

export interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  startDate: string;
  endDate?: string;
  description?: string;
  isCurrent?: boolean;
}

export type PageStatus = z.infer<typeof PageStatusSchema>;
export type PolicyType = z.infer<typeof PolicyTypeSchema>;
export type CreatePageInput = z.infer<typeof CreatePageSchema>;
export type UpdatePageInput = z.infer<typeof UpdatePageSchema>;
export type CreatePolicyInput = z.infer<typeof CreatePolicySchema>;
export type UpdatePolicyInput = z.infer<typeof UpdatePolicySchema>;
export type ReplaceNavigationInput = z.infer<typeof ReplaceNavigationSchema>;
