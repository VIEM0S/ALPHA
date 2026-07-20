import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email/send';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    // Double clé (IP + email normalisé) : freine à la fois un script qui
    // spamme un seul email cible et un script qui essaie beaucoup d'emails
    // depuis la même IP. 5 demandes / 15 min de chaque côté suffit largement
    // à un usage légitime (un oubli de mot de passe ne justifie pas plus).
    const emailKey = email.trim().toLowerCase();
    const [byIp, byEmail] = await Promise.all([
      checkRateLimit(`forgot-password:ip:${getClientIp(request)}`, 5, 15 * 60),
      checkRateLimit(`forgot-password:email:${emailKey}`, 5, 15 * 60),
    ]);
    if (!byIp.allowed || !byEmail.allowed) {
      // Même réponse générique que le succès (toujours { success: true }) —
      // pas de fuite d'info sur l'existence du compte via le rate-limit non
      // plus, cohérent avec l'anti-énumération déjà en place plus bas.
      return NextResponse.json({ success: true });
    }

    try {
      const link = await adminAuth.generatePasswordResetLink(email);

      // Fix : le lien était auparavant seulement logué en console (jamais envoyé),
      // ce qui rendait la réinitialisation de mot de passe non-fonctionnelle en
      // production, ET exposait un lien de reset valide en clair dans les logs
      // serveur. On l'envoie maintenant réellement par email et on ne logue plus
      // jamais le lien lui-même.
      const result = await sendEmail({
        to: email,
        subject: 'Réinitialisation de votre mot de passe — Yerkoy ERP',
        html: `
          <p>Bonjour,</p>
          <p>Vous avez demandé la réinitialisation de votre mot de passe Yerkoy ERP.</p>
          <p><a href="${link}">Cliquez ici pour choisir un nouveau mot de passe</a></p>
          <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
        `,
      });

      if (!result.sent) {
        // Ne jamais logger `link` (secret) — seulement l'erreur de configuration/envoi.
        console.error('Échec envoi email de reset (config SendGrid manquante ou erreur) :', result.error);
      }
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
