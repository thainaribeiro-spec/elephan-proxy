const ELK_KEY = "elk_prod_212215fc24cac1ac917110d8ab68b93aa5b3633e820a8113f2fe1b4a986d9ab9";
const BASE = "https://api.elephan.dev/v1";

async function elkFetch(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${ELK_KEY}` }
  });
  if (!res.ok) throw new Error(`Elephan API error: ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, userId, promptId, startDate, endDate } = req.query;

  try {
    // Busca usuários CS
    if (action === "users") {
      const data = await elkFetch("/users?limit=100");
      const CS_EMAILS = [
        "chimeny@arvore.com.br","victoria@arvore.com.br","joyce.nascimento@arvore.com.br",
        "thais.borges@arvore.com.br","quezia.oliveira@arvore.com.br","mariaeduarda.neves@arvore.com.br",
        "naylane@arvore.com.br","joao.tesliuk@arvore.com.br","roberta.cosendey@arvore.com.br",
        "laura.zanatta@arvore.com.br","jaqueline.rovere@arvore.com.br"
      ];
      const csUsers = (data.data || []).filter(u => CS_EMAILS.includes(u.email));
      return res.status(200).json({ data: csUsers });
    }

    // Busca tipos de reunião (prompts) dos analistas CS
    if (action === "prompts") {
      // Busca prompts das transcrições de CS para pegar os customizados
      const PROMPT_IDS = {
        "EBR": "6824e64c6226cbee414c98b1",
        "Apresentação Ler Experiência Híbrida": "68d693bdc7b9814a80a5923f",
        "Ligação padrão CS": "682dc241e375664f7274f903",
        "Formação Única CS": "6967edd4abf5663987376e18",
        "Kick-off/Onboarding de novo cliente": "6a061ad4870d3c39ed0e8dc5",
        "Follow Up (FUP)": "6a061ad4870d3c39ed0e8dc4",
      };
      return res.status(200).json({
        data: Object.entries(PROMPT_IDS).map(([name, id]) => ({ id, name }))
      });
    }

    // Busca transcrições com detalhes completos
    if (action === "transcribes") {
      if (!userId || !promptId) {
        return res.status(400).json({ error: "userId e promptId são obrigatórios" });
      }

      // Monta params
      let params = `userId=${userId}&promptId=${promptId}&limit=100`;
      if (startDate) params += `&startDate=${startDate}`;
      if (endDate) params += `&endDate=${endDate}`;

      const lista = await elkFetch(`/transcribes?${params}`);
      const transcribes = lista.data || [];

      if (transcribes.length === 0) {
        return res.status(200).json({ data: [], total: 0 });
      }

      // Busca detalhe completo de cada transcrição (max 20 para não sobrecarregar)
      const detalhes = await Promise.all(
        transcribes.slice(0, 20).map(async t => {
          try {
            const d = await elkFetch(`/transcribes/${t.id}`);
            return d.data || d;
          } catch {
            return t;
          }
        })
      );

      return res.status(200).json({
        data: detalhes,
        total: lista.pagination?.total || transcribes.length,
        pagination: lista.pagination
      });
    }

    return res.status(400).json({ error: "Ação inválida. Use: users, prompts, transcribes" });

  } catch (err) {
    console.error("Erro:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
