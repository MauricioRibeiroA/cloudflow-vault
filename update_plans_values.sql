-- =====================================================
-- ATUALIZAR VALORES DOS PLANOS
-- Execute este SQL no Dashboard do Supabase > SQL Editor
-- =====================================================

-- Atualizar os valores dos planos existentes
-- Starter: R$29,90/mês, 100 GB armazenamento, 4 usuários, 30 GB download
-- Pro: R$49,90/mês, 250 GB armazenamento, 6 usuários, 75 GB download
-- Business: R$79,90/mês, 500 GB armazenamento, 12 usuários, 150 GB download

-- Primeiro, vamos limpar os planos existentes e inserir os novos valores
DELETE FROM plans;

-- Inserir os novos planos com os valores atualizados
INSERT INTO plans (name, price_brl, storage_limit_gb, download_limit_gb, max_users) VALUES
('Essencial', 19.90, 30, 10, 2),
('Starter', 29.90, 100, 30, 4),
('Pro', 49.90, 250, 75, 6),
('Business', 79.90, 500, 150, 12);

-- Verificar os planos inseridos
SELECT * FROM plans ORDER BY price_brl;
