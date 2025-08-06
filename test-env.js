// Teste das variáveis de ambiente no frontend
console.log('=== TESTE DE VARIÁVEIS DE AMBIENTE ===');
console.log('NODE_ENV:', import.meta.env.MODE);
console.log('VITE_B2_ENDPOINT:', import.meta.env.VITE_B2_ENDPOINT);
console.log('VITE_B2_REGION:', import.meta.env.VITE_B2_REGION);
console.log('VITE_B2_ACCESS_KEY_ID:', import.meta.env.VITE_B2_ACCESS_KEY_ID);
console.log('VITE_B2_SECRET_ACCESS_KEY:', import.meta.env.VITE_B2_SECRET_ACCESS_KEY ? '[DEFINIDA]' : '[NÃO DEFINIDA]');
console.log('VITE_B2_BUCKET_NAME:', import.meta.env.VITE_B2_BUCKET_NAME);
console.log('=======================================');
