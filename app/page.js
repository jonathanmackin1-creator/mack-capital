"use client";

import { useState, useRef, useEffect } from "react";
import { AGENTS, AGENT_ORDER, parseRoute, cleanOrchestrator } from "./agents";

function AgentBadge({ agent, active, done }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "6px",
      padding: "4px 10px", borderRadius: "2px",
      border: `1px solid ${active || done ? agent.color : "#444"}`,
      background: active ? `${agent.color}18` : "transparent",
      transition: "all 0.3s",
      opacity: done ? 0.6 : 1
    }}>
      <span style={{ color: agent.color, fontSize: "12px" }}>{agent.icon}</span>
      <span style={{ color: active || done ? agent.color : "#999", fontSize: "10px", letterSpacing: "1.5px", fontFamily: "monospace" }}>
        {agent.name}
      </span>
      {active && <span style={{ color: agent.color, fontSize: "10px", animation: "pulse 1s infinite" }}>●</span>}
      {done && <span style={{ color: agent.color, fontSize: "10px" }}>✓</span>}
    </div>
  );
}

function MessageBlock({ msg }) {
  const agent = AGENTS[msg.agentId];
  const isUser = msg.role === "user";
  return (
    <div style={{
      marginBottom: "24px",
      borderLeft: isUser ? "none" : `2px solid ${agent?.color || "#00BFFF"}`,
      paddingLeft: isUser ? "0" : "16px",
    }}>
      {!isUser && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span style={{ color: agent?.color, fontSize: "18px" }}>{agent?.icon}</span>
          <span style={{ color: agent?.color, fontSize: "13px", letterSpacing: "2px", fontFamily: "monospace" }}>{agent?.name}</span>
          <span style={{ color: "#777", fontSize: "12px", fontFamily: "monospace" }}>— {agent?.role}</span>
        </div>
      )}
      {isUser && (
        <div style={{ marginBottom: "6px" }}>
          <span style={{ color: "#777", fontSize: "10px", letterSpacing: "2px", fontFamily: "monospace" }}>YOU</span>
        </div>
      )}
      <div style={{
        color: isUser ? "#bbb" : "#ccc",
        fontSize: "17px",
        lineHeight: "1.8",
        fontFamily: "'Georgia', serif",
        whiteSpace: "pre-wrap"
      }}>
        {msg.content}
      </div>
    </div>
  );
}

