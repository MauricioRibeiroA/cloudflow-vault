import { supabase } from '@/integrations/supabase/client'
import { PathSecurityManager } from '@/utils/pathSecurity'

export interface SecureB2File {
  key: string
  name: string
  size: number
  lastModified: Date
  isFolder: boolean
  path: string
  relativePath: string // Path relativo à empresa/usuário
}

class SecureBackblazeService {
  private securityManager: PathSecurityManager

  constructor() {
    this.securityManager = PathSecurityManager.getInstance()
  }

  /**
   * Lista arquivos respeitando o controle de acesso
   */
  async listFiles(requestedPath: string = ''): Promise<SecureB2File[]> {
    try {
      // Se o path estiver vazio, usar o path padrão do usuário
      if (!requestedPath) {
        requestedPath = this.securityManager.getDefaultPath()
      }

      // Validar acesso
      const validation = this.securityManager.validatePath(requestedPath)
      if (!validation.isValid) {
        throw new Error(validation.errorMessage || 'Acesso negado')
      }

      console.log('🔒 Listando arquivos com path seguro:', requestedPath)

      const data = await this.callEdgeFunction('list', {
        path: requestedPath
      })

      // Transformar response para incluir paths relativos
      const files: SecureB2File[] = data?.files?.map((file: any) => ({
        key: file.Key,
        name: file.name,
        size: file.Size || 0,
        lastModified: new Date(file.LastModified || new Date()),
        isFolder: file.isFolder === true,
        path: file.Key?.replace('cloud-vault/', '') || file.name,
        relativePath: this.getRelativePath(file.Key || file.name)
      })) || []

      console.log('🔒 Arquivos listados com segurança:', files.length, 'items')
      return files

    } catch (error) {
      console.error('Erro ao listar arquivos:', error)
      throw error
    }
  }

  /**
   * Upload de arquivo com validação de segurança
   */
  async uploadFile(requestedPath: string, file: File): Promise<SecureB2File> {
    try {
      // Se o path estiver vazio, usar o path padrão do usuário
      if (!requestedPath) {
        requestedPath = this.securityManager.getDefaultPath()
      }

      // Validar acesso
      const validation = this.securityManager.validatePath(requestedPath)
      if (!validation.isValid) {
        throw new Error(validation.errorMessage || 'Acesso negado para upload')
      }

      console.log('🔒 Upload com path seguro:', requestedPath)

      // Converter arquivo para base64
      const fileContent = await this.fileToBase64(file)

      const result = await this.callEdgeFunction('upload', {
        fileName: file.name,
        fileContent: fileContent,
        isBase64: true,
        contentType: file.type || 'application/octet-stream',
        path: requestedPath
      })

      console.log('🔒 Upload realizado com segurança')
      
      // Save metadata to Supabase files table
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          console.log('🔒 Salvando metadados no Supabase...')
          
          // Get user's company_id
          const { data: companyIdData, error: companyIdError } = await supabase
            .rpc('get_user_company_id', { user_id: user.id })
          
          if (companyIdError) {
            console.error('Error getting company_id:', companyIdError)
          } else {
            const companyId = companyIdData
            console.log('🔒 Company ID do usuário:', companyId)
            
            // Build full file path (same format as B2)
            const filePath = `cloud-vault/${requestedPath}${file.name}`
            
            // Insert file metadata
            const { error: dbError } = await supabase
              .from('files')
              .insert({
                name: file.name,
                file_path: filePath,
                file_size: file.size,
                file_type: file.type || 'application/octet-stream',
                folder_id: null, // For secure uploads, folder_id is managed by the path structure
                uploaded_by: user.id,
                company_id: companyId
              })

            if (dbError) {
              console.error('🔒 Erro ao salvar metadados:', dbError)
            } else {
              console.log('🔒 Metadados salvos com sucesso!')
              
              // Log the upload action
              await supabase
                .from('logs')
                .insert({
                  user_id: user.id,
                  company_id: companyId,
                  action: 'file_upload',
                  target_type: 'file',
                  target_name: file.name,
                  details: {
                    file_size: file.size,
                    file_type: file.type,
                    folder_id: requestedPath,
                    backblaze_key: filePath,
                    upload_method: 'secure_edge_function'
                  }
                })
              
              console.log('🔒 Log de upload salvo com sucesso!')
            }
          }
        }
      } catch (metadataError) {
        console.error('🔒 Erro ao salvar metadados (não afeta upload):', metadataError)
        // Não falhar o upload por causa de erro de metadados
      }
      
