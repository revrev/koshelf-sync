const API_PREFIX = '/v1'
const STORAGE_KEY = 'koshelf-audiobookshelf-admin'

const elements = {
  authForm: document.querySelector('#auth-form'),
  authUsername: document.querySelector('#auth-username'),
  authPassword: document.querySelector('#auth-password'),
  authStatus: document.querySelector('#auth-status'),
  configForm: document.querySelector('#config-form'),
  configStatus: document.querySelector('#config-status'),
  configBaseUrl: document.querySelector('#config-base-url'),
  configApiKey: document.querySelector('#config-api-key'),
  configUserId: document.querySelector('#config-user-id'),
  configUserToken: document.querySelector('#config-user-token'),
  configDeviceName: document.querySelector('#config-device-name'),
  configHttpTimeout: document.querySelector('#config-http-timeout'),
  configUserMap: document.querySelector('#config-user-map'),
  configDocumentMap: document.querySelector('#config-document-map'),
  documentsTableBody: document.querySelector('#documents-table tbody'),
  searchForm: document.querySelector('#search-form'),
  searchLibrary: document.querySelector('#search-library'),
  searchQuery: document.querySelector('#search-query'),
  searchStatus: document.querySelector('#search-status'),
  searchResults: document.querySelector('#search-results'),
  log: document.querySelector('#activity-log'),
}

const state = {
  auth: {
    username: '',
    hashedKey: '',
  },
  config: null,
  documents: [],
  libraries: [],
  selectedDocumentKey: null,
}

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data.username && data.hashedKey) {
      state.auth.username = data.username
      state.auth.hashedKey = data.hashedKey
      elements.authUsername.value = data.username
    }
  } catch (err) {
    console.warn('Unable to parse stored credentials', err)
  }
}

function persistAuth() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ username: state.auth.username, hashedKey: state.auth.hashedKey })
  )
}

function log(message, type = 'info') {
  if (!elements.log) return
  const entry = document.createElement('div')
  entry.className = 'log__entry'
  const timestamp = new Date().toLocaleTimeString()
  entry.textContent = `[${timestamp}] ${type.toUpperCase()}: ${message}`
  elements.log.prepend(entry)
  while (elements.log.childElementCount > 120) {
    elements.log.removeChild(elements.log.lastElementChild)
  }
}

function setStatus(el, message, tone = 'info') {
  if (!el) return
  el.textContent = message || ''
  el.dataset.tone = tone
}

