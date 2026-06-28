// popup.js

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const tabSyncBtn = document.getElementById('tab-sync');
  const tabSettingsBtn = document.getElementById('tab-settings');
  const panelSync = document.getElementById('content-sync');
  const panelSettings = document.getElementById('content-settings');

  const statusCard = document.getElementById('status-card');
  const statusText = document.getElementById('status-text');

  const inputTitle = document.getElementById('class-title');
  const inputDate = document.getElementById('class-date');
  const inputLink = document.getElementById('class-link');
  const selectUnit = document.getElementById('notion-select-unit');
  const btnSyncNotion = document.getElementById('btn-sync-notion');
  const syncSpinner = document.getElementById('sync-spinner');

  const inputToken = document.getElementById('notion-token');
  const btnToggleToken = document.getElementById('btn-toggle-token');
  const inputTargetId = document.getElementById('notion-target-id');
  const inputTargetType = document.getElementById('notion-target-type');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const saveStatus = document.getElementById('save-status');

  const syncToast = document.getElementById('sync-toast');
  const toastTitle = syncToast.querySelector('.toast-title');
  const toastDesc = syncToast.querySelector('.toast-desc');

  const instructionsTrigger = document.getElementById('instructions-trigger');
  const instructionsContent = document.getElementById('instructions-content');
  const accordionContainer = document.querySelector('.instructions-accordion');

  // Theme Toggle DOM Elements
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const themeEmoji = btnThemeToggle.querySelector('.theme-emoji');

  // Load configuration on open
  let config = {};
  try {
    config = await chrome.storage.local.get(['notionToken', 'notionTargetId', 'notionTargetType']);
    if (config.notionToken) inputToken.value = config.notionToken;
    if (config.notionTargetId) inputTargetId.value = config.notionTargetId;
    if (config.notionTargetType) inputTargetType.value = config.notionTargetType;
  } catch (err) {
    console.error('Error loading config from storage:', err);
  }

  // Load theme preference on open
  try {
    const storedTheme = await chrome.storage.local.get(['theme']);
    const currentTheme = storedTheme.theme || 'light';
    if (currentTheme === 'dark') {
      document.body.classList.add('dark-theme');
      themeEmoji.textContent = '☀️';
    } else {
      document.body.classList.remove('dark-theme');
      themeEmoji.textContent = '🌙';
    }
  } catch (err) {
    console.error('Error loading theme preference:', err);
  }

  // Theme Toggle Event Listener
  btnThemeToggle.addEventListener('click', async () => {
    const isDark = document.body.classList.toggle('dark-theme');
    const newTheme = isDark ? 'dark' : 'light';
    themeEmoji.textContent = isDark ? '☀️' : '🌙';
    await chrome.storage.local.set({ theme: newTheme });
  });

  // 1. Navigation Tab Handling
  function switchTab(activeTabBtn, activePanel, inactiveTabBtn, inactivePanel) {
    activeTabBtn.classList.add('active');
    activePanel.classList.add('active');
    inactiveTabBtn.classList.remove('active');
    inactivePanel.classList.remove('active');
  }

  tabSyncBtn.addEventListener('click', () => {
    switchTab(tabSyncBtn, panelSync, tabSettingsBtn, panelSettings);
  });

  tabSettingsBtn.addEventListener('click', () => {
    switchTab(tabSettingsBtn, panelSettings, tabSyncBtn, panelSync);
  });

  // 2. Settings management
  btnToggleToken.addEventListener('click', () => {
    if (inputToken.type === 'password') {
      inputToken.type = 'text';
      btnToggleToken.textContent = '🙈';
    } else {
      inputToken.type = 'password';
      btnToggleToken.textContent = '👁️';
    }
  });

  btnSaveSettings.addEventListener('click', async () => {
    const token = inputToken.value.trim();
    const targetId = inputTargetId.value.trim();
    const targetType = inputTargetType.value;

    if (!token || !targetId) {
      showToast('Configuration Error', 'Please fill in both fields.', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({
        notionToken: token,
        notionTargetId: targetId,
        notionTargetType: targetType
      });
      
      // Update local configuration variable
      config = { notionToken: token, notionTargetId: targetId, notionTargetType: targetType };
      
      saveStatus.classList.remove('hidden');
      setTimeout(() => {
        saveStatus.classList.add('hidden');
      }, 2000);

      // Refetch child pages immediately since credentials changed
      await fetchNotionSubpages();
    } catch (err) {
      console.error('Error saving credentials:', err);
      showToast('Save Error', 'Failed to save configuration.', 'error');
    }
  });

  // Instructions Accordion Toggle
  instructionsTrigger.addEventListener('click', () => {
    accordionContainer.classList.toggle('open');
    instructionsContent.classList.toggle('hidden');
  });

  // 3. Fetch Notion Sub-pages
  async function fetchNotionSubpages() {
    if (!config.notionToken || !config.notionTargetId) {
      selectUnit.innerHTML = '<option value="">(Configure settings first)</option>';
      selectUnit.disabled = true;
      return [];
    }

    const parentId = config.notionTargetId.replace(/-/g, '');
    const targetType = config.notionTargetType || 'page';
    selectUnit.innerHTML = '<option value="">Fetching unit pages...</option>';
    selectUnit.disabled = true;

    let childPages = [];

    try {
      if (targetType === 'database') {
        const endpoint = `https://api.notion.com/v1/databases/${parentId}/query`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.notionToken}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ page_size: 100 })
        });

        if (!response.ok) {
          throw new Error(`Database Query HTTP ${response.status}`);
        }

        const data = await response.json();
        childPages = (data.results || []).map(page => {
          let title = "Untitled Row";
          for (const prop of Object.values(page.properties || {})) {
            if (prop.type === 'title' && prop.title && prop.title.length > 0) {
              title = prop.title[0].plain_text;
              break;
            }
          }
          return { id: page.id, title: title, type: 'child_page' };
        });
      } else {
        const endpoint = `https://api.notion.com/v1/blocks/${parentId}/children`;
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.notionToken}`,
            'Notion-Version': '2022-06-28'
          }
        });

        if (!response.ok) {
          throw new Error(`Page Blocks HTTP ${response.status}`);
        }

        const data = await response.json();
        childPages = (data.results || [])
          .filter(block => block.type === 'child_page' || block.type === 'child_database')
          .map(block => ({
            id: block.id,
            title: block.type === 'child_page' ? block.child_page.title : block.child_database.title,
            type: block.type
          }));
      }

      selectUnit.innerHTML = '';
      
      const defaultOpt = document.createElement('option');
      defaultOpt.value = parentId;
      defaultOpt.textContent = 'Main Page (Default)';
      defaultOpt.setAttribute('data-type', config.notionTargetType === 'database' ? 'child_database' : 'child_page');
      selectUnit.appendChild(defaultOpt);

      if (childPages.length > 0) {
        childPages.forEach(page => {
          const opt = document.createElement('option');
          opt.value = page.id;
          opt.textContent = page.title;
          opt.setAttribute('data-type', page.type);
          selectUnit.appendChild(opt);
        });
      }

      selectUnit.disabled = false;
      return childPages;
    } catch (err) {
      console.error('Error fetching child pages from Notion API:', err);
      selectUnit.innerHTML = `<option value="${parentId}">Main Page (API Error / Check Settings)</option>`;
      selectUnit.disabled = false;
      return [];
    }
  }

  const subpagesPromise = fetchNotionSubpages();

  // 4. Page Context Checking & Scraper Communication
  async function initPageScraper() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        setManualMode("Could not access active browser tab.");
        return;
      }

      const url = tab.url || '';
      const isClassPortal = url.includes('ap.lk') || url.includes('localhost') || url.includes('127.0.0.1');

      if (isClassPortal) {
        statusCard.className = 'status-card status-detected';
        statusText.textContent = 'Physics Portal Detected';
        
        chrome.tabs.sendMessage(tab.id, { action: 'scrapeClass' }, async (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Communication with content script failed:', chrome.runtime.lastError.message);
            setManualMode('Physics Portal page loading...');
            return;
          }

          if (response && response.success) {
            const data = response.data;
            inputTitle.value = data.title || '';
            inputDate.value = data.date || '';
            inputLink.value = data.link || '';
            
            if (!data.date) {
              inputDate.placeholder = "e.g., June 28, 2026";
            }
            
            const childPages = await subpagesPromise;
            const detectedUnit = data.detectedUnit || '';
            
            if (detectedUnit && childPages.length > 0) {
              const lowerDetected = detectedUnit.toLowerCase();
              const matchedPage = childPages.find(page => 
                page.title.toLowerCase().includes(lowerDetected)
              );

              if (matchedPage) {
                selectUnit.value = matchedPage.id;
                statusText.textContent = `Physics Portal Detected • Matched unit: ${detectedUnit}`;
              }
            }
          } else {
            console.warn('Scraping returned unsuccessful:', response ? response.error : 'Empty response');
            setManualMode('Failed to parse details. Enter manually:');
          }
        });
      } else {
        setManualMode('Not on ap.lk. You can enter details manually:');
      }
    } catch (err) {
      console.error('Error initializing scraper:', err);
      setManualMode('Extension initializing...');
    }
  }

  function setManualMode(reasonMessage) {
    statusCard.className = 'status-card status-external';
    statusText.textContent = reasonMessage;
    
    if (!inputTitle.value) inputTitle.placeholder = "e.g., Mechanics - Lesson 4";
    if (!inputDate.value) {
      inputDate.value = "";
      inputDate.placeholder = "e.g., June 28, 2026";
    }
    if (!inputLink.value) inputLink.placeholder = "e.g., https://youtube.com/watch?v=...";
  }

  function parseToISODate(dateStr) {
    if (!dateStr) return null;
    try {
      const digitsMatch = dateStr.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
      if (digitsMatch) {
        return `${digitsMatch[1]}-${digitsMatch[2].padStart(2, '0')}-${digitsMatch[3].padStart(2, '0')}`;
      }
      const digitsMatch2 = dateStr.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
      if (digitsMatch2) {
        return `${digitsMatch2[3]}-${digitsMatch2[2].padStart(2, '0')}-${digitsMatch2[1].padStart(2, '0')}`;
      }

      const cleaned = dateStr
        .replace(/(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday),?\s*/i, '')
        .replace(/\bat\b/i, '')
        .replace(/\bof\b/i, '')
        .replace(/(?:st|nd|rd|th)/gi, '')
        .trim();
        
      if (!cleaned) return null;
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      console.warn('Failed parsing date to ISO format:', dateStr);
    }
    return null;
  }

  await initPageScraper();

  // 5. Send to Notion automation
  btnSyncNotion.addEventListener('click', async () => {
    const title = inputTitle.value.trim();
    const date = inputDate.value.trim();
    const link = inputLink.value.trim();

    if (!title) {
      showToast('Validation Error', 'Topic name is required.', 'error');
      return;
    }

    if (!config.notionToken || !config.notionTargetId) {
      showToast('Configuration Missing', 'Please set credentials in the Settings tab first.', 'error');
      return;
    }

    btnSyncNotion.disabled = true;
    syncSpinner.classList.remove('hidden');
    
    try {
      const success = await sendToNotion(title, date, link);
      if (success) {
        showToast('Synced to Notion!', 'Class details saved successfully.', 'success');
      }
    } catch (error) {
      console.error('Notion Sync Error:', error);
      showToast('Sync Failed', error.message || 'An unexpected error occurred.', 'error');
    } finally {
      btnSyncNotion.disabled = false;
      syncSpinner.classList.add('hidden');
    }
  });

  async function sendToNotion(title, date, link) {
    const targetId = selectUnit.value;
    const parentId = config.notionTargetId.replace(/-/g, '');
    
    let databaseId = null;
    let unitName = "";

    const selectedOption = selectUnit.options[selectUnit.selectedIndex];
    const targetOptionType = selectedOption ? selectedOption.getAttribute('data-type') : 'child_page';

    if (selectedOption && targetId !== parentId) {
      unitName = selectedOption.textContent;
    } else {
      const detectedMatch = statusText.textContent.match(/Matched unit:\s*(.*)/);
      unitName = detectedMatch ? detectedMatch[1].trim() : "Physics";
    }

    if (targetOptionType === 'child_database') {
      databaseId = targetId;
    } else {
      const blocksEndpoint = `https://api.notion.com/v1/blocks/${targetId}/children`;
      try {
        const blocksResponse = await fetch(blocksEndpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.notionToken}`,
            'Notion-Version': '2022-06-28'
          }
        });

        if (blocksResponse.ok) {
          const blocksData = await blocksResponse.json();
          const dbBlock = (blocksData.results || []).find(block => block.type === 'child_database');
          if (dbBlock) {
            databaseId = dbBlock.id;
          }
        }
      } catch (err) {
        console.warn('Could not query child blocks, falling back to direct page creation:', err);
      }
    }

    const endpoint = 'https://api.notion.com/v1/pages';
    let body = {};

    if (databaseId) {
      const properties = {
        Unit: {
          title: [
            { text: { content: title } }
          ]
        },
        Status: {
          status: {
            name: 'Not started'
          }
        },
        Link: {
          rich_text: [
            { text: { content: link ? link : "" } }
          ]
        },
        Select: {
          select: {
            name: 'Theory'
          }
        }
      };

      const isoDate = parseToISODate(date);
      if (isoDate) {
        properties.Date = {
          date: {
            start: isoDate
          }
        };
      }

      body = {
        parent: { database_id: databaseId },
        properties: properties
      };
    } else {
      const contentBlocks = [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              { text: { content: 'Class Details' } }
            ]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { text: { content: 'Unit: ' }, annotations: { bold: true } },
              { text: { content: unitName + '\n' } },
              { text: { content: 'Date: ' }, annotations: { bold: true } },
              { text: { content: (date ? date : "None") + '\n' } },
              { text: { content: 'Status: ' }, annotations: { bold: true } },
              { text: { content: 'Not started\n' } },
              { text: { content: 'Select: ' }, annotations: { bold: true } },
              { text: { content: 'Theory\n' } },
              { text: { content: 'Class Link: ' }, annotations: { bold: true } },
              link ? 
                { text: { content: link, link: { url: link } } } : 
                { text: { content: 'None', annotations: { italic: true } } }
            ]
          }
        }
      ];

      body = {
        parent: { page_id: targetId },
        properties: {
          title: [
            { text: { content: title } }
          ]
        },
        children: contentBlocks
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errData = await response.json();
      const message = errData.message || `HTTP error! status: ${response.status}`;
      throw new Error(`Notion API: ${message}`);
    }

    return true;
  }

  let toastTimeout;
  function showToast(title, message, type = 'success') {
    clearTimeout(toastTimeout);
    
    toastTitle.textContent = title;
    toastDesc.textContent = message;
    
    syncToast.className = 'toast';
    syncToast.classList.add(type === 'success' ? 'toast-success' : 'toast-error');
    
    syncToast.classList.remove('hidden');

    toastTimeout = setTimeout(() => {
      syncToast.classList.add('hidden');
    }, 4000);
  }
});
