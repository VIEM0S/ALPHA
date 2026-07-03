import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    try {
      const link = await adminAuth.generatePasswordResetLink(email);
      // En production, envoyer ce lien par email via un service (SendGrid, etc.)
      // Pour l'instant, Firebase peut aussi envoyer l'email directement côté client
      console.log('Lien de réinitialisation généré pour', email, ':', link);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      // On ne révèle jamais si l'email existe ou non (sécurité anti-énumération)
      if (code !== 'auth/user-not-found') {
        console.error('Forgot password error:', e);
      }
    }

    // Toujours répondre succès, qu'un compte existe ou non
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
