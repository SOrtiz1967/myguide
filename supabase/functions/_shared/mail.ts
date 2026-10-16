// Envío de correos transaccionales por SMTP (FR-026). Las credenciales vienen del entorno del
// servidor (supabase/.env, nunca del frontend). El envío real por Brevo se verifica en T009.
export interface MailContent {
  subject: string
  text: string
  html: string
}

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  auth?: { user: string; pass: string }
  from: string
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

export function buildVerificationMail(link: string): MailContent {
  const text = [
    'Hola,',
    '',
    'Para confirmar tu correo en MyGuide, abre este enlace:',
    link,
    '',
    'El enlace dura 24 horas y se puede usar una sola vez.',
    'Si no creaste una cuenta en MyGuide, ignora este mensaje.',
  ].join('\n')

  const safeLink = escapeHtml(link)
  const html = [
    '<p>Hola,</p>',
    '<p>Para confirmar tu correo en MyGuide, abre este enlace:</p>',
    `<p><a href="${safeLink}">${safeLink}</a></p>`,
    '<p>El enlace dura 24 horas y se puede usar una sola vez.</p>',
    '<p>Si no creaste una cuenta en MyGuide, ignora este mensaje.</p>',
  ].join('')

  return { subject: 'Confirma tu correo en MyGuide', text, html }
}

export function smtpConfigFromEnv(env: Record<string, string | undefined>): SmtpConfig {
  for (const name of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM_EMAIL']) {
    if (!env[name]) throw new Error(`Falta la variable de servidor ${name}`)
  }
  const port = Number(env.SMTP_PORT)
  const fromName = env.SMTP_FROM_NAME || 'MyGuide'
  return {
    host: env.SMTP_HOST!,
    port,
    secure: port === 465,
    auth: env.SMTP_USER && env.SMTP_PASSWORD
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
    from: `"${fromName}" <${env.SMTP_FROM_EMAIL}>`,
  }
}

/** Envía un correo. Lanza si el proveedor falla o no responde en 10 segundos (Principio VII). */
export async function sendMail(input: { to: string } & MailContent): Promise<void> {
  const config = smtpConfigFromEnv(Deno.env.toObject())
  // Import diferido: nodemailer lee variables de entorno al cargarse y las pruebas de contenido no lo necesitan.
  const { default: nodemailer } = await import('nodemailer')
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  })
  await transport.sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
}
