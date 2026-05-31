import { z } from 'zod';
import { PaginationQuery, SeoSchema, SlugSchema, UrlSchema, UuidSchema } from '@letbuyy/shared-types';

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

export interface CmsSeoInput {
  seo_title?: string | null;
  seo_description?: string | null;
}

export interface CmsStorefrontPageRecord {
  id: string;
  store_id?: string | null;
  title?: string | null;
  slug?: string | null;
  body?: string | null;
  content?: Record<string, unknown> | null;
  html_content?: string | null;
  status?: string | null;
  page_type?: string | null;
  show_in_nav?: boolean | null;
  updated_at?: string | null;
  published_at?: string | null;
  seo?: Record<string, unknown> | null;
  assigned_template_key?: string | null;
}

export interface CmsStorefrontPageRevisionRecord {
  id: string;
  title: string;
  slug: string;
  seo?: Record<string, unknown> | null;
  content?: Record<string, unknown> | null;
  template_key?: string | null;
  created_at?: string | null;
}

export interface CmsStorefrontRoutePageRecord extends CmsStorefrontPageRecord {
  published_revision_id?: string | null;
  is_homepage?: boolean | null;
  display_order?: number | null;
}

export interface CmsPolicyRecord {
  id: string;
  store_id?: string | null;
  policy_type: string;
  slug: string;
  title: string;
  body?: Record<string, unknown> | null;
  status?: string | null;
  seo?: Record<string, unknown> | null;
  published_at?: string | null;
  updated_at?: string | null;
}

export interface CmsNavigationItemRecord {
  id: string;
  menu_id: string;
  store_id: string;
  parent_item_id?: string | null;
  label: string;
  url?: string | null;
  target_type?: string | null;
  target_resource_id?: string | null;
  sort_order?: number | null;
  is_visible?: boolean | null;
  open_in_new_tab?: boolean | null;
  metadata?: Record<string, unknown> | null;
  updated_at?: string | null;
}

export interface PublicNavigationItem {
  id: string;
  label: string;
  href: string;
  targetType: string;
  targetResourceId: string | null;
  openInNewTab: boolean;
  children: PublicNavigationItem[];
  metadata: Record<string, unknown>;
}

export interface CmsFormSubmissionRecord {
  id: string;
  store_id?: string | null;
  stores?: unknown;
  form_type?: string | null;
  form_name?: string | null;
  data?: Record<string, unknown> | null;
  source_url?: string | null;
  status?: string | null;
  read_at?: string | null;
  replied_at?: string | null;
  internal_notes?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  subject?: string | null;
  message?: string | null;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CmsBlogCommentRecord {
  id?: string;
  store_id?: string | null;
  stores?: unknown;
  body?: string | null;
  content?: string | null;
  blog_posts?: { title?: string | null } | null;
}

export function getCmsString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' ? value : null;
}

export function getCmsNonEmptyString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

export function seoFromPageInput(input: CmsSeoInput): { title: string | null; description: string | null } {
  return {
    title: input.seo_title || null,
    description: input.seo_description || null,
  };
}

export function pageBodyToContent(body: string | undefined | null): { body: string } {
  return { body: body || '' };
}

export function slugifyCmsTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100);
}

export function normalizeStorefrontPageRecord(row: CmsStorefrontPageRecord) {
  const content = row.content || {};
  const body = row.body || row.html_content || getCmsString(content, 'body') || getCmsString(content, 'html') || '';
  const seo = row.seo || {};

  return {
    id: row.id,
    store_id: row.store_id,
    title: row.title || 'Untitled page',
    slug: row.slug || '',
    body,
    content: content || { body },
    page_type: row.page_type || 'custom',
    status: row.status || 'draft',
    show_in_nav: Boolean(row.show_in_nav),
    seo_title: getCmsString(seo, 'title'),
    seo_description: getCmsString(seo, 'description'),
    assigned_template_key: row.assigned_template_key || null,
    published_at: row.published_at || null,
    updated_at: row.updated_at || null,
  };
}

export function normalizeLegacyPageRecord(row: CmsStorefrontPageRecord & { stores?: unknown }) {
  const { stores: _stores, content, ...page } = row;
  const body = page.body || page.html_content || getCmsString(content || {}, 'body') || '';

  return {
    ...page,
    content: content || { body },
    body,
    page_type: page.page_type || 'custom',
    show_in_nav: Boolean(page.show_in_nav),
  };
}

export function normalizeStorefrontPolicyRecord(row: CmsPolicyRecord) {
  const body = row.body || {};
  const seo = row.seo || {};

  return {
    id: row.id,
    store_id: row.store_id,
    policy_type: row.policy_type,
    slug: row.slug,
    title: row.title,
    body: getCmsString(body, 'body') || getCmsString(body, 'html') || '',
    content: body,
    status: row.status || 'draft',
    seo_title: getCmsString(seo, 'title'),
    seo_description: getCmsString(seo, 'description'),
    published_at: row.published_at || null,
    updated_at: row.updated_at || null,
  };
}

