// src/scripts/indexAlgolia.js
// Pushes ALL site content to Algolia — pages, static HTML, books, excerpts, quiz.
// Run manually:  npm run index
// Or add to your Hostinger deploy hook after build.

import { algoliasearch } from 'algoliasearch'
import { createClient }   from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath }  from 'url'
import { dirname, join }  from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Clients ───────────────────────────────────────────────────────────────────

const algolia = algoliasearch(
  process.env.VITE_ALGOLIA_APP_ID,
  process.env.ALGOLIA_ADMIN_KEY
)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_API_KEY
)

const INDEX_NAME = 'panuri'

// ── HTML text extractor ───────────────────────────────────────────────────────

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMeta(html, name) {
  const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
            ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'))
  return m?.[1] ?? ''
}

function extractTagText(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, 'gi')
  const hits = []
  let m
  while ((m = re.exec(html)) !== null) hits.push(m[1].trim())
  return hits.filter(Boolean)
}

function extractInternalLinks(html, baseUrl) {
  const origin = new URL(baseUrl).origin
  const re = /href=["']([^"'#?]+)["']/gi
  const links = new Set()
  let m
  while ((m = re.exec(html)) !== null) {
    const href = m[1]
    try {
      const resolved = new URL(href, baseUrl)
      // Only follow same-origin links, skip files
      if (
        resolved.origin === origin &&
        !resolved.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|json|xml|txt|pdf|woff|woff2|ttf|eot)$/i)
      ) {
        links.add(resolved.origin + resolved.pathname)
      }
    } catch {}
  }
  return [...links]
}

function htmlToRecord(html, pageUrl, siteOrigin) {
  const urlObj      = new URL(pageUrl)
  const path        = urlObj.pathname

  const title       = (extractTagText(html, 'title')[0] ?? path).replace(/\s*[\|–\-].*$/, '').trim()
  const description = extractMeta(html, 'description') || extractMeta(html, 'og:description')
  const h1s         = extractTagText(html, 'h1')
  const h2s         = extractTagText(html, 'h2')
  const h3s         = extractTagText(html, 'h3')
  const paragraphs  = extractTagText(html, 'p')
  const listItems   = extractTagText(html, 'li')
  const bodyRaw     = stripHtml(html)
  const body        = bodyRaw.slice(0, 5000)

  if (bodyRaw.length < 80) return null   // skip empty shells

  return {
    objectID:    `crawled-${path.replace(/\//g, '-').replace(/^-|-$/g, '') || 'home'}`,
    title:       title || path,
    subtitle:    description || h1s[0] || '',
    category:    'Pahina',
    path,
    body,
    headings:    [...h1s, ...h2s, ...h3s].join(' | '),
    paragraphs:  paragraphs.slice(0, 20).join(' '),
    listContent: listItems.slice(0, 30).join(' '),
    keywords:    [...h1s, ...h2s, description].filter(Boolean),
  }
}

// ── Live site spider ──────────────────────────────────────────────────────────
// Fetches https://www.panuri.online/ and follows every internal link it finds.
// Respects a concurrency limit and a max-pages cap so it never runs forever.

const SITE_URL      = process.env.SITE_URL ?? 'https://www.panuri.online/'
const MAX_PAGES     = 200   // safety cap
const CONCURRENCY   = 5     // parallel fetches at a time
const FETCH_TIMEOUT = 10000 // ms per page

async function fetchPage(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PanuriAlgoliaBot/1.0' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/html')) return null
    return await res.text()
  } catch {
    clearTimeout(timer)
    return null
  }
}

async function crawlSite() {
  const origin   = new URL(SITE_URL).origin
  const visited  = new Set()
  const queue    = [SITE_URL]
  const records  = []

  console.log(`🕷️  Crawling ${SITE_URL} …`)

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    // Take up to CONCURRENCY URLs from the queue
    const batch = queue.splice(0, CONCURRENCY).filter(u => !visited.has(u))
    if (batch.length === 0) continue

    batch.forEach(u => visited.add(u))

    const results = await Promise.all(batch.map(async url => {
      const html = await fetchPage(url)
      if (!html) return { url, html: null, links: [] }
      const links = extractInternalLinks(html, url)
      return { url, html, links }
    }))

    for (const { url, html, links } of results) {
      if (!html) continue

      const record = htmlToRecord(html, url, origin)
      if (record) records.push(record)

      // Enqueue undiscovered links
      for (const link of links) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link)
        }
      }
    }

    process.stdout.write(`\r   Pages crawled: ${visited.size} | Queue: ${queue.length}   `)
  }

  console.log(`\n   Done. ${records.length} indexable pages found (${visited.size} visited).`)
  return records
}

// ── Static page definitions ───────────────────────────────────────────────────

