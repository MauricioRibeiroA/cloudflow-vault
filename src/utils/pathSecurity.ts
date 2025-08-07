import { User } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

export interface UserProfile {
  id: string
  company_id: string
  role: 'super_admin' | 'company_admin' | 'user'
  email: string
}

export interface PathValidation {
  isValid: boolean
  allowedPath: string
  errorMessage?: string
}

export class PathSecurityManager {
  private static instance: PathSecurityManager
  private userProfile: UserProfile | null = null

  private constructor() {}

  static getInstance(): PathSecurityManager {
    if (!PathSecurityManager.instance) {
      PathSecurityManager.instance = new PathSecurityManager()
    }
    return PathSecurityManager.instance
  }

  async initializeUser(user: User): Promise<void> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_id, company_id, group_name, full_name, status')
        .eq('user_id', user.id)
        .single()

      if (error) {
        throw new Error(`Erro ao buscar perfil do usuário: ${error.message}`)
      }

      // Mapear dados do perfil para o formato esperado
      this.userProfile = {
        id: profile.user_id,
        company_id: profile.company_id || '',
        role: profile.group_name as 'super_admin' | 'company_admin' | 'user',
        email: user.email || ''
      }
    } catch (error) {
      console.error('Erro ao inicializar usuário:', error)
      throw error
    }
  }

  /**
   * Gera o caminho base permitido para o usuário atual
   */
  getCompanyBasePath(): string {
    if (!this.userProfile) {
      throw new Error('Usuário não inicializado')
    }

    return `company-${this.userProfile.company_id}/`
  }

  /**
   * Gera o caminho pessoal do usuário
   */
  getUserPersonalPath(): string {
    if (!this.userProfile) {
      throw new Error('Usuário não inicializado')
    }

    return `${this.getCompanyBasePath()}users/user-${this.userProfile.id}/`
  }

  /**
   * Gera o caminho compartilhado da empresa
   */
  getCompanySharedPath(): string {
    return `${this.getCompanyBasePath()}shared/`
  }

  /**
   * Gera o caminho administrativo da empresa
   */
  getCompanyAdminPath(): string {
    return `${this.getCompanyBasePath()}admin/`
  }

  /**
   * Valida se um caminho é acessível pelo usuário atual
   */
  validatePath(requestedPath: string): PathValidation {
    if (!this.userProfile) {
      return {
        isValid: false,
        allowedPath: '',
        errorMessage: 'Usuário não autenticado'
      }
    }

    // Super admin pode acessar tudo
    if (this.userProfile.role === 'super_admin') {
      return {
        isValid: true,
        allowedPath: requestedPath
      }
    }

    // Normalizar o path (remover barras duplas, etc.)
    const normalizedPath = this.normalizePath(requestedPath)
    const companyBasePath = this.getCompanyBasePath()

    // Verificar se está dentro da empresa
    if (!normalizedPath.startsWith(companyBasePath)) {
      return {
        isValid: false,
        allowedPath: companyBasePath,
        errorMessage: 'Acesso negado: fora do escopo da empresa'
      }
    }

    // Verificar permissões específicas por role
    const validation = this.validateByRole(normalizedPath)
    
    return validation
  }

  /**
   * Valida acesso baseado no role do usuário
   */
  private validateByRole(path: string): PathValidation {
    if (!this.userProfile) {
      return { isValid: false, allowedPath: '', errorMessage: 'Usuário não definido' }
    }

    const userPersonalPath = this.getUserPersonalPath()
    const companySharedPath = this.getCompanySharedPath()
    const companyAdminPath = this.getCompanyAdminPath()

    switch (this.userProfile.role) {
      case 'company_admin':
        // Admin da empresa pode acessar tudo da empresa
        if (path.startsWith(this.getCompanyBasePath())) {
          return { isValid: true, allowedPath: path }
        }
        break

      case 'user':
        // Usuário comum pode acessar apenas sua pasta pessoal e arquivos compartilhados
        if (path.startsWith(userPersonalPath) || path.startsWith(companySharedPath)) {
          return { isValid: true, allowedPath: path }
        }
        
        // Não pode acessar pasta admin
        if (path.startsWith(companyAdminPath)) {
          return {
            isValid: false,
            allowedPath: companySharedPath,
            errorMessage: 'Acesso negado: área administrativa'
          }
        }

        // Não pode acessar pastas de outros usuários
        if (path.includes('/users/user-') && !path.startsWith(userPersonalPath)) {
          return {
            isValid: false,
            allowedPath: userPersonalPath,
            errorMessage: 'Acesso negado: pasta de outro usuário'
          }
        }
        break
    }

    return {
      isValid: false,
      allowedPath: this.getDefaultPath(),
      errorMessage: 'Acesso negado'
    }
  }

  /**
   * Retorna o caminho padrão para o usuário
   */
  getDefaultPath(): string {
    if (!this.userProfile) return ''

    switch (this.userProfile.role) {
      case 'super_admin':
        return '' // Pode navegar em qualquer lugar
      case 'company_admin':
        return this.getCompanyBasePath()
      case 'user':
        return this.getUserPersonalPath()
      default:
        return this.getUserPersonalPath()
    }
  }

  /**
   * Normaliza um caminho removendo barras duplas e padronizando
   */
  private normalizePath(path: string): string {
    if (!path) return ''
    
    // Remover barras duplas e garantir que termine com /
    const normalized = path.replace(/\/+/g, '/').replace(/\/$/, '') + '/'
    
    // Se começar com /, remover
    return normalized.startsWith('/') ? normalized.substring(1) : normalized
  }

  /**
   * Cria a estrutura inicial de pastas para uma nova empresa
   */
  async createCompanyStructure(companyId: string): Promise<void> {
    const basePath = `company-${companyId}/`
    const paths = [
      `${basePath}users/`,
      `${basePath}shared/documents/`,
      `${basePath}shared/projects/`,
      `${basePath}shared/templates/`,
      `${basePath}admin/`
    ]

    // Criar as pastas no Backblaze
    for (const path of paths) {
      try {
        await this.createFolder(path)
      } catch (error) {
        console.error(`Erro ao criar pasta ${path}:`, error)
      }
    }
  }

  /**
   * Cria uma pasta específica (usando a Edge Function)
   */
  private async createFolder(path: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('b2-proxy', {
      body: {
        action: 'createFolder',
        folderName: path
      }
    })

    if (error) {
      throw new Error(`Erro ao criar pasta: ${error.message}`)
    }
  }

  /**
   * Retorna informações do usuário atual
   */
  getCurrentUser(): UserProfile | null {
    return this.userProfile
  }
}
