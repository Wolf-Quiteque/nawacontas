# NawaNotas

Aplicação web progressiva (PWA) para emitir e registar **Notas de Saída de Caixa NawaBus**.
Serve para qualquer saída de dinheiro: indica-se o beneficiário (quem recebe), a origem do dinheiro
(caixa, cartão, transferência…), a lista de itens com os valores, e a app gera o PDF, imprime e regista
a nota com um número sequencial. Tudo fica consultável no **Histórico**, com filtros por data.

O documento segue o modelo gráfico original (`Nota_de_Pagamento_..._NawaBus_issac.pdf`): as posições,
tamanhos de letra, cores e tabelas foram medidos no PDF original e estão em
[`src/lib/layout.ts`](src/lib/layout.ts). O PDF (pdf-lib) e a pré-visualização/impressão (SVG) usam
exatamente o mesmo layout.

## Funcionalidades

- **Numeração automática e sequencial.** A primeira nota registada é a N.º 36 (as 35 anteriores
  foram emitidas antes da app). O número é atribuído pelo servidor ao guardar, sem duplicados.
- **Lista de itens** (até 12 por nota) com descrição, quantidade opcional e valor; total e
  **valor por extenso** (português, kwanzas) calculados automaticamente.
- **Histórico** com pesquisa (beneficiário, origem, item ou número), intervalo de datas e atalhos
  (hoje, mês atual, mês passado, ano). Mostra o total das notas filtradas.
- **Reimprimir / descarregar / partilhar** qualquer nota antiga. As notas registadas são **imutáveis**: não podem ser editadas nem eliminadas.
- Depois de registar (PDF, partilha ou impressão) a app abre automaticamente uma nova nota.
- Data de hoje preenchida automaticamente (pode ser alterada); o ano no número segue a data.
- Rascunho da nota nova guardado automaticamente no dispositivo.
- PWA instalável (iPhone, Android, computador) com menu lateral / gaveta e ajuda de instalação.

## Base de dados

A app usa **Postgres**. Em produção lê a ligação destas variáveis de ambiente (a primeira que existir):

```
POSTGRES_URL, DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING
```

Estas são exatamente as variáveis que a integração Neon/Vercel Postgres cria automaticamente no projeto.
A tabela `saidas` é criada na primeira utilização; não é preciso correr migrações.

Sem nenhuma destas variáveis (por exemplo em desenvolvimento local sem `.env`) a app usa um Postgres
embebido (PGlite) guardado na pasta `.data/`, que não é enviada para o git.

Variáveis opcionais:

| Variável | Predefinição | Descrição |
| --- | --- | --- |
| `NOTAS_NUMERO_INICIAL` | `35` | Último número já emitido antes da app; a próxima nota recebe este valor + 1 |
| `PGLITE_DIR` | `.data/nawanotas` | Pasta do Postgres embebido (apenas sem base de dados externa) |

## Utilização

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:3000
npm run build      # build de produção
npm start          # servir a build
npm run check:db   # testa a ligação à base de dados do .env (não altera dados)
npm run test:db    # testa a camada de dados num Postgres embebido temporário
npm run test:pdf   # gera um PDF de exemplo
```

## Publicar no Vercel

1. Importar o repositório no Vercel (raiz do projeto = raiz do repositório).
2. Ligar a base de dados ao projeto em **Storage** (a integração cria `POSTGRES_URL`/`DATABASE_URL`).
3. Deploy. Na primeira chamada a tabela é criada automaticamente.

## Instalar como app

O menu **Instalar app** (barra lateral / gaveta) mostra as instruções para o dispositivo em uso.

- **iPhone / iPad:** abrir no **Safari** → **Partilhar** → **Adicionar ao ecrã principal**.
- **Android:** Chrome → menu ⋮ → **Instalar app**.
- **Computador (Chrome/Edge):** ícone de instalação na barra de endereço, ou menu ⋮ →
  *Transmitir, guardar e partilhar* → *Instalar página como app*.

A instalação exige HTTPS (o Vercel já o fornece) e o service worker ativo — na primeira visita pode
ser necessário recarregar a página uma vez.

## Estrutura

| Ficheiro | Função |
| --- | --- |
| `src/lib/layout.ts` | Layout da nota em pontos (partilhado por PDF e pré-visualização) |
| `src/lib/pdf.ts` | Geração do PDF com pdf-lib (Helvetica, métricas idênticas à Arial) |
| `src/lib/extenso.ts` | Números por extenso em português |
| `src/lib/nota.ts` | Tipos, formatação de valores e datas, textos do documento |
| `src/lib/db/index.ts` | Ligação à base de dados (Postgres ou PGlite), esquema e migração |
| `src/lib/db/notas.ts` | Operações sobre as notas (listar, obter, criar com número sequencial) |
| `src/lib/validacao.ts` | Validação dos dados recebidos pela API |
| `src/lib/pwa.ts` | Estado da instalação (evento de instalação, service worker) |
| `src/app/api/notas/*` | API REST (`GET/POST /api/notas`, `GET /api/notas/[id]`, `GET /api/notas/proximo`) |
| `src/app/` | Páginas: nova nota (`/`), histórico (`/historico`), ver/reimprimir (`/notas/[id]`) |
| `src/components/` | Menu lateral, formulário com itens, pré-visualização SVG, histórico, instalação da PWA |
| `public/sw.js` | Service worker |
| `scripts/` | Geração de ícones, verificação da base de dados e testes |
