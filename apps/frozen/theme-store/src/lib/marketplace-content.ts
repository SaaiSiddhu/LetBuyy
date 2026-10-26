/** Editorial guidance only. Catalog, entitlement and release authority stay in ThemeService. */
export interface GuideSection {
    id: string;
    title: string;
    paragraphs: string[];
    checklist?: string[];
}
export interface MarketplaceGuide {
    slug: string;
    title: string;
    topic: 'Choosing a theme' | 'Setting up' | 'Managing themes';
    summary: string;
    outcome: string;
    sections: GuideSection[];
    next: { label: string; href: string };
    related: string[];
}

export const MARKETPLACE_GUIDES: MarketplaceGuide[] = [
    {
        slug: 'choose-the-right-theme', title: 'How to choose the right theme', topic: 'Choosing a theme',
        summary: 'Build a shortlist around your content, products, and customer journey—not just the first screenshot.',
        outcome: 'A practical shortlist and a clear set of requirements to check in each demo.',
        sections: [
            { id: 'start-with-content', title: 'Start with what your website needs to do', paragraphs: [
                'Write down the main action you want a visitor to take: find a product, explore a collection, understand an offer, or place an order. Then list the pages that action needs. A small product range and a large catalog need different navigation, product layouts, and collection pages.',
                'Use your own material to judge a design. A demo with large campaign photographs can feel very different with small product images or long product names. Collect a few representative images and descriptions before choosing.'
            ], checklist: ['Your store’s product range and the pages it needs.', 'Your shortest and longest titles, typical product images, and brand logo.', 'The features your customer needs before deciding to buy or get in touch.'] },
            { id: 'make-a-shortlist', title: 'Use filters to make a manageable shortlist', paragraphs: [
                'Start with your store’s needs, then narrow by price, industry, layout, style, or a required feature. Industry is a useful starting point, not a rule about who may use a design. Read each listing to confirm its features and supported platforms.',
                'Save interesting themes on this browser and add up to four to compare. Compare price, category, features, version, and available review information together. An empty review history is different from a poor rating; missing performance data is not evidence of a fast theme.'
            ] },
            { id: 'test-the-journey', title: 'Look beyond the homepage', paragraphs: [
                'Follow the route a customer would actually take. Open a collection, read a product page, inspect navigation, and switch between desktop and mobile preview. Check long text, image cropping, button visibility, and the space available for product information.',
                'A public sample uses sample content and may not be available for every package version. When a demo is unavailable, use the listing screenshots and documentation, and ask about the missing detail before making a purchase decision.'
            ] },
            { id: 'review-the-details', title: 'Check ownership, cost, and support before committing', paragraphs: [
                'Read the current listing price, theme version, changelog, supported platforms, and license information. Review the support route for the theme and the marketplace refund information. Do not assume a premium price includes a particular feature, custom design work, or every downloadable format.',
                'Once you have a clear favorite, open its details and add it to the appropriate store library. Keep your shortlist until you have checked the design with your own content in the merchant editor.'
            ] }
        ], next: { label: 'Browse and shortlist themes', href: '/themes' }, related: ['preview-a-theme', 'theme-pricing-and-licenses', 'customize-your-theme']
    },
    {
        slug: 'preview-a-theme', title: 'What to check in a theme preview', topic: 'Choosing a theme',
        summary: 'Understand public demos, store previews, and the details worth checking on every screen size.',
        outcome: 'A repeatable way to evaluate a theme before changing a live store.',
        sections: [
            { id: 'public-demo', title: 'Start with the public sample', paragraphs: [
                'Open Preview from a theme card or use the demo on its detail page. The sample is tied to the selected theme and version. It helps you explore layout and visual behavior without selecting a store or changing your products.',
                'Sample stores are demonstrations, not a place to make a real purchase. Sample products, images, and copy are not a promise that those assets are included in the theme license. If the catalog version changes or its sample is not ready, return to the current listing rather than treating the unavailable demo as a failed installation.'
            ] },
            { id: 'desktop-mobile', title: 'Check the same journey on desktop and mobile', paragraphs: [
                'Use the device controls to compare a wide layout with a narrower one. Start at the homepage, use the navigation, and inspect a typical detail page. Look for readable text, clear buttons, useful image crops, and a menu that stays understandable with your actual number of links.',
                'A narrow preview is a useful first check. Before publication, also check your own draft on a real phone and with the browser keyboard. A good screenshot does not prove that forms, focus order, or every interaction will work for your content.'
            ], checklist: ['Logo and navigation remain readable without covering the page.', 'Important product information appears before the customer must make a decision.', 'Text remains readable when enlarged, and controls can be reached with a keyboard.', 'Contact, policy, and return links lead to the pages you intend.'] },
            { id: 'store-preview', title: 'Use your store preview for the final decision', paragraphs: [
                'Where Preview in your store is available, sign in and select a store you are allowed to manage. A store preview is separate from a public sample because it uses a store-specific preview session. It does not grant access to another merchant’s store.',
                'Check your own products, navigation, sections, and settings in the merchant workspace. Adding a design to the library and publishing it are separate actions. If a preview expires or the package version changes, reopen the listing and create a fresh preview instead of reusing an old link.'
            ] }
        ], next: { label: 'Find a theme to preview', href: '/themes' }, related: ['choose-the-right-theme', 'install-and-publish', 'before-you-publish']
    },
    {
        slug: 'install-and-publish', title: 'From a theme listing to your store library', topic: 'Setting up',
        summary: 'Choose the right store, add a private theme instance, and understand what happens before publication.',
        outcome: 'A theme in the correct store library, ready for editing and a separate publish decision.',
        sections: [
            { id: 'before-adding', title: 'Check the listing and sign in', paragraphs: [
                'Review the theme name, current version, price, and requirements on the detail page. Free themes use Add to library; paid listings take you through the purchase flow before an entitled install can proceed. Use the shared LetBuyy account sign-in when asked.',
                'You need a store you can manage. If no store is available, open your merchant workspace and check the account and store you are using. A theme listing alone does not create a store or give an account permission to manage an existing one.'
            ] },
            { id: 'select-store', title: 'Select the intended store', paragraphs: [
                'On the add-theme page, select the correct store and review the confirmation. The request is tied to the selected package version; if the listing changes, return to the theme and review the new version before trying again.',
                'Adding creates a private library instance. It does not replace the current live theme, delete the product catalog, or publish a new design. If the result is unclear after a connection problem, check the store library before repeating the action.'
            ] },
            { id: 'customize-and-review', title: 'Edit and preview in the merchant workspace', paragraphs: [
                'Open the theme library for the selected store and customize that theme instance. Work through logo, colors, typography, navigation, sections, images, and product presentation using the controls the package exposes.',
                'Use your real content for the final preview. Keep track of which theme instance you are editing when several designs are in the library. Editing one draft is not evidence that a different draft or the published store has changed.'
            ] },
            { id: 'publish-separately', title: 'Publish only after the final check', paragraphs: [
                'Publication is a separate action in the merchant theme workflow. Check the store identity, selected theme, content, and current preview immediately before you publish. Use the pre-publication checklist to test important pages and links.',
                'After publication, visit the public store and repeat the most important customer journey. Use Installations to inspect the installed version and available release history. If you need to reverse a release, review the eligible rollback action and its target before confirming it.'
            ] }
        ], next: { label: 'Open your theme library', href: '/dashboard' }, related: ['customize-your-theme', 'before-you-publish', 'updates-and-rollback']
    },
    {
        slug: 'customize-your-theme', title: 'Make a theme feel like your brand', topic: 'Setting up',
        summary: 'Work through identity, content, sections, and navigation without relying on the demo’s artwork.',
        outcome: 'A consistent design built around your own content and the theme’s supported editor controls.',
        sections: [
            { id: 'brand-foundations', title: 'Set the visual foundations first', paragraphs: [
                'Start with your logo, a small color palette, and a readable type combination. Use the theme’s available settings instead of styling each section independently. Consistent headings, buttons, and link colors make a site easier to understand.',
                'Check contrast with your actual background and photography. A pale brand color may work as a decorative accent but fail as text on white. Look at long headings, prices, secondary text, and error messages as well as the main hero.'
            ] },
            { id: 'sections-and-content', title: 'Build sections around a clear story', paragraphs: [
                'Give each section a useful job: explain the offer, help visitors browse, show product detail, or answer a common question. Remove repeated messages before adding more visual effects. Use a short, specific heading and a next action that matches the linked page.',
                'Customization options vary by theme and version. Review the available section and block controls in the merchant editor. If an option is absent, check the listing and documentation instead of assuming every theme supports the same feature.'
            ] },
            { id: 'imagery-and-navigation', title: 'Use your own images and meaningful navigation', paragraphs: [
                'Replace sample images with assets you have permission to use. Test a consistent crop for products, and keep important subjects away from edges that may be cropped on small screens. Add useful alternative text to informative images.',
                'Name navigation links after the destination. Put the most useful collections or pages first, then verify the same menu on mobile. Footer links should include the actual contact and policy pages customers need, rather than unused sample destinations.'
            ] },
            { id: 'check-everywhere', title: 'Review the complete draft', paragraphs: [
                'Check more than the homepage. Read a long product description, inspect an empty collection where applicable, and test every visible call to action. Use both narrow and wide views and enlarge text in your browser.',
                'Keep custom code changes documented. Package updates can have different compatibility requirements, so record changes that sit outside the normal editor settings before applying a new version.'
            ] }
        ], next: { label: 'Go to your installed themes', href: '/dashboard/installations' }, related: ['preview-a-theme', 'before-you-publish', 'updates-and-rollback']
    },
    {
        slug: 'before-you-publish', title: 'Your pre-publication theme checklist', topic: 'Setting up',
        summary: 'Check the pages, content, navigation, and customer journey that matter before changing your live design.',
        outcome: 'A clear final review for the selected store and theme instance.',
        sections: [
            { id: 'identity-content', title: 'Confirm the store and remove sample content', paragraphs: [
                'Open the intended store and theme instance in the merchant workspace. Confirm that the draft you are reviewing is the one you plan to publish. Replace sample titles, images, logos, and promotional messages with your own approved content.'
            ], checklist: ['Store name, logo, page titles, and contact details are correct.', 'Products have the right names, images, descriptions, and availability.', 'Campaign messages and delivery claims match your actual offer.', 'Informative images have useful alternative text.'] },
            { id: 'customer-journey', title: 'Walk through the important pages', paragraphs: [
                'Follow the path a new customer will take. Start at the homepage, browse a collection, inspect a product, and check the next available action. Use your own store preview for this review; public demo behavior does not establish that your configured store is ready.'
            ], checklist: ['Every main-menu and footer link has a useful destination.', 'Product and collection pages work with long titles and different image sizes.', 'Contact and policy pages contain the information customers need.', 'Any checkout testing follows your store’s approved test-payment workflow.'] },
            { id: 'mobile-accessibility', title: 'Check mobile and accessible use', paragraphs: [
                'Review a real phone as well as the editor’s device preview. Increase text size, navigate with the keyboard, and make sure a sticky header or banner does not hide important content. Pay attention to the product page and menu, not only the first screen.'
            ], checklist: ['Navigation opens, closes, and can be used with a keyboard.', 'Visible focus, readable text, and clear button labels remain available.', 'Images fit their containers and the page has no unexpected horizontal scroll.', 'Essential information is not available only on hover.'] },
            { id: 'after-publication', title: 'Verify the public result', paragraphs: [
                'Review the final publish action in the merchant workspace. Once it completes, open the actual public store and repeat the key journey. Confirm the live theme and release rather than relying only on the editor preview.',
                'Keep the previous release information available. If you discover a problem, use the eligible rollback workflow or contact support with the store, theme version, and affected page. A theme rollback changes a release; it is not a restore operation for orders or product data.'
            ] }
        ], next: { label: 'Review your installations', href: '/dashboard/installations' }, related: ['install-and-publish', 'customize-your-theme', 'updates-and-rollback']
    },
    {
        slug: 'updates-and-rollback', title: 'Understand theme updates and rollback', topic: 'Managing themes',
        summary: 'Review version changes, check your customization, and keep release recovery deliberate.',
        outcome: 'A safer update review and a clear understanding of release history.',
        sections: [
            { id: 'check-versions', title: 'Compare the installed and catalog versions', paragraphs: [
                'Open Installations to see the version recorded for each store’s installed theme. If the catalog has another version, use the available review action to open the merchant theme workflow. Read the listing changelog and any compatibility information before applying an update.',
                'A version number alone does not describe the impact of a change. Check whether the update affects a section you use, a setting you customized, or a page your customers rely on. Do not assume that a newer version guarantees a specific performance result.'
            ] },
            { id: 'review-customization', title: 'Review the update against your own theme instance', paragraphs: [
                'Keep track of your current published release and any work in progress. Review the candidate update in the merchant workspace, including its changed settings and sections. Recheck any custom code separately from normal editor settings.',
                'Use the update confirmation presented by the merchant workflow. If another change is published while you are reviewing, reopen the current state instead of applying a stale confirmation. The app can refuse an action when its expected current release no longer matches.'
            ] },
            { id: 'rollback', title: 'Roll back an eligible release when needed', paragraphs: [
                'Where release history provides an eligible prior release, the installation dashboard exposes Roll back. Confirm the theme, store, and target release. A missing or unavailable rollback target is not permission to choose an unrelated package or version.',
                'After the action completes, check the public store and current release. If a connection fails before you receive a result, inspect release history before retrying. Do not treat a missing success message as proof that the first request made no change.'
            ] },
            { id: 'when-to-get-help', title: 'Know when to contact support', paragraphs: [
                'Ask for help if a package is no longer available, release history is unclear, or the current state differs from the action you expected. Include the store, theme slug, version, release reference when available, and the visible error message.',
                'Never include passwords, session cookies, private preview tokens, or payment credentials. Use screenshots that show the problem without exposing customer or account information.'
            ] }
        ], next: { label: 'View installations and releases', href: '/dashboard/installations' }, related: ['customize-your-theme', 'before-you-publish', 'install-and-publish']
    },
    {
        slug: 'theme-pricing-and-licenses', title: 'Theme pricing, licenses, and downloads', topic: 'Choosing a theme',
        summary: 'Know which details belong to the listing, your purchase record, and the store you are installing into.',
        outcome: 'A clear set of details to review before choosing a free or paid design.',
        sections: [
            { id: 'listing-price', title: 'Read the individual listing price', paragraphs: [
                'Theme prices belong to individual listings. A free theme does not require a theme purchase; a paid one-time listing uses the price shown in its purchase flow. Do not interpret the theme price as the cost of your full LetBuyy store plan, domain, or a custom design service.',
                'The final purchase screen and receipt are the records to check for the amount and applicable purchase details. A label such as premium does not guarantee every feature, future version, or third-party service. Review the actual listing and support information.'
            ] },
            { id: 'purchase-record', title: 'Keep the purchase and license records together', paragraphs: [
                'After a confirmed paid purchase, Purchases is the place to inspect the available receipt and license record. If a payment result is unclear, check that record before trying to pay again and contact support with the purchase reference.',
                'Installations are tied to a selected store and require permission to manage it. Read the license page and your entitlement record for scope. Do not assume a theme can be redistributed, resold, or used across unlimited stores. The marketplace’s legal pages describe the current operational terms; ask support about any unclear commercial scope before committing.'
            ] },
            { id: 'downloads', title: 'Distinguish installation from standalone downloads', paragraphs: [
                'Adding a theme to a LetBuyy store library and downloading a standalone artifact are different workflows. A listing can support installation without providing every file format. Review the supported platforms and the artifacts available to your account.',
                'Open Downloads for eligible files. Availability depends on both the purchase or entitlement and the package files that have actually been provided. If a file is absent or its link expires, return to Downloads or contact support; do not assume your store installation failed.'
            ] },
            { id: 'refund-support', title: 'Review support and refund information', paragraphs: [
                'Check who can help with a theme question, installation issue, or purchase concern. Describe what you expected, what happened, and which theme version you used. Custom design work and feature requests are different from a reproducible theme issue.',
                'Where a refund request action is available in Purchases, it submits a request for review. Submission is not a confirmed refund or a guaranteed eligibility decision. Read the current refund information and use support for purchase-specific questions.'
            ] }
        ], next: { label: 'Compare free and paid theme options', href: '/pricing' }, related: ['choose-the-right-theme', 'install-and-publish', 'updates-and-rollback']
    }
];

