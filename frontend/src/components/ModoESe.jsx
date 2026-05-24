import React, { useState } from "react";

export default function ModoESe({ dadosSimulacao }) {
  const [percentualSimulado, setPercentualSimulado] = useState(20); // Padrão 20% de redução

  if (!dadosSimulacao || !dadosSimulacao.consolidado_simulacao) {
    return (
      <div className="glass-card animate-fade-in" style={styles.emptyCard}>
        <span style={{ fontSize: "40px" }}>🤔</span>
        <p style={{ marginTop: "12px", color: "hsl(var(--text-muted))" }}>
          Não foi possível carregar os dados de simulação. Verifique se existem eletrodomésticos no inventário.
        </p>
      </div>
    );
  }

  const { total_atual_reais, total_atual_co2, economia_10pct, economia_20pct, economia_30pct } = dadosSimulacao.consolidado_simulacao;

  // Seleciona os valores baseados na aba/slider selecionado (10, 20 ou 30)
  const obterEconomiaAtiva = () => {
    switch (percentualSimulado) {
      case 10: return economia_10pct;
      case 30: return economia_30pct;
      default: return economia_20pct;
    }
  };

  const economiaAtiva = obterEconomiaAtiva();

  // Equivalências Ecológicas Inteligentes (Senior level insights)
  // 1 árvore típica absorve ~1.25 kg de CO2 por mês (~15 kg/ano)
  const arvoresSalvasMes = (economiaAtiva.co2 / 1.25).toFixed(1);
  // 1 carro convencional de passageiros emite aprox. 0.12 kg de CO2 por km rodado
  const kmCarroEvitados = (economiaAtiva.co2 / 0.12).toFixed(0);
  // 1 smartphone consome aprox. 0.005 kWh por carga completa (aprox 0.00045 kg CO2)
  const cargasCelularPoupadas = (economiaAtiva.co2 / 0.00045).toFixed(0);

  return (
    <div style={styles.container} className="animate-fade-in">
      <div className="glass-card animate-fade-in" style={styles.simulatorCard}>
        
        {/* Topo do Painel */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>💡 Modo "E Se?" (Simulador Dinâmico)</h2>
            <p style={styles.subtitle}>
              Projete o impacto global simulando metas preventivas de redução de uso diário.
            </p>
          </div>
          <span className="badge badge-eco" style={{ padding: "8px 16px" }}>
            ♻️ Motor de Prospecção Ativo
          </span>
        </div>

        {/* Chaveador de Simulação (10%, 20%, 30%) */}
        <div style={styles.selectorContainer}>
          <p style={styles.selectorLabel}>Simular redução geral no tempo de uso diário:</p>
          <div style={styles.selectorButtons}>
            {[10, 20, 30].map((pct) => (
              <button
                key={pct}
                onClick={() => setPercentualSimulado(pct)}
                style={{
                  ...styles.selectorBtn,
                  ...(percentualSimulado === pct ? styles.selectorBtnActive : {})
                }}
              >
                -{pct}% do Tempo
              </button>
            ))}
          </div>
        </div>

        {/* --- GRID DE METRICS CONSOLIDADAS --- */}
        <div className="grid-container" style={{ padding: 0, gap: "20px", marginBottom: "28px" }}>
          
          {/* Card Financeiro */}
          <div className="glass-card animate-fade-in" style={{ gridColumn: "span 6", background: "rgba(59, 130, 246, 0.02)" }}>
            <h3 style={{ ...styles.cardTitle, color: "hsl(var(--color-secondary))" }}>💰 Poupança de Bolso</h3>
            <p style={styles.cardDesc}>Redução financeira direta no custo estimado mensal do seu inventário.</p>
            
            <div style={styles.bigStats}>
              <span style={styles.statsValue}>R$ {economiaAtiva.financeira.toFixed(2)}</span>
              <span style={styles.statsLabel}>de economia ao mês</span>
            </div>
            
            <div style={styles.statDetail}>
              <span>Projeção de Gasto Atual: R$ {total_atual_reais.toFixed(2)}</span>
              <span>Projeção Pós-Redução: R$ {(total_atual_reais - economiaAtiva.financeira).toFixed(2)}</span>
            </div>
          </div>

          {/* Card Ecológico */}
          <div className="glass-card animate-fade-in" style={{ gridColumn: "span 6", background: "rgba(16, 185, 129, 0.02)" }}>
            <h3 style={{ ...styles.cardTitle, color: "hsl(var(--color-primary))" }}>🌿 Crédito de Carbono</h3>
            <p style={styles.cardDesc}>Redução direta de Gases do Efeito Estufa (GEE) lançados na atmosfera.</p>

            <div style={styles.bigStats}>
              <span style={{ ...styles.statsValue, color: "hsl(var(--color-primary))" }}>
                {economiaAtiva.co2.toFixed(2)} kgCO₂e
              </span>
              <span style={styles.statsLabel}>evitados ao mês</span>
            </div>

            <div style={styles.statDetail}>
              <span>Emissão Atual Mapeada: {total_atual_co2.toFixed(2)} kg</span>
              <span>Emissão Pós-Redução: {(total_atual_co2 - economiaAtiva.co2).toFixed(2)} kg</span>
            </div>
          </div>

        </div>

        {/* --- CAMADA DE EQUIVALÊNCIAS REAIS (INSIGHTS) --- */}
        <h3 style={styles.equivalenceTitle}>🌳 O que essa economia de CO₂ representa na realidade?</h3>
        
        <div style={styles.equivalenceGrid}>
          
          <div style={styles.equivalenceCard}>
            <span style={styles.equivalenceIcon}>🌳</span>
            <div style={styles.equivalenceMeta}>
              <strong style={styles.equivalenceVal}>{arvoresSalvasMes} árvores</strong>
              <span style={styles.equivalenceDesc}>plantadas e crescendo por 1 mês para capturar este CO₂.</span>
            </div>
          </div>

          <div style={styles.equivalenceCard}>
            <span style={styles.equivalenceIcon}>🚗</span>
            <div style={styles.equivalenceMeta}>
              <strong style={styles.equivalenceVal}>{kmCarroEvitados} km</strong>
              <span style={styles.equivalenceDesc}>rodados de carro convencional de passageiros poupados.</span>
            </div>
          </div>

          <div style={styles.equivalenceCard}>
            <span style={styles.equivalenceIcon}>🔋</span>
            <div style={styles.equivalenceMeta}>
              <strong style={styles.equivalenceVal}>{cargasCelularPoupadas} cargas</strong>
              <span style={styles.equivalenceDesc}>completas de smartphone que deixaram de ser consumidas.</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto 40px auto",
  },
  emptyCard: {
    maxWidth: "600px",
    margin: "80px auto",
    textAlign: "center",
    padding: "40px",
  },
  simulatorCard: {
    padding: "36px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "28px",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "800",
  },
  subtitle: {
    fontSize: "14px",
    color: "hsl(var(--text-secondary))",
    marginTop: "4px",
  },
  selectorContainer: {
    background: "rgba(255, 255, 255, 0.02)",
    border: "1px solid rgba(255, 255, 255, 0.04)",
    borderRadius: "var(--radius-sm)",
    padding: "16px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
    flexWrap: "wrap",
    gap: "16px",
  },
  selectorLabel: {
    fontSize: "14px",
    fontWeight: "500",
    color: "hsl(var(--text-secondary))",
  },
  selectorButtons: {
    display: "flex",
    gap: "8px",
  },
  selectorBtn: {
    background: "transparent",
    color: "hsl(var(--text-secondary))",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    padding: "10px 16px",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  selectorBtnActive: {
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    borderColor: "hsl(var(--color-primary))",
    color: "white",
    boxShadow: "0 0 12px rgba(16, 185, 129, 0.25)",
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: "700",
    marginBottom: "6px",
  },
  cardDesc: {
    fontSize: "12px",
    color: "hsl(var(--text-muted))",
    marginBottom: "20px",
  },
  bigStats: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    margin: "20px 0",
  },
  statsValue: {
    fontFamily: "var(--font-display)",
    fontSize: "36px",
    fontWeight: "800",
    color: "hsl(var(--color-secondary))",
  },
  statsLabel: {
    fontSize: "12px",
    color: "hsl(var(--text-muted))",
    marginTop: "4px",
  },
  statDetail: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    borderTop: "1px solid rgba(255, 255, 255, 0.04)",
    paddingTop: "12px",
    color: "hsl(var(--text-secondary))",
  },
  equivalenceTitle: {
    fontSize: "15px",
    fontWeight: "600",
    marginBottom: "16px",
    color: "hsl(var(--text-secondary))",
    borderLeft: "3px solid hsl(var(--color-primary))",
    paddingLeft: "10px",
  },
  equivalenceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
  },
  equivalenceCard: {
    background: "rgba(255, 255, 255, 0.01)",
    border: "1px solid rgba(255, 255, 255, 0.03)",
    borderRadius: "var(--radius-sm)",
    padding: "16px",
    display: "flex",
    gap: "14px",
    alignItems: "center",
  },
  equivalenceIcon: {
    fontSize: "28px",
  },
  equivalenceMeta: {
    display: "flex",
    flexDirection: "column",
  },
  equivalenceVal: {
    fontSize: "15px",
    fontWeight: "700",
    color: "white",
  },
  equivalenceDesc: {
    fontSize: "11px",
    color: "hsl(var(--text-muted))",
    marginTop: "2px",
    lineHeight: "1.4",
  }
};
