/**
 * IMAGE CONVERTER AVIF - SERVIDOR BACKEND
 * ========================================
 * Aplicativo para converter imagens para formato AVIF
 * com análise de metadados e interface visual
 */

const express = require('express');
const sharp = require('sharp');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const exifParser = require('exif-parser');
const cors = require('cors');
const os = require('os');
const archiver = require('archiver');

const app = express();
const PORT = 8765;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configurar multer para upload de arquivos
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// Configurar multer para imagens + logo
const uploadWithLogo = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }
}).fields([
  { name: 'images', maxCount: 50 },
  { name: 'logo', maxCount: 1 }
]);

// Armazenamento em memória para imagens convertidas
// Map: sessionId => Array de { filename, buffer, size }
const convertedImages = new Map();

// Limpar sessões antigas (após 1 hora)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of convertedImages.entries()) {
    if (now - data.timestamp > 60 * 60 * 1000) {
      convertedImages.delete(sessionId);
    }
  }
}, 10 * 60 * 1000); // Check a cada 10 minutos

// Função para obter pasta Downloads do usuário
function getDownloadsFolder() {
  const userHome = os.homedir();
  return path.join(userHome, 'Downloads');
}

// Função para ler pasta recursivamente (incluindo subpastas)
async function readDirRecursive(dirPath, allowedExtensions) {
  let files = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Se for pasta, fazer chamada recursiva
        const subFiles = await readDirRecursive(fullPath, allowedExtensions);
        files = files.concat(subFiles);
      } else if (entry.isFile()) {
        // Se for arquivo, verificar se é uma imagem permitida
        const ext = path.extname(entry.name).toLowerCase();
        if (allowedExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Erro ao ler pasta ${dirPath}:`, error.message);
  }

  return files;
}

// Função para ler apenas arquivos da pasta principal (não recursivo)
async function readDirSingle(dirPath, allowedExtensions) {
  const entries = await fs.readdir(dirPath);
  return entries
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return allowedExtensions.includes(ext);
    })
    .map(file => path.join(dirPath, file));
}

// Função para extrair metadados EXIF
async function extractMetadata(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const metadata = await sharp(filePath).metadata();

    let exifData = null;
    try {
      const parser = exifParser.create(buffer);
      const result = parser.parse();
      exifData = result.tags;
    } catch (e) {
      // EXIF não disponível para esta imagem
    }

    return {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: buffer.length,
      sizeFormatted: formatBytes(buffer.length),
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
      exif: exifData
    };
  } catch (error) {
    console.error('Erro ao extrair metadados:', error);
    return null;
  }
}

// Função para formatar bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Função para aplicar marca d'água (watermark/logo)
async function applyWatermark(sharpInstance, logoBuffer, logoSize, logoOpacity, logoPosition, imageWidth, imageHeight) {
  try {
    // Calcular tamanho do logo baseado na porcentagem da largura da imagem
    const logoWidth = Math.round((imageWidth * logoSize) / 100);

    // Processar logo: resize + opacity
    const processedLogo = await sharp(logoBuffer)
      .resize(logoWidth, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .ensureAlpha() // Garantir canal alpha
      .composite([{
        input: Buffer.from([255, 255, 255, Math.round(255 * (logoOpacity / 100))]),
        raw: {
          width: 1,
          height: 1,
          channels: 4
        },
        tile: true,
        blend: 'dest-in'
      }])
      .toBuffer();

    // Obter dimensões do logo processado
    const logoMetadata = await sharp(processedLogo).metadata();
    const logoFinalWidth = logoMetadata.width;
    const logoFinalHeight = logoMetadata.height;

    // Calcular posição do logo
    const margin = 20; // Margem das bordas
    let left = 0;
    let top = 0;

    switch (logoPosition) {
      case 'top-left':
        left = margin;
        top = margin;
        break;
      case 'top-right':
        left = imageWidth - logoFinalWidth - margin;
        top = margin;
        break;
      case 'bottom-left':
        left = margin;
        top = imageHeight - logoFinalHeight - margin;
        break;
      case 'bottom-right':
        left = imageWidth - logoFinalWidth - margin;
        top = imageHeight - logoFinalHeight - margin;
        break;
      case 'center':
        left = Math.round((imageWidth - logoFinalWidth) / 2);
        top = Math.round((imageHeight - logoFinalHeight) / 2);
        break;
      default:
        left = imageWidth - logoFinalWidth - margin;
        top = imageHeight - logoFinalHeight - margin;
    }

    // Aplicar logo como composite
    return sharpInstance.composite([{
      input: processedLogo,
      left: left,
      top: top,
      blend: 'over'
    }]);

  } catch (error) {
    console.error('Erro ao aplicar marca d\'água:', error);
    // Em caso de erro, retornar instância original sem watermark
    return sharpInstance;
  }
}

// Função para gerar descrição da imagem usando metadados
function generateDescription(metadata, filename) {
  let description = `Imagem ${metadata.format.toUpperCase()}`;

  if (metadata.width && metadata.height) {
    description += ` com resolução ${metadata.width}x${metadata.height} pixels`;
  }

  description += `, tamanho ${metadata.sizeFormatted}`;

  if (metadata.exif) {
    if (metadata.exif.Make || metadata.exif.Model) {
      description += `. Capturada com ${metadata.exif.Make || ''} ${metadata.exif.Model || ''}`.trim();
    }
    if (metadata.exif.CreateDate) {
      const date = new Date(metadata.exif.CreateDate * 1000);
      description += ` em ${date.toLocaleDateString('pt-BR')}`;
    }
  }

  return description;
}

// Rota: Analisar pasta Downloads
app.post('/api/analyze-downloads', async (req, res) => {
  try {
    const { period, formats = [], recursive = false } = req.body;
    const downloadsPath = getDownloadsFolder();

    console.log(`📂 Analisando Downloads: ${downloadsPath}`);
    console.log(`📅 Período: ${JSON.stringify(period)}`);
    console.log(`🎯 Formatos: ${formats.join(', ')}`);
    console.log(`🗂️ Recursivo: ${recursive ? 'Sim (com subpastas)' : 'Não (apenas pasta principal)'}`);

    // Mapear formatos selecionados para extensões
    const formatToExtensions = {
      'jpg': ['.jpg', '.jpeg'],
      'png': ['.png'],
      'gif': ['.gif'],
      'webp': ['.webp'],
      'bmp': ['.bmp'],
      'tiff': ['.tiff', '.tif'],
      'avif': ['.avif']
    };

    // Construir lista de extensões permitidas
    let allowedExtensions = [];
    formats.forEach(format => {
      if (formatToExtensions[format]) {
        allowedExtensions.push(...formatToExtensions[format]);
      }
    });

    // Se nenhum formato foi especificado, usar todos
    if (allowedExtensions.length === 0) {
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'];
    }

    // Ler arquivos (recursivo ou não)
    let imagePaths;
    if (recursive) {
      imagePaths = await readDirRecursive(downloadsPath, allowedExtensions);
    } else {
      imagePaths = await readDirSingle(downloadsPath, allowedExtensions);
    }

    // Obter stats e filtrar por data
    const now = Date.now();
    const filteredImages = [];

    for (const filePath of imagePaths) {
      try {
        const stats = await fs.stat(filePath);
        const fileAge = now - stats.mtimeMs;

        let include = false;

        if (period === 'today') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          include = stats.mtimeMs >= today.getTime();
        } else if (period === '24h') {
          include = fileAge <= 24 * 60 * 60 * 1000;
        } else if (period === '48h') {
          include = fileAge <= 48 * 60 * 60 * 1000;
        } else if (period === '72h') {
          include = fileAge <= 72 * 60 * 60 * 1000;
        } else if (period.start && period.end) {
          const start = new Date(period.start).getTime();
          const end = new Date(period.end).getTime();
          include = stats.mtimeMs >= start && stats.mtimeMs <= end;
        } else {
          include = true; // Sem filtro
        }

        if (include) {
          filteredImages.push({
            name: path.basename(filePath),
            path: filePath,
            modified: stats.mtime,
            size: stats.size
          });
        }
      } catch (err) {
        console.error(`Erro ao processar ${filePath}:`, err);
      }
    }

    // Analisar cada imagem e extrair metadados
    const imagesData = [];

    for (const img of filteredImages) {
      try {
        const metadata = await extractMetadata(img.path);
        if (metadata) {
          const description = generateDescription(metadata, img.name);

          // Converter imagem para base64 (preview pequeno)
          const thumbnail = await sharp(img.path)
            .resize(300, 300, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();

          imagesData.push({
            name: img.name,
            path: img.path,
            modified: img.modified,
            description: description,
            metadata: metadata,
            thumbnail: `data:image/jpeg;base64,${thumbnail.toString('base64')}`
          });
        }
      } catch (err) {
        console.error(`Erro ao analisar ${img.name}:`, err);
      }
    }

    console.log(`✅ Encontradas ${imagesData.length} imagens`);

    res.json({
      success: true,
      count: imagesData.length,
      images: imagesData
    });

  } catch (error) {
    console.error('Erro ao analisar Downloads:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rota: Analisar pasta customizada
app.post('/api/analyze-folder', async (req, res) => {
  try {
    const { folderPath, period, formats = [], recursive = false } = req.body;

    if (!folderPath) {
      return res.status(400).json({
        success: false,
        error: 'Caminho da pasta não fornecido'
      });
    }

    console.log(`📂 Analisando pasta customizada: ${folderPath}`);
    console.log(`📅 Período: ${JSON.stringify(period)}`);
    console.log(`🎯 Formatos: ${formats.join(', ')}`);
    console.log(`🗂️ Recursivo: ${recursive ? 'Sim (com subpastas)' : 'Não (apenas pasta principal)'}`);

    // Verificar se a pasta existe
    try {
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({
          success: false,
          error: 'O caminho fornecido não é uma pasta válida'
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Pasta não encontrada ou sem permissão de acesso'
      });
    }

    // Mapear formatos selecionados para extensões
    const formatToExtensions = {
      'jpg': ['.jpg', '.jpeg'],
      'png': ['.png'],
      'gif': ['.gif'],
      'webp': ['.webp'],
      'bmp': ['.bmp'],
      'tiff': ['.tiff', '.tif'],
      'avif': ['.avif']
    };

    // Construir lista de extensões permitidas
    let allowedExtensions = [];
    formats.forEach(format => {
      if (formatToExtensions[format]) {
        allowedExtensions.push(...formatToExtensions[format]);
      }
    });

    // Se nenhum formato foi especificado, usar todos
    if (allowedExtensions.length === 0) {
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'];
    }

    // Ler arquivos (recursivo ou não)
    let imagePaths;
    if (recursive) {
      imagePaths = await readDirRecursive(folderPath, allowedExtensions);
    } else {
      imagePaths = await readDirSingle(folderPath, allowedExtensions);
    }

    // Obter stats e filtrar por data
    const now = Date.now();
    const filteredImages = [];

    for (const filePath of imagePaths) {
      try {
        const stats = await fs.stat(filePath);
        const fileAge = now - stats.mtimeMs;

        let include = false;

        if (period === 'today') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          include = stats.mtimeMs >= today.getTime();
        } else if (period === '24h') {
          include = fileAge <= 24 * 60 * 60 * 1000;
        } else if (period === '48h') {
          include = fileAge <= 48 * 60 * 60 * 1000;
        } else if (period === '72h') {
          include = fileAge <= 72 * 60 * 60 * 1000;
        } else if (period.start && period.end) {
          const start = new Date(period.start).getTime();
          const end = new Date(period.end).getTime();
          include = stats.mtimeMs >= start && stats.mtimeMs <= end;
        } else {
          include = true; // Sem filtro
        }

        if (include) {
          filteredImages.push({
            name: path.basename(filePath),
            path: filePath,
            modified: stats.mtime,
            size: stats.size
          });
        }
      } catch (err) {
        console.error(`Erro ao processar ${filePath}:`, err);
      }
    }

    // Analisar cada imagem e extrair metadados
    const imagesData = [];

    for (const img of filteredImages) {
      try {
        const metadata = await extractMetadata(img.path);
        if (metadata) {
          const description = generateDescription(metadata, img.name);

          // Converter imagem para base64 (preview pequeno)
          const thumbnail = await sharp(img.path)
            .resize(300, 300, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();

          imagesData.push({
            name: img.name,
            path: img.path,
            modified: img.modified,
            description: description,
            metadata: metadata,
            thumbnail: `data:image/jpeg;base64,${thumbnail.toString('base64')}`
          });
        }
      } catch (err) {
        console.error(`Erro ao analisar ${img.name}:`, err);
      }
    }

    console.log(`✅ Encontradas ${imagesData.length} imagens`);

    res.json({
      success: true,
      count: imagesData.length,
      images: imagesData
    });

  } catch (error) {
    console.error('Erro ao analisar pasta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rota: Converter imagens enviadas via upload (do botão Navegar)
app.post('/api/convert-uploaded', uploadWithLogo, async (req, res) => {
  try {
    const files = req.files?.images || [];
    const logoFile = req.files?.logo ? req.files.logo[0] : null;
    const quality = parseInt(req.body.quality) || 75;

    // Extrair parâmetros do logo
    const logoSize = logoFile ? parseInt(req.body.logoSize) || 15 : null;
    const logoOpacity = logoFile ? parseInt(req.body.logoOpacity) || 70 : null;
    const logoPosition = logoFile ? req.body.logoPosition || 'bottom-right' : null;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    console.log(`🔄 Convertendo ${files.length} imagens enviadas para AVIF (qualidade: ${quality})...`);
    if (logoFile) {
      console.log(`🖼️  Aplicando marca d'água: tamanho ${logoSize}%, opacidade ${logoOpacity}%, posição ${logoPosition}`);
    }

    // Ler logo buffer se fornecido
    let logoBuffer = null;
    if (logoFile) {
      logoBuffer = await fs.readFile(logoFile.path);
    }

    // Gerar session ID único
    const sessionId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    const convertedBuffers = [];

    let processedCount = 0;
    for (const file of files) {
      processedCount++;
      console.log(`\n[${processedCount}/${files.length}] 🔄 Processando ${file.originalname}...`);

      try {
        const filename = path.basename(file.originalname, path.extname(file.originalname));
        const outputFilename = `${filename}.avif`;

        // Obter dimensões da imagem
        const imageInfo = await sharp(file.path).metadata();
        console.log(`📐 Dimensões: ${imageInfo.width}x${imageInfo.height}`);

        // Se imagem é muito grande, redimensionar antes
        let sharpInstance = sharp(file.path);

        if (imageInfo.width > 2000 || imageInfo.height > 2000) {
          console.log(`⚠️  Imagem grande detectada, redimensionando...`);
          sharpInstance = sharpInstance.resize(2000, 2000, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }

        // Aplicar marca d'água se fornecida
        if (logoBuffer) {
          const finalWidth = imageInfo.width > 2000 ? 2000 : imageInfo.width;
          const finalHeight = imageInfo.height > 2000 ? 2000 : imageInfo.height;
          sharpInstance = await applyWatermark(sharpInstance, logoBuffer, logoSize, logoOpacity, logoPosition, finalWidth, finalHeight);
        }

        // Converter para AVIF
        const buffer = await sharpInstance
          .timeout({ seconds: 20 })
          .avif({
            quality: quality,
            effort: 4,
            chromaSubsampling: '4:2:0'
          })
          .toBuffer();

        convertedBuffers.push({
          filename: outputFilename,
          originalName: file.originalname,
          buffer: buffer,
          size: buffer.length
        });

        console.log(`✅ ${file.originalname} → ${outputFilename} (${formatBytes(buffer.length)})`);

        // Limpar arquivo temporário
        try {
          await fs.unlink(file.path);
        } catch (err) {
          console.error(`Erro ao limpar arquivo temporário: ${err.message}`);
        }
      } catch (err) {
        console.error(`❌ ERRO ao converter ${file.originalname}:`, err.message);
      }
    }

    // Armazenar buffers em memória
    convertedImages.set(sessionId, {
      images: convertedBuffers,
      timestamp: Date.now()
    });

    const successCount = convertedBuffers.length;
    console.log(`🎉 Conversão concluída: ${successCount}/${files.length} imagens`);

    res.json({
      success: true,
      converted: successCount,
      total: files.length,
      sessionId: sessionId,
      images: convertedBuffers.map(img => ({
        filename: img.filename,
        originalName: img.originalName,
        size: formatBytes(img.size)
      }))
    });

  } catch (error) {
    console.error('Erro na conversão de upload:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rota: Upload manual de imagens
app.post('/api/upload', upload.array('images', 50), async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    const imagesData = [];

    for (const file of files) {
      try {
        const metadata = await extractMetadata(file.path);
        if (metadata) {
          const description = generateDescription(metadata, file.originalname);

          const thumbnail = await sharp(file.path)
            .resize(300, 300, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();

          imagesData.push({
            name: file.originalname,
            path: file.path,
            modified: new Date(),
            description: description,
            metadata: metadata,
            thumbnail: `data:image/jpeg;base64,${thumbnail.toString('base64')}`
          });
        }
      } catch (err) {
        console.error(`Erro ao processar ${file.originalname}:`, err);
      }
    }

    res.json({
      success: true,
      count: imagesData.length,
      images: imagesData
    });

  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rota: Converter imagens selecionadas para AVIF
app.post('/api/convert-to-avif', async (req, res) => {
  try {
    const { images, quality = 75, logo, logoSize, logoOpacity, logoPosition } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem selecionada'
      });
    }

    console.log(`🔄 Convertendo ${images.length} imagens para AVIF...`);
    if (logo) {
      console.log(`🖼️  Aplicando marca d'água: tamanho ${logoSize}%, opacidade ${logoOpacity}%, posição ${logoPosition}`);
    }

    // Converter logo base64 para buffer se fornecido
    let logoBuffer = null;
    if (logo) {
      const base64Data = logo.replace(/^data:image\/\w+;base64,/, '');
      logoBuffer = Buffer.from(base64Data, 'base64');
    }

    // Gerar session ID único
    const sessionId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    const convertedBuffers = [];

    let processedCount = 0;
    for (const imagePath of images) {
      processedCount++;
      console.log(`\n[${processedCount}/${images.length}] 🔄 Processando...`);

      try {
        // Debug: Ver caminho original
        console.log(`📝 Caminho recebido: "${imagePath}"`);

        // Normalizar caminho para Windows
        // Se não tem barras, adicionar manualmente
        let normalizedPath = imagePath;

        // Se o caminho não tem barras, reconstruir corretamente
        if (!normalizedPath.includes('\\') && !normalizedPath.includes('/')) {
          // Caminho veio sem barras: C:UsersVaio...
          // Reconstruir: C:\Users\Vaio\...
          normalizedPath = normalizedPath.replace(/^([A-Z]):/, '$1:\\');
          normalizedPath = normalizedPath.replace(/Users/, '\\Users\\');
          normalizedPath = normalizedPath.replace(/Downloads/, '\\Downloads\\');
        } else {
          // Caminho tem barras, normalizar
          normalizedPath = normalizedPath.replace(/\//g, '\\');
        }

        console.log(`✅ Caminho normalizado: "${normalizedPath}"`);

        const filename = path.basename(normalizedPath, path.extname(normalizedPath));
        const outputFilename = `${filename}.avif`;

        console.log(`⏳ Iniciando conversão...`);

        // Obter dimensões da imagem primeiro
        const imageInfo = await sharp(normalizedPath).metadata();
        console.log(`📐 Dimensões: ${imageInfo.width}x${imageInfo.height}`);

        // Se imagem é muito grande, redimensionar antes (previne travamento no Windows)
        let sharpInstance = sharp(normalizedPath);

        if (imageInfo.width > 2000 || imageInfo.height > 2000) {
          console.log(`⚠️  Imagem grande detectada, redimensionando para melhor performance...`);
          sharpInstance = sharpInstance.resize(2000, 2000, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }

        // Aplicar marca d'água se fornecida
        if (logoBuffer) {
          const finalWidth = imageInfo.width > 2000 ? 2000 : imageInfo.width;
          const finalHeight = imageInfo.height > 2000 ? 2000 : imageInfo.height;
          sharpInstance = await applyWatermark(sharpInstance, logoBuffer, logoSize, logoOpacity, logoPosition, finalWidth, finalHeight);
        }

        // Converter para AVIF com configurações otimizadas para Windows
        const buffer = await sharpInstance
          .timeout({ seconds: 20 }) // Timeout interno do Sharp
          .avif({
            quality: quality,
            effort: 4, // Reduzido de 6 para 4 (menos CPU, mais estável)
            chromaSubsampling: '4:2:0' // Mudado de 4:4:4 para 4:2:0 (mais rápido)
          })
          .toBuffer();

        convertedBuffers.push({
          filename: outputFilename,
          originalName: path.basename(normalizedPath),
          buffer: buffer,
          size: buffer.length
        });

        console.log(`✅ ${path.basename(normalizedPath)} → ${outputFilename} (${formatBytes(buffer.length)})`);

      } catch (err) {
        console.error(`❌ ERRO ao converter ${imagePath}:`, err.message);
        // Continuar com as próximas imagens
      }
    }

    // Armazenar buffers em memória
    convertedImages.set(sessionId, {
      images: convertedBuffers,
      timestamp: Date.now()
    });

    const successCount = convertedBuffers.length;
    console.log(`🎉 Conversão concluída: ${successCount}/${images.length} imagens`);

    res.json({
      success: true,
      converted: successCount,
      total: images.length,
      sessionId: sessionId,
      images: convertedBuffers.map(img => ({
        filename: img.filename,
        originalName: img.originalName,
        size: formatBytes(img.size)
      }))
    });

  } catch (error) {
    console.error('Erro na conversão:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rota: Download individual
app.get('/api/download/:sessionId/:filename', async (req, res) => {
  try {
    const { sessionId, filename } = req.params;

    const session = convertedImages.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sessão expirada ou não encontrada'
      });
    }

    const image = session.images.find(img => img.filename === filename);
    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Imagem não encontrada'
      });
    }

    res.setHeader('Content-Type', 'image/avif');
    res.setHeader('Content-Disposition', `attachment; filename="${image.filename}"`);
    res.setHeader('Content-Length', image.buffer.length);
    res.send(image.buffer);

    console.log(`📥 Download: ${image.filename}`);

  } catch (error) {
    console.error('Erro no download:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rota: Download em ZIP
app.get('/api/download-zip/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = convertedImages.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Sessão expirada ou não encontrada'
      });
    }

    // Configurar headers para ZIP
    const zipFilename = `imagens-avif-${Date.now()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    // Criar arquivo ZIP
    const archive = archiver('zip', {
      zlib: { level: 9 } // Máxima compressão
    });

    // Pipe para response
    archive.pipe(res);

    // Adicionar cada imagem ao ZIP
    for (const image of session.images) {
      archive.append(image.buffer, { name: image.filename });
    }

    // Finalizar ZIP
    await archive.finalize();

    console.log(`📦 Download ZIP: ${session.images.length} imagens (${zipFilename})`);

  } catch (error) {
    console.error('Erro no download ZIP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🎨 IMAGE CONVERTER AVIF - SERVIDOR INICIADO');
  console.log('='.repeat(60));
  console.log(`🌐 Interface: http://localhost:${PORT}`);
  console.log(`📥 Pasta Downloads: ${getDownloadsFolder()}`);
  console.log(`📦 Downloads: Diretos do navegador (individual ou ZIP)`);
  console.log('='.repeat(60) + '\n');

  // Abrir navegador automaticamente
  const start = process.platform === 'win32' ? 'start' : 'open';
  require('child_process').exec(`${start} http://localhost:${PORT}`);
});
