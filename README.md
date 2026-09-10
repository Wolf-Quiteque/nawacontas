# NawaNotas

Aplicação web progressiva (PWA) para gerar **Notas de Pagamento NawaBus** em PDF.
Preenche-se o formulário, a nota aparece em pré-visualização e pode ser descarregada em PDF,
partilhada (iPhone/Android) ou impressa. Funciona offline depois da primeira visita e pode ser
instalada no iPhone, Android e computador.

O documento gerado reproduz fielmente o modelo original (`Nota_de_Pagamento_..._NawaBus_issac.pdf`):
todas as posições, tamanhos de letra, cores e tabelas foram medidos no PDF original e estão em
[`src/lib/layout.ts`](src/lib/layout.ts). O PDF (pdf-lib) e a pré-visualização/impressão (SVG) usam
exatamente o mesmo layout.

## Utilização

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:3000
npm run build      # exportação estática para a pasta out/
npx serve out      # servir a versão de produção localmente
```

Para testar a instalação como PWA (service worker) é preciso usar a versão de produção
(`npm run build` + `npx serve out`) ou publicar a pasta `out/` num alojamento com HTTPS
(Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc.).

### Instalar no iPhone

1. Abrir o site no **Safari**.
2. Tocar em **Partilhar** e depois em **Adicionar ao ecrã principal**.

No Android e no Chrome/Edge de computador aparece o botão **Instalar**.

## Funcionalidades

- Data de hoje preenchida automaticamente (pode ser alterada); o ano do número da nota segue a data.
- Número da nota sugerido automaticamente a partir do histórico.
- Valor líquido e **valor por extenso** (português, kwanzas) calculados automaticamente.
- Se a taxa do desconto for uma percentagem (ex.: `3%`), o desconto é calculado a partir da remuneração.
- Histórico das notas geradas guardado no dispositivo (localStorage).
- Rascunho guardado automaticamente.
- Descarregar PDF, Partilhar (share sheet do iOS/Android) e Imprimir (A4, sem margens).

## Estrutura

| Ficheiro | Função |
| --- | --- |
| `src/lib/layout.ts` | Layout da nota em pontos (partilhado por PDF e pré-visualização) |
| `src/lib/pdf.ts` | Geração do PDF com pdf-lib (Helvetica, métricas idênticas à Arial) |
| `src/lib/extenso.ts` | Números por extenso em português |
| `src/lib/nota.ts` | Tipos, formatação de valores e datas |
| `src/lib/armazenamento.ts` | Rascunho e histórico em localStorage |
| `src/components/` | Formulário, pré-visualização SVG, histórico, registo da PWA |
| `public/sw.js` | Service worker (offline) |
| `src/app/manifest.ts` | Manifesto da PWA |
| `scripts/icons.mjs` | Gera os ícones (`npm run icons`) |
| `scripts/test-pdf.ts` | Gera um PDF de teste (`npm run test:pdf`) |
