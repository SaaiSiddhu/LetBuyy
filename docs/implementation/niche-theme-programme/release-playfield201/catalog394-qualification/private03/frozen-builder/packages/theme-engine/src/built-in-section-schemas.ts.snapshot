import { SECTION_SCHEMAS, type SchemaField, type SectionSchema } from './theme-registry';

export const BUILT_IN_SECTION_TYPES = [
  'header',
  'announcementBar',
  'heroBanner',
  'productDetail',
  'productGrid',
  'footer',
  'featuredProducts',
  'testimonials',
  'aboutSection',
  'collectionFilter',
  'newsletter',
  'contentPage',
  'instagramFeed',
  'faqAccordion',
  'videoHero',
  'trustBadges',
  'appBlockSlot',
  'categoryGrid',
  'brandMarquee',
  'portfolioGrid',
  'servicesGrid',
  'skillsSection',
  'experienceTimeline',
  'contactForm',
  'ctaSection',
] as const;

export type BuiltInThemeSectionType = typeof BUILT_IN_SECTION_TYPES[number];

function field(type: SchemaField['type'], label: string, extra: Omit<SchemaField, 'type' | 'label'> = {}): SchemaField {
  return { type, label, ...extra };
}

function schema(input: SectionSchema): SectionSchema {
  return input;
}

