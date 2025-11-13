# 📸 Imagens para Publicar

Conversor profissional de imagens para formato AVIF otimizado para web, com marca d'água e edição de nomes.

## 🚀 Funcionalidades

### ✨ Conversão AVIF
- Conversão em lote de múltiplas imagens
- Controle de qualidade (50-95)
- Otimização automática para imagens grandes
- Suporte a múltiplos formatos: JPG, PNG, WebP, GIF, BMP, TIFF

### 🖼️ Marca d'Água
- Upload de logo personalizado
- Controle de tamanho (5-50% da largura)
- Ajuste de transparência (10-100%)
- 5 posições disponíveis (cantos e centro)
- Preview em tempo real

### 📂 Organização
- Busca em pasta Downloads
- Seleção de pasta customizada
- Navegador visual de pastas
- Busca recursiva em subpastas
- Organização por pastas de origem

### 📥 Download e Edição
- Renomear arquivos antes de baixar
- Download individual ou ZIP
- Miniaturas das imagens convertidas
- Preview com marca d'água aplicada

## 🛠️ Tecnologias

- **Backend:** Node.js + Express + Sharp v0.33.5
- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript
- **Conversão:** Sharp (libvips)
- **Design:** Design System 2025 (Indigo + Teal + Amber)

## 📦 Instalação

```bash
# Clone o repositório
git clone https://github.com/dkbot7/imagens-para-net.git

# Entre na pasta
cd imagens-para-net

# Instale as dependências
npm install

# Inicie o servidor
npm start
```

O aplicativo estará disponível em `http://localhost:8765`

## 🎯 Como Usar

### 1. Selecione as Imagens
- **Downloads:** Analise sua pasta Downloads por período
- **Pasta Customizada:** Digite o caminho ou navegue visualmente
- **Upload Manual:** Arraste e solte imagens

### 2. Configure (Opcional)
- Ajuste a qualidade AVIF (padrão: 75)
- Adicione marca d'água com seu logo
- Defina tamanho, transparência e posição

### 3. Converta
- Selecione as imagens desejadas
- Clique em "✨ TRANSFORMAR"
- Acompanhe o progresso em tempo real

### 4. Baixe
- Renomeie os arquivos se necessário
- Baixe individualmente ou tudo em ZIP
- **⚠️ Importante:** Não salvamos seus dados! Faça o download ou perderá as imagens.

## 📊 Benefícios do AVIF

- **50-60% menor** que JPEG com mesma qualidade
- **30-50% menor** que WebP
- Suporte a HDR e transparência
- Melhor compressão com menos artefatos

## 🔧 Configuração

### Porta
Padrão: `8765`
Altere em `server.js` linha 20

### Qualidades Recomendadas
- **75**: Balanço ideal (padrão) ⭐
- **85**: Alta qualidade
- **65**: Máxima compressão
- **90+**: Premium (arquivos maiores)

## 📝 Estrutura do Projeto

```
imagens-para-net/
├── public/
│   └── index.html          # Frontend completo
├── server.js               # Backend Node.js
├── package.json            # Dependências
├── COMO-USAR.txt          # Guia rápido
└── REVISAO-PRODUCAO-V1.md # Documentação técnica
```

## ⚠️ Avisos Importantes

1. **Não salvamos seus dados** - Imagens ficam em memória temporária (1 hora)
2. **Faça o download** - Dados são perdidos após fechar o navegador
3. **Privacidade total** - Processamento local no seu computador

## 🤝 Contribuindo

Pull requests são bem-vindos! Para mudanças importantes, abra uma issue primeiro.

## 📄 Licença

MIT

## 🏢 Desenvolvido por

**ChatbotImóveis®**
Ferramentas profissionais para o mercado imobiliário

---

**Versão:** 1.0.0
**Última atualização:** Novembro 2025
