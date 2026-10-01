import { env } from '../config/env.js';
import { db } from '../database/client.js';
import { demoStore, getDemoOrganizationId } from '../database/demo-store.js';
import { getDashboard, getMachines } from './energy.service.js';
import { calculateTwin } from './digital-twin.service.js';
import { round } from '../utils/helpers.js';

const ESG_GOALS = [
  { name: 'Redução de CO2e', progress: 78, target: 'Meta: -30% até Dez/25', status: 'estimado' },
  { name: 'Eficiência energética', progress: 91, target: 'Meta: 90% até Jun/25', status: 'estimado' },
  { name: 'Energia renovável', progress: 43, target: 'Meta: 60% até Dez/25', status: 'estimado' },
  { name: 'Uso de água', progress: 28, target: 'Meta: 50% até Dez/25', status: 'estimado' }
];

const EMISSION_SOURCE = 'MCTI/SIRENE — Sistema Interligado Nacional, método da análise de despacho (https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/cgcl/paginas/metodo-da-analise-de-despacho)';

export const EXTERNAL_REFERENCES = Object.freeze({
  industrialElectricity2025: { value_gwh: 199341, value_twh: 199.341, share_national_percent: 35.2, type: 'DADO REAL', label: 'Consumo de eletricidade da indústria brasileira em 2025', source: 'EPE — Anuário Estatístico de Energia Elétrica 2026', url: 'https://dashboard.epe.gov.br/apps/anuario-livro/livro/pt/destaques.html' },
  sectorGrowth2025: { type: 'DADO REAL', source: 'EPE — Anuário Estatístico de Energia Elétrica 2026', url: 'https://dashboard.epe.gov.br/apps/anuario-livro/livro/pt/destaques.html', sectors: [{ name: 'Máquinas e equipamentos', percent: 4.3 }, { name: 'Produtos alimentícios', percent: 3.4 }, { name: 'Borracha e plástico', percent: 2.8 }, { name: 'Minerais não metálicos', percent: 3.7 }, { name: 'Extração de minerais metálicos', percent: 7.9 }] },
  efficiencyPotential2034: { value_percent: 7, horizon: 2034, type: 'DADO REAL', label: 'Potencial externo de redução por eficiência energética', source: 'MME — PDE 2034', url: 'https://www.gov.br/mme/pt-br/assuntos/noticias/pde-2034-revela-que-ganhos-em-eficiencia-energetica-podem-reduzir-consumo-de-energia-no-brasil-em-7-ate-2034' },
  potentializee2050: { savings_brl: 10000000000, co2e_avoided_tonnes: 4500000, horizon: 2050, type: 'DADO REAL', label: 'Potencial nacional em políticas de eficiência industrial', source: 'MME — PotencializEE', url: 'https://www.gov.br/mme/pt-br/assuntos/noticias/novas-politicas-publicas-para-eficiencia-energetica-industrial-podem-gerar-economia-de-r-10-bi-e-a-reducao-de-cerca-de-4-5-mtco2e-ate-2050' },
  industrialMarket: { type: 'CONTEXTO DE MERCADO', label: 'Pesquisa Industrial Anual — PIA-Empresa', source: 'IBGE', url: 'https://www.ibge.gov.br/estatisticas/economicas/industria/9042-pesquisa-industrial-anual.html' }
});

export const EFFICIENCY_SCENARIOS = Object.freeze([
  { id: 'conservador', label: 'Cenário conservador', reduction_percent: 5, type: 'HIPÓTESE' },
  { id: 'referencia', label: 'Cenário de referência', reduction_percent: 15, type: 'HIPÓTESE', reference: 'Intervalo hipotético para demonstração; não é histórico do AXIS.' },
  { id: 'potencial', label: 'Cenário potencial', reduction_percent: 30, type: 'HIPÓTESE', reference: 'Intervalo hipotético para demonstração; não é garantia de economia.' }
]);

export function calculateEnergyIntensity({ energyKwh, productionUnits, unit = 'unidade produzida' }) {
  const energy = Number(energyKwh);
  const output = Number(productionUnits);
  if (!Number.isFinite(energy) || !Number.isFinite(output) || output <= 0) return { available: false, value: null, unit: `kWh/${unit}`, formula: 'energia consumida (kWh) / unidade produzida', status: 'production_units_not_configured' };
  return { available: true, value: round(Math.max(0, energy) / output, 3), unit: `kWh/${unit}`, formula: 'energia consumida (kWh) / unidade produzida', status: 'estimated' };
}

