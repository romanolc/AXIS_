# AXIS — Plataforma de Inteligência Energética Industrial

O AXIS preserva o frontend original em HTML/CSS/JavaScript e possui um backend Node.js + Express com API REST, autenticação JWT, modo demo em memória e persistência opcional em PostgreSQL.

Esta documentação descreve o estado real após a auditoria técnica. O projeto não afirma possuir hardware físico, MQTT, modelo de machine learning treinado ou Google OAuth funcional.

## Início rápido

Requisitos:

- Node.js 20+
- PostgreSQL 14+ somente para persistência real

```bash
npm install
cp .env.example .env
npm test
npm start
```

Acesse `http://localhost:3000`.

### Modo DEMO

Para iniciar sem PostgreSQL:

```env
DEMO_MODE=true
DATABASE_URL=
```

Nesse modo, os dados permanecem em memória, são fornecidos pelo backend e são identificados nas respostas como simulados quando aplicável. A conta demo é definida exclusivamente no backend/configuração de seed; nenhuma senha é enviada ou armazenada no frontend.

### PostgreSQL

Configure `DATABASE_URL` e execute:

```bash
npm run db:migrate
npm run db:seed
npm start
```

O seed grava somente um hash Argon2id da conta inicial. Substitua ou desabilite a conta demo antes de um ambiente de produção.

## Estado real das funcionalidades

### Funcional

- Login local via `POST /api/auth/login`.
- JWT assinado com issuer `axis-api` e expiração de 8 horas.
- Proteção das rotas de dados com `Authorization: Bearer <token>`.
- Logout lógico e tratamento de sessão expirada no frontend.
- Hashing e verificação de senhas com Argon2id.
- Dashboard consumindo KPIs, sensores, máquinas e forecast pela API.
- Lista de sensores com loading, sucesso, erro e última atualização.
- Recomendações carregadas pela API e aplicação de status com isolamento por organização.
- Digital Twin no fluxo frontend → API → serviço backend → cálculo → resposta.
- Otimização via `POST /api/optimization/run`, com registro em memória demo ou PostgreSQL.
- Impact Simulator via `POST /api/scenarios/simulate`, com cálculo e persistência no backend.
- Atualização de estados das máquinas com filtro por organização.
- Perfil e preferências autenticados.
- CORS, Helmet, validação Zod e tratamento de erros sem stack trace para o cliente.

### Preparado, mas não funcional nesta versão

- Google OAuth: as variáveis de ambiente estão documentadas, mas não existe callback/troca de código/token implementado. Não há botão falso na interface.
- Recuperação de senha: `/api/auth/password-recovery` é somente um contrato de aceitação. O envio de e-mail exige um provedor externo, serviço de e-mail, tokens de uso único e expiração.
- Supabase/Auth gerenciado: variáveis documentadas, mas o login atual é local/JWT.
- Integração com hardware, MQTT, ESP32 ou gateways industriais: arquitetura futura, sem dispositivo conectado.

### Simulado ou projetado

- Leituras e sensores do modo demo.
- Forecast de energia.
- Cenários do Digital Twin, otimização e Impact Simulator.
- Score de carbono e fatores de recomendação quando não há uma fonte operacional real.
- Dados de sustentabilidade/ESG sem ingestão externa.

### Futuro

- Callback completo para Google OAuth.
- Provedor de recuperação de senha.
- Ingestão MQTT/hardware.
- Modelos de previsão treinados e monitoramento de qualidade do modelo.
- Observabilidade e trilha de auditoria de produção.

## API principal

| Método | Endpoint | Autenticação | Finalidade |
|---|---|---:|---|
| GET | `/api/health` | Não | Saúde e modo de persistência |
| POST | `/api/auth/login` | Não | Login local e emissão de JWT |
| POST | `/api/auth/logout` | Sim | Logout lógico |
| POST | `/api/auth/password-recovery` | Não | Contrato preparado; não envia e-mail |
| GET | `/api/auth/me` | Sim | Perfil da sessão |
| GET | `/api/dashboard` | Sim | KPIs, sensores, máquinas e leituras |
| GET | `/api/energy/readings` | Sim | Leituras energéticas |
| GET | `/api/energy/forecast` | Sim | Forecast demonstrativo |
| GET | `/api/sensors` | Sim | Sensores da organização |
| GET/PATCH | `/api/machines`, `/api/machines/:id` | Sim | Máquinas e estado operacional |
| GET/PATCH | `/api/recommendations/:id` | Sim | Recomendações e fatores explicáveis |
| POST | `/api/twin/simulate` | Sim | Digital Twin |
| GET/POST | `/api/scenarios`, `/api/scenarios/simulate` | Sim | Cenários e Impact Simulator |
| GET/POST | `/api/optimization`, `/api/optimization/run` | Sim | Histórico e execução de otimização |
| GET/PATCH | `/api/user/profile` | Sim | Perfil |
| GET/PATCH | `/api/user/preferences` | Sim | Preferências |
| GET | `/api/sustainability` | Sim | Indicadores ESG demonstrativos |

## Segurança

- Senhas: Argon2id; não há comparação SHA-256.
- JWT: segredo configurável, issuer fixo e expiração.
- Produção exige `JWT_SECRET` diferente do valor de desenvolvimento.
- Validação de bodies e parâmetros com Zod.
- Consultas PostgreSQL parametrizadas.
- Rotas de máquinas e recomendações filtram `organization_id`.
- Stack traces não são retornados ao cliente.
- `SUPABASE_SERVICE_ROLE_KEY` e credenciais OAuth devem permanecer somente no ambiente do servidor.
- CORS é controlado por `CORS_ORIGIN`.

## Variáveis de ambiente

Consulte `.env.example`:

- `NODE_ENV`, `PORT`, `CORS_ORIGIN`;
- `DATABASE_URL`, `DATABASE_SSL`;
- `JWT_SECRET`;
- `DEMO_MODE`, `SENSOR_SIMULATOR_ENABLED`;
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_ALLOWED_DOMAIN`;
- variáveis opcionais do Supabase.

## Testes

```bash
npm test
```

A validação de integração usada na auditoria cobre:

- sintaxe dos módulos JavaScript;
- login válido e inválido;
- emissão e uso de JWT;
- logout e sessão expirada;
- dashboard, sensores e recomendações;
- Digital Twin;
- otimização e registro;
- Impact Simulator;
- rotas sem autenticação;
- token inválido;
- DEMO_MODE sem PostgreSQL;
- contratos do frontend servidos pelo Express.

Para PostgreSQL, execute `npm run db:setup` em um banco disponível e repita os fluxos autenticados. Sem um servidor PostgreSQL configurado, essa parte permanece validada por schema, seed e consultas parametrizadas, não por execução de banco nesta máquina.
