/**
 * A dependency-free, allowlist-based HTML sanitizer.
 *
 * Shownotes come from Xiaoyuzhou's public page and are rendered with
 * dangerouslySetInnerHTML, so they must be treated as untrusted. This runs on
 * both the server (during parsing) and the client (defense in depth) and never
 * relies on a DOM parser.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'a',
  'hr',
  'img',
  'span',
  'sup',
  'sub',
  'small',
  'figure',
  'figcaption',
])

const VOID_TAGS = new Set(['br', 'hr', 'img'])

/** Skipped as a whole, but never swallow the rest of the document. */
const VOID_DROP_TAGS = new Set(['input', 'link', 'meta', 'base', 'embed'])

/** Tags whose entire content is discarded. */
const DROP_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
  'noscript',
  'textarea',
  'title',
  'form',
  'input',
  'button',
  'select',
  'option',
  'link',
  'meta',
  'base',
])

const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  colon: ':',
  sol: '/',
  middot: '·',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
}

export function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      const key = entity.toLowerCase()
      if (key.startsWith('#x')) {
        return String.fromCodePoint(Number.parseInt(key.slice(2), 16))
      }
      if (key.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(key.slice(1), 10))
      }
      return NAMED_ENTITIES[key] ?? match
    },
  )
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function isSafeUrl(rawValue: string): boolean {
  const value = decodeHtmlEntities(rawValue)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()

  if (value.startsWith('//')) {
    return false
  }

  if (value.startsWith('/') || value.startsWith('#')) {
    return true
  }

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)
  if (!scheme) {
    return false
  }

  return ['http', 'https', 'mailto'].includes(scheme[1].toLowerCase())
}

function findTagEnd(html: string, start: number): number {
  let quote = ''
  for (let index = start + 1; index < html.length; index += 1) {
    const char = html[index]
    if (quote) {
      if (char === quote) {
        quote = ''
      }
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '>') {
      return index
    }
  }
  return -1
}

function buildOpeningTag(
  name: string,
  rawAttributes: string,
): string {
  const parts: string[] = []
  const allowed = TAG_ATTRIBUTES[name]

  if (allowed) {
    const attributePattern =
      /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
    let match: RegExpExecArray | null

    while ((match = attributePattern.exec(rawAttributes)) !== null) {
      const attribute = match[1].toLowerCase()
      if (!allowed.has(attribute)) {
        continue
      }

      let value = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '')

      if (attribute === 'href' || attribute === 'src') {
        if (!isSafeUrl(value)) {
          continue
        }
        value = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
      } else if (attribute === 'width' || attribute === 'height') {
        value = value.replace(/[^0-9]/g, '')
        if (!value) {
          continue
        }
      }

      parts.push(`${attribute}="${escapeAttribute(value)}"`)
    }
  }

  if (name === 'a') {
    parts.push('target="_blank"')
    parts.push('rel="noopener noreferrer nofollow"')
  }
  if (name === 'img') {
    parts.push('loading="lazy"')
    parts.push('referrerpolicy="no-referrer"')
  }

  const attributes = parts.length > 0 ? ` ${parts.join(' ')}` : ''
  return `<${name}${attributes}${VOID_TAGS.has(name) ? ' /' : ''}>`
}

export function sanitizeHtml(input: string): string {
  if (!input) {
    return ''
  }

  let output = ''
  let index = 0

  while (index < input.length) {
    const open = input.indexOf('<', index)
    if (open === -1) {
      output += input.slice(index)
      break
    }

    output += input.slice(index, open)

    if (input.startsWith('<!--', open)) {
      const end = input.indexOf('-->', open + 4)
      index = end === -1 ? input.length : end + 3
      continue
    }

    const close = findTagEnd(input, open)
    if (close === -1) {
      output += '&lt;'
      index = open + 1
      continue
    }

    const inner = input.slice(open + 1, close)

    // Doctype, CDATA and processing instructions never carry content.
    if (inner.startsWith('!') || inner.startsWith('?')) {
      index = close + 1
      continue
    }

    const match = /^(\/?)([a-zA-Z][a-zA-Z0-9:-]*)([\s\S]*)$/.exec(inner)

    if (!match) {
      output += '&lt;'
      index = open + 1
      continue
    }

    const closing = match[1] === '/'
    const name = match[2].toLowerCase()
    const rest = match[3] ?? ''
    const selfClosing = /\/\s*$/.test(rest)
    const rawAttributes = selfClosing ? rest.replace(/\/\s*$/, '') : rest

    index = close + 1

    if (DROP_CONTENT_TAGS.has(name)) {
      if (!closing && !VOID_DROP_TAGS.has(name)) {
        const lower = input.toLowerCase()
        const closingStart = lower.indexOf(`</${name}`, index)
        if (closingStart === -1) {
          index = input.length
        } else {
          const closingEnd = input.indexOf('>', closingStart)
          index = closingEnd === -1 ? input.length : closingEnd + 1
        }
      }
      continue
    }

    if (!ALLOWED_TAGS.has(name)) {
      continue
    }

    if (closing) {
      if (!VOID_TAGS.has(name)) {
        output += `</${name}>`
      }
      continue
    }

    output += buildOpeningTag(name, rawAttributes)
  }

  return output
}
