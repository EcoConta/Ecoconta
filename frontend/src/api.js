/**
 * SERVIÇO DE CONEXÃO COM A API - ECOCONTA
 * Abstrai as requisições assíncronas para o backend em FastAPI (http://localhost:8000).
 */

const BASE_URL = "http://localhost:8000";

/**
 * Função utilitária para tratamento unificado de respostas HTTP
 */
async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage = `Erro HTTP: ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.detail) {
        errorMessage = errorJson.detail;
      }
    } catch (e) {
      // Falha ao parsear JSON, mantém mensagem genérica
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export const api = {
  // --- AUTENTICAÇÃO ---

  /**
   * Registra um novo usuário no sistema
   */
  async cadastrarUsuario(nome, email, senha) {
    const res = await fetch(`${BASE_URL}/auth/cadastrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha })
    });
    return handleResponse(res);
  },

  /**
   * Autentica um usuário existente no sistema
   */
  async loginUsuario(email, senha) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });
    return handleResponse(res);
  },

  // --- RESIDÊNCIAS ---
  
  /**
   * Obtém a lista de todas as residências cadastradas para o usuário ativo
   */
  async listarResidencias(usuarioId = null) {
    const url = usuarioId ? `${BASE_URL}/residencias?usuario_id=${usuarioId}` : `${BASE_URL}/residencias`;
    const res = await fetch(url);
    return handleResponse(res);
  },

  /**
   * Cadastra uma nova residência vinculada ao usuário ativo
   * @param {string} nome Nome do local (Ex: "Apartamento Centro")
   * @param {number} usuarioId ID do usuário ativo
   */
  async criarResidencia(nome, usuarioId = null) {
    const res = await fetch(`${BASE_URL}/residencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, usuario_id: usuarioId })
    });
    return handleResponse(res);
  },

  /**
   * Remove uma residência e todos os seus dados associados em cascata
   * @param {number} id ID da residência
   */
  async deletarResidencia(id) {
    const res = await fetch(`${BASE_URL}/residencias/${id}`, {
      method: "DELETE"
    });
    return handleResponse(res);
  },

  // --- CONTAS DE ENERGIA (ONBOARDING PASSO 1) ---

  /**
   * Cadastra uma fatura de energia no histórico do local
   */
  async cadastrarConta(residenciaId, mesReferencia, consumoKwh, valorReais, diasFaturamento = 30) {
    const res = await fetch(`${BASE_URL}/contas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        residencia_id: parseInt(residenciaId),
        mes_referencia: mesReferencia,
        consumo_kwh: parseFloat(consumoKwh),
        valor_reais: parseFloat(valorReais),
        dias_faturamento: parseInt(diasFaturamento)
      })
    });
    return handleResponse(res);
  },

  // --- INVENTÁRIO (ONBOARDING PASSO 2 & 3) ---

  /**
   * Adiciona um eletrodoméstico específico ao inventário do usuário
   */
  async adicionarItemInventario(residenciaId, presetId, nomePersonalizado, potenciaUtilizada, horasDia, diasMes = 30) {
    const res = await fetch(`${BASE_URL}/inventario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        residencia_id: parseInt(residenciaId),
        preset_id: presetId ? parseInt(presetId) : null,
        nome_personalizado: nomePersonalizado,
        potencia_utilizada: parseInt(potenciaUtilizada),
        horas_dia: parseFloat(horasDia),
        dias_mes: parseInt(diasMes)
      })
    });
    return handleResponse(res);
  },

  /**
   * Obtém o catálogo global de presets cadastrados para o Inventário Ágil
   * @param {string} [categoria] Filtro opcional por categoria (ex: 'Chuveiro')
   */
  async obterPresets(categoria = "") {
    const url = categoria ? `${BASE_URL}/presets?categoria=${encodeURIComponent(categoria)}` : `${BASE_URL}/presets`;
    const res = await fetch(url);
    return handleResponse(res);
  },

  // --- GAMIFICAÇÃO ---

  /**
   * Cadastra ou atualiza a meta de economia para uma residência
   */
  async cadastrarMeta(residenciaId, porcentagemMeta) {
    const res = await fetch(`${BASE_URL}/metas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        residencia_id: parseInt(residenciaId),
        porcentagem_meta: parseFloat(porcentagemMeta)
      })
    });
    return handleResponse(res);
  },

  // --- VIEWS ANALÍTICAS (DASHBOARDS) ---

  /**
   * Retorna os dados agregados de auditoria real vs estimada (View v_diagnostico_faturamento)
   */
  async obterDiagnostico(residenciaId) {
    const res = await fetch(`${BASE_URL}/residencias/${residenciaId}/diagnostico`);
    return handleResponse(res);
  },

  /**
   * Retorna o consumo detalhado e financeiro por aparelho (View v_consumo_projetado_aparelhos ou histórico)
   * @param {number} residenciaId ID do imóvel
   * @param {string} [mesReferencia] Mês histórico opcional (YYYY-MM)
   */
  async obterConsumoAparelhos(residenciaId, mesReferencia = "") {
    const url = mesReferencia 
      ? `${BASE_URL}/residencias/${residenciaId}/consumo-aparelhos?mes_referencia=${encodeURIComponent(mesReferencia)}`
      : `${BASE_URL}/residencias/${residenciaId}/consumo-aparelhos`;
    const res = await fetch(url);
    return handleResponse(res);
  },

  /**
   * Envia uma fatura PDF de energia para extração automática de dados de faturamento
   * @param {File} file Arquivo binário em PDF
   */
  async parseFaturaPdf(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE_URL}/contas/parse-pdf`, {
      method: "POST",
      body: formData
    });
    return handleResponse(res);
  },

  /**
   * Remove uma fatura de energia cadastrada no sistema
   * @param {number} id ID da fatura
   */
  async deletarConta(id) {
    const res = await fetch(`${BASE_URL}/contas/${id}`, {
      method: "DELETE"
    });
    return handleResponse(res);
  },

  /**
   * Retorna os cenários de simulação preventiva de economia (View v_simulador_modo_e_se)
   */
  async obterSimulacaoESe(residenciaId) {
    const res = await fetch(`${BASE_URL}/residencias/${residenciaId}/simulador-e-se`);
    return handleResponse(res);
  }
};
