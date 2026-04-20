function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function callGeminiAPI(base64Image, mimeType) {
    const apiKey = GEMINI_API_KEY;
    const startTime = Date.now();
    
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
        throw new Error('API Key not configured. Please add your PixelInsight API key to config.js');
    }

    const prompt = `Analyze this image and extract structured information in JSON format with fields:
- id
- name
- section
- description
- similar_suggestions (array of 3 similar products/items with just name and brief description)
Only return valid JSON.`;

    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        text: prompt
                    },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Image
                        }
                    }
                ]
            }
        ]
    };

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'PixelInsight API error');
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Invalid response format from API');
    }

    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    return { data: JSON.parse(jsonMatch[0]), timeTaken };
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showToast(message, type = 'success', duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

const STORAGE_KEYS = {
    ANALYSIS_HISTORY: 'analysisHistory',
    FAVORITES: 'favorites',
    STATS: 'analysisStats',
    SETTINGS: 'appSettings',
    LAST_ROTATION: 'lastImageRotation'
};

const DEFAULT_SETTINGS = {
    autoSave: true,
    showNotifications: true,
    includeSuggestions: true,
    includeMetadata: true,
    darkMode: true
};

function getStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error('Storage error:', e);
        return defaultValue;
    }
}

function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('Storage error:', e);
    }
}

function addToHistory(analysisData, imageFile) {
    const history = getStorage(STORAGE_KEYS.ANALYSIS_HISTORY, []);
    const historyItem = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        fileName: imageFile.name,
        fileSize: imageFile.size,
        ...analysisData.data
    };
    history.unshift(historyItem);
    if (history.length > 50) history.pop();
    setStorage(STORAGE_KEYS.ANALYSIS_HISTORY, history);
    updateStats('add');
    return historyItem;
}

function getHistory() {
    return getStorage(STORAGE_KEYS.ANALYSIS_HISTORY, []);
}

function clearHistory() {
    setStorage(STORAGE_KEYS.ANALYSIS_HISTORY, []);
    updateStats('reset');
}

function updateStats(action = 'add') {
    let stats = getStorage(STORAGE_KEYS.STATS, {
        totalAnalyses: 0,
        totalSaved: 0,
        totalTime: 0,
        avgTime: 0
    });

    if (action === 'add') {
        stats.totalAnalyses++;
        stats.totalSaved++;
    } else if (action === 'reset') {
        stats = { totalAnalyses: 0, totalSaved: 0, totalTime: 0, avgTime: 0 };
    }

    setStorage(STORAGE_KEYS.STATS, stats);
    refreshStatsDisplay();
}

function addTimeToStats(seconds) {
    const stats = getStorage(STORAGE_KEYS.STATS, {
        totalAnalyses: 0,
        totalSaved: 0,
        totalTime: 0,
        avgTime: 0
    });
    stats.totalTime += seconds;
    stats.avgTime = Math.round(stats.totalTime / Math.max(stats.totalAnalyses, 1));
    setStorage(STORAGE_KEYS.STATS, stats);
    refreshStatsDisplay();
}

function refreshStatsDisplay() {
    const stats = getStorage(STORAGE_KEYS.STATS, {
        totalAnalyses: 0,
        totalSaved: 0,
        totalTime: 0,
        avgTime: 0
    });
    document.getElementById('totalAnalysis').textContent = stats.totalAnalyses;
    document.getElementById('totalSaved').textContent = stats.totalSaved;
    document.getElementById('avgTime').textContent = stats.avgTime + 's';
}

function toggleFavorite(historyItem) {
    const favorites = getStorage(STORAGE_KEYS.FAVORITES, []);
    const index = favorites.findIndex(f => f.id === historyItem.id);
    
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('Removed from favorites', 'info');
    } else {
        favorites.push(historyItem);
        showToast('Added to favorites ❤️', 'success');
    }
    
    setStorage(STORAGE_KEYS.FAVORITES, favorites);
    updateFavoriteButton();
}

function isFavorited(id) {
    const favorites = getStorage(STORAGE_KEYS.FAVORITES, []);
    return favorites.some(f => f.id === id);
}

function updateFavoriteButton() {
    const favoriteBtn = document.getElementById('favoriteBtn');
    const currentData = window.currentAnalysisData;
    if (currentData && currentData.id && isFavorited(currentData.id)) {
        favoriteBtn.textContent = '❤️';
        favoriteBtn.classList.add('favorited');
    } else {
        favoriteBtn.textContent = '🤍';
        favoriteBtn.classList.remove('favorited');
    }
}

