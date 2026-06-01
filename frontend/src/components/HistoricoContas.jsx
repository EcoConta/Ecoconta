import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "../api";

export default function HistoricoContas({ 
  residenciaId, 
  diagnostico, 
  onContasAtualizadas 
}) {
  const [lendoPdf, setLendoPdf] = useState(false);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  
  // Dados do Formulário
  const [mesReferencia, setMesReferencia] = useState("");
  const [consumoKwh, setConsumoKwh] = useState("");
  const [valorReais, setValorReais] = useState("");
  const [diasFaturamento, setDiasFaturamento] = useState(30);
  const [historicoPdfExtraido, setHistoricoPdfExtraido] = useState([]);
  
  // Alertas
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal Analítico
  const [modalAberto, setModalAberto] = useState(false);
  const [faturaAtivaModal, setFaturaAtivaModal] = useState(null);
  const [aparelhosModal, setAparelhosModal] = useState([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [modalTab, setModalTab] = useState("desmembramento"); // desmembramento, comparativo
  const [modalMesesComparar, setModalMesesComparar] = useState([]);

  useEffect(() => {
    // Preenche com o mês atual simulado
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    setMesReferencia(`${ano}-${mes}`);
  }, [residenciaId]);

  // Upload e Parsing do PDF
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLendoPdf(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const dados = await api.parseFaturaPdf(file);
      setMesReferencia(dados.mes_referencia);
      setConsumoKwh(dados.consumo_kwh);
      setValorReais(dados.valor_reais);
      setDiasFaturamento(dados.dias_faturamento || 30);
      setHistoricoPdfExtraido(dados.historico_pdf || []);

      if (dados.parser_sucesso) {
        setSuccessMsg("🎉 PDF processado com sucesso! Dados extraídos e preenchidos no formulário.");
      } else {
        setSuccessMsg("⚠️ PDF processado, mas alguns valores podem não ter sido extraídos perfeitamente. Por favor, revise os campos abaixo.");
      }
    } catch (err) {
      setErrorMsg(err.message || "Erro ao processar o arquivo PDF.");
    } finally {
      setLendoPdf(false);
    }
  };
 
  // Cadastro de Fatura
  const handleSalvarConta = async (e) => {
    e.preventDefault();
    setLoadingSalvar(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await api.cadastrarConta(residenciaId, mesReferencia, consumoKwh, valorReais, diasFaturamento);
      setSuccessMsg("✅ Fatura de energia cadastrada com sucesso!");
      
      // Limpa inputs
      setConsumoKwh("");
      setValorReais("");
      setDiasFaturamento(30);
      setHistoricoPdfExtraido([]);
      
      // Notifica o pai para recarregar o histórico analítico
      onContasAtualizadas();
    } catch (err) {
      setErrorMsg(err.message || "Erro ao cadastrar fatura de energia.");
    } finally {
      setLoadingSalvar(false);
    }
  };

  // Exclusão de Fatura
  const handleDeletarConta = async (id, mes) => {
    if (!window.confirm(`⚠️ Tem certeza de que deseja deletar permanentemente a fatura de ${mes}?`)) {
      return;
    }

    try {
      await api.deletarConta(id);
      setSuccessMsg(`🗑️ Fatura de ${mes} excluída com sucesso.`);
      onContasAtualizadas();
    } catch (err) {
      setErrorMsg(err.message || "Erro ao deletar fatura.");
    }
  };

  // Abre Modal Analítico com desmembramento de custos por aparelho
  const handleAbrirModal = async (fatura) => {
    setFaturaAtivaModal(fatura);
    setModalAberto(true);
    setLoadingModal(true);
    setModalTab("desmembramento"); // Reseta para a primeira aba por padrão
    setModalMesesComparar(faturas.slice(0, 4).map(f => f.mes_referencia)); // Inicializa comparação
    try {
      // Consulta a API de aparelhos passando o mês correspondente da fatura
      const dadosAparelhos = await api.obterConsumoAparelhos(residenciaId, fatura.mes_referencia);
      setAparelhosModal(dadosAparelhos);
    } catch (err) {
      console.error("Erro ao carregar aparelhos do mês:", err);
    } finally {
      setLoadingModal(false);
    }
  };

  const faturas = diagnostico?.historico_analitico || [];

  return (
    <div style={styles.container} className="animate-fade-in">
      
      <div className="grid-container" style={{ padding: 0 }}>
        
        {/* --- COLUNA ESQUERDA: CADASTRO DE CONTAS (PDF / MANUAL) --- */}
        <div className="glass-card animate-fade-in" style={{ gridColumn: "span 5", height: "fit-content" }}>
          <h3 style={styles.sectionTitle}>📅 Cadastrar Fatura</h3>
          <p style={styles.sectionSubtitle}>
            Adicione uma nova fatura mensal para liberar análises históricas.
          </p>

          {errorMsg && <div className="badge badge-danger" style={{ width: "100%", padding: "10px", marginBottom: "16px", borderRadius: "8px" }}>⚠️ {errorMsg}</div>}
          {successMsg && <div className="badge badge-eco" style={{ width: "100%", padding: "10px", marginBottom: "16px", borderRadius: "8px" }}>{successMsg}</div>}

          {/* Área de Drag & Drop PDF */}
          <div style={styles.dropzoneContainer}>
            <label className="form-label" style={{ fontWeight: '600' }}>📂 Leitor Inteligente (PDF)</label>
            <div style={styles.dropzone}>
              <span style={{ fontSize: "28px" }}>📄</span>
              <p style={styles.dropzoneText}>
                {lendoPdf ? "🌀 Lendo fatura..." : "Arraste o PDF de luz aqui ou selecione"}
              </p>
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                style={styles.fileInput}
                disabled={lendoPdf}
              />
            </div>
          </div>

          {/* NOVO: Helper de Faturas Detectadas no Histórico do PDF */}
          {historicoPdfExtraido.length > 0 && (
            <div style={{ marginTop: "20px", padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px" }} className="animate-fade-in">
              <h4 style={{ fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: "hsl(var(--color-primary))" }}>
                📋 Faturas Históricas Detectadas no PDF
              </h4>
              <p style={{ fontSize: "11px", color: "hsl(var(--text-secondary))", marginBottom: "12px", lineHeight: "1.4" }}>
                O leitor extraiu o histórico abaixo. Clique em <strong>✍️ Usar</strong> para preencher o cadastro do mês correspondente:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto", paddingRight: "4px" }}>
                {historicoPdfExtraido.map((item) => (
                  <div key={item.mes_referencia} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(15,23,42,0.4)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: "12px", color: "white" }}>
                      📅 <strong>{item.mes_referencia}</strong>: {item.consumo_kwh} kWh ({item.dias_faturamento} dias)
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        setMesReferencia(item.mes_referencia);
                        setConsumoKwh(item.consumo_kwh);
                        setDiasFaturamento(item.dias_faturamento);
                        setSuccessMsg(`✍️ Preenchido no formulário: Fatura de ${item.mes_referencia} com ${item.consumo_kwh} kWh e ${item.dias_faturamento} dias. Insira o valor em R$ pago e salve!`);
                      }}
                      className="btn-primary" 
                      style={{ padding: "4px 10px", fontSize: "11px", minHeight: "auto", boxShadow: "none" }}
                    >
                      ✍️ Usar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSalvarConta} style={{ marginTop: "20px" }}>
            <div className="form-group">
              <label className="form-label">Mês de Referência</label>
              <input
                type="month"
                required
                value={mesReferencia}
                onChange={(e) => setMesReferencia(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Consumo do Mês (kWh)</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                placeholder="Ex: 240"
                value={consumoKwh}
                onChange={(e) => setConsumoKwh(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Período Faturado (Dias)</label>
              <input
                type="number"
                required
                min="1"
                max="100"
                placeholder="Ex: 30"
                value={diasFaturamento}
                onChange={(e) => setDiasFaturamento(parseInt(e.target.value) || "")}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Valor Pago (R$)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="Ex: 210.50"
                value={valorReais}
                onChange={(e) => setValorReais(e.target.value)}
                className="form-control"
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "10px" }} disabled={loadingSalvar || lendoPdf}>
              {loadingSalvar ? "Salvando..." : "💾 Salvar Fatura"}
            </button>
          </form>
        </div>

        {/* --- COLUNA DIREITA: HISTÓRICO DE FATURAS SALVAS --- */}
        <div className="glass-card animate-fade-in" style={{ gridColumn: "span 7" }}>
          <h3 style={styles.sectionTitle}>📜 Histórico Faturado</h3>
          <p style={styles.sectionSubtitle}>
            Consulte faturas gravadas e seus respectivos desmembramentos energéticos.
          </p>

          {faturas.length === 0 ? (
            <div style={styles.emptyList}>
              <span style={{ fontSize: "36px" }}>📅</span>
              <p style={{ marginTop: "12px", color: "hsl(var(--text-muted))" }}>
                Nenhuma conta cadastrada ainda. Insira sua primeira fatura à esquerda!
              </p>
            </div>
          ) : (
            <div style={styles.listaFaturas}>
              {faturas.map((fat) => (
                <div key={fat.mes_referencia} style={styles.itemFatura} className="glass-card">
                  <div style={styles.itemLeft}>
                    <div style={styles.mesBadge}>
                      <span>📅</span>
                      <strong>{fat.mes_referencia}</strong>
                    </div>
                    <div style={styles.itemDetails}>
                      <span>Consumo: <strong>{fat.consumo_real_kwh} kWh</strong> ({fat.dias_faturamento || 30} dias)</span>
                      <span>Valor: <strong>R$ {fat.valor_real_reais.toFixed(2)}</strong></span>
                      <span style={{ fontSize: "11px", color: "hsl(var(--text-muted))", marginTop: "2px" }}>
                        Tarifa Real: R$ {(fat.valor_real_reais / fat.consumo_real_kwh).toFixed(3)}/kWh
                      </span>
                    </div>
                  </div>

                  <div style={styles.itemActions}>
                    <button 
                      onClick={() => handleAbrirModal(fat)}
                      className="btn-primary" 
                      style={styles.btnActionSmall}
                    >
                      📊 Detalhes
                    </button>
                    <button 
                      onClick={() => handleDeletarConta(fat.conta_id, fat.mes_referencia)}
                      className="btn-secondary" 
                      style={{ ...styles.btnActionSmall, color: "hsl(var(--color-accent-red))", borderColor: "rgba(239,68,68,0.2)" }}
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* =========================================================================
          MODAL ANALÍTICO DE CONSUMO POR APARELHO (GLASSMORPHIC OVERLAY)
          ========================================================================= */}
      {modalAberto && faturaAtivaModal && (() => {
        const consumoKwhReal = faturaAtivaModal.consumo_real_kwh;
        const valorReaisReal = faturaAtivaModal.valor_real_reais;
        const diasCiclo = faturaAtivaModal.dias_faturamento || 30;

        const consumoDiarioMedio = consumoKwhReal / diasCiclo;
        const custoDiarioMedio = valorReaisReal / diasCiclo;
        const tarifaCalculada = valorReaisReal / consumoKwhReal;

        const co2Mes = consumoKwhReal * 0.09;
        const arvoresEquivalentes = (co2Mes / 7.3).toFixed(1);
        const kmCarroEquivalentes = (co2Mes / 0.12).toFixed(0);
        const recargasCelular = (consumoKwhReal / 0.01).toFixed(0);

        // Filtra e ordena faturas para comparação
        const faturasFiltradas = faturas
          .filter(f => modalMesesComparar.includes(f.mes_referencia))
          .sort((a, b) => a.mes_referencia.localeCompare(b.mes_referencia));

        const maxConsumo = Math.max(
          ...faturasFiltradas.map(f => Math.max(f.consumo_real_kwh, f.consumo_inventariado_kwh || 0)),
          100
        );

        return createPortal(
          <div style={styles.modalOverlay} className="animate-fade-in">
            <style>{`
              .bar-hover:hover {
                transform: translateY(-4px) scaleX(1.05);
                filter: brightness(1.2);
                box-shadow: 0 0 25px rgba(59, 130, 246, 0.4) !important;
              }
            `}</style>

            <div className="glass-card" style={styles.modalContent}>
              
              <div style={styles.modalHeader}>
                <div>
                  <h3 style={styles.modalTitle}>📊 Análise de Fatura Detalhada</h3>
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <span className="badge badge-fin">
                      Competência: {faturaAtivaModal.mes_referencia}
                    </span>
                    <span className="badge badge-eco">
                      Ciclo: {diasCiclo} dias
                    </span>
                  </div>
                </div>
                <button onClick={() => setModalAberto(false)} style={styles.btnCloseModal}>
                  ✖️
                </button>
              </div>

              {/* Navegação por Abas Internas do Modal */}
              <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px", marginBottom: "20px" }}>
                <button 
                  onClick={() => setModalTab("desmembramento")}
                  style={{
                    background: modalTab === "desmembramento" ? "rgba(16, 185, 129, 0.12)" : "transparent",
                    border: "1px solid " + (modalTab === "desmembramento" ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.08)"),
                    color: modalTab === "desmembramento" ? "hsl(var(--color-primary))" : "hsl(var(--text-secondary))",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    transition: "all 0.2s ease"
                  }}
                >
                  🔌 Desmembramento por Aparelho
                </button>
                <button 
                  onClick={() => setModalTab("comparativo")}
                  style={{
                    background: modalTab === "comparativo" ? "rgba(59, 130, 246, 0.12)" : "transparent",
                    border: "1px solid " + (modalTab === "comparativo" ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.08)"),
                    color: modalTab === "comparativo" ? "hsl(var(--color-secondary))" : "hsl(var(--text-secondary))",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    transition: "all 0.2s ease"
                  }}
                >
                  📈 Comparativo Histórico & Análise
                </button>
              </div>

              {modalTab === "desmembramento" ? (
                <>
                  {/* Diagnóstico Rápido da Conta */}
                  <div style={styles.modalDiagnostico}>
                    <div style={styles.diagCol}>
                      <span style={styles.diagLabel}>Consumo Real</span>
                      <strong style={styles.diagVal}>{consumoKwhReal} kWh</strong>
                      <span style={{ fontSize: "10px", color: "hsl(var(--text-muted))" }}>({diasCiclo} dias)</span>
                    </div>
                    <div style={styles.diagCol}>
                      <span style={styles.diagLabel}>Mapeado no Inventário</span>
                      <strong style={{ ...styles.diagVal, color: "hsl(var(--color-secondary))" }}>
                        {faturaAtivaModal.consumo_inventariado_kwh.toFixed(1)} kWh
                      </strong>
                    </div>
                    <div style={styles.diagCol}>
                      <span style={styles.diagLabel}>Acurácia Cadastral</span>
                      <strong style={{ ...styles.diagVal, color: "hsl(var(--color-primary))" }}>
                        {faturaAtivaModal.percentual_mapeado}%
                      </strong>
                    </div>
                    <div style={styles.diagCol}>
                      <span style={styles.diagLabel}>Perda Oculta (Fuga)</span>
                      <strong style={faturaAtivaModal.desvio_kwh > 0 ? { ...styles.diagVal, color: "hsl(var(--color-accent-amber))" } : { ...styles.diagVal, color: "hsl(var(--color-primary))" }}>
                        {faturaAtivaModal.desvio_kwh > 0 ? `${faturaAtivaModal.desvio_kwh.toFixed(1)} kWh` : "Zero!"}
                      </strong>
                    </div>
                  </div>

                  {/* Bloco de Métricas Financeiras & Ecológicas Auxiliares */}
                  <h4 style={{ fontSize: "14px", fontWeight: "600", color: "hsl(var(--text-secondary))", marginTop: "24px", marginBottom: "12px" }}>
                    💡 Insights de Consumo & Equivalências Ecológicas:
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
                    <div style={styles.diagCol}>
                      <span style={styles.diagLabel}>Média Diária</span>
                      <strong style={styles.diagVal}>{consumoDiarioMedio.toFixed(2)} kWh/dia</strong>
                      <span style={{ fontSize: "10px", color: "hsl(var(--text-muted))" }}>Custo: R$ {custoDiarioMedio.toFixed(2)}/dia</span>
                    </div>
                    <div style={styles.diagCol}>
                      <span style={styles.diagLabel}>Tarifa Efetiva</span>
                      <strong style={{ ...styles.diagVal, color: "hsl(var(--color-secondary))" }}>R$ {tarifaCalculada.toFixed(3)}/kWh</strong>
                      <span style={{ fontSize: "10px", color: "hsl(var(--text-muted))" }}>Com impostos inclusos</span>
                    </div>
                    <div style={styles.diagCol}>
                      <span style={styles.diagLabel}>Pegada de Carbono</span>
                      <strong style={{ ...styles.diagVal, color: "hsl(var(--color-primary))" }}>{co2Mes.toFixed(2)} kgCO₂e</strong>
                      <span style={{ fontSize: "10px", color: "hsl(var(--text-muted))" }}>Fator SIN: 0.09 kg/kWh</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
                    <div style={{ ...styles.diagCol, border: "1px solid rgba(16, 185, 129, 0.15)", background: "rgba(16, 185, 129, 0.02)" }}>
                      <span style={{ ...styles.diagLabel, color: "hsl(var(--color-primary))" }}>🌲 Reflorestamento</span>
                      <strong style={styles.diagVal}>{arvoresEquivalentes} árvores</strong>
                      <span style={{ fontSize: "10px", color: "hsl(var(--text-muted))" }}>Necessárias para neutralizar/ano</span>
                    </div>
                    <div style={{ ...styles.diagCol, border: "1px solid rgba(59, 130, 246, 0.15)", background: "rgba(59, 130, 246, 0.02)" }}>
                      <span style={{ ...styles.diagLabel, color: "hsl(var(--color-secondary))" }}>🚗 Emissão de Tráfego</span>
                      <strong style={styles.diagVal}>{kmCarroEquivalentes} km</strong>
                      <span style={{ fontSize: "10px", color: "hsl(var(--text-muted))" }}>Rodados de carro de passeio</span>
                    </div>
                    <div style={{ ...styles.diagCol, border: "1px solid rgba(245, 158, 11, 0.15)", background: "rgba(245, 158, 11, 0.02)" }}>
                      <span style={{ ...styles.diagLabel, color: "hsl(var(--color-accent-amber))" }}>📱 Recargas Mobile</span>
                      <strong style={styles.diagVal}>{Number(recargasCelular).toLocaleString("pt-BR")}</strong>
                      <span style={{ fontSize: "10px", color: "hsl(var(--text-muted))" }}>Cargas completas de celular</span>
                    </div>
                  </div>

                  <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "20px 0" }}></div>

                  {/* Tabela de Aparelhos Recalculados para a Tarifa do Mês */}
                  <h4 style={{ fontSize: "14px", fontWeight: "600", color: "hsl(var(--text-secondary))", marginBottom: "12px" }}>
                    Desmembramento Estimado por Equipamento no Mês:
                  </h4>

                  {loadingModal ? (
                    <div style={styles.modalLoader}>
                      <div style={styles.spinner}></div>
                    </div>
                  ) : (
                    <div style={styles.modalTableContainer}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Equipamento</th>
                            <th style={styles.th}>Especificações</th>
                            <th style={styles.th}>Consumo (kWh)</th>
                            <th style={styles.th}>Gasto Estimado (R$)</th>
                            <th style={{ ...styles.th, paddingRight: "16px" }}>Pegada CO₂</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aparelhosModal.map((ap) => (
                            <tr key={ap.inventario_id} style={styles.tr}>
                              <td style={{ ...styles.td, fontWeight: "600", color: "white" }}>
                                🔌 {ap.nome_personalizado}
                              </td>
                              <td style={styles.td}>
                                {ap.potencia_utilizada}W • {ap.horas_dia}h/dia
                              </td>
                              <td style={styles.td}>
                                {ap.consumo_projetado_kwh.toFixed(1)} kWh
                              </td>
                              <td style={{ ...styles.td, color: "hsl(var(--color-secondary))", fontWeight: "700" }}>
                                R$ {ap.custo_projetado_reais.toFixed(2)}
                              </td>
                              <td style={{ ...styles.td, color: "hsl(var(--color-primary))", paddingRight: "16px" }}>
                                {ap.pegada_carbono_kg_co2.toFixed(2)} kg
                              </td>
                            </tr>
                          ))}
                          {aparelhosModal.length === 0 && (
                            <tr>
                              <td colSpan="5" style={{ ...styles.td, textAlign: "center", color: "hsl(var(--text-muted))" }}>
                                Nenhum aparelho no inventário para simular neste mês.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* --- ABA COMPARATIVA: FILTRO DE MESES --- */}
                  <div style={{ marginBottom: "20px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "8px", padding: "16px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "hsl(var(--text-secondary))", display: "block", marginBottom: "8px" }}>
                      🔍 Selecione os meses para comparar:
                    </span>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                      {faturas.map(f => {
                        const isChecked = modalMesesComparar.includes(f.mes_referencia);
                        return (
                          <label key={f.mes_referencia} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer", color: isChecked ? "white" : "hsl(var(--text-muted))", transition: "color 0.2s ease" }}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setModalMesesComparar([...modalMesesComparar, f.mes_referencia]);
                                } else {
                                  setModalMesesComparar(modalMesesComparar.filter(m => m !== f.mes_referencia));
                                }
                              }}
                              style={{ cursor: "pointer" }}
                            />
                            <strong>{f.mes_referencia}</strong>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {faturasFiltradas.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "hsl(var(--text-muted))" }}>
                      💡 Selecione ao menos um mês acima para iniciar a análise histórica comparativa.
                    </div>
                  ) : (
                    <>
                      {/* --- GRÁFICO COMPARATIVO DENTRO DO MODAL --- */}
                      <h4 style={{ fontSize: "14px", fontWeight: "600", color: "hsl(var(--text-secondary))", marginBottom: "12px" }}>
                        📈 Gráfico: Real Faturado vs Estimado do Inventário (kWh)
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "12px", padding: "24px 24px 16px 24px", marginBottom: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", height: "240px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px", position: "relative" }}>
                          
                          {/* Linhas de Grade */}
                          <div style={{ position: "absolute", left: 0, right: 0, bottom: "0%", borderBottom: "1px dashed rgba(255,255,255,0.03)" }}></div>
                          <div style={{ position: "absolute", left: 0, right: 0, bottom: "25%", borderBottom: "1px dashed rgba(255,255,255,0.03)" }}><span style={{ position: "absolute", left: 2, bottom: 2, fontSize: "9px", color: "hsl(var(--text-muted))" }}>{Math.round(maxConsumo * 0.25)} kWh</span></div>
                          <div style={{ position: "absolute", left: 0, right: 0, bottom: "50%", borderBottom: "1px dashed rgba(255,255,255,0.03)" }}><span style={{ position: "absolute", left: 2, bottom: 2, fontSize: "9px", color: "hsl(var(--text-muted))" }}>{Math.round(maxConsumo * 0.50)} kWh</span></div>
                          <div style={{ position: "absolute", left: 0, right: 0, bottom: "75%", borderBottom: "1px dashed rgba(255,255,255,0.03)" }}><span style={{ position: "absolute", left: 2, bottom: 2, fontSize: "9px", color: "hsl(var(--text-muted))" }}>{Math.round(maxConsumo * 0.75)} kWh</span></div>
                          <div style={{ position: "absolute", left: 0, right: 0, bottom: "100%", borderBottom: "1px dashed rgba(255,255,255,0.03)" }}><span style={{ position: "absolute", left: 2, bottom: 2, fontSize: "9px", color: "hsl(var(--text-muted))" }}>{Math.round(maxConsumo)} kWh</span></div>

                          {faturasFiltradas.map(f => {
                            const heightReal = (f.consumo_real_kwh / maxConsumo) * 100;
                            const heightInv = ((f.consumo_inventariado_kwh || 0) / maxConsumo) * 100;

                            return (
                              <div key={f.mes_referencia} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end", zIndex: 2 }}>
                                <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "100%", width: "100%", justifyContent: "center" }}>
                                  
                                  {/* Barra Real (Azul) */}
                                  <div 
                                    title={`Real: ${f.consumo_real_kwh} kWh`}
                                    style={{ 
                                      width: "28px", 
                                      height: `${heightReal}%`, 
                                      background: "linear-gradient(to top, rgba(59, 130, 246, 0.4), hsl(var(--color-secondary)))", 
                                      borderRadius: "4px 4px 0 0",
                                      border: "1px solid rgba(59, 130, 246, 0.3)",
                                      boxShadow: "0 0 10px rgba(59, 130, 246, 0.1)",
                                      transition: "all 0.3s ease",
                                      position: "relative",
                                      cursor: "pointer"
                                    }}
                                    className="bar-hover"
                                  >
                                    <span style={{ position: "absolute", top: "-22px", left: "50%", transform: "translateX(-50%)", fontSize: "10px", color: "hsl(var(--color-secondary))", fontWeight: "700" }}>
                                      {f.consumo_real_kwh.toFixed(0)}
                                    </span>
                                  </div>

                                  {/* Barra Mapeada (Verde) */}
                                  <div 
                                    title={`Mapeado: ${f.consumo_inventariado_kwh.toFixed(1)} kWh`}
                                    style={{ 
                                      width: "28px", 
                                      height: `${heightInv}%`, 
                                      background: "linear-gradient(to top, rgba(16, 185, 129, 0.4), hsl(var(--color-primary)))", 
                                      borderRadius: "4px 4px 0 0",
                                      border: "1px solid rgba(16, 185, 129, 0.3)",
                                      boxShadow: "0 0 10px rgba(16, 185, 129, 0.1)",
                                      transition: "all 0.3s ease",
                                      position: "relative",
                                      cursor: "pointer"
                                    }}
                                    className="bar-hover"
                                  >
                                    <span style={{ position: "absolute", top: "-22px", left: "50%", transform: "translateX(-50%)", fontSize: "10px", color: "hsl(var(--color-primary))", fontWeight: "700" }}>
                                      {f.consumo_inventariado_kwh.toFixed(0)}
                                    </span>
                                  </div>

                                </div>
                                <span style={{ marginTop: "12px", fontSize: "11px", fontWeight: "700", color: "white" }}>
                                  📅 {f.mes_referencia}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Legendas */}
                        <div style={{ display: "flex", justifyContent: "center", gap: "24px", fontSize: "12px", marginTop: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: "hsl(var(--color-secondary))" }}></div>
                            <span style={{ color: "hsl(var(--text-secondary))" }}>Consumo Real Cemig (kWh)</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: "hsl(var(--color-primary))" }}></div>
                            <span style={{ color: "hsl(var(--text-secondary))" }}>Consumo Estimado Aparelhos (kWh)</span>
                          </div>
                        </div>
                      </div>

                      {/* --- TABELA DE RESUMO DE DETALHES --- */}
                      <h4 style={{ fontSize: "14px", fontWeight: "600", color: "hsl(var(--text-secondary))", marginBottom: "12px" }}>
                        📊 Tabela de Detalhamento Histórico Comparativo
                      </h4>
                      <div style={styles.modalTableContainer}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Competência</th>
                              <th style={styles.th}>Ciclo (Dias)</th>
                              <th style={styles.th}>Consumo Cemig</th>
                              <th style={styles.th}>Mapeado</th>
                              <th style={styles.th}>Acurácia (%)</th>
                              <th style={{ ...styles.th, paddingRight: "16px" }}>Consumo Oculto (Standby/Fuga)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {faturasFiltradas.map(f => (
                              <tr key={f.mes_referencia} style={styles.tr}>
                                <td style={{ ...styles.td, fontWeight: "700", color: "white" }}>
                                  📅 {f.mes_referencia}
                                </td>
                                <td style={styles.td}>
                                  {f.dias_faturamento || 30} dias
                                </td>
                                <td style={{ ...styles.td, fontWeight: "700", color: "hsl(var(--color-secondary))" }}>
                                  {f.consumo_real_kwh.toFixed(1)} kWh
                                </td>
                                <td style={styles.td}>
                                  {f.consumo_inventariado_kwh.toFixed(1)} kWh
                                </td>
                                <td style={{ ...styles.td, color: "hsl(var(--color-primary))", fontWeight: "700" }}>
                                  {f.percentual_mapeado}%
                                </td>
                                <td style={{ ...styles.td, color: f.desvio_kwh > 0 ? "hsl(var(--color-accent-amber))" : "hsl(var(--color-primary))", fontWeight: "600", paddingRight: "16px" }}>
                                  {f.desvio_kwh > 0 ? `⚠️ ${f.desvio_kwh.toFixed(1)} kWh` : "🔥 Totalmente Mapeado!"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}

              <div style={styles.modalFooter}>
                <button onClick={() => setModalAberto(false)} className="btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                  Fechar Análise
                </button>
              </div>

            </div>
          </div>,
          document.body
        );
      })()}

    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto 40px auto",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "700",
    marginBottom: "4px",
  },
  sectionSubtitle: {
    fontSize: "13px",
    color: "hsl(var(--text-secondary))",
    marginBottom: "24px",
  },
  dropzoneContainer: {
    background: "rgba(255,255,255,0.01)",
    border: "2px dashed rgba(255,255,255,0.08)",
    borderRadius: "var(--radius-sm)",
    padding: "16px",
    textAlign: "center",
    position: "relative",
  },
  dropzone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  dropzoneText: {
    fontSize: "12px",
    color: "hsl(var(--text-secondary))",
  },
  fileInput: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
  },
  emptyList: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "60px 20px",
    textAlign: "center",
  },
  listaFaturas: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxHeight: "560px",
    overflowY: "auto",
    paddingRight: "6px",
  },
  itemFatura: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px",
    background: "rgba(255, 255, 255, 0.01)",
    flexWrap: "wrap",
    gap: "16px",
  },
  itemLeft: {
    display: "flex",
    gap: "20px",
    alignItems: "center",
  },
  mesBadge: {
    background: "rgba(16, 185, 129, 0.08)",
    border: "1px solid rgba(16, 185, 129, 0.15)",
    color: "hsl(var(--color-primary))",
    padding: "10px 16px",
    borderRadius: "var(--radius-sm)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    fontSize: "14px",
  },
  itemDetails: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    fontSize: "14px",
    color: "hsl(var(--text-secondary))",
  },
  itemActions: {
    display: "flex",
    gap: "10px",
  },
  btnActionSmall: {
    padding: "8px 16px",
    fontSize: "12px",
  },
  
  // --- ESTILOS DO MODAL ---
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(3, 7, 18, 0.8)",
    backdropFilter: "blur(8px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: "20px",
  },
  modalContent: {
    maxWidth: "800px",
    width: "100%",
    background: "rgba(15, 23, 42, 0.85)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    padding: "36px",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
  },
  modalTitle: {
    fontSize: "20px",
    fontWeight: "800",
  },
  btnCloseModal: {
    background: "transparent",
    border: "none",
    color: "hsl(var(--text-muted))",
    fontSize: "18px",
    cursor: "pointer",
    padding: "4px",
    transition: "color 0.2s ease",
  },
  modalDiagnostico: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
    marginBottom: "20px",
  },
  diagCol: {
    background: "rgba(255,255,255,0.01)",
    border: "1px solid rgba(255,255,255,0.03)",
    borderRadius: "var(--radius-sm)",
    padding: "12px 8px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  diagLabel: {
    fontSize: "10px",
    color: "hsl(var(--text-muted))",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  diagVal: {
    fontSize: "15px",
    fontWeight: "700",
    color: "white",
  },
  modalLoader: {
    height: "200px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid rgba(255, 255, 255, 0.05)",
    borderTopColor: "hsl(var(--color-primary))",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  modalTableContainer: {
    overflowX: "auto",
    maxHeight: "300px",
    overflowY: "auto",
    background: "rgba(255,255,255,0.01)",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "var(--radius-sm)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: "13px",
  },
  th: {
    padding: "12px 16px",
    background: "rgba(255,255,255,0.02)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    color: "hsl(var(--text-secondary))",
    fontWeight: "600",
  },
  td: {
    padding: "12px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.03)",
    color: "hsl(var(--text-secondary))",
  },
  tr: {
    transition: "background 0.2s ease",
    "&:hover": {
      background: "rgba(255,255,255,0.01)"
    }
  },
  modalFooter: {
    marginTop: "30px",
  }
};
