import React, { useState } from "react";

export default function Header({ 
  residencias, 
  residenciaAtiva, 
  onChangeResidencia, 
  onCriarResidencia,
  onDeletarResidencia,
  usuarioLogado,
  onLogout
}) {
  const [novoNome, setNovoNome] = useState("");
  const [exibirForm, setExibirForm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (novoNome.trim()) {
      onCriarResidencia(novoNome.trim());
      setNovoNome("");
      setExibirForm(false);
    }
  };

  return (
    <header style={styles.header} className="animate-fade-in">
      <div style={styles.logoContainer}>
        <span style={styles.logoIcon}>🌱</span>
        <div>
          <h1 style={styles.logoText}>Ecoconta</h1>
          <p style={styles.subtext}>Consumo Inteligente & Sustentabilidade</p>
        </div>
      </div>

      <div style={styles.controls}>
        {usuarioLogado && (
          <div style={styles.userBadge} className="animate-fade-in">
            <span style={styles.userAvatar}>👤</span>
            <span style={styles.userName} title={usuarioLogado.email}>
              {usuarioLogado.nome}
            </span>
          </div>
        )}

        {!exibirForm ? (
          <div style={styles.selectorGroup}>
            <label htmlFor="residencia-select" className="form-label" style={{ margin: 0, fontSize: '12px' }}>
              Residência Ativa:
            </label>
            <select
              id="residencia-select"
              value={residenciaAtiva || ""}
              onChange={(e) => onChangeResidencia(parseInt(e.target.value))}
              className="form-control"
              style={styles.select}
            >
              {residencias.length === 0 ? (
                <option value="">Nenhuma cadastrada</option>
              ) : (
                residencias.map((r) => (
                  <option key={r.id} value={r.id}>
                    🏡 {r.nome}
                  </option>
                ))
              )}
            </select>
            <button 
              onClick={() => setExibirForm(true)}
              className="btn-secondary"
              style={styles.btnSmall}
              title="Cadastrar nova residência"
            >
              ➕ Nova
            </button>
            {residencias.length > 0 && (
              <button 
                onClick={() => {
                  const activa = residencias.find(r => r.id === residenciaAtiva);
                  if (activa && window.confirm(`⚠️ Tem certeza de que deseja excluir permanentemente a residência "${activa.nome}" e todos os seus dados associados (contas, inventário, etc.)?`)) {
                    onDeletarResidencia(residenciaAtiva);
                  }
                }}
                className="btn-secondary"
                style={{ ...styles.btnSmall, color: "hsl(var(--color-accent-red))", borderColor: "rgba(239,68,68,0.2)" }}
                title="Excluir residência ativa"
              >
                🗑️ Excluir
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.formInline} className="animate-fade-in">
            <input
              type="text"
              placeholder="Ex: Casa da Praia"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className="form-control"
              style={styles.inputInline}
              autoFocus
              maxLength={40}
              required
            />
            <button type="submit" className="btn-primary" style={styles.btnSmallInline}>
              Salvar
            </button>
            <button 
              type="button" 
              onClick={() => setExibirForm(false)}
              className="btn-secondary" 
              style={styles.btnSmallInline}
            >
              Cancelar
            </button>
          </form>
        )}

        {usuarioLogado && (
          <button 
            onClick={onLogout}
            className="btn-secondary"
            style={{ ...styles.btnSmall, color: "hsl(var(--text-muted))", borderColor: "rgba(255,255,255,0.08)" }}
            title="Sair da conta"
          >
            Sair 🚪
          </button>
        )}
      </div>
    </header>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 40px",
    background: "rgba(15, 23, 42, 0.4)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    flexWrap: "wrap",
    gap: "20px",
  },
  logoContainer: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  logoIcon: {
    fontSize: "36px",
    filter: "drop-shadow(0 0 10px rgba(16, 185, 129, 0.3))",
  },
  logoText: {
    fontSize: "24px",
    background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    fontWeight: "800",
  },
  subtext: {
    fontSize: "12px",
    color: "hsl(var(--text-muted))",
    marginTop: "2px",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  userBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    padding: "6px 12px",
    borderRadius: "20px",
    marginRight: "4px",
  },
  userAvatar: {
    fontSize: "13px",
  },
  userName: {
    fontSize: "13px",
    fontWeight: "600",
    color: "hsl(var(--text-primary))",
    maxWidth: "120px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  selectorGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  select: {
    padding: "8px 16px",
    minWidth: "200px",
    cursor: "pointer",
    background: "rgba(15, 23, 42, 0.8)",
  },
  btnSmall: {
    padding: "8px 16px",
    fontSize: "13px",
  },
  formInline: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  inputInline: {
    padding: "8px 16px",
    fontSize: "14px",
    width: "180px",
  },
  btnSmallInline: {
    padding: "8px 16px",
    fontSize: "13px",
  }
};
