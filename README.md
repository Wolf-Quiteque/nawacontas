# NawaNotas

Aplicação web progressiva (PWA) para emitir e registar **Notas de Saída de Caixa NawaBus**.
Serve para qualquer saída de dinheiro: indica-se o beneficiário (quem recebe), a origem do dinheiro
(numerário, cartão, transferência…), a lista de itens com quantidade e preço, e a app gera o PDF, imprime e
regista a nota com um número sequencial e o nome de quem a criou. Tudo fica consultável no **Histórico**.

O documento segue o modelo gráfico original (`Nota_de_Pagamento_..._NawaBus_issac.pdf`): as posições,
tamanhos de letra, cores e tabelas foram medidos no PDF original e estão em
[`src/lib/layout.ts`](src/lib/layout.ts). O PDF (pdf-lib) e a pré-visualização (SVG) usam exatamente o mesmo layout.

## Funcionalidades

- **Contas com aprovação.** Criar conta com nome, número de telefone angolano (9 dígitos, ex.: 932 876 178)
  e palavra-passe; a conta fica **pendente** até um administrador a aprovar e só contas aprovadas entram
  (telefone + palavra-passe). A sessão dura 30 dias e renova-se enquanto a app é usada. Após 5 palavras-passe
  erradas seguidas a conta fica bloqueada durante 10 minutos.
- **Administradores** (página *Utilizadores*): aprovar ou recusar pedidos, remover pessoas (perdem o acesso de
  imediato), restaurar acesso, editar nomes e tornar/retirar administradores. Ninguém se pode remover a si
  próprio nem retirar o próprio papel de administrador, por isso existe sempre pelo menos um.
- **Autor de cada nota.** Cada nota regista quem a criou; aparece na página da nota e no histórico (também pesquisável).
- **Numeração automática e sequencial.** A primeira nota registada é a N.º 36 (as 35 anteriores
  foram emitidas antes da app). O número é atribuído pelo servidor ao guardar, sem duplicados.
- **Lista de itens** (até 12 por nota) com descrição, quantidade e preço unitário; o valor de cada linha é
  quantidade × preço. Total e **valor por extenso** (português, kwanzas) calculados automaticamente.
- **Histórico** com pesquisa (beneficiário, origem, item, autor ou número), intervalo de datas e atalhos.
- **Reimprimir / descarregar / partilhar** e **Reutilizar** qualquer nota antiga. As notas registadas não
  podem ser editadas. **Só administradores as podem eliminar**: a nota sai do histórico e o seu valor deixa de
  contar nos totais; o registo fica guardado (quem eliminou e quando) e o número não é reutilizado.
- Depois de registar (PDF, partilha ou impressão) a app abre automaticamente uma nova nota.
- Impressão a partir do PDF (A4 exata, sem margens do navegador).
- PWA instalável (iPhone, Android, computador) com menu lateral / gaveta e ajuda de instalação.

## Base de dados

A app usa **Postgres**. Em produção lê a ligação destas variáveis de ambiente (a primeira que existir):

```
POSTGRES_URL, DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING
```

Estas são as variáveis que a integração Neon/Vercel Postgres cria automaticamente no projeto.
As tabelas (`utilizadores`, `sessoes`, `saidas`) são criadas ou atualizadas na primeira utilização;
não é preciso correr migrações.

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
npm run check:db   # liga à base de dados do .env, aplica o esquema e mostra contagens
npm run criar-admin # cria ou promove um administrador (ver abaixo)
npm run test:db    # testa dados, contas e sessões num Postgres embebido temporário
npm run test:pdf   # gera um PDF de exemplo
```

## Primeiro administrador

As contas novas precisam de aprovação, por isso o primeiro administrador é criado com um script. Usa a base de
dados do `.env`, e a palavra-passe vai numa variável de ambiente para não ficar guardada em ficheiros:

```bash
ADMIN_TELEFONE=9XXXXXXXX ADMIN_NOME="Nome" ADMIN_SENHA="palavra-passe" npm run criar-admin
```

Se o número já tiver conta, esta é aprovada, promovida a administradora e fica com a palavra-passe indicada.
Os restantes administradores são nomeados na página *Utilizadores*.

## Publicar no Vercel

1. Importar o repositório no Vercel (raiz do projeto = raiz do repositório).
2. Ligar a base de dados ao projeto em **Storage** (a integração cria `POSTGRES_URL`/`DATABASE_URL`).
3. Deploy. Na primeira chamada as tabelas são criadas automaticamente.

## Instalar como app

O menu **Instalar app** (barra lateral / gaveta, e no ecrã de entrada) mostra as instruções para o dispositivo.

- **iPhone / iPad:** abrir no **Safari** → **Partilhar** → **Adicionar ao ecrã principal**.
- **Android:** Chrome → menu ⋮ → **Instalar app**.
- **Computador (Chrome/Edge):** ícone de instalação na barra de endereço, ou menu ⋮ →
  *Transmitir, guardar e partilhar* → *Instalar página como app*.

## Estrutura

| Ficheiro | Função |
| --- | --- |
| `src/proxy.ts` | Redireciona para `/entrar` quando não há cookie de sessão e renova a validade do cookie |
| `src/lib/auth/` | Hash de palavras-passe (scrypt), sessões, validação e constantes do cookie |
| `src/lib/telefone.ts` | Normalização e formatação de números de telefone angolanos |
| `src/lib/layout.ts` | Layout da nota em pontos (partilhado por PDF e pré-visualização) |
| `src/lib/pdf.ts` | Geração do PDF com pdf-lib (Helvetica, métricas idênticas à Arial) |
| `src/lib/extenso.ts` | Números por extenso em português |
| `src/lib/nota.ts` | Tipos, itens (qtd × preço), formatação de valores e datas, textos do documento |
| `src/lib/db/index.ts` | Ligação à base de dados (Postgres ou PGlite), esquema e migrações |
| `src/lib/db/notas.ts` | Notas: listar, obter, criar com número sequencial e autor |
| `src/lib/db/utilizadores.ts` | Contas: registar, autenticar (bloqueio por tentativas), aprovar, remover e gerir administradores |
| `src/app/api/auth/*` | `POST /api/auth/registar`, `/entrar`, `/sair` |
| `src/app/api/notas/*` | `GET/POST /api/notas`, `GET/DELETE /api/notas/[id]` (DELETE só administradores), `GET /api/notas/proximo` |
| `src/app/api/utilizadores/[id]` | `PATCH`: aprovar, remover, tornar/retirar administrador, renomear (só administradores) |
| `src/app/(auth)/` | Páginas públicas: entrar (`/entrar`) e criar conta (`/registar`) |
| `src/app/(app)/` | Páginas com sessão: nova nota (`/`), histórico (`/historico`), ver/reimprimir (`/notas/[id]`), utilizadores (`/utilizadores`, só administradores) |
| `src/components/` | Menu lateral, formulários, pré-visualização SVG, histórico, instalação da PWA |
| `public/sw.js` | Service worker (recursos estáticos e página offline) |
| `scripts/` | Geração de ícones, verificação da base de dados e testes |