export function simulateEfficiency({ annualConsumptionMwh = 1000, reductionPercent = 15, tariffBrlMwh = 0, factor = getEmissionFactor() }) {
  const consumption = Math.max(0, Number(annualConsumptionMwh) || 0);
  const reduction = Math.min(100, Math.max(0, Number(reductionPercent) || 0));
  const saved = round(consumption * reduction / 100, 3);
  const financial = round(saved * Math.max(0, Number(tariffBrlMwh) || 0), 2);
  const environmental = calculateCo2e({ referenceKwh: consumption * 1000, optimizedKwh: (consumption - saved) * 1000, factor });
  return { type: 'SIMULAÇÃO', annual_consumption_mwh: consumption, reduction_percent: reduction, energy_saved_mwh: saved, optimized_consumption_mwh: round(consumption - saved, 3), tariff_brl_mwh: Math.max(0, Number(tariffBrlMwh) || 0), estimated_savings_brl: financial, co2e_avoided_tonnes: environmental.co2e_avoided_tonnes, co2e_status: environmental.status, emission_factor: environmental.factor, formula_financial: 'energia economizada (MWh) × tarifa energética (R$/MWh)', formula_co2e: environmental.formula, note: 'Resultado hipotético de simulação; não é medição real nem economia garantida pelo AXIS.' };
}

export function getEmissionFactor() {
  const configured = Number.isFinite(env.emissionFactorValue) && env.emissionFactorValue >= 0;
  return {
    value: configured ? env.emissionFactorValue : null,
    unit: env.emissionFactorUnit,
    period: env.emissionFactorPeriod || null,
    source: env.emissionFactorSource || EMISSION_SOURCE,
    methodology: env.emissionFactorMethodology || 'Fator médio de emissão da geração de energia elétrica do SIN para inventários corporativos.',
    reference_date: env.emissionFactorReferenceDate || null,
    configured
  };
}

export function calculateCo2e({ referenceKwh = 0, optimizedKwh = 0, factor = getEmissionFactor() }) {
  const reference = Math.max(0, Number(referenceKwh) || 0);
  const optimized = Math.max(0, Number(optimizedKwh) || 0);
  const energySavedKwh = round(Math.max(0, reference - optimized), 3);
  const energySavedMwh = round(energySavedKwh / 1000, 6);
  const compatibleUnit = factor.unit === 'tCO2e/MWh';
  const co2eTonnes = factor.configured && compatibleUnit ? round(energySavedMwh * factor.value, 6) : null;
  return {
    reference_kwh: round(reference, 3),
    optimized_kwh: round(optimized, 3),
    energy_saved_kwh: energySavedKwh,
    energy_saved_mwh: energySavedMwh,
    co2e_avoided_tonnes: co2eTonnes,
    factor,
    configured: Boolean(factor.configured && compatibleUnit),
    status: factor.configured && compatibleUnit ? 'estimated' : 'factor_not_configured',
    formula: 'CO2e evitado = energia economizada (MWh) × fator de emissão (tCO2e/MWh)'
  };
}

async function getScenarioData(organizationId) {
  const [dashboard, machines] = await Promise.all([getDashboard(organizationId), getMachines(organizationId)]);
  const referenceKwh = dashboard.kpis.kwh_consumed;
  const current = calculateTwin({ production: 80, hvac: 60, lighting: 100, machines });
  const optimized = calculateTwin({ production: 60, hvac: 40, lighting: 70, machines: machines.map((machine) => machine.name?.includes('A3') ? { ...machine, status: 'OFF' } : machine) });
  const impact = calculateCo2e({ referenceKwh, optimizedKwh: optimized.kwh });
  const financialSavings = round(Math.max(0, current.cost_per_hour - optimized.cost_per_hour) * 24 * 30, 2);
  return { dashboard, current, optimized, impact: { ...impact, monthly_savings_brl: financialSavings, simulated: Boolean(dashboard.simulated) } };
}

