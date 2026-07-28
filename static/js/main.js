// BigQuery Release Notes Client JS Application

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const refreshBtn = document.getElementById('refresh-btn');
  const searchInput = document.getElementById('search-input');
  const categoryChips = document.getElementById('category-chips');
  const feedContainer = document.getElementById('feed-container');
  const visibleCountEl = document.getElementById('visible-count');
  const totalEntriesCountEl = document.getElementById('total-entries-count');
  const fetchedTimeEl = document.getElementById('fetched-time');

  // Tweet Modal Elements
  const tweetModal = document.getElementById('tweet-modal');
  const modalCloseBtn = document.getElementById('modal-close');
  const tweetTextarea = document.getElementById('tweet-textarea');
  const charCounter = document.getElementById('char-counter');
  const btnCopyTweet = document.getElementById('btn-copy-tweet');
  const btnPostTweet = document.getElementById('btn-post-tweet');
  const hashtagBar = document.querySelector('.hashtag-bar');

  // Selection Popover
  const selectionPopover = document.getElementById('selection-popover');
  const btnPopoverTweet = document.getElementById('btn-popover-tweet');

  // State
  let rawFeedData = null;
  let currentCategory = 'ALL';
  let searchQuery = '';
  let activeSelectedText = '';

  // Initialize App
  init();

  function init() {
    loadReleaseNotes(false);
    setupEventListeners();
  }

  function setupEventListeners() {
    // Refresh button
    refreshBtn.addEventListener('click', () => {
      loadReleaseNotes(true);
    });

    // Search Input
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderFeed();
    });

    // Category Filter Chips
    categoryChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;

      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      currentCategory = chip.dataset.category;
      renderFeed();
    });

    // Modal Close
    modalCloseBtn.addEventListener('click', closeTweetModal);
    tweetModal.addEventListener('click', (e) => {
      if (e.target === tweetModal) closeTweetModal();
    });

    // Textarea Live Character Count
    tweetTextarea.addEventListener('input', updateCharCount);

    // Hashtag Insertion
    hashtagBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-tag');
      if (!btn) return;
      const tag = btn.dataset.tag;
      if (!tweetTextarea.value.includes(tag)) {
        tweetTextarea.value = (tweetTextarea.value.trim() + ' ' + tag).trim();
        updateCharCount();
      }
    });

    // Copy Tweet Button
    btnCopyTweet.addEventListener('click', () => {
      navigator.clipboard.writeText(tweetTextarea.value).then(() => {
        showToast('Tweet text copied to clipboard! 📋');
      });
    });

    // Post to X / Twitter Button
    btnPostTweet.addEventListener('click', () => {
      const text = tweetTextarea.value.trim();
      if (!text) return;
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(twitterUrl, '_blank');
      closeTweetModal();
    });

    // Text Selection for Tweet
    document.addEventListener('mouseup', handleTextSelection);
    btnPopoverTweet.addEventListener('click', () => {
      if (activeSelectedText) {
        openTweetModal(`"${activeSelectedText}"\n\n#BigQuery #GoogleCloud #GCP`);
        hideSelectionPopover();
      }
    });
  }

  // Load Notes from API
  async function loadReleaseNotes(forceRefresh = false) {
    setLoadingState(true);

    try {
      const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.status === 'success' || result.status === 'warning') {
        rawFeedData = result.data;
        fetchedTimeEl.textContent = rawFeedData.fetched_at || 'Just now';
        renderFeed();

        if (forceRefresh) {
          showToast('Release notes successfully refreshed! 🚀');
        }
      } else {
        showToast(`Error: ${result.message || 'Failed to fetch release notes'}`);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showToast('Network error while fetching release notes.');
    } finally {
      setLoadingState(false);
    }
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      refreshBtn.classList.add('spinning');
      refreshBtn.disabled = true;
    } else {
      refreshBtn.classList.remove('spinning');
      refreshBtn.disabled = false;
    }
  }

  // Render Cards Feed based on Filters & Search
  function renderFeed() {
    if (!rawFeedData || !rawFeedData.notes) {
      feedContainer.innerHTML = `<div class="controls-card" style="text-align:center;">No release notes found.</div>`;
      return;
    }

    feedContainer.innerHTML = '';
    let totalVisibleSections = 0;
    let totalVisibleEntries = 0;

    rawFeedData.notes.forEach(entry => {
      // Filter sections in entry
      const matchingSections = entry.sections.filter(sec => {
        const matchesCategory = currentCategory === 'ALL' || sec.type.toLowerCase() === currentCategory.toLowerCase();
        const matchesSearch = !searchQuery || 
          sec.text.toLowerCase().includes(searchQuery) || 
          sec.type.toLowerCase().includes(searchQuery) ||
          entry.date.toLowerCase().includes(searchQuery);
        return matchesCategory && matchesSearch;
      });

      if (matchingSections.length > 0) {
        totalVisibleEntries++;
        totalVisibleSections += matchingSections.length;

        const card = document.createElement('article');
        card.className = 'entry-card';

        const sectionsHTML = matchingSections.map(sec => {
          const badgeClass = getBadgeClass(sec.type);
          return `
            <div class="section-block" data-section-id="${sec.id}">
              <div class="section-meta">
                <span class="badge ${badgeClass}">${getCategoryIcon(sec.type)} ${sec.type}</span>
              </div>
              <div class="section-body">
                ${sec.html}
              </div>
              <div class="section-actions">
                <button class="btn-action btn-tweet-action" onclick="prepareSectionTweet('${escapeJsString(entry.date)}', '${escapeJsString(sec.type)}', '${escapeJsString(sec.text)}', '${escapeJsString(entry.link)}')">
                  <i class="fa-brands fa-x-twitter"></i> Tweet
                </button>
                <button class="btn-action" onclick="copyToClipboard('${escapeJsString(sec.text)}')">
                  <i class="fa-regular fa-copy"></i> Copy Text
                </button>
                <button class="btn-action" onclick="copyToClipboard('${escapeJsString(entry.link)}')">
                  <i class="fa-solid fa-link"></i> Copy Link
                </button>
              </div>
            </div>
          `;
        }).join('');

        card.innerHTML = `
          <header class="entry-header">
            <div class="entry-date-wrapper">
              <i class="fa-solid fa-calendar-day date-icon"></i>
              <h2 class="entry-date">${entry.date}</h2>
            </div>
            <a href="${entry.link}" target="_blank" rel="noopener noreferrer" class="entry-official-link">
              Google Docs <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </header>
          <div class="entry-sections">
            ${sectionsHTML}
          </div>
        `;

        feedContainer.appendChild(card);
      }
    });

    visibleCountEl.textContent = totalVisibleSections;
    totalEntriesCountEl.textContent = totalVisibleEntries;

    if (totalVisibleSections === 0) {
      feedContainer.innerHTML = `
        <div class="controls-card" style="text-align: center; padding: 3rem 1.5rem;">
          <i class="fa-solid fa-filter-circle-xmark fa-3x" style="color: var(--text-muted); margin-bottom: 1rem;"></i>
          <h3 style="margin-bottom: 0.5rem;">No matching release notes</h3>
          <p style="color: var(--text-secondary);">Try clearing your search or selecting a different category filter.</p>
        </div>
      `;
    }
  }

  // Tweet Helper Functions
  window.prepareSectionTweet = function(date, category, text, link) {
    // Generate clean Tweet text within 280 char limit
    const prefix = `🚀 BigQuery ${category} (${date}):\n\n`;
    const suffix = `\n\n🔗 ${link}\n#BigQuery #GoogleCloud #GCP`;

    const maxSnippetLen = 280 - prefix.length - suffix.length - 5;
    let snippet = text;
    if (snippet.length > maxSnippetLen) {
      snippet = snippet.substring(0, maxSnippetLen).trim() + '...';
    }

    const tweetText = `${prefix}${snippet}${suffix}`;
    openTweetModal(tweetText);
  };

  window.copyToClipboard = function(str) {
    navigator.clipboard.writeText(str).then(() => {
      showToast('Copied to clipboard! 📋');
    });
  };

  function openTweetModal(initialText) {
    tweetTextarea.value = initialText;
    updateCharCount();
    tweetModal.classList.add('active');
    tweetTextarea.focus();
  }

  function closeTweetModal() {
    tweetModal.classList.remove('active');
  }

  function updateCharCount() {
    const len = tweetTextarea.value.length;
    charCounter.textContent = `${len} / 280`;

    if (len > 280) {
      charCounter.className = 'char-counter exceeded';
      btnPostTweet.disabled = true;
    } else if (len > 240) {
      charCounter.className = 'char-counter warning';
      btnPostTweet.disabled = false;
    } else {
      charCounter.className = 'char-counter';
      btnPostTweet.disabled = false;
    }
  }

  // Handle Text Selection Popover
  function handleTextSelection(e) {
    // Don't trigger if inside tweet modal
    if (tweetModal.contains(e.target) || selectionPopover.contains(e.target)) return;

    const selection = window.getSelection();
    const selectedStr = selection ? selection.toString().trim() : '';

    if (selectedStr.length > 5 && selectedStr.length < 500) {
      activeSelectedText = selectedStr;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      selectionPopover.style.top = `${rect.top + window.scrollY - 10}px`;
      selectionPopover.style.left = `${rect.left + window.scrollX + (rect.width / 2)}px`;
      selectionPopover.style.display = 'block';
    } else {
      hideSelectionPopover();
    }
  }

  function hideSelectionPopover() {
    selectionPopover.style.display = 'none';
    activeSelectedText = '';
  }

  // Utility Badges & Formatting
  function getBadgeClass(category) {
    const cat = category.toLowerCase();
    if (cat.includes('feature')) return 'badge-feature';
    if (cat.includes('change')) return 'badge-change';
    if (cat.includes('deprecation') || cat.includes('issue')) return 'badge-deprecation';
    return 'badge-general';
  }

  function getCategoryIcon(category) {
    const cat = category.toLowerCase();
    if (cat.includes('feature')) return '<i class="fa-solid fa-sparkles"></i>';
    if (cat.includes('change')) return '<i class="fa-solid fa-sliders"></i>';
    if (cat.includes('deprecation') || cat.includes('issue')) return '<i class="fa-solid fa-triangle-exclamation"></i>';
    return '<i class="fa-solid fa-bullhorn"></i>';
  }

  function escapeJsString(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '');
  }

  // Toast Notification System
  function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--accent-green);"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
});