const STATIC_PAGES = [
  {
    objectID: 'page-home',
    title:    'Home',
    subtitle: 'Pangunahing pahina ng Panitikan',
    category: 'Pahina',
    path:     '/',
    keywords: ['home', 'tahanan', 'pangunahin', 'simula'],
  },
  {
    objectID: 'page-mga-libro',
    title:    'Mga Libro',
    subtitle: 'Koleksyon ng mga akdang pampanitikan',
    category: 'Pahina',
    path:     '/mga-libro',
    keywords: ['libro', 'books', 'akda', 'koleksyon', 'library'],
  },
  {
    objectID: 'page-excerpts',
    title:    'Mga Excerpt',
    subtitle: 'Mga piling sipi mula sa mga akda',
    category: 'Pahina',
    path:     '/excerpts',
    keywords: ['excerpt', 'sipi', 'talata', 'quote'],
  },
  {
    objectID: 'page-pagsusuri',
    title:    'Pagsusuri',
    subtitle: 'Pagsusuri ng mga akdang pampanitikan',
    category: 'Pahina',
    path:     '/pagsusuri',
    keywords: ['pagsusuri', 'analysis', 'review', 'kritikal', 'suri'],
  },
  {
    objectID: 'page-pagsusulit',
    title:    'Pagsusulit',
    subtitle: 'Mga pagsubok at quiz tungkol sa panitikan',
    category: 'Pahina',
    path:     '/pagsusulit',
    keywords: ['pagsusulit', 'quiz', 'pagsubok', 'test', 'tanong'],
  },
  {
    objectID: 'page-magsuri',
    title:    'Magsuri Tayo',
    subtitle: 'Interaktibong pagsusuri ng teksto',
    category: 'Pahina',
    path:     '/magsuri',
    keywords: ['magsuri', 'suri', 'interaktibo', 'teksto', 'analyze'],
  },
  {
    objectID: 'page-teorya',
    title:    'Teoryang Pampanitikan',
    subtitle: 'Mga teorya at pamamaraan ng pagsusuri ng panitikan',
    category: 'Pahina',
    path:     '/teorya',
    keywords: [
      'teorya', 'theory', 'pampanitikan', 'literary',
      'formalism', 'structuralism', 'marxism', 'marxismo',
      'feminism', 'feminismo', 'postcolonial', 'dekonstruksiyon',
      'new criticism', 'reader response', 'psychoanalysis',
    ],
  },
  {
    objectID: 'page-bagong-pamantayan',
    title:    'Bagong Pamantayan',
    subtitle: 'Mga bagong pamantayan sa pagsusuri ng panitikan',
    category: 'Pahina',
    path:     '/bagong-pamantayan',
    keywords: ['bagong', 'pamantayan', 'criteria', 'standards', 'panuntunan'],
  },
  {
    objectID: 'page-tungkol-sa',
    title:    'Tungkol Sa Amin',
    subtitle: 'Impormasyon tungkol sa website na ito',
    category: 'Pahina',
    path:     '/tungkol-sa',
    keywords: ['tungkol', 'about', 'amin', 'team', 'impormasyon', 'contact'],
  },
  {
    objectID: 'page-profile',
    title:    'Profile',
    subtitle: 'Iyong personal na account at mga setting',
    category: 'Pahina',
    path:     '/profile',
    keywords: ['profile', 'account', 'gumagamit', 'user', 'settings'],
  },
]

// ── books.json ────────────────────────────────────────────────────────────────

function loadStaticBooks() {
  const filePath = join(__dirname, '../data/books.json')
  if (!existsSync(filePath)) {
    console.warn('⚠️  books.json not found — skipping static books')
    return []
  }
  const data = JSON.parse(readFileSync(filePath, 'utf-8'))

  return data.map(item => ({
    objectID:    `static-book-${item.id}`,
    title:       item.title,
    subtitle:    item.author ?? '',
    description: item.description ?? '',
    category:    'Mga Libro',
    path:        `/libro/${item.id}`,
    // Index as much metadata as available
    keywords: [
      item.title,
      item.author,
      item.genre,
      item.publisher,
      item.language,
      String(item.year ?? ''),
    ].filter(Boolean),
    body: [item.description, item.summary, item.synopsis].filter(Boolean).join(' '),
  }))
}

// ── Supabase fetchers ─────────────────────────────────────────────────────────

async function fetchSupabaseBooks() {
  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, genre, year, description, summary, publisher, language')

  if (error) { console.error('Supabase books error:', error); return [] }

  return data.map(item => ({
    objectID:    `book-${item.id}`,
    title:       item.title,
    subtitle:    item.author ?? '',
    description: item.description ?? '',
    category:    'Mga Libro',
    path:        `/libro/${item.id}`,
    body:        [item.description, item.summary].filter(Boolean).join(' '),
    keywords:    [item.author, item.genre, item.publisher, item.language, String(item.year ?? '')].filter(Boolean),
  }))
}

async function fetchSupabaseExcerpts() {
  const { data, error } = await supabase
    .from('excerpts')
    .select('id, bookTitle, author, tag, excerpt')

  if (error) { console.error('Supabase excerpts error:', error); return [] }

  return data.map(item => ({
    objectID: `excerpt-${item.id}`,
    title:    item.bookTitle,
    subtitle: item.author
      ? `ni ${item.author}${item.tag ? ` · ${item.tag}` : ''}`
      : item.tag ?? '',
    category: 'Excerpt',
    path:     `/excerpts#${item.id}`,
    body:     item.excerpt ?? '',
    keywords: [item.author, item.tag, item.bookTitle].filter(Boolean),
  }))
}

async function fetchSupabaseQuizSets() {
  const { data, error } = await supabase
    .from('quiz_sets')
    .select('id, title, category, difficulty, description')

  if (error) { console.error('Supabase quiz_sets error:', error); return [] }

  return data.map(item => ({
    objectID: `quiz-set-${item.id}`,
    title:    item.title,
    subtitle: item.difficulty
      ? `${item.difficulty}${item.category ? ` · ${item.category}` : ''}`
      : item.category ?? '',
    body:     item.description ?? '',
    category: 'Pagsusulit',
    path:     `/pagsusulit`,
    keywords: [item.category, item.difficulty, item.title].filter(Boolean),
  }))
}

async function fetchSupabaseQuiz() {
  const { data, error } = await supabase
    .from('quiz')
    .select('id, question, answer, choices, category, difficulty')

  if (error) { console.error('Supabase quiz error:', error); return [] }

  return data.map(item => {
    // Index choices/answers so searching for an answer keyword finds the question
    const choicesText = Array.isArray(item.choices) ? item.choices.join(' ') : (item.choices ?? '')
    return {
      objectID: `quiz-${item.id}`,
      title:    item.question,
      subtitle: item.difficulty
        ? `${item.difficulty}${item.category ? ` · ${item.category}` : ''}`
        : item.category ?? '',
      body:     [choicesText, item.answer].filter(Boolean).join(' '),
      category: 'Quiz',
      path:     `/pagsusulit`,
      keywords: [item.category, item.difficulty, item.answer].filter(Boolean),
    }
  })
}

// ── Inlined hakbang.json content ──────────────────────────────────────────────
// Source: hakbang.json (Mga Hakbang sa Mabuting Pagsusuri ng Akdang Pampanitikan)

