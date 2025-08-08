# 📋 Scripts SQL - Guia de Uso

## 🎯 **Scripts Principais (USE APENAS ESTES)**

### 1. `setup_all_plans_fixed.sql` 
**🔧 Script principal para configuração completa de planos**
- ✅ Cria todos os planos (Free Trial, Essencial, Starter, Pro, Business)
- ✅ Configura limites e validações do Free Trial
- ✅ Atualiza empresas existentes para Free Trial
- ✅ Inclui todas as funções necessárias

**Quando usar:** 
- Setup inicial do sistema
- Atualizar valores de planos
- Corrigir problemas de planos em produção

### 2. `debug_company_data.sql`
**🔍 Script de diagnóstico e debug**
- 🧪 Verifica se planos existem
- 🧪 Analisa estrutura das tabelas
- 🧪 Testa funções do sistema
- 🧪 Corrige empresas específicas

**Quando usar:**
- Dashboard mostrando valores zerados
- Problemas com empresas específicas
- Debug de funções SQL

---

## ⚠️ **IMPORTANTE - REGRA DE OURO**

### ✅ **FAÇA:**
- Sempre **atualize** o script existente ao invés de criar novos
- Use **apenas** os 2 scripts principais acima
- Archive scripts antigos na pasta `sql-archive/`

### ❌ **NÃO FAÇA:**
- Criar novos scripts para cada alteração
- Manter múltiplas versões do mesmo script
- Deixar scripts duplicados no root do projeto

---

## 📁 **Organização:**

```
/
├── setup_all_plans_fixed.sql     ← Script principal (sempre atualizar este)
├── debug_company_data.sql         ← Script de debug (sempre atualizar este)
└── sql-archive/                   ← Scripts antigos arquivados
    ├── apply_lovable_security_fixes_FINAL.sql
    ├── create_free_trial_plan.sql
    ├── setup_all_plans.sql        ← Versão antiga
    └── ... (outros scripts obsoletos)
```

---

## 🚀 **Fluxo de Trabalho:**

1. **Para mudanças nos planos:** Editar `setup_all_plans_fixed.sql`
2. **Para debug:** Usar `debug_company_data.sql`
3. **Scripts antigos:** Mover para `sql-archive/`
4. **Commit:** Sempre com mensagem clara da alteração

---

*Esta organização mantém o repositório limpo e evita confusão entre versões de scripts.*
