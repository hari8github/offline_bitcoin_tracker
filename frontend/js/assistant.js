/* assistant.js — chat UI backed by the LangGraph agent endpoint.
   Every message goes to POST /assistant/chat — the backend handles
   intent routing (fast-path regex → LLM fallback), tool execution,
   and reply formatting.  The frontend only renders. */

const Assistant = (() => {

  // ── Send message ──────────────────────────────────────────

  async function send() {
    const input = document.getElementById('chat-input');
    const text  = input?.value?.trim();
    if (!text) return;
    input.value = '';
    _appendUserMsg(text);

    // Special client-side shortcut: "help" doesn't need a server call
    if (/^\s*help\s*$/i.test(text)) { _cmdHelp(); return; }

    _appendThinking();
    try {
      const data = await API.assistantChat(text, State.getCase());
      _removeThinking();

      // Render the reply text
      _appendText(data.reply);

      // If the agent called a tool, render structured result cards
      if (data.tool && data.data) {
        _renderToolResult(data.tool, data.data);
      }
    } catch (e) {
      _removeThinking();
      _appendError(e.message);
    }
  }

  // ── Render tool-specific result cards ──────────────────────

  function _renderToolResult(tool, data) {
    switch (tool) {
      case 'explain_alert':
        if (data.found && data.alerts?.length) {
          _appendAlertCards(
            data.alerts.map(a => ({
              txid: data.txid,
              type: a.type,
              confidence: a.confidence,
              evidence: a.evidence,
            })),
            'Alert Explanation'
          );
        }
        break;

      case 'list_patterns':
        if (data.results?.length) {
          _appendAlertCards(
            data.results.map(r => ({
              txid: r.txid,
              type: r.type,
              confidence: r.confidence,
            })),
            `${data.pattern_type === 'all' ? 'All' : data.pattern_type} Patterns`
          );
        }
        break;

      case 'get_subgraph':
        if (data.center) {
          _appendCard('Subgraph', [
            ['Center',     data.center],
            ['Hops',       data.hops],
            ['Nodes',      data.node_count],
          ]);
          // Offer to open in the graph canvas
          const wrapper = document.createElement('div');
          wrapper.className = 'chat-msg';
          wrapper.innerHTML = `
            <div style="padding-left:38px">
              <button class="btn-open-graph" onclick="Graph.centerOn('${esc(data.center)}','Transaction')">→ Open in Graph</button>
            </div>`;
          _feed().appendChild(wrapper);
          _scroll();
        }
        break;

      case 'search_entity':
        if (data.found) {
          const kinds = Object.entries(data.matched_as || {}).filter(([, v]) => v).map(([k]) => k);
          _appendCard('Search Result', [
            ['Query',      data.query],
            ['Matched as', kinds.join(', ') || '—'],
          ]);
          const wrapper = document.createElement('div');
          wrapper.className = 'chat-msg';
          wrapper.innerHTML = `
            <div style="padding-left:38px">
              <button class="btn-open-graph" onclick="Graph.centerOn('${esc(data.query)}','Transaction')">→ Open in Graph</button>
            </div>`;
          _feed().appendChild(wrapper);
          _scroll();
        }
        break;
    }
  }

  // ── Help (client-side only) ───────────────────────────────

  function _cmdHelp() {
    _appendSystemMsg([
      'Available commands:',
      '• "show peeling chains" — list peeling-chain alerts',
      '• "show coinjoin alerts" — list CoinJoin alerts',
      '• "show all patterns" — list all alerts',
      '• "why is tx_csv_0040 flagged" — explain a specific alert',
      '• "search for tx_csv_0040" — search by txid/address/IP',
      '• "show graph for tx_csv_0040" — load a subgraph',
      '• "expand 2 hops from tx_csv_0040" — multi-hop subgraph',
      '',
      'Or ask anything in natural language — the LLM will try to route it.',
    ].join('\n'));
  }

  // ── Render helpers ────────────────────────────────────────

  function _appendUserMsg(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg user';
    el.innerHTML = `
      <div class="chat-avatar">You</div>
      <div class="chat-bubble">${esc(text)}</div>
    `;
    _feed().appendChild(el);
    _scroll();
  }

  function _appendText(md) {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = `
      <div class="chat-avatar">₿</div>
      <div class="chat-bubble">${_md(md)}</div>
    `;
    _feed().appendChild(el);
    _scroll();
  }

  function _appendSystemMsg(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg system';
    el.innerHTML = `
      <div class="chat-bubble" style="color:var(--text-muted);font-style:italic">${esc(text).replace(/\n/g, '<br>')}</div>
    `;
    _feed().appendChild(el);
    _scroll();
  }

  function _appendError(msg) {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = `
      <div class="chat-avatar" style="background:var(--risk-high)">!</div>
      <div class="chat-bubble" style="color:var(--risk-high)">${esc(msg)}</div>
    `;
    _feed().appendChild(el);
    _scroll();
  }

  function _appendThinking() {
    const el = document.createElement('div');
    el.className = 'chat-msg'; el.id = 'thinking-msg';
    el.innerHTML = `<div class="chat-avatar">₿</div><div class="chat-bubble text-muted" style="font-style:italic">Thinking…</div>`;
    _feed().appendChild(el);
    _scroll();
  }

  function _removeThinking() {
    document.getElementById('thinking-msg')?.remove();
  }

  function _appendAlertCards(alerts, title) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-msg';
    const card = document.createElement('div');
    card.style.cssText = 'width:100%';
    card.innerHTML = `
      <div class="reply-card">
        <div class="reply-card-header">
          <span>${esc(title)}</span>
          <span style="color:var(--text-muted)">${alerts.length} result(s)</span>
        </div>
        <div class="reply-card-body">
          ${alerts.map(a => {
            const conf = ((a.confidence || 0) * 100).toFixed(0);
            const typeLabel = { coinjoin_like: 'CoinJoin', peeling_chain: 'Peeling' }[a.type] || a.type;
            return `<div class="reply-result-row">
              <div>
                <span class="mono-id">${esc((a.txid || '').substring(0, 16))}…</span>
                <span class="pill pill-blue" style="margin-left:6px">${esc(typeLabel)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:700;font-size:12px">${conf}%</span>
                <button class="btn-open-graph" onclick="Graph.centerOn('${esc(a.txid)}','Transaction')">→ Graph</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
    wrapper.appendChild(card);
    _feed().appendChild(wrapper);
    _scroll();
  }

  function _appendCard(title, rows) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-msg';
    wrapper.innerHTML = `
      <div class="chat-avatar">₿</div>
      <div style="width:100%">
        <div class="reply-card">
          <div class="reply-card-header"><span>${esc(title)}</span></div>
          <div class="reply-card-body">
            ${rows.map(([k, v]) => `
              <div class="reply-result-row">
                <span class="text-muted" style="font-size:11px">${esc(k)}</span>
                <span style="font-weight:600;font-size:12px">${esc(String(v))}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
    `;
    _feed().appendChild(wrapper);
    _scroll();
  }

  function _feed()   { return document.getElementById('chat-messages'); }
  function _scroll() { const f = _feed(); if (f) f.scrollTop = f.scrollHeight; }

  function _md(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function esc(v) {
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function handleKey(e) { if (e.key === 'Enter') send(); }

  return { send, handleKey };
})();