const HAKBANG_DATA = [
  {
    number: 1,
    title: 'Paunang Pagbasa at Pag-unawa sa Akda',
    content: 'Unang hakbang sa mabuting pagsusuri ang masusing pagbasa ng akda upang maunawaan ang kabuuang daloy, tema, at nilalaman nito. Dapat tukuyin ang pangunahing ideya, tauhan, tagpuan, at banghay ng akda. Mahalaga ang paulit-ulit na pagbasa ng teksto upang higit na mapalalim ang pag-unawa. Sa yugtong ito, iniiwasan muna ang agarang paghusga at inuunawa lamang ang kabuuang konteksto ng isang akda. Layunin nitong mabuo ang pundamental na kaalaman tungkol sa akdang sinusuri.',
  },
  {
    number: 2,
    title: 'Pagtukoy sa Layunin, Tema, at Mensahe',
    content: 'Matapos maunawaan ang akda, sinusuri ang layunin ng may-akda at ang temang nais ipahayag. Kailangang tukuyin kung ano ang mensaheng nais ipaabot nito sa mambabasa. Maaaring ito ay may kinalaman sa lipunan, moralidad, o karanasan ng tao. Mahalaga ang pagkilala sa sentral na ideya upang maging gabay sa pagsusuri. Ito ang magsisilbing direksyon ng interpretasyon o ng gagawing pagsusuri.',
  },
  {
    number: 3,
    title: 'Pagsusuri sa Elemento ng Akda',
    content: 'Sinusuri ang mahahalagang elemento tulad ng tauhan, banghay, tagpuan, tunggalian, at pananaw. Sinusuri rin dito ang mga simbolismo at mga tayutay na kinikilala sa masining na pagsulat na siyang nagpapaantig sa pagsusuri. Tinitingnan kung paano nagkakaugnay ang mga ito upang mabuo ang kabuuang akda. Mahalaga ring suriin ang istilo ng pagsulat, wika, at emosyon na nakapaloob sa buong akda. Sa hakbang na ito, nahihimay ang estruktura ng akda at nagbibigay ito ng mas sistematikong pag-unawa.',
  },
  {
    number: 4,
    title: 'Paglalapat ng Teoryang Pampanitikan',
    content: 'Isinasailalim ang akda sa isang angkop na teoryang pampanitikan (hal. realismo, feminismo, historikal, atbp.). Nakakatulong ito upang magkaroon ng mas malalim at akademikong interpretasyon at repleksyon sa isinusuring akda. Sa pamamagitan nito, mas nauunawaan ang akda sa iba\'t ibang perspektiba, pinapalawak ang saklaw ng pagsusuri at nagiging mas kritikal at makabuluhan ang pagtalakay.',
  },
  {
    number: 5,
    title: 'Pagbibigay ng Interpretasyon at Kritikal na Pagsusuri',
    content: 'Sa bahaging ito, inilalahad ang sariling pagsusuri at interpretasyon batay sa ebidensya mula sa akda. Dapat lohikal, malinaw, at suportado ang bawat pahayag. Hindi lamang inilalarawan ang akda kundi sinusuri ang kahalagahan at implikasyon nito. Mahalaga ang pagiging obhetibo at makatarungan. Dito naipapakita ang lalim ng pag-unawa sa sinusuring akdang pampanitikan.',
  },
  {
    number: 6,
    title: 'Pag-uugnay sa Konteksto at Kahalagahan',
    content: 'Iniuugnay ang akda sa kontekstong panlipunan, historikal, o kultural. Tinutukoy ang kabuluhan nito sa kasalukuyang panahon o sa karanasan ng mambabasa. Nakakatulong ito upang maging mas makabuluhan ang pagsusuri. Ipinapakita rin nito ang lawak ng pag-unawa ng nagsusuri. Ang akda ay nagiging buhay at may saysay sa reyalidad.',
  },
  {
    number: 7,
    title: 'Pagbuo ng Kongklusyon',
    content: 'Sa huling bahagi, binubuod ang mahahalagang natuklasan mula sa pagsusuri. Dapat malinaw na naipapakita ang kabuuang interpretasyon at pagpapahalaga sa akda. Inilalahad kung bakit mahalaga ang akda at ang naging ambag nito. Ang kongklusyon ay nagsisilbing pangwakas na pagninilay. Dito nagiging ganap ang buong pagsusuri.',
  },
]

function loadHakbang() {
  // Try reading from file first (respects any edits made to the JSON)
  const filePath = join(__dirname, '../data/hakbang.json')
  const items = existsSync(filePath)
    ? JSON.parse(readFileSync(filePath, 'utf-8'))
    : HAKBANG_DATA

  return items.map(item => ({
    objectID: `hakbang-${item.number}`,
    title:    `Hakbang ${item.number}: ${item.title}`,
    subtitle: 'Mga Hakbang sa Mabuting Pagsusuri ng Akdang Pampanitikan',
    category: 'Pagsusuri',
    path:     '/pagsusuri',
    body:     item.content ?? '',
    keywords: [
      'hakbang', 'pagsusuri', 'akdang pampanitikan',
      item.title,
      // Index each sentence separately as a keyword for better matching
      ...item.content.split('. ').map(s => s.trim()).filter(Boolean),
    ],
  }))
}

// ── Inlined layunin.json content ──────────────────────────────────────────────
// Source: layunin.json (Layunin ng Pagsusuri)

