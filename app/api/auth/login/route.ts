import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hashToken, verifyPassword } from '@/lib/auth/crypto';
import { SESSION_DURATION, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION } from '@/lib/auth/utils';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Configuration serveur incorrecte' },
        { status: 500 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      );
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        tenant:tenants(*),
        stores:stores(*)
      `)
      .eq('email', email.toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Identifiants invalides' },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return NextResponse.json(
        { error: 'Compte verrouillé', lockedUntil: user.locked_until },
        { status: 423 }
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Compte désactivé' },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      // Increment failed attempts
      const newAttempts = user.failed_attempts + 1;
      const updates: Record<string, unknown> = { failed_attempts: newAttempts };

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION);
        updates.locked_until = lockedUntil.toISOString();
      }

      await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      return NextResponse.json(
        { error: 'Identifiants invalides' },
        { status: 401 }
      );
    }

    // Reset failed attempts and update last login
    await supabase
      .from('users')
      .update({
        failed_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Create session token
    const token = crypto.randomUUID();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION);

    // Create session in database
    await supabase.from('sessions').insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });

    // Get tenant's stores
    const { data: stores } = await supabase
      .from('stores')
      .select('*')
      .eq('tenant_id', user.tenant_id);

    // Create audit log
    await supabase.from('audit_logs').insert({
      tenant_id: user.tenant_id,
      user_id: user.id,
      action: 'LOGIN',
      entity: 'users',
      entity_id: user.id,
    });

    // Return user data (excluding sensitive info)
    const { password_hash: _, ...safeUser } = user;

    return NextResponse.json({
      user: safeUser,
      tenant: user.tenant,
      stores: stores || [],
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