function md5(string) {
  // Lightweight MD5 implementation (https://www.webtoolkit.info/javascript-md5.html) with minor tweaks
  function rotateLeft(lValue, shiftBits) {
    return (lValue << shiftBits) | (lValue >>> (32 - shiftBits))
  }
  function addUnsigned(lX, lY) {
    const lX4 = lX & 0x40000000
    const lY4 = lY & 0x40000000
    const lX8 = lX & 0x80000000
    const lY8 = lY & 0x80000000
    let lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff)
    if (lX4 & lY4) {
      return lResult ^ 0x80000000 ^ lX8 ^ lY8
    }
    if (lX4 | lY4) {
      if (lResult & 0x40000000) {
        return lResult ^ 0xc0000000 ^ lX8 ^ lY8
      }
      return lResult ^ 0x40000000 ^ lX8 ^ lY8
    }
    return lResult ^ lX8 ^ lY8
  }
  function F(x, y, z) {
    return (x & y) | (~x & z)
  }
  function G(x, y, z) {
    return (x & z) | (y & ~z)
  }
  function H(x, y, z) {
    return x ^ y ^ z
  }
  function I(x, y, z) {
    return y ^ (x | ~z)
  }
  function FF(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  function GG(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  function HH(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  function II(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac))
    return addUnsigned(rotateLeft(a, s), b)
  }
  function convertToWordArray(str) {
    const messageLength = str.length
    const numberOfWordsTempOne = messageLength + 8
    const numberOfWordsTempTwo = (numberOfWordsTempOne - (numberOfWordsTempOne % 64)) / 64
    const numberOfWords = (numberOfWordsTempTwo + 1) * 16
    const wordArray = new Array(numberOfWords - 1)
    let byteCount = 0
    let wordCount = 0
    while (byteCount < messageLength) {
      wordCount = (byteCount - (byteCount % 4)) / 4
      const bytePosition = (byteCount % 4) * 8
      wordArray[wordCount] = wordArray[wordCount] | (str.charCodeAt(byteCount) << bytePosition)
      byteCount++
    }
    wordCount = (byteCount - (byteCount % 4)) / 4
    const bytePosition = (byteCount % 4) * 8
    wordArray[wordCount] = wordArray[wordCount] | (0x80 << bytePosition)
    wordArray[numberOfWords - 2] = messageLength << 3
    wordArray[numberOfWords - 1] = messageLength >>> 29
    return wordArray
  }
  function wordToHex(lValue) {
    let wordToHexValue = ''
    for (let count = 0; count <= 3; count++) {
      const byte = (lValue >>> (count * 8)) & 255
      const hex = '0' + byte.toString(16)
      wordToHexValue += hex.slice(-2)
    }
    return wordToHexValue
  }
  function utf8Encode(str) {
    return unescape(encodeURIComponent(str))
  }

  let x = []
  let a = 0x67452301
  let b = 0xefcdab89
  let c = 0x98badcfe
  let d = 0x10325476

  string = utf8Encode(string)
  x = convertToWordArray(string)

  for (let k = 0; k < x.length; k += 16) {
    const AA = a
    const BB = b
    const CC = c
    const DD = d

    a = FF(a, b, c, d, x[k + 0], 7, 0xd76aa478)
    d = FF(d, a, b, c, x[k + 1], 12, 0xe8c7b756)
    c = FF(c, d, a, b, x[k + 2], 17, 0x242070db)
    b = FF(b, c, d, a, x[k + 3], 22, 0xc1bdceee)
    a = FF(a, b, c, d, x[k + 4], 7, 0xf57c0faf)
    d = FF(d, a, b, c, x[k + 5], 12, 0x4787c62a)
    c = FF(c, d, a, b, x[k + 6], 17, 0xa8304613)
    b = FF(b, c, d, a, x[k + 7], 22, 0xfd469501)
    a = FF(a, b, c, d, x[k + 8], 7, 0x698098d8)
    d = FF(d, a, b, c, x[k + 9], 12, 0x8b44f7af)
    c = FF(c, d, a, b, x[k + 10], 17, 0xffff5bb1)
    b = FF(b, c, d, a, x[k + 11], 22, 0x895cd7be)
    a = FF(a, b, c, d, x[k + 12], 7, 0x6b901122)
    d = FF(d, a, b, c, x[k + 13], 12, 0xfd987193)
    c = FF(c, d, a, b, x[k + 14], 17, 0xa679438e)
    b = FF(b, c, d, a, x[k + 15], 22, 0x49b40821)

    a = GG(a, b, c, d, x[k + 1], 5, 0xf61e2562)
    d = GG(d, a, b, c, x[k + 6], 9, 0xc040b340)
    c = GG(c, d, a, b, x[k + 11], 14, 0x265e5a51)
    b = GG(b, c, d, a, x[k + 0], 20, 0xe9b6c7aa)
    a = GG(a, b, c, d, x[k + 5], 5, 0xd62f105d)
    d = GG(d, a, b, c, x[k + 10], 9, 0x02441453)
    c = GG(c, d, a, b, x[k + 15], 14, 0xd8a1e681)
    b = GG(b, c, d, a, x[k + 4], 20, 0xe7d3fbc8)
    a = GG(a, b, c, d, x[k + 9], 5, 0x21e1cde6)
    d = GG(d, a, b, c, x[k + 14], 9, 0xc33707d6)
    c = GG(c, d, a, b, x[k + 3], 14, 0xf4d50d87)
    b = GG(b, c, d, a, x[k + 8], 20, 0x455a14ed)
    a = GG(a, b, c, d, x[k + 13], 5, 0xa9e3e905)
    d = GG(d, a, b, c, x[k + 2], 9, 0xfcefa3f8)
    c = GG(c, d, a, b, x[k + 7], 14, 0x676f02d9)
    b = GG(b, c, d, a, x[k + 12], 20, 0x8d2a4c8a)

    a = HH(a, b, c, d, x[k + 5], 4, 0xfffa3942)
    d = HH(d, a, b, c, x[k + 8], 11, 0x8771f681)
    c = HH(c, d, a, b, x[k + 11], 16, 0x6d9d6122)
    b = HH(b, c, d, a, x[k + 14], 23, 0xfde5380c)
    a = HH(a, b, c, d, x[k + 1], 4, 0xa4beea44)
    d = HH(d, a, b, c, x[k + 4], 11, 0x4bdecfa9)
    c = HH(c, d, a, b, x[k + 7], 16, 0xf6bb4b60)
    b = HH(b, c, d, a, x[k + 10], 23, 0xbebfbc70)
    a = HH(a, b, c, d, x[k + 13], 4, 0x289b7ec6)
    d = HH(d, a, b, c, x[k + 0], 11, 0xeaa127fa)
    c = HH(c, d, a, b, x[k + 3], 16, 0xd4ef3085)
    b = HH(b, c, d, a, x[k + 6], 23, 0x04881d05)
    a = HH(a, b, c, d, x[k + 9], 4, 0xd9d4d039)
    d = HH(d, a, b, c, x[k + 12], 11, 0xe6db99e5)
    c = HH(c, d, a, b, x[k + 15], 16, 0x1fa27cf8)
    b = HH(b, c, d, a, x[k + 2], 23, 0xc4ac5665)

    a = II(a, b, c, d, x[k + 0], 6, 0xf4292244)
    d = II(d, a, b, c, x[k + 7], 10, 0x432aff97)
    c = II(c, d, a, b, x[k + 14], 15, 0xab9423a7)
    b = II(b, c, d, a, x[k + 5], 21, 0xfc93a039)
    a = II(a, b, c, d, x[k + 12], 6, 0x655b59c3)
    d = II(d, a, b, c, x[k + 3], 10, 0x8f0ccc92)
    c = II(c, d, a, b, x[k + 10], 15, 0xffeff47d)
    b = II(b, c, d, a, x[k + 1], 21, 0x85845dd1)
    a = II(a, b, c, d, x[k + 8], 6, 0x6fa87e4f)
    d = II(d, a, b, c, x[k + 15], 10, 0xfe2ce6e0)
    c = II(c, d, a, b, x[k + 6], 15, 0xa3014314)
    b = II(b, c, d, a, x[k + 13], 21, 0x4e0811a1)
    a = II(a, b, c, d, x[k + 4], 6, 0xf7537e82)
    d = II(d, a, b, c, x[k + 11], 10, 0xbd3af235)
    c = II(c, d, a, b, x[k + 2], 15, 0x2ad7d2bb)
    b = II(b, c, d, a, x[k + 9], 21, 0xeb86d391)

    a = addUnsigned(a, AA)
    b = addUnsigned(b, BB)
    c = addUnsigned(c, CC)
    d = addUnsigned(d, DD)
  }

  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase()
}