const LAYUNIN_DATA = [
  {
    number: '01',
    label: 'Pagpapalalim ng Pag-unawa',
    content: 'Ang pagsusuri ay tumutulong upang maunawaan ang isang paksa hindi lamang sa mababaw na antas kundi sa mas malalim at mas makabuluhang paraan. Sa pamamagitan ng paghimay ng ideya, natutukoy ang tunay na kahulugan at layunin nito. Nagbibigay ito ng mas malinaw na perspektibo sa mga impormasyon. Dahil dito, nagiging mas matibay ang pundasyon ng kaalaman. Ang malalim na pag-unawa ay mahalaga sa akademiko at sa pang-araw-araw na buhay.',
  },
  {
    number: '02',
    label: 'Paglinang ng Kritikal na Pag-iisip',
    content: 'Sa pagsusuri, nahahasa ang kakayahang mag-isip nang lohikal at mapanuri. Natututuhan ng isang indibidwal na kwestyunin ang impormasyon sa halip na basta tanggapin ito. Nagiging maingat siya sa pagbuo ng konklusyon. Mahalaga ito upang maiwasan ang maling paniniwala o impormasyon. Sa ganitong paraan, nagiging mas responsable ang pag-iisip.',
  },
  {
    number: '03',
    label: 'Pagbibigay ng Matibay na Argumento',
    content: 'Ang pagsusuri ay nagbibigay kakayahan sa isang tao na makabuo ng argumento na may sapat na ebidensya. Hindi lamang opinyon ang ipinapahayag kundi may batayan at lohika. Nakakatulong ito sa pagpapaliwanag at pagtatanggol ng sariling pananaw. Mahalaga ito sa mga diskusyon, debate, at akademikong sulatin. Sa huli, nagiging mas kapani-paniwala ang mga ideya.',
  },
  {
    number: '04',
    label: 'Pagkilala sa Iba\'t ibang Pananaw',
    content: 'Sa pamamagitan ng pagsusuri, natututuhan ang pagtingin sa isang isyu mula sa iba\'t ibang perspektiba. Nakakatulong ito upang maging bukas ang isipan at maiwasan ang pagiging makitid ang pananaw. Nauunawaan ang iba\'t ibang opinyon at konteksto. Dahil dito, nagiging mas makatarungan at balanseng mag-isip. Ito rin ay mahalaga sa pakikipagkapwa at pakikipagtalastasan.',
  },
  {
    number: '05',
    label: 'Paghahanda sa Pagpapasya at Problema',
    content: 'Ang pagsusuri ay mahalagang kasangkapan sa paggawa ng matalinong desisyon. Sa pamamagitan ng pagtitimbang ng ebidensya at impormasyon, mas napipili ang tamang hakbang o solusyon. Nakakatulong ito sa paglutas ng mga suliranin sa sistematikong paraan. Hindi padalos-dalos ang pagdedesisyon dahil ito ay pinag-isipan. Sa ganitong paraan, nagiging mas epektibo at responsable ang isang indibidwal sa kanyang mga kilos at pasya.',
  },
]

function loadLayunin() {
  // Try reading from file first
  const filePath = join(__dirname, '../data/layunin.json')
  const items = existsSync(filePath)
    ? JSON.parse(readFileSync(filePath, 'utf-8'))
    : LAYUNIN_DATA

  return items.map(item => ({
    objectID: `layunin-${item.number}`,
    title:    `Layunin ${item.number}: ${item.label}`,
    subtitle: 'Layunin ng Pagsusuri',
    category: 'Pagsusuri',
    path:     '/pagsusuri',
    body:     item.content ?? '',
    keywords: [
      'layunin', 'pagsusuri', item.label,
      // Each sentence as a keyword for granular matching
      ...item.content.split('. ').map(s => s.trim()).filter(Boolean),
    ],
  }))
}

// ── Inlined static content from React components ──────────────────────────────
// Source: Pagsusuri.jsx → LEVELS array

const PAGSUSURI_LEVELS = [
  { id: 'pag-unawa',       letter: 'P', heading: 'Pag-unawa',       text: 'Ito ang unang hakbang sa pagsusuri kung saan inuunawa ang kabuuang ideya ng teksto o paksa. Mahalaga ang malinaw na pag-unawa upang magkaroon ng matibay na pundasyon sa susunod na hakbang. Hindi maaaring magsuri ang isang indibidwal kung hindi lubos na nauunawaan ang binabasa o pinag-aaralan. Dito nagsisimula ang mas malalim na pag-iisip at ito rin ang susi upang maiwasan ang maling interpretasyon.' },
  { id: 'analisis',        letter: 'A', heading: 'Analisis',        text: 'Sa bahaging ito, tinutulak tayo sa isang malalim na pag-aaral ng bawat nilalaman. Binibigyang-diin ang detalye, impormasyon, at ugnayin ng mga ideya. Dito malalaman ng mag-aaral ang mga mahalagang kaalaman. Ang bawat pagtanggap ng mag-aaral sa kaalaman ay may katumbas na pag-aaral na pagpapalago.' },
  { id: 'gabay-ng-ebidensya', letter: 'G', heading: 'Gabay ng Ebidensya', text: 'Sa bahaging ito, tinutulungan ang mag-aaral na mahanap at makilala ang mga ebidensya at ugnayin ng mga ideya. Dito malalaman ng mag-aaral ang mga mahalagang kaalaman na magiging batayan ng kanilang mga pagsusuri at mas malalim na pag-unawa sa paksa.' },
  { id: 'sintesis',        letter: 'S', heading: 'Sintesis',        text: 'Matuto sarin ang mga huling pinagsama-samang mga ideya upang maisang-isip ang kabuuan. Sa pamamagitan ng sintesis, ang mga mag-aaral ay magiging handa sa mas mataas na antas ng pag-iisip. Ang layunin ng sintesis ay ang pagpapalago ng kaalaman na may sapat at wastong pagpapaliwanag sa alinmang sitwasyon.' },
  { id: 'ugnayan',         letter: 'U', heading: 'Ugnayan',         text: 'Tinatasa ang mga koneksyon ng bawat mag-aaral at inuugnay ang pag-aaral sa totoong buhay. Ang layunin ng bahaging ito ay upang malaman ng mga mag-aaral ang kahalagahan ng kanilang mga natutuhan sa araw-araw na pamumuhay at pag-unlad ng lipunan.' },
  { id: 'sariling-pananaw', letter: 'S', heading: 'Sariling Pananaw', text: 'Sa bahaging ito, hinihikayat ang mag-aaral na magpahayag ng kanilang mga saloobin at pananaw. Mahalaga ang bahaging ito na makamit ang mataas na antas ng pag-iisip sa pamamagitan ng paglikha ng sariling pananaw at kahulugan.' },
  { id: 'unawang-malalim', letter: 'U', heading: 'Unawang Malalim', text: 'Ang pag-unawa sa ikatlong antas ng pagsusuri ay nagbibigay-daan sa mag-aaral na ipakita ang mataas na antas ng pag-iisip. Dito nagbibigay ng malalim na kahulugan at interpretasyon ang mga mag-aaral sa lahat ng napag-aralan nila sa nakaraang mga aralin at karanasan.' },
  { id: 'repleksyon',      letter: 'R', heading: 'Repleksyon',      text: 'Ang repleksyon ay nagpapalalim ng pag-aaral, dito sinisiyasat ng mag-aaral ang kanilang sariling pag-unlad. Nagtutulak ito sa mag-aaral na suriin ang kanilang mga proseso ng pag-iisip at pag-aaral upang mapabuti ang kanilang kakayahan sa hinaharap.' },
  { id: 'integrasyon',     letter: 'I', heading: 'Integrasyon',     text: 'Sa huling hakbang, isinasama ang lahat ng mga pag-aaral sa isang maayos na kabuuan. Ang integrasyon ay nagbibigay ng pagkakataon sa mga mag-aaral na ikonekta ang lahat ng kanilang natutuhan sa isang mas malawak na konteksto ng kaalaman, pag-unlad, at pagtanggap ng bagong kaalaman.' },
]

