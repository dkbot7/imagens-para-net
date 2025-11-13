# 📋 PLANO DE IMPLEMENTAÇÃO v2.0
## Funcionalidades Pendentes + Otimizações

**Data:** 13/11/2025
**Versão Atual:** 1.0.0
**Versão Alvo:** 1.1.0
**Status:** 🔵 PLANEJAMENTO COMPLETO

---

## 🎯 FUNCIONALIDADES SOLICITADAS

### 1. Preview de Logo em Tempo Real ⭐ ALTA PRIORIDADE
**Requisito:** Mostrar visualmente como as imagens ficarão COM a logo aplicada ANTES da conversão final.

**Problema Atual:**
- Usuário só vê o resultado da logo APÓS converter para AVIF
- Não há feedback visual durante a configuração (tamanho/opacidade/posição)
- Usuário precisa "confiar" nas configurações sem ver o resultado

**Solução Proposta:**
Implementar preview em tempo real usando Canvas API no frontend

**Arquitetura:**

```javascript
// Fluxo de Preview
1. Usuário escolhe logo → logoFile armazenado (linha 1243-1280 HTML)
2. Usuário altera sliders → Trigger repaintPreviews()
3. Para cada imagem visível:
   - Cria Canvas temporário
   - Desenha imagem original
   - Calcula posição da logo (baseado em logoPosition)
   - Calcula tamanho da logo (baseado em logoSize)
   - Aplica opacidade (baseado em logoOpacity)
   - Desenha logo sobre a imagem
   - Converte Canvas para dataURL
   - Substitui src do <img> no card
```

**Implementação Técnica:**

**Passo 1:** Criar função `applyLogoPreview(imageElement, logoImage, settings)`
```javascript
async function applyLogoPreview(imageElement, logoImage, settings) {
  const { logoSize, logoOpacity, logoPosition } = settings;

  // Criar canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Definir tamanho do canvas
  canvas.width = imageElement.naturalWidth || 800;
  canvas.height = imageElement.naturalHeight || 600;

  // Desenhar imagem original
  ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

  // Calcular dimensões da logo
  const logoWidth = Math.round((canvas.width * logoSize) / 100);
  const logoHeight = (logoImage.height / logoImage.width) * logoWidth;

  // Calcular posição
  const margin = 20;
  let left, top;

  switch (logoPosition) {
    case 'top-left':
      left = margin; top = margin;
      break;
    case 'top-right':
      left = canvas.width - logoWidth - margin;
      top = margin;
      break;
    case 'bottom-left':
      left = margin;
      top = canvas.height - logoHeight - margin;
      break;
    case 'bottom-right':
      left = canvas.width - logoWidth - margin;
      top = canvas.height - logoHeight - margin;
      break;
    case 'center':
      left = (canvas.width - logoWidth) / 2;
      top = (canvas.height - logoHeight) / 2;
      break;
  }

  // Aplicar opacidade e desenhar logo
  ctx.globalAlpha = logoOpacity / 100;
  ctx.drawImage(logoImage, left, top, logoWidth, logoHeight);
  ctx.globalAlpha = 1.0;

  // Retornar dataURL
  return canvas.toDataURL('image/jpeg', 0.9);
}
```

**Passo 2:** Criar função `updateAllPreviews()`
```javascript
let previewCache = new Map(); // Cache: imagePath → {original, withLogo}

async function updateAllPreviews() {
  if (!logoFile) {
    // Se não há logo, restaurar imagens originais
    restoreOriginalPreviews();
    return;
  }

  // Carregar imagem da logo
  const logoImage = await loadImage(URL.createObjectURL(logoFile));

  // Obter configurações atuais
  const settings = {
    logoSize: parseInt(document.getElementById('logoSizeSlider').value),
    logoOpacity: parseInt(document.getElementById('logoOpacitySlider').value),
    logoPosition: document.getElementById('logoPosition').value
  };

  // Atualizar cada card
  const cards = document.querySelectorAll('.image-card');

  for (const card of cards) {
    const imgElement = card.querySelector('.image-preview');
    const imagePath = card.dataset.path;

    // Cache da imagem original
    if (!previewCache.has(imagePath)) {
      previewCache.set(imagePath, { original: imgElement.src });
    }

    // Carregar imagem original
    const originalImage = await loadImage(previewCache.get(imagePath).original);

    // Aplicar logo
    const previewWithLogo = await applyLogoPreview(originalImage, logoImage, settings);

    // Atualizar src
    imgElement.src = previewWithLogo;
  }

  // Mostrar indicador visual
  showLogoPreviewBadge();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function restoreOriginalPreviews() {
  previewCache.forEach((cache, imagePath) => {
    const card = document.querySelector(`[data-path="${imagePath}"]`);
    if (card) {
      const imgElement = card.querySelector('.image-preview');
      imgElement.src = cache.original;
    }
  });
  hideLogoPreviewBadge();
}
```

