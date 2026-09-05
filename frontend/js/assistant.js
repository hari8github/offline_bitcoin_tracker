/* assistant.js — persistent chat drawer: send/receive, typing
   indicator, example chips, open/close/force-close controls. */

const Chat = (() => {
  function toggle() {
    State.isChatOpen() ? close() : open();
  }
  function open() {
    document.getElementById('chat-drawer').classList.add('open');
    document.getElementById('chat-fab').classList.add('hidden');
    document.getElementById('topbar-chat-toggle').classList.add('active');
    document.getElementById('content').classList.add('chat-open');
    State.setChatOpen(true);
  }
  function close() {
    document.getElementById('chat-drawer').classList.remove('open');
    document.getElementById('chat-fab').classList.remove('hidden');
    document.getElementById('topbar-chat-toggle').classList.remove('active');
    document.getElementById('content').classList.remove('chat-open');
    State.setChatOpen(false);
  }
  // Called by Graph when an evidence panel opens — evidence takes
  // priority over the chat drawer per the layout spec.
  function forceClose() {
    if (State.isChatOpen()) close();
  }
  function sendExample(btn) {
    const input = document.getElementById('chat-input');
    input.value = btn.textContent;
    Assistant.send();
  }
  return { toggle, open, close, forceClose, sendExample };
})();

const Assistant = (() => {

  async function send() {
    const input = document.getElementById('chat-input');
    const text  = input?.value?.trim();
    if (!text) return;
    input.value = '';
    _hideExampleChips();
    _appendUserMsg(text);

    if (/^\s*help\s*$/i.test(text)) { _cmdHelp(); return; }

    _appendTyping();
    try {
      const data = await API.assistantChat(text, State.getCase());
      _removeTyping();
      _appendText(data.reply);
      if (data.tool && data.data) {
        _renderToolResult(data.tool, data.data);
      }
    } catch (e) {
      _removeTyping();
      _appendError(e.message);
    }
  }

  function _renderToolResult(tool, data) {
    switch (tool) {
      case 'explain_alert':
        if (data.found && data.alerts?.length) {
          _appendAlertCards(
            data.alerts.map(a => ({ txid: data.txid, type: a.type, confidence: a.confidence, evidence: a.evidence })),
            'Alert Explanation'
          );
        }
        break;

      case 'list_patterns':
        if (data.results?.length) {
          _appendAlertCards(
            data.results.map(r => ({ txid: r.txid, type: r.type, confidence: r.confidence })),
            `${data.pattern_type === 'all' ? 'All' : data.pattern_type} Patterns`
          );
        }
        break;

      case 'get_subgraph':
        if (data.center) {
          _appendCard('Subgraph', [
            ['Center', data.center],
            ['Hops',   data.hops],
            ['Nodes',  data.node_count],
          ]);
          _appendOpenGraphBtn(data.center);
        }
        break;

      case 'search_entity':
        if (data.found) {
          const kinds = Object.entries(data.matched_as || {}).filter(([, v]) => v).map(([k]) => k);
          _appendCard('Search Result', [
            ['Query',      data.query],
            ['Matched as', kinds.join(', ') || '—'],
          ]);
          _appendOpenGraphBtn(data.query);
        }
        break;
    }
  }

  function _appendOpenGraphBtn(id) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-msg';
    wrapper.innerHTML = `<div><button class="btn-open-graph" onclick="Graph.centerOn('${esc(id)}','Transaction')">→ Open in Graph</button></div>`;
    _feed().appendChild(wrapper);
    _scroll();
  }

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

  function _appendUserMsg(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg user';
    el.innerHTML = `<div class="chat-avatar">You</div><div class="chat-bubble">${esc(text)}</div>`;
    _feed().appendChild(el);
    _scroll();
  }

  function _appendText(md) {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = `<div class="chat-avatar">₿</div><div class="chat-bubble">${_md(md)}</div>`;
    _feed().appendChild(el);
    _scroll();
  }

  function _appendSystemMsg(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg system';
    el.innerHTML = `<div class="chat-bubble">${esc(text).replace(/\n/g, '<br>')}</div>`;
    _feed().appendChild(el);
    _scroll();
  }

  function _appendError(msg) {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = `<div class="chat-avatar" style="background:var(--risk-high)">!</div><div class="chat-bubble" style="color:var(--risk-high)">${esc(msg)}</div>`;
    _feed().appendChild(el);
    _scroll();
  }

  function _appendTyping() {
    const el = document.createElement('div');
    el.className = 'chat-msg'; el.id = 'typing-msg';
    el.innerHTML = `<div class="chat-avatar">₿</div><div class="chat-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>`;
    _feed().appendChild(el);
    _scroll();
  }

  function _removeTyping() {
    document.getElementById('typing-msg')?.remove();
  }

  function _hideExampleChips() {
    document.getElementById('chat-example-chips')?.classList.add('hidden');
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