export async function getSustainabilityReport(organizationId = getDemoOrganizationId()) {
  const { dashboard, current, optimized, impact } = await getScenarioData(organizationId);
  const national = EXTERNAL_REFERENCES.industrialElectricity2025;
  const nationalOnePercentGwh = round(national.value_gwh * 0.01, 2);
  return {
    period: '2025',
    generated_at: new Date().toISOString(),
    simulated: Boolean(dashboard.simulated),
    data_status: dashboard.simulated ? 'SIMULADO' : 'REAL',
    carbon_score: dashboard.kpis.carbon_score,
    indicators: {
      current_consumption_kwh: dashboard.kpis.kwh_consumed,
      reference_consumption_kwh: impact.reference_kwh,
      optimized_consumption_kwh: impact.optimized_kwh,
      energy_saved_kwh: impact.energy_saved_kwh,
      energy_saved_mwh: impact.energy_saved_mwh,
      monthly_savings_brl: impact.monthly_savings_brl,
      current_co2_kg: dashboard.kpis.co2_kg
    },
    intensity: calculateEnergyIntensity({ energyKwh: dashboard.kpis.kwh_consumed, productionUnits: null }),
    ods: {
      ods7: { name: 'ODS 7 — Energia limpa e acessível', target: 'Meta 7.3 — melhoria da eficiência energética', primary_indicator: 'Intensidade energética', indicator: calculateEnergyIntensity({ energyKwh: dashboard.kpis.kwh_consumed, productionUnits: null }) },
      ods9: { name: 'ODS 9 — Indústria, inovação e infraestrutura', target: 'Modernização e sustentabilidade da infraestrutura industrial', primary_indicator: 'Ativos monitorados', value_percent: dashboard.sensors.total ? round((dashboard.sensors.online / dashboard.sensors.total) * 100, 1) : 0, optimization_opportunities: 3 },
      co2e_role: 'Indicador ambiental complementar; não é o indicador principal do ODS 9.'
    },
    external_references: EXTERNAL_REFERENCES,
    national_scale_simulation: { type: 'SIMULAÇÃO', base: 'DADO REAL', consumption_gwh: national.value_gwh, reduction_percent: 1, avoided_gwh: nationalOnePercentGwh, avoided_twh: round(nationalOnePercentGwh / 1000, 3), statement: 'Se 1% do consumo elétrico industrial de 2025 fosse evitado, isso representaria aproximadamente 1,99 TWh.', source: national.source, url: national.url },
    twin: { current, optimized },
    impact,
    goals: ESG_GOALS,
    methodology: 'A redução estimada é calculada pela diferença entre o consumo de referência e o consumo projetado no cenário otimizado. O CO2e estimado é calculado apenas quando existe fator de emissão configurado.',
    limitations: [
      dashboard.simulated ? 'Os dados de energia são provenientes do Demo Store e devem ser tratados como simulados.' : 'Os dados dependem da qualidade das leituras persistidas.',
      'O fator de emissão não é inferido nem substituído por valor genérico quando não está configurado.',
      'O resultado é uma estimativa operacional e não constitui certificação, verificação ou auditoria ambiental.'
    ]
  };
}

function pdfText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '?');
}