**Passo 3:** Adicionar Event Listeners
```javascript
// Quando logo é escolhida
document.getElementById('logoInput').addEventListener('change', async (e) => {
  if (e.target.files.length > 0) {
    logoFile = e.target.files[0];
    // Preview da logo (código existente)
    // ...
    // Atualizar previews
    await updateAllPreviews();
  }
});

// Quando sliders mudam
document.getElementById('logoSizeSlider').addEventListener('input', debounce(updateAllPreviews, 300));
document.getElementById('logoOpacitySlider').addEventListener('input', debounce(updateAllPreviews, 300));
document.getElementById('logoPosition').addEventListener('change', updateAllPreviews);

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
```

**Passo 4:** Adicionar Badge Visual
```javascript
function showLogoPreviewBadge() {
  let badge = document.getElementById('logoPreviewBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'logoPreviewBadge';
    badge.className = 'logo-preview-badge';
    badge.innerHTML = '👁️ Preview com logo ativo';
    document.querySelector('.results-container').prepend(badge);
  }
  badge.style.display = 'block';
}

function hideLogoPreviewBadge() {
  const badge = document.getElementById('logoPreviewBadge');
  if (badge) badge.style.display = 'none';
}
```

**Passo 5:** CSS para Badge
```css
.logo-preview-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: center;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

**Considerações de Performance:**
- Usar debounce nos sliders (300ms) para evitar re-render excessivo
- Cache de imagens originais para restaurar rapidamente
- Processar apenas imagens visíveis na viewport (lazy preview)
- Usar `requestAnimationFrame` para animações suaves

**Vantagens:**
✅ Feedback visual imediato
✅ Usuário vê exatamente como ficará
✅ Pode ajustar configurações interativamente
✅ Não requer conversão AVIF para preview
✅ Performance aceitável (Canvas API é rápida)

---

### 2. Upload Seletivo ⭐ ALTA PRIORIDADE
**Requisito:** Não fazer upload de todas as imagens automaticamente. Só enviar ao servidor as imagens que o usuário selecionou.

**Problema Atual:**

**Método "Upload Manual / Drag & Drop":**
- Quando usuário faz drag & drop ou clica "Escolher arquivos"
- **TODAS** as imagens vão IMEDIATAMENTE para o servidor via `/api/upload` (linha 1314-1325 HTML)
- Arquivos são salvos em `uploads/` mesmo que usuário não selecione
- Consumo de banda, disco e processamento desnecessário

**Métodos "Downloads" e "Pasta Customizada":**
- Servidor APENAS analisa metadados e cria thumbnails
- Arquivos permanecem no disco do usuário
- Na conversão, servidor lê apenas os selecionados ✅ CORRETO

**Método "Navegador Visual":**
- Arquivos são processados LOCALMENTE no frontend
- Só envia ao servidor na conversão, e apenas selecionados ✅ CORRETO

**Solução Proposta:**
Padronizar todos os métodos para seguir o padrão do "Navegador Visual"

**Arquitetura Nova:**

```javascript
// ANTES (Upload Manual):
1. Usuário faz drag & drop
2. FormData com TODOS os arquivos → /api/upload
3. Servidor salva em uploads/ e processa
4. Frontend exibe cards
5. Usuário seleciona alguns
6. Envia paths para /api/convert-to-avif

// DEPOIS (Upload Manual):
1. Usuário faz drag & drop
2. Frontend processa arquivos LOCALMENTE (FileReader + Canvas)
3. Cria thumbnails locais
4. Exibe cards
5. Usuário seleciona alguns
6. FormData com APENAS arquivos selecionados → /api/convert-uploaded
7. Servidor converte e retorna
```

**Implementação Técnica:**

**Passo 1:** Remover chamada automática de upload
```javascript
// LINHA 1314-1325 HTML - REMOVER/COMENTAR
dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');

  const files = Array.from(e.dataTransfer.files);
  // ❌ REMOVER: await uploadImages(files);
  // ✅ NOVO:
  await processImagesLocally(files);
});

