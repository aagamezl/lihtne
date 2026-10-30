import { styleText } from 'node:util'

const colorsEnabled =
  process.stdout.isTTY === true &&
  !process.env.NO_COLOR &&
  process.env.TERM !== 'dumb'

let width = 68
let open = false
let border = ''

export function paint (format, text = '') {
  if (!format || !colorsEnabled) {
    return text
  }

  return styleText(format, text)
}

function write (line) {
  process.stdout.write(`${line}\n`)
}

function length (text) {
  return Array.from(text).length
}

function repeat (char, count) {
  if (count < 1) {
    return ''
  }

  return char.repeat(count)
}

export function chooseWidth (titles) {
  const longest = titles.reduce((max, title) => Math.max(max, length(title)), 0)
  let needed = Math.max(68, longest + 6)

  if (process.stdout.isTTY) {
    const cols = Math.max(2, (process.stdout.columns || 80) - 1)
    if (needed > cols) {
      needed = cols
    }
  } else if (needed > 68) {
    needed = 68
  }

  width = needed
}

function bannerRow (format, text) {
  const max = width - 4
  let shown = text
  if (length(shown) > max) {
    shown = `${Array.from(shown)
      .slice(0, max - 1)
      .join('')}…`
  }
  const pad = max - length(shown)
  write(
    `${paint('cyan', '┃')} ${paint(format, shown)}${' '.repeat(pad)} ${paint('cyan', '┃')}`
  )
}

export function banner (subtitle) {
  const dashes = repeat('━', width - 2)
  write(paint('cyan', `┏${dashes}┓`))
  bannerRow('bold', 'lihtne')
  bannerRow('', subtitle)
  write(paint('cyan', `┗${dashes}┛`))
  write('')
}

export function sectionOpen (title, format) {
  if (open) {
    sectionClose()
  }

  border = format
  let shown = title
  let maxTitle = width - 6
  if (maxTitle < 1) {
    maxTitle = 1
  }
  if (length(shown) > maxTitle) {
    shown =
      maxTitle === 1
        ? '…'
        : `${Array.from(shown)
          .slice(0, maxTitle - 1)
          .join('')}…`
  }
  let dashes = width - length(shown) - 5
  if (dashes < 1) {
    dashes = 1
  }
  write(
    `${paint(border, '╭─ ')}${paint('bold', shown)}${paint(border, ` ${repeat('─', dashes)}╮`)}`
  )
  open = true
}

export function sectionClose () {
  if (!open) {
    return
  }

  write(paint(border, `╰${repeat('─', width - 2)}╯`))
  write('')
  open = false
}

export function boxRow (format, text) {
  const max = width - 4
  if (!text) {
    write(
      `${paint(border, '│')} ${' '.repeat(Math.max(0, width - 4))} ${paint(border, '│')}`
    )
    return
  }

  let prefix = ''
  let rest = text
  while (rest) {
    const room = max - length(prefix)
    let chunk
    if (length(rest) <= room) {
      chunk = `${prefix}${rest}`
      rest = ''
    } else {
      const chars = Array.from(rest)
      chunk = chars.slice(0, Math.max(0, room)).join('')
      if (chunk.includes(' ')) {
        const trimmed = chunk.slice(0, chunk.lastIndexOf(' '))
        if (trimmed) {
          chunk = trimmed
        }
      } else if (chunk.includes('/') && !chunk.endsWith('/')) {
        const trimmed = chunk.slice(0, chunk.lastIndexOf('/') + 1)
        if (trimmed) {
          chunk = trimmed
        }
      }
      rest = Array.from(rest).slice(length(chunk)).join('').replace(/^ /, '')
      chunk = `${prefix}${chunk}`
    }
    const pad = max - length(chunk)
    write(
      `${paint(border, '│')} ${paint(format, chunk)}${' '.repeat(Math.max(0, pad))} ${paint(border, '│')}`
    )
    prefix = '  '
  }
}

export function boxBlank () {
  boxRow('', '')
}

export function boxLines (format, text) {
  if (!text) {
    return
  }

  for (const line of text.split('\n')) {
    boxRow(format, line ? `  ${line}` : '')
  }
}

export function fieldRow (format, label, value) {
  boxRow(format, `${label.padEnd(14, ' ')} ${value}`)
}

export function finish (code, format, title, lines = []) {
  sectionClose()
  sectionOpen(title, format)
  if (lines.length === 0) {
    boxBlank()
  } else {
    for (const line of lines) {
      boxRow(format, line)
    }
  }
  sectionClose()
  process.exit(code)
}
