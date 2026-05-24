# LetBuyy Platform — Shopify-Inspired Comprehensive Analysis

> **Part 2 of 8** | Onboarding Flow — Contextual Questions & Site Type Paths
>
> **Date:** February 13, 2026 | **Version:** 4.0 (Shopify-Inspired Rebuild)
>
> **Prev:** [Part 1](./Shopify_Inspired_Analysis_Part1_Architecture.md) | **Next:** Part 3 (Store Management UI)

---

## 7. Contextual Onboarding System

### 7.1 Question Flow Decision Tree

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    ONBOARDING QUESTION FLOW — DECISION TREE                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  UNIVERSAL QUESTION 1:                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ "What type of site do you want to build?"                             │  │
│  │ We'll customize your experience based on your selection               │  │
│  │                                                                        │  │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │  │
│  │ │    🛒    │ │    💼    │ │    📄    │ │    🚀    │ │    📝    │     │  │
│  │ │          │ │          │ │          │ │          │ │          │     │  │
│  │ │E-commerce│ │Portfolio │ │  Resume  │ │ Landing  │ │ Blogger  │     │  │
│  │ │   Store  │ │   Site   │ │  / CV    │ │   Page   │ │  Site    │     │  │
│  │ │          │ │          │ │          │ │          │ │          │     │  │
│  │ │ Sell     │ │ Showcase │ │ Display  │ │ Promote  │ │ Write &  │     │  │
│  │ │ products │ │ your work│ │ your     │ │ a single │ │ publish  │     │  │
│  │ │ online   │ │ & skills │ │ career   │ │ offering │ │ articles │     │  │
│  │ └─────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │  │
│  └────────┼───────────┼────────────┼────────────┼────────────┼───────────┘  │
│           │           │            │            │            │              │
│     ┌─────┴─────┐     │            │            │            │              │
│     │ E-COMMERCE│     │            │            │            │              │
│     └─────┬─────┘     │            │            │            │              │
│           │           │            │            │            │              │
│           ▼           ▼            ▼            ▼            ▼              │
│  ┌────────────┐ ┌───────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ Question 2A│ │Question 2B│ │Quest 2C │ │Quest 2D │ │Quest 2E │         │
│  │ (E-comm)   │ │(Portfolio)│ │(Resume) │ │(Landing)│ │(Blogger)│         │
│  └────────────┘ └───────────┘ └─────────┘ └─────────┘ └─────────┘         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 E-commerce Path Questions

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                     E-COMMERCE ONBOARDING PATH                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 2A: What do you plan to sell?                                      │
│  We'll suggest the best features and tools for your products                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │                  │  │                  │  │                  │          │
│  │  Products I buy  │  │  Dropshipping    │  │  Digital         │          │
│  │  or make myself  │  │  products        │  │  products        │          │
│  │                  │  │                  │  │                  │          │
│  │  Shipped by me   │  │  Sourced and     │  │  Music, digital  │          │
│  │                  │  │  shipped by a    │  │  art, NFTs       │          │
│  │                  │  │  third party     │  │                  │          │
│  └─────────☐────────┘  └─────────☐────────┘  └─────────☐────────┘          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │                  │  │                  │  │                  │          │
│  │  Print-on-demand │  │  Services        │  │  I'll decide     │          │
│  │  products        │  │                  │  │  later           │          │
│  │                  │  │  Coaching,       │  │                  │          │
│  │  My designs,     │  │  housekeeping,   │  │                  │          │
│  │  printed and     │  │  consulting      │  │                  │          │
│  │  shipped by a    │  │                  │  │                  │          │
│  │  third party     │  │                  │  │                  │          │
│  └─────────☐────────┘  └─────────☐────────┘  └─────────☐────────┘          │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                       (disabled if none)     │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 3 (E-commerce): Is this shop for a new or existing business?       │
│  This helps us suggest the right onboarding                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐     │
│  │                                │  │                                │     │
│  │                                │  │                                │     │
│  │     New business or idea       │  │     Existing business          │     │
│  │                                │  │                                │     │
│  │                                │  │                                │     │
│  └────────────────────────────────┘  └────────────────────────────────┘     │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 4 (E-commerce): Where would you like to sell?                      │
│  We'll make sure you're set up to sell in these places                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ☐ An online store                         ☐ In person at a retail store    │
│     Create a fully customizable website       Brick-and-mortar stores        │
│                                                                              │
│  ☐ In person at events                     ☐ An existing website or blog    │
│     Markets, fairs, and pop-ups                Add a Buy Button to your      │
│                                                website                        │
│                                                                              │
│  ☐ Social media                            ☐ Online marketplaces             │
│     Reach customers on Facebook,               List products on Amazon,      │
│     Instagram, TikTok, and more                Etsy, and more                │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 5 (Universal): Almost done! What should we call your store?        │
│  You can change your store name anytime                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Store name                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ myawesomestore                                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Your store URL will be: myawesomestore.letbuyy.store                        │
│                                                                              │
│  [◄ Back]                                      [I'll do this later →]       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Portfolio Path Questions

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                     PORTFOLIO ONBOARDING PATH                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 2B: What's your profession or industry?                            │
│  We'll customize your portfolio template accordingly                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Designer        │  │  Developer       │  │  Photographer    │          │
│  │  (UI/UX/Graphic) │  │  (Web/Mobile/FS) │  │  (Events/Product)│          │
│  └─────────☐────────┘  └─────────☐────────┘  └─────────☐────────┘          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Writer/Copywriter│ │  Marketing       │  │  Artist          │          │
│  └─────────☐────────┘  └─────────☐────────┘  └─────────☐────────┘          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                                │
│  │  Architect       │  │  Other           │                                │
│  └─────────☐────────┘  └─────────☐────────┘                                │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 3 (Portfolio): What would you like to showcase?                    │
│  Select all that apply                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ☐ Project portfolio / Gallery                                              │
│     Display your completed work with images and descriptions                 │
│                                                                              │
│  ☐ Case studies                                                              │
│     In-depth breakdowns of your process and results                          │
│                                                                              │
│  ☐ Services offered                                                          │
│     List the services you provide with pricing                               │
│                                                                              │
│  ☐ Testimonials & reviews                                                    │
│     Client feedback and ratings                                              │
│                                                                              │
│  ☐ Blog / Insights                                                           │
│     Share your thoughts and industry knowledge                               │
│                                                                              │
│  ☐ Contact form                                                              │
│     Let potential clients reach you easily                                   │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 4 (Portfolio): What's your main goal?                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐     │
│  │  Attract new clients           │  │  Showcase my work               │     │
│  │  (Optimize for conversions)    │  │  (Focus on presentation)        │     │
│  └────────────────────────────────┘  └────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐     │
│  │  Build my personal brand       │  │  Job hunting                    │     │
│  └────────────────────────────────┘  └────────────────────────────────┘     │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 5 (Universal): What should we call your portfolio?                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  Site name                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ johnsmith-design                                                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Your portfolio URL: johnsmith-design.letbuyy.store                          │
│                                                                              │
│  [◄ Back]                                      [I'll do this later →]       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Resume/CV Path Questions

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                       RESUME/CV ONBOARDING PATH                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 2C: What's your current career stage?                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Student /       │  │  Entry Level     │  │  Mid-Career      │          │
│  │  Recent Graduate │  │  (0-2 years)     │  │  (3-7 years)     │          │
│  └─────────☐────────┘  └─────────☐────────┘  └─────────☐────────┘          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                                │
│  │  Senior /        │  │  Executive /     │                                │
│  │  Lead (8+ years) │  │  C-Level         │                                │
│  └─────────☐────────┘  └─────────☐────────┘                                │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 3 (Resume): What would you like to include?                        │
│  Select all sections you want on your digital resume                         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ☑ Work Experience (required)                                                │
│     Job history with roles and achievements                                  │
│                                                                              │
│  ☑ Education (required)                                                      │
│     Degrees, certifications, and courses                                     │
│                                                                              │
│  ☐ Skills & Expertise                                                        │
│     Technical and soft skills with proficiency levels                        │
│                                                                              │
│  ☐ Projects & Portfolio                                                      │
│     Showcase specific work samples                                           │
│                                                                              │
│  ☐ Publications & Research                                                   │
│     Academic papers, articles, blog posts                                    │
│                                                                              │
│  ☐ Awards & Achievements                                                     │
│     Recognition and honors received                                          │
│                                                                              │
│  ☐ Recommendations                                                           │
│     Testimonials from colleagues and managers                                │
│                                                                              │
│  ☐ Languages                                                                 │
│     Language proficiency levels                                              │
│                                                                              │
│  ☐ Volunteer Experience                                                      │
│     Community service and non-profit work                                    │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 4 (Resume): Preferred resume style?                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐     │
│  │                                │  │                                │     │
│  │  Classic / Professional        │  │  Modern / Creative             │     │
│  │  Clean, traditional layout     │  │  Bold, design-forward          │     │
│  │  (Corporate, Finance, Legal)   │  │  (Design, Marketing, Startup)  │     │
│  │                                │  │                                │     │
│  └────────────────────────────────┘  └────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐     │
│  │                                │  │                                │     │
│  │  Minimalist                    │  │  Academic                      │     │
│  │  Simple, focused               │  │  Research-oriented             │     │
│  │  (Tech, Consulting)            │  │  (PhD, Postdoc, Professor)     │     │
│  │                                │  │                                │     │
│  └────────────────────────────────┘  └────────────────────────────────┘     │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 5 (Universal): What should we call your resume site?               │
├──────────────────────────────────────────────────────────────────────────────┤
│  Site name                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ sarah-johnson-cv                                                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Your resume URL: sarah-johnson-cv.letbuyy.store                             │
│                                                                              │
│  [◄ Back]                                      [I'll do this later →]       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.5 Landing Page Path Questions

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                     LANDING PAGE ONBOARDING PATH                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 2D: What's the primary goal of your landing page?                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Product Launch  │  │  Lead Generation │  │  Event Promotion │          │
│  │  Announce a new  │  │  Collect emails  │  │  Webinar, conf,  │          │
│  │  product/service │  │  for newsletter  │  │  or workshop     │          │
│  └─────────☐────────┘  └─────────☐────────┘  └─────────☐────────┘          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  App Download    │  │  Course/eBook    │  │  Waitlist/Beta   │          │
│  │  Promote mobile  │  │  Sell digital    │  │  Signup for      │          │
│  │  app downloads   │  │  content         │  │  upcoming launch │          │
│  └─────────☐────────┘  └─────────☐────────┘  └─────────☐────────┘          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                                │
│  │  Service Signup  │  │  Other           │                                │
│  │  SaaS trial or   │  │                  │                                │
│  │  subscription    │  │                  │                                │
│  └─────────☐────────┘  └─────────☐────────┘                                │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 3 (Landing): What's your target audience?                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐     │
│  │  B2B (Business customers)      │  │  B2C (Individual consumers)    │     │
│  └────────────────────────────────┘  └────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐     │
│  │  Students / Educators          │  │  Entrepreneurs / Startups      │     │
│  └────────────────────────────────┘  └────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────┐                                         │
│  │  General / Mixed audience      │                                         │
│  └────────────────────────────────┘                                         │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 4 (Landing): Desired call-to-action?                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ☐ Email signup form                                                         │
│     Collect email addresses for your mailing list                            │
│                                                                              │
│  ☐ Button link (external)                                                    │
│     Link to app store, external site, or checkout                            │
│                                                                              │
│  ☐ Contact form                                                              │
│     Let visitors send you a message directly                                 │
│                                                                              │
│  ☐ Calendar booking                                                          │
│     Schedule meetings or calls (requires integration)                        │
│                                                                              │
│  ☐ Download button                                                           │
│     Offer PDF, ebook, or resource download                                   │
│                                                                              │
│  ☐ Multiple CTAs                                                             │
│     Combine several actions on one page                                      │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 5 (Universal): Name your landing page                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  Page name                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ product-launch-2026                                                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Your page URL: product-launch-2026.letbuyy.store                            │
│                                                                              │
│  [◄ Back]                                      [I'll do this later →]       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.6 Blogger Path Questions

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                       BLOGGER ONBOARDING PATH                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 2E: What topics will you write about?                              │
│  We'll suggest categories and customize your blog layout                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Technology      │  │  Lifestyle       │  │  Business &      │          │
│  │  (Dev, AI, Tech) │  │  (Health, Food)  │  │  Entrepreneurship│          │
│  └─────────☐────────┘  └─────────☐────────┘  └─────────☐────────┘          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Travel          │  │  Personal        │  │  Education       │          │
│  │                  │  │  Development     │  │                  │          │
│  └─────────☐────────┘  └─────────☐────────┘  └─────────☐────────┘          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Finance         │  │  Arts & Culture  │  │  Other           │          │
│  └─────────☐────────┘  └─────────☐────────┘  └─────────☐────────┘          │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 3 (Blogger): How often do you plan to post?                        │
│  This helps us configure notifications and publishing features               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐     │
│  │  Daily or multiple times/week  │  │  Weekly                        │     │
│  └────────────────────────────────┘  └────────────────────────────────┘     │
│                                                                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐     │
│  │  Bi-weekly / Monthly           │  │  Occasionally / When inspired  │     │
│  └────────────────────────────────┘  └────────────────────────────────┘     │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 4 (Blogger): What features do you need?                            │
│  Select all that apply                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ☑ Comments & Discussions (required)                                         │
│     Let readers comment on your posts                                        │
│                                                                              │
│  ☐ Email Newsletter                                                          │
│     Send new posts to subscribers via email                                  │
│                                                                              │
│  ☐ Social Sharing                                                            │
│     Easy sharing on social media platforms                                   │
│                                                                              │
│  ☐ SEO & Analytics                                                           │
│     Track traffic and optimize for search engines                            │
│                                                                              │
│  ☐ Monetization                                                              │
│     Display ads, sponsored posts, or memberships                             │
│                                                                              │
│  ☐ Multiple Authors                                                          │
│     Collaborate with co-authors                                              │
│                                                                              │
│  [◄ Back]                                             [Next →]              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  QUESTION 5 (Universal): Name your blog                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  Blog name                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ tech-insights-daily                                                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Your blog URL: tech-insights-daily.letbuyy.store                            │
│                                                                              │
│  [◄ Back]                                      [I'll do this later →]       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Question Responses → Dashboard Configuration

### 8.1 Data Mapping

```typescript
// Types for onboarding responses
interface OnboardingResponses {
  siteType: 'ecommerce' | 'portfolio' | 'resume' | 'landing' | 'blogger'
  
  // E-commerce specific
  productType?: string[]
  businessStage?: 'new' | 'existing'
  sellingChannels?: string[]
  
  // Portfolio specific
  profession?: string
  showcaseItems?: string[]
  primaryGoal?: string
  
  // Resume specific
  careerStage?: string
  resumeSections?: string[]
  resumeStyle?: string
  
  // Landing specific
  landingGoal?: string
  targetAudience?: string
  ctaType?: string[]
  
  // Blogger specific
  blogTopics?: string[]
  postingFrequency?: string
  blogFeatures?: string[]
  
  // Universal
  siteName: string
}

// Store configuration generated from responses
interface StoreConfig {
  // Enabled features
  features: {
    ecommerce?: {
      inventory: boolean
      shipping: boolean
      payments: boolean
      dropshipping: boolean
      digitalProducts: boolean
    }
    portfolio?: {
      gallery: boolean
      caseStudies: boolean
      services: boolean
      testimonials: boolean
      blog: boolean
    }
    resume?: {
      workExperience: boolean
      education: boolean
      skills: boolean
      projects: boolean
      publications: boolean
      awards: boolean
    }
    blog?: {
      comments: boolean
      newsletter: boolean
      seo: boolean
      monetization: boolean
      multiAuthor: boolean
    }
  }
  
  // Dashboard modules to show
  dashboardModules: string[]
  
  // Sidebar menu structure
  sidebarMenu: MenuItem[]
  
  // Default theme/template
  template: string
  
  // Suggested first actions
  quickActions: QuickAction[]
}

// Mapping function
export function generateStoreConfig(
  responses: OnboardingResponses
): StoreConfig {
  const config: StoreConfig = {
    features: {},
    dashboardModules: [],
    sidebarMenu: [],
    template: '',
    quickActions: []
  }
  
  switch (responses.siteType) {
    case 'ecommerce':
      config.features.ecommerce = {
        inventory: true,
        shipping: !responses.productType?.includes('digital'),
        payments: true,
        dropshipping: responses.productType?.includes('dropshipping') || false,
        digitalProducts: responses.productType?.includes('digital') || false
      }
      
      config.dashboardModules = [
        'overview',
        'products',
        'orders',
        'customers',
        'analytics'
      ]
      
      config.sidebarMenu = [
        { icon: '📊', label: 'Dashboard', path: '/' },
        { icon: '🛍️', label: 'Products', path: '/products' },
        { icon: '📦', label: 'Orders', path: '/orders' },
        { icon: '👥', label: 'Customers', path: '/customers' },
        { icon: '💰', label: 'Payments', path: '/payments' },
        { icon: '📊', label: 'Analytics', path: '/analytics' },
        { icon: '🎨', label: 'Theme', path: '/theme' },
        { icon: '⚙️', label: 'Settings', path: '/settings' }
      ]
      
      config.quickActions = [
        { label: 'Add your first product', action: 'create_product' },
        { label: 'Setup payment methods', action: 'setup_payments' },
        { label: 'Configure shipping', action: 'setup_shipping' },
        { label: 'Customize your store', action: 'customize_theme' }
      ]
      break
    
    case 'portfolio':
      // Similar configuration for portfolio...
      break
    
    case 'blogger':
      config.features.blog = {
        comments: responses.blogFeatures?.includes('Comments') || true,
        newsletter: responses.blogFeatures?.includes('Email Newsletter') || false,
        seo: responses.blogFeatures?.includes('SEO & Analytics') || false,
        monetization: responses.blogFeatures?.includes('Monetization') || false,
        multiAuthor: responses.blogFeatures?.includes('Multiple Authors') || false
      }
      
      config.dashboardModules = [
        'overview',
        'posts',
        'categories',
        'comments',
        'analytics'
      ]
      
      config.sidebarMenu = [
        { icon: '📊', label: 'Dashboard', path: '/' },
        { icon: '📝', label: 'Posts', path: '/posts' },
        { icon: '📁', label: 'Categories', path: '/categories' },
        { icon: '🏷️', label: 'Tags', path: '/tags' },
        { icon: '💬', label: 'Comments', path: '/comments' },
        { icon: '📸', label: 'Media', path: '/media' },
        { icon: '📊', label: 'Analytics', path: '/analytics' },
        { icon: '🎨', label: 'Theme', path: '/theme' },
        { icon: '⚙️', label: 'Settings', path: '/settings' }
      ]
      
      config.quickActions = [
        { label: 'Write your first post', action: 'create_post' },
        { label: 'Setup categories', action: 'create_categories' },
        { label: 'Customize blog theme', action: 'customize_theme' },
        { label: 'Configure SEO', action: 'setup_seo' }
      ]
      break
  }
  
  return config
}
```

### 8.2 Database Storage

```sql
-- Add onboarding_responses column to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS onboarding_responses JSONB DEFAULT '{}';

-- Add store_config column (generated from responses)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_config JSONB DEFAULT '{}';

-- Example stored data:
{
  "onboarding_responses": {
    "siteType": "blogger",
    "blogTopics": ["Technology", "Personal Development"],
    "postingFrequency": "Weekly",
    "blogFeatures": ["Comments & Discussions", "Email Newsletter", "SEO & Analytics"],
    "siteName": "tech-insights-daily"
  },
  "store_config": {
    "features": {
      "blog": {
        "comments": true,
        "newsletter": true,
        "seo": true,
        "monetization": false,
        "multiAuthor": false
      }
    },
    "dashboardModules": ["overview", "posts", "categories", "comments", "analytics"],
    "template": "blogger-modern",
    "quickActions": [...]
  }
}
```

---

> **→ Continues in Part 3:** Store Management UI — Multi-Store Switcher, Badge System, Dashboard Variants

---

## Document Navigation

| Part | Content |
|------|---------|
| [Part 1](./Shopify_Inspired_Analysis_Part1_Architecture.md) | Architecture & Trial System, URL Routing |
| **Part 2** (this) | Onboarding Flow — Site Type Questions & Paths |
| Part 3 | Store Management UI — Switcher, Badges, Multi-Store |
| Part 4 | Trial & Payment UI — Modals, Countdown, Reactivation |
| Part 5 | Complete Database Schema — All Tables |
| Part 6 | Admin Dashboard Variants — Per Site Type |
| Part 7 | Deployment & Migration — Step-by-Step |
| Part 8 | Implementation Roadmap — Timeline & Phases |