      return {
        key: result.key || `${requestedPath}${file.name}`,
        name: file.name,
        size: file.size,
        lastModified: new Date(),
        isFolder: false,
        path: requestedPath,
        relativePath: this.getRelativePath(requestedPath + file.name)
      }

    } catch (error) {
      console.error('Erro no upload seguro:', error)
      throw error
    }
  }

  /**
   * Deleta arquivo com validação de segurança
   */
  async deleteFile(key: string): Promise<void> {
    try {
      // Extrair path do key para validação
      const pathToValidate = this.extractPathFromKey(key)
      
      // Validar acesso
      const validation = this.securityManager.validatePath(pathToValidate)
      if (!validation.isValid) {
        throw new Error(validation.errorMessage || 'Acesso negado para exclusão')
      }

      console.log('🔒 Deletando arquivo com validação:', key)

      await this.callEdgeFunction('delete', { key })
      console.log('🔒 Arquivo deletado com segurança')

    } catch (error) {
      console.error('Erro ao deletar arquivo:', error)
      throw error
    }
  }

  /**
   * Download de arquivo com validação de segurança
   */
  async downloadFile(key: string): Promise<string> {
    try {
      // Extrair path do key para validação
      const pathToValidate = this.extractPathFromKey(key)
      
      // Validar acesso
      const validation = this.securityManager.validatePath(pathToValidate)
      if (!validation.isValid) {
        throw new Error(validation.errorMessage || 'Acesso negado para download')
      }

      console.log('🔒 Download com validação:', key)

      // Edge Function returns file directly, not a URL
      const response = await supabase.functions.invoke('b2-proxy', {
        body: { action: 'download', key }
      })
      
      if (response.error) {
        throw new Error(response.error.message || 'Erro no download')
      }

      // Create blob URL from the response data
      const blob = new Blob([response.data], { 
        type: 'application/octet-stream' 
      })
      const downloadUrl = URL.createObjectURL(blob)
      
      console.log('🔒 Blob URL criada para download com segurança')
      return downloadUrl

    } catch (error) {
      console.error('Erro no download seguro:', error)
      throw error
    }
  }

  /**
   * Cria pasta com validação de segurança
   */
  async createFolder(requestedPath: string, folderName: string): Promise<void> {
    try {
      // Se o path estiver vazio, usar o path padrão do usuário
      if (!requestedPath) {
        requestedPath = this.securityManager.getDefaultPath()
      }

      // Validar acesso
      const validation = this.securityManager.validatePath(requestedPath)
      if (!validation.isValid) {
        throw new Error(validation.errorMessage || 'Acesso negado para criação de pasta')
      }

      console.log('🔒 Criando pasta com path seguro:', requestedPath, folderName)

      const folderPath = requestedPath + folderName

      const result = await this.callEdgeFunction('createFolder', {
        folderPath
      })

      console.log('🔒 Pasta criada com segurança:', result)

    } catch (error) {
      console.error('Erro ao criar pasta:', error)
      throw error
    }
  }

  /**
   * Deleta pasta com validação de segurança
   */
  async deleteFolder(folderPath: string): Promise<void> {
    try {
      // Validar acesso
      const validation = this.securityManager.validatePath(folderPath)
      if (!validation.isValid) {
        throw new Error(validation.errorMessage || 'Acesso negado para exclusão de pasta')
      }

      console.log('🔒 Deletando pasta com validação:', folderPath)

      await this.callEdgeFunction('deleteFolder', { folderPath })
      console.log('🔒 Pasta deletada com segurança')

    } catch (error) {
      console.error('Erro ao deletar pasta:', error)
      throw error
    }
  }

  /**
   * Navega para uma pasta (apenas validação de acesso)
   */
  async navigateToFolder(currentPath: string, folderName: string): Promise<string> {
    const newPath = this.buildPath(currentPath, folderName)
    
    // Validar se o usuário pode acessar o novo path
    const validation = this.securityManager.validatePath(newPath)
    if (!validation.isValid) {
      throw new Error(validation.errorMessage || 'Acesso negado à pasta')
    }

    console.log('🔒 Navegação autorizada para:', newPath)
    return newPath
  }

  /**
   * Retorna ao diretório pai (com validação)
   */
  async navigateBack(currentPath: string): Promise<string> {
    const parentPath = this.getParentPath(currentPath)
    
    // Validar se o usuário pode acessar o path pai
    const validation = this.securityManager.validatePath(parentPath)
    if (!validation.isValid) {
      // Se não pode acessar o pai, retornar ao path padrão
      return this.securityManager.getDefaultPath()
    }

    console.log('🔒 Navegação de volta autorizada para:', parentPath)
    return parentPath
  }

  /**
   * Retorna paths disponíveis para o usuário
   */
  getAvailablePaths() {
    const user = this.securityManager.getCurrentUser()
    if (!user) return []

    const paths = []

    switch (user.role) {
      case 'super_admin':
        paths.push({
          name: 'Todas as Empresas',
          path: '',
          description: 'Acesso completo a todos os dados'
        })
        break

      case 'company_admin':
        paths.push(
          {
            name: 'Raiz da Empresa',
            path: this.securityManager.getCompanyBasePath(),
            description: 'Pasta raiz da empresa'
          },
          {
            name: 'Arquivos Compartilhados',
            path: this.securityManager.getCompanySharedPath(),
            description: 'Documentos compartilhados da empresa'
          },
          {
            name: 'Administração',
            path: this.securityManager.getCompanyAdminPath(),
            description: 'Arquivos administrativos'
          }
        )
        break

      case 'user':
        paths.push(
          {
            name: 'Meus Arquivos',
            path: this.securityManager.getUserPersonalPath(),
            description: 'Seus arquivos pessoais'
          },
          {
            name: 'Arquivos Compartilhados',
            path: this.securityManager.getCompanySharedPath(),
            description: 'Documentos compartilhados da empresa'
          }
        )
        break
    }

    return paths
  }

  // Métodos auxiliares privados

  private async callEdgeFunction(action: string, payload: any) {
    try {
      const { data, error } = await supabase.functions.invoke('b2-proxy', {
        body: { action, ...payload }
      })
      
      if (error) throw error
      return data
    } catch (error) {
      console.error(`Erro na Edge Function ${action}:`, error)
      throw error
    }
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      const timeout = setTimeout(() => {
        reject(new Error('Timeout na leitura do arquivo'))
      }, 30000)
      
      reader.onload = (event) => {
        clearTimeout(timeout)
        try {
          const result = event.target?.result as string
          if (!result?.includes(',')) {
            throw new Error('Formato de arquivo inválido')
          }
          const base64 = result.split(',')[1]
          if (!base64) {
            throw new Error('Falha ao extrair conteúdo base64')
          }
          resolve(base64)
        } catch (error) {
          reject(error)
        }
      }
      
      reader.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('Falha na leitura do arquivo'))
      }
      
      reader.readAsDataURL(file)
    })
  }

  private extractPathFromKey(key: string): string {
    // Remove o prefixo cloud-vault/ se existir
    const cleanKey = key.replace('cloud-vault/', '')
    
    // Encontrar o último /
    const lastSlashIndex = cleanKey.lastIndexOf('/')
    if (lastSlashIndex === -1) return ''
    
    return cleanKey.substring(0, lastSlashIndex + 1)
  }

  private getRelativePath(fullPath: string): string {
    const user = this.securityManager.getCurrentUser()
    if (!user) return fullPath

    const basePath = this.securityManager.getCompanyBasePath()
    return fullPath.startsWith(basePath) ? fullPath.replace(basePath, '') : fullPath
  }

  private buildPath(currentPath: string, folderName: string): string {
    if (!currentPath.endsWith('/')) {
      currentPath += '/'
    }
    return currentPath + folderName + '/'
  }

  private getParentPath(currentPath: string): string {
    if (!currentPath || currentPath === '/') {
      return this.securityManager.getDefaultPath()
    }
    
    // Remove trailing slash
    let path = currentPath.replace(/\/+$/, '')
    
    // Find last slash
    const lastSlash = path.lastIndexOf('/')
    if (lastSlash <= 0) {
      return this.securityManager.getDefaultPath()
    }
    
    return path.substring(0, lastSlash + 1)
  }
}

// Singleton export
export const secureBackblazeService = new SecureBackblazeService()
