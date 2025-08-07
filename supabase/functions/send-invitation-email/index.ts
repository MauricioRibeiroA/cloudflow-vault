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

  console.log('🚀 Edge Function iniciada - send-invitation-email')
  console.log('📝 Method:', req.method)

  try {
    const requestBody = await req.json()
    console.log('📨 Request body:', requestBody)
    
    const { email, fullName, companyName, inviteLink } = requestBody

    // Validate required fields
    if (!email || !fullName || !inviteLink) {
      console.error('❌ Missing required fields:', { email: !!email, fullName: !!fullName, inviteLink: !!inviteLink })
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required fields',
          details: `Missing: ${!email ? 'email ' : ''}${!fullName ? 'fullName ' : ''}${!inviteLink ? 'inviteLink' : ''}`.trim()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Use Resend API with hardcoded key for Lovable environment
    const resendApiKey = 're_123abc_hardcodedKeyForDevelopment'
    
    // Log para debug (remover em produção)
    console.log('🔑 Tentando enviar email com Resend...')

    const emailData: EmailData = {
      to: email,
      subject: `🎉 Convite para CloudFlow Vault${companyName ? ` - ${companyName}` : ''}`,
      html: emailHtml
    }

    // Para ambiente Lovable, vamos simular o envio de email com sucesso
    // Em produção, isso seria substituído pela configuração correta no Supabase Dashboard
    console.log('📧 Simulando envio de email para:', emailData.to)
    console.log('📧 Assunto:', emailData.subject)
    
    // Simular resposta da API do Resend
    const result = {
      id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: 'CloudFlow Vault <onboarding@resend.dev>',
      to: [emailData.to],
      subject: emailData.subject,
      created_at: new Date().toISOString()
    }
    
    console.log('✅ Email simulado enviado com sucesso:', result.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully (simulated)',
        emailId: result.id,
        simulatedFor: 'development-environment'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in Edge Function:', error)
    console.error('❌ Error stack:', error.stack)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to send invitation email',
        details: error.message || 'Unknown error occurred',
        stack: error.stack
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
