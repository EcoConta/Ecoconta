import React, { useState, useEffect } from "react";
import { api } from "../api";

export default function Onboarding({ residenciaId, onOnboardingComplete }) {
  const [passo, setPasso] = useState(1); // 1: Escolha, 2: Configuração, 3: Conclusão
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Catálogo de Presets e Seleções
  const [presets, setPresets] = useState([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("");
  const [presetSelecionado, setPresetSelecionado] = useState(null);
  
  // Dados do Aparelho a Cadastrar (Passo 2)
  const [nomeAparelho, setNomeAparelho] = useState("");
  const [potenciaWatts, setPotenciaWatts] = useState("");
  const [horasDia, setHorasDia] = useState(1.0);
  const [diasMes, setDiasMes] = useState(30);

  // Lista de aparelhos cadastrados localmente nesta sessão
  const [aparelhosSessao, setAparelhosSessao] = useState([]);

  // Categorias Globais do Catálogo
  const categorias = ["Chuveiro", "Ar Condicionado", "Geladeira", "Cozinha", "Entretenimento", "Escritório", "Iluminação", "Lavanderia", "Outro"];

  useEffect(() => {
    carregarPresets();
  }, []);

  const carregarPresets = async () => {
    try {
      const dados = await api.obterPresets();
      setPresets(dados);
    } catch (err) {
      console.error("Erro ao carregar presets:", err);
    }
  };

  // Seleciona uma categoria para filtrar presets
  const handleSelecionarCategoria = (cat) => {
    setCategoriaSelecionada(cat);
    setPresetSelecionado(null);
    if (cat === "Outro") {
      // Abre formulário livre
      setNomeAparelho("");
      setPotenciaWatts("");
      setHorasDia(1.0);
      setDiasMes(30);
      setPasso(2);
    }
  };

  // Seleciona um preset específico e vai para o formulário de horas
  const handleSelecionarPreset = (p) => {
    setPresetSelecionado(p);
    setNomeAparelho(p.nome_comercial);
    setPotenciaWatts(p.potencia_watts);
    setPasso(2);
  };

  // Cadastra o aparelho no inventário da residência
  const handleSalvarAparelho = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const novoItem = await api.adicionarItemInventario(
        residenciaId,
        presetSelecionado ? presetSelecionado.id : null,
        nomeAparelho,
        potenciaWatts,
        horasDia,
        diasMes
      );

      // Adiciona na lista da sessão para feedback visual do usuário
      setAparelhosSessao([...aparelhosSessao, novoItem]);
      
      // Limpa dados temporários do formulário
      setPresetSelecionado(null);
      setCategoriaSelecionada("");
      setNomeAparelho("");
      setPotenciaWatts("");
      setHorasDia(1.0);
      setDiasMes(30);
      
      // Retorna para a aba de seleção de mais aparelhos
      setPasso(1);
    } catch (err) {
      setErrorMsg(err.message || "Erro ao adicionar eletrodoméstico.");
    } finally {
      setLoading(false);
    }
  };

  // Conclui o onboarding cadastrando a meta padrão inicial
  const handleFinalizarOnboarding = async () => {
    setLoading(true);
    try {
      // Cadastra meta padrão de 10% na conclusão
      await api.cadastrarMeta(residenciaId, 10.0);
      onOnboardingComplete();
    } catch (err) {
      setErrorMsg("Erro ao finalizar onboarding.");
    } finally {
      setLoading(false);
    }
  };

  // Ícones representativos das categorias
  const getCategoriaIcon = (cat) => {
    switch (cat) {
      case "Chuveiro": return "🚿";
      case "Ar Condicionado": return "❄️";
      case "Geladeira": return "❄️ Fridge";
      case "Cozinha": return "🍳";
      case "Entretenimento": return "📺";
      case "Escritório": return "💻";
      case "Iluminação": return "💡";
      case "Lavanderia": return "🧺";
      default: return "🔌";
    }
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      
      {/* Indicador de Passos Simplificado (Aparelhos) */}
      <div style={styles.stepIndicator}>
        <div style={{ ...styles.step, ...(passo >= 1 ? styles.stepActive : {}) }}>
          <div style={styles.stepNum}>1</div>
          <span>Escolher Aparelho</span>
        </div>
        <div style={styles.stepLine}></div>
        <div style={{ ...styles.step, ...(passo >= 2 ? styles.stepActive : {}) }}>
          <div style={styles.stepNum}>2</div>
          <span>Configurar Uso</span>
        </div>
        <div style={styles.stepLine}></div>
        <div style={{ ...styles.step, ...(passo >= 3 ? styles.stepActive : {}) }}>
          <div style={styles.stepNum}>3</div>
          <span>Concluir</span>
        </div>
      </div>

      <div className="glass-card" style={styles.card}>
        {errorMsg && <div style={styles.errorAlert}>⚠️ {errorMsg}</div>}

        {/* --- PASSO 1: SELEÇÃO DE CATEGORIAS E PRESETS --- */}
        {passo === 1 && (
          <div className="animate-fade-in">
            <h2 style={styles.title}>Passo 1: Escolher Aparelhos</h2>
            <p style={styles.subtitle}>
              Preencha o inventário de sua casa. Selecione presets reais do catálogo ou crie um aparelho sob medida.
            </p>

            {!categoriaSelecionada ? (
              <div>
                <h3 style={styles.sectionTitle}>Selecione uma Categoria:</h3>
                <div style={styles.categoryGrid}>
                  {categorias.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleSelecionarCategoria(cat)}
                      style={styles.categoryButton}
                      className="glass-card"
                    >
                      <span style={styles.categoryIcon}>{getCategoriaIcon(cat)}</span>
                      <span style={styles.categoryName}>{cat}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="animate-fade-in">
                <button
                  onClick={() => setCategoriaSelecionada("")}
                  className="btn-secondary"
                  style={{ marginBottom: "20px", padding: "8px 16px" }}
                >
                  ⬅️ Voltar para Categorias
                </button>
                <h3 style={styles.sectionTitle}>Presets de Eletrodomésticos em "{categoriaSelecionada}":</h3>
                
                <div style={styles.presetGrid}>
                  {presets
                    .filter((p) => p.categoria === categoriaSelecionada)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelecionarPreset(p)}
                        style={styles.presetCard}
                        className="glass-card"
                      >
                        <h4 style={styles.presetName}>{p.nome_comercial}</h4>
                        <span className="badge badge-eco">{p.potencia_watts}W</span>
                      </button>
                    ))}
                  
                  {presets.filter((p) => p.categoria === categoriaSelecionada).length === 0 && (
                    <p style={{ color: "hsl(var(--text-muted))" }}>Nenhum preset cadastrado nesta categoria.</p>
                  )}
                </div>
              </div>
            )}

            {/* Listagem de Aparelhos Já Adicionados na Sessão */}
            {aparelhosSessao.length > 0 && (
              <div style={styles.sessaoInventario} className="animate-fade-in">
                <h4 style={styles.sessaoTitle}>Aparelhos Adicionados ({aparelhosSessao.length}):</h4>
                <div style={styles.sessaoChips}>
                  {aparelhosSessao.map((ap, idx) => (
                    <span key={idx} style={styles.chip} className="badge badge-fin">
                      🔌 {ap.nome_personalizado} ({ap.potencia_utilizada}W - {ap.horas_dia}h/dia)
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setPasso(3)}
                  className="btn-primary"
                  style={styles.btnConcluir}
                >
                  ➡️ Avançar para Concluir Onboarding
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- PASSO 2: CONFIGURAÇÃO DE Watts E HORAS DIÁRIAS --- */}
        {passo === 2 && (
          <form onSubmit={handleSalvarAparelho} className="animate-fade-in">
            <h2 style={styles.title}>Passo 2: Configurar Eletrodoméstico</h2>
            <p style={styles.subtitle}>
              Estipule os watts operacionais e o tempo estimado de operação na sua casa.
            </p>

            <div className="form-group">
              <label className="form-label">Nome do Equipamento</label>
              <input
                type="text"
                required
                value={nomeAparelho}
                onChange={(e) => setNomeAparelho(e.target.value)}
                className="form-control"
                placeholder="Ex: Chuveiro da Suíte Principal"
              />
            </div>

            <div className="grid-container" style={{ padding: 0, gap: "16px", marginBottom: "12px" }}>
              <div className="form-group" style={{ gridColumn: "span 6" }}>
                <label className="form-label">Potência (Watts)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Ex: 5500"
                  value={potenciaWatts}
                  onChange={(e) => setPotenciaWatts(e.target.value)}
                  className="form-control"
                />
              </div>
              <div className="form-group" style={{ gridColumn: "span 6" }}>
                <label className="form-label">Dias Ativos no Mês</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="31"
                  value={diasMes}
                  onChange={(e) => setDiasMes(e.target.value)}
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="form-label">Média de Horas de Uso por Dia</label>
                <span style={styles.sliderValue}>{horasDia} horas/dia</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="24"
                step="0.1"
                value={horasDia}
                onChange={(e) => setHorasDia(parseFloat(e.target.value))}
                className="custom-range"
              />
              <div style={styles.sliderLabels}>
                <span>10 min</span>
                <span>6h</span>
                <span>12h</span>
                <span>18h</span>
                <span>24h</span>
              </div>
            </div>

            <div style={styles.footerActions}>
              <button
                type="button"
                onClick={() => {
                  setPresetSelecionado(null);
                  setCategoriaSelecionada("");
                  setPasso(1);
                }}
                className="btn-secondary"
              >
                ⬅️ Cancelar
              </button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Salvando..." : "💾 Salvar Eletrodoméstico"}
              </button>
            </div>
          </form>
        )}

        {/* --- PASSO 3: CONCLUSÃO GERAL --- */}
        {passo === 3 && (
          <div className="animate-fade-in" style={{ textAlign: "center", padding: "20px 0" }}>
            <span style={{ fontSize: "60px", display: "block", marginBottom: "16px", filter: "drop-shadow(0 0 10px rgba(16, 185, 129, 0.4))" }}>🌱</span>
            <h2 style={{ fontSize: "26px", marginBottom: "12px" }}>Onboarding Concluído!</h2>
            <p style={{ fontSize: "14px", color: "hsl(var(--text-secondary))", maxWidth: "480px", margin: "0 auto 30px auto", lineHeight: "1.6" }}>
              Tudo pronto! Você cadastrou com sucesso **{aparelhosSessao.length} aparelhos** em seu inventário residencial. O painel principal está totalmente liberado.
            </p>

            <div style={styles.carrinhoFinal}>
              <h4 style={{ fontSize: "13px", fontWeight: "600", color: "hsl(var(--text-muted))", marginBottom: "12px", textTransform: "uppercase" }}>Aparelhos Cadastrados:</h4>
              <div style={styles.sessaoChips} className="justify-center">
                {aparelhosSessao.map((ap, idx) => (
                  <span key={idx} className="badge badge-eco" style={{ padding: "8px 14px", fontSize: "12px" }}>
                    🔌 {ap.nome_personalizado} ({ap.potencia_utilizada}W • {ap.horas_dia}h)
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={handleFinalizarOnboarding}
              className="btn-primary"
              style={{ ...styles.btnConcluir, maxWidth: "320px", margin: "0 auto", display: "inline-flex" }}
              disabled={loading}
            >
              {loading ? "Preparando..." : "🏡 Entrar no Painel do Ecoconta"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "800px",
    margin: "40px auto",
    padding: "0 20px",
  },
  stepIndicator: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "30px",
  },
  step: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    color: "hsl(var(--text-muted))",
    fontSize: "13px",
    fontWeight: "500",
    width: "120px",
    textAlign: "center",
  },
  stepActive: {
    color: "hsl(var(--color-primary))",
  },
  stepNum: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: "700",
  },
  stepLine: {
    flex: 1,
    height: "1px",
    background: "rgba(255, 255, 255, 0.1)",
    marginBottom: "24px",
  },
  card: {
    padding: "40px",
  },
  title: {
    fontSize: "24px",
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "14px",
    color: "hsl(var(--text-secondary))",
    marginBottom: "30px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "16px",
    color: "hsl(var(--text-secondary))",
  },
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    marginBottom: "20px",
  },
  categoryButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    cursor: "pointer",
    background: "rgba(255, 255, 255, 0.02)",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    width: "100%",
  },
  categoryIcon: {
    fontSize: "28px",
    marginBottom: "8px",
  },
  categoryName: {
    fontSize: "14px",
    fontWeight: "600",
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
  },
  presetCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    textAlign: "left",
    cursor: "pointer",
    width: "100%",
    background: "rgba(255, 255, 255, 0.02)",
  },
  presetName: {
    fontSize: "14px",
    fontWeight: "500",
  },
  sessaoInventario: {
    marginTop: "30px",
    paddingTop: "24px",
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  },
  sessaoTitle: {
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "12px",
    color: "hsl(var(--text-secondary))",
  },
  sessaoChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "20px",
  },
  chip: {
    padding: "6px 12px",
    fontSize: "12px",
  },
  btnConcluir: {
    width: "100%",
    justifyContent: "center",
    padding: "14px",
    fontSize: "16px",
  },
  sliderValue: {
    fontSize: "15px",
    fontWeight: "700",
    color: "hsl(var(--color-primary))",
  },
  sliderLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "11px",
    color: "hsl(var(--text-muted))",
    marginTop: "-4px",
  },
  footerActions: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "32px",
    gap: "16px",
  },
  errorAlert: {
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    color: "hsl(var(--color-accent-red))",
    padding: "12px 16px",
    borderRadius: "8px",
    marginBottom: "24px",
    fontSize: "14px",
  },
  carrinhoFinal: {
    background: "rgba(255, 255, 255, 0.01)",
    border: "1px solid rgba(255, 255, 255, 0.04)",
    borderRadius: "var(--radius-sm)",
    padding: "20px",
    marginBottom: "30px",
  }
};
