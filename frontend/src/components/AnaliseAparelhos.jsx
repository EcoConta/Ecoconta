import React from "react";

export default function AnaliseAparelhos({ aparelhos, onAdicionarNovoClick }) {
  
  // Ícones representativos automáticos baseado no nome ou potência
  const obterIconeAparelho = (nome, potencia) => {
    const nomeMasc = nome.toLowerCase();
    if (nomeMasc.includes("chuveiro") || nomeMasc.includes("ducha")) return "🚿";
    if (nomeMasc.includes("ar") || nomeMasc.includes("condicionado") || nomeMasc.includes("split")) return "❄️";
    if (nomeMasc.includes("geladeira") || nomeMasc.includes("fridge") || nomeMasc.includes("refrigerador")) return "🥶";
    if (nomeMasc.includes("tv") || nomeMasc.includes("televis")) return "📺";
    if (nomeMasc.includes("computador") || nomeMasc.includes("notebook") || nomeMasc.includes("gamer") || nomeMasc.includes("pc")) return "💻";
    if (nomeMasc.includes("lampada") || nomeMasc.includes("led") || nomeMasc.includes("luz")) return "💡";
    if (nomeMasc.includes("lavadora") || nomeMasc.includes("maquina") || nomeMasc.includes("roupa")) return "🧺";
    if (nomeMasc.includes("micro") || nomeMasc.includes("forno") || nomeMasc.includes("air")) return "🍳";
    
    // Fallback baseado em potência watts
    if (potencia >= 3000) return "🔥";
    if (potencia >= 1000) return "⚡";
    return "🔌";
  };

  // Classifica a severidade do consumo para feedback estético
  const obterClasseBadge = (kwh) => {
    if (kwh >= 80) return "badge-danger";
    if (kwh >= 30) return "badge-warning";
    return "badge-eco";
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>🔌 Inventário de Eletrodomésticos</h2>
          <p style={styles.sectionSubtitle}>
            Abaixo estão descritos todos os aparelhos de sua residência mapeados, ordenados por maior impacto energético.
          </p>
        </div>
        <button onClick={onAdicionarNovoClick} className="btn-primary" style={styles.btnHeader}>
          ➕ Adicionar Aparelho
        </button>
      </div>

      {aparelhos.length === 0 ? (
        <div className="glass-card" style={styles.emptyCard}>
          <span style={{ fontSize: "40px" }}>📦</span>
          <p style={{ marginTop: "12px", color: "hsl(var(--text-muted))" }}>
            Nenhum aparelho cadastrado no inventário. Adicione o primeiro para começar a traduzir seu consumo!
          </p>
        </div>
      ) : (
        <div style={styles.gridAparelhos}>
          {aparelhos.map((ap) => {
            const icone = obterIconeAparelho(ap.nome_personalizado, ap.potencia_utilizada);
            const badgeClass = obterClasseBadge(ap.consumo_projetado_kwh);
            
            return (
              <div 
                key={ap.inventario_id} 
                className="glass-card animate-fade-in" 
                style={styles.cardAparelho}
              >
                <div style={styles.cardTop}>
                  <div style={styles.avatar}>
                    <span style={styles.avatarIcon}>{icone}</span>
                  </div>
                  <div style={styles.metaAparelho}>
                    <h4 style={styles.aparelhoNome}>{ap.nome_personalizado}</h4>
                    <span style={styles.aparelhoWatts}>
                      {ap.potencia_utilizada} Watts • {ap.horas_dia}h/dia ({ap.dias_mes}d)
                    </span>
                  </div>
                </div>

                <div style={styles.cardDivider}></div>

                <div style={styles.statsContainer}>
                  <div style={styles.statBox}>
                    <span style={styles.statLabel}>Consumo Mensal</span>
                    <strong style={styles.statVal}>{ap.consumo_projetado_kwh.toFixed(1)} kWh</strong>
                    <span className={`badge ${badgeClass}`} style={styles.statBadge}>
                      {ap.consumo_projetado_kwh >= 80 ? "Alto impacto" : ap.consumo_projetado_kwh >= 30 ? "Médio impacto" : "Eficiente"}
                    </span>
                  </div>

                  <div style={styles.statBox}>
                    <span style={styles.statLabel}>Custo Financeiro</span>
                    <strong style={{ ...styles.statVal, color: "hsl(var(--color-secondary))" }}>
                      R$ {ap.custo_projetado_reais.toFixed(2)}
                    </strong>
                    <span className="badge badge-fin" style={styles.statBadge}>Estimado</span>
                  </div>

                  <div style={styles.statBox}>
                    <span style={styles.statLabel}>Pegada Ecológica</span>
                    <strong style={{ ...styles.statVal, color: "hsl(var(--color-primary))" }}>
                      {ap.pegada_carbono_kg_co2.toFixed(2)} kg
                    </strong>
                    <span className="badge badge-eco" style={styles.statBadge}>CO₂ Equivalente</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto 40px auto",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "16px",
  },
  sectionTitle: {
    fontSize: "20px",
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: "14px",
    color: "hsl(var(--text-secondary))",
    marginTop: "4px",
  },
  btnHeader: {
    padding: "10px 20px",
    fontSize: "14px",
  },
  emptyCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "50px",
    textAlign: "center",
  },
  gridAparelhos: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
    gap: "20px",
  },
  cardAparelho: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "200px",
  },
  cardTop: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
  },
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "var(--radius-sm)",
    background: "rgba(255, 255, 255, 0.03)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "var(--shadow-inset)",
  },
  avatarIcon: {
    fontSize: "24px",
  },
  metaAparelho: {
    display: "flex",
    flexDirection: "column",
  },
  aparelhoNome: {
    fontSize: "16px",
    fontWeight: "600",
    color: "white",
  },
  aparelhoWatts: {
    fontSize: "12px",
    color: "hsl(var(--text-muted))",
    marginTop: "2px",
  },
  cardDivider: {
    height: "1px",
    background: "rgba(255, 255, 255, 0.05)",
    margin: "16px 0",
  },
  statsContainer: {
    display: "flex",
    gap: "12px",
  },
  statBox: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "rgba(255, 255, 255, 0.01)",
    border: "1px solid rgba(255, 255, 255, 0.03)",
    borderRadius: "var(--radius-sm)",
    padding: "10px 6px",
  },
  statLabel: {
    fontSize: "10px",
    color: "hsl(var(--text-muted))",
    marginBottom: "4px",
  },
  statVal: {
    fontSize: "14px",
    fontWeight: "700",
    color: "white",
  },
  statBadge: {
    fontSize: "8px",
    padding: "2px 6px",
    marginTop: "6px",
    borderRadius: "40px",
  }
};