export function normalizeNavigationItemRecord(row: CmsNavigationItemRecord) {
  return {
    id: row.id,
    menu_id: row.menu_id,
    store_id: row.store_id,
    parent_item_id: row.parent_item_id || null,
    label: row.label,
    url: row.url || '#',
    target_type: row.target_type || 'url',
    target_resource_id: row.target_resource_id || null,
    sort_order: row.sort_order || 0,
    is_visible: row.is_visible !== false,
    open_in_new_tab: row.open_in_new_tab === true,
    metadata: row.metadata || {},
    updated_at: row.updated_at || null,
  };
}

export function normalizeFormSubmissionRecord(row: CmsFormSubmissionRecord) {
  const { stores: _stores, data, ...submission } = row;
  const payload = data || {};

  return {
    ...submission,
    data: payload,
    full_name: submission.full_name || getCmsNonEmptyString(payload, 'full_name') || getCmsNonEmptyString(payload, 'name') || 'Unknown',
    email: submission.email || getCmsNonEmptyString(payload, 'email') || '',
    phone: submission.phone || getCmsNonEmptyString(payload, 'phone'),
    subject: submission.subject || getCmsNonEmptyString(payload, 'subject') || submission.form_name || null,
    message: submission.message || getCmsNonEmptyString(payload, 'message') || getCmsNonEmptyString(payload, 'body') || '',
    source: submission.source || getCmsNonEmptyString(payload, 'source') || submission.source_url || submission.form_type || 'form',
  };
}

export function normalizeBlogCommentRecord(row: CmsBlogCommentRecord) {
  const { blog_posts, stores: _stores, ...comment } = row;

  return {
    ...comment,
    content: comment.content || comment.body || '',
    post_title: blog_posts?.title || null,
  };
}

export function normalizeStorefrontRouteContent(
  content: Record<string, unknown> | null | undefined,
  body?: string | null,
  html?: string | null,
): Record<string, unknown> {
  const normalized = { ...(content && typeof content === 'object' && !Array.isArray(content) ? content : {}) };

  if (body && typeof body === 'string' && body.trim()) {
    normalized.body = body;
  } else if (html && typeof html === 'string' && html.trim()) {
    normalized.html = html;
  }

  return normalized;
}

export function normalizeStorefrontRoutePage(
  page: CmsStorefrontRoutePageRecord,
  revision?: CmsStorefrontPageRevisionRecord | null,
) {
  return {
    id: page.id,
    title: revision?.title || page.title || 'Untitled page',
    slug: revision?.slug || page.slug || '',
    page_type: page.page_type || 'page',
    status: page.status || 'published',
    seo: revision?.seo || page.seo || {},
    content: revision?.content || normalizeStorefrontRouteContent(page.content, page.body, page.html_content),
    assigned_template_key: revision?.template_key || page.assigned_template_key || null,
    is_homepage: Boolean(page.is_homepage),
    show_in_nav: page.show_in_nav !== false,
    display_order: page.display_order || 0,
    published_at: page.published_at || revision?.created_at || null,
    updated_at: page.updated_at || revision?.created_at || null,
  };
}

export function normalizeStorefrontRoutePolicy(policy: CmsPolicyRecord) {
  return {
    id: policy.id,
    policy_type: policy.policy_type,
    slug: policy.slug,
    title: policy.title,
    status: policy.status || 'published',
    seo: policy.seo || {},
    content: policy.body || {},
    published_at: policy.published_at || null,
    updated_at: policy.updated_at || null,
  };
}

export function navigationHrefForCmsItem(item: Pick<CmsNavigationItemRecord, 'url' | 'target_type' | 'target_resource_id'>): string {
  if (item.url) return item.url;

  const resource = item.target_resource_id || '';
  switch (item.target_type) {
    case 'home':
      return '/';
    case 'product':
      return resource ? `/product/${resource}` : '/shop';
    case 'collection':
      return resource ? `/collections/${resource}` : '/shop';
    case 'page':
      return resource ? `/${resource}` : '#';
    case 'policy':
      return resource ? `/${resource}` : '#';
    case 'cart':
      return '/cart';
    case 'search':
      return '/shop';
    default:
      return resource ? `/${resource}` : '#';
  }
}

