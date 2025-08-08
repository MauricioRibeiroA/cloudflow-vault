import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { supabase } from '../integrations/supabase/client';

// Função para criar cliente S3 com as credenciais corretas
const createS3Client = () => {
  // Usar Master Key se forçado (para contornar cache de variáveis)
  const useMasterKey = (window as any).FORCE_MASTER_KEY;
  
  const accessKeyId = useMasterKey ? '005c579be2fa8160000000002' : (import.meta.env.VITE_B2_ACCESS_KEY_ID || '');
  const secretAccessKey = useMasterKey ? 'K005W5lkzoEz7H1PvH2NwRPiLsqhalg' : (import.meta.env.VITE_B2_SECRET_ACCESS_KEY || '');
  
  console.log('🔧 Criando cliente S3 com:', {
    useMasterKey,
    accessKeyId: accessKeyId.substring(0, 10) + '...',
    hasSecret: !!secretAccessKey
  });
  
  return new S3Client({
    endpoint: import.meta.env.VITE_B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
    region: import.meta.env.VITE_B2_REGION || 'us-east-005',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true, // Necessário para Backblaze B2
    maxAttempts: 3,
    requestHandler: {
      requestTimeout: 30000,
    },
  });
};

// Cliente S3 inicial - aplicar Master Key se disponível
// Como o FORCE_MASTER_KEY pode não estar definido no momento da importação,
// vamos inicializar como null e criar sob demanda
let s3Client: S3Client | null = null;

// Função para obter o cliente S3 (lazy loading)
const getS3Client = () => {
  if (!s3Client || (window as any).FORCE_MASTER_KEY) {
    s3Client = createS3Client();
  }
  return s3Client;
};

const BUCKET_NAME = import.meta.env.VITE_B2_BUCKET_NAME || 'cloud-clients-cloudflow';
const NAME_PREFIX = 'cloud-vault/';

export interface B2File {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
  isFolder: boolean;
  path: string;
}

class BackblazeService {
  // Lista arquivos e pastas
  async listFiles(path: string = ''): Promise<B2File[]> {
    try {
      const prefix = NAME_PREFIX + path;
      
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        Delimiter: '/',
      });

      const response = await getS3Client().send(command);
      const files: B2File[] = [];

      // Adiciona pastas
      if (response.CommonPrefixes) {
        for (const prefix of response.CommonPrefixes) {
          if (prefix.Prefix) {
            const folderName = prefix.Prefix.replace(NAME_PREFIX, '').replace(path, '').replace('/', '');
            if (folderName) {
              files.push({
                key: prefix.Prefix,
                name: folderName,
                size: 0,
                lastModified: new Date(),
                isFolder: true,
                path: prefix.Prefix.replace(NAME_PREFIX, ''),
              });
            }
          }
        }
      }

