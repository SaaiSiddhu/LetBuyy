import { NextRequest } from 'next/server'
import { validateMerchantMutationRequest } from '../api/request-origin'

export function validateStaffMutationRequest(request: NextRequest, requireKey = true) {
    return validateMerchantMutationRequest(request, {
        requireKey,
        originMessage: 'This staff change must originate from this merchant app.',
        keyMessage: 'A stable staff request key is required.',
    })
}
