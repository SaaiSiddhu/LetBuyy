
import Copy from '@/components/i18n/Copy'
import Image from 'next/image'
import Link from '@/components/i18n/LocaleLink'
import { ArrowRight, Check } from '@letbuyy/ui'

const STORIES = [
  {
    id: 'build',
    number: '01',
    chapter: 'Make it yours',
    title: 'Your products. Your own online store.',
    description: 'Give your business a home online, with your branding and a storefront that works on phones, tablets and computers.',
    steps: ['Choose a theme and make it your own.', 'Add product photos, prices, sizes and stock.', 'Preview your shop, connect your domain and publish.'],
    image: '/illustrations/how-it-works/build-store-v1.webp',
    link: '/resources/platform/how-themes-work',
    linkText: 'Explore storefront themes',
  },
  {
    id: 'sell',
    number: '02',
    chapter: 'Start selling',
    title: 'From a customer’s basket to a packed order.',
    description: 'Share your store link. Let customers browse and buy, then manage each order from your merchant workspace.',
    steps: ['Offer the payment methods you have enabled.', 'See purchases, payment status and stock together.', 'Prepare shipments, add tracking and handle returns.'],
    image: '/illustrations/how-it-works/fulfill-order-v1.webp',
    link: '/resources/operations/order-fulfillment-guide',
    linkText: 'See how order fulfilment works',
  },
  {
    id: 'grow',
    number: '03',
    chapter: 'Keep them coming back',
    title: 'Turn a first purchase into a relationship.',
    description: 'Understand who buys from you, share your next collection and use your sales reports to decide what to do next.',
    steps: ['Find customer profiles and purchase history.', 'Prepare email campaigns for subscribed customers.', 'Review orders and revenue to plan your next move.'],
    image: '/illustrations/how-it-works/grow-customers-v1.webp',
    link: '/resources/growth/email-marketing-ecommerce',
    linkText: 'Read the email marketing guide',
  },
] as const

const SALE_STEPS = [
  { id: 'order', title: 'See the order', text: 'The products, buyer and delivery details are together.' },
  { id: 'payment', title: 'Check the payment', text: 'Know whether it is paid, pending or cash on delivery.' },
  { id: 'stock', title: 'Keep stock accurate', text: 'Review available quantities before the next sale.' },
  { id: 'delivery', title: 'Prepare delivery', text: 'Pack the order and keep shipment progress up to date.' },
] as const

const EVERYDAY_TASKS = [
  { title: 'An order comes in', text: 'Open the order to see the items, customer, payment and delivery details. Follow its progress from preparation through delivery.' },
  { title: 'A payment needs checking', text: 'Look at the order’s payment status and transaction details. An online payment and a cash-on-delivery order can be followed separately.' },
  { title: 'A customer needs a refund', text: 'Review the order and refund details in your workspace. Follow the refund status through your connected payment provider rather than assuming it has completed.' },
  { title: 'A product is running low', text: 'Check quantities for each product and variant, review stock history and prepare a restock or purchase order.' },
  { title: 'You have a new collection to share', text: 'Create an email campaign, choose subscribed customers or a customer segment, preview the audience and review the message before sending. Live email delivery requires email setup.' },
  { title: 'You want to understand your earnings', text: 'Review sales, payments, refunds and available settlement information. Payment-provider processing and settlement timing are separate from an order being placed.' },
] as const

/** Customer explanation of the connected platform; examples are illustrative, not live activity. */
export function Features() {
  return (
    <section className="how-it-works" id="features" aria-labelledby="how-heading">
      <div className="container">
        <header className="how-header">
          <p className="section-label"><Copy text={"How LetBuyy works"} /></p>
          <h2 id="how-heading"><Copy text={"Build your store."} /><br /><Copy text={"Run the business behind it."} /></h2>
          <p><Copy text={"LetBuyy brings your online shop, orders and customer tools into one workspace. Here’s how they help you, from opening day to your next collection."} /></p>
        </header>

        <ol className="how-stories" aria-label="From creating your store to growing your business">
          {STORIES.map(story => (
            <li className={`how-story how-story--${story.id}`} key={story.id}>
              <div className="how-story-chapter"><span>{story.number}</span><p><Copy text={story.chapter} /></p></div>
              <figure className="how-story-figure" aria-hidden="true">
                <Image src={story.image} alt="" width={800} height={600} sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1100px) 45vw, 400px" loading="lazy" unoptimized />
              </figure>
              <h3><Copy text={story.title} /></h3>
              <p className="how-story-description"><Copy text={story.description} /></p>
              <ul className="how-story-checks">
                {story.steps.map(step => <li key={step}><Check width={16} height={16} aria-hidden="true" /><span><Copy text={step} /></span></li>)}
              </ul>
              <Link className="how-guide" href={story.link}><Copy text={story.linkText} /><ArrowRight width={16} height={16} aria-hidden="true" /></Link>
            </li>
          ))}
        </ol>

        <p className="how-availability"><Copy text={"Payment, shipping and email options depend on your plan, account setup and connected providers."} /></p>

        <section className="how-sale" id="order-example" aria-labelledby="order-example-heading">
          <div className="how-sale-hero">
            <div className="how-sale-intro">
              <span className="how-example-label"><Copy text={"An everyday example"} /></span>
              <h3 id="order-example-heading"><Copy text={"One T-shirt sold."} /><br /><Copy text={"The next steps, together."} /></h3>
            </div>
            <p className="how-sale-context"><Copy text={"A customer buys a navy T-shirt from your store. Follow the work that comes next, with the order details in one place."} /></p>
          </div>
          <ol className="how-sale-steps" aria-label="Managing an example T-shirt order">
            {SALE_STEPS.map(({ id, title, text }, index) => (
              <li className={`how-sale-step how-sale-step--${id}`} key={id}>
                <div className="how-sale-step-marker" aria-hidden="true">
                  <Image className="how-sale-art" src={`/illustrations/how-it-works/step-${id}-v1.webp`} alt="" width={160} height={160} sizes="96px" loading="lazy" unoptimized />
                  <span className="how-sale-step-number">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="how-sale-step-copy"><h4><Copy text={title} /></h4><p><Copy text={text} /></p></div>
              </li>
            ))}
          </ol>
        </section>

        <div className="how-everyday">
          <div className="how-everyday-heading">
            <h3><Copy text={"What does that mean for your day?"} /></h3>
            <p><Copy text={"Start with the job you need to do."} /></p>
            <figure className="how-everyday-figure" aria-hidden="true">
              <Image
                src="/illustrations/how-it-works/everyday-merchant-v1.webp"
                alt=""
                width={800}
                height={600}
                sizes="(max-width: 767px) 240px, 340px"
                loading="lazy"
                unoptimized
              />
            </figure>
          </div>
          <div className="how-task-list">
            {EVERYDAY_TASKS.map(task => (
              <details className="how-task" key={task.title}>
                <summary><Copy text={task.title} /><span aria-hidden="true">+</span></summary>
                <p><Copy text={task.text} /></p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Features
