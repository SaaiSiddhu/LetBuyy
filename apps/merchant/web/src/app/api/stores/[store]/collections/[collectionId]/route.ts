import { NextRequest } from 'next/server'
import { collectionMetadataMutation, collectionMetadataRead } from '@/lib/products/collection-metadata-proxy'
type Params = { params: Promise<{ store: string; collectionId: string }> }
export const GET = async (request: NextRequest, { params }: Params) => collectionMetadataRead(request, params, 'manual', (await params).collectionId)
export const PATCH = async (request: NextRequest, { params }: Params) => collectionMetadataMutation(request, params, 'manual', 'update', (await params).collectionId)
export const DELETE = async (request: NextRequest, { params }: Params) => collectionMetadataMutation(request, params, 'manual', 'delete', (await params).collectionId)