export function buildPublicNavigationTree(items: CmsNavigationItemRecord[]): PublicNavigationItem[] {
  const nodes = new Map<string, PublicNavigationItem>();
  const roots: PublicNavigationItem[] = [];

  for (const item of items) {
    nodes.set(item.id, {
      id: item.id,
      label: item.label,
      href: navigationHrefForCmsItem(item),
      targetType: item.target_type || 'url',
      targetResourceId: item.target_resource_id || null,
      openInNewTab: item.open_in_new_tab === true,
      children: [],
      metadata: item.metadata || {},
    });
  }

  for (const item of items) {
    const node = nodes.get(item.id);
    if (!node) continue;

    if (item.parent_item_id && nodes.has(item.parent_item_id)) {
      nodes.get(item.parent_item_id)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function storefrontPageToNavigationItem(page: ReturnType<typeof normalizeStorefrontRoutePage>): PublicNavigationItem {
  return {
    id: page.id,
    label: page.title,
    href: page.is_homepage ? '/' : `/${page.slug}`,
    targetType: page.page_type || 'page',
    targetResourceId: page.id,
    openInNewTab: false,
    children: [],
    metadata: {},
  };
}

export const CreateBlogPostSchema = z.object({
  store_id: UuidSchema,
  title: z.string().min(1).max(300).trim(),
  slug: SlugSchema.optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().max(100000),
  content_html: z.string().max(150000).optional(),
  featured_image: UrlSchema.optional().nullable(),
  category_id: UuidSchema.optional().nullable(),
  tag_ids: z.array(UuidSchema).max(20).default([]),
  status: z.enum(['draft', 'published', 'scheduled']).default('draft'),
  scheduled_at: z.coerce.date().optional().nullable(),
  allow_comments: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  is_pinned: z.boolean().default(false),
  reading_time_min: z.number().int().min(0).max(1000).optional().nullable(),
  ...SeoSchema.shape,
});

export const UpdateBlogPostSchema = z.object({
  title: z.string().min(1).max(300).trim().optional(),
  slug: SlugSchema.optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().max(100000).optional(),
  content_html: z.string().max(150000).optional(),
  featured_image: UrlSchema.optional().nullable(),
  category_id: UuidSchema.optional().nullable(),
  tag_ids: z.array(UuidSchema).max(20).optional(),
  status: z.enum(['draft', 'published', 'scheduled', 'archived']).optional(),
  scheduled_at: z.coerce.date().optional().nullable(),
  allow_comments: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  is_pinned: z.boolean().optional(),
  reading_time_min: z.number().int().min(0).max(1000).optional().nullable(),
  version: z.number().int().positive('Version required').optional(),
  ...SeoSchema.shape,
});

export const CreateBlogCategorySchema = z.object({
  store_id: UuidSchema,
  name: z.string().min(1).max(100).trim(),
  slug: SlugSchema.optional(),
  description: z.string().max(500).optional(),
  parent_id: UuidSchema.optional().nullable(),
});

export const CreateBlogTagSchema = z.object({
  store_id: UuidSchema,
  name: z.string().min(1).max(50).trim(),
});

export const ListBlogPostsQuery = PaginationQuery.extend({
  store_id: UuidSchema.optional(),
  status: z.enum(['draft', 'published', 'scheduled', 'archived']).optional(),
  category_id: UuidSchema.optional(),
  search: z.string().max(200).optional(),
});

export const ListBlogCommentsQuery = PaginationQuery.extend({
  store_id: UuidSchema,
  status: z.enum(['all', 'pending', 'approved', 'spam', 'rejected']).default('all'),
});

export const UpdateBlogCommentSchema = z.object({
  status: z.enum(['pending', 'approved', 'spam', 'rejected']),
});

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

export const UploadMediaSchema = z.object({
  store_id: UuidSchema,
  alt_text: z.string().max(500).optional(),
  folder: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
});

export const UpdateMediaSchema = z.object({
  alt_text: z.string().max(500).optional(),
  folder: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const ListMediaQuery = PaginationQuery.extend({
  store_id: UuidSchema.optional(),
  folder: z.string().max(200).optional(),
  type: z.enum(['image', 'video', 'document', 'all']).default('all'),
  search: z.string().max(200).optional(),
});

export const BulkDeleteMediaSchema = z.object({
  ids: z.array(UuidSchema).min(1).max(100),
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
export type CreateBlogPostInput = z.infer<typeof CreateBlogPostSchema>;
export type UpdateBlogPostInput = z.infer<typeof UpdateBlogPostSchema>;
export type ListBlogPostsInput = z.infer<typeof ListBlogPostsQuery>;
export type ListBlogCommentsInput = z.infer<typeof ListBlogCommentsQuery>;
export type UpdateBlogCommentInput = z.infer<typeof UpdateBlogCommentSchema>;
export type FormSubmissionStatus = z.infer<typeof FormSubmissionStatusSchema>;
export type ListFormSubmissionsInput = z.infer<typeof ListFormSubmissionsQuery>;
export type UpdateFormSubmissionInput = z.infer<typeof UpdateFormSubmissionSchema>;
export type UploadMediaInput = z.infer<typeof UploadMediaSchema>;
export type UpdateMediaInput = z.infer<typeof UpdateMediaSchema>;
export type ListMediaInput = z.infer<typeof ListMediaQuery>;
export type BulkDeleteMediaInput = z.infer<typeof BulkDeleteMediaSchema>;
