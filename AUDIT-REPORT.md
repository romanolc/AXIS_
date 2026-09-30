# AXIS — Relatório de Auditoria e Hardening

## 1. Problemas encontrados

- Login e seed comparavam senhas com SHA-256.
- Estados de máquinas enviados pelo Digital Twin eram descartados pela rota.
- Atualizações de máquinas e recomendações não filtravam explicitamente por organização no PostgreSQL.
- O frontend não persistia o toggle de máquinas pela API.
- Forecast tinha endpoint, mas o frontend ainda mantinha o gráfico/resumo isolado dos dados retornados.
- Health check não identificava explicitamente `demoMode`.
- README descrevia partes já concluídas como etapa futura e não separava estados reais.
- OAuth Google e recuperação de senha não eram implementações completas e precisavam ser documentados como preparados.

## 2. Problemas corrigidos

- Migrado para Argon2id e removida a comparação SHA-256.
- Seed PostgreSQL grava hash Argon2id e atualiza hashes existentes no re-seed.
- Nenhuma senha é enviada ao frontend.
- Digital Twin utiliza o fluxo frontend → API → serviço → cálculo → resposta.
- Toggles de máquina chamam `PATCH /api/machines/:id` e respeitam organização.
- Recomendações filtram organização em listagem e atualização.
- Forecast consumido pela API, incluindo resumo e gráfico.
- JWT inválido ou expirado remove a sessão visual e retorna o usuário ao login.
- Loading, sucesso, erro, API indisponível e modo demo permanecem identificáveis.
- Health check informa `demoMode` e `simulated`.
- README e `.env.example` foram reescritos para refletir o estado real.
- Argon2 atualizado para versão sem vulnerabilidades no `npm audit`.

## 3. Funcionalidades realmente funcionais

- Login local, JWT, logout e proteção de rotas.
- Dashboard, sensores, máquinas, recomendações e perfil.
- Digital Twin, otimização e Impact Simulator com cálculos no backend.
- Persistência PostgreSQL preparada e registro de otimizações/cenários quando habilitada.
- Modo demo sem PostgreSQL.
- Validação Zod, CORS, Helmet, consultas parametrizadas e erros sem stack trace.

## 4. Funcionalidades ainda simuladas

- Sensores e leituras no modo demo.
- Forecast, score ESG e fatores de recomendação sem fonte operacional.
- Digital Twin, otimização e Impact Simulator são projeções determinísticas.
- Não há hardware, MQTT ou modelo de machine learning treinado conectado.

## 5. Funcionalidades preparadas/futuras

- Google OAuth: variáveis documentadas, sem callback funcional nesta versão.
- Recuperação de senha: contrato HTTP preparado; envio depende de provedor externo.
- Supabase Auth gerenciado: variáveis documentadas, login local permanece ativo.

## 6. Comandos

```bash
npm install
cp .env.example .env
npm test
npm start
```

PostgreSQL:

```bash
npm run db:setup
npm start
```

## 7. Variáveis necessárias

- `NODE_ENV`, `PORT`, `CORS_ORIGIN`;
- `JWT_SECRET`;
- `DATABASE_URL`, `DATABASE_SSL`;
- `DEMO_MODE`, `SENSOR_SIMULATOR_ENABLED`;
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_ALLOWED_DOMAIN` para a integração futura;
- variáveis Supabase opcionais documentadas em `.env.example`.

Para demo sem banco, use `DEMO_MODE=true` e `DATABASE_URL=`.

## 8. Testes executados

- `node --check` em backend, scripts, testes, frontend e `script.js`: aprovado.
- `npm test`: **7 testes aprovados, 0 falhas**.
- Login válido e inválido: aprovado.
- Ausência e invalidez de JWT: aprovado.
- Dashboard, sensores, recomendações e perfil: aprovado.
- Digital Twin com estado de máquina: aprovado.
- Otimização e Impact Simulator: aprovado.
- Atualização de máquina e recomendação: aprovado.
- Recuperação de senha como contrato e logout: aprovado.
- Smoke test do frontend servido e APIs autenticadas: aprovado.
- `npm audit --omit=dev`: **0 vulnerabilidades**.
