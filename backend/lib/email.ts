import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST ?? "";
const smtpPort = Number(process.env.SMTP_PORT ?? 587);
const smtpUser = process.env.SMTP_USER ?? "";
const smtpPass = process.env.SMTP_PASS ?? "";
const smtpFrom = process.env.SMTP_FROM ?? smtpUser;
const appName = process.env.APP_NAME ?? "Acordes Music";

const transporter = smtpUser && smtpPass
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    })
  : null;

export async function sendPasswordResetCode(email: string, codigo: string, nome: string): Promise<void> {
  const subject = `${appName} - Código de Recuperação de Senha`;

  const text = [
    `Olá ${nome},`,
    ``,
    `Recebemos uma solicitação de recuperação de senha no sistema ${appName}.`,
    ``,
    `Seu código de verificação é: ${codigo}`,
    ``,
    `Este código é válido por 15 minutos.`,
    ``,
    `Se você não solicitou esta recuperação, ignore este email.`,
    ``,
    `Atenciosamente,`,
    `Equipe ${appName}`,
  ].join("\n");

  if (!transporter) {
    console.log("=".repeat(50));
    console.log(`[EMAIL] SMTP não configurado. Código gerado para ${email}:`);
    console.log(`  Código: ${codigo}`);
    console.log("=".repeat(50));
    return;
  }

  await transporter.sendMail({
    from: `"${appName}" <${smtpFrom}>`,
    to: email,
    subject,
    text,
  });
}
