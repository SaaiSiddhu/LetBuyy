import { NextRequest } from 'next/server'
import { merchantMobileHttp } from '@/lib/auth/mobile-http'
export const POST = (request: NextRequest) => merchantMobileHttp('exchange', request)