// Mesmo para o input file
document.getElementById('imageInput').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  // ❌ REMOVER: await uploadImages(files);
  // ✅ NOVO:
  await processImagesLocally(files);
});
```

**Passo 2:** Criar função `processImagesLocally()`
```javascript
async function processImagesLocally(files) {
  showLoading();

  const imageFiles = files.filter(file => file.type.startsWith('image/'));

  if (imageFiles.length === 0) {
    showAlert('error', 'Nenhuma imagem válida encontrada');
    hideLoading();
    return;
  }

  const processedImages = [];

  for (const file of imageFiles) {
    try {
      // Criar thumbnail local
      const thumbnail = await createLocalThumbnail(file);

      // Extrair metadados básicos
      const metadata = {
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type,
        lastModified: new Date(file.lastModified).toLocaleDateString('pt-BR')
      };

      // Armazenar arquivo em memória (variável global)
      const imagePath = `local:${Date.now()}-${file.name}`;
      localFiles.set(imagePath, file); // Map para manter referência

      processedImages.push({
        name: file.name,
        path: imagePath,
        thumbnail: thumbnail,
        metadata: metadata,
        file: file // Referência ao File object
      });

    } catch (error) {
      console.error('Erro ao processar', file.name, error);
    }
  }

  // Adicionar ao array global de imagens
  currentImages.push(...processedImages);

  // Renderizar cards
  displayImages(processedImages, 'uploads-section');

  hideLoading();
  showAlert('success', `${processedImages.length} imagens carregadas com sucesso`);
}

// Helper: criar thumbnail local (mesmo código do navegador visual)
async function createLocalThumbnail(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const maxSize = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };

      img.onerror = reject;
      img.src = e.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

**Passo 3:** Modificar função `convertToAVIF()`
```javascript
async function convertToAVIF() {
  if (selectedImages.size === 0) {
    showAlert('error', 'Nenhuma imagem selecionada');
    return;
  }

  const selectedPaths = Array.from(selectedImages);

  // Separar imagens locais de imagens em disco
  const localImages = selectedPaths.filter(path => path.startsWith('local:'));
  const diskImages = selectedPaths.filter(path => !path.startsWith('local:'));

  let allResults = [];

  // Processar imagens locais (uploads)
  if (localImages.length > 0) {
    const formData = new FormData();

    localImages.forEach(path => {
      const file = localFiles.get(path);
      formData.append('images', file);
    });

    // Adicionar logo se houver
    if (logoFile) {
      formData.append('logo', logoFile);
      formData.append('logoSize', document.getElementById('logoSizeSlider').value);
      formData.append('logoOpacity', document.getElementById('logoOpacitySlider').value);
      formData.append('logoPosition', document.getElementById('logoPosition').value);
    }

    formData.append('quality', document.getElementById('qualitySlider').value);

    // Enviar para /api/convert-uploaded
    const response = await fetch('http://localhost:8765/api/convert-uploaded', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    allResults.push(result);
  }

  // Processar imagens em disco (Downloads, Pasta, etc)
  if (diskImages.length > 0) {
    // Código existente (linhas 1842-1975)
    // ...
  }

  // Combinar resultados e exibir relatório
  // ...
}
```

**Passo 4:** Variáveis Globais
```javascript
let localFiles = new Map(); // Map: path → File object

// Limpar ao iniciar nova análise
function clearLocalFiles() {
  localFiles.clear();
}
```

**Impacto no Backend:**
- Endpoint `/api/upload` pode ser **REMOVIDO** (não mais usado)
- Endpoint `/api/convert-uploaded` continua igual ✅
- Endpoint `/api/convert-to-avif` continua igual ✅

**Vantagens:**
✅ Sem upload desnecessário
✅ Economia de banda (crítico em mobile)
✅ Sem arquivos temporários no servidor
✅ Controle total do usuário
✅ Consistência entre todos os métodos

---

### 3. Otimização de Endpoints 🔧 MÉDIA PRIORIDADE
**Requisito:** Revisar estrutura do frontend e identificar oportunidades de otimização.

**Análise da Estrutura Atual:**

**Endpoints Existentes:**
1. POST `/api/analyze-downloads` - Análise de Downloads
2. POST `/api/analyze-folder` - Análise de Pasta
3. POST `/api/upload` - Upload manual ❌ **REMOVER**
4. POST `/api/convert-uploaded` - Conversão de uploads ✅ **MANTER**
5. POST `/api/convert-to-avif` - Conversão de paths ✅ **MANTER**
6. GET `/api/download/:sessionId/:filename` - Download individual ✅ **MANTER**
7. GET `/api/download-zip/:sessionId` - Download ZIP ✅ **MANTER**