      // Adiciona arquivos
      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key && object.Key !== prefix) {
            const fileName = object.Key.replace(NAME_PREFIX, '').replace(path, '');
            if (fileName && !fileName.includes('/')) {
              files.push({
                key: object.Key,
                name: fileName,
                size: object.Size || 0,
                lastModified: object.LastModified || new Date(),
                isFolder: false,
                path: object.Key.replace(NAME_PREFIX, ''),
              });
            }
          }
        }
      }

      return files.sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Erro ao listar arquivos:', error);
      throw new Error('Falha ao listar arquivos do Backblaze B2');
    }
  }

  // Cria uma pasta
  async createFolder(path: string, folderName: string): Promise<void> {
    try {
      const folderPath = NAME_PREFIX + path + folderName + '/';
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: folderPath,
        Body: '',
        ContentType: 'application/x-directory',
      });

      await getS3Client().send(command);
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
      throw new Error('Falha ao criar pasta no Backblaze B2');
    }
  }

  // Upload de arquivo
  async uploadFile(path: string, file: File): Promise<void> {
    try {
      const filePath = NAME_PREFIX + path + file.name;
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filePath,
        Body: file,
        ContentType: file.type || 'application/octet-stream',
      });

      await getS3Client().send(command);
      
      // Save metadata to Supabase files table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get user's company_id
        const { data: companyIdData, error: companyIdError } = await supabase
          .rpc('get_user_company_id', { user_id: user.id });
        
        if (companyIdError) {
          console.error('Error getting company_id:', companyIdError);
        } else {
          const companyId = companyIdData;
          
          // Insert file metadata
          const { error: dbError } = await supabase
            .from('files')
            .insert({
              name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type || 'application/octet-stream',
              folder_id: path || null,
              uploaded_by: user.id,
              company_id: companyId
            });

          if (dbError) {
            console.error('Error saving file metadata:', dbError);
          } else {
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
                  folder_id: path,
                  backblaze_key: filePath
                }
              });
          }
        }
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      throw new Error('Falha ao fazer upload do arquivo para Backblaze B2');
    }
  }

  // Delete arquivo ou pasta
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await getS3Client().send(command);
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
      throw new Error('Falha ao deletar arquivo do Backblaze B2');
    }
  }

  // Gera URL de download temporária
  async getDownloadUrl(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const signedUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 }); // 1 hora
      return signedUrl;
    } catch (error) {
      console.error('Erro ao gerar URL de download:', error);
      throw new Error('Falha ao gerar URL de download');
    }
  }

  // Testa a conexão
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 Testando conexão Backblaze B2...');
      console.log('📋 Configurações:', {
        endpoint: import.meta.env.VITE_B2_ENDPOINT,
        region: import.meta.env.VITE_B2_REGION,
        bucket: BUCKET_NAME,
        keyId: import.meta.env.VITE_B2_ACCESS_KEY_ID,
        hasSecretKey: !!import.meta.env.VITE_B2_SECRET_ACCESS_KEY,
      });

      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        MaxKeys: 1,
      });

      const response = await getS3Client().send(command);
      console.log('✅ Conexão bem-sucedida!', response);
      return true;
    } catch (error) {
      console.error('❌ Erro na conexão:', error);
      return false;
    }
  }
}