async function callAgent(agentId, userMessage) {
  const agent = AGENTS[agentId];
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: agent.systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    })
  });
  const data = await response.json();
  return data.content?.[0]?.text || "No response.";
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAgents, setActiveAgents] = useState([]);
  const [doneAgents, setDoneAgents] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const bottomRef = useRef(null);

  function toggleAgent(id) {
    setSelectedAgents(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function saveConversation() {
    if (messages.length === 0) return;
    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });
    alert("Conversation saved!");
  }

  async function loadHistory() {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    setHistory(data.conversations || []);
    setShowHistory(true);
  }

  async function loadConversation(id) {
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    setMessages(data.messages || []);
    setShowHistory(false);
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setLoading(true);
    setActiveAgents([]);
    setDoneAgents([]);

    setMessages(prev => [...prev, { role: "user", agentId: "user", content: userMsg }]);

    setActiveAgents(["orchestrator"]);
    const orchResponse = await callAgent("orchestrator", userMsg);
    const route = parseRoute(orchResponse);
    const cleanedOrch = cleanOrchestrator(orchResponse);

    setMessages(prev => [...prev, { role: "assistant", agentId: "orchestrator", content: cleanedOrch }]);
    setDoneAgents(["orchestrator"]);
    setActiveAgents([]);

    const relevantAgents = selectedAgents.length > 0
      ? selectedAgents.filter(id => AGENT_ORDER.includes(id))
      : route.filter(id => AGENT_ORDER.includes(id));
    setActiveAgents(relevantAgents);

    const specialistResults = await Promise.all(
      relevantAgents.map(async (agentId) => {
        const response = await callAgent(agentId, userMsg);
        return { agentId, content: response };
      })
    );

    setActiveAgents([]);
    setDoneAgents(prev => [...prev, ...relevantAgents]);
    specialistResults.forEach(({ agentId, content }) => {
      setMessages(prev => [...prev, { role: "assistant", agentId, content }]);
    });

    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const allAgentIds = ["orchestrator", ...AGENT_ORDER];

  return (
    <div style={{
      minHeight: "100vh", background: "#2c3f63", color: "#ccc",
      fontFamily: "monospace", display: "flex", flexDirection: "column"
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        textarea:focus { outline: none; }
        textarea { resize: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1e1e1e", padding: "20px 32px",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start"
      }}>
        <div>
          <div style={{ color: "#00BFFF", fontSize: "22px", letterSpacing: "4px", marginBottom: "4px" }}>MACK ATTACK</div>
          <div style={{ color: "#aaa", fontSize: "13px", letterSpacing: "2px", marginBottom: "10px" }}>MULTI-AGENT INTELLIGENCE NETWORK</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={saveConversation} style={{
              background: "transparent", border: "1px solid #444", color: "#aaa",
              padding: "4px 12px", fontSize: "10px", letterSpacing: "1.5px",
              cursor: "pointer", borderRadius: "2px", fontFamily: "monospace", transition: "all 0.2s"
            }}
            onMouseEnter={e => { e.target.style.borderColor = "#00BFFF"; e.target.style.color = "#00BFFF"; }}
            onMouseLeave={e => { e.target.style.borderColor = "#444"; e.target.style.color = "#aaa"; }}
            >SAVE</button>
            <button onClick={loadHistory} style={{
              background: "transparent", border: "1px solid #444", color: "#aaa",
              padding: "4px 12px", fontSize: "10px", letterSpacing: "1.5px",
              cursor: "pointer", borderRadius: "2px", fontFamily: "monospace", transition: "all 0.2s"
            }}
            onMouseEnter={e => { e.target.style.borderColor = "#00BFFF"; e.target.style.color = "#00BFFF"; }}
            onMouseLeave={e => { e.target.style.borderColor = "#444"; e.target.style.color = "#aaa"; }}
            >HISTORY</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {allAgentIds.map(id => (
            <AgentBadge key={id} agent={AGENTS[id]} active={activeAgents.includes(id)} done={doneAgents.includes(id)} />
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px", maxWidth: "860px", width: "100%", margin: "0 auto" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: "80px", animation: "fadeIn 0.8s ease" }}>
            <div style={{ color: "#00BFFF", fontSize: "64px", marginBottom: "16px" }}>⬡</div>
            <div style={{ color: "#aaa", fontSize: "14px", letterSpacing: "3px", marginBottom: "32px" }}>NETWORK ONLINE</div>
            <div style={{ color: "#ddd", fontSize: "15px", lineHeight: "2", maxWidth: "480px", margin: "0 auto" }}>
              Ask anything about apps, futures trading, or real estate. The Orchestrator routes your query to the right specialists.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ animation: "fadeIn 0.4s ease" }}>
            <MessageBlock msg={msg} />
          </div>
        ))}

        {loading && activeAgents.length > 0 && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "16px" }}>
            <span style={{ color: "#aaa", fontSize: "11px", letterSpacing: "1px" }}>ROUTING TO</span>
            {activeAgents.map(id => (
              <span key={id} style={{ color: AGENTS[id]?.color, fontSize: "11px", letterSpacing: "1px" }}>
                {AGENTS[id]?.name}
              </span>
            ))}
            <span style={{ color: "#00BFFF", animation: "pulse 1s infinite" }}>●●●</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* History Panel */}
      {showHistory && (
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "320px",
          background: "#0d0d1a", borderLeft: "1px solid #222",
          padding: "24px", overflowY: "auto", zIndex: 100
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <span style={{ color: "#00BFFF", fontSize: "11px", letterSpacing: "2px" }}>HISTORY</span>
            <button onClick={() => setShowHistory(false)} style={{
              background: "transparent", border: "none", color: "#666",
              fontSize: "18px", cursor: "pointer"
            }}>×</button>
          </div>
          {history.length === 0 ? (
            <div style={{ color: "#444", fontSize: "12px" }}>No saved conversations.</div>
          ) : (
            history.map(c => (
              <div key={c.id} onClick={() => loadConversation(c.id)} style={{
                padding: "12px", marginBottom: "8px", border: "1px solid #222",
                borderRadius: "2px", cursor: "pointer", transition: "all 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#00BFFF"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#222"}
              >
                <div style={{ color: "#bbb", fontSize: "12px", marginBottom: "4px" }}>{c.title}</div>
                <div style={{ color: "#444", fontSize: "10px" }}>{new Date(c.date).toLocaleDateString()}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Input */}
      <div style={{ borderTop: "1px solid #1a1a1a", padding: "20px 32px", maxWidth: "860px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {/* Agent selector */}
        <div style={{ marginBottom: "12px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#bbb", fontSize: "10px", letterSpacing: "1.5px", fontFamily: "monospace" }}>FORCE AGENTS:</span>
          {AGENT_ORDER.map(id => {
            const agent = AGENTS[id];
            const checked = selectedAgents.includes(id);
            return (
              <label key={id} onClick={() => toggleAgent(id)} style={{
                display: "flex", alignItems: "center", gap: "5px",
                cursor: "pointer", padding: "3px 10px", borderRadius: "2px",
                border: `1px solid ${checked ? agent.color : "#333"}`,
                background: checked ? `${agent.color}18` : "transparent",
                transition: "all 0.2s"
              }}>
                <span style={{
                  width: "10px", height: "10px", borderRadius: "2px", display: "inline-block",
                  border: `1px solid ${checked ? agent.color : "#555"}`,
                  background: checked ? agent.color : "transparent",
                  flexShrink: 0, transition: "all 0.2s"
                }} />
                <span style={{ color: agent.color, fontSize: "12px" }}>{agent.icon}</span>
                <span style={{ color: checked ? agent.color : "#bbb", fontSize: "10px", letterSpacing: "1px", fontFamily: "monospace" }}>
                  {agent.name}
                </span>
              </label>
            );
          })}
          {selectedAgents.length > 0 && (
            <button onClick={() => setSelectedAgents([])} style={{
              background: "transparent", border: "1px solid #444", color: "#888",
              padding: "3px 8px", fontSize: "10px", letterSpacing: "1px",
              cursor: "pointer", borderRadius: "2px", fontFamily: "monospace"
            }}>CLEAR</button>
          )}
          {selectedAgents.length === 0 && (
            <span style={{ color: "#aaa", fontSize: "10px", fontFamily: "monospace", fontStyle: "italic" }}>No Selection = Orchestrator Decides</span>
          )}
        </div>

        <div style={{
          display: "flex", gap: "12px", alignItems: "flex-end",
          border: "1px solid #1e1e1e", borderRadius: "2px",
          padding: "12px 16px", background: "#0d0d1a"
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Deploy a query to the network..."
            rows={5}
            style={{
              flex: 1, background: "transparent", border: "none",
              color: "#ccc", fontSize: "15px", fontFamily: "'Georgia', serif",
              lineHeight: "1.6"
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? "transparent" : "#00BFFF",
              border: `1px solid ${loading || !input.trim() ? "#333" : "#00BFFF"}`,
              color: loading || !input.trim() ? "#444" : "#0a0a0a",
              padding: "8px 18px", fontSize: "10px", letterSpacing: "2px",
              cursor: loading || !input.trim() ? "default" : "pointer",
              borderRadius: "2px", fontFamily: "monospace", transition: "all 0.2s"
            }}
          >
            {loading ? "ROUTING..." : "DEPLOY ↑"}
          </button>
        </div>
        <div style={{ marginTop: "8px", color: "#999", fontSize: "10px", letterSpacing: "1px" }}>
          SHIFT+ENTER for new line · ENTER to send
        </div>
      </div>
    </div>
  );
}