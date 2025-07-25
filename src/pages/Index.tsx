import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, FileText, Users, Lock, Cloud, Zap } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-3 text-4xl font-bold text-primary mb-6">
            <Shield className="h-12 w-12" />
            CloudFlow Vault
          </div>
          <h1 className="text-5xl font-bold text-foreground mb-6 leading-tight">
            Gestão Inteligente de
            <span className="bg-gradient-primary bg-clip-text text-transparent"> Arquivos Corporativos</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Plataforma completa para organização, controle de acesso e auditoria de documentos empresariais
            com segurança de nível corporativo.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              size="lg"
              variant="gradient"
              onClick={() => navigate('/auth')}
              className="text-lg px-8"
            >
              Começar Agora
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/auth')}
              className="text-lg px-8"
            >
              Fazer Login
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Recursos Empresariais Avançados
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Desenvolvido especificamente para atender às necessidades de gestão documental corporativa
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="shadow-medium hover:shadow-strong transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Controle de Acesso Granular</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Sistema avançado de permissões por usuário, grupo e pasta. 
                  Controle total sobre quem pode visualizar, editar ou administrar cada documento.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-medium hover:shadow-strong transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-success-light rounded-lg flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-success" />
                </div>
                <CardTitle>Auditoria Completa</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Log detalhado de todas as ações: uploads, downloads, visualizações e exclusões.
                  Rastreabilidade total para conformidade e segurança.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-medium hover:shadow-strong transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-warning-light rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-warning" />
                </div>
                <CardTitle>Gestão de Usuários</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Painel administrativo para criação, edição e gerenciamento de usuários.
                  Organização por grupos departamentais (RH, Financeiro, TI).
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-medium hover:shadow-strong transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4">
                  <Cloud className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Backup Automático</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Configuração flexível de backups com integração ao Google Drive e Amazon S3.
                  Proteção automática dos seus dados críticos.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-medium hover:shadow-strong transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-success-light rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-success" />
                </div>
                <CardTitle>Interface Intuitiva</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Design moderno e responsivo com visualização em grade ou lista.
                  Busca avançada e navegação otimizada para produtividade máxima.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-medium hover:shadow-strong transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-warning-light rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-warning" />
                </div>
                <CardTitle>Segurança Corporativa</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Criptografia de ponta a ponta, autenticação segura e políticas de segurança
                  compatíveis com padrões corporativos internacionais.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-primary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Pronto para Revolucionar sua Gestão de Documentos?
          </h2>
          <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Junte-se às empresas que já confiam no CloudFlow Vault para proteger e organizar
            seus documentos mais importantes.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate('/auth')}
            className="text-lg px-8"
          >
            Começar Gratuitamente
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t bg-card">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-xl font-bold text-primary mb-4">
            <Shield className="h-6 w-6" />
            CloudFlow Vault
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 CloudFlow Vault. Sistema de gestão de arquivos corporativo.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
