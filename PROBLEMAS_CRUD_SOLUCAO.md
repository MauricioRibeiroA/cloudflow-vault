# Soluções para Problemas do CRUD - CloudFlow Vault

## ❌ Problemas Identificados

1. **Nenhum usuário no sistema** - Tabela `profiles` vazia
2. **Edge Functions sem variáveis de ambiente** - Credenciais do Backblaze não configuradas
3. **Falta de dados iniciais** - Sistema precisa de bootstrap

## ✅ Soluções Implementadas

### 1. Sistema de Bootstrap Automático

O sistema agora detecta automaticamente quando não há usuários e mostra uma tela de configuração inicial.

**O que foi feito:**
- Integrei o `BootstrapCheck` ao App principal
- Quando você acessar `http://localhost:8080`, verá uma tela para criar o primeiro Super Admin

### 2. Logs de Debug Melhorados

Adicionei logs detalhados para identificar problemas:
- Console do navegador mostra detalhes das requisições
- Erros específicos são exibidos

## 🚀 Como Resolver - Passo a Passo

### Passo 1: Iniciar o Projeto
```bash
cd /home/mauricio/cloudflow-vault
npm run dev
```

### Passo 2: Acessar e Criar Usuário
1. Abra: http://localhost:8080
2. Se aparecer a tela de "Configuração Inicial do Sistema", preencha:
   - Nome Completo: Seu nome
   - Email: seu@email.com
   - Senha: uma senha segura (mínimo 6 caracteres)
3. Clique em "Criar Super Admin"

### Passo 3: Configurar Backblaze no Supabase
1. Acesse: https://supabase.com/dashboard/project/hklknoybvonvzwfjvqjl/settings/functions
2. Na seção "Environment Variables", adicione:
   ```
   B2_ACCESS_KEY_ID = sua_key_id_do_backblaze
   B2_SECRET_ACCESS_KEY = sua_secret_key_do_backblaze
   B2_REGION = us-west-000
   B2_ENDPOINT = https://s3.us-west-000.backblazeb2.com
   B2_BUCKET_NAME = nome_do_seu_bucket
   ```

### Passo 4: Testar o Sistema
1. Faça login no sistema
2. Vá para `/upload`
3. Abra F12 (DevTools) > Console para ver os logs
4. Teste criar uma pasta
5. Teste fazer upload de arquivo

## 🔧 Como Obter Credenciais do Backblaze

### 1. Criar Conta Backblaze
- Acesse: https://www.backblaze.com/b2/cloud-storage.html
- Crie uma conta gratuita (10GB grátis)

### 2. Criar Bucket
- No painel B2, vá em "Buckets"
- Clique "Create a Bucket"
- Nome: algo como `cloudflow-vault-teste`
- Configurações: Public ou Private (recomendo Private)

### 3. Gerar App Key
- Vá em "App Keys"
- Clique "Add a New Application Key"
- Nome: `CloudFlow Vault`
- Bucket: Selecione o bucket criado
- Capabilities: Todas (ou pelo menos Read/Write/Delete)
- Anote a **Key ID** e **Application Key**

### 4. Configurar Região
- Verifique a região do seu bucket
- Geralmente é `us-west-000` para novos buckets
- Endpoint correspondente: `https://s3.us-west-000.backblazeb2.com`

## 🐛 Debugging

### Ver Logs no Navegador
1. F12 > Console
2. Os logs mostram:
   - Payload enviado para Edge Functions
   - Resposta das Edge Functions
   - Erros específicos

### Testar Edge Functions Diretamente
Use o arquivo `test-functions.html`:
1. Abra no navegador
2. Faça login no sistema principal
3. Copie o token de autenticação
4. Cole no campo e teste as funções

### Verificar Tabelas no Supabase
- Dashboard: https://supabase.com/dashboard/project/hklknoybvonvzwfjvqjl/editor
- Verifique se existem dados em:
  - `profiles` (usuários)
  - `folders` (pastas)
  - `files` (arquivos)

## 📝 Próximos Passos Após Resolver

1. **Teste Completo do CRUD:**
   - ✅ Criar pasta
   - ✅ Listar pastas
   - ✅ Upload arquivo
   - ✅ Listar arquivos
   - ✅ Download arquivo
   - ✅ Deletar arquivo

2. **Melhorias Futuras:**
   - Upload de múltiplos arquivos
   - Barra de progresso
   - Preview de imagens
   - Organização por data/tipo

## ⚠️ Problemas Comuns

### "Failed to send request to edge function"
- **Causa:** Variáveis de ambiente não configuradas no Supabase
- **Solução:** Seguir Passo 3 acima

### "Invalid user profile"
- **Causa:** Usuário não tem registro na tabela `profiles`
- **Solução:** Use o BootstrapCheck para criar o primeiro usuário

### "No authorization header"
- **Causa:** Token de autenticação inválido/expirado
- **Solução:** Faça logout e login novamente

### Edge Functions não respondem
- **Causa:** Funções podem estar em cold start
- **Solução:** Aguarde alguns segundos e tente novamente
