import { hubRepo } from './engines.js'
import { boxRow, fieldRow, finish } from './ui.js'

const STABLE = /^[0-9]+\.[0-9]+(\.[0-9]+)?$/
const SQLSRV = /^([0-9]{4})-CU([0-9]+)-ubuntu-([0-9]+)\.([0-9]+)$/

function sleep (seconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000)
  })
}

async function request (url) {
  let status = 0
  let text = ''

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let response
    try {
      response = await fetch(url, {
        headers: { 'user-agent': 'lihtne' },
        signal: AbortSignal.timeout(60_000)
      })
    } catch (error) {
      status = 0
      text = error instanceof Error ? error.message : 'request failed'
      if (attempt < 4) {
        await sleep(attempt)
        continue
      }
      return { status, text, headers: new Headers() }
    }

    status = response.status
    text = await response.text()
    if (status === 200) {
      return { status, text, headers: response.headers }
    }
    if ([429, 500, 502, 503, 504].includes(status) && attempt < 4) {
      await sleep(attempt)
      continue
    }
    return { status, text, headers: response.headers }
  }

  return { status, text, headers: new Headers() }
}

function messageOf (text) {
  try {
    const body = JSON.parse(text)
    return typeof body.message === 'string' ? body.message : ''
  } catch {
    return ''
  }
}

function compareVersions (left, right) {
  const a = left.split('.')
  const b = right.split('.')
  for (let index = 0; index < 3; index += 1) {
    const av = Number(a[index] ?? 0)
    const bv = Number(b[index] ?? 0)
    if (av > bv) {
      return 1
    }
    if (av < bv) {
      return -1
    }
  }
  return 0
}

function highestStable (tags) {
  let best = ''
  for (const tag of tags) {
    if (!STABLE.test(tag)) {
      continue
    }
    if (!best || compareVersions(tag, best) > 0) {
      best = tag
    }
  }
  return best
}

function compareRank (left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] > right[index]) {
      return 1
    }
    if (left[index] < right[index]) {
      return -1
    }
  }
  return 0
}

function newestSqlsrv (tags) {
  let best = ''
  let bestRank = null
  for (const tag of tags) {
    const match = SQLSRV.exec(tag)
    if (!match) {
      continue
    }
    const rank = match.slice(1).map(Number)
    if (!bestRank || compareRank(rank, bestRank) > 0) {
      best = tag
      bestRank = rank
    }
  }
  return best
}

async function downloadHubTags (repo) {
  const tags = []
  let url = `https://hub.docker.com/v2/repositories/library/${repo}/tags?page_size=100`

  for (let page = 1; url && page <= 50; page += 1) {
    const response = await request(url)
    if (response.status !== 200) {
      const message = messageOf(response.text)
      if (message.includes('pagination offset')) {
        url = ''
        break
      }
      if (!response.status) {
        throw new Error(
          response.text || `Could not reach Docker Hub for library/${repo}.`
        )
      }
      throw new Error(
        message ||
          `Docker Hub returned HTTP ${response.status} for library/${repo}.`
      )
    }

    let body
    try {
      body = JSON.parse(response.text)
    } catch {
      throw new Error(`Docker Hub returned invalid JSON for library/${repo}.`)
    }
    if (typeof body.message === 'string') {
      throw new Error(body.message)
    }
    for (const result of body.results ?? []) {
      if (result?.name) {
        tags.push(result.name)
      }
    }
    url = body.next || ''
  }

  if (url) {
    throw new Error(`Stopped after 50 Docker Hub pages for library/${repo}.`)
  }
  return tags
}

function nextLink (headers) {
  const link = headers.get('link') || ''
  const match = /<([^>]+)>;\s*rel="next"/.exec(link)
  if (!match) {
    return ''
  }
  const target = match[1]
  return target.startsWith('/') ? `https://mcr.microsoft.com${target}` : target
}

async function downloadMcrTags () {
  const tags = []
  let url = 'https://mcr.microsoft.com/v2/mssql/server/tags/list'

  for (let page = 1; url && page <= 20; page += 1) {
    const response = await request(url)
    if (response.status !== 200) {
      throw new Error(
        response.status
          ? `Microsoft Container Registry returned HTTP ${response.status}.`
          : response.text || 'Could not reach Microsoft Container Registry.'
      )
    }
    let body
    try {
      body = JSON.parse(response.text)
    } catch {
      throw new Error('Microsoft Container Registry returned invalid JSON.')
    }
    for (const tag of body.tags ?? []) {
      tags.push(tag)
    }
    url = nextLink(response.headers)
  }

  return tags
}

export async function resolveHubEngine (engine, version, resolved) {
  const repo = hubRepo(engine)
  boxRow('cyan', `› Read Docker Hub tags for library/${repo}`)
  let tags
  try {
    tags = await downloadHubTags(repo)
  } catch (error) {
    finish(2, 'red', 'Result', [`✗ ${error.message}`])
  }
  if (version) {
    if (!tags.includes(version)) {
      finish(2, 'red', 'Result', [
        `✗ Tag '${version}' was not found for ${engine}.`
      ])
    }
    resolved[engine] = version
    fieldRow('green', engine, version)
    return
  }
  const best = highestStable(tags)
  if (!best) {
    finish(2, 'red', 'Result', [`✗ No stable version tag found for ${engine}.`])
  }
  resolved[engine] = best
  fieldRow('green', engine, best)
}

export async function resolveSqlsrv (version, resolved) {
  boxRow('cyan', '› Read SQL Server tags from Microsoft Container Registry')
  let tags
  try {
    tags = await downloadMcrTags()
  } catch (error) {
    finish(2, 'red', 'Result', [`✗ ${error.message}`])
  }
  if (version) {
    if (!tags.includes(version)) {
      finish(2, 'red', 'Result', [
        `✗ Tag '${version}' was not found for sqlsrv.`
      ])
    }
    resolved.sqlsrv = version
    fieldRow('green', 'sqlsrv', version)
    return
  }
  const best = newestSqlsrv(tags)
  if (!best) {
    finish(2, 'red', 'Result', [
      '✗ No SQL Server cumulative update tag was found.'
    ])
  }
  resolved.sqlsrv = best
  fieldRow('green', 'sqlsrv', best)
}