// Fallback usando Edge Functions do Supabase
const useEdgeFunction = async (functionName: string, payload: any) => {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Erro na Edge Function ${functionName}:`, error);
    throw error;
  }
};

// Métodos que usam Edge Functions como fallback
const testConnectionViaEdge = async () => {
  return useEdgeFunction('b2-proxy', { action: 'list' });
};

const listFilesViaEdge = async (path: string = '') => {
  console.log('📋 Listando arquivos via Edge Function:', path);
  try {
    const data = await useEdgeFunction('b2-proxy', { 
      action: 'list',
      path: path
    });
    
    // Transform response to match B2File interface
    const files = data?.files?.map((file: any) => ({
      key: file.Key,
      name: file.name,
      size: file.Size || 0,
      lastModified: new Date(file.LastModified || new Date()),
      isFolder: file.isFolder === true,
      path: file.Key?.replace('cloud-vault/', '') || file.name
    })) || [];
    
    console.log('📋 Arquivos processados:', files.length, 'items');
    console.log('📋 Folders encontrados:', files.filter(f => f.isFolder).length);
    console.log('📋 Files encontrados:', files.filter(f => !f.isFolder).length);
    
    return files;
  } catch (error) {
    console.error('Erro ao listar arquivos via Edge Function:', error);
    throw error;
  }
};

const uploadFileViaEdge = async (path: string, file: File) => {
  console.log('📤 Upload via Edge Function:', file.name, 'Size:', file.size, 'Type:', file.type);
  
  try {
    // Convert file to base64 for JSON transfer with timeout
    const fileContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      const timeout = setTimeout(() => {
        reject(new Error('File reading timeout'));
      }, 30000); // 30 seconds timeout
      
      reader.onload = (event) => {
        clearTimeout(timeout);
        try {
          const result = event.target?.result;
          if (!result) {
            throw new Error('No file data received');
          }
          const resultStr = result as string;
          if (!resultStr.includes(',')) {
            throw new Error('Invalid file data format');
          }
          // Remove data URL prefix (e.g., "data:image/png;base64,")
          const base64 = resultStr.split(',')[1];
          if (!base64) {
            throw new Error('Failed to extract base64 content');
          }
          console.log('📤 File converted to base64, length:', base64.length);
          resolve(base64);
        } catch (error) {
          console.error('📤 FileReader processing error:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        clearTimeout(timeout);
        console.error('📤 FileReader error event:', reader.error);
        reject(new Error('Failed to read file: ' + (reader.error?.message || 'File read error')));
      };
      
      reader.readAsDataURL(file);
    });
    
    console.log('📤 Calling Edge Function for upload...');
    const result = await useEdgeFunction('b2-proxy', {
      action: 'upload',
      fileName: file.name,
      fileContent: fileContent,
      isBase64: true,
      contentType: file.type || 'application/octet-stream',
      path: path || ''
    });
    
    console.log('📤 Upload successful:', result);
    
    // Save metadata to Supabase files table after successful upload
    const { data: { user } } = await supabase.auth.getUser();
    if (user && result) {
      console.log('📤 Saving file metadata to Supabase...');
      
      // Get user's company_id
      const { data: companyIdData, error: companyIdError } = await supabase
        .rpc('get_user_company_id', { user_id: user.id });
      
      if (companyIdError) {
        console.error('Error getting company_id:', companyIdError);
      } else {
        const companyId = companyIdData;
        console.log('📤 User company_id:', companyId);
        
        // Build file path (same format as B2)
        const filePath = NAME_PREFIX + path + file.name;
        
        // Insert file metadata
        const { error: dbError } = await supabase
          .from('files')
          .insert({
            name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type || 'application/octet-stream',
            folder_id: path || null,
            uploaded_by: user.id,
            company_id: companyId
          });

        if (dbError) {
          console.error('Error saving file metadata:', dbError);
        } else {
          console.log('📤 File metadata saved successfully!');
          
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
                folder_id: path,
                backblaze_key: filePath,
                upload_method: 'edge_function'
              }
            });
          
          console.log('📤 Upload logged successfully!');
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('📤 Upload failed:', error);
    throw error;
  }
};

const deleteFileViaEdge = async (key: string) => {
  console.log('🗑️ Deletando arquivo via Edge Function:', key);
  return useEdgeFunction('b2-proxy', { 
    action: 'delete',
    key 
  });
};

const downloadFileViaEdge = async (key: string) => {
  console.log('📎 Gerando URL de download via Edge Function:', key);
  const data = await useEdgeFunction('b2-proxy', { 
    action: 'download',
    key: key
  });
  return data?.downloadUrl;
};

const createFolderViaEdge = async (path: string, folderName: string) => {
  console.log('📁 Criando pasta via Edge Function:', folderName);
  const folderPath = path + folderName; // Prefix will be added in Edge Function
  
  try {
    // Criar a pasta com verificação imediata
    const result = await useEdgeFunction('b2-proxy', { 
      action: 'createFolder',
      folderPath
    });
    
    console.log('📁 Pasta criada com sucesso:', result);
    
    // Se a pasta foi verificada com sucesso, tudo certo
    if (result?.verified) {
      console.log('✅ Pasta verificada imediatamente!');
      return result;
    }
    
    // Se não foi verificada, aguardar um pouco mais e tentar listar novamente
    console.log('⏳ Pasta criada mas não verificada imediatamente. Aguardando propagação...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1s extra
    
    // Tentar listar para confirmar
    try {
      const listResult = await listFilesViaEdge(path);
      const folderExists = listResult.some((file: any) => 
        file.isFolder && file.name === folderName
      );
      
      if (folderExists) {
        console.log('✅ Pasta confirmada na segunda verificação!');
        return { ...result, verified: true, doubleChecked: true };
      }
    } catch (listError) {
      console.warn('⚠️ Falha na verificação secundária:', listError);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Erro ao criar pasta:', error);
    throw error;
  }
};

const deleteFolderViaEdge = async (folderPath: string) => {
  console.log('📁 Deletando pasta recursivamente via Edge Function:', folderPath);
  return useEdgeFunction('b2-proxy', { 
    action: 'deleteFolder',
    folderPath: folderPath
  });
};

// Helper para detectar erros de CORS
const isCORSError = (error: any): boolean => {
  if (!error) return false;
  
  // Verifica diferentes tipos de erro de CORS
  const errorMessage = error.message || error.toString() || '';
  const errorName = error.name || '';
  
  return (
    errorMessage.includes('NetworkError') ||
    errorMessage.includes('CORS') ||
    errorMessage.includes('cross-origin') ||
    errorMessage.includes('Access-Control-Allow-Origin') ||
    errorName === 'TypeError' ||
    errorName === 'NetworkError' ||
    error.code === 'NetworkError'
  );
};

export const backblazeService = {
  // Métodos que usam APENAS Edge Functions (CORS do B2 não suporta S3 ListObjects)
  async testConnection() {
    console.log('🔍 Testando conexão Backblaze B2 via Edge Function...');
    console.log('📋 Usando Edge Function devido a limitações do CORS B2 nativo');
    
    try {
      await testConnectionViaEdge();
      console.log('✅ Conexão via Edge Function bem-sucedida!');
      return { success: true, method: 'edge' };
    } catch (edgeError) {
      console.error('❌ Edge Function falhou:', edgeError);
      return { success: false, method: 'none', error: edgeError };
    }
  },

  async listFiles(path: string = '') {
    // CORS do Backblaze B2 não suporta ListObjects, usar Edge Function diretamente
    console.log('📋 Usando Edge Function para listar arquivos (CORS B2 não suporta ListObjects)...');
    return await listFilesViaEdge(path);
  },

  async uploadFile(path: string, file: File) {
    // CORS do Backblaze B2 não suporta upload direto, usar Edge Function sempre
    console.log('📤 Usando Edge Function para upload (CORS B2 não suporta upload direto)...');
    return await uploadFileViaEdge(path, file);
  },

  async deleteFile(key: string) {
    // CORS do Backblaze B2 não suporta delete direto, usar Edge Function sempre
    console.log('🗑️ Usando Edge Function para deletar (CORS B2 não suporta delete direto)...');
    return await deleteFileViaEdge(key);
  },

  async getDownloadUrl(key: string) {
    // CORS do Backblaze B2 não suporta signed URLs direto, usar Edge Function sempre
    console.log('📎 Usando Edge Function para download (CORS B2 não suporta signed URLs direto)...');
    return await downloadFileViaEdge(key);
  },

  async createFolder(path: string, folderName: string) {
    // CORS do Backblaze B2 não suporta create folder direto, usar Edge Function sempre
    console.log('📁 Usando Edge Function para criar pasta (CORS B2 não suporta create direto)...');
    return await createFolderViaEdge(path, folderName);
  },

  async deleteFolder(folderPath: string) {
    // CORS do Backblaze B2 não suporta delete folder direto, usar Edge Function sempre
    console.log('📁 Usando Edge Function para deletar pasta (CORS B2 não suporta delete direto)...');
    return await deleteFolderViaEdge(folderPath);
  },
  
  // Métodos via Edge Functions (para uso direto se necessário)
  testConnectionViaEdge,
  listFilesViaEdge,
  uploadFileViaEdge,
  deleteFileViaEdge,
  downloadFileViaEdge,
  createFolderViaEdge,
  deleteFolderViaEdge
};
