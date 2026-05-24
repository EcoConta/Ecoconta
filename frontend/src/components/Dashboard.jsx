import React, { useState } from "react";

export default function Dashboard({ 
  diagnostico, 
  consumoTotalProjetado, 
  metaAtiva, 
  onNovaMeta,
  mesSelecionado,
  onSelectMes
}) {
  const [novaMetaValor, setNovaMetaValor] = useState("");
  const [editandoMeta, setEditandoMeta] = useState(false);

  // Filtra o faturamento com base no mês ativo selecionado (ou assume o mais recente)
  const faturamentoRecente = diagnostico?.historico_analitico?.find(
    (h) => h.mes_referencia === mesSelecionado
  ) || diagnostico?.historico_analitico?.[0] || null;

  const handleSubmitMeta = (e) => {
    e.preventDefault();
    const metaNum = parseFloat(novaMetaValor);
    if (metaNum > 0 && metaNum < 100) {
      onNovaMeta(metaNum);
      setNovaMetaValor("");
      setEditandoMeta(false);
    }
  };

  // Cálculos de Gamificação
  const consumoReal = faturamentoRecente?.consumo_real_kwh || 0;
  const valorReal = faturamentoRecente?.valor_real_reais || 0;
  
  // Percentual mapeado pelo inventário
  const percentualMapeado = faturamentoRecente?.percentual_mapeado || 0;
  const desvioKwh = faturamentoRecente?.desvio_kwh || 0;
  const desvioFinanceiro = faturamentoRecente 
    ? Math.max(0, (faturamentoRecente.valor_real_reais - faturamentoRecente.valor_inventariado_reais))
    : 0;

  // Meta de Economia
  const metaPorcentagem = metaAtiva?.porcentagem_meta || 0;
  const consumoMetaLimite = consumoReal ? consumoReal * (1 - metaPorcentagem / 100) : 0;
  const economiaProjetadaKwh = consumoReal ? consumoReal * (metaPorcentagem / 100) : 0;
  const economiaProjetadaReais = faturamentoRecente 
    ? faturamentoRecente.valor_real_reais * (metaPorcentagem / 100) 
    : 0;

  // Progresso em relação ao limite da meta
  // O ideal é que o consumoTotalProjetado (estimado dos aparelhos) seja menor que o consumoMetaLimite
  const metaAtingida = consumoTotalProjetado <= consumoMetaLimite;
  const progressoMetaPercentual = consumoReal 
    ? Math.min(100, (consumoTotalProjetado / consumoMetaLimite) * 100) 
    : 0;

  return (
    <div style={styles.container} className="animate-fade-in">
      <div className="grid-container" style={{ padding: 0 }}>
        
        {/* --- CARD 1: DIAGNÓSTICO E ACURÁCIA (VIEW) --- */}
        <div className="glass-card animate-fade-in" style={{ gridColumn: "span 7" }}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>📊 Auditoria do Consumo Real</h3>
            {diagnostico?.historico_analitico?.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="mes-analise-select" style={{ fontSize: '12px', color: 'hsl(var(--text-muted))' }}>
                  Fatura:
                </label>
                <select
                  id="mes-analise-select"
                  value={mesSelecionado || faturamentoRecente?.mes_referencia || ""}
                  onChange={(e) => onSelectMes(e.target.value)}
                  className="form-control"
                  style={{ padding: '6px 12px', fontSize: '13px', minWidth: '110px', height: 'auto', background: 'rgba(15,23,42,0.8)' }}
                >
                  {diagnostico.historico_analitico.map((h) => (
                    <option key={h.mes_referencia} value={h.mes_referencia}>
                      📅 {h.mes_referencia}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {faturamentoRecente ? (
            <div style={styles.diagnosticoContent}>
              <div style={styles.gaugeContainer}>
                <div style={styles.gaugeOuter}>
                  {/* Círculo de Progresso Estilizado com SVG */}
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8"/>
                    <circle 
                      cx="60" 
                      cy="60" 
                      r="50" 
                      fill="none" 
                      stroke="hsl(var(--color-primary))" 
                      strokeWidth="8"
                      strokeDasharray="314.16"
                      strokeDashoffset={314.16 - (314.16 * Math.min(100, percentualMapeado)) / 100}
                      strokeLinecap="round"
                      transform="rotate(-90 60 60)"
                      style={{ transition: "stroke-dashoffset 0.8s ease" }}
                    />
                  </svg>
                  <div style={styles.gaugeText}>
                    <span style={styles.gaugeValue}>{percentualMapeado}%</span>
                    <span style={styles.gaugeLabel}>Mapeado</span>
                  </div>
                </div>
              </div>

              <div style={styles.statsList}>
                <div style={styles.statRow}>
                  <span>Faturamento Real (Distribuidora):</span>
                  <strong style={{ color: "hsl(var(--text-primary))" }}>
                    {consumoReal} kWh / R$ {valorReal.toFixed(2)}
                  </strong>
                </div>
                <div style={styles.statRow}>
                  <span>Mapeado no Inventário:</span>
                  <strong style={{ color: "hsl(var(--color-secondary))" }}>
                    {consumoTotalProjetado.toFixed(1)} kWh
                  </strong>
                </div>
                <div style={styles.statRow}>
                  <span>Gargalo Não Mapeado:</span>
                  <strong style={desvioKwh > 0 ? { color: "hsl(var(--color-accent-amber))" } : { color: "hsl(var(--color-primary))" }}>
                    {desvioKwh > 0 ? `⚠️ ${desvioKwh.toFixed(1)} kWh` : "🔥 Tudo Mapeado!"}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: "hsl(var(--text-muted))", padding: "20px 0" }}>
              Nenhum histórico de faturamento para realizar o diagnóstico comparativo. Cadastre uma fatura para liberar este painel.
            </p>
          )}

          {/* Card de Desvio de Consumo Fantasma */}
          {desvioKwh > 0 && (
            <div style={styles.alertaFantasma} className="animate-fade-in">
              <span style={{ fontSize: "20px" }}>👻</span>
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: "700" }}>Alerta de Consumo Oculto (Fantasma)</h4>
                <p style={{ fontSize: "12px", marginTop: "2px", color: "hsl(var(--text-secondary))" }}>
                  Existem <strong>{desvioKwh.toFixed(1)} kWh</strong> (aprox. <strong>R$ {desvioFinanceiro.toFixed(2)}</strong>) cobrados que não estão descritos em seu inventário. Isso costuma indicar eletrodomésticos velhos em standby ou fugas de energia!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* --- CARD 2: GAMIFICAÇÃO & METAS DE ECONOMIA --- */}
        <div className="glass-card animate-fade-in" style={{ gridColumn: "span 5" }}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>🎯 Gamificação & Metas</h3>
            <span className={`badge ${metaPorcentagem > 0 ? "badge-fin" : "badge-eco"}`}>
              {metaPorcentagem > 0 ? `Meta: ${metaPorcentagem}%` : "Inativa"}
            </span>
          </div>

          <div style={styles.metaContent}>
            {metaPorcentagem > 0 ? (
              <div style={{ width: "100%" }}>
                <p style={styles.metaDesc}>
                  Seu alvo é reduzir em <strong>{metaPorcentagem}%</strong> o consumo real, limitando-o a <strong>{consumoMetaLimite.toFixed(1)} kWh</strong> mensais.
                </p>

                <div style={styles.metaVisual}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "8px" }}>
                    <span>Inventário: {consumoTotalProjetado.toFixed(0)} kWh</span>
                    <span>Limite: {consumoMetaLimite.toFixed(0)} kWh</span>
                  </div>
                  
                  {/* Trilha do Progresso */}
                  <div style={styles.progressTrack}>
                    <div style={{ 
                      ...styles.progressBar, 
                      width: `${progressoMetaPercentual}%`,
                      backgroundColor: metaAtingida ? "hsl(var(--color-primary))" : "hsl(var(--color-accent-red))"
                    }}></div>
                  </div>

                  <div style={{ marginTop: "10px", textAlign: "center" }}>
                    {metaAtingida ? (
                      <span className="badge badge-eco" style={{ fontSize: "11px" }}>
                        🏆 Meta Atingida no Planejamento!
                      </span>
                    ) : (
                      <span className="badge badge-danger" style={{ fontSize: "11px" }}>
                        🚨 Ajuste seu inventário! Você supera a meta em {(consumoTotalProjetado - consumoMetaLimite).toFixed(0)} kWh.
                      </span>
                    )}
                  </div>
                </div>

                <div style={styles.economiaEstimada}>
                  <div style={styles.economiaItem}>
                    <span style={styles.economiaLabel}>Redução Financeira</span>
                    <span style={styles.economiaValue}>R$ {economiaProjetadaReais.toFixed(2)}</span>
                  </div>
                  <div style={styles.economiaItem}>
                    <span style={styles.economiaLabel}>Redução de CO2</span>
                    <span style={styles.economiaValue}>{(economiaProjetadaKwh * 0.09).toFixed(1)} kgCO2</span>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: "hsl(var(--text-muted))", marginBottom: "20px" }}>
                Você ainda não estipulou uma meta de gamificação para diminuir seu consumo.
              </p>
            )}

            {/* Ajuste de Meta */}
            {!editandoMeta ? (
              <button 
                onClick={() => setEditandoMeta(true)}
                className="btn-secondary" 
                style={{ width: "100%", justifyContent: "center" }}
              >
                ⚙️ {metaPorcentagem > 0 ? "Reajustar Meta de Economia" : "Definir Meta de Economia"}
              </button>
            ) : (
              <form onSubmit={handleSubmitMeta} style={styles.formMeta} className="animate-fade-in">
                <input
                  type="number"
                  required
                  min="1"
                  max="99"
                  placeholder="Meta (Ex: 15 para 15%)"
                  value={novaMetaValor}
                  onChange={(e) => setNovaMetaValor(e.target.value)}
                  className="form-control"
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn-primary" style={{ padding: "10px 16px" }}>
                  Salvar
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditandoMeta(false)}
                  className="btn-secondary"
                  style={{ padding: "10px 16px" }}
                >
                  ✖️
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto 30px auto",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: "700",
  },
  diagnosticoContent: {
    display: "flex",
    alignItems: "center",
    gap: "32px",
    flexWrap: "wrap",
  },
  gaugeContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  gaugeOuter: {
    position: "relative",
    width: "120px",
    height: "120px",
  },
  gaugeText: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeValue: {
    fontFamily: "var(--font-display)",
    fontSize: "22px",
    fontWeight: "800",
    color: "white",
  },
  gaugeLabel: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "hsl(var(--text-muted))",
    marginTop: "2px",
  },
  statsList: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: "220px",
  },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
    borderBottom: "1px solid rgba(255,255,255,0.03)",
    paddingBottom: "8px",
    color: "hsl(var(--text-secondary))",
  },
  alertaFantasma: {
    display: "flex",
    gap: "14px",
    background: "rgba(245, 158, 11, 0.08)",
    border: "1px solid rgba(245, 158, 11, 0.15)",
    borderRadius: "var(--radius-sm)",
    padding: "16px",
    marginTop: "24px",
    alignItems: "flex-start",
  },
  metaContent: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "220px",
  },
  metaDesc: {
    fontSize: "14px",
    marginBottom: "16px",
  },
  metaVisual: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "var(--radius-sm)",
    padding: "16px",
    marginBottom: "20px",
  },
  progressTrack: {
    width: "100%",
    height: "10px",
    background: "rgba(255, 255, 255, 0.08)",
    borderRadius: "5px",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: "5px",
    transition: "width 0.6s cubic-bezier(0.1, 0.8, 0.2, 1)",
  },
  economiaEstimada: {
    display: "flex",
    gap: "16px",
    marginBottom: "24px",
  },
  economiaItem: {
    flex: 1,
    background: "rgba(16, 185, 129, 0.03)",
    border: "1px solid rgba(16, 185, 129, 0.08)",
    borderRadius: "var(--radius-sm)",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  economiaLabel: {
    fontSize: "11px",
    color: "hsl(var(--text-muted))",
    marginBottom: "4px",
  },
  economiaValue: {
    fontSize: "16px",
    fontWeight: "700",
    color: "hsl(var(--color-primary))",
  },
  formMeta: {
    display: "flex",
    gap: "8px",
    marginTop: "10px",
  }
};