function escapePdf(value) {
  return pdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrap(value, width = 92) {
  const words = pdfText(value).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!word) continue;
    if ((line + ' ' + word).trim().length > width && line) { lines.push(line); line = word; }
    else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

function money(value) { return `R$ ${Number(value || 0).toFixed(2)}`; }
function decimal(value, digits = 3) { return Number(value || 0).toFixed(digits); }

function buildPdf(title, report, kind) {
  const factor = report.impact.factor;
  const lines = [
    'AXIS | PLATAFORMA DE INTELIGENCIA ENERGETICA INDUSTRIAL',
    title,
    `Periodo analisado: ${report.period} | Status dos dados: ${report.data_status}`,
    `Gerado em: ${report.generated_at}`,
    '',
    'INDICADORES ENERGETICOS',
    `Consumo de referencia: ${decimal(report.indicators.reference_consumption_kwh)} kWh`,
    `Consumo otimizado projetado: ${decimal(report.indicators.optimized_consumption_kwh)} kWh`,
    `Energia economizada: ${decimal(report.indicators.energy_saved_kwh)} kWh (${decimal(report.indicators.energy_saved_mwh, 6)} MWh)`,
    `Economia financeira mensal estimada: ${money(report.indicators.monthly_savings_brl)}`,
    `Score de carbono disponivel: ${report.carbon_score}`,
    '',
    'IMPACTO AMBIENTAL ESTIMADO',
    report.impact.configured ? `CO2e estimado evitado: ${decimal(report.impact.co2e_avoided_tonnes, 6)} tCO2e` : 'CO2e estimado evitado: nao calculado — fator de emissao nao configurado',
    `Formula: ${report.impact.formula}`,
    `Fator: ${factor.value === null ? 'nao configurado' : `${factor.value} ${factor.unit}`}`,
    `Periodo do fator: ${factor.period || 'nao informado'}`,
    `Fonte: ${factor.source}`,
    `Metodologia: ${factor.methodology}`,
    `Data de referencia: ${factor.reference_date || 'nao informada'}`,
    '',
    'ODS E INDICADORES OPERACIONAIS',
    `ODS 7 / Meta 7.3 — Intensidade energetica: ${report.intensity.available ? `${report.intensity.value} ${report.intensity.unit}` : 'nao disponivel — unidades produzidas nao configuradas'}`,
    `ODS 9 — Ativos monitorados: ${report.ods.ods9.value_percent}% | Oportunidades de otimizacao: ${report.ods.ods9.optimization_opportunities}`,
    'CO2e e indicador ambiental complementar, nao o indicador principal do ODS 9.',
    '',
    'REFERENCIA EXTERNA E SIMULACAO DE ESCALA',
    `EPE: ${report.national_scale_simulation.consumption_gwh} GWh (${report.national_scale_simulation.consumption_gwh / 1000} TWh) de consumo industrial em 2025.`,
    `Simulacao hipotetica de 1%: ${report.national_scale_simulation.avoided_gwh} GWh (${report.national_scale_simulation.avoided_twh} TWh).`,
    `Fonte: ${report.national_scale_simulation.source} — ${report.national_scale_simulation.url}`,
    `MME/PDE 2034: potencial externo de ${EXTERNAL_REFERENCES.efficiencyPotential2034.value_percent}% ate 2034; nao e previsao do AXIS.`,
    `MME/PotencializEE: potencial nacional estimado de R$ 10 bi e 4,5 MtCO2e ate 2050; nao e resultado do AXIS.`,
    '',
    kind === 'goals' ? 'METAS ESG E RESULTADOS DISPONIVEIS' : 'INDICADORES INSTITUCIONAIS E EVOLUCAO',
    ...report.goals.map((goal) => `${goal.name}: ${goal.progress}% | ${goal.target} | ${goal.status}`),
    '',
    'METODOLOGIA E LIMITACOES',
    ...wrap(report.methodology),
    ...report.limitations.flatMap((item) => wrap(`- ${item}`)),
    '',
    'Este documento nao afirma certificacoes, verificacoes ou auditorias que nao estejam documentadas no ambiente AXIS.'
  ];
  const pages = [];
  for (let i = 0; i < lines.length; i += 45) pages.push(lines.slice(i, i + 45));
  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const pageObjectIds = pages.map((_, index) => 4 + (index * 2));
  objects.push(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach((page, index) => {
    const pageId = 4 + (index * 2);
    const contentId = pageId + 1;
    const content = ['BT', '/F1 10 Tf', '50 770 Td', '14 TL', ...page.map((line) => `(${escapePdf(line)}) Tj T*`), 'ET'].join('\n');
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId - 1] = `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`;
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, 'latin1'); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

export async function createSustainabilityPdf({ organizationId = getDemoOrganizationId(), kind = 'goals' }) {
  const report = await getSustainabilityReport(organizationId);
  const title = kind === 'institutional' ? 'RELATORIO INSTITUCIONAL DE INDICADORES AMBIENTAIS' : 'RELATORIO DE METAS ESG 2025';
  return { buffer: buildPdf(title, report, kind), filename: kind === 'institutional' ? 'axis-relatorio-institucional.pdf' : 'axis-metas-esg-2025.pdf', report };
}

export { EMISSION_SOURCE };
