// Copy and structure for the rooms. Content comes from the Katha Frames site,
// re-cut in the PARALLEL voice: short, confident, observant.
import videos from './videos.json'

export const byId = Object.fromEntries(videos.map((v) => [v.id, v]))

export const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export const media = (id) => ({
  loop: `/work/loop/${id}.mp4`,
  full: `/work/full/${id}.mp4`,
  poster: `/work/poster/${id}.jpg`,
  thumb: `/work/thumb/${id}.jpg`,
})

// Room 01 — the TVCs that went on air
export const onAir = [
  { id: 'zestbot-tvc', kind: 'TVC', line: 'A kirana owner, a supply truck and a superhero landing.' },
  { id: 'isl', kind: 'Ad film · JioCinema × Sports18', line: 'Fans, a stadium and the feeling of match day.' },
  { id: 'brand-blue', kind: 'Ad film', line: 'A walk through a clothing store that makes you want to step in.' },
]


// Room 02 — the method, shown on the ZestBot TVC
export const script = [
  { t: 'act', text: 'A supply truck arrives like every morning. The truck boy starts unloading extra boxes.' },
  { t: 'who', text: 'Ravanna' },
  { t: 'line', text: 'Stop. From today, send two boxes less.' },
  { t: 'who', text: 'Truck boy' },
  { t: 'line', text: 'What happened, Ravanna? Stock that went in two days is still here after four.' },
  { t: 'who', text: 'Ravanna' },
  { t: 'line', text: 'Everyone buys online now. Who comes to a kirana store anymore?', hl: 'The problem' },
  { t: 'act', text: 'Cut to — ZestBot lands on the truck. Ravanna looks up, amazed.', hl: 'The hero' },
  { t: 'who', text: 'ZestBot' },
  { t: 'line', text: 'Not anymore. With ZestBot, your shop goes online too.', hl: 'The promise' },
]

export const panels = ['landing', 'owner', 'truckboy', 'pickup', 'road', 'door', 'meat', 'clock', 'family', 'flying', 'hero-pose', 'ontruck', 'shop']

export const compare = [
  { id: 'landing', label: 'The landing' },
  { id: 'owner', label: 'The shopkeeper' },
  { id: 'truckboy', label: 'The truck boy' },
  { id: 'pickup', label: 'The delivery' },
  { id: 'road', label: 'The road' },
]

// the shoot — one crew, script to screen
export const crew = [
  ['Writing', 'Concepts, scripts and dialogue in English, Kannada, Telugu and Hindi.'],
  ['Storyboards', 'Every shot drawn and signed off before the shoot.'],
  ['Direction', 'Directors who think in stories, not just shots.'],
  ['Casting', 'Actors, models, anchors and creators who fit the story.'],
  ['Camera', 'Cinematographers with cinema cameras, lenses and grip.'],
  ['Lighting & art', 'Gaffers, set design, props and locations.'],
  ['Sound', 'On-set recording, voice-over, music and the final mix.'],
  ['Post', 'Edit, colour, VFX and masters for TV, OTT and social.'],
]

// Room 04 — films
export const films = ['dollars', 'mithra', 'di-files', 'harmone', 'merino']
export const filmFormats = [
  'TVC & ad films', 'Brand films', 'Corporate films', 'Feature movies',
  'Short films', 'Music videos', 'Web series', 'Documentaries',
]

// Room 05 — AI & animation, in parallel tracks
export const labTracks = [
  ['fennec-cricket', 'led-3d', 'audi-childrens-day', 'holadrive'],
  ['zestbot-ai', 'tiger-podcast', 'wellness-shampoo', 'fortinet'],
  ['atticply', 'ai-hospital', 'mockit', 'deebee'],
  ['interior', 'hk-vitals', 'mealomart-food', 'invictus'],
]
export const labSteps = ['Story', 'Script', 'Look & characters', 'Generate', 'Direct & refine', 'Edit & sound', 'Deliver']

// Room 06 — the Story Room sets (real photos of the studio)
export const sets = [
  ['teal', 'Teal Library'], ['blush', 'Blush Lounge'], ['forest', 'Forest Shelf'],
  ['gold', 'Gold Drape'], ['indigo', 'Indigo Sofa'], ['sage', 'Sage Studio'],
]
export const podcastSteps = [
  ['Come in', 'Pick a set, meet the crew.'],
  ['Talk', 'We shape topics and questions with you.'],
  ['Record', 'Multi-camera video, broadcast audio.'],
  ['Edit', 'Full episode, plus shorts and reels.'],
  ['Publish', 'YouTube, Spotify, Instagram, LinkedIn.'],
]

export const contact = {
  phone: '+91 77995 51572',
  tel: '+917799551572',
  whatsapp: 'https://wa.me/917799551572',
  email: 'info@kathaframes.com',
  address: '5th Floor, BTM 1st Stage, Outer Ring Road, Bengaluru 560029',
  cities: 'Bengaluru · Hyderabad · Dubai',
}

// Where quote requests go. Paste a form endpoint to receive leads by email:
//   Formspree  -> endpoint: 'https://formspree.io/f/<id>'
//   Web3Forms  -> endpoint: 'https://api.web3forms.com/submit', accessKey: '<key>'
// While endpoint is empty, the form hands the brief to WhatsApp instead.
export const leads = {
  endpoint: '',
  accessKey: '',
  needs: ['TVC', 'Brand film', 'Animation / AI film', 'Podcast', 'Something else'],
}
