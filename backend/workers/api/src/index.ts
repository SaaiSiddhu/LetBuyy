import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import { rateLimit, authRateLimit } from './middleware/rateLimit';
import storesRouter from './routes/stores';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import authRouter from './routes/auth';
import paymentsRouter from './routes/payments';
import uploadRouter from './routes/upload';
import contactsRouter from './routes/contacts';
import portfolioRouter from './routes/portfolio';
import resumeRouter from './routes/resume';
import employeeRouter from './routes/employee';
import adminRouter from './routes/admin';

// Environment bindings
export interface Env {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    RAZORPAY_KEY_ID: string;
    RAZORPAY_KEY_SECRET: string;
    STRIPE_SECRET_KEY: string;
    R2_BUCKET: R2Bucket;
    RESEND_API_KEY: string;
    ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use(
    '*',
    cors({
        origin: [
            'https://letbuyy.store',
            'https://admin.letbuyy.store',
            'https://accounts.letbuyy.store',
            'https://console.letbuyy.store',
            'https://team.letbuyy.store',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
        ],
        credentials: true,
    })
);

// Health check
app.get('/health', (c) => {
    return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: c.env.ENVIRONMENT,
    });
});

// API version prefix
const api = app.basePath('/v1');

// Public routes (no auth required)
api.use('/auth/*', authRateLimit);
api.route('/auth', authRouter);
api.route('/contacts', contactsRouter);

// Protected routes (auth required)
api.use('/*', authMiddleware);
api.use('/*', rateLimit());

// Mount routers
api.route('/stores', storesRouter);
api.route('/products', productsRouter);
api.route('/orders', ordersRouter);
api.route('/payments', paymentsRouter);
api.route('/upload', uploadRouter);
api.route('/portfolio', portfolioRouter);
api.route('/resume', resumeRouter);
api.route('/employees', employeeRouter);
api.route('/admin', adminRouter);

// 404 handler
app.notFound((c) => {
    return c.json(
        {
            error: {
                code: 'NOT_FOUND',
                message: 'The requested resource was not found',
            },
        },
        404
    );
});

// Error handler
app.onError((err, c) => {
    console.error('API Error:', err);
    return c.json(
        {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An internal error occurred',
            },
        },
        500
    );
});

export default app;