**Redundâncias Identificadas:**

#### A. Lógica Duplicada: `analyze-downloads` vs `analyze-folder`
**Problema:** 85% do código é idêntico (linhas 247-375 vs 378-528)

**Solução:** Criar função auxiliar compartilhada
```javascript
async function analyzeImagesInDirectory(dirPath, options) {
  const { period, formats, recursive } = options;

  // Lógica compartilhada
  const files = recursive
    ? await readDirRecursive(dirPath, formats)
    : await readDirSingle(dirPath, formats);

  // Filtrar por período
  const filteredFiles = filterByPeriod(files, period);

  // Processar metadados e thumbnails
  const processedImages = await Promise.all(
    filteredFiles.map(async (file) => {
      // ... processamento comum
    })
  );

  return processedImages;
}

// Endpoints simplificados
app.post('/api/analyze-downloads', async (req, res) => {
  const downloadsPath = path.join(os.homedir(), 'Downloads');
  const images = await analyzeImagesInDirectory(downloadsPath, req.body);
  res.json({ success: true, count: images.length, images });
});

app.post('/api/analyze-folder', async (req, res) => {
  const { folderPath } = req.body;
  // Validação
  if (!fs.existsSync(folderPath)) {
    return res.status(400).json({ success: false, error: 'Pasta não encontrada' });
  }
  const images = await analyzeImagesInDirectory(folderPath, req.body);
  res.json({ success: true, count: images.length, images });
});
```

**Redução:** ~200 linhas de código duplicado

#### B. Conversão AVIF: Lógica Duplicada
**Problema:** `convert-uploaded` e `convert-to-avif` têm ~70% de código duplicado

**Solução:** Extrair função `convertImageToAVIF()`
```javascript
async function convertImageToAVIF(imageBuffer, options) {
  const { quality, logoBuffer, logoSize, logoOpacity, logoPosition } = options;

  let sharpInstance = sharp(imageBuffer);
  const imageInfo = await sharpInstance.metadata();

  // Redimensionar se necessário
  if (imageInfo.width > 2000 || imageInfo.height > 2000) {
    sharpInstance = sharpInstance.resize(2000, 2000, {
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  const finalWidth = Math.min(imageInfo.width, 2000);
  const finalHeight = Math.min(imageInfo.height, 2000);

  // Aplicar watermark
  if (logoBuffer) {
    sharpInstance = await applyWatermark(
      sharpInstance, logoBuffer, logoSize, logoOpacity,
      logoPosition, finalWidth, finalHeight
    );
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

  return buffer;
}
```

#### C. Endpoint `/api/upload` - REMOVER
**Justificativa:**
- Não mais usado após implementar upload seletivo
- Código: linhas 656-707 (server.js)
- Middleware `multer.array('images', 50)` também pode ser removido

**Ação:** Comentar código ou remover completamente

#### D. Validação de Input - ADICIONAR
**Problema Crítico (do REVISAO-PRODUCAO-V1.md):**
- Paths não são sanitizados → path traversal vulnerability
- Sem validação de tamanho de arquivo
- Sem rate limiting

**Solução:**
```javascript
// Middleware de validação
function validatePath(userPath) {
  const normalizedPath = path.normalize(userPath);

  // Bloquear path traversal
  if (normalizedPath.includes('..')) {
    throw new Error('Path inválido: tentativa de path traversal');
  }

  // Verificar se existe
  if (!fs.existsSync(normalizedPath)) {
    throw new Error('Caminho não encontrado');
  }

  return normalizedPath;
}

// Middleware de rate limiting
const rateLimit = require('express-rate-limit');

const convertLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 5, // 5 conversões por minuto
  message: 'Muitas requisições. Aguarde 1 minuto.'
});

app.post('/api/convert-to-avif', convertLimiter, async (req, res) => {
  // ...
});

// Validação de tamanho total
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_IMAGES = 50;

function validateConversionRequest(images) {
  if (images.length > MAX_IMAGES) {
    throw new Error(`Máximo de ${MAX_IMAGES} imagens por vez`);
  }

  let totalSize = 0;
  for (const img of images) {
    const stats = fs.statSync(img.path);
    totalSize += stats.size;
  }

  if (totalSize > MAX_TOTAL_SIZE) {
    throw new Error(`Tamanho total excede ${MAX_TOTAL_SIZE / 1024 / 1024}MB`);
  }
}
```

**Dependências Adicionais:**
```json
"dependencies": {
  "express-rate-limit": "^7.1.5"
}
```

---

## 📊 RESUMO DE MUDANÇAS