export function findMarketplaceGuide(slug: string) {
    return MARKETPLACE_GUIDES.find(guide => guide.slug === slug);
}

export const DISCOVERY_PATHS = [
    { title: 'Start with a free theme', description: 'Explore designs that do not require a theme purchase. Review each listing for its features and available sample.', href: '/themes?pricing=free', label: 'Browse free themes' },
    { title: 'See what is new', description: 'Sort the current catalog by its most recent additions and inspect the version and changelog that matter to you.', href: '/themes?sort=recent', label: 'See recent themes' },
    { title: 'Explore popular themes', description: 'Use the catalog’s popularity sort as a starting point, then compare suitability for your own content.', href: '/themes?sort=popular', label: 'Explore popular themes' },
    { title: 'Build an online store', description: 'Look at product pages, collection navigation, and the features your customers need when shopping.', href: '/themes/category/store', label: 'Browse store themes' },
    { title: 'Compare your shortlist', description: 'Save candidates as you browse and compare up to four themes by price, version, category, and features.', href: '/themes/compare', label: 'Open theme comparison' },
];

export interface MarketplaceFaq { id: string; category: string; question: string; answer: string; href: string; linkLabel: string }
export const MARKETPLACE_FAQS: MarketplaceFaq[] = [
    {id:'what-is-theme',category:'Choosing a theme',question:'What does a theme change?',answer:'A theme provides the design and presentation used by your website: layouts, sections, typography, colors, and the controls its package supports. Products and orders belong to your store. Adding a theme to the library is separate from publishing a new design.',href:'/guides/choose-the-right-theme',linkLabel:'Read the theme selection guide'},
    {id:'which-website-types',category:'Choosing a theme',question:'Is this only for online stores?',answer:'Yes. The marketplace currently offers themes for the LetBuyy store builder. Explore storefront designs and check each listing for its product, collection, navigation, and other supported features.',href:'/collections',linkLabel:'Explore ways to browse'},
    {id:'public-preview',category:'Choosing a theme',question:'Can I preview without changing my store?',answer:'A public sample can be opened without selecting a store where that theme version has an available demo. Store-specific preview actions require sign-in and a store you are allowed to manage. Previewing is separate from adding or publishing a theme.',href:'/guides/preview-a-theme',linkLabel:'Understand theme previews'},
    {id:'missing-demo',category:'Choosing a theme',question:'Why is a sample store unavailable?',answer:'A public sample must match a catalog package and version. Some listings or older versions do not have a ready sample. Review screenshots, listing details, and available documentation, or contact support before relying on an unavailable demo for your decision.',href:'/support',linkLabel:'Get preview help'},
    {id:'saved-themes',category:'Choosing a theme',question:'Where are my saved themes and comparison choices?',answer:'Theme favorites and your comparison shortlist are saved on this browser. They are not a purchase or a store installation. Use the same browser to reopen them; clearing browser storage can remove those saved choices. Comparison supports up to four themes.',href:'/dashboard/favorites',linkLabel:'Open saved themes'},
    {id:'free-paid',category:'Pricing and ownership',question:'How do free and paid themes differ?',answer:'A free listing does not require a theme purchase. Paid one-time listings use the price shown in their purchase flow and provide purchase records after confirmation. Features, supported platforms, and available files vary by listing rather than following one universal free-versus-paid feature bundle.',href:'/pricing',linkLabel:'Read the pricing guide'},
    {id:'platform-plan',category:'Pricing and ownership',question:'Does a theme price include my LetBuyy plan?',answer:'Theme purchase information describes the theme listing. It is not a quote for your platform subscription, domain, services, or custom design work. Review the theme’s purchase screen and your separate platform billing information for those costs.',href:'/guides/theme-pricing-and-licenses',linkLabel:'Understand theme costs'},
    {id:'license-scope',category:'Pricing and ownership',question:'Can I use a theme on more than one store?',answer:'Check the current license information and the entitlement attached to your purchase. Every installation is tied to a store and checks management permissions. Do not assume a purchase provides unlimited store use, redistribution, or resale rights.',href:'/legal/license',linkLabel:'Read license information'},
    {id:'receipt',category:'Pricing and ownership',question:'Where can I find a receipt or license?',answer:'Open Purchases using the account associated with the completed purchase. Review the available receipt and license record there. If the payment outcome is unclear or the record is missing, contact support with the purchase reference before trying to pay again.',href:'/dashboard/purchases',linkLabel:'Open purchases'},
    {id:'refund',category:'Pricing and ownership',question:'How do I ask about a refund?',answer:'Use the request action on an eligible purchase where available, or contact support with the purchase reference and reason. A submitted request is reviewed; it is not confirmation that a refund has been approved or completed. Read the current refund information for the operational process.',href:'/legal/refund',linkLabel:'Read refund information'},
    {id:'add-publish',category:'Setup and customization',question:'Does adding a theme publish it immediately?',answer:'No. Adding creates a private instance in the selected store’s theme library. You customize and preview it in the merchant workspace, then make a separate publish decision. Your current live theme and other drafts remain in place when you add a design.',href:'/guides/install-and-publish',linkLabel:'Follow the setup guide'},
    {id:'coding',category:'Setup and customization',question:'Do I need to write code?',answer:'Adding a theme through the marketplace does not require code. Use the merchant editor for the settings and section controls the selected package exposes. Advanced changes outside those controls may need technical help; not every theme offers the same options.',href:'/guides/customize-your-theme',linkLabel:'Read customization guidance'},
    {id:'demo-images',category:'Setup and customization',question:'Are the demo images and products included?',answer:'Treat sample artwork, products, and copy as demonstration content. Check the listing and asset permissions before reusing any of it. Use your own approved images, product data, navigation, and policy pages when preparing your store for publication.',href:'/guides/before-you-publish',linkLabel:'Use the publication checklist'},
    {id:'no-store',category:'Setup and customization',question:'What if my store does not appear when I add a theme?',answer:'Check that you are signed in to the right LetBuyy account and have permission to manage that store. Open the merchant workspace to review the store. The marketplace cannot grant ownership or bypass store permissions, and a public theme demo does not require store access.',href:'/support',linkLabel:'Troubleshoot installation'},
    {id:'updates',category:'After installation',question:'How do I review a theme update?',answer:'Open Installations to compare the installed and current catalog versions, then use the available review action to continue in the merchant theme workflow. Read the changelog, review your customization, and check the candidate version with your own content before publishing.',href:'/guides/updates-and-rollback',linkLabel:'Read the update guide'},
    {id:'rollback',category:'After installation',question:'Can I go back to a previous release?',answer:'An eligible prior release can expose a rollback action in Installations. Review the store, theme, and target release before using it. Availability depends on release history and the current package state. Rolling back a theme release does not restore orders or product data.',href:'/dashboard/installations',linkLabel:'Review release history'},
    {id:'downloads',category:'After installation',question:'Why can I install a theme but not download every format?',answer:'Store installation and standalone artifact downloads are different capabilities. Downloads require the relevant entitlement and actual package files for that platform. Check the listing’s platform support and your Downloads page; an absent file does not by itself mean the store installation failed.',href:'/dashboard/downloads',linkLabel:'Check available downloads'},
    {id:'support-scope',category:'After installation',question:'Who should I contact about a theme issue?',answer:'Use the listing’s author information and available documentation for a theme-specific question. Contact LetBuyy support for marketplace access, installation, receipt, or entitlement concerns. Include the theme version, affected page, and steps to reproduce without sharing credentials or private preview tokens.',href:'/contact',linkLabel:'View contact options'},
];
