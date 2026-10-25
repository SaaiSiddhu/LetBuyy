import { bindMadeYoursPersonalization } from '../../../../apps/commerce/web/src/lib/theme-engine/madeyours-personalization'

const controllers = Array.from(document.querySelectorAll<HTMLElement>('lb-add-to-cart')).map(element => {
  const controller = bindMadeYoursPersonalization(element)
  controller?.setBasePurchasable(document.body.dataset.fixtureBaseAvailable === 'true')
  return controller
}).filter(controller => controller !== null)
Object.assign(window, { madeyoursFixture: { draft: () => controllers[0]?.readReviewedDraft() ?? null, destroy: () => controllers.forEach(controller => controller?.destroy()) } })
