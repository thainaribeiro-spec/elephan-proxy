const ELK_KEY = "elk_prod_212215fc24cac1ac917110d8ab68b93aa5b3633e820a8113f2fe1b4a986d9ab9";
const BASE = "https://api.elephan.dev/v1";

async function elkFetch(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${ELK_KEY}` } });
  if (!res.ok) throw new Error(`Elephan error: ${res.status}`);
  return res.json();
}

function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

function extrairContextos(transcricao, keywords, janela=500) {
  if (!transcricao) return [];
  const texto = transcricao.toLowerCase();
  const trechos = [];
  for (const kw of keywords) {
    let idx = texto.indexOf(kw.toLowerCase());
    while (idx !== -1 && trechos.length < 4) {
      const inicio = Math.max(0, idx - 150);
      const fim = Math.min(transcricao.length, idx + janela);
      trechos.push(transcricao.slice(inicio, fim).trim());
      idx = texto.indexOf(kw.toLowerCase(), idx + kw.length);
    }
  }
  return trechos;
}

function avaliarFluenciaLeitora(transcribes) {
  const KWS = ["fluência leitora"];
  const reunioesComTema = transcribes.filter(t =>
    KWS.some(k => (t.transcript?.text||"").toLowerCase().includes(k))
  );
  if (reunioesComTema.length === 0) {
    return "A funcionalidade de Fluência Leitora não foi mencionada nas transcrições do período. Trata-se de um recurso estratégico que deveria ser apresentado em EBRs — sua ausência representa uma oportunidade perdida de demonstrar valor do produto.";
  }
  const contextos = reunioesComTema.flatMap(t => extrairContextos(t.transcript?.text||"", KWS));
  const temApresentacao = contextos.some(c => {
    const cl = c.toLowerCase();
    return cl.includes("apresent") || cl.includes("funcionalidade") || cl.includes("recurso") || cl.includes("avalia") || cl.includes("mostr") || cl.includes("explicou");
  });
  const temEngajamento = contextos.some(c => {
    const cl = c.toLowerCase();
    return cl.includes("professor") || cl.includes("aluno") || cl.includes("sala") || cl.includes("usand") || cl.includes("utilizand") || cl.includes("adotand");
  });
  const freq = reunioesComTema.length, total = transcribes.length;
  let analise = `Fluência Leitora foi abordada em ${freq} de ${total} reunião${total>1?"ões":""}. `;
  if (temApresentacao && temEngajamento) {
    analise += "O analista demonstra boa prática ao apresentar a funcionalidade conectando-a ao uso real em sala de aula e ao engajamento dos alunos.";
  } else if (temApresentacao) {
    analise += "O tema foi apresentado, mas a conexão com o impacto prático no dia a dia da escola pode ser aprofundada para gerar mais engajamento do cliente.";
  } else {
    analise += "O tema foi mencionado mas sem uma apresentação estruturada — recomenda-se explorar mais ativamente a funcionalidade durante as reuniões.";
  }
  return analise;
}

function avaliarContornoTelas(transcribes) {
  const KWS = ["tela", "celular"];
  const reunioesComTema = transcribes.filter(t =>
    KWS.some(k => (t.transcript?.text||"").toLowerCase().includes(k))
  );
  if (reunioesComTema.length === 0) {
    return "Objeções relacionadas ao uso de telas ou celular não foram identificadas nas transcrições do período.";
  }
  const contextos = reunioesComTema.flatMap(t => extrairContextos(t.transcript?.text||"", KWS));
  const temObjecao = contextos.some(c => {
    const cl = c.toLowerCase();
    return cl.includes("não gost") || cl.includes("proibid") || cl.includes("não permit") || cl.includes("problema") || cl.includes("difícil") || cl.includes("preocup") || cl.includes("não quer") || cl.includes("limitad") || cl.includes("restri");
  });
  const temContorno = contextos.some(c => {
    const cl = c.toLowerCase();
    return cl.includes("suger") || cl.includes("alternativ") || cl.includes("solução") || cl.includes("que tal") || cl.includes("uma forma") || cl.includes("navegador") || cl.includes("chrome") || cl.includes("podemos");
  });
  const temAcolhimento = contextos.some(c => {
    const cl = c.toLowerCase();
    return cl.includes("entend") || cl.includes("faz sentido") || cl.includes("compreend") || cl.includes("claro") || cl.includes("certo") || cl.includes("verdade");
  });
  if (!temObjecao) {
    return "Telas e celular foram mencionados nas reuniões em contexto de uso da plataforma, sem objeções explícitas identificadas no período.";
  } else if (temContorno && temAcolhimento) {
    return "Objeções sobre uso de telas foram identificadas e o analista demonstra boa capacidade de acolher a resistência e propor alternativas concretas — como o acesso pelo navegador — antes de apresentar a solução.";
  } else if (temContorno) {
    return "O analista propõe alternativas frente à objeção de telas, mas pode aprofundar o acolhimento antes de responder — ouvir mais o cliente antes de apresentar a solução tende a gerar maior receptividade.";
  } else {
    return "Objeções sobre telas foram identificadas nas transcrições, mas sem contorno estruturado. Recomenda-se preparar argumentações específicas para essa resistência, como apresentar o acesso pelo navegador como alternativa viável.";
  }
}

function avaliarExpansao(transcribes) {
  const KWS_C = ["inglês", "bilíngue", "comunicar"];
  const KWS_H = ["experiência híbrida", "híbrida", "livro físico"];
  const reunC = transcribes.filter(t => KWS_C.some(k => (t.transcript?.text||"").toLowerCase().includes(k)));
  const reunH = transcribes.filter(t => KWS_H.some(k => (t.transcript?.text||"").toLowerCase().includes(k)));
  const ctxC = reunC.flatMap(t => extrairContextos(t.transcript?.text||"", KWS_C));
  const ctxH = reunH.flatMap(t => extrairContextos(t.transcript?.text||"", KWS_H));
  const comunicarAtivo = ctxC.some(c => {
    const cl = c.toLowerCase();
    return cl.includes("apresent") || cl.includes("modul") || cl.includes("ofert") || cl.includes("que tal") || cl.includes("podemos") || cl.includes("recurso");
  });
  const hibridaAtivo = ctxH.some(c => {
    const cl = c.toLowerCase();
    return cl.includes("apresent") || cl.includes("ofert") || cl.includes("proposta") || cl.includes("que tal") || cl.includes("podemos") || cl.includes("projeto");
  });
  const total = transcribes.length;
  const partesC = reunC.length > 0
    ? (comunicarAtivo
        ? `Comunicar foi apresentado proativamente em ${reunC.length} de ${total} reuniões, com o analista propondo o módulo como solução para a demanda bilíngue da escola.`
        : `Comunicar foi mencionado em ${reunC.length} de ${total} reuniões de forma reativa — o tema surgiu do cliente, não de uma apresentação proativa do analista.`)
    : "Comunicar não foi abordado nas reuniões do período.";
  const partesH = reunH.length > 0
    ? (hibridaAtivo
        ? `Experiência Híbrida foi apresentada proativamente em ${reunH.length} de ${total} reuniões.`
        : `Experiência Híbrida foi mencionada em ${reunH.length} de ${total} reuniões sem apresentação estruturada da oferta.`)
    : "Experiência Híbrida não foi abordada nas reuniões do período.";
  return {
    analise: `${partesC} ${partesH}`.trim(),
    comunicar: { abordou: reunC.length > 0, ativo: comunicarAtivo },
    hibrida: { abordou: reunH.length > 0, ativo: hibridaAtivo }
  };
}

function gerarPontosFortes(transcribes) {
  const pergAltas = transcribes.flatMap(t => (t.answers||[]).filter(a => a.score >= 8 && a.question));
  const simRespondidas = transcribes.flatMap(t => (t.answers||[]).filter(a => a.yesNo === "yes" && a.question));
  const pontos = [...new Set([
    ...pergAltas.map(a => a.question.split("?")[0].trim()),
    ...simRespondidas.map(a => a.question.split("?")[0].trim())
  ])].slice(0,3);
  return pontos.length > 0 ? pontos : [
    "Condução das reuniões com presença e escuta ativa",
    "Apresentação de dados de uso com clareza",
    "Engajamento do cliente na definição de próximos passos"
  ];
}

function gerarSugestoesMelhoria(transcribes) {
  const pergsBaixas = transcribes.flatMap(t => (t.answers||[]).filter(a => a.score > 0 && a.score < 7 && a.question).map(a => a.question));
  const pergsNaoRespondidas = transcribes.flatMap(t => (t.answers||[]).filter(a => !a.score && !a.yesNo && a.question).map(a => a.question));
  const sugestoes = [];
  if (pergsBaixas.some(p => p.toLowerCase().includes("obje") || p.toLowerCase().includes("tela"))) sugestoes.push("Desenvolver argumentações mais estruturadas para objeções recorrentes, especialmente sobre uso de telas.");
  if (pergsBaixas.some(p => p.toLowerCase().includes("plano") || p.toLowerCase().includes("próximos"))) sugestoes.push("Reforçar o encerramento das reuniões com planos de ação claros, datas definidas e responsáveis identificados.");
  if (pergsNaoRespondidas.some(p => p.toLowerCase().includes("fluência"))) sugestoes.push("Explorar mais ativamente a Fluência Leitora nas reuniões — recurso estratégico ainda pouco abordado.");
  if (pergsNaoRespondidas.some(p => p.toLowerCase().includes("sentimento") || p.toLowerCase().includes("satisf"))) sugestoes.push("Incluir verificação explícita do sentimento geral do cliente ao final das reuniões.");
  if (pergsBaixas.some(p => p.toLowerCase().includes("comunicaç") || p.toLowerCase().includes("vícios"))) sugestoes.push("Trabalhar a comunicação verbal — reduzir vícios de linguagem para transmitir mais segurança.");
  if (sugestoes.length < 2) {
    sugestoes.push("Aprofundar apresentação de módulos de expansão (Comunicar, Experiência Híbrida) durante os EBRs.");
    sugestoes.push("Manter a consistência na cobertura de todos os tópicos do scorecard.");
  }
  return sugestoes.slice(0,4);
}

function gerarRelatorio(transcribes, analista, periodo, tipoReuniao) {
  const total = transcribes.length;
  const todasNotas = transcribes.flatMap(t => (t.answers||[]).filter(a => typeof a.score === "number" && a.score > 0).map(a => a.score));
  const notaScorecard = todasNotas.length ? Math.round(avg(todasNotas)*10)/10 : 0;
  const totalPerguntas = transcribes.flatMap(t => (t.answers||[])).length;
  const respondidas = transcribes.flatMap(t => (t.answers||[]).filter(a => a.score > 0 || a.yesNo === "yes")).length;
  const aderencia = totalPerguntas > 0 ? Math.round((respondidas/totalPerguntas)*100) : 0;

  const notasPorReuniaoCalc = [...transcribes].map(t => {
    const ns = (t.answers||[]).filter(a=>a.score>0).map(a=>a.score);
    return ns.length ? Math.round(avg(ns)*10)/10 : null;
  }).filter(n => n !== null);
  const notaMaisAlta = notasPorReuniaoCalc.length ? Math.max(...notasPorReuniaoCalc) : notaScorecard;
  const notaMaisBaixa = notasPorReuniaoCalc.length ? Math.min(...notasPorReuniaoCalc) : notaScorecard;

  const expansao = avaliarExpansao(transcribes);

  const porData = [...transcribes].sort((a,b) => new Date(a.dateIncluded)-new Date(b.dateIncluded));
  const notasPorReuniao = porData.map((t,i) => {
    const ns = (t.answers||[]).filter(a=>a.score>0).map(a=>a.score);
    return { label: `Reun. ${i+1}`, nota: ns.length ? Math.round(avg(ns)*10)/10 : notaScorecard };
  });
  const primeira = notasPorReuniao[0]?.nota || notaScorecard;
  const ultima = notasPorReuniao[notasPorReuniao.length-1]?.nota || notaScorecard;
  const tendencia = ultima > primeira + 0.3 ? "crescente" : ultima < primeira - 0.3 ? "decrescente" : "estável";

  return {
    analista, periodo,
    tipo_reuniao: tipoReuniao || "Todos os tipos",
    total_reunioes: total,
    nota_geral: notaScorecard,
    nota_mais_alta: notaMaisAlta,
    nota_mais_baixa: notaMaisBaixa,
    scorecard: {
      nota: notaScorecard,
      aderencia_percentual: aderencia,
      detalhes: `Aderência de ${aderencia}% aos critérios do scorecard. Nota média: ${notaScorecard}/10. ${aderencia >= 80 ? "Boa cobertura do roteiro." : aderencia >= 60 ? "Cobertura parcial — há tópicos relevantes não abordados." : "Baixa aderência ao roteiro — vários critérios precisam ser trabalhados."}`
    },
    objecoes: {
      detalhes: avaliarContornoTelas(transcribes)
    },
    negociacao: {
      detalhes: expansao.analise,
      comunicar: expansao.comunicar,
      hibrida: expansao.hibrida
    },
    fluencia_leitora: {
      detalhes: avaliarFluenciaLeitora(transcribes)
    },
    pontos_fortes: gerarPontosFortes(transcribes),
    pontos_melhorar: gerarSugestoesMelhoria(transcribes),
    evolucao: {
      tendencia,
      descricao: `Tendência ${tendencia} ao longo do período. ${tendencia === "crescente" ? "O analista demonstra evolução consistente nas avaliações." : tendencia === "decrescente" ? "Atenção: queda no desempenho — recomenda-se acompanhamento próximo." : "Desempenho estável ao longo das reuniões analisadas."}`,
      notas_por_reuniao: notasPorReuniao
    },
    resumo_executivo: `Análise de ${total} reunião${total>1?"ões":""} do tipo ${tipoReuniao||"todos"} no período ${periodo}. Nota média no scorecard: ${notaScorecard}/10, com ${aderencia}% de aderência ao roteiro. Tendência: ${tendencia}. ${expansao.comunicar.abordou || expansao.hibrida.abordou ? "Oportunidades de expansão foram identificadas nas reuniões." : "Oportunidades de expansão (Comunicar e Experiência Híbrida) não foram exploradas no período."}`
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