function loadPagsusuri() {
  // One record per LEVEL card — each is individually searchable
  const levelRecords = PAGSUSURI_LEVELS.map(level => ({
    objectID: `pagsusuri-level-${level.id}`,
    title:    level.heading,
    subtitle: `Antas ng Pagsusuri · ${level.letter}`,
    category: 'Pagsusuri',
    path:     '/pagsusuri',
    body:     level.text,
    keywords: [level.heading, level.letter, 'antas', 'pagsusuri', 'PAGSUSURI'],
  }))

  // Hero description paragraphs as one record
  const heroRecord = {
    objectID: 'pagsusuri-hero-desc',
    title:    'Ano ba ang Pagsusuri para sa isang katulad kong Mapaghamong Mag-aaral?',
    subtitle: 'Pangunahing Pahina ng Pagsusuri',
    category: 'Pagsusuri',
    path:     '/pagsusuri',
    body:     `Ang pagsusuri ay isang masusing proseso ng pag-unawa, pagbibigay-kahulugan, at paghimay sa isang teksto, ideya, karanasan, o pangyayari upang matuklasan ang mas malalim nitong kahulugan. Hindi lamang ito nakatuon sa panlabas na anyo o impormasyong nakikita, kundi sa pagtukoy ng mga nakatagong mensahe at ugnayan ng bawat isang bahagi. Sa pamamagitan ng isang pagsusuri, nabubuo ang isang malinaw at komprehensibong pag-unawa sa kabuuan ng paksa. Mahalaga rin ang paggamit ng ebidensya upang mapagtibay ang mga interpretasyon at maiwasan ang maling pagbasa. Sa aspektong akademiko, ang pagsusuri ay isang intelektuwal na gawain na nangangailangan ng lohikal, kritikal, at sistematikong pag-iisip. Kabilang dito ang pagtukoy sa layunin, tema, estruktura, at epekto ng isang akda o paksa. Ang pagsusuri ay nagsisilbing tulay sa pagitan ng teorya at praktikal na aplikasyon ng kaalaman. Pinapalakas din nito ang kakayahang magpasya batay sa ebidensya at hindi lamang sa pansariling opinyon.`,
    keywords: ['pagsusuri', 'mapaghamong mag-aaral', 'kritikal', 'pag-iisip', 'teksto', 'interpretasyon'],
  }

  // Layunin note
  const layuninNoteRecord = {
    objectID: 'pagsusuri-layunin-note',
    title:    'Layunin ng Pagsusuri',
    subtitle: 'Pangunahing layunin ng masusing pagsusuri',
    category: 'Pagsusuri',
    path:     '/pagsusuri',
    body:     'Ang pangunahing layunin ng pagsusuri ay ang maunawaan nang malalim at mabigyan ng makabuluhang interpretasyon ang isang paksa, teksto, o karanasan. Hindi ito nakatuon sa simpleng pagkuha ng impormasyon, kundi sa paghimay ng mga ideya upang matukoy ang ugnayan, kahulugan, at layunin ng mga ito. Ito rin ay naglalayong malinang ang kritikal na pag-iisip upang makabuo ng matibay na konklusyon. Higit sa lahat, ang pagsusuri ay nagiging daan upang magamit ang kaalaman sa mas praktikal at makabuluhang paraan.',
    keywords: ['layunin', 'pagsusuri', 'kritikal', 'konklusyon', 'interpretasyon'],
  }

  return [heroRecord, ...levelRecords, layuninNoteRecord]
}

// ── Source: BagongPamantayan.jsx → PAMANTAYAN_CARDS + rubric tables ───────────

