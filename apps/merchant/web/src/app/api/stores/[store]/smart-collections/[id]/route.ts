import { NextRequest } from 'next/server'
import { collectionMetadataMutation, collectionMetadataRead } from '@/lib/products/collection-metadata-proxy'
type Params = { params: Promise<{ store: string; id: string }> }
export const GET = async (request: NextRequest, { params }: Params) => collectionMetadataRead(request, params, 'smart', (await params).id)
export const PATCH = async (request: NextRequest, { params }: Params) => collectionMetadataMutation(request, params, 'smart', 'update', (await params).id)
export const DELETE = async (request: NextRequest, { params }: Params) => collectionMetadataMutation(request, params, 'smart', 'delete', (await params).id)
