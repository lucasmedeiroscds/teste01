/* Importador de extratos em CSV.
 *
 * Feito para ser tolerante: cada plataforma nomeia as colunas de um jeito, e
 * muita gente monta a própria planilha. Então o fluxo é ler o arquivo, chutar
 * o mapeamento das colunas, deixar o usuário corrigir e só gravar depois da
 * prévia. Nada é enviado para lugar nenhum — a leitura é toda no navegador.
 */

import { parseNum, todayISO } from '../util.js';

/* ---------- Leitura ---------- */

function detectarDelimitador(amostra) {
  const linha = amostra.split(/\r?\n/).find((l) => l.trim()) || '';
  const cand = [',', ';', '\t', '|'];
  let melhor = ',';
  let max = 0;
  for (const d of cand) {
    const n = (linha.match(new RegExp(`\\${d}`, 'g')) || []).length;
    if (n > max) { max = n; melhor = d; }
  }
  return melhor;
}

/** Parser CSV com aspas, escape duplo e quebra de linha dentro do campo. */
export function parseCSV(texto) {
  const limpo = String(texto).replace(/^﻿/, '');
  const d = detectarDelimitador(limpo.slice(0, 4000));
  const linhas = [];
  let campo = '';
  let linha = [];
  let aspas = false;

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') { campo += '"'; i++; }
        else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { aspas = true; continue; }
    if (c === d) { linha.push(campo); campo = ''; continue; }
    if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; continue; }
    if (c === '\r') continue;
    campo += c;
  }
  linha.push(campo);
  linhas.push(linha);

  const uteis = linhas.filter((l) => l.some((c) => String(c).trim() !== ''));
  if (!uteis.length) return { headers: [], rows: [], delimitador: d };

  const headers = uteis[0].map((h, i) => String(h).trim() || `Coluna ${i + 1}`);
  const rows = uteis.slice(1).map((l) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = (l[i] ?? '').trim(); });
    return o;
  });
  return { headers, rows, delimitador: d };
}

/* ---------- Campos do Giro ---------- */

export const CAMPOS = [
  { id: 'data',     nome: 'Data',                obrigatorio: true,  dicas: ['data', 'date', 'dia', 'periodo', 'período', 'data da viagem', 'request time', 'horario', 'horário', 'início', 'inicio', 'data do pagamento'] },
  { id: 'bruto',    nome: 'Ganho bruto (R$)',    obrigatorio: true,  dicas: ['ganho', 'ganhos', 'bruto', 'valor', 'total', 'earnings', 'fare', 'amount', 'receita', 'faturamento', 'seus ganhos', 'valor da corrida', 'valor total', 'pagamento'] },
  { id: 'gorjeta',  nome: 'Gorjeta (R$)',        obrigatorio: false, dicas: ['gorjeta', 'tip', 'tips', 'caixinha'] },
  { id: 'km',       nome: 'Distância',           obrigatorio: false, dicas: ['km', 'quilometr', 'quilômetr', 'distancia', 'distância', 'distance', 'miles', 'trip distance'] },
  { id: 'minutos',  nome: 'Tempo',               obrigatorio: false, dicas: ['duracao', 'duração', 'tempo', 'minutos', 'duration', 'horas', 'online', 'tempo online'] },
  { id: 'corridas', nome: 'Nº de corridas',      obrigatorio: false, dicas: ['corridas', 'entregas', 'viagens', 'pedidos', 'trips', 'quantidade', 'qtd'] },
  { id: 'gastos',   nome: 'Gastos do turno (R$)',obrigatorio: false, dicas: ['gasto', 'despesa', 'pedagio', 'pedágio', 'toll', 'combustivel', 'combustível', 'alimentacao', 'alimentação'] },
];

const norm = (s) => String(s).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/** Chuta qual coluna do arquivo alimenta cada campo do Giro. */
export function sugerirMapeamento(headers) {
  const usados = new Set();
  const mapa = {};
  for (const campo of CAMPOS) {
    let melhor = null;
    let melhorNota = 0;
    for (const h of headers) {
      if (usados.has(h)) continue;
      const nh = norm(h);
      for (const dica of campo.dicas) {
        const nd = norm(dica);
        let nota = 0;
        if (nh === nd) nota = 100;
        else if (nh.startsWith(nd) || nd.startsWith(nh)) nota = 70;
        else if (nh.includes(nd)) nota = 50;
        if (nota > melhorNota) { melhorNota = nota; melhor = h; }
      }
    }
    if (melhor && melhorNota >= 50) { mapa[campo.id] = melhor; usados.add(melhor); }
    else mapa[campo.id] = '';
  }
  return mapa;
}

/* ---------- Conversão ---------- */

const MESES_EN = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MESES_PT = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };

/** Aceita AAAA-MM-DD, DD/MM/AAAA, com ou sem hora, e "30 ago 2026". */
export function parseData(valor) {
  const s = String(valor || '').trim();
  if (!s) return null;

  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(m[1], m[2], m[3]);

  m = s.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
  if (m) {
    let ano = m[3];
    if (ano.length === 2) ano = String(2000 + Number(ano));
    return iso(ano, m[2], m[1]);           // padrão brasileiro: dia primeiro
  }

  m = s.match(/(\d{1,2})\s+de\s+([a-zç]{3,})\.?\s+de\s+(\d{4})/i) || s.match(/(\d{1,2})\s+([a-zç]{3,})\.?\s+(\d{4})/i);
  if (m) {
    const k = m[2].toLowerCase().slice(0, 3);
    const mes = MESES_PT[k] || MESES_EN[k];
    if (mes) return iso(m[3], mes, m[1]);
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return todayISO(d);
  return null;
}

function iso(y, m, d) {
  const yy = Number(y);
  const mm = Number(m);
  const dd = Number(d);
  if (!yy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/** "1h30", "01:30:00", "90 min", "1,5" → minutos. */
export function parseTempo(valor, unidade = 'auto') {
  const s = String(valor || '').trim().toLowerCase();
  if (!s) return 0;

  let m = s.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]) + (Number(m[3] || 0) / 60);

  m = s.match(/(\d+)\s*h(?:oras?)?\s*(\d+)?/);
  if (m) return Number(m[1]) * 60 + Number(m[2] || 0);

  const n = parseNum(s);
  if (unidade === 'horas') return n * 60;
  if (unidade === 'minutos') return n;
  if (/min/.test(s)) return n;
  if (/h/.test(s)) return n * 60;
  return n > 24 ? n : n * 60;      // sem pista: acima de 24 já é minuto
}

/**
 * @param {Array<object>} rows
 * @param {object} mapa           { data: 'Coluna X', bruto: '...', ... }
 * @param {object} opcoes         { app, agruparPorDia, distancia: 'km'|'milhas', tempo }
 * @returns {object}  turnos convertidos, avisos e quantas linhas ficaram de fora
 */
export function converter(rows, mapa, opcoes = {}) {
  const { app = 'outros', agruparPorDia = true, distancia = 'km', tempo = 'auto' } = opcoes;
  const fatorKm = distancia === 'milhas' ? 1.60934 : 1;
  const avisos = [];
  const brutos = [];
  let ignoradas = 0;

  for (const row of rows) {
    const data = parseData(mapa.data ? row[mapa.data] : '');
    const bruto = mapa.bruto ? parseNum(row[mapa.bruto]) : 0;
    if (!data) { ignoradas++; continue; }
    if (!Number.isFinite(bruto)) { ignoradas++; continue; }

    brutos.push({
      data,
      app,
      bruto,
      gorjeta: mapa.gorjeta ? parseNum(row[mapa.gorjeta]) : 0,
      km: (mapa.km ? parseNum(row[mapa.km]) : 0) * fatorKm,
      horas: (mapa.minutos ? parseTempo(row[mapa.minutos], tempo) : 0) / 60,
      corridas: mapa.corridas ? Math.round(parseNum(row[mapa.corridas])) : 1,
      gastos: mapa.gastos ? parseNum(row[mapa.gastos]) : 0,
      origem: 'importado',
    });
  }

  if (ignoradas) avisos.push(`${ignoradas} linha(s) sem data ou sem valor legível foram deixadas de fora.`);
  if (!mapa.km) avisos.push('Nenhuma coluna de distância foi mapeada. Sem quilômetros o Giro não consegue calcular o custo variável — dá para completar depois em cada lançamento.');
  if (!mapa.minutos) avisos.push('Nenhuma coluna de tempo foi mapeada, então o R$ por hora fica de fora desses lançamentos.');

  if (!agruparPorDia) return { turnos: brutos, avisos, ignoradas };

  const porDia = new Map();
  for (const t of brutos) {
    const chave = `${t.data}|${t.app}`;
    const cur = porDia.get(chave);
    if (!cur) { porDia.set(chave, { ...t, obs: 'Importado do extrato' }); continue; }
    cur.bruto += t.bruto;
    cur.gorjeta += t.gorjeta;
    cur.km += t.km;
    cur.horas += t.horas;
    cur.corridas += t.corridas;
    cur.gastos += t.gastos;
  }

  const turnos = [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data));
  if (turnos.length && brutos.length > turnos.length) {
    avisos.push(`${brutos.length} corridas foram somadas em ${turnos.length} dia(s).`);
  }
  return { turnos, avisos, ignoradas };
}

/* ---------- Exportação ---------- */

export function turnosParaCSV(turnos, nomeApp) {
  const head = ['data', 'app', 'bruto', 'gorjeta', 'km', 'horas', 'corridas', 'gastos', 'origem', 'obs'];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linhas = turnos.map((t) => [
    t.data, nomeApp(t.app), t.bruto.toFixed(2).replace('.', ','), (t.gorjeta || 0).toFixed(2).replace('.', ','),
    (t.km || 0).toFixed(1).replace('.', ','), (t.horas || 0).toFixed(2).replace('.', ','),
    t.corridas || 0, (t.gastos || 0).toFixed(2).replace('.', ','), t.origem || 'manual', t.obs || '',
  ].map(esc).join(';'));
  return [head.join(';'), ...linhas].join('\n');
}