const PAMANTAYAN_CARDS = [
  { id: 0, numeral: 'I',    title: 'Panimulang Impormasyon',           items: ['Titulo ng Akda', 'May-akda / Direktor / Tagasalin', 'Maikling Talambuhay ng May-Akda', 'Sanggunian'] },
  { id: 1, numeral: 'II',   title: 'Pag-unawa sa Akda',                items: ['Paksa', 'Tema', 'Layunin sa loob ng akda', 'Layunin ng awtor', 'Layunin sa Mambabasa', 'Mga Tauhan', 'Mga Suliranin', 'Kasukdulan', 'Paghawan ng Sagabal', 'Kakalasan', 'Paglalahat'] },
  { id: 2, numeral: 'III',  title: 'Pagsusuring Pampanitikan (Tekstwal)', items: ['Istilo ng Pagsulat ng Awtor', 'Kayarian ng Akda', 'Mga Tayutay', 'Mga Simbolismo', 'Integrasyong Pangbalyus / Values Integration'] },
  { id: 3, numeral: 'IV',   title: 'Pagsusuring Kontekstwal',           items: ['Teoryang Pampanitikan', 'Indibidwal at Kalagayang Sosyal', 'Kulturang Namamayani', 'Paniniwala at Tradisyon sa Loob ng Akda'] },
  { id: 4, numeral: 'V',    title: 'Makabagong Perspektibo',            items: ['Kaugnayan sa Kasalukuyang Panahon', 'Pagtingin batay sa iba\'t ibang lente (gender, kabataan, identidad)'] },
  { id: 5, numeral: 'VI',   title: 'Personal na Pagsusuri',             items: ['Repleksyon (sariling opinyon patungkol sa akda)', 'Komento, Suhestiyon at Rekomendasyon'] },
  { id: 6, numeral: 'VII',  title: 'Bisa ng Akda',                      items: ['Bisa sa Isip o Kognitibong Aspekto', 'Bisa sa Pag-uugali / Damdamin', 'Bisa sa Kasanayang Panunuri'] },
]

function loadBagongPamantayan() {
  const cardRecords = PAMANTAYAN_CARDS.map(card => ({
    objectID: `pamantayan-card-${card.id}`,
    title:    `${card.numeral}. ${card.title}`,
    subtitle: 'Bagong Pamantayan sa Pagsusuri ng Akdang Pampanitikan',
    category: 'Bagong Pamantayan',
    path:     '/bagong-pamantayan',
    body:     card.items.join('. '),
    keywords: [card.title, card.numeral, 'pamantayan', 'pagsusuri', 'akda', ...card.items],
  }))

  const introRecord = {
    objectID: 'pamantayan-intro',
    title:    'Bagong Pamantayan sa Pagsusuri ng Akdang Pampanitikan',
    subtitle: 'Panimula',
    category: 'Bagong Pamantayan',
    path:     '/bagong-pamantayan',
    body:     'Sa patuloy na pagbabago ng panahon at pag-unlad ng edukasyon, kinakailangan ding paunlarin ang mga pamamaraang ginagamit sa pagsusuri ng akdang pampanitikan. Ang mga tradisyunal na balangkas ay nagsilbing matibay na pundasyon sa paglinang ng kasanayan sa pag-aanalisa; gayunpaman, hindi na sapat ang mga ito upang matugunan ang masalimuot at dinamiko na pangangailangan ng makabagong pagkatuto. Binuo ang Bagong Pamantayan sa Pagsusuri ng Akdang Pampanitikan na naglalayong magbigay ng mas komprehensibo, sistematiko, at makabuluhang gabay sa pagsusuri. Pinagsasama nito ang mahahalagang elemento ng tradisyunal na pagsusuri at ang mga makabagong lapit sa pag-unawa ng akda.',
    keywords: ['bagong pamantayan', 'pagsusuri', 'akdang pampanitikan', 'komprehensibo', 'sistematiko', 'gabay'],
  }

  // Rubric categories as searchable records
  const rubricRecords = [
    { id: 'rubric-nilalaman',      title: 'Kalidad ng Nilalaman – 20 puntos',           body: 'Pagkilala sa akda: pamagat, may-akda, sanggunian. Buod ng akda. Pagkilala sa uri ng panitikan. Pagkilala sa mga tayutay at estetikong elemento. Kaugnayan sa konteksto ng akda panlipunan at kultural.' },
    { id: 'rubric-kritikal',       title: 'Kritikal na Pagsusuri – 20 puntos',          body: 'Paglalapat ng teoryang pampanitikan. Pagsusuri sa istilo ng paglalahad. Pagsusuri sa tauhan. Pagsusuri sa banghay o galaw ng pangyayari. Paggamit ng mga ebidensya mula sa mga sipi ng akda at tamang datos.' },
    { id: 'rubric-organisasyon',   title: 'Organisasyon at Presentasyon – 12 puntos',   body: 'Organisasyon ng papel: panimula, katawan, konklusyon. Lohikal na daloy ng ideya. Akademikong wika at kalinawan ng pagpapahayag.' },
    { id: 'rubric-mekaniks',       title: 'Mekaniks at Citation – 12 puntos',           body: 'Tamang gramatika at baybay. Paggamit ng citation. Pormat ng papel.' },
    { id: 'rubric-interpretasyon', title: 'Interpretasyon ng Pagmamarka',               body: 'Iskor 60-64: Napakahusay (100). Iskor 54-59: Mahusay (90). Iskor 48-53: Katanggap-tanggap (85). Iskor 42-47: Katamtaman (80). Iskor 40 pababa: Nangangailangan ng Pagpapabuti (75).' },
  ]

  const rubrics = rubricRecords.map(r => ({
    objectID: `pamantayan-${r.id}`,
    title:    r.title,
    subtitle: 'Pamantayan sa Pagmamarka – Bagong Pamantayan',
    category: 'Bagong Pamantayan',
    path:     '/bagong-pamantayan',
    body:     r.body,
    keywords: ['rubrik', 'pagmamarka', 'pamantayan', 'puntos', r.title],
  }))

  return [introRecord, ...cardRecords, ...rubrics]
}

// ── Source: TungkolSaAmin.jsx ─────────────────────────────────────────────────

