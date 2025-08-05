import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useToast } from './ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const TestB2Connection = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const testConnection = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      console.log('🧪 Testing B2 connection...');
      
      const { data, error } = await supabase.functions.invoke('b2-file-manager', {
        body: { action: 'test_connection' }
      });
      
      if (error) {
        console.error('❌ Test failed:', error);
        setResult({ success: false, message: error.message });
        toast({
          title: "Teste de Conexão Falhou",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('✅ Test successful:', data);
        setResult({ success: true, message: data.message });
        toast({
          title: "Conexão B2 Testada",
          description: "Conexão com Backblaze B2 está funcionando!",
        });
      }
    } catch (error) {
      console.error('❌ Test error:', error);
      const message = error.message || 'Erro desconhecido';
      setResult({ success: false, message });
      toast({
        title: "Erro no Teste",
        description: message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Teste de Conexão B2</CardTitle>
        <CardDescription>
          Teste a conectividade com o Backblaze B2
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testConnection} 
          disabled={testing}
          variant="outline"
        >
          {testing ? 'Testando...' : 'Testar Conexão B2'}
        </Button>
        
        {result && (
          <div className={`p-3 rounded-md ${
            result.success 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="font-medium">
              {result.success ? '✅ Sucesso' : '❌ Falha'}
            </div>
            <div className="text-sm mt-1">
              {result.message}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};