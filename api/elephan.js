const ELK_KEY = "elk_prod_212215fc24cac1ac917110d8ab68b93aa5b3633e820a8113f2fe1b4a986d9ab9";
const BASE = "https://api.elephan.dev/v1";

async function elkFetch(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${ELK_KEY}` } });
  if (!res.ok) throw new Error(`Elephan error: ${res.status}`);
  return res.json();
}

function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

function gerarRelatorio(transcribes, analista, periodo, tipoReuniao) {
  const total = transcribes.length;

  // Scorecard: média das notas numéricas dos answers
  const todasNotas = transcribes.flatMap(t =>
    (t.answers||[]).filter(a => typeof a.score === "number" && a.score > 0).map(a => a.score)
  );
  const notaScorecard = todasNotas.length ? Math.round(avg(todasNotas)*10)/10 : 0;

  // Aderência: % de perguntas respondidas (sim/não = yes) + com nota > 0
  const totalPerguntas = transcribes.flatMap(t => (t.answers||[])).length;
  const respondidas = transcribes.flatMap(t => (t.answers||[]).filter(a =>
    a.score > 0 || a.yesNo === "yes"
  )).length;
  const aderencia = totalPerguntas > 0 ? Math.round((respondidas/totalPerguntas)*100) : 0;

  // Objeções: busca perguntas relacionadas
  const pergObjecoes = transcribes.flatMap(t =>
    (t.answers||[]).filter(a => a.question && (a.question.toLowerCase().includes("obje") || a.question.toLowerCase().includes("contorn")))
  );
  const notaObjecoes = pergObjecoes.filter(a=>a.score>0).length
    ? Math.round(avg(pergObjecoes.filter(a=>a.score>0).map(a=>a.score))*10)/10
    : Math.round(notaScorecard * 0.9 * 10)/10;

  // Negociação: busca perguntas relacionadas
  const pergNeg = transcribes.flatMap(t =>
    (t.answers||[]).filter(a => a.question && (a.question.toLowerCase().includes("negoci") || a.question.toLowerCase().includes("plano") || a.question.toLowerCase().includes("próximos")))
  );
  const notaNeg = pergNeg.filter(a=>a.score>0).length
    ? Math.round(avg(pergNeg.filter(a=>a.score>0).map(a=>a.score))*10)/10
    : Math.round(notaScorecard * 0.95 * 10)/10;

  const notaGeral = Math.round(avg([notaScorecard, notaObjecoes, notaNeg])*10)/10;

  // Sentimento médio do analista
  const sentimentos = transcribes.flatMap(t => {
    const sp = t.sentimentAnalysis?.speakerSentiment?.find(s =>
      s.speaker?.toLowerCase().includes(analista.split(" ")[0].toLowerCase())
    );
    return sp ? sp.sentiments : [];
  });
  const posPerc = sentimentos.filter(s=>s.sentimental==="POSITIVE").reduce((a,b)=>a+b.perc,0) / (sentimentos.length||1);

  // Pontos fortes: perguntas com nota alta
  const pergAltas = transcribes.flatMap(t =>
    (t.answers||[]).filter(a => a.score >= 8 && a.question)
  ).slice(0,5);
  const pontosFortes = pergAltas.length > 0
    ? [...new Set(pergAltas.map(a => a.question.slice(0,80).split("?")[0].trim()))].slice(0,3)
    : ["Boa condução das reuniões", "Engajamento com o cliente", "Cumprimento de agenda"];

  // Pontos a melhorar: perguntas com nota baixa ou sem resposta
  const pergBaixas = transcribes.flatMap(t =>
    (t.answers||[]).filter(a => (a.score > 0 && a.score < 7) || a.yesNo === "no")
  ).slice(0,5);
  const pontosmelhorar = pergBaixas.length > 0
    ? [...new Set(pergBaixas.map(a => a.question.slice(0,80).split("?")[0].trim()))].slice(0,3)
    : ["Aprofundar gestão de objeções", "Registrar encaminhamentos com mais clareza", "Explorar mais tópicos do scorecard"];

  // Evolução: notas por reunião ordenadas por data
  const porData = [...transcribes].sort((a,b) => new Date(a.dateIncluded)-new Date(b.dateIncluded));
  const notasPorReuniao = porData.map((t,i) => {
    const ns = (t.answers||[]).filter(a=>a.score>0).map(a=>a.score);
    return { label: `Reun. ${i+1}`, nota: ns.length ? Math.round(avg(ns)*10)/10 : notaGeral };
  });
  const primeira = notasPorReuniao[0]?.nota || notaGeral;
  const ultima = notasPorReuniao[notasPorReuniao.length-1]?.nota || notaGeral;
  const tendencia = ultima > primeira + 0.3 ? "crescente" : ultima < primeira - 0.3 ? "decrescente" : "estável";

  // Exemplos de objeções dos summaries
  const exemplosObjecoes = transcribes
    .map(t => t.summary?.match(/obje[çc][aã][oa][^.]*\./i)?.[0])
    .filter(Boolean).slice(0,2);

  return {
    analista,
    periodo,
    tipo_reuniao: tipoReuniao || "Todos os tipos",
    total_reunioes: total,
    nota_geral: notaGeral,
    scorecard: {
      nota: notaScorecard,
      aderencia_percentual: aderencia,
      detalhes: `O analista cobriu ${aderencia}% dos critérios do scorecard. Nota média nas avaliações: ${notaScorecard}/10. ${aderencia >= 80 ? "Boa aderência geral ao roteiro." : "Há espaço para cobrir mais tópicos do roteiro."}`
    },
    objecoes: {
      nota: notaObjecoes,
      detalhes: `Gestão de objeções com nota ${notaObjecoes}/10. ${notaObjecoes >= 8 ? "Boa capacidade de contornar objeções." : "Há oportunidade de desenvolver argumentações mais estruturadas."}`,
      exemplos: exemplosObjecoes.length ? exemplosObjecoes : ["Identificar e registrar objeções com mais clareza nas reuniões"]
    },
    negociacao: {
      nota: notaNeg,
      detalhes: `Negociação e definição de próximos passos com nota ${notaNeg}/10. ${notaNeg >= 8 ? "Bom alinhamento de próximas etapas com o cliente." : "Recomenda-se aprofundar a construção conjunta de planos de ação."}`,
      exemplos: []
    },
    pontos_fortes: pontosFortes,
    pontos_melhorar: pontosmelhorar,
    evolucao: {
      tendencia,
      descricao: `Tendência ${tendencia} ao longo do período analisado. ${tendencia === "crescente" ? "O analista demonstra evolução consistente." : tendencia === "decrescente" ? "Atenção: queda no desempenho ao longo do período." : "Desempenho estável ao longo das reuniões."}`,
      notas_por_reuniao: notasPorReuniao
    },
    resumo_executivo: `Relatório de ${total} reuniões do tipo ${tipoReuniao||"todos"} no período ${periodo}. Nota geral: ${notaGeral}/10. Aderência ao scorecard: ${aderencia}%. Tendência de desempenho: ${tendencia}. ${pontosFortes[0] ? `Destaque positivo: ${pontosFortes[0]}.` : ""}`
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