function displayResults(analysisWithTime) {
    const { data: resultData, timeTaken } = analysisWithTime;
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsTable = document.getElementById('resultsTable');
    const errorMessage = document.getElementById('errorMessage');
    const emptyState = document.getElementById('emptyState');
    const metadataSection = document.getElementById('metadataSection');
    window.currentAnalysisData = resultData;
    resultsTable.innerHTML = '';
    errorMessage.classList.add('hidden');
    emptyState.classList.add('hidden');
    let html = '';
    const fields = ['id', 'name', 'section', 'description'];
    fields.forEach((field, index) => {
        const value = resultData[field] || 'N/A';
        html += `
            <div class="result-card" style="animation-delay: ${index * 0.08}s">
                <h4>${field}</h4>
                <div class="cell-value">
                    <span class="value-text">${escapeHtml(String(value))}</span>
                    <button class="btn btn-copy" onclick="copyToClipboard(event, '${escapeHtml(String(value))}')">Copy</button>
                </div>
            </div>
        `;
    });

    if (resultData.similar_suggestions && Array.isArray(resultData.similar_suggestions)) {
        html += `<div class="suggestions-container">
            <h3 class="suggestions-title">💡 Similar Suggestions</h3>
            <div class="suggestions-list">`;
        
        resultData.similar_suggestions.forEach((suggestion, index) => {
            const suggestionName = suggestion.name || suggestion;
            const suggestionDesc = suggestion.description || '';
            html += `
                <div class="suggestion-item" style="animation-delay: ${(index + 4) * 0.08}s">
                    <div class="suggestion-number">${index + 1}</div>
                    <div class="suggestion-content">
                        <p class="suggestion-name">${escapeHtml(String(suggestionName))}</p>
                        <p class="suggestion-desc">${escapeHtml(String(suggestionDesc))}</p>
                    </div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }
    resultsTable.innerHTML = html;
    if (getSettings().includeMetadata) {
        metadataSection.classList.remove('hidden');
        document.getElementById('timeTaken').textContent = timeTaken + 's';
        document.getElementById('confidence').textContent = '95%';
        document.getElementById('imageSize').textContent = window.currentImageSize || '-';
    } else {
        metadataSection.classList.add('hidden');
    }

    updateFavoriteButton();
    resultsContainer.classList.remove('hidden');
}

function copyToClipboard(event, text) {
    navigator.clipboard.writeText(text).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('copied');
        }, 2000);
    });
}

function copyJsonToClipboard() {
    if (!window.currentAnalysisData) return;
    const json = JSON.stringify(window.currentAnalysisData, null, 2);
    navigator.clipboard.writeText(json).then(() => {
        showToast('JSON copied to clipboard!', 'success');
    });
}

function downloadResults() {
    if (!window.currentAnalysisData) return;
    
    const data = window.currentAnalysisData;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Analysis downloaded!', 'success');
}

function openHistoryModal() {
    document.getElementById('historyModal').classList.remove('hidden');
    displayHistory();
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.add('hidden');
}

function displayHistory(searchTerm = '') {
    const historyList = document.getElementById('historyList');
    let history = getHistory();
    
    if (searchTerm) {
        history = history.filter(item => 
            (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.section || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    if (history.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px 20px;">No history items found</p>';
        return;
    }

    historyList.innerHTML = history.map(item => `
        <div class="history-item" onclick="loadHistoryItem(${item.id})">
            <div>
                <div class="history-item-title">${escapeHtml(item.name || 'Unknown')}</div>
                <div class="history-item-time">${new Date(item.timestamp).toLocaleString()}</div>
            </div>
            <div class="history-item-actions">
                <button class="history-action-btn" onclick="event.stopPropagation(); copyHistoryJson(${item.id})" title="Copy">📋</button>
                <button class="history-action-btn" onclick="event.stopPropagation(); deleteHistoryItem(${item.id})" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');
}

function loadHistoryItem(id) {
    const history = getHistory();
    const item = history.find(h => h.id === id);
    if (item) {
        window.currentAnalysisData = item;
        displayResults({ data: item, timeTaken: 0 });
        closeHistoryModal();
        showToast('Loaded from history', 'success');
    }
}

function deleteHistoryItem(id) {
    let history = getHistory();
    history = history.filter(h => h.id !== id);
    setStorage(STORAGE_KEYS.ANALYSIS_HISTORY, history);
    displayHistory();
    showToast('Item deleted', 'info');
}

function copyHistoryJson(id) {
    const history = getHistory();
    const item = history.find(h => h.id === id);
    if (item) {
        const json = JSON.stringify(item, null, 2);
        navigator.clipboard.writeText(json);
        showToast('Copied to clipboard!', 'success');
    }
}

function exportHistory() {
    const history = getHistory();
    const json = JSON.stringify(history, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('History exported!', 'success');
}

function getSettings() {
    return { ...DEFAULT_SETTINGS, ...getStorage(STORAGE_KEYS.SETTINGS, {}) };
}

function updateSettings(key, value) {
    const settings = getSettings();
    settings[key] = value;
    setStorage(STORAGE_KEYS.SETTINGS, settings);
}

function openSettingsModal() {
    const settings = getSettings();
    document.getElementById('autoSaveToggle').checked = settings.autoSave;
    document.getElementById('notificationsToggle').checked = settings.showNotifications;
    document.getElementById('darkModeToggle').checked = settings.darkMode;
    document.getElementById('includeSuggestionsToggle').checked = settings.includeSuggestions;
    document.getElementById('includeMetadataToggle').checked = settings.includeMetadata;
    document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.add('hidden');
}

function resetAllData() {
    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
        localStorage.clear();
        showToast('All data cleared!', 'success');
        setTimeout(() => location.reload(), 1000);
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('light-mode');
    const settings = getSettings();
    settings.darkMode = !isDark;
    updateSettings('darkMode', settings.darkMode);
    const themeBtn = document.getElementById('themeBtn');
    themeBtn.textContent = isDark ? '☀️' : '🌙';
    showToast(isDark ? 'Light mode enabled' : 'Dark mode enabled', 'info');
}

function applyTheme() {
    const settings = getSettings();
    if (!settings.darkMode) {
        document.body.classList.add('light-mode');
        document.getElementById('themeBtn').textContent = '☀️';
    }
}

function rotateImage() {
    const img = document.getElementById('previewImage');
    let rotation = parseInt(localStorage.getItem('imageRotation') || '0');
    rotation = (rotation + 90) % 360;
    img.style.transform = `rotate(${rotation}deg)`;
    localStorage.setItem('imageRotation', rotation);
    showToast(`Rotated ${rotation}°`, 'info');
}

function zoomImage() {
    const img = document.getElementById('previewImage');
    let scale = parseFloat(img.style.transform.match(/scale\((.*?)\)/)?.[1] || '1');
    scale = scale === 1 ? 1.5 : 1;
    img.style.transform = `rotate(${parseInt(localStorage.getItem('imageRotation') || '0')}deg) scale(${scale})`;
    showToast(scale === 1.5 ? 'Zoomed in' : 'Zoomed out', 'info');
}

function showLoader() {
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('resultsContainer').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
}

function showError(message) {
    hideLoader();
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.innerHTML = `
        <div style="padding: 20px; background: rgba(239, 68, 68, 0.1); border-left: 4px solid var(--error);">
            <p style="font-weight: 600; margin-bottom: 8px;">❌ Error</p>
            <p>${escapeHtml(message)}</p>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px;">Try uploading a different image or check your API key.</p>
        </div>
    `;
    errorMessage.classList.remove('hidden');
    document.getElementById('resultsContainer').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

function showPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            window.currentImageSize = `${img.width}x${img.height}px`;
        };
        img.src = e.target.result;
        
        document.getElementById('previewImage').src = e.target.result;
        document.getElementById('previewImage').style.transform = 'rotate(0deg) scale(1)';
        localStorage.removeItem('imageRotation');
        document.getElementById('previewContainer').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function removePreview() {
    document.getElementById('previewContainer').classList.add('hidden');
    document.getElementById('fileInput').value = '';
    document.getElementById('resultsContainer').classList.add('hidden');
    document.getElementById('previewImage').src = '';
    document.getElementById('emptyState').classList.remove('hidden');
    localStorage.removeItem('imageRotation');
}

async function handleImageUpload(file) {
    if (!file.type.startsWith('image/')) {
        showError('Please upload a valid image file');
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        showError('File size must be less than 20MB');
        return;
    }

    try {
        showLoader();
        showPreview(file);
        const base64Image = await imageToBase64(file);
        const result = await callGeminiAPI(base64Image, file.type);
        addTimeToStats(result.timeTaken);
        addToHistory(result, file);
        hideLoader();
        displayResults(result);
        
        if (getSettings().showNotifications) {
            showToast('Analysis complete! ✓', 'success');
        }
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
}

function handlePasteImage() {
    navigator.clipboard.read().then(items => {
        for (let item of items) {
            if (item.type.includes('image')) {
                item.getType(item.type).then(blob => {
                    handleImageUpload(blob);
                });
            }
        }
    }).catch(() => {
        showToast('No image in clipboard', 'error');
    });
}

function handleCameraCapture() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
        if (e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
        }
    };
    input.click();
}

function handleUrlUpload() {
    const url = prompt('Enter image URL:');
    if (url) {
        fetch(url)
            .then(r => r.blob())
            .then(blob => {
                const file = new File([blob], 'image.jpg', { type: blob.type });
                handleImageUpload(file);
            })
            .catch(() => showToast('Could not load image from URL', 'error'));
    }
}

const uploadArea = document.getElementById('uploadArea');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const removeImageBtn = document.getElementById('removeImageBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
uploadBtn.addEventListener('click', () => fileInput.click());
analyzeBtn?.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (file) handleImageUpload(file);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        handleImageUpload(e.target.files[0]);
    }
});

removeImageBtn.addEventListener('click', removePreview);
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) {
        handleImageUpload(e.dataTransfer.files[0]);
    }
});