### Frontend (public/index.html)

| Seção | Ação | Linhas Estimadas |
|-------|------|------------------|
| Preview de Logo | ADICIONAR | +200 linhas |
| Upload Seletivo | MODIFICAR | ~100 linhas |
| Event Listeners | ADICIONAR | +50 linhas |
| CSS Badge | ADICIONAR | +30 linhas |
| Variáveis Globais | ADICIONAR | +5 linhas |

**Total:** +385 linhas (estimativa)

### Backend (server.js)

| Seção | Ação | Linhas |
|-------|------|--------|
| `/api/upload` | REMOVER | -52 linhas |
| Função `analyzeImagesInDirectory()` | ADICIONAR | +80 linhas |
| Endpoints análise | REFATORAR | -150 linhas |
| Função `convertImageToAVIF()` | ADICIONAR | +50 linhas |
| Endpoints conversão | REFATORAR | -100 linhas |
| Validação de paths | ADICIONAR | +40 linhas |
| Rate limiting | ADICIONAR | +20 linhas |

**Total:** -112 linhas (redução de código duplicado)

### Novos Arquivos

Nenhum. Todas as mudanças são em arquivos existentes.

---

## 🚀 PLANO DE EXECUÇÃO

### Fase 1: Preview de Logo (2-3 horas)
1. ✅ Criar função `applyLogoPreview()` no HTML
2. ✅ Criar função `updateAllPreviews()` no HTML
3. ✅ Adicionar event listeners para sliders/logo input
4. ✅ Implementar cache de imagens originais
5. ✅ Adicionar badge visual
6. ✅ Testar com diferentes imagens e configurações

### Fase 2: Upload Seletivo (2 horas)
1. ✅ Criar função `processImagesLocally()`
2. ✅ Modificar event handlers de drag & drop
3. ✅ Atualizar `convertToAVIF()` para separar local/disk
4. ✅ Adicionar Map `localFiles`
5. ✅ Testar fluxo completo de upload → seleção → conversão

### Fase 3: Otimização Backend (1-2 horas)
1. ✅ Extrair `analyzeImagesInDirectory()`
2. ✅ Refatorar `/api/analyze-downloads` e `/api/analyze-folder`
3. ✅ Extrair `convertImageToAVIF()`
4. ✅ Refatorar endpoints de conversão
5. ✅ Remover `/api/upload`
6. ✅ Testar todos os endpoints

### Fase 4: Segurança (1 hora)
1. ✅ Adicionar validação de paths
2. ✅ Implementar rate limiting
3. ✅ Adicionar validação de tamanho
4. ✅ Testar vulnerabilidades

### Fase 5: Testes e Commit (30 min)
1. ✅ Teste completo de todos os fluxos
2. ✅ Teste de performance (10+ imagens)
3. ✅ Commit com mensagem detalhada
4. ✅ Push para GitHub

**Tempo Total Estimado:** 6-8 horas

---

## ✅ CRITÉRIOS DE SUCESSO

### Preview de Logo
- [ ] Logo aparece nas imagens ANTES da conversão
- [ ] Sliders atualizam preview em tempo real
- [ ] Seletor de posição funciona corretamente
- [ ] Performance aceitável com 20+ imagens
- [ ] Badge visual indica preview ativo

### Upload Seletivo
- [ ] Drag & drop não envia arquivos ao servidor automaticamente
- [ ] Apenas imagens selecionadas são enviadas na conversão
- [ ] Sem arquivos temporários em `uploads/` antes da conversão
- [ ] Funciona igual para todos os métodos de carregamento

### Otimização
- [ ] Código duplicado eliminado
- [ ] Endpoints mais simples e legíveis
- [ ] Validação de input implementada
- [ ] Rate limiting ativo
- [ ] Sem vulnerabilidades de path traversal

---

## 📝 NOTAS FINAIS

### Compatibilidade
- Preview de logo usa Canvas API (suportado em todos navegadores modernos)
- FileReader API (IE10+)
- Sem breaking changes para usuários

### Performance
- Preview pode ser pesado com 50+ imagens grandes
- Considerar virtualização se necessário (future work)
- Debounce nos sliders evita re-renders excessivos

### Próximos Passos (v1.2)
1. Armazenamento em disco (C:/imagensavif/)
2. WebSocket para progresso real
3. Dark mode
4. Antes/Depois slider

---

**Desenvolvido com ❤️ para ChatbotImóveis®**
**Planejado por:** Claude AI
**Data:** 13/11/2025
**Próxima Ação:** Implementação das funcionalidades
