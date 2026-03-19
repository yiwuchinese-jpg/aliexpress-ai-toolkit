// 核心状态管理
let rawPool = JSON.parse(localStorage.getItem('KEYWORDS_POOL')) || [];
let KEYWORDS_POOL = rawPool.map(item => typeof item === 'string' ? {word: item, traffic: 0} : item);
let USED_KEYWORDS = new Set(JSON.parse(localStorage.getItem('USED_KEYWORDS')) || []);

let sortCol = 'traffic';
let sortDesc = true;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    updateStats();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('csv-upload').addEventListener('change', handleCSVUpload);
    document.getElementById('generate-btn').addEventListener('click', generateTitles);
    document.getElementById('toggle-browser-btn').addEventListener('click', toggleBrowser);
    document.getElementById('browser-search').addEventListener('input', renderBrowser);
    
    // 排序监听
    document.getElementById('sort-index').onclick = () => sortBrowser('index');
    document.getElementById('sort-word').onclick = () => sortBrowser('word');
    document.getElementById('sort-traffic').onclick = () => sortBrowser('traffic');
}

// 切换浏览器
function toggleBrowser() {
    const container = document.getElementById('browser-container');
    const isVisible = container.style.display === 'flex';
    container.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) renderBrowser();
}

// CSV 解析
function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        const newPool = [];
        const seen = new Set();
        
        const parseTraffic = (val) => {
            if (!val) return 0;
            const clean = val.replace(/,/g, '').replace(/%/g, '').trim();
            const num = parseFloat(clean);
            return isNaN(num) ? 0 : Math.floor(num);
        };

        lines.forEach((line, index) => {
            if (index === 0) return;
            const cells = [];
            let current = '', inQuotes = false;
            for (let char of line) {
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { cells.push(current.trim()); current = ''; }
                else current += char;
            }
            cells.push(current.trim());
            
            const word = cells[0] || '';
            if (word.length <= 1) return;

            let traffic = 0;
            [3, 6, 12, 15].forEach(idx => {
                const t = parseTraffic(cells[idx]);
                if (t > traffic) traffic = t;
            });

            if (!seen.has(word.toLowerCase())) {
                newPool.push({ word, traffic });
                seen.add(word.toLowerCase());
            }

            const altWord = cells[1] || '';
            if (altWord.length > 2 && !seen.has(altWord.toLowerCase()) && isNaN(altWord)) {
                newPool.push({ word: altWord, traffic: Math.floor(traffic * 0.7) });
                seen.add(altWord.toLowerCase());
            }
        });

        if (newPool.length === 0) { alert('未检测到有效关键词'); return; }

        KEYWORDS_POOL = newPool;
        localStorage.setItem('KEYWORDS_POOL', JSON.stringify(KEYWORDS_POOL));
        USED_KEYWORDS.clear();
        localStorage.setItem('USED_KEYWORDS', JSON.stringify([]));
        
        updateStats();
        sortCol = 'traffic'; sortDesc = true;
        renderBrowser();
        alert(`成功导入 ${KEYWORDS_POOL.length} 个关键词！`);
    };
    reader.readAsText(file);
}

function updateStats() {
    const total = KEYWORDS_POOL.length;
    const used = USED_KEYWORDS.size;
    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-used').innerText = used;
    document.getElementById('stat-rem').innerText = total - used;
}

function renderBrowser() {
    const tbody = document.getElementById('browser-body');
    if (!tbody) return;
    const searchTerm = document.getElementById('browser-search').value.toLowerCase();
    
    let displayData = KEYWORDS_POOL.filter(item => item.word.toLowerCase().includes(searchTerm));
    displayData.sort((a, b) => {
        let valA = a[sortCol], valB = b[sortCol];
        if (sortCol === 'word') return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        return sortDesc ? valB - valA : valA - valB;
    });

    tbody.innerHTML = displayData.map((item, idx) => {
        const isUsed = USED_KEYWORDS.has(item.word.toLowerCase());
        return `<tr style="${isUsed ? 'opacity:0.5; background:rgba(0,0,0,0.2)' : ''}">
            <td>${idx + 1}</td>
            <td style="font-weight:600">${item.word}</td>
            <td style="color: var(--primary)">${item.traffic.toLocaleString()}</td>
            <td><span class="keyword-tag" style="background:${isUsed ? 'var(--border)' : 'var(--primary)'}">${isUsed ? '已用' : '待用'}</span></td>
        </tr>`;
    }).join('');
}

function sortBrowser(col) {
    if (sortCol === col) sortDesc = !sortDesc;
    else { sortCol = col; sortDesc = true; }
    renderBrowser();
}

window.resetKeywords = () => {
    if (confirm('重置所有使用记录？')) {
        USED_KEYWORDS.clear();
        localStorage.setItem('USED_KEYWORDS', JSON.stringify([]));
        updateStats();
        renderBrowser();
    }
};

async function generateTitles() {
    if (KEYWORDS_POOL.length === 0) { alert('请先导入词库！'); return; }
    const input = document.getElementById('prompt-input').value.trim();
    if (!input) { alert('请输入关键词或描述'); return; }

    const loader = document.getElementById('loader');
    loader.style.display = 'flex';
    
    try {
        const res = await callAI(input);
        renderTags('res-cores', res.cores || []);
        renderTags('res-scenes', res.scenes || []);
        renderTags('res-attrs', res.attrs || []);

        const list = document.getElementById('title-list');
        list.innerHTML = '';
        (res.titles || []).forEach(t => {
            const card = document.createElement('div');
            card.className = 'title-card';
            card.innerHTML = `
                <div class="title-text">${t}</div>
                <div style="display:flex; justify-content:space-between; align-items:center">
                    <span style="font-size:0.75rem; color:${t.length > 128 ? 'var(--danger)' : 'var(--text-muted)'}">${t.length}/128</span>
                    <button class="btn" style="width:80px; padding:5px; font-size:0.75rem; background:var(--primary)" onclick="copyTitle(this, '${t.replace(/'/g, "\\'")}')">📋 复制</button>
                </div>
            `;
            list.appendChild(card);
        });
        document.getElementById('count-status').innerText = `${res.titles.length} titles generated`;
    } catch (e) {
        alert('生成失败: ' + e.message);
    } finally {
        loader.style.display = 'none';
    }
}

async function callAI(prompt) {
    const model = document.getElementById('api-model').value;

    const available = KEYWORDS_POOL.filter(i => !USED_KEYWORDS.has(i.word.toLowerCase())).sort((a,b) => b.traffic - a.traffic);
    const pool = available.slice(0, 500).map(i => i.word).join(', ');

    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt,
            pool
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
    }

    const data = await response.json();
    let content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error(data?.message || data?.error || 'AI 返回为空');
    }
    return JSON.parse(content.replace(/```json|```/g, ''));
}

function renderTags(id, words) {
    document.getElementById(id).innerHTML = words.map(w => `<span class="keyword-tag">${w}</span>`).join('');
}

window.copyTitle = (btn, txt) => {
    navigator.clipboard.writeText(txt).then(() => {
        btn.innerText = '✅ 已收录';
        const lower = txt.toLowerCase();
        KEYWORDS_POOL.forEach(item => {
            if (lower.includes(item.word.toLowerCase())) USED_KEYWORDS.add(item.word.toLowerCase());
        });
        localStorage.setItem('USED_KEYWORDS', JSON.stringify(Array.from(USED_KEYWORDS)));
        updateStats();
        setTimeout(() => btn.innerText = '📋 复制', 2000);
    });
};