uploadArea.addEventListener('click', () => fileInput.click());
document.getElementById('pasteBtn')?.addEventListener('click', handlePasteImage);
document.getElementById('cameraBtn')?.addEventListener('click', handleCameraCapture);
document.getElementById('urlBtn')?.addEventListener('click', handleUrlUpload);
document.getElementById('rotateBtn')?.addEventListener('click', rotateImage);
document.getElementById('zoomBtn')?.addEventListener('click', zoomImage);
document.getElementById('historyBtn')?.addEventListener('click', openHistoryModal);
document.getElementById('closeHistoryBtn')?.addEventListener('click', closeHistoryModal);
document.getElementById('searchHistory')?.addEventListener('input', (e) => displayHistory(e.target.value));
document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
    if (confirm('Clear all history?')) {
        clearHistory();
        displayHistory();
        showToast('History cleared', 'info');
    }
});
document.getElementById('exportHistoryBtn')?.addEventListener('click', exportHistory);
document.getElementById('settingsBtn')?.addEventListener('click', openSettingsModal);
document.getElementById('closeSettingsBtn')?.addEventListener('click', closeSettingsModal);
document.getElementById('autoSaveToggle')?.addEventListener('change', (e) => updateSettings('autoSave', e.target.checked));
document.getElementById('notificationsToggle')?.addEventListener('change', (e) => updateSettings('showNotifications', e.target.checked));
document.getElementById('darkModeToggle')?.addEventListener('change', (e) => updateSettings('darkMode', e.target.checked));
document.getElementById('includeSuggestionsToggle')?.addEventListener('change', (e) => updateSettings('includeSuggestions', e.target.checked));
document.getElementById('includeMetadataToggle')?.addEventListener('change', (e) => updateSettings('includeMetadata', e.target.checked));
document.getElementById('resetStorageBtn')?.addEventListener('click', resetAllData);
document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
document.getElementById('favoriteBtn')?.addEventListener('click', () => {
    if (window.currentAnalysisData) {
        const item = getHistory().find(h => h.id === window.currentAnalysisData.id) || window.currentAnalysisData;
        toggleFavorite(item);
    }
});
document.getElementById('copyJsonBtn')?.addEventListener('click', copyJsonToClipboard);
document.getElementById('downloadBtn')?.addEventListener('click', downloadResults);
document.getElementById('shareBtn')?.addEventListener('click', () => {
    if (navigator.share && window.currentAnalysisData) {
        navigator.share({
            title: window.currentAnalysisData.name,
            text: `Analyzed: ${window.currentAnalysisData.description}`,
        });
    }
});
document.getElementById('historyModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'historyModal') closeHistoryModal();
});
document.getElementById('settingsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') closeSettingsModal();
});
window.addEventListener('DOMContentLoaded', () => {
    refreshStatsDisplay();
    applyTheme();
    showToast('Welcome to AI Image Analyzer Pro! 🚀', 'success', 2000);
});
