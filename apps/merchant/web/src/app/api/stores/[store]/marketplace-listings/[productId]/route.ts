import { createMarketplaceListingHandlers } from './handler'

const handlers = createMarketplaceListingHandlers()
export const GET = handlers.GET
export const POST = handlers.POST
