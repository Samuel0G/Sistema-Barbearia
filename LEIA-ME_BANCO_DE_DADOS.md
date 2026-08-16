# Migração para banco de dados (Neon / Vercel Postgres)

O app deixou de guardar os dados no `localStorage` do navegador. Agora ele
usa rotas de API (pasta `api/`) que conversam com um banco Postgres (Neon),
então os dados ficam centralizados e visíveis em qualquer dispositivo.

## O que mudou

- `src/main.jsx`: em vez de ler/escrever no `localStorage`, o app busca tudo
  em `/api/state` ao carregar e chama `/api/appointments`, `/api/settings`
  para criar/atualizar dados. Atualiza sozinho a cada 20s e ao voltar o foco
  na aba, para refletir mudanças feitas em outro aparelho.
- `api/state.js`: `GET` — retorna `{ appointments, services, settings }`.
- `api/appointments.js`: `POST` (criar), `PATCH` (mudar status), `DELETE`
  (excluir).
- `api/settings.js`: `PUT` (atualizar configurações da barbearia).
- `sql/schema.sql`: script para criar as tabelas no banco.
- `package.json`: adicionada a dependência `@neondatabase/serverless`.

## Passo a passo

1. **Criar o banco.** No painel da Vercel do seu projeto, vá em
   **Storage → Create Database → Postgres (Neon)**. Isso já cria a variável
   de ambiente `DATABASE_URL` automaticamente no projeto.

   Se preferir criar direto no [neon.tech](https://neon.tech) e conectar
   manualmente, copie a *connection string* e adicione como variável de
   ambiente `DATABASE_URL` em **Project Settings → Environment Variables**
   na Vercel (marque Production, Preview e Development).

2. **Rodar o schema.** Abra o **SQL Editor** do Neon (ou use o editor de
   Query da Vercel Storage) e cole o conteúdo de `sql/schema.sql`. Rode uma
   vez — ele cria as tabelas `appointments`, `services` e `settings`, e já
   popula os serviços padrão.

3. **Instalar a nova dependência.** No projeto (localmente, na sua máquina):
   ```bash
   npm install
   ```
   Isso vai baixar o `@neondatabase/serverless`.

4. **Testar localmente (opcional).** Rodar `vite dev` sozinho não executa as
   funções da pasta `api/`. Para testar local com as rotas de API, use a
   CLI da Vercel:
   ```bash
   npm i -g vercel
   vercel env pull .env.local
   vercel dev
   ```

5. **Deploy.** Suba o projeto (git push, se o deploy automático da Vercel
   estiver ligado no repositório `Samuel0G/Sistema-Barbearia`). A Vercel
   detecta a pasta `api/` automaticamente e publica cada arquivo como uma
   função serverless.

## Observações

- Os dados antigos que estavam salvos no `localStorage` de cada navegador
  **não são migrados automaticamente** — eles ficam obsoletos. Se precisar
  recuperar agendamentos antigos, me avise que ajudo a escrever um script
  de importação a partir do JSON exportado do navegador.
- O login do admin (`admin` / `1234`) continua sendo verificado só no
  front-end, como já era antes — não mudei essa parte porque não envolve
  o banco de dados. Se quiser, dá pra reforçar isso depois.
- Os relógios das janelas (07:00–19:00 etc.) e serviços padrão vêm do
  próprio `sql/schema.sql`; edite os valores lá antes de rodar, ou ajuste
  depois direto pela tabela.