const ADDITIONAL_BUILT_IN_SECTION_SCHEMAS: Record<string, SectionSchema> = {
  productDetail: schema({
    type: 'productDetail',
    name: 'Product Detail',
    description: 'Product media, pricing, variants, and purchase controls for product routes.',
    defaults: {
      showGallery: true,
      showDescription: true,
      showVariantSelector: true,
      showQuantity: true,
      showBuyNow: true,
    },
    settings_schema: {
      showGallery: field('toggle', 'Show gallery', { default: true }),
      showDescription: field('toggle', 'Show description', { default: true }),
      showVariantSelector: field('toggle', 'Show variant selector', { default: true }),
      showQuantity: field('toggle', 'Show quantity selector', { default: true }),
      showBuyNow: field('toggle', 'Show buy now button', { default: true }),
    },
  }),
  aboutSection: schema({
    type: 'aboutSection',
    name: 'About Section',
    description: 'Merchant story content with optional supporting media.',
    defaults: {
      title: 'About Us',
      content: 'Tell customers what makes your store distinct.',
      imageUrl: '',
      layout: 'left',
    },
    settings_schema: {
      title: field('text', 'Title', { default: 'About Us', maxLength: 80 }),
      content: field('richtext', 'Content'),
      imageUrl: field('image', 'Image'),
      layout: field('select', 'Layout', { default: 'left', options: ['left', 'right', 'center'] }),
    },
  }),
  collectionFilter: schema({
    type: 'collectionFilter',
    name: 'Collection Filter',
    description: 'Filter and sort controls for collection and shop routes.',
    defaults: {
      showSearch: true,
      showSort: true,
      showPriceFilter: true,
      showVendorFilter: false,
      layout: 'sidebar',
    },
    settings_schema: {
      showSearch: field('toggle', 'Show search', { default: true }),
      showSort: field('toggle', 'Show sort', { default: true }),
      showPriceFilter: field('toggle', 'Show price filter', { default: true }),
      showVendorFilter: field('toggle', 'Show vendor filter', { default: false }),
      layout: field('select', 'Layout', { default: 'sidebar', options: ['sidebar', 'drawer', 'topbar'] }),
    },
  }),
  contentPage: schema({
    type: 'contentPage',
    name: 'Rich Content',
    description: 'Theme-rendered page, policy, or blog content.',
    defaults: {
      title: '',
      body: '',
      html: '',
      width: 'standard',
    },
    settings_schema: {
      title: field('text', 'Title', { maxLength: 100 }),
      body: field('richtext', 'Body'),
      html: field('richtext', 'HTML content'),
      width: field('select', 'Width', { default: 'standard', options: ['narrow', 'standard', 'wide'] }),
    },
  }),
  instagramFeed: schema({
    type: 'instagramFeed',
    name: 'Instagram Feed',
    description: 'Social proof image grid with optional captions.',
    defaults: {
      title: 'Follow us',
      handle: '',
      columns: 4,
      showCaptions: false,
    },
    settings_schema: {
      title: field('text', 'Title', { default: 'Follow us', maxLength: 80 }),
      handle: field('text', 'Handle', { maxLength: 80 }),
      columns: field('range', 'Columns', { default: 4, min: 2, max: 6, step: 1 }),
      showCaptions: field('toggle', 'Show captions', { default: false }),
    },
    blocks_schema: {
      post: {
        name: 'Post',
        fields: {
          image: field('image', 'Image'),
          caption: field('textarea', 'Caption', { maxLength: 200 }),
          link: field('url', 'Link'),
        },
      },
    },
  }),
  faqAccordion: schema({
    type: 'faqAccordion',
    name: 'FAQ Accordion',
    description: 'Expandable questions and answers for shopper education.',
    defaults: {
      title: 'Frequently asked questions',
      allowMultipleOpen: false,
    },
    settings_schema: {
      title: field('text', 'Title', { default: 'Frequently asked questions', maxLength: 100 }),
      allowMultipleOpen: field('toggle', 'Allow multiple open', { default: false }),
    },
    blocks_schema: {
      faqItem: {
        name: 'FAQ item',
        fields: {
          question: field('text', 'Question', { maxLength: 160 }),
          answer: field('richtext', 'Answer'),
        },
      },
    },
  }),
  videoHero: schema({
    type: 'videoHero',
    name: 'Video Hero',
    description: 'Hero section with background or embedded video media.',
    defaults: {
      heading: 'Watch the story',
      subheading: '',
      videoUrl: '',
      fallbackImage: '',
      ctaText: '',
      ctaLink: '',
      overlay: 0.45,
    },
    settings_schema: {
      heading: field('text', 'Heading', { default: 'Watch the story', maxLength: 100 }),
      subheading: field('text', 'Subheading', { maxLength: 200 }),
      videoUrl: field('url', 'Video URL'),
      fallbackImage: field('image', 'Fallback image'),
      ctaText: field('text', 'Button text', { maxLength: 40 }),
      ctaLink: field('url', 'Button link'),
      overlay: field('range', 'Overlay opacity', { default: 0.45, min: 0, max: 1, step: 0.05 }),
    },
  }),
  portfolioGrid: schema({
    type: 'portfolioGrid',
    name: 'Portfolio Grid',
    description: 'Grid of portfolio projects for creator and service sites.',
    defaults: {
      title: 'Portfolio',
      subtitle: '',
      columns: 3,
      layout: 'grid',
    },
    settings_schema: {
      title: field('text', 'Title', { default: 'Portfolio', maxLength: 80 }),
      subtitle: field('text', 'Subtitle', { maxLength: 120 }),
      columns: field('range', 'Columns', { default: 3, min: 2, max: 4, step: 1 }),
      layout: field('select', 'Layout', { default: 'grid', options: ['grid', 'masonry'] }),
    },
    blocks_schema: {
      project: {
        name: 'Project',
        fields: {
          title: field('text', 'Title', { maxLength: 80 }),
          image: field('image', 'Image'),
          summary: field('textarea', 'Summary', { maxLength: 240 }),
          link: field('url', 'Link'),
        },
      },
    },
  }),
  servicesGrid: schema({
    type: 'servicesGrid',
    name: 'Services Grid',
    description: 'Service cards for creators, freelancers, and local businesses.',
    defaults: {
      title: 'Services',
      subtitle: '',
      columns: 3,
    },
    settings_schema: {
      title: field('text', 'Title', { default: 'Services', maxLength: 80 }),
      subtitle: field('text', 'Subtitle', { maxLength: 120 }),
      columns: field('range', 'Columns', { default: 3, min: 2, max: 4, step: 1 }),
    },
    blocks_schema: {
      service: {
        name: 'Service',
        fields: {
          icon: field('select', 'Icon', { options: ['design', 'code', 'web', 'mobile', 'photo', 'branding', 'analytics', 'marketing'] }),
          title: field('text', 'Title', { maxLength: 60 }),
          description: field('textarea', 'Description', { maxLength: 200 }),
          link: field('url', 'Link'),
        },
      },
    },
  }),
  skillsSection: schema({
    type: 'skillsSection',
    name: 'Skills Section',
    description: 'Skill tags or bars for resumes and portfolios.',
    defaults: {
      title: 'Skills',
      subtitle: '',
      layout: 'tags',
    },
    settings_schema: {
      title: field('text', 'Title', { default: 'Skills', maxLength: 80 }),
      subtitle: field('text', 'Subtitle', { maxLength: 120 }),
      layout: field('select', 'Layout', { default: 'tags', options: ['tags', 'bars'] }),
    },
    blocks_schema: {
      skill: {
        name: 'Skill',
        fields: {
          name: field('text', 'Skill', { maxLength: 60 }),
          level: field('range', 'Level', { min: 0, max: 100, step: 5 }),
        },
      },
    },
  }),
  experienceTimeline: schema({
    type: 'experienceTimeline',
    name: 'Experience Timeline',
    description: 'Timeline list for work, education, or milestones.',
    defaults: {
      title: 'Experience',
      subtitle: '',
    },
    settings_schema: {
      title: field('text', 'Title', { default: 'Experience', maxLength: 80 }),
      subtitle: field('text', 'Subtitle', { maxLength: 120 }),
    },
    blocks_schema: {
      experience: {
        name: 'Experience',
        fields: {
          title: field('text', 'Title', { maxLength: 80 }),
          organization: field('text', 'Organization', { maxLength: 80 }),
          period: field('text', 'Period', { maxLength: 60 }),
          description: field('textarea', 'Description', { maxLength: 300 }),
        },
      },
    },
  }),
  contactForm: schema({
    type: 'contactForm',
    name: 'Contact Form',
    description: 'Lead capture form for storefront, portfolio, and landing pages.',
    defaults: {
      title: 'Contact Us',
      subtitle: '',
      email: '',
      showPhone: true,
      showAddress: false,
    },
    settings_schema: {
      title: field('text', 'Title', { default: 'Contact Us', maxLength: 80 }),
      subtitle: field('text', 'Subtitle', { maxLength: 120 }),
      email: field('text', 'Notification email'),
      showPhone: field('toggle', 'Show phone field', { default: true }),
      showAddress: field('toggle', 'Show address field', { default: false }),
    },
  }),
  ctaSection: schema({
    type: 'ctaSection',
    name: 'Call to Action',
    description: 'Focused promotional call-to-action band.',
    defaults: {
      heading: 'Ready to get started?',
      subheading: '',
      ctaText: 'Shop Now',
      ctaLink: '/shop',
      style: 'primary',
    },
    settings_schema: {
      heading: field('text', 'Heading', { default: 'Ready to get started?', maxLength: 100 }),
      subheading: field('text', 'Subheading', { maxLength: 160 }),
      ctaText: field('text', 'Button text', { default: 'Shop Now', maxLength: 40 }),
      ctaLink: field('url', 'Button link', { default: '/shop' }),
      style: field('select', 'Style', { default: 'primary', options: ['primary', 'gradient', 'dark'] }),
    },
  }),
};

export const BUILT_IN_SECTION_SCHEMAS: Record<BuiltInThemeSectionType, SectionSchema> = Object.freeze({
  ...SECTION_SCHEMAS,
  ...ADDITIONAL_BUILT_IN_SECTION_SCHEMAS,
}) as Record<BuiltInThemeSectionType, SectionSchema>;

export function collectBuiltInSectionSchemaGaps(
  schemas: Record<string, SectionSchema> = BUILT_IN_SECTION_SCHEMAS,
): string[] {
  return BUILT_IN_SECTION_TYPES.filter((type) => !schemas[type]);
}
