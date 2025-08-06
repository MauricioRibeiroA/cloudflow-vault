# 🚨 LOVABLE - INSTRUÇÕES RÁPIDAS

## ⚠️ SISTEMA 100% FUNCIONAL - CUIDADO EXTREMO

### ❌ NUNCA MODIFICAR:
```
❌ src/components/BackblazeUpload.tsx
❌ src/services/backblaze.ts  
❌ supabase/functions/b2-proxy/index.ts
❌ .env files
```

### ✅ SEGURO MODIFICAR:
```
✅ UI components (src/components/ui/*)
✅ CSS/Tailwind
✅ Documentation
✅ Layout components
```

### 🔧 TESTE OBRIGATÓRIO APÓS MUDANÇAS:
1. Upload arquivo ✅
2. Download arquivo ✅  
3. Criar pasta ✅
4. Navegar pasta ✅
5. Deletar arquivo ✅

### 🆘 SE QUEBRAR:
```bash
git reset --hard HEAD~1
```

### 🎯 FOCO:
- Melhorar UI/UX
- Não mexer na lógica de upload/Backblaze
- Uma mudança por vez
- Testar imediatamente

**REGRA DE OURO: SE TIVER DÚVIDA = NÃO MEXA!**
