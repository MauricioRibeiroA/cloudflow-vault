# Instruções de Configuração - CloudFlow Vault

## 1. Configurar Backblaze B2

### Passo 1: Criar conta e bucket no Backblaze
1. Acesse https://www.backblaze.com/b2/cloud-storage.html
2. Crie uma conta
3. Vá em "Buckets" e crie um novo bucket
4. Vá em "App Keys" e crie uma chave de aplicação

### Passo 2: Configurar variáveis de ambiente
1. Edite o arquivo `.env.local` na raiz do projeto:

```bash
B2_ACCESS_KEY_ID=sua_key_id_aqui
B2_SECRET_ACCESS_KEY=sua_secret_key_aqui
B2_REGION=us-west-000
B2_ENDPOINT=https://s3.us-west-000.backblazeb2.com
B2_BUCKET_NAME=seu_bucket_name_aqui
```

### Passo 3: Configurar as Edge Functions no Supabase
Você precisa adicionar essas mesmas variáveis no painel do Supabase:

1. Acesse https://supabase.com/dashboard/project/hklknoybvonvzwfjvqjl
2. Vá em Settings > Edge Functions
3. Adicione as variáveis de ambiente:
   - B2_ACCESS_KEY_ID
   - B2_SECRET_ACCESS_KEY
   - B2_REGION
   - B2_ENDPOINT
   - B2_BUCKET_NAME

## 2. Testar localmente

### Rodar o projeto:
```bash
npm run dev
```

### Verificar no browser:
1. Acesse http://localhost:8080
2. Faça login (você precisa ter um usuário cadastrado no Supabase)
3. Vá para a página "/upload"
4. Teste as operações de CRUD

## 3. Debugging

### Abrir DevTools no browser:
1. F12 para abrir DevTools
2. Aba Console para ver os logs
3. Aba Network para ver as requisições HTTP

### Verificar se as Edge Functions estão funcionando:
- Elas estão hospedadas no Supabase, não localmente
- URL base: https://hklknoybvonvzwfjvqjl.supabase.co/functions/v1/

## 4. Problemas comuns

### "Failed to send request to edge function":
- Verifique se as variáveis de ambiente estão corretas no Supabase
- Verifique se o usuário tem perfil ativo no banco de dados
- Verifique se as credenciais do Backblaze estão corretas

### "Invalid user profile":
- O usuário precisa ter um registro na tabela `profiles`
- O campo `status` deve ser 'active'
- Para super_admin, `group_name` deve ser 'super_admin'

### Erros de CORS:
- As Edge Functions já estão configuradas para CORS
- Se persistir, verifique se está acessando pela URL correta
