import React, { useState } from "react";
import { api } from "../api";

export default function Splash({ onLoginSucesso }) {
  // Controle de Aba (login vs cadastrar)
  const [activeTab, setActiveTab] = useState("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  
  // Controle do Modo Sandbox de Teste
  const [exibirSandbox, setExibirSandbox] = useState(false);

  // Estado do Simulador Sandbox de Visitante
  // Presets: [Nome, Potência (W), Horas/Dia Padrão, Dias/Mês Padrão]
  const [sandboxAparelhos, setSandboxAparelhos] = useState([
    { id: 1, nome: "Chuveiro Elétrico", potencia: 5500, horas: 0.6, dias: 30, reducao: 20, icone: "🚿" },
    { id: 2, nome: "Ar Condicionado", potencia: 1080, horas: 8.0, dias: 20, reducao: 30, icone: "❄️" },
    { id: 3, nome: "Geladeira Duplex", potencia: 120, horas: 24.0, dias: 30, reducao: 10, icone: "🔋" },
    { id: 4, nome: "Televisão Smart", potencia: 100, horas: 4.0, dias: 30, reducao: 25, icone: "📺" }
  ]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro("");
    try {
      if (activeTab === "login") {
        const usuario = await api.loginUsuario(email, senha);
        onLoginSucesso(usuario);
      } else {
        if (!nome.trim()) {
          setErro("Por favor, digite seu nome.");
          setLoading(false);
          return;
        }
        const usuario = await api.cadastrarUsuario(nome, email, senha);
        alert("🎉 Cadastro realizado com sucesso! Seus dados de semente foram importados de forma automática.");
        onLoginSucesso(usuario);
      }
    } catch (err) {
      setErro(err.message || "Erro na autenticação. Verifique os dados inseridos.");
    } finally {
      setLoading(false);
    }
  };

  const handleReducaoChange = (id, novaReducao) => {
    setSandboxAparelhos(
      sandboxAparelhos.map((ap) => (ap.id === id ? { ...ap, reducao: parseInt(novaReducao) } : ap))
    );
  };

  // Cálculos dinâmicos do Sandbox local
  // Tarifa fixa padrão de R$ 0.85/kWh para demonstração
  const TARIFA_DEMO = 0.85;
  const FATOR_CO2 = 0.09;

  const calcularMetricasSandbox = () => {
    let kwhTotalOriginal = 0;
    let kwhTotalEconomizado = 0;

    sandboxAparelhos.forEach((ap) => {
      const kwhMensal = (ap.potencia * ap.horas * ap.dias) / 1000;
      const kwhSalvo = kwhMensal * (ap.reducao / 100);
      kwhTotalOriginal += kwhMensal;
      kwhTotalEconomizado += kwhSalvo;
    });

    const reaisOriginal = kwhTotalOriginal * TARIFA_DEMO;
    const reaisSalvo = kwhTotalEconomizado * TARIFA_DEMO;
    const co2Original = kwhTotalOriginal * FATOR_CO2;
    const co2Salvo = kwhTotalEconomizado * FATOR_CO2;

    // Equivalências
    const arvores = co2Salvo / 1.25;
    const kmCarro = co2Salvo / 0.12;
    const recargas = co2Salvo / 0.00045;

    return {
      reaisOriginal,
      reaisSalvo,
      co2Original,
      co2Salvo,
      arvores,
      kmCarro,
      recargas,
      kwhTotalEconomizado
    };
  };

  const metricas = calcularMetricasSandbox();

  return (
    <div style={styles.splashPage} className="animate-fade-in">
      <div style={styles.glowDecorLeft}></div>
      <div style={styles.glowDecorRight}></div>

      {/* CABEÇALHO DA PLATAFORMA */}
      <div style={styles.brandContainer}>
        <span style={styles.brandIcon}>🌱</span>
        <h1 style={styles.brandName}>Ecoconta</h1>
        <p style={styles.brandTagline}>
          Traduza o consumo em kWh residencial em insights ecológicos e financeiros em tempo real.
        </p>
      </div>

      {/* GRID PRINCIPAL */}
      <div style={styles.gridMain}>
        
        {/* COLUNA 1: PILARES DA PLATAFORMA */}
        <div style={styles.columnLeft}>
          <h2 style={styles.sectionTitle}>Por que o Ecoconta?</h2>
          <p style={styles.sectionDesc}>
            Uma plataforma desenvolvida para desmistificar a conta de luz e empoderar suas escolhas sustentáveis.
          </p>

          <div style={styles.pillarsList}>
            <div style={styles.pillarItem}>
              <div style={styles.pillarIcon}>🔌</div>
              <div>
                <h3 style={styles.pillarTitle}>Inventário de Consumo Ágil</h3>
                <p style={styles.pillarText}>
                  Mapeie cada eletrodoméstico por potência em watts e horas de uso para saber exatamente onde ocorrem os maiores gastos.
                </p>
              </div>
            </div>

            <div style={styles.pillarItem}>
              <div style={styles.pillarIcon}>📅</div>
              <div>
                <h3 style={styles.pillarTitle}>Auditoria de Faturas Reais</h3>
                <p style={styles.pillarText}>
                  Importe suas contas de energia reais (preenchimento ou PDF) e compare com a estimativa dos seus aparelhos para achar vazamentos elétricos.
                </p>
              </div>
            </div>

            <div style={styles.pillarItem}>
              <div style={styles.pillarIcon}>💡</div>
              <div>
                <h3 style={styles.pillarTitle}>Simulador Preventivo "E Se?"</h3>
                <p style={styles.pillarText}>
                  Crie planos de redução e projete instantaneamente os ganhos de curto e longo prazo antes de mudar sua rotina doméstica.
                </p>
              </div>
            </div>

            <div style={styles.pillarItem}>
              <div style={styles.pillarIcon}>🌳</div>
              <div>
                <h3 style={styles.pillarTitle}>Gamificação Ecológica</h3>
                <p style={styles.pillarText}>
                  Monitore metas de economia e converta economia de energia em métricas reais, como árvores ativas plantadas e emissões de carbono salvas.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* COLUNA 2: AUTENTICAÇÃO */}
        <div style={styles.columnRight}>
          <div className="glass-card" style={styles.authCard}>
            
            {/* ABAS */}
            <div style={styles.tabsHeader}>
              <button
                type="button"
                onClick={() => { setActiveTab("login"); setErro(""); }}
                style={{ ...styles.tabBtn, ...(activeTab === "login" ? styles.tabBtnActive : {}) }}
              >
                🔐 Entrar
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("cadastrar"); setErro(""); }}
                style={{ ...styles.tabBtn, ...(activeTab === "cadastrar" ? styles.tabBtnActive : {}) }}
              >
                📝 Cadastrar-se
              </button>
            </div>

            {/* FORMULÁRIO */}
            <form onSubmit={handleAuthSubmit} style={styles.authForm}>
              {erro && <div style={styles.errorAlert}>⚠️ {erro}</div>}

              {activeTab === "cadastrar" && (
                <div className="form-group">
                  <label className="form-label">Nome Completo:</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex: João da Silva"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    maxLength={50}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Endereço de E-mail:</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Ex: joao@provedor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={60}
                />
              </div>

              <div className="form-group" style={{ marginBottom: "28px" }}>
                <label className="form-label">Senha:</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Mínimo 4 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={4}
                  maxLength={40}
                />
              </div>

              <button type="submit" className="btn-primary" style={styles.btnFull} disabled={loading}>
                {loading ? "Processando..." : activeTab === "login" ? "Entrar na Minha Conta 🚪" : "Registrar e Importar Demo 🏡"}
              </button>
            </form>

            <div style={styles.divider}>ou</div>

            {/* BOTAO SANDBOX DE VISITANTE */}
            <button
              onClick={() => setExibirSandbox(!exibirSandbox)}
              className="btn-secondary"
              style={{ ...styles.btnFull, borderColor: "rgba(16, 185, 129, 0.3)", color: "hsl(var(--color-primary))" }}
            >
              {exibirSandbox ? "Ocultar Simulador Sandbox ❌" : "🔌 Testar Simulador Sandbox (Sem Login)"}
            </button>
          </div>
        </div>

      </div>

      {/* --- SEÇÃO SANDBOX EXPANSÍVEL --- */}
      {exibirSandbox && (
        <div style={styles.sandboxWrapper} className="animate-fade-in">
          <div className="glass-card" style={styles.sandboxCard}>
            
            <div style={styles.sandboxHeader}>
              <div>
                <span className="badge badge-eco" style={{ marginBottom: "10px" }}>⚡ Demonstração Interativa</span>
                <h2 style={styles.sandboxTitle}>Simulador Sandbox "E Se?"</h2>
                <p style={styles.sandboxSubtitle}>
                  Ajuste a porcentagem de redução de uso nos sliders de cada eletrodoméstico e veja a simulação imediata.
                </p>
              </div>
              <span style={{ fontSize: "40px" }}>💡</span>
            </div>

            <div style={styles.sandboxGrid}>
              
              {/* Sliders de Aparelhos */}
              <div style={styles.sandboxSlidersCol}>
                {sandboxAparelhos.map((ap) => (
                  <div key={ap.id} style={styles.sliderGroupItem}>
                    <div style={styles.sliderHeader}>
                      <span style={{ fontSize: "18px" }}>{ap.icone} <strong>{ap.nome}</strong></span>
                      <span style={styles.sliderBadge}>-{ap.reducao}% de tempo</span>
                    </div>
                    <p style={styles.sliderSubtext}>
                      Consumo base: {((ap.potencia * ap.horas * ap.dias) / 1000).toFixed(0)} kWh | Potência: {ap.potencia}W
                    </p>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={ap.reducao}
                      onChange={(e) => handleReducaoChange(ap.id, e.target.value)}
                      className="custom-range"
                    />
                  </div>
                ))}
              </div>

              {/* Métricas de Resultados */}
              <div style={styles.sandboxResultsCol}>
                <h3 style={styles.resultsTitle}>Projeção de Economia ao Mês</h3>

                <div style={styles.resultsMainStats}>
                  <div style={styles.resultStatBlock}>
                    <span style={{ ...styles.statLabelText, color: "hsl(var(--color-secondary))" }}>💰 Financeira</span>
                    <strong style={styles.statLargeVal}>R$ {metricas.reaisSalvo.toFixed(2)}</strong>
                    <span style={styles.statSubText}>tarifa média R$ {TARIFA_DEMO.toFixed(2)}</span>
                  </div>

                  <div style={styles.resultStatBlock}>
                    <span style={{ ...styles.statLabelText, color: "hsl(var(--color-primary))" }}>🌿 Ecológica</span>
                    <strong style={{ ...styles.statLargeVal, color: "hsl(var(--color-primary))" }}>
                      {metricas.co2Salvo.toFixed(2)} kg
                    </strong>
                    <span style={styles.statSubText}>{metricas.kwhTotalEconomizado.toFixed(1)} kWh economizados</span>
                  </div>
                </div>

                <h4 style={styles.equivTitle}>Equivalências Reais na Natureza</h4>
                
                <div style={styles.equivList}>
                  <div style={styles.equivItem}>
                    <span style={styles.equivIcon}>🌳</span>
                    <div>
                      <strong>{metricas.arvores.toFixed(1)} árvore(s)</strong>
                      <p style={styles.equivDesc}>plantadas e crescendo por 1 mês para reabsorver este CO₂.</p>
                    </div>
                  </div>

                  <div style={styles.equivItem}>
                    <span style={styles.equivIcon}>🚗</span>
                    <div>
                      <strong>{metricas.kmCarro.toFixed(0)} km</strong>
                      <p style={styles.equivDesc}>que deixariam de ser rodados por um carro de passageiros padrão.</p>
                    </div>
                  </div>

                  <div style={styles.equivItem}>
                    <span style={styles.equivIcon}>🔋</span>
                    <div>
                      <strong>{metricas.recargas.toFixed(0)} cargas</strong>
                      <p style={styles.equivDesc}>completas de smartphone que seriam economizadas.</p>
                    </div>
                  </div>
                </div>

                <div style={styles.sandboxCTA}>
                  <p style={{ fontSize: "12px", color: "hsl(var(--text-muted))", textAlign: "center", marginBottom: "8px" }}>
                    Gostou do teste? Cadastre-se em segundos para gerenciar seus dados reais de faturamento!
                  </p>
                  <button
                    onClick={() => {
                      setExibirSandbox(false);
                      setActiveTab("cadastrar");
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    Criar Minha Conta Grátis 🚀
                  </button>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  splashPage: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "60px 20px",
    position: "relative",
  },
  glowDecorLeft: {
    position: "absolute",
    top: "5%",
    left: "-10%",
    width: "350px",
    height: "350px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(0,0,0,0) 70%)",
    pointerEvents: "none",
    zIndex: -1,
  },
  glowDecorRight: {
    position: "absolute",
    bottom: "20%",
    right: "-10%",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(0,0,0,0) 70%)",
    pointerEvents: "none",
    zIndex: -1,
  },
  brandContainer: {
    textAlign: "center",
    marginBottom: "50px",
  },
  brandIcon: {
    fontSize: "56px",
    display: "inline-block",
    filter: "drop-shadow(0 0 16px rgba(16, 185, 129, 0.4))",
    animation: "pulse 2s infinite ease-in-out",
  },
  brandName: {
    fontSize: "38px",
    fontWeight: "800",
    marginTop: "8px",
    background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  brandTagline: {
    fontSize: "15px",
    color: "hsl(var(--text-secondary))",
    marginTop: "8px",
    maxWidth: "600px",
    margin: "8px auto 0 auto",
  },
  gridMain: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: "50px",
    marginBottom: "50px",
    alignItems: "start",
  },
  columnLeft: {
    display: "flex",
    flexDirection: "column",
  },
  sectionTitle: {
    fontSize: "26px",
    fontWeight: "800",
    marginBottom: "10px",
  },
  sectionDesc: {
    fontSize: "14px",
    color: "hsl(var(--text-secondary))",
    marginBottom: "36px",
  },
  pillarsList: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  pillarItem: {
    display: "flex",
    gap: "18px",
    alignItems: "flex-start",
  },
  pillarIcon: {
    fontSize: "24px",
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    padding: "10px",
    borderRadius: "12px",
    boxShadow: "var(--shadow-inset)",
  },
  pillarTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "white",
  },
  pillarText: {
    fontSize: "13px",
    color: "hsl(var(--text-muted))",
    marginTop: "4px",
    lineHeight: "1.5",
  },
  columnRight: {
    position: "sticky",
    top: "40px",
  },
  authCard: {
    padding: "36px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
  },
  tabsHeader: {
    display: "flex",
    background: "rgba(0, 0, 0, 0.25)",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    borderRadius: "10px",
    padding: "4px",
    marginBottom: "28px",
  },
  tabBtn: {
    flex: 1,
    padding: "12px",
    background: "transparent",
    border: "none",
    color: "hsl(var(--text-muted))",
    fontFamily: "var(--font-display)",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    borderRadius: "8px",
    transition: "all 0.3s ease",
  },
  tabBtnActive: {
    background: "rgba(255, 255, 255, 0.06)",
    color: "white",
    boxShadow: "var(--shadow-inset)",
  },
  authForm: {
    display: "flex",
    flexDirection: "column",
  },
  btnFull: {
    width: "100%",
    justifyContent: "center",
    padding: "14px",
    fontSize: "15px",
  },
  divider: {
    textAlign: "center",
    color: "hsl(var(--text-muted))",
    fontSize: "12px",
    margin: "18px 0",
    position: "relative",
  },
  errorAlert: {
    background: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "var(--radius-sm)",
    padding: "12px",
    color: "hsl(var(--color-accent-red))",
    fontSize: "13px",
    fontWeight: "500",
    marginBottom: "20px",
  },
  sandboxWrapper: {
    marginTop: "40px",
    marginBottom: "60px",
  },
  sandboxCard: {
    padding: "40px",
    border: "1px solid rgba(16, 185, 129, 0.12)",
  },
  sandboxHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
    paddingBottom: "24px",
    marginBottom: "32px",
  },
  sandboxTitle: {
    fontSize: "22px",
    fontWeight: "800",
  },
  sandboxSubtitle: {
    fontSize: "13px",
    color: "hsl(var(--text-secondary))",
    marginTop: "4px",
  },
  sandboxGrid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: "40px",
    alignItems: "start",
  },
  sandboxSlidersCol: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  sliderGroupItem: {
    background: "rgba(255, 255, 255, 0.01)",
    border: "1px solid rgba(255, 255, 255, 0.03)",
    borderRadius: "var(--radius-md)",
    padding: "16px 20px",
  },
  sliderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderBadge: {
    background: "rgba(16, 185, 129, 0.12)",
    color: "hsl(var(--color-primary))",
    border: "1px solid rgba(16, 185, 129, 0.2)",
    padding: "3px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700",
  },
  sliderSubtext: {
    fontSize: "12px",
    color: "hsl(var(--text-muted))",
    marginTop: "4px",
    marginBottom: "8px",
  },
  sandboxResultsCol: {
    background: "rgba(0, 0, 0, 0.15)",
    border: "1px solid rgba(255, 255, 255, 0.04)",
    borderRadius: "var(--radius-md)",
    padding: "24px",
  },
  resultsTitle: {
    fontSize: "15px",
    fontWeight: "600",
    color: "hsl(var(--text-secondary))",
    marginBottom: "16px",
    borderLeft: "3px solid hsl(var(--color-primary))",
    paddingLeft: "10px",
  },
  resultsMainStats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "24px",
  },
  resultStatBlock: {
    background: "rgba(255, 255, 255, 0.01)",
    border: "1px solid rgba(255, 255, 255, 0.03)",
    borderRadius: "var(--radius-sm)",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
  },
  statLabelText: {
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  statLargeVal: {
    fontFamily: "var(--font-display)",
    fontSize: "24px",
    fontWeight: "800",
    color: "hsl(var(--color-secondary))",
    margin: "4px 0",
  },
  statSubText: {
    fontSize: "11px",
    color: "hsl(var(--text-muted))",
  },
  equivTitle: {
    fontSize: "13px",
    fontWeight: "600",
    color: "hsl(var(--text-muted))",
    marginBottom: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  equivList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    marginBottom: "24px",
  },
  equivItem: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  equivIcon: {
    fontSize: "20px",
  },
  equivDesc: {
    fontSize: "11px",
    color: "hsl(var(--text-muted))",
  },
  sandboxCTA: {
    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
    paddingTop: "20px",
    marginTop: "20px",
  }
};

// Adiciona estilos de animação responsiva rápida de grid
const responsiveQuery = `
@media (max-width: 900px) {
  div[style*="gridTemplateColumns"] {
    grid-template-columns: 1fr !important;
    gap: 30px !important;
  }
}
`;
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = responsiveQuery;
  document.head.appendChild(styleSheet);
}