function loadTungkolSaAmin() {
  return [
    {
      objectID: 'tsa-introduksyon',
      title:    'Introduksyon — Tungkol Sa Amin',
      subtitle: 'Ang pagsusuri bilang mahalagang kasanayan',
      category: 'Tungkol Sa Amin',
      path:     '/tungkol-sa',
      body:     'Ang pagsusuri ay hindi lamang isang akademikong gawain kundi isang mahalagang kasanayan na humuhubog sa kritikal na pag-iisip, pag-unawa sa konteksto, at pag-uugnay ng panitikan sa tunay na karanasan ng tao at lipunan. Ayon sa Seksyon 1 ng CMO Memorandum Order Blg. 21, s. 2017, na tumatalakay sa Bachelor of Arts in Literature, malinaw na itinakda ng CHED ang inaasahang kaalaman at kasanayan ng mga mag-aaral, kabilang ang kakayahan sa pagsusuri at pagpapakahulugan ng akdang pampanitikan.',
      keywords: ['introduksyon', 'pagsusuri', 'kritikal', 'CMO', 'CHED', 'pampanitikan', 'tungkol'],
    },
    {
      objectID: 'tsa-layunin',
      title:    'Layunin ng Pananaliksik — PANURI',
      subtitle: 'Tungkol Sa Amin',
      category: 'Tungkol Sa Amin',
      path:     '/tungkol-sa',
      body:     'Layunin ng pananaliksik na makabuo ng isang istandard na pamantayan at kagamitang pantulong sa pagsusuri ng mga akdang pampanitikan upang mapaunlad ang kasanayan ng mga mag-aaral sa Filipino sa asignaturang Panunuring Pampanitikan.',
      keywords: ['layunin', 'pananaliksik', 'pamantayan', 'kagamitan', 'panunuring pampanitikan', 'Filipino'],
    },
    {
      objectID: 'tsa-metodolohiya',
      title:    'Metodolohiya — Tungkol Sa Amin',
      subtitle: 'Talatanungan · Pagsusuri · Pagwawangis ng PANURI',
      category: 'Tungkol Sa Amin',
      path:     '/tungkol-sa',
      body:     'Ang pananaliksik ay gumamit ng tatlong pangunahing pamamaraan: Talatanungan, Pagsusuri, at Pagwawangis ng PANURI. Ang mga pamamaraang ito ay ginamit upang matukoy ang kasalukuyang kalagayan ng pagsusuri ng mga akdang pampanitikan at upang makabuo ng mas epektibong pamantayan.',
      keywords: ['metodolohiya', 'talatanungan', 'pagsusuri', 'pagwawangis', 'PANURI', 'pananaliksik'],
    },
    {
      objectID: 'tsa-natuklasan',
      title:    'Mga Natuklasan — Tungkol Sa Amin',
      subtitle: 'Walang Istandard na Pamantayan sa Pagsusuri',
      category: 'Tungkol Sa Amin',
      path:     '/tungkol-sa',
      body:     'Walang Istandard na Pamantayan sa Pagsusuri ng mga Akdang Pampanitikan sa asignaturang Panunuring Pampanitikan. Mahuhusay na sa Larangan ng Pagsusuri ang mga mag-aaral na nagsipagtapos sa asignaturang Panunuring Pampanitikan ngunit may mga mungkahi parin silang nais maipaunlad para sa ikakaunlad pa ng kanilang kasanayan at para sa mga susunod pang mag-aaral na kukuha ng asignaturang panunuring pampanitikan.',
      keywords: ['natuklasan', 'istandard', 'pamantayan', 'panunuring pampanitikan', 'mag-aaral', 'kasanayan'],
    },
    {
      objectID: 'tsa-tugon-panuri',
      title:    'Tugon: PANURI — Interaktibong Kagamitang Pantulong',
      subtitle: 'Ang solusyon sa kawalan ng pamantayan',
      category: 'Tungkol Sa Amin',
      path:     '/tungkol-sa',
      body:     'PANURI. Isang interaktibong kagamitang pantulong na gamit ang teknolohiya o website na naglalaman ng mga interbensyon upang mapaunlad ang kasanayan sa pagsusuri ng mga akdang pampanitikan sa asignaturang Panunuring Pampanitikan. Naglalaman din ito ng Mas Pinaunlad at Binagong Pamantayan sa pagsusuri upang tumugon sa kawalan ng isang istandardisadong pamantayan sa pagsusuri ng mga akda.',
      keywords: ['PANURI', 'interaktibo', 'website', 'kagamitan', 'pamantayan', 'pampanitikan', 'interbensyon'],
    },
    {
      objectID: 'tsa-team-edwin',
      title:    'Edwin R. Ichiano, PhD — Tagapayo',
      subtitle: 'Pangkat ng PANURI',
      category: 'Tungkol Sa Amin',
      path:     '/tungkol-sa',
      body:     'Si Edwin R. Ichiano PhD ang tagapayo ng proyektong PANURI.',
      keywords: ['Edwin', 'Ichiano', 'tagapayo', 'PhD', 'pangkat', 'PANURI'],
    },
    {
      objectID: 'tsa-team-ryan',
      title:    'Ryan S. Rodriguez, PhD — Riserts Propesor',
      subtitle: 'Pangkat ng PANURI',
      category: 'Tungkol Sa Amin',
      path:     '/tungkol-sa',
      body:     'Si Ryan S. Rodriguez PhD ang riserts propesor ng proyektong PANURI. Ang pamantayan ay ibinatay rin sa Pamantayan ni Prof. Ryan S. Rodriguez.',
      keywords: ['Ryan', 'Rodriguez', 'propesor', 'PhD', 'pangkat', 'PANURI', 'pamantayan'],
    },
    {
      objectID: 'tsa-team-johnrey',
      title:    'John Rey G. Trapalgar — May-Akda',
      subtitle: 'Pangkat ng PANURI',
      category: 'Tungkol Sa Amin',
      path:     '/tungkol-sa',
      body:     'Si John Rey G. Trapalgar ang isa sa mga may-akda ng proyektong PANURI. Email: sirtrapssy@gmail.com',
      keywords: ['John Rey', 'Trapalgar', 'may-akda', 'pangkat', 'PANURI'],
    },
    {
      objectID: 'tsa-team-neziel',
      title:    'Neziel D. Alvarez — May-Akda',
      subtitle: 'Pangkat ng PANURI',
      category: 'Tungkol Sa Amin',
      path:     '/tungkol-sa',
      body:     'Si Neziel D. Alvarez ang isa sa mga may-akda ng proyektong PANURI. Email: zyriel.alvarez@gmail.com',
      keywords: ['Neziel', 'Alvarez', 'may-akda', 'pangkat', 'PANURI'],
    },
    {
      objectID: 'tsa-quote',
      title:    'Sipi tungkol sa Pagsusuri',
      subtitle: 'Tungkol Sa Amin',
      category: 'Tungkol Sa Amin',
      path:     '/tungkol-sa',
      body:     'Ang pagsusuri ay parang pagsusulat ng sariling akda, ito ay pagbibigay ng sarili mong interpretasyon sa mga bagay sa iyong paligid.',
      keywords: ['sipi', 'quote', 'pagsusuri', 'interpretasyon', 'akda'],
    },
  ]
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Gathering records…')

  const [
    staticBooks,
    supabaseBooks,
    excerpts,
    quizSets,
    quiz,
  ] = await Promise.all([
    Promise.resolve(loadStaticBooks()),
    fetchSupabaseBooks(),
    fetchSupabaseExcerpts(),
    fetchSupabaseQuizSets(),
    fetchSupabaseQuiz(),
  ])

  // Crawl live site at panuri.online
  const htmlPages = await crawlSite()

  // Static content extracted directly from React components
  const pagsusuri       = loadPagsusuri()
  const layunin         = loadLayunin()
  const hakbang         = loadHakbang()
  const bagongPamantayan = loadBagongPamantayan()
  const tungkolSaAmin   = loadTungkolSaAmin()

  // Deduplicate: prefer Supabase books over static if same title
  const supabaseTitles = new Set(supabaseBooks.map(b => b.title))
  const dedupedStatic  = staticBooks.filter(b => !supabaseTitles.has(b.title))

  // Deduplicate HTML-crawled pages against hand-defined STATIC_PAGES (keep hand-defined)
  const manualPaths = new Set(STATIC_PAGES.map(p => p.path))
  const dedupedHtml = htmlPages.filter(p => !manualPaths.has(p.path))

  const allRecords = [
    ...STATIC_PAGES,
    ...dedupedHtml,
    ...dedupedStatic,
    ...supabaseBooks,
    ...excerpts,
    ...quizSets,
    ...quiz,
    ...pagsusuri,
    ...layunin,
    ...hakbang,
    ...bagongPamantayan,
    ...tungkolSaAmin,
  ]

  console.log(`\n📦 Total records to index: ${allRecords.length}`)
  console.log(`   Pahina (manual):      ${STATIC_PAGES.length}`)
  console.log(`   Pahina (crawled):     ${dedupedHtml.length} from ${SITE_URL}`)
  console.log(`   Mga Libro:            ${dedupedStatic.length + supabaseBooks.length}`)
  console.log(`   Excerpts:             ${excerpts.length}`)
  console.log(`   Quiz Sets:            ${quizSets.length}`)
  console.log(`   Quiz Items:           ${quiz.length}`)
  console.log(`   Pagsusuri (levels):   ${pagsusuri.length}`)
  console.log(`   Layunin:              ${layunin.length}`)
  console.log(`   Hakbang:              ${hakbang.length}`)
  console.log(`   Bagong Pamantayan:    ${bagongPamantayan.length}`)
  console.log(`   Tungkol Sa Amin:      ${tungkolSaAmin.length}`)

  // ── Replace entire index atomically ──────────────────────────────────────────
  await algolia.replaceAllObjects({
    indexName: INDEX_NAME,
    objects:   allRecords,
  })

  // ── Aggressive search settings ────────────────────────────────────────────────
  await algolia.setSettings({
    indexName: INDEX_NAME,
    indexSettings: {

      // Every meaningful field — ordered by importance
      searchableAttributes: [
        'title',
        'headings',
        'subtitle',
        'keywords',
        'description',
        'paragraphs',
        'listContent',
        'body',
      ],

      attributesForFaceting: ['category'],

      customRanking: ['asc(category)'],

      // ── Typo tolerance ────────────────────────────────────────────────────────
      // Allow 1 typo on words ≥ 4 chars, 2 typos on words ≥ 8 chars (Algolia default).
      // Lower minWordSizeForTypos to catch short Filipino words.
      typoTolerance:              true,
      minWordSizefor1Typo:        3,   // default 4 → catch 3-letter words
      minWordSizefor2Typos:       6,   // default 8 → more aggressive

      // ── Prefix / partial matching ─────────────────────────────────────────────
      // 'prefixLast' = prefix search only on the last query word (default).
      // Switch to 'prefixAll' to match prefixes on EVERY word — very aggressive.
      queryType: 'prefixAll',

      // ── Exact match bias ──────────────────────────────────────────────────────
      // Still rank exact matches higher, but don't exclude inexact.
      exactOnSingleWordQuery: 'attribute',

      // ── Snippeting / highlighting ─────────────────────────────────────────────
      attributesToSnippet: [
        'body:30',
        'paragraphs:20',
        'listContent:15',
      ],
      attributesToHighlight: [
        'title',
        'subtitle',
        'headings',
        'keywords',
      ],
      snippetEllipsisText: '…',

      // ── Results quantity ──────────────────────────────────────────────────────
      hitsPerPage:    20,
      paginationLimitedTo: 1000,

      // ── Language ──────────────────────────────────────────────────────────────
      // Filipino uses Latin script; no stemming lib needed but removing stop words helps.
      removeStopWords:    false,   // Keep all words for Filipino
      ignorePlurals:      ['en'], // English plurals only
      queryLanguages:     ['tl', 'en'],
      indexLanguages:     ['tl', 'en'],

      // ── Deduplication ─────────────────────────────────────────────────────────
      distinct:              false, // index every record individually
      advancedSyntax:        true,  // enable "quoted phrase" and -exclude syntax in queries
      allowTyposOnNumericTokens: false,
    },
  })

  console.log('\n✅ Algolia index updated successfully!')
}

main().catch(err => {
  console.error('❌ Indexing failed:', err)
  process.exit(1)
})  