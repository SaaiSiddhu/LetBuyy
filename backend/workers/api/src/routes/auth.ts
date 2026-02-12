import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const auth = new Hono<{ Bindings: import('../index').Env }>();

// POST /auth/signup — Register new user
auth.post('/signup', async (c) => {
    const { email, password, name } = await c.req.json();

    if (!email || !password) {
        return c.json({ error: { code: 'VALIDATION', message: 'email and password are required' } }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: { name: name || '', role: 'seller' },
        email_confirm: true,
    });

    if (error) {
        return c.json({ error: { code: 'AUTH_ERROR', message: error.message } }, 400);
    }

    // Create user_profiles record
    if (data.user) {
        await supabase.from('user_profiles').insert({
            id: data.user.id,
            email,
            full_name: name || '',
            role: 'seller',
        });
    }

    // TODO: Send welcome email via Resend

    return c.json({ data: { user: data.user } }, 201);
});

// POST /auth/signin — Email + password login
auth.post('/signin', async (c) => {
    const { email, password } = await c.req.json();

    if (!email || !password) {
        return c.json({ error: { code: 'VALIDATION', message: 'email and password are required' } }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return c.json({ error: { code: 'AUTH_ERROR', message: error.message } }, 401);
    }

    return c.json({
        data: {
            user: data.user,
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at,
            },
        },
    });
});

// POST /auth/signin/otp — Request OTP
auth.post('/signin/otp', async (c) => {
    const { email } = await c.req.json();

    if (!email) {
        return c.json({ error: { code: 'VALIDATION', message: 'email is required' } }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
        return c.json({ error: { code: 'AUTH_ERROR', message: error.message } }, 400);
    }

    return c.json({ data: { message: 'OTP sent successfully' } });
});

// POST /auth/signin/otp/verify — Verify OTP
auth.post('/signin/otp/verify', async (c) => {
    const { email, token } = await c.req.json();

    if (!email || !token) {
        return c.json({ error: { code: 'VALIDATION', message: 'email and token are required' } }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
    });

    if (error) {
        return c.json({ error: { code: 'AUTH_ERROR', message: error.message } }, 401);
    }

    return c.json({
        data: {
            user: data.user,
            session: data.session ? {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at,
            } : null,
        },
    });
});

// POST /auth/signout — Logout
auth.post('/signout', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ data: { message: 'Signed out' } });
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
    });

    await supabase.auth.signOut();

    return c.json({ data: { message: 'Signed out successfully' } });
});

// POST /auth/password/reset — Request password reset
auth.post('/password/reset', async (c) => {
    const { email } = await c.req.json();

    if (!email) {
        return c.json({ error: { code: 'VALIDATION', message: 'email is required' } }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://accounts.letbuyy.store/reset-password',
    });

    if (error) {
        return c.json({ error: { code: 'AUTH_ERROR', message: error.message } }, 400);
    }

    return c.json({ data: { message: 'Password reset email sent' } });
});

// POST /auth/password/update — Update password (requires valid session)
auth.post('/password/update', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Token required' } }, 401);
    }

    const { password } = await c.req.json();
    if (!password || password.length < 6) {
        return c.json({ error: { code: 'VALIDATION', message: 'Password must be at least 6 characters' } }, 400);
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
    });

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
        return c.json({ error: { code: 'AUTH_ERROR', message: error.message } }, 400);
    }

    return c.json({ data: { message: 'Password updated successfully' } });
});

export default auth;
