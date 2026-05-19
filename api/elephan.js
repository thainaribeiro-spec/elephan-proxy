const ELK_KEY = "elk_prod_212215fc24cac1ac917110d8ab68b93aa5b3633e820a8113f2fe1b4a986d9ab9";
const BASE = "https://api.elephan.dev/v1";

async function elkFetch(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${ELK_KEY}` } });
  if (!res.ok) throw new Error(`Elephan error: ${res.status}`);
  return res.json();
}

function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

function extrairTrechosObjecoes(transcricao) {
  if (!transcricao) return [];
  const linhas = transcricao.split(/[.!?]\s+/);
  const keywords = ["objeç","não consigo","não tenho","não vou","difícil","problema","preocup","caro","valor","cust","não funciona","reclamaç","insatisf","frustr"];
  return linhas.filter(l => keywords.some(k => l.toLowerCase().includes(k))).slice(0,3).map(l => l.trim().slice(0,120));
}

function extrairTrechosNegociacao(transcricao) {
  if (!transcricao) return [];
  const linhas = transcricao.split(/[.!?]\s+/);
  const keywords = ["próximos passos","próximo passo","combinar","vamos fazer","proposta","acordo","plano de ação","encaminh","sugerir","que tal","podemos","vou verificar","vou confirmar"];
  return linhas.filter(l => keywords.some(k => l.toLowerCase().includes(k))).slice(0,3).map(l => l.trim().slice(0,120));
}

function gerarInsightObjecoes(transcribes) {
  const trechos = transcribes.flatMap(t => extrairTrechosObjecoes(t.transcript?.text || ""));
  if (trechos.length === 0) return { detalhes: "Não foram identificadas objeções explícitas nas reuniões do período. Isso pode indicar reuniões com alta satisfação ou ausência de registro de pontos de resistência do cliente.", exemplos: [] };
  const qtd = trechos.length;
  const detalhes = `Foram identificados ${qtd} momento${qtd>1?"s":""} de objeção ou resistência nas reuniões. ${qtd >= 3 ? "O cliente trouxe pontos de insatisfação relevantes que merecem atenção no próximo ciclo." : "As objeções foram pontuais e parecem ter sido contornadas."}`;
  return { detalhes, exemplos: trechos.slice(0,2) };
}

function gerarInsightNegociacao(transcribes) {
  const trechos = transcribes.flatMap(t => extrairTrechosNegociacao(t.transcript?.text || ""));
  if (trechos.length === 0) return { detalhes: "Não foram identificados registros claros de negociação ou definição de próximos passos nas transcrições. Recomenda-se reforçar o encerramento de reuniões com combinados explícitos.", exemplos: [] };
  const qtd = trechos.length;
  const detalhes = `Foram identificados ${qtd} momento${qtd>1?"s":""} de negociação ou encaminhamento nas reuniões. ${qtd >= 3 ? "O analista demonstra boa prática de fechar acordos e definir próximos passos." : "Há oportunidade de aprofundar a construção conjunta de planos de ação com o cliente."}`;
  return { detalhes, exemplos: trechos.slice(0,2) };
}

function gerarSugestoesMelhoria(transcribes) {
  // Baseado nas perguntas do scorecard com nota baixa ou não respondidas
  const pergsBaixas = transcribes.flatMap(t =>
    (t.answers||[]).filter(a => (a.score > 0 && a.score < 7) || a.yesNo === "no")
      .map(a => a.question)
  ).filter(Boolean);

  const pergsNaoRespondidas = transcribes.flatMap(t =>
    (t.answers||[]).filter(a => !a.score && !a.yesNo && a.question)
      .map(a => a.question)
  ).filter(Boolean);

  const sugestoes = [];

  if (pergsBaixas.some(p => p.toLowerCase().includes("obje"))) sugestoes.push("Desenvolver técnicas mais estruturadas para lidar com objeções — preparar argumentações para as resistências mais comuns do segmento.");
  if (pergsBaixas.some(p => p.toLowerCase().includes("plano") || p.toLowerCase().includes("próximos"))) sugestoes.push("Reforçar o encerramento das reuniões com planos de ação claros, datas definidas e responsáveis identificados.");
  if (pergsNaoRespondidas.some(p => p.toLowerCase().includes("fluência") || p.toLowerCase().includes("leitora"))) sugestoes.push("Explorar mais a funcionalidade de Fluência Leitora durante as reuniões — há critério de scorecard não abordado nesse tema.");
  if (pergsNaoRespondidas.some(p => p.toLowerCase().includes("sentimento") || p.toLowerCase().includes("satisf"))) sugestoes.push("Incluir verificação explícita do sentimento geral do cliente ao final das reuniões.");
  if (pergsBaixas.some(p => p.toLowerCase().includes("comunicaç") || p.toLowerCase().includes("vícios"))) sugestoes.push("Trabalhar a comunicação verbal — reduzir vícios de linguagem e gerúndios para transmitir mais segurança.");
  if (pergsNaoRespondidas.some(p => p.toLowerCase().includes("abertura") || p.toLowerCase().includes("agenda"))) sugestoes.push("Reforçar a abertura estruturada das reuniões, explicando agenda e duração antes de iniciar.");

  if (sugestoes.length === 0) {
    sugestoes.push("Manter a consistência na cobertura de todos os tópicos do scorecard.");
    sugestoes.push("Aprofundar o diagnóstico inicial antes de propor soluções.");
    sugestoes.push("Registrar encaminhamentos com mais precisão ao final de cada reunião.");
  }

  return sugestoes.slice(0,4);
}

function gerarPontosFortes(transcribes) {
  const pergAltas = transcribes.flatMap(t =>
    (t.answers||[]).filter(a => a.score >= 8 && a.question)
  );
  const simRespondidas = transcribes.flatMap(t =>
    (t.answers||[]).filter(a => a.yesNo === "yes" && a.question)
  );

  const pontos = [...new Set([
    ...pergAltas.map(a => a.question.split("?")[0].trim()),
    ...simRespondidas.map(a => a.question.split("?")[0].trim())
  ])].slice(0,5);

  return pontos.length > 0 ? pontos.slice(0,3) : [
    "Condução das reuniões com presença e escuta ativa",
    "Apresentação de dados de uso com clareza",
    "Engajamento do cliente na definição de próximos passos"
  ];
}

function gerarRelatorio(transcribes, analista, periodo, tipoReuniao) {
  const total = transcribes.length;

  const todasNotas = transcribes.flatMap(t =>
    (t.answers||[]).filter(a => typeof a.score === "number" && a.score > 0).map(a => a.score)
  );
  const notaScorecard = todasNotas.length ? Math.round(avg(todasNotas)*10)/10 : 0;

  const totalPerguntas = transcribes.flatMap(t => (t.answers||[])).length;
  const respondidas = transcribes.flatMap(t =>
    (t.answers||[]).filter(a => a.score > 0 || a.yesNo === "yes")
  ).length;
  const aderencia = totalPerguntas > 0 ? Math.round((respondidas/totalPerguntas)*100) : 0;

  const insightObjecoes = gerarInsightObjecoes(transcribes);
  const insightNegociacao = gerarInsightNegociacao(transcribes);
  const pontosFortes = gerarPontosFortes(transcribes);
  const sugestoesMelhoria = gerarSugestoesMelhoria(transcribes);

  const porData = [...transcribes].sort((a,b) => new Date(a.dateIncluded)-new Date(b.dateIncluded));
  const notasPorReuniao = porData.map((t,i) => {
    const ns = (t.answers||[]).filter(a=>a.score>0).map(a=>a.score);
    return { label: `Reun. ${i+1}`, nota: ns.length ? Math.round(avg(ns)*10)/10 : notaScorecard };
  });
  const primeira = notasPorReuniao[0]?.nota || notaScorecard;
  const ultima = notasPorReuniao[notasPorReuniao.length-1]?.nota || notaScorecard;
  const tendencia = ultima > primeira + 0.3 ? "crescente" : ultima < primeira - 0.3 ? "decrescente" : "estável";

  const notaGeral = notaScorecard;

  return {
    analista, periodo,
    tipo_reuniao: tipoReuniao || "Todos os tipos",
    total_reunioes: total,
    nota_geral: notaGeral,
    scorecard: {
      nota: notaScorecard,
      aderencia_percentual: aderencia,
      detalhes: `Aderência de ${aderencia}% aos critérios do scorecard. Nota média: ${notaScorecard}/10. ${aderencia >= 80 ? "Boa cobertura do roteiro." : aderencia >= 60 ? "Cobertura parcial — há tópicos relevantes não abordados." : "Baixa aderência ao roteiro — vários critérios precisam ser trabalhados."}`
    },
    objecoes: {
      detalhes: insightObjecoes.detalhes,
      exemplos: insightObjecoes.exemplos
    },
    negociacao: {
      detalhes: insightNegociacao.detalhes,
      exemplos: insightNegociacao.exemplos
    },
    pontos_fortes: pontosFortes,
    pontos_melhorar: sugestoesMelhoria,
    evolucao: {
      tendencia,
      descricao: `Tendência ${tendencia} ao longo do período. ${tendencia === "crescente" ? "O analista demonstra evolução consistente nas avaliações." : tendencia === "decrescente" ? "Atenção: queda no desempenho ao longo do período — recomenda-se acompanhamento próximo." : "Desempenho estável ao longo das reuniões analisadas."}`,
      notas_por_reuniao: notasPorReuniao
    },
    resumo_executivo: `Análise de ${total} reunião${total>1?"ões":""} do tipo ${tipoReuniao||"todos"} no período ${periodo}. Nota média no scorecard: ${notaScorecard}/10, com ${aderencia}% de aderência ao roteiro. Tendência de desempenho: ${tendencia}. ${insightObjecoes.exemplos.length > 0 ? "Foram identificados momentos de objeção que merecem atenção." : "Reuniões sem objeções explícitas registradas."} ${sugestoesMelhoria[0] ? `Principal foco de desenvolvimento: ${sugestoesMelhoria[0].slice(0,80)}.` : ""}`
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, userId, promptId, startDate, endDate, analista, tipoReuniao, periodo } = req.query;

  try {
    if (action === "users") {
      const data = await elkFetch("/users?limit=100");
      const CS_EMAILS = ["chimeny@arvore.com.br","victoria@arvore.com.br","joyce.nascimento@arvore.com.br","thais.borges@arvore.com.br","quezia.oliveira@arvore.com.br","mariaeduarda.neves@arvore.com.br","naylane@arvore.com.br","joao.tesliuk@arvore.com.br","roberta.cosendey@arvore.com.br","laura.zanatta@arvore.com.br","jaqueline.rovere@arvore.com.br"];
      return res.status(200).json({ data: (data.data||[]).filter(u => CS_EMAILS.includes(u.email)) });
    }

    if (action === "prompts") {
      return res.status(200).json({ data: [
        { id: "6824e64c6226cbee414c98b1", name: "EBR" },
        { id: "68d693bdc7b9814a80a5923f", name: "Apresentação Ler Experiência Híbrida" },
      ]});
    }

    if (action === "relatorio") {
      if (!userId || !promptId) return res.status(400).json({ error: "userId e promptId obrigatórios" });
      let params = `userId=${userId}&promptId=${promptId}&limit=100`;
      if (startDate) params += `&startDate=${startDate}`;
      if (endDate) params += `&endDate=${endDate}`;

      const lista = await elkFetch(`/transcribes?${params}`);
      const transcribes = (lista.data || []).slice(0, 20);
      if (transcribes.length === 0) return res.status(200).json({ error: "Nenhuma reunião encontrada no período." });

      const detalhes = await Promise.all(transcribes.map(async t => {
        try { const d = await elkFetch(`/transcribes/${t.id}`); return d.data || d; }
        catch { return t; }
      }));

      const relatorio = gerarRelatorio(detalhes, analista||"Analista", periodo||"Período", tipoReuniao||"");
      return res.status(200).json({ data: relatorio });
    }

    return res.status(400).json({ error: "Ação inválida" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
