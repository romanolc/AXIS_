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
| GET | `/api/sustainability` | Sim | Indicadores ESG, cálculo CO2e e metodologia |
| GET | `/api/sustainability/reference-data` | Sim | Dados externos oficiais e cenários hipotéticos |
| POST | `/api/sustainability/efficiency-simulation` | Sim | Simulação de redução percentual, economia e CO2e |
| GET | `/api/sustainability/reports/goals.pdf` | Sim | PDF de Metas ESG 2025 |
| GET | `/api/sustainability/reports/institutional.pdf` | Sim | PDF institucional de indicadores |

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

## Privacidade, acessibilidade e Libras

O login usa o endpoint real `/api/auth/login`, Argon2id no backend e JWT na sessão atual do frontend. A senha e o hash não são enviados nas respostas. A tela de login informa que os dados são tratados de acordo com a legislação de proteção de dados aplicável, sem declarar certificações ou políticas jurídicas específicas.

O AXIS mantém controles de alto contraste, fonte grande, modo simplificado, redução de movimento e leitura por voz. O render de sensores constrói o DOM com `textContent`, sem interpolar valores vindos da API diretamente em HTML. A navegação principal possui landmarks, foco visível, skip link e controles nomeados para leitores de tela.

O botão de Libras usa o widget oficial do VLibras (`https://vlibras.gov.br/app/vlibras-plugin.js`). O serviço é externo e depende de conectividade; quando não carrega, o AXIS informa a indisponibilidade sem simular tradução. O widget não substitui intérprete humano e sua disponibilidade deve ser validada conforme a política de rede e privacidade da implantação.

## Variáveis de ambiente

Consulte `.env.example`:

- `NODE_ENV`, `PORT`, `CORS_ORIGIN`;
- `DATABASE_URL`, `DATABASE_SSL`;
- `JWT_SECRET`;
- `DEMO_MODE`, `SENSOR_SIMULATOR_ENABLED`;
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_ALLOWED_DOMAIN`;
- variáveis opcionais do Supabase.
- `EMISSION_FACTOR_VALUE`, `EMISSION_FACTOR_UNIT`, `EMISSION_FACTOR_PERIOD`, `EMISSION_FACTOR_SOURCE`, `EMISSION_FACTOR_METHODOLOGY`, `EMISSION_FACTOR_REFERENCE_DATE`.

O fator de emissão não possui valor padrão inventado. A aplicação prioriza a referência oficial do MCTI/SIRENE, mas exige que o valor, período, fonte, metodologia e data de referência sejam informados no ambiente antes de calcular CO2e.

## Referências e transparência

O AXIS apresenta dados externos como **DADO REAL** ou **CONTEXTO DE MERCADO**, sem tratá-los como resultados da plataforma:

- EPE — consumo industrial de 199.341 GWh (199,341 TWh) em 2025 e participação de 35,2% no consumo nacional: [Anuário Estatístico de Energia Elétrica 2026](https://dashboard.epe.gov.br/apps/anuario-livro/livro/pt/destaques.html).
- MME — potencial externo de eficiência de 7% até 2034: [PDE 2034](https://www.gov.br/mme/pt-br/assuntos/noticias/pde-2034-revela-que-ganhos-em-eficiencia-energetica-podem-reduzir-consumo-de-energia-no-brasil-em-7-ate-2034).
- MME — estudos nacionais com potencial estimado de R$ 10 bilhões e 4,5 milhões de tCO2e até 2050: [PotencializEE](https://www.gov.br/mme/pt-br/assuntos/noticias/novas-politicas-publicas-para-eficiencia-energetica-industrial-podem-gerar-economia-de-r-10-bi-e-a-reducao-de-cerca-de-4-5-mtco2e-ate-2050).
- IBGE — contexto de mercado: [PIA-Empresa](https://www.ibge.gov.br/estatisticas/economicas/industria/9042-pesquisa-industrial-anual.html).
- MCTI/SIRENE — fator de emissão do SIN: [método da análise de despacho](https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/cgcl/paginas/metodo-da-analise-de-despacho).

Fórmulas utilizadas:

```text
Intensidade energética = energia consumida / unidade produzida
Energia economizada = consumo anual × redução percentual
Economia financeira estimada = energia economizada × tarifa energética
CO2e evitado = energia economizada (MWh) × fator de emissão (tCO2e/MWh)
```

Os cenários de 5%, 15% e 30% são **hipóteses de simulação**. A simulação nacional de 1% resulta de um dado real da EPE, mas não é uma previsão ou resultado do AXIS. A intensidade energética permanece indisponível quando unidades produzidas não estão cadastradas.

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
- cálculo conhecido de MWh para tCO2e, cenário sem economia e fator não configurado;
- geração, assinatura e conteúdo dos PDFs ESG e institucional;
- rotas sem autenticação;
- token inválido;
- DEMO_MODE sem PostgreSQL;
- contratos do frontend servidos pelo Express.
- referências EPE/MME/IBGE/MCTI, ODS 7/9, intensidade indisponível sem produção e simulação de eficiência.

Para PostgreSQL, execute `npm run db:setup` em um banco disponível e repita os fluxos autenticados. Sem um servidor PostgreSQL configurado, essa parte permanece validada por schema, seed e consultas parametrizadas, não por execução de banco nesta máquina.
