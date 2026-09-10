# NawaNotas

Aplicação web progressiva (PWA) para emitir e registar **Notas de Pagamento NawaBus**.
Cada nota recebe automaticamente um número sequencial, fica guardada na base de dados e pode
ser consultada, filtrada por data, reimpressa ou editada mais tarde no **Histórico**.

O documento gerado reproduz fielmente o modelo original (`Nota_de_Pagamento_..._NawaBus_issac.pdf`):
todas as posições, tamanhos de letra, cores e tabelas foram medidos no PDF original e estão em
[`src/lib/layout.ts`](src/lib/layout.ts). O PDF (pdf-lib) e a pré-visualização/impressão (SVG) usam
exatamente o mesmo layout.

## Funcionalidades

- **Numeração automática e sequencial.** A primeira nota registada é a N.º 36 (as 35 anteriores
  foram emitidas antes da app). O número é atribuído pelo servidor ao guardar, sem duplicados.
- **Histórico** com pesquisa (nome, motivo, período ou número), intervalo de datas e atalhos
  (hoje, mês atual, mês passado, ano). Mostra o total líquido das notas filtradas.
- **Reimprimir / descarregar / partilhar** qualquer nota antiga; **editar** mantendo o número; eliminar.
- Data de hoje preenchida automaticamente (pode ser alterada); o ano no número segue a data.
- Valor líquido e **valor por extenso** (português, kwanzas) calculados automaticamente.
- Se a taxa do desconto for uma percentagem (ex.: `3%`), o desconto é calculado a partir da remuneração.
- Rascunho da nota nova guardado automaticamente no dispositivo.
- PWA instalável (iPhone, Android, computador) com menu lateral / gaveta.

## Base de dados

A app usa **Postgres**. Em produção lê a ligação destas variáveis de ambiente (a primeira que existir):

```
POSTGRES_URL, DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING
```

Estas são exatamente as variáveis que as integrações de base de dados do Vercel (Neon, Supabase,
Vercel Postgres) criam automaticamente no projeto. A tabela `notas` é criada na primeira utilização;
não é preciso correr migrações.

Sem nenhuma destas variáveis (por exemplo em desenvolvimento local) a app usa um Postgres embebido
(PGlite) guardado na pasta `.data/`, que não é enviada para o git.

Variáveis opcionais:

| Variável | Predefinição | Descrição |
| --- | --- | --- |
| `NOTAS_NUMERO_INICIAL` | `35` | Último número já emitido antes da app; a próxima nota recebe este valor + 1 |
| `PGLITE_DIR` | `.data/nawanotas` | Pasta do Postgres embebido (apenas sem base de dados externa) |

## Utilização

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:3000 (Postgres embebido em .data/)
npm run build      # build de produção
npm start          # servir a build
npm run test:db    # testa a camada de dados (numeração, filtros, edição, eliminação)
npm run test:pdf   # gera um PDF de exemplo
```

## Publicar no Vercel

1. Importar o repositório no Vercel (raiz do projeto = raiz do repositório).
2. Ligar a base de dados ao projeto em **Storage** (a integração cria `POSTGRES_URL`/`DATABASE_URL`).
3. Deploy. Na primeira chamada a tabela é criada automaticamente.

### Instalar no iPhone

1. Abrir o site no **Safari**.
2. Tocar em **Partilhar** e depois em **Adicionar ao ecrã principal**.

No Android e no Chrome/Edge de computador aparece o botão **Instalar**.

## Estrutura

| Ficheiro | Função |
| --- | --- |
| `src/lib/layout.ts` | Layout da nota em pontos (partilhado por PDF e pré-visualização) |
| `src/lib/pdf.ts` | Geração do PDF com pdf-lib (Helvetica, métricas idênticas à Arial) |
| `src/lib/extenso.ts` | Números por extenso em português |
| `src/lib/nota.ts` | Tipos, formatação de valores e datas |
| `src/lib/db/index.ts` | Ligação à base de dados (Postgres ou PGlite) e esquema |
| `src/lib/db/notas.ts` | Operações sobre as notas (listar, criar com número sequencial, editar, eliminar) |
| `src/lib/validacao.ts` | Validação dos dados recebidos pela API |
| `src/app/api/notas/*` | API REST (`GET/POST /api/notas`, `GET/PUT/DELETE /api/notas/[id]`, `GET /api/notas/proximo`) |
| `src/app/` | Páginas: nova nota (`/`), histórico (`/historico`), ver (`/notas/[id]`), editar (`/notas/[id]/editar`) |
| `src/components/` | Menu lateral, formulário, pré-visualização SVG, histórico, registo da PWA |
| `public/sw.js` | Service worker |
| `scripts/` | Geração de ícones e testes |
