import React, { useState, useEffect } from "react";
import { api } from "./api";
import Header from "./components/Header";
import Onboarding from "./components/Onboarding";
import Dashboard from "./components/Dashboard";
import AnaliseAparelhos from "./components/AnaliseAparelhos";
import ModoESe from "./components/ModoESe";
import HistoricoContas from "./components/HistoricoContas";
import Splash from "./components/Splash";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [usuarioLogado, setUsuarioLogado] = useState(() => {
    const salvo = localStorage.getItem("ecoconta_usuario");
    return salvo ? JSON.parse(salvo) : null;
  });
  const [residencias, setResidencias] = useState([]);
  const [residenciaAtiva, setResidenciaAtiva] = useState(null);
  
  // Controle de Visualização
  const [onboardingNecessario, setOnboardingNecessario] = useState(false);
  const [viewAtiva, setViewAtiva] = useState("dashboard"); // dashboard, aparelhos, simulador, novo_aparelho_rapido
  
  // Estados Analíticos da Residência Ativa
  const [diagnostico, setDiagnostico] = useState(null);
  const [aparelhos, setAparelhos] = useState([]);
  const [dadosSimulacao, setDadosSimulacao] = useState(null);
  const [metaAtiva, setMetaAtiva] = useState({ porcentagem_meta: 10.0 }); // Padrão 10%
  const [mesSelecionado, setMesSelecionado] = useState(null);

  // Monitora login/logout para inicializar ou desinicializar o app
  useEffect(() => {
    if (usuarioLogado) {
      inicializarApp(usuarioLogado.id);
    } else {
      // Reset completo dos estados ao deslogar
      setResidencias([]);
      setResidenciaAtiva(null);
      setAparelhos([]);
      setDiagnostico(null);
      setDadosSimulacao(null);
      setOnboardingNecessario(false);
      setLoading(false);
    }
  }, [usuarioLogado]);

  // Monitora troca de Residência para recarregar dados analíticos
  useEffect(() => {
    if (residenciaAtiva) {
      setMesSelecionado(null); // Reseta a fatura selecionada ao trocar de casa
      carregarDadosAnaliticos(residenciaAtiva);
    } else {
      setLoading(false);
    }
  }, [residenciaAtiva]);

  const inicializarApp = async (usuarioId) => {
    setLoading(true);
    try {
      const lista = await api.listarResidencias(usuarioId);
      setResidencias(lista);
      if (lista.length > 0) {
        // Seleciona a mais recente por padrão
        setResidenciaAtiva(lista[0].id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error("Erro ao inicializar app:", err);
      setLoading(false);
    }
  };

  const carregarDadosAnaliticos = async (id) => {
    setLoading(true);
    try {
      // 1. Carrega aparelhos do inventário com base no mês selecionado (se houver)
      const itensAparelhos = await api.obterConsumoAparelhos(id, mesSelecionado || "");
      setAparelhos(itensAparelhos);

      // 2. Carrega diagnóstico de faturamento
      const dadosDiag = await api.obterDiagnostico(id);
      setDiagnostico(dadosDiag);

      // 3. Carrega simulação preventiva do Modo E Se
      const dadosSim = await api.obterSimulacaoESe(id);
      setDadosSimulacao(dadosSim);

      // Determina se o usuário precisa passar pelo Onboarding
      // Com a jornada invertida, o onboarding só é obrigatório se o inventário de aparelhos estiver zerado!
      const semAparelhos = itensAparelhos.length === 0;
 
      if (semAparelhos) {
        setOnboardingNecessario(true);
      } else {
        setOnboardingNecessario(false);
        // Atualiza meta se houver meta ativa nos dados locais (ou usa o padrão de onboarding de 10%)
        setMetaAtiva({ porcentagem_meta: metaAtiva.porcentagem_meta });
      }
    } catch (err) {
      console.error("Erro ao carregar dados analíticos:", err);
    } finally {
      setLoading(false);
    }
  };

  // Callback de Criação de Nova Residência
  const handleCriarResidencia = async (nome) => {
    if (!usuarioLogado) return;
    setLoading(true);
    try {
      const nova = await api.criarResidencia(nome, usuarioLogado.id);
      setResidencias([nova, ...residencias]);
      setResidenciaAtiva(nova.id);
      setViewAtiva("dashboard");
    } catch (err) {
      alert(`Erro: ${err.message}`);
      setLoading(false);
    }
  };

  const handleLoginSucesso = (usuario) => {
    localStorage.setItem("ecoconta_usuario", JSON.stringify(usuario));
    setUsuarioLogado(usuario);
  };

  const handleLogout = () => {
    if (window.confirm("Deseja realmente sair da sua conta?")) {
      localStorage.removeItem("ecoconta_usuario");
      setUsuarioLogado(null);
    }
  };

  // Callback de Exclusão de Residência
  const handleDeletarResidencia = async (id) => {
    setLoading(true);
    try {
      await api.deletarResidencia(id);
      const novaLista = residencias.filter(r => r.id !== id);
      setResidencias(novaLista);
      
      if (novaLista.length > 0) {
        setResidenciaAtiva(novaLista[0].id);
      } else {
        setResidenciaAtiva(null);
        setAparelhos([]);
        setDiagnostico(null);
        setDadosSimulacao(null);
        setOnboardingNecessario(false);
      }
    } catch (err) {
      alert(`Erro ao excluir residência: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Callback ao Salvar Nova Meta de Economia
  const handleNovaMeta = async (pct) => {
    try {
      const metaGravada = await api.cadastrarMeta(residenciaAtiva, pct);
      setMetaAtiva(metaGravada);
      // Recarrega o diagnóstico para recalcular a acurácia no dashboard
      const dadosDiag = await api.obterDiagnostico(residenciaAtiva);
      setDiagnostico(dadosDiag);
    } catch (err) {
      alert(`Erro ao salvar meta: ${err.message}`);
    }
  };

  // Callback ao alterar a Fatura Histórica Selecionada (Consumo Histórico Flutuante)
  const handleSelectMes = async (mes) => {
    setMesSelecionado(mes);
    setLoading(true);
    try {
      // Carrega os aparelhos com a tarifa específica do mês solicitado
      const itensAparelhos = await api.obterConsumoAparelhos(residenciaAtiva, mes);
      setAparelhos(itensAparelhos);
    } catch (err) {
      alert(`Erro ao carregar faturamento histórico do mês: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calcula o consumo mensal estimado total do inventário
  const consumoTotalProjetado = aparelhos.reduce((acc, curr) => acc + curr.consumo_projetado_kwh, 0);

  if (!usuarioLogado) {
    return <Splash onLoginSucesso={handleLoginSucesso} />;
  }

  if (loading && residencias.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: "16px", color: "hsl(var(--text-muted))" }}>Conectando ao banco Ecoconta...</p>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      
      {/* CABEÇALHO GLOBAL */}
      <Header 
        residencias={residencias} 
        residenciaAtiva={residenciaAtiva}
        onChangeResidencia={setResidenciaAtiva}
        onCriarResidencia={handleCriarResidencia}
        onDeletarResidencia={handleDeletarResidencia}
        usuarioLogado={usuarioLogado}
        onLogout={handleLogout}
      />

      {/* --- FLUXO 1: SEM IMÓVEL CADASTRADO (WELCOME SCREEN) --- */}
      {residencias.length === 0 && (
        <div style={styles.welcomeContainer} className="animate-fade-in">
          <div className="glass-card" style={styles.welcomeCard}>
            <span style={{ fontSize: "50px" }}>🌱</span>
            <h2 style={{ fontSize: "28px", marginTop: "16px", marginBottom: "8px" }}>Bem-vindo ao Ecoconta</h2>
            <p style={{ fontSize: "14px", color: "hsl(var(--text-secondary))", marginBottom: "32px" }}>
              Traduza o consumo de kWh residencial em insights ecológicos e financeiros. Para começar a economizar e monitorar sua casa, cadastre seu primeiro imóvel.
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const input = e.target.nomeResidencia.value.trim();
              if (input) handleCriarResidencia(input);
            }} style={styles.welcomeForm}>
              <input 
                name="nomeResidencia"
                type="text" 
                placeholder="Ex: Apartamento Centro" 
                className="form-control"
                required
                maxLength={40}
              />
              <button type="submit" className="btn-primary" style={{ justifyContent: "center" }}>
                Criar Residência 🏡
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- FLUXO 2: COM IMÓVEL, REQUER ONBOARDING --- */}
      {residencias.length > 0 && onboardingNecessario && (
        <Onboarding 
          residenciaId={residenciaAtiva} 
          onOnboardingComplete={() => carregarDadosAnaliticos(residenciaAtiva)}
        />
      )}

      {/* --- FLUXO 3: NAVEGAÇÃO PRINCIPAL (APP CONECTADO) --- */}
      {residencias.length > 0 && !onboardingNecessario && (
        <main style={{ padding: "0 20px" }} className="animate-fade-in">
          
          {/* Navegação por Abas */}
          <div style={styles.tabNav}>
            <button 
              onClick={() => setViewAtiva("dashboard")}
              style={{ ...styles.tabBtn, ...(viewAtiva === "dashboard" ? styles.tabBtnActive : {}) }}
            >
              📊 Visão Geral & Meta
            </button>
            <button 
              onClick={() => setViewAtiva("aparelhos")}
              style={{ ...styles.tabBtn, ...(viewAtiva === "aparelhos" ? styles.tabBtnActive : {}) }}
            >
              🔌 Inventário ({aparelhos.length})
            </button>
            <button 
              onClick={() => setViewAtiva("historico")}
              style={{ ...styles.tabBtn, ...(viewAtiva === "historico" ? styles.tabBtnActive : {}) }}
            >
              📅 Contas & Faturas
            </button>
            <button 
              onClick={() => setViewAtiva("simulador")}
              style={{ ...styles.tabBtn, ...(viewAtiva === "simulador" ? styles.tabBtnActive : {}) }}
            >
              💡 Simulador E Se?
            </button>
          </div>

          {/* Loader de transição analítica */}
          {loading ? (
            <div style={styles.loadingInner}>
              <div style={styles.spinner}></div>
            </div>
          ) : (
            <div className="animate-fade-in" style={{ paddingBottom: "40px" }}>
              
              {viewAtiva === "dashboard" && (
                <Dashboard 
                  diagnostico={diagnostico}
                  consumoTotalProjetado={consumoTotalProjetado}
                  metaAtiva={metaAtiva}
                  onNovaMeta={handleNovaMeta}
                  mesSelecionado={mesSelecionado}
                  onSelectMes={handleSelectMes}
                />
              )}

              {viewAtiva === "aparelhos" && (
                <AnaliseAparelhos 
                  aparelhos={aparelhos}
                  onAdicionarNovoClick={() => setViewAtiva("novo_aparelho_rapido")}
                />
              )}
 
              {viewAtiva === "historico" && (
                <HistoricoContas
                  residenciaId={residenciaAtiva}
                  diagnostico={diagnostico}
                  onContasAtualizadas={() => carregarDadosAnaliticos(residenciaAtiva)}
                />
              )}
 
              {viewAtiva === "simulador" && (
                <ModoESe dadosSimulacao={dadosSimulacao} />
              )}

              {/* Rota Auxiliar de Inserção Rápida de Aparelho */}
              {viewAtiva === "novo_aparelho_rapido" && (
                <div style={{ maxWidth: "600px", margin: "40px auto" }} className="animate-fade-in">
                  <div className="glass-card">
                    <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>🔌 Novo Eletrodoméstico</h2>
                    <p style={{ fontSize: "13px", color: "hsl(var(--text-muted))", marginBottom: "24px" }}>
                      Insira os detalhes de uso e potência do novo aparelho para recalcular as projeções.
                    </p>
                    <Onboarding 
                      residenciaId={residenciaAtiva} 
                      // Simula conclusão parcial retornando para a aba de aparelhos
                      onOnboardingComplete={() => {
                        carregarDadosAnaliticos(residenciaAtiva);
                        setViewAtiva("aparelhos");
                      }}
                    />
                  </div>
                </div>
              )}

            </div>
          )}

        </main>
      )}

    </div>
  );
}

const styles = {
  appContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  loadingContainer: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    background: "hsl(var(--bg-deep))",
  },
  loadingInner: {
    height: "300px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid rgba(255, 255, 255, 0.05)",
    borderTopColor: "hsl(var(--color-primary))",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  welcomeContainer: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
  },
  welcomeCard: {
    maxWidth: "500px",
    padding: "40px",
    textAlign: "center",
  },
  welcomeForm: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  tabNav: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    margin: "30px 0 24px 0",
    flexWrap: "wrap",
  },
  tabBtn: {
    background: "rgba(15, 23, 42, 0.6)",
    backdropFilter: "blur(8px)",
    color: "hsl(var(--text-secondary))",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    padding: "12px 24px",
    borderRadius: "30px",
    fontFamily: "var(--font-display)",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  tabBtnActive: {
    background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
    borderColor: "rgba(16, 185, 129, 0.2)",
    color: "white",
    boxShadow: "0 4px 14px rgba(16, 185, 129, 0.15)",
  }
};
