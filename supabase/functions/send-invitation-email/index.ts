import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailData {
  to: string
  subject: string
  html: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, fullName, companyName, inviteLink } = await req.json()

    // Validate required fields
    if (!email || !fullName || !inviteLink) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Email template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { 
              display: inline-block; 
              background: #4f46e5; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px; 
              margin: 20px 0;
              font-weight: bold;
            }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Convite para CloudFlow Vault</h1>
            </div>
            <div class="content">
              <h2>Olá, ${fullName}!</h2>
              <p>Você foi convidado para fazer parte da equipe${companyName ? ` da <strong>${companyName}</strong>` : ''} no <strong>CloudFlow Vault</strong>.</p>
              
              <p>Para ativar sua conta e definir sua senha, clique no botão abaixo:</p>
              
              <div style="text-align: center;">
                <a href="${inviteLink}" class="button">
                  ✨ Completar Cadastro
                </a>
              </div>
              
              <p>Ou copie e cole este link no seu navegador:</p>
              <p style="background: #e5e7eb; padding: 10px; border-radius: 4px; word-break: break-all;">
                ${inviteLink}
              </p>
              
              <p><strong>⚠️ Importante:</strong></p>
              <ul>
                <li>Este convite expira em <strong>24 horas</strong></li>
                <li>Use o email <strong>${email}</strong> para fazer o cadastro</li>
                <li>Se você não solicitou este convite, pode ignorar este email</li>
              </ul>
            </div>
            <div class="footer">
              <p>Este email foi enviado automaticamente pelo CloudFlow Vault</p>
              <p>Em caso de dúvidas, entre em contato com o administrador da sua empresa</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Use Resend API (you'll need to configure this)
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const emailData: EmailData = {
      to: email,
      subject: `🎉 Convite para CloudFlow Vault${companyName ? ` - ${companyName}` : ''}`,
      html: emailHtml
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CloudFlow Vault <noreply@cloudflowvault.com>',
        to: [emailData.to],
        subject: emailData.subject,
        html: emailData.html,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(`Failed to send email: ${result.message}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        emailId: result.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send invitation email',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
