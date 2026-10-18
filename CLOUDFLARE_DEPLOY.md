# Guia de Publicação no Cloudflare Pages — CAST Inspect

Este projeto foi totalmente preparado e otimizado para rodar no **Cloudflare Pages**.

---

## 1. Por que a melhor opção é o Cloudflare Pages (e não Workers puro)?

- **Feito para SPAs (React + Vite)**: O Cloudflare Pages foi projetado especificamente para aplicações com frontend moderno, integração contínua com repositórios Git (GitHub / GitLab) e distribuição global com CDN ultrarrápido (Edge).
- **Deploy automático a cada Push**: Ao salvar e subir seu código para o GitHub, o Cloudflare detecta as alterações e realiza o deploy automaticamente em segundos.
- **Suporte Nativo a Edge Functions (Pages Functions)**: Todas as APIs em `/functions/api` rodam automaticamente como Serverless Workers no mesmo domínio, sem necessidade de configurar domínios separados ou regras complexas de CORS.
- **PWA e Roteamento SPA Garantidos**: Os arquivos `_redirects` e `_headers` já estão configurados para garantir que recarregar páginas internas (`/inspections`, `/dashboard`, etc.) funcione sem erro 404, além de cache otimizado para Service Workers e assets.
- **Custo Zero (Plano Gratuito Generoso)**: Largura de banda ilimitada, SSL/HTTPS automático e suporte a domínio personalizado sem custo.

---

## 2. Passo a Passo para Publicação via GitHub + Cloudflare Pages

### Passo 1: Criar o Repositório no GitHub
1. Acesse [github.com](https://github.com) e crie um novo repositório (ex: `cloud-cast-inspect`).
2. No seu computador ou terminal com a pasta do projeto:
   ```bash
   git init
   git add .
   git commit -m "feat: preparar projeto para Cloudflare Pages"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```

### Passo 2: Conectar ao Cloudflare Pages
1. Acesse o painel da Cloudflare: [dash.cloudflare.com](https://dash.cloudflare.com).
2. No menu lateral esquerdo, clique em **Workers & Pages**.
3. Clique no botão **Create application** (Criar aplicação).
4. Selecione a aba **Pages** e depois **Connect to Git** (Conectar ao Git).
5. Selecione a sua conta do GitHub e escolha o repositório que você acabou de subir.
6. Clique em **Begin setup** (Iniciar configuração).

### Passo 3: Configurações de Build no Cloudflare Pages
Preencha exatamente estes campos:
- **Project name**: `cloud-cast-inspect` (ou o nome que preferir)
- **Production branch**: `main`
- **Framework preset**: `Vite`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (deixe em branco ou raiz)

*(Opcional: Variáveis de Ambiente)*
- Se você tiver um servidor backend dedicado externo (como Render, Railway ou VPS), adicione a variável:
  - `API_BACKEND_URL`: `https://seu-backend.onrender.com`
  *(Se não tiver, o Edge Functions embutido em `/functions/api` responderá diretamente no Cloudflare)*.

### Passo 4: Salvar e Fazer o Deploy
1. Clique em **Save and Deploy** (Salvar e implantar).
2. Aguarde cerca de 1 a 2 minutos enquanto o Cloudflare Pages instala as dependências, roda o Vite build e publica no Edge.
3. Pronto! Você receberá uma URL no formato:
   `https://cloud-cast-inspect.pages.dev`
4. Você pode vincular seu domínio próprio (ex: `app.castinspect.com.br`) na aba **Custom domains** com SSL automático.

---

## 3. Publicação Alternativa via Linha de Comando (Wrangler CLI)

Se preferir publicar direto do terminal sem conectar pelo GitHub:
```bash
# 1. Instalar Wrangler (caso não tenha)
npm install -g wrangler

# 2. Login na Cloudflare
npx wrangler login

# 3. Compilar a aplicação
npm run build

# 4. Publicar no Cloudflare Pages
npx wrangler pages deploy dist --project-name=cloud-cast-inspect
```