async function api(path, { method = 'GET', body, headers } = {}) {
  if (!state.auth.username || !state.auth.hashedKey) {
    throw new Error('Missing credentials')
  }
  const requestHeaders = new Headers(headers || {})
  requestHeaders.set('Accept', 'application/vnd.koreader.v1+json')
  requestHeaders.set('X-Auth-User', state.auth.username)
  requestHeaders.set('X-Auth-Key', state.auth.hashedKey)
  let payload
  if (body !== undefined) {
    payload = typeof body === 'string' ? body : JSON.stringify(body)
    requestHeaders.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${API_PREFIX}${path}`, {
    method,
    headers: requestHeaders,
    body: payload,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Request failed (${response.status}): ${text}`)
  }
  if (response.status === 204) {
    return null
  }
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}

function formatPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function formatTimestamp(value) {
  if (!value) return '—'
  const ms = value > 1000000000000 ? value : value * 1000
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

function renderConfig(config) {
  if (!config) return
  elements.configBaseUrl.value = config.base_url || ''
  elements.configApiKey.value = config.api_key || ''
  elements.configUserId.value = config.user_id || ''
  elements.configUserToken.value = config.user_token || ''
  elements.configDeviceName.value = config.device_name || ''
  elements.configHttpTimeout.value = config.http_timeout || ''
  elements.configUserMap.value = JSON.stringify(config.user_map || {}, null, 2)
  elements.configDocumentMap.value = JSON.stringify(config.document_map || {}, null, 2)
}

function documentKey(entry) {
  return `${entry.username}::${entry.document}`
}

function renderDocuments() {
  const tbody = elements.documentsTableBody
  if (!tbody) return
  tbody.innerHTML = ''
  state.documents.forEach((entry) => {
    const tr = document.createElement('tr')
    tr.dataset.docKey = documentKey(entry)
    if (state.selectedDocumentKey === tr.dataset.docKey) {
      tr.classList.add('selected')
    }

    const local = entry.localProgress || {}
    const remote = entry.remote || {}

    const userCell = document.createElement('td')
    userCell.textContent = entry.username
    tr.appendChild(userCell)

    const docCell = document.createElement('td')
    docCell.textContent = entry.document
    tr.appendChild(docCell)

    const localCell = document.createElement('td')
    const localParts = []
    if (local.percentage !== undefined && local.percentage !== null) {
      localParts.push(formatPercent(local.percentage))
    }
    if (local.progress) {
      localParts.push(local.progress)
    }
    if (local.timestamp) {
      localParts.push(formatTimestamp(local.timestamp))
    }
    localCell.textContent = localParts.join(' • ') || '—'
    tr.appendChild(localCell)

    const mappingCell = document.createElement('td')
    if (entry.libraryItemId) {
      const badge = document.createElement('span')
      badge.className = 'badge'
      badge.textContent = entry.libraryItemId
      mappingCell.appendChild(badge)
      if (remote.title) {
        const title = document.createElement('div')
        title.textContent = remote.title
        title.className = 'text-muted'
        mappingCell.appendChild(title)
      }
      const unlink = document.createElement('button')
      unlink.type = 'button'
      unlink.textContent = 'Unlink'
      unlink.addEventListener('click', (event) => {
        event.stopPropagation()
        unlinkMapping(entry)
      })
      mappingCell.appendChild(unlink)
    } else {
      mappingCell.textContent = 'Not linked'
    }
    tr.appendChild(mappingCell)

    const remoteCell = document.createElement('td')
    if (remote.percentage !== undefined && remote.percentage !== null) {
      const parts = [formatPercent(remote.percentage)]
      if (remote.progress) {
        parts.push(remote.progress)
      }
      if (remote.currentTime) {
        parts.push(`${remote.currentTime.toFixed ? remote.currentTime.toFixed(1) : remote.currentTime}s`)
      }
      if (remote.timestamp) {
        parts.push(formatTimestamp(remote.timestamp))
      }
      remoteCell.textContent = parts.join(' • ')
    } else if (entry.remote_error) {
      remoteCell.textContent = entry.remote_error
    } else {
      remoteCell.textContent = '—'
    }
    tr.appendChild(remoteCell)

    tr.addEventListener('click', () => {
      state.selectedDocumentKey = tr.dataset.docKey
      renderDocuments()
      log(`Selected document ${entry.document} for user ${entry.username}`)
    })

    tbody.appendChild(tr)
  })
}

function populateLibraries(libraries) {
  const select = elements.searchLibrary
  if (!select) return
  select.innerHTML = ''
  if (!Array.isArray(libraries) || libraries.length === 0) {
    const option = document.createElement('option')
    option.textContent = 'No libraries found'
    option.value = ''
    select.appendChild(option)
    return
  }
  libraries.forEach((library, index) => {
    const option = document.createElement('option')
    option.value = library.id
    option.textContent = library.name || `Library ${index + 1}`
    select.appendChild(option)
  })
}

function flattenSearchResults(payload) {
  if (!payload) return []
  const buckets = Array.isArray(payload) ? payload : Object.values(payload)
  const items = []
  buckets.forEach((bucket) => {
    if (!bucket) return
    if (Array.isArray(bucket)) {
      bucket.forEach((item) => {
        if (item && item.libraryItem) {
          items.push(item.libraryItem)
        } else if (item && item.item) {
          items.push(item.item)
        } else if (item && item.media) {
          items.push(item)
        }
      })
    } else if (bucket.libraryItem) {
      items.push(bucket.libraryItem)
    }
  })
  return items
}

function renderSearchResults(results) {
  const container = elements.searchResults
  if (!container) return
  container.innerHTML = ''
  if (!results.length) {
    const empty = document.createElement('p')
    empty.textContent = 'No matches found.'
    container.appendChild(empty)
    return
  }
  results.forEach((item) => {
    const card = document.createElement('div')
    card.className = 'result-card'
    const header = document.createElement('div')
    header.className = 'result-card__header'
    const title = document.createElement('strong')
    title.textContent = item.media?.metadata?.title || item.media?.title || item.title || item.name || 'Untitled'
    header.appendChild(title)
    const idBadge = document.createElement('span')
    idBadge.className = 'badge'
    idBadge.textContent = item.id
    header.appendChild(idBadge)
    card.appendChild(header)

    if (item.media?.authors?.length) {
      const authors = document.createElement('div')
      authors.textContent = `Authors: ${item.media.authors.map((a) => a.name || a).join(', ')}`
      card.appendChild(authors)
    }
    if (item.media?.narrators?.length) {
      const narrators = document.createElement('div')
      narrators.textContent = `Narrators: ${item.media.narrators.join(', ')}`
      card.appendChild(narrators)
    }
    if (item.media?.duration) {
      const duration = document.createElement('div')
      duration.textContent = `Duration: ${Math.round(item.media.duration / 60)} min`
      card.appendChild(duration)
    }

    const actions = document.createElement('div')
    actions.className = 'result-card__actions'
    const linkButton = document.createElement('button')
    linkButton.type = 'button'
    linkButton.textContent = 'Link to selection'
    linkButton.addEventListener('click', () => linkLibraryItem(item))
    actions.appendChild(linkButton)
    card.appendChild(actions)

    container.appendChild(card)
  })
}

function getSelectedDocument() {
  if (!state.selectedDocumentKey) return null
  return state.documents.find((doc) => documentKey(doc) === state.selectedDocumentKey) || null
}

async function linkLibraryItem(item) {
  const selected = getSelectedDocument()
  if (!selected) {
    setStatus(elements.searchStatus, 'Select a document from the table first', 'warn')
    return
  }
  try {
    setStatus(elements.searchStatus, 'Linking…')
    const payload = {
      document_map_patch: {
        [selected.document]: item.id,
      },
    }
    const response = await api('/admin/audiobookshelf/config', { method: 'PUT', body: payload })
    if (response?.config) {
      state.config = response.config
      log(`Linked document ${selected.document} to ${item.id}`, 'success')
      await refreshStatus()
      setStatus(elements.searchStatus, 'Linked successfully', 'success')
    } else if (response?.error) {
      throw new Error(response.error)
    }
  } catch (err) {
    console.error(err)
    setStatus(elements.searchStatus, err.message, 'error')
    log(`Failed to link document: ${err.message}`, 'error')
  }
}

async function unlinkMapping(entry) {
  try {
    const payload = {
      document_map_patch: {
        [entry.document]: null,
      },
    }
    const response = await api('/admin/audiobookshelf/config', { method: 'PUT', body: payload })
    if (response?.config) {
      state.config = response.config
      log(`Unlinked document ${entry.document}`, 'success')
      await refreshStatus()
    } else if (response?.error) {
      throw new Error(response.error)
    }
  } catch (err) {
    console.error(err)
    log(`Failed to unlink document ${entry.document}: ${err.message}`, 'error')
  }
}

async function loadConfig() {
  try {
    const data = await api('/admin/audiobookshelf/config')
    if (data?.config) {
      state.config = data.config
      renderConfig(data.config)
      log('Configuration loaded', 'info')
    }
  } catch (err) {
    console.error(err)
    setStatus(elements.configStatus, err.message, 'error')
    log(`Failed to load configuration: ${err.message}`, 'error')
  }
}

async function refreshStatus() {
  try {
    const data = await api('/admin/audiobookshelf/status')
    if (data?.documents) {
      state.documents = data.documents
      renderDocuments()
    }
    if (data?.config) {
      state.config = data.config
      renderConfig(state.config)
    }
  } catch (err) {
    console.error(err)
    log(`Failed to load status: ${err.message}`, 'error')
  }
}

async function loadLibraries() {
  try {
    const data = await api('/admin/audiobookshelf/libraries')
    const list = Array.isArray(data?.libraries) ? data.libraries : []
    state.libraries = list
    populateLibraries(list)
  } catch (err) {
    console.error(err)
    log(`Failed to load libraries: ${err.message}`, 'error')
  }
}

async function refreshAll() {
  await loadConfig()
  await refreshStatus()
  await loadLibraries()
}

function bindEvents() {
  elements.authForm?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const username = elements.authUsername.value.trim()
    const password = elements.authPassword.value
    if (!username || !password) {
      setStatus(elements.authStatus, 'Enter username and password', 'warn')
      return
    }
    state.auth.username = username
    const looksHashed = /^[a-f0-9]{32}$/i.test(password)
    state.auth.hashedKey = looksHashed ? password.toLowerCase() : md5(password)
    persistAuth()
    setStatus(elements.authStatus, 'Connected', 'success')
    elements.authPassword.value = ''
    try {
      await refreshAll()
    } catch (err) {
      console.error(err)
      setStatus(elements.authStatus, err.message, 'error')
    }
  })

  elements.configForm?.addEventListener('submit', async (event) => {
    event.preventDefault()
    try {
      const base_url = elements.configBaseUrl.value.trim() || null
      const api_key = elements.configApiKey.value.trim() || null
      const user_id = elements.configUserId.value.trim() || null
      const user_token = elements.configUserToken.value.trim() || null
      const device_name = elements.configDeviceName.value.trim() || null
      const http_timeout_value = elements.configHttpTimeout.value
      const http_timeout = http_timeout_value ? Number(http_timeout_value) : null
      let user_map = {}
      let document_map = {}
      const userText = elements.configUserMap.value.trim()
      if (userText) {
        user_map = JSON.parse(userText)
      }
      const docText = elements.configDocumentMap.value.trim()
      if (docText) {
        document_map = JSON.parse(docText)
      }
      const payload = {
        base_url,
        api_key,
        user_id,
        user_token,
        device_name,
        http_timeout,
        user_map,
        document_map,
      }
      setStatus(elements.configStatus, 'Saving…')
      const response = await api('/admin/audiobookshelf/config', { method: 'PUT', body: payload })
      if (response?.config) {
        state.config = response.config
        renderConfig(state.config)
        setStatus(elements.configStatus, 'Configuration saved', 'success')
        log('Configuration updated', 'success')
        await refreshStatus()
      } else if (response?.error) {
        throw new Error(response.error)
      }
    } catch (err) {
      console.error(err)
      setStatus(elements.configStatus, err.message, 'error')
      log(`Failed to save configuration: ${err.message}`, 'error')
    }
  })

  elements.searchForm?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const libraryId = elements.searchLibrary.value
    const query = elements.searchQuery.value.trim()
    if (!libraryId) {
      setStatus(elements.searchStatus, 'Choose a library first', 'warn')
      return
    }
    if (!query) {
      setStatus(elements.searchStatus, 'Enter a search query', 'warn')
      return
    }
    try {
      setStatus(elements.searchStatus, 'Searching…')
      const params = new URLSearchParams({ q: query, limit: '25' })
      const data = await api(`/admin/audiobookshelf/libraries/${encodeURIComponent(libraryId)}/search?${params.toString()}`)
      if (data?.error) {
        throw new Error(data.error)
      }
      const results = flattenSearchResults(data?.results || data)
      renderSearchResults(results)
      setStatus(elements.searchStatus, `${results.length} matches`, 'success')
    } catch (err) {
      console.error(err)
      setStatus(elements.searchStatus, err.message, 'error')
      log(`Search failed: ${err.message}`, 'error')
    }
  })
}

async function bootstrap() {
  loadStoredAuth()
  bindEvents()
  if (state.auth.username && state.auth.hashedKey) {
    setStatus(elements.authStatus, 'Using stored credentials', 'info')
    try {
      await refreshAll()
    } catch (err) {
      console.error(err)
      setStatus(elements.authStatus, err.message, 'error')
    }
  }
}

bootstrap